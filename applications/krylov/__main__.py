"""Run the public synthetic demonstration with plaintext or genuine CKKS."""

import argparse
import json
from pathlib import Path
import platform
import sys
import time

import numpy as np

from .core import MAX_DEGREE, compile_chebyshev_blocks, evaluate_affine, evaluate_model, normalize_adjacency
from .demo import DEFAULT_DEGREE, fixture_arrays, make_demo


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def run(args) -> int:
    if args.fixture:
        if args.fixture.stat().st_size > 1024 * 1024:
            raise ValueError("fixture JSON must be at most 1 MiB")
        fixture = json.loads(args.fixture.read_text(encoding="utf-8"))
    else:
        fixture = make_demo()
    adjacency, features, labels = fixture_arrays(fixture)
    degree = fixture["default_degree"] if args.degree is None else args.degree
    if degree >= len(fixture["model"]["theta"]):
        raise ValueError("selected degree exceeds the fixture theta bank")
    start = time.perf_counter()
    blocks = compile_chebyshev_blocks(normalize_adjacency(adjacency), features, degree)
    compile_seconds = time.perf_counter() - start
    start = time.perf_counter()
    reference = evaluate_model(blocks, fixture["model"], degree)
    plain_seconds = time.perf_counter() - start
    details = {"plaintext_evaluation_seconds": plain_seconds}
    logits = reference
    if args.backend == "ckks":
        from .ckks import run_ckks

        logits, details = run_ckks(blocks, fixture["model"], degree)
    affine = evaluate_affine(blocks, fixture["model"]["theta"], fixture["model"]["bias"], degree)
    predictions = logits.argmax(axis=1)
    reference_predictions = reference.argmax(axis=1)
    result = {
        "schema_version": 1, "application": "PrivnetAI independent Krylov demonstration",
        "backend": args.backend, "measurement_kind": "executed real CKKS" if args.backend == "ckks" else "executed plaintext",
        "degree": degree, "nodes": len(labels), "features": features.shape[1],
        "hidden_channels": affine.shape[1], "classes": logits.shape[1],
        "accuracy_scope": fixture["provenance"].get("evaluation_scope", "Illustrative all-node accuracy; no held-out split evaluated"),
        "all_node_accuracy": float(np.mean(predictions == labels)),
        "plaintext_all_node_accuracy": float(np.mean(reference_predictions == labels)),
        "prediction_agreement_with_same_plain_model": float(np.mean(predictions == reference_predictions)),
        "max_absolute_logit_error": float(np.max(np.abs(logits - reference))),
        "mean_absolute_logit_error": float(np.mean(np.abs(logits - reference))),
        "observed_affine_range": [float(affine.min()), float(affine.max())],
        "client_compilation_seconds": compile_seconds,
        "predictions": predictions.tolist(), "logits": logits.tolist(),
        "provenance": fixture["provenance"],
        "environment": {"python": platform.python_version(), "numpy": np.__version__,
                        "platform": platform.platform(), "machine": platform.machine()},
        "details": details,
    }
    write_json(args.output, result)
    if args.export_demo:
        write_json(args.export_demo, fixture)
    print(json.dumps({"backend": args.backend, "degree": degree,
                      "all_node_accuracy": result["all_node_accuracy"],
                      "accuracy_scope": result["accuracy_scope"],
                      "same_model_agreement": result["prediction_agreement_with_same_plain_model"],
                      "max_absolute_logit_error": result["max_absolute_logit_error"],
                      "output": str(args.output)}, indent=2))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", choices=("plain", "ckks"), default="plain")
    parser.add_argument("--degree", type=int, choices=range(MAX_DEGREE + 1),
                        help=f"Truncation degree; defaults to fixture default_degree ({DEFAULT_DEGREE} for the synthetic demo)")
    parser.add_argument("--fixture", type=Path, help="Optional public browser-schema fixture JSON, at most 1 MiB")
    parser.add_argument("--output", type=Path, default=Path("krylov-results.json"), help="Result JSON file")
    parser.add_argument("--export-demo", type=Path, help="Export public browser fixture JSON")
    args = parser.parse_args(argv)
    paths = [path.resolve() for path in (args.fixture, args.output, args.export_demo) if path]
    if len(paths) != len(set(paths)):
        parser.error("fixture, output and export-demo must use distinct paths")
    try:
        return run(args)
    except (OSError, UnicodeError, ValueError, ImportError, RuntimeError) as exc:
        parser.exit(2, f"Krylov run failed: {exc}\n")


if __name__ == "__main__":
    sys.exit(main())
