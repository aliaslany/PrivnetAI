"""NumPy implementation of published Chebyshev and affine operations."""

from collections.abc import Mapping

import numpy as np

MAX_DEGREE = 4


def validate_degree(degree: int) -> int:
    if isinstance(degree, (bool, np.bool_)) or not isinstance(degree, (int, np.integer)):
        raise ValueError("degree must be an integer from 0 through 4")
    if not 0 <= degree <= MAX_DEGREE:
        raise ValueError("degree must be an integer from 0 through 4")
    return int(degree)


def finite_array(value, name: str, ndim: int) -> np.ndarray:
    try:
        raw = np.asarray(value)
        if raw.dtype.kind not in "iuf":
            raise ValueError("non-real or nonnumeric input")
        result = raw.astype(np.float64)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a rectangular numerical array") from exc
    if result.ndim != ndim or any(size == 0 for size in result.shape):
        raise ValueError(f"{name} must be a nonempty {ndim}-dimensional array")
    if not np.isfinite(result).all():
        raise ValueError(f"{name} must contain only finite values")
    return result


def normalize_adjacency(adjacency) -> np.ndarray:
    """Return S = D^-1/2 (A + I) D^-1/2 for an undirected graph.

    Nonnegative symmetric weights are supported. Self loops are added here,
    including at isolated nodes. The demo artifact supplies each unweighted
    undirected edge once and excludes preexisting self loops.
    """
    adjacency = finite_array(adjacency, "adjacency", 2)
    if adjacency.shape[0] != adjacency.shape[1]:
        raise ValueError("adjacency must be square")
    if np.any(adjacency < 0) or not np.allclose(adjacency, adjacency.T, atol=1e-12, rtol=0):
        raise ValueError("adjacency must be nonnegative and symmetric")
    with np.errstate(over="ignore", invalid="ignore"):
        looped = adjacency + np.eye(adjacency.shape[0])
        degrees = looped.sum(axis=1)
        reciprocal = 1.0 / np.sqrt(degrees)
        shift = reciprocal[:, None] * looped * reciprocal[None, :]
    if not np.isfinite(degrees).all() or not np.isfinite(shift).all():
        raise ValueError("adjacency normalization overflowed")
    return shift


def compile_chebyshev_blocks(shift, features, degree: int = MAX_DEGREE) -> np.ndarray:
    """Compile [X, SX, 2S(SX)-X, ...] locally; shape is (K+1, N, F).

    S is the normalized adjacency, with spectrum in [-1, 1]. This is a
    Chebyshev polynomial bank, not independent per-hop message passing.
    """
    degree = validate_degree(degree)
    shift = finite_array(shift, "shift", 2)
    features = finite_array(features, "features", 2)
    if shift.shape != (features.shape[0], features.shape[0]):
        raise ValueError("shift must be square with one row per feature node")
    if not np.allclose(shift, shift.T, atol=1e-12, rtol=0):
        raise ValueError("shift must be symmetric")
    blocks = [features.copy()]
    if degree:
        blocks.append(shift @ features)
    with np.errstate(over="ignore", invalid="ignore"):
        for _ in range(2, degree + 1):
            blocks.append(2.0 * shift @ blocks[-1] - blocks[-2])
    result = np.stack(blocks)
    if not np.isfinite(result).all():
        raise ValueError("Chebyshev compilation overflowed")
    return result


def evaluate_affine(blocks, theta, bias, degree: int | None = None) -> np.ndarray:
    """Evaluate sum_{k=0}^degree B_k theta_k + bias."""
    blocks = finite_array(blocks, "blocks", 3)
    theta = finite_array(theta, "theta", 3)
    bias = finite_array(bias, "bias", 1)
    degree = validate_degree(blocks.shape[0] - 1 if degree is None else degree)
    if degree >= blocks.shape[0] or degree >= theta.shape[0]:
        raise ValueError("selected degree exceeds the available blocks or theta")
    if theta.shape[1] != blocks.shape[2] or theta.shape[2] != bias.size:
        raise ValueError("theta feature/hidden dimensions must match blocks and bias")
    with np.errstate(over="ignore", invalid="ignore"):
        value = np.einsum("knf,kfh->nh", blocks[:degree + 1], theta[:degree + 1]) + bias
    if not np.isfinite(value).all():
        raise ValueError("affine evaluation overflowed")
    return value


def evaluate_polynomial(value, coefficients) -> np.ndarray:
    """Evaluate a polynomial with coefficients in ascending power order."""
    value = finite_array(value, "activation input", 2)
    coefficients = finite_array(coefficients, "activation coefficients", 1)
    if coefficients.size > 17:
        raise ValueError("activation degree must be at most 16")
    result = np.zeros_like(value)
    with np.errstate(over="ignore", invalid="ignore"):
        for coefficient in coefficients[::-1]:
            result = result * value + coefficient
    if not np.isfinite(result).all():
        raise ValueError("polynomial evaluation overflowed")
    return result


def evaluate_readout(hidden, output_weights, output_bias) -> np.ndarray:
    hidden = finite_array(hidden, "hidden", 2)
    weights = finite_array(output_weights, "output weights", 2)
    bias = finite_array(output_bias, "output bias", 1)
    if hidden.shape[1] != weights.shape[0] or weights.shape[1] != bias.size:
        raise ValueError("readout dimensions must match hidden and bias")
    with np.errstate(over="ignore", invalid="ignore"):
        result = hidden @ weights + bias
    if not np.isfinite(result).all():
        raise ValueError("readout evaluation overflowed")
    return result


def model_arrays(model: Mapping) -> dict[str, np.ndarray]:
    """Validate the clear model, shared by plaintext and CKKS evaluators."""
    if not isinstance(model, Mapping):
        raise ValueError("model must be a mapping")
    dimensions = {"theta": 3, "bias": 1, "activation_coefficients": 1,
                  "output_weights": 2, "output_bias": 1}
    try:
        arrays = {key: finite_array(model[key], key, ndim) for key, ndim in dimensions.items()}
    except KeyError as exc:
        raise ValueError(f"model is missing {exc.args[0]}") from exc
    theta, bias = arrays["theta"], arrays["bias"]
    weights, output_bias = arrays["output_weights"], arrays["output_bias"]
    if theta.shape[0] > MAX_DEGREE + 1 or theta.shape[2] != bias.size:
        raise ValueError("model theta degree/hidden dimensions are invalid")
    if weights.shape != (bias.size, output_bias.size):
        raise ValueError("model readout dimensions do not match")
    return arrays


def evaluate_model(blocks, model: Mapping, degree: int | None = None) -> np.ndarray:
    model = model_arrays(model)
    affine = evaluate_affine(blocks, model["theta"], model["bias"], degree)
    hidden = evaluate_polynomial(affine, model["activation_coefficients"])
    return evaluate_readout(hidden, model["output_weights"], model["output_bias"])
