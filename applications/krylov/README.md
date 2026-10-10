# Independent Krylov demonstration

This application implements client-side Chebyshev compilation and polynomial
classification independently, inspired by the published mathematical approach
in [PrivNet-Krylov](https://github.com/chimans/PrivNet-Krylov), inspected at commit
`0976e41881192da938ef2ab988c2fe3fdb92835b`. The upstream repository has no license;
none of its code, artifacts, figures, timings, or benchmark claims are copied.

From the repository root:

```bash
python -m applications.krylov --backend plain --degree 2 \
  --output /tmp/krylov-plain.json --export-demo /tmp/krylov-demo.json
pip install -r requirements-ckks.txt
python -m applications.krylov --backend ckks --degree 2 \
  --output /tmp/krylov-ckks.json
```

NumPy is the only mandatory application dependency. TenSEAL 0.3.16 is optional;
requesting CKKS without it exits with a clear error rather than simulating HE.
The existing project environment can run these commands with `.venv/bin/python`.
Use `--fixture /tmp/krylov-demo.json` to evaluate an existing fixture with the
same schema. Demo import is bounded to 1 MiB, 120 nodes, 32 feature/hidden
channels and 16 classes. Input, result and exported-fixture paths must differ.

The client normalizes an undirected graph as
`S = D^-1/2 (A + I) D^-1/2` and compiles `B0 = X`, `B1 = SX`, and
`Bk = 2 S B{k-1} - B{k-2}`. It then evaluates
`Z = sum(Bk theta_k) + bias`, `H = Z²`, and `logits = H W + output_bias`.
The complete degree-0-through-4 bank and one fixed model are exported for the
browser. Selecting a degree truncates the bank and weights; it does not retrain.
Exported edges are unique ordered pairs, interpreted symmetrically; the
normalization adds a self loop even at an isolated node.

The deterministic 24-node graph has two communities and noisy features. Two
regularized least-squares fits train the classifier on **all nodes**, using the
degree-4 bank. All reported accuracy is illustrative training/all-node accuracy.
There is no held-out split, comparison with the upstream results, or novelty
claim. The browser fixture includes all features, edges and labels publicly, and
browser evaluation uses plaintext arithmetic.

The optional CKKS backend packs each block/feature column across nodes. The
client generates keys, encrypts the columns and serializes a context without a
secret key. `evaluate_server` deserializes that public context and ciphertexts,
executes the affine/square/readout circuit, and returns ciphertext bytes.
Only `ClientSession.decrypt` holds the secret key. The local runner orchestrates
both roles in one process, demonstrating an actual serialization boundary
rather than claiming a deployed remote protocol. The server does not receive
the adjacency, plaintext features or labels, but sees shapes, degree, the clear
model and message sizes. Client compilation and upload costs remain relevant.

The fixed parameters are degree 16384, coefficient-modulus sizes
`[60, 40, 40, 40, 40, 60]`, and scale `2^40`. They pass the backend's default
SEAL classical parameter bound. There is **no independent security estimate or
post-quantum security claim**. The circuit uses depth three and no rotations;
only the square activation is supported by this CKKS runner. Authentication,
malicious-server integrity, decryption-oracle protections, padding, key lifecycle
and transport are outside this demonstration.

Results distinguish executed plaintext from executed genuine CKKS, and record
same-model accuracy/agreement, numerical errors, parameters, serialized sizes
and individual timing stages. A result is created only after the selected
backend succeeds. Reproduce the focused checks with:

```bash
python -m pytest -q tests/test_krylov.py
```
