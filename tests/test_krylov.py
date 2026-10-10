"""Check independent polynomial oracles and the real HE serialization boundary."""

import copy
import json
from pathlib import Path
import subprocess
import sys

import numpy as np
import pytest

from applications.krylov import (
    compile_chebyshev_blocks, evaluate_affine, evaluate_model,
    evaluate_polynomial, evaluate_readout, normalize_adjacency,
)
from applications.krylov.demo import fixture_arrays, make_demo


def direct_blocks(shift, features):
    """Independent closed-form polynomials, not the recurrence under test."""
    identity = np.eye(len(shift))
    square = shift @ shift
    cube = square @ shift
    fourth = square @ square
    operators = [identity, shift, 2 * square - identity,
                 4 * cube - 3 * shift, 8 * fourth - 8 * square + identity]
    return np.stack([operator @ features for operator in operators])


def direct_logits(blocks, model, degree):
    theta = np.asarray(model["theta"])
    affine = np.broadcast_to(np.asarray(model["bias"]), (blocks.shape[1], theta.shape[2])).copy()
    for k in range(degree + 1):
        affine += blocks[k] @ theta[k]
    hidden = sum(coefficient * affine ** power
                 for power, coefficient in enumerate(model["activation_coefficients"]))
    return hidden @ np.asarray(model["output_weights"]) + np.asarray(model["output_bias"])


def test_normalization_includes_isolated_node_and_symmetric_degree_weights():
    adjacency = np.array([[0, 2, 0], [2, 0, 0], [0, 0, 0]])
    expected = np.array([[1 / 3, 2 / 3, 0], [2 / 3, 1 / 3, 0], [0, 0, 1]])
    np.testing.assert_allclose(normalize_adjacency(adjacency), expected)


@pytest.mark.parametrize("degree", range(5))
def test_chebyshev_recurrence_matches_closed_form_polynomials(degree):
    rng = np.random.default_rng(923)
    adjacency = np.array([[0, 1, 0, 1], [1, 0, 1, 0], [0, 1, 0, 0], [1, 0, 0, 0]])
    shift = normalize_adjacency(adjacency)
    features = rng.normal(size=(4, 3))
    np.testing.assert_allclose(compile_chebyshev_blocks(shift, features, degree),
                               direct_blocks(shift, features)[:degree + 1], atol=1e-12)


def test_affine_polynomial_readout_matches_direct_oracle():
    rng = np.random.default_rng(413)
    blocks = rng.uniform(-0.3, 0.3, size=(5, 7, 3))
    model = {
        "theta": rng.normal(size=(5, 3, 4)), "bias": rng.normal(size=4),
        "activation_coefficients": [0.2, -0.4, 0.3, 0.1],
        "output_weights": rng.normal(size=(4, 2)), "output_bias": [0.13, -0.21],
    }
    for degree in range(5):
        np.testing.assert_allclose(evaluate_model(blocks, model, degree),
                                   direct_logits(blocks, model, degree), atol=1e-12)


@pytest.mark.parametrize("degree", [-1, 5, 1.5, True])
def test_invalid_degrees_are_rejected(degree):
    with pytest.raises(ValueError, match="degree"):
        compile_chebyshev_blocks(np.eye(2), np.ones((2, 1)), degree)


@pytest.mark.parametrize("adjacency", [
    [[0, 1], [0, 0]], [[0, -1], [-1, 0]], [[0, np.inf], [np.inf, 0]],
    [[0, np.nan], [np.nan, 0]], [[0, 1, 2], [1, 0, 2]], [],
])
def test_invalid_adjacency_is_rejected(adjacency):
    with pytest.raises(ValueError):
        normalize_adjacency(adjacency)


def test_invalid_shapes_finiteness_and_overflow_are_rejected():
    with pytest.raises(ValueError):
        compile_chebyshev_blocks(np.eye(3), np.ones((2, 1)), 2)
    with pytest.raises(ValueError):
        evaluate_affine(np.ones((2, 3, 1)), np.ones((2, 2, 1)), [0], 1)
    with pytest.raises(ValueError):
        evaluate_affine(np.ones((1, 3, 1)), np.ones((1, 1, 1)), [0], 1)
    with pytest.raises(ValueError):
        evaluate_polynomial(np.ones((3, 1)), [0, np.nan])
    with pytest.raises(ValueError):
        evaluate_polynomial(np.full((3, 1), 1e300), [0, 0, 1])
    with pytest.raises(ValueError):
        evaluate_readout(np.ones((3, 2)), np.ones((3, 2)), [0, 0])


