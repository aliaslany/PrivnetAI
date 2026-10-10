"""Small deterministic, independently trained illustrative graph classifier."""

from collections.abc import Mapping

import numpy as np

from .core import MAX_DEGREE, compile_chebyshev_blocks, evaluate_affine, normalize_adjacency

SOURCE_URL = "https://github.com/chimans/PrivNet-Krylov"
SOURCE_COMMIT = "0976e41881192da938ef2ab988c2fe3fdb92835b"
DEFAULT_DEGREE = 2


def _ridge(design, target, penalties):
    # Solve a regularized least-squares system, including a weakly penalized bias.
    augmented = np.column_stack([design, np.ones(design.shape[0])])
    regularization = np.diag(np.r_[penalties, 1e-6])
    solution = np.linalg.solve(augmented.T @ augmented + regularization, augmented.T @ target)
    return solution[:-1], solution[-1]


def make_demo(seed: int = 17) -> dict:
    """Return a public 24-node fixture; all labels are used during fitting.

    Accuracy on this fixture is illustrative training/all-node accuracy. It is
    deliberately not a held-out research result or an upstream benchmark.
    """
    rng = np.random.default_rng(seed)
    node_count, feature_count, hidden_count = 24, 3, 4
    labels = np.repeat([0, 1], node_count // 2)
    edge_set = set()
    for start in (0, node_count // 2):
        for i in range(node_count // 2):
            for offset in (1, 2):
                left = start + i
                right = start + (i + offset) % (node_count // 2)
                edge_set.add(tuple(sorted((left, right))))
    edge_set.update({(2, 14), (7, 19), (10, 22)})
    edges = sorted(edge_set)
    adjacency = np.zeros((node_count, node_count))
    for left, right in edges:
        adjacency[left, right] = adjacency[right, left] = 1.0
    signed_class = 2 * labels - 1
    features = np.column_stack([
        0.5 * signed_class + rng.normal(0, 0.55, node_count),
        0.2 * signed_class + rng.normal(0, 0.35, node_count),
        np.full(node_count, 0.25),
    ])
    blocks = compile_chebyshev_blocks(normalize_adjacency(adjacency), features, MAX_DEGREE)
    design = blocks.transpose(1, 0, 2).reshape(node_count, -1)
    one_hot = np.eye(2)[labels]
    hidden_targets = one_hot @ np.array([[0.9, 0.2, 0.65, 0.1], [0.2, 0.9, 0.1, 0.65]])
    penalties = np.repeat(0.15 * (1 + 0.7 * np.arange(MAX_DEGREE + 1) ** 2), feature_count)
    flat_theta, bias = _ridge(design, hidden_targets, penalties)
    theta = flat_theta.reshape(MAX_DEGREE + 1, feature_count, hidden_count)
    hidden = evaluate_affine(blocks, theta, bias, MAX_DEGREE) ** 2
    output_weights, output_bias = _ridge(hidden, one_hot, np.full(hidden_count, 0.02))
    model = {
        "theta": theta.tolist(), "bias": bias.tolist(),
        "activation_coefficients": [0.0, 0.0, 1.0],
        "output_weights": output_weights.tolist(), "output_bias": output_bias.tolist(),
    }
    return {
        "schema_version": 1,
        "name": "Synthetic two-community Krylov demonstration",
        "nodes": [{"id": i, "label": f"Node {i + 1}"} for i in range(node_count)],
        "edges": [list(edge) for edge in edges],
        "features": features.tolist(), "labels": labels.tolist(), "model": model,
        "default_degree": DEFAULT_DEGREE,
        "provenance": {
            "implementation": "Independent NumPy implementation; no upstream code copied",
            "mathematical_source_url": SOURCE_URL, "source_commit": SOURCE_COMMIT,
            "dataset": "Public synthetic two-community graph generated locally",
            "seed": seed, "training": "Two ridge fits with square activation; all nodes used",
            "training_degree": MAX_DEGREE, "maximum_degree": MAX_DEGREE,
            "evaluation_scope": "Illustrative all-node/training accuracy; no held-out split",
            "normalization": "S = D^-1/2 (A + I) D^-1/2; undirected unweighted edges",
            "degree_selection": "Truncates a fixed trained theta bank; does not retrain",
            "privacy": "Browser artifact is entirely public; browser arithmetic is plaintext",
            "benchmark_claim": "No upstream accuracy, runtime, security or PQ claim is reproduced",
        },
    }


def fixture_arrays(fixture: dict):
    """Validate demo graph semantics and return adjacency, features, labels."""
    if not isinstance(fixture, Mapping):
        raise ValueError("demo fixture must be a JSON object")
    if type(fixture.get("schema_version")) is not int or fixture.get("schema_version") != 1:
        raise ValueError("unsupported demo schema version")
    if not isinstance(fixture.get("provenance"), Mapping):
        raise ValueError("demo provenance must be an object")
    nodes = fixture.get("nodes", [])
    if not isinstance(nodes, (list, tuple)) or not 1 <= len(nodes) <= 120:
        raise ValueError("demo fixture must contain from 1 through 120 nodes")
    if any(not isinstance(node, Mapping) for node in nodes):
        raise ValueError("each demo node must be an object")
    if any(isinstance(node.get("id"), bool) or not isinstance(node.get("id"), int) for node in nodes):
        raise ValueError("node ids must be integers")
    if [node.get("id") for node in nodes] != list(range(len(nodes))):
        raise ValueError("node ids must be consecutive integers starting at zero")
    if any(not isinstance(node.get("label"), str) for node in nodes):
        raise ValueError("node labels must be strings")
    adjacency = np.zeros((len(nodes), len(nodes)))
    seen = set()
    edges = fixture.get("edges", [])
    if not isinstance(edges, (list, tuple)) or len(edges) > len(nodes) * (len(nodes) - 1) // 2:
        raise ValueError("edges must be a bounded list of undirected pairs")
    for edge in edges:
        if not isinstance(edge, (list, tuple)) or len(edge) != 2:
            raise ValueError("each edge must have two integer endpoints")
        left, right = edge
        if any(isinstance(i, bool) or not isinstance(i, int) for i in edge):
            raise ValueError("edge endpoints must be integers")
        if not (0 <= left < right < len(nodes)) or (left, right) in seen:
            raise ValueError("edges must be unique, ordered, non-self undirected pairs")
        seen.add((left, right))
        adjacency[left, right] = adjacency[right, left] = 1
    from .core import finite_array, model_arrays, validate_degree

    features = finite_array(fixture.get("features"), "features", 2)
    labels_raw = np.asarray(fixture.get("labels"))
    if labels_raw.ndim != 1 or labels_raw.dtype.kind not in "iu":
        raise ValueError("labels must be an integer vector")
    labels = labels_raw.astype(np.int64)
    model = model_arrays(fixture.get("model"))
    if features.shape[1] > 32 or model["bias"].size > 32 or model["output_bias"].size > 16:
        raise ValueError("demo dimensions exceed F/H <= 32 and C <= 16")
    if features.shape[0] != len(nodes) or labels.size != len(nodes):
        raise ValueError("one feature row and label are required per node")
    if model["theta"].shape[1] != features.shape[1]:
        raise ValueError("model feature width must match fixture features")
    if np.any(labels < 0) or np.any(labels >= model["output_bias"].size):
        raise ValueError("labels must be valid class indices")
    default_degree = validate_degree(fixture.get("default_degree"))
    if default_degree >= model["theta"].shape[0]:
        raise ValueError("default degree exceeds the exported theta bank")
    return adjacency, features, labels
