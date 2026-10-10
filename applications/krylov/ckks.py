"""Optional genuine TenSEAL execution with a serialized client/server boundary.

The server API accepts a public context, encrypted compiled columns and a clear
model. It has no graph, plaintext feature input, labels or secret key. The local
runner orchestrates both roles in one process; it is not a network protocol.
"""

from dataclasses import dataclass
import time

import numpy as np

from .core import finite_array, model_arrays, validate_degree

POLY_MODULUS_DEGREE = 16384
COEFF_MOD_BIT_SIZES = (60, 40, 40, 40, 40, 60)
GLOBAL_SCALE = 2.0 ** 40


def _tenseal():
    try:
        import tenseal as ts
    except ImportError as exc:
        raise ImportError("install optional dependencies with pip install -r requirements-ckks.txt") from exc
    return ts


@dataclass(frozen=True)
class EncryptedRequest:
    public_context: bytes
    block_columns: tuple[tuple[bytes, ...], ...]
    degree: int
    node_count: int
    feature_count: int

    @property
    def ciphertext_bytes(self) -> int:
        return sum(len(column) for block in self.block_columns for column in block)


@dataclass
class ClientSession:
    """Private context remains solely in this client-side object."""

    context: object

    def decrypt(self, response: tuple[bytes, ...]) -> np.ndarray:
        ts = _tenseal()
        if not self.context.has_secret_key():
            raise ValueError("client decryption requires its private context")
        values = [ts.ckks_vector_from(self.context, ciphertext).decrypt() for ciphertext in response]
        return np.asarray(values, dtype=np.float64).T


def client_encrypt_blocks(blocks, degree: int) -> tuple[ClientSession, EncryptedRequest, dict]:
    ts = _tenseal()
    degree = validate_degree(degree)
    blocks = finite_array(blocks, "blocks", 3)
    if blocks.shape[0] <= degree:
        raise ValueError("degree exceeds available client blocks")
    if blocks.shape[1] > POLY_MODULUS_DEGREE // 2:
        raise ValueError("demo backend supports at most 8192 nodes per packed column")
    start = time.perf_counter()
    context = ts.context(
        ts.SCHEME_TYPE.CKKS, poly_modulus_degree=POLY_MODULUS_DEGREE,
        coeff_mod_bit_sizes=list(COEFF_MOD_BIT_SIZES), n_threads=2,
    )
    context.global_scale = GLOBAL_SCALE
    context.generate_relin_keys()
    public_context = context.serialize(
        save_public_key=True, save_secret_key=False,
        save_galois_keys=False, save_relin_keys=True,
    )
    setup_seconds = time.perf_counter() - start
    start = time.perf_counter()
    encrypted = tuple(
        tuple(ts.ckks_vector(context, blocks[k, :, f].tolist()).serialize()
              for f in range(blocks.shape[2]))
        for k in range(degree + 1)
    )
    encryption_seconds = time.perf_counter() - start
    request = EncryptedRequest(public_context, encrypted, degree, blocks.shape[1], blocks.shape[2])
    return ClientSession(context), request, {
        "context_setup_and_public_serialization_seconds": setup_seconds,
        "client_encryption_and_serialization_seconds": encryption_seconds,
    }