@pytest.mark.parametrize("features", [[["0.1"]], [[True]], [[0.1 + 0.2j]]])
def test_real_numerical_arrays_do_not_coerce_strings_booleans_or_complex(features):
    with pytest.raises(ValueError):
        compile_chebyshev_blocks(np.eye(1), features, 0)


@pytest.mark.parametrize("defect", ["duplicate", "self_loop", "out_of_bounds", "float_labels", "feature_width"])
def test_demo_fixture_rejects_invalid_graph_semantics(defect):
    fixture = make_demo()
    if defect == "duplicate":
        fixture["edges"].append(fixture["edges"][0])
    elif defect == "self_loop":
        fixture["edges"].append([0, 0])
    elif defect == "out_of_bounds":
        fixture["edges"].append([0, len(fixture["nodes"])])
    elif defect == "float_labels":
        fixture["labels"] = [float(label) for label in fixture["labels"]]
    else:
        fixture["features"][0] = [0]
    with pytest.raises(ValueError):
        fixture_arrays(fixture)


@pytest.mark.parametrize("fixture", [[], None, {"schema_version": 1, "nodes": [None]},
                                      {"schema_version": 1, "nodes": [{}] * 121}])
def test_malformed_or_oversized_fixture_is_rejected_before_dense_allocation(fixture):
    with pytest.raises(ValueError):
        fixture_arrays(fixture)


@pytest.mark.parametrize("degree", [0, 2, 4])
def test_cli_and_exported_browser_artifact_match_independent_oracle(tmp_path, degree):
    output = tmp_path / "result.json"
    artifact_path = tmp_path / "fixture.json"
    run = subprocess.run([
        sys.executable, "-m", "applications.krylov", "--backend", "plain", "--degree", str(degree),
        "--output", str(output), "--export-demo", str(artifact_path),
    ], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True)
    assert run.returncode == 0, run.stderr
    result = json.loads(output.read_text())
    fixture = json.loads(artifact_path.read_text())
    adjacency, features, labels = fixture_arrays(fixture)
    looped = adjacency + np.eye(len(labels))
    inverse_degrees = 1 / np.sqrt(looped.sum(axis=1))
    independent_shift = inverse_degrees[:, None] * looped * inverse_degrees[None, :]
    reference = direct_logits(direct_blocks(independent_shift, features), fixture["model"], degree)
    np.testing.assert_allclose(result["logits"], reference, atol=1e-12)
    assert result["degree"] == degree
    assert result["measurement_kind"] == "executed plaintext"
    assert result["accuracy_scope"] == "Illustrative all-node/training accuracy; no held-out split"
    assert len(fixture["model"]["theta"]) == 5
    assert fixture["provenance"]["training_degree"] == 4
    assert result["predictions"] == reference.argmax(axis=1).tolist()


@pytest.mark.parametrize("invalid_input", [b"[]", b"{bad json}", b"\xff\xfe\x00"])
def test_cli_bad_fixture_exits_cleanly_without_writing_result(tmp_path, invalid_input):
    fixture = tmp_path / "invalid.json"
    output = tmp_path / "result.json"
    fixture.write_bytes(invalid_input)
    run = subprocess.run([
        sys.executable, "-m", "applications.krylov", "--fixture", str(fixture), "--output", str(output),
    ], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True)
    assert run.returncode == 2
    assert "Krylov run failed" in run.stderr
    assert "Traceback" not in run.stderr
    assert not output.exists()


