"""Controlled arithmetic ablation of PrivnetAI's Cora ridge head.

This is simulated fixed-point arithmetic, not homomorphic encryption.
Application sources are read without modification. The repository dataset
loader may download and process Cora when its cache is absent.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime
import io
import json
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

import torch
import torch.nn.functional as F

from core.utils import set_seed
from crypto.encryption import EncryptionShim
from datasets import load_planetoid
from ml.models.models import GCN
from ml.training.trainer import TrainConfig, train_and_eval


def metrics(logits, baseline, labels, test_mask):
    pred = logits.argmax(1)
    reference_pred = baseline.argmax(1)
    error = (logits.to(torch.float64) - baseline.to(torch.float64)).abs()
    top2 = baseline.topk(2, dim=1).values.to(torch.float64)
    margin = top2[:, 0] - top2[:, 1]
    local_error = error.amax(dim=1)
    return {
        'test_accuracy': (pred[test_mask] == labels[test_mask]).double().mean().item(),
        'prediction_agreement_all': (pred == reference_pred).double().mean().item(),
        'prediction_agreement_test': (pred[test_mask] == reference_pred[test_mask]).double().mean().item(),
        'max_absolute_logit_error_all': error.max().item(),
        'mean_absolute_logit_error_all': error.mean().item(),
        'max_absolute_logit_error_test': error[test_mask].max().item(),
        'mean_absolute_logit_error_test': error[test_mask].mean().item(),
        'test_prediction_certified_by_margin_fraction': (margin[test_mask] > 2 * local_error[test_mask]).double().mean().item(),
    }


def run(seed, output_dir):
    set_seed(seed)
    dataset, data = load_planetoid(root=str(ROOT / 'data'), name='Cora')
    model = GCN(dataset.num_node_features, 64, dataset.num_classes, 0.5)
    capture = io.StringIO()
    with contextlib.redirect_stdout(capture):
        stats = train_and_eval(model, data, TrainConfig(lr=0.01, weight_decay=5e-4, epochs=50), 'cpu')
    print(f'seed={seed}: ' + capture.getvalue().strip().splitlines()[-1], flush=True)
    model.eval()
    with torch.no_grad():
        H = model.forward_hidden(data.x, data.edge_index)
    X = H[data.train_mask]
    Y = F.one_hot(data.y[data.train_mask], num_classes=dataset.num_classes).to(torch.float32)
    W = torch.linalg.solve(X.T @ X + 1e-3 * torch.eye(X.size(1)), X.T @ Y)
    b = (Y - X @ W).mean(dim=0)
    plain_logits = H @ W + b
    shim = EncryptionShim(scale=256.0)
    enc_H = shim.encrypt_tensor(H)
    current_logits = shim.decrypt_tensor(shim.matmul_linear_only(enc_H, W)) + b
    quantized_H = torch.round(H * 256.0).to(torch.int64)
    result = {
        'seed': seed,
        'gcn': stats,
        'plain_ridge': metrics(plain_logits, plain_logits, data.y, data.test_mask),
        'current_shim_unscaled_weight_rounding': metrics(current_logits, plain_logits, data.y, data.test_mask),
        'weights': {
            'minimum': W.min().item(),
            'maximum': W.max().item(),
            'mean_absolute': W.abs().mean().item(),
            'fraction_zero_after_unscaled_rounding': (W.round() == 0).double().mean().item(),
        },
        'correctly_scaled_simulations': [],
        'joint_feature_weight_precision_simulations': [],
    }
    for weight_scale in (256, 1024, 4096):
        quantized_W = torch.round(W.to(torch.float64) * weight_scale).to(torch.int64)
        integer_product = quantized_H @ quantized_W
        masked_product = enc_H.payload @ quantized_W - enc_H.mask @ quantized_W
        masked_equal = torch.equal(integer_product, masked_product)
        assert masked_equal, 'Masked and unmasked simulated arithmetic disagree.'
        scaled_logits = integer_product.to(torch.float64) / (256.0 * weight_scale) + b.to(torch.float64)
        row = metrics(scaled_logits, plain_logits, data.y, data.test_mask)
        row.update({
            'feature_scale': 256,
            'weight_scale': weight_scale,
            'output_scale': 256 * weight_scale,
            'bias_added_in_plaintext_like_current_main': True,
            'masked_and_unmasked_integer_products_identical': masked_equal,
            'maximum_absolute_unmasked_integer_accumulator': integer_product.abs().max().item(),
        })
        result['correctly_scaled_simulations'].append(row)
    for joint_scale in (1024, 4096):
        precise_shim = EncryptionShim(scale=float(joint_scale))
        precise_enc_H = precise_shim.encrypt_tensor(H)
        precise_H = torch.round(H * joint_scale).to(torch.int64)
        precise_W = torch.round(W.to(torch.float64) * joint_scale).to(torch.int64)
        integer_product = precise_H @ precise_W
        masked_product = precise_enc_H.payload @ precise_W - precise_enc_H.mask @ precise_W
        masked_equal = torch.equal(integer_product, masked_product)
        assert masked_equal, 'Masked and unmasked simulated arithmetic disagree.'
        precise_logits = integer_product.to(torch.float64) / (joint_scale * joint_scale) + b.to(torch.float64)
        row = metrics(precise_logits, plain_logits, data.y, data.test_mask)
        row.update({
            'feature_scale': joint_scale,
            'weight_scale': joint_scale,
            'output_scale': joint_scale * joint_scale,
            'bias_added_in_plaintext_like_current_main': True,
            'masked_and_unmasked_integer_products_identical': masked_equal,
            'maximum_absolute_unmasked_integer_accumulator': integer_product.abs().max().item(),
        })
        result['joint_feature_weight_precision_simulations'].append(row)
    (output_dir / f'numerical-ablation-seed-{seed}.log').write_text(capture.getvalue())
    print(json.dumps(result, indent=2), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=pathlib.Path,
                        help='Directory for new results; defaults to a fresh temporary directory.')
    args = parser.parse_args()
    output_dir = (args.output_dir.resolve() if args.output_dir is not None
                  else pathlib.Path(tempfile.mkdtemp(prefix='privnetai-ablation-')))
    archive_dir = pathlib.Path(__file__).resolve().parent
    if output_dir == archive_dir or archive_dir in output_dir.parents:
        parser.error('Choose an output directory outside the research archive.')
    outputs = ['numerical-ablation.json',
               *[f'numerical-ablation-seed-{seed}.log' for seed in (42, 43, 44)]]
    if any((output_dir / name).exists() for name in outputs):
        parser.error('Output files already exist; choose a fresh output directory.')
    output_dir.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(2)
    report = {
        'created_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'Controlled same-model arithmetic ablation; simulated fixed-point arithmetic only, no real encryption or privacy guarantee.',
        'configuration': {
            'dataset': 'Cora / Planetoid standard split, NormalizeFeatures',
            'epochs': 50,
            'hidden_channels': 64,
            'dropout': 0.5,
            'learning_rate': 0.01,
            'weight_decay': 5e-4,
            'ridge_lambda': 1e-3,
            'device': 'cpu',
            'threads': torch.get_num_threads(),
            'torch_version': torch.__version__,
            'baseline': 'float32 ridge classifier on identical first-GCN-layer hidden features; bias matches main.py',
            'checkpoint': 'best validation accuracy within 50 training epochs, same as repository trainer',
            'seeds': [42, 43, 44],
        },
        'results': [run(seed, output_dir) for seed in (42, 43, 44)],
    }
    path = output_dir / 'numerical-ablation.json'
    path.write_text(json.dumps(report, indent=2) + '\n')
    print(f'Results written to {path}', flush=True)


if __name__ == '__main__':
    main()
