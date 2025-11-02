import pytest
import torch
from datasets import load_planetoid
from ml.models.models import GCN
from ml.training.trainer import TrainConfig, train_and_eval
from crypto.encryption import EncryptionShim

class TestIntegration:
    def test_basic_training_pipeline(self):
        """Test the complete training pipeline works"""
        dataset, data = load_planetoid(name="Cora")
        model = GCN(dataset.num_node_features, 16, dataset.num_classes)
        
        # Quick training with few epochs
        config = TrainConfig(lr=0.01, epochs=5)
        stats = train_and_eval(model, data, config)
        
        assert 'train_acc' in stats
        assert 'val_acc' in stats
        assert 'test_acc' in stats
        assert stats['train_acc'] > 0.0
    
    def test_encrypted_inference(self):
        """Test encrypted linear head evaluation"""
        dataset, data = load_planetoid(name="Cora")
        model = GCN(dataset.num_node_features, 16, dataset.num_classes)
        
        # Get hidden representations
        with torch.no_grad():
            hidden = model.forward_hidden(data.x, data.edge_index)
        
        # Test encryption shim works on real data
        shim = EncryptionShim(scale=256.0)
        enc_hidden = shim.encrypt_tensor(hidden)
        
        W = torch.randn(hidden.size(1), dataset.num_classes)
        enc_logits = shim.matmul_linear_only(enc_hidden, W)
        logits_dec = shim.decrypt_tensor(enc_logits)
        
        assert logits_dec.shape == (data.x.size(0), dataset.num_classes)