def evaluate_server(request: EncryptedRequest, model) -> tuple[tuple[bytes, ...], dict]:
    """Deserialize public inputs, evaluate a square model, return ciphertexts.

    Only the square activation is supported by this intentionally small CKKS
    circuit. There is no fallback to plaintext or simulated encryption.
    """
    ts = _tenseal()
    degree = validate_degree(request.degree)
    model = model_arrays(model)
    theta, bias = model["theta"], model["bias"]
    weights, output_bias = model["output_weights"], model["output_bias"]
    if not np.array_equal(model["activation_coefficients"], [0.0, 0.0, 1.0]):
        raise ValueError("CKKS demo requires the square activation [0, 0, 1]")
    if len(request.block_columns) != degree + 1 or theta.shape[0] <= degree:
        raise ValueError("encrypted block count does not match the selected degree")
    if request.feature_count != theta.shape[1] or any(
        len(columns) != request.feature_count for columns in request.block_columns
    ):
        raise ValueError("encrypted feature width does not match the model")
    if not 0 < request.node_count <= POLY_MODULUS_DEGREE // 2:
        raise ValueError("invalid packed node count")
    start = time.perf_counter()
    server_context = ts.context_from(request.public_context, n_threads=2)
    if server_context.has_secret_key() or not server_context.is_public():
        raise ValueError("server context must contain no secret key")
    encrypted = [[ts.ckks_vector_from(server_context, column) for column in columns]
                 for columns in request.block_columns]
    if any(vector.size() != request.node_count for columns in encrypted for vector in columns):
        raise ValueError("encrypted column length does not match node count")
    context_seconds = time.perf_counter() - start
    start = time.perf_counter()
    scalar_products = 0
    additions = 0
    bias_additions = 0
    public_key_encryptions = 0
    hidden = []
    for channel in range(bias.size):
        total = None
        for k in range(degree + 1):
            for feature in range(request.feature_count):
                coefficient = float(theta[k, feature, channel])
                if coefficient == 0:
                    continue
                term = encrypted[k][feature] * coefficient
                scalar_products += 1
                if total is None:
                    total = term
                else:
                    total = total + term
                    additions += 1
        if total is None:
            # Multiplication by zero can produce a transparent ciphertext that
            # SEAL rejects. Encrypt the known constant with the public key.
            total = ts.ckks_vector(server_context, [float(bias[channel])] * request.node_count)
            public_key_encryptions += 1
        else:
            total = total + float(bias[channel])
            bias_additions += 1
        hidden.append(total.square())
    result = []
    for output_class in range(output_bias.size):
        total = None
        for channel in range(bias.size):
            coefficient = float(weights[channel, output_class])
            if coefficient == 0:
                continue
            term = hidden[channel] * coefficient
            scalar_products += 1
            if total is None:
                total = term
            else:
                total = total + term
                additions += 1
        if total is None:
            total = ts.ckks_vector(server_context, [float(output_bias[output_class])] * request.node_count)
            public_key_encryptions += 1
        else:
            total = total + float(output_bias[output_class])
            bias_additions += 1
        result.append(total.serialize())
    evaluation_seconds = time.perf_counter() - start
    return tuple(result), {
        "server_deserialization_seconds": context_seconds,
        "server_evaluation_and_serialization_seconds": evaluation_seconds,
        "server_context_has_secret_key": server_context.has_secret_key(),
        "operations": {
            "ciphertext_plaintext_scalar_multiplications": scalar_products,
            "ciphertext_ciphertext_squares": bias.size,
            "ciphertext_additions": additions,
            "plaintext_bias_additions": bias_additions,
            "public_key_encryptions_of_constant_columns": public_key_encryptions,
            "rotations": 0,
            "graph_dependent_server_ciphertext_products": 0,
            "multiplicative_depth_upper_bound": 3,
        },
    }


def run_ckks(blocks, model, degree: int) -> tuple[np.ndarray, dict]:
    session, request, timings = client_encrypt_blocks(blocks, degree)
    response, server_details = evaluate_server(request, model)
    start = time.perf_counter()
    logits = session.decrypt(response)
    decryption_seconds = time.perf_counter() - start
    if logits.shape != (request.node_count, model_arrays(model)["output_bias"].size):
        raise ValueError("client received an unexpected output shape")
    if not np.isfinite(logits).all():
        raise ValueError("CKKS output is not finite")
    return logits, {
        **timings, **server_details,
        "client_deserialization_and_decryption_seconds": decryption_seconds,
        "tenseal_version": _tenseal().__version__,
        "parameters": {
            "poly_modulus_degree": POLY_MODULUS_DEGREE,
            "coeff_mod_bit_sizes": list(COEFF_MOD_BIT_SIZES),
            "global_scale": GLOBAL_SCALE,
            "library_parameter_validation": "SEAL default 128-bit classical parameter bound",
            "independent_security_estimate": None,
            "post_quantum_security_claim": False,
        },
        "serialization_bytes": {
            "public_evaluation_context": len(request.public_context),
            "encrypted_input_columns": request.ciphertext_bytes,
            "encrypted_output_columns": sum(map(len, response)),
            "total_upload": len(request.public_context) + request.ciphertext_bytes,
        },
        "boundary": "Serialized public context and ciphertexts; client-only decryption; local roles share one process",
        "server_public_information": ["node/feature counts", "selected degree", "model", "ciphertext sizes"],
        "security_limitations": "No malicious-server integrity, output-oracle defense, independent security estimate, or deployment protocol is claimed",
    }