def test_cli_import_uses_fixture_degree_and_rejects_unavailable_degree(tmp_path):
    fixture = make_demo()
    fixture["default_degree"] = 1
    fixture["model"]["theta"] = fixture["model"]["theta"][:2]
    fixture_path = tmp_path / "fixture.json"
    fixture_path.write_text(json.dumps(fixture))
    output = tmp_path / "result.json"
    command = [sys.executable, "-m", "applications.krylov", "--fixture", str(fixture_path), "--output", str(output)]
    cwd = Path(__file__).resolve().parents[1]
    run = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    assert run.returncode == 0, run.stderr
    assert json.loads(output.read_text())["degree"] == 1
    unavailable_output = tmp_path / "unavailable.json"
    run = subprocess.run(command[:-1] + [str(unavailable_output), "--degree", "4"],
                         cwd=cwd, capture_output=True, text=True)
    assert run.returncode == 2
    assert "exceeds the fixture theta bank" in run.stderr
    assert not unavailable_output.exists()


@pytest.fixture(scope="module")
def encrypted_example():
    ts = pytest.importorskip("tenseal")
    from applications.krylov.ckks import client_encrypt_blocks

    blocks = np.array([[[0.3, -0.2], [0.1, 0.4], [-0.2, 0.2]],
                       [[0.1, 0.2], [-0.1, 0.3], [0.4, -0.2]]])
    model = {
        "theta": [[[0.2, -0.1], [0.3, 0.4]], [[-0.15, 0.2], [0.1, -0.2]]],
        "bias": [0.1, -0.2], "activation_coefficients": [0, 0, 1],
        "output_weights": [[0.3, -0.4], [-0.2, 0.6]], "output_bias": [0.05, -0.03],
    }
    session, request, _ = client_encrypt_blocks(blocks, 1)
    return ts, session, request, model, blocks


def test_real_ckks_public_server_boundary_and_same_model_fidelity(encrypted_example):
    ts, session, request, model, blocks = encrypted_example
    from applications.krylov.ckks import evaluate_server

    public_context = ts.context_from(request.public_context, n_threads=2)
    assert public_context.is_public()
    assert not public_context.has_secret_key()
    assert session.context.has_secret_key()
    assert all(isinstance(column, bytes) for columns in request.block_columns for column in columns)
    response, details = evaluate_server(request, model)
    assert all(isinstance(column, bytes) for column in response)
    with pytest.raises((ValueError, RuntimeError)):
        ts.ckks_vector_from(public_context, response[0]).decrypt()
    np.testing.assert_allclose(session.decrypt(response), direct_logits(blocks, model, 1), atol=1e-4, rtol=0)
    assert details["server_context_has_secret_key"] is False
    assert details["operations"]["rotations"] == 0
    assert request.ciphertext_bytes > 0


def test_server_rejects_secret_bearing_context(encrypted_example):
    _, session, request, model, _ = encrypted_example
    from dataclasses import replace
    from applications.krylov.ckks import evaluate_server

    unsafe_context = session.context.serialize(save_secret_key=True, save_galois_keys=False)
    with pytest.raises(ValueError, match="no secret key"):
        evaluate_server(replace(request, public_context=unsafe_context), model)


def test_ckks_rejects_unsupported_activation_without_plain_fallback(encrypted_example):
    _, _, request, model, _ = encrypted_example
    from applications.krylov.ckks import evaluate_server

    unsupported = copy.deepcopy(model)
    unsupported["activation_coefficients"] = [0, 1]
    with pytest.raises(ValueError, match="square"):
        evaluate_server(request, unsupported)


@pytest.mark.parametrize("zero_column", ["affine", "readout", "both"])
def test_real_ckks_all_zero_columns_do_not_create_transparent_ciphertexts(encrypted_example, zero_column):
    _, session, request, model, blocks = encrypted_example
    from applications.krylov.ckks import evaluate_server

    model = copy.deepcopy(model)
    if zero_column in ("affine", "both"):
        theta = np.asarray(model["theta"])
        theta[:, :, 0] = 0
        model["theta"] = theta.tolist()
        model["bias"][0] = 0
    if zero_column in ("readout", "both"):
        weights = np.asarray(model["output_weights"])
        weights[:, 0] = 0
        model["output_weights"] = weights.tolist()
        model["output_bias"][0] = 0
    response, details = evaluate_server(request, model)
    np.testing.assert_allclose(session.decrypt(response), direct_logits(blocks, model, 1), atol=1e-4, rtol=0)
    assert details["operations"]["public_key_encryptions_of_constant_columns"] >= 1
