# PrivnetAI: 2025–2026 primary literature notes

Checked 2026-10-10. Sources downloaded through the normal configured HTTP proxy with TLS verification. These are literature findings, not replicated experiments.

## EinHops (10 July 2025)

Karthik Garimella, Austin Ebel, Brandon Reagen. *EinHops: Einsum Notation for Expressive Homomorphic Operations on RNS-CKKS Tensors*. arXiv:2507.07972v1.

- Primary paper: https://arxiv.org/html/2507.07972v1
- Submission record: https://arxiv.org/abs/2507.07972
- Hugging Face discovery: https://huggingface.co/papers/2507.07972 . Query provenance is summarized in [search-provenance.json](../search-provenance.json).
- Author-linked code: https://github.com/baahl-nyu/einhops
- The author-linked code README was inspected. Code available; not executed in this review.

Methods: Einsum expressions are lowered to permutation, broadcasting, slotwise products, contraction reductions and masks. Permutations use baby-step/giant-step (BSGS), with single hoisting. Single-ciphertext working sets and explicit packing make layouts inspectable.

Paper evaluations use degree 2^15 (16,384 slots), Xeon Platinum 8480+ CPU and H100 GPU. Memory-efficient power-of-two keys use about 3 GB; full BSGS key configuration about 32 GB. Its encrypted attention-score example takes 28.57 s, about 23 s spent aligning data. These numbers are author-reported, hardware-specific, and not graph benchmarks.

Limits (paper section 5.3): single-ciphertext tensors; product of expanded input dimensions must fit N/2; no bootstrapping-placement policy; eager execution has no cross-call layout optimization. No demonstrated sparse-graph/GNN benchmark. Current GitHub README supports low-memory mode and a Torch simulation backend; simulated execution must remain separate from actual CKKS validation.

Proposal consequence: use EinHops as a transparent dense tensor/packing baseline rather than claiming it solves scalable encrypted message passing. For fixed public graph topology, test sparse diagonal aggregation versus dense einsum, graph reordering and partitioned ego-graph layouts. Report rotations, layout-conversion time, ciphertext counts, occupied-slot ratio, evaluation-key memory, and amortized key generation. Large dense adjacency is unsuitable; Cora adjacency alone is 2708^2 entries, far beyond the paper's 16,384-slot single-ciphertext setup. Expanded contraction dimensions may be even larger.

## Encrypted Neural Networks without Overflows (21 May 2026; revised 25 August 2026)

Philipp Kern, Lorenzo Rovida, Samuel Teuber, Edoardo Manino, Carsten Sinz, Alberto Leporati. *Encrypted Neural Networks without Overflows*. arXiv:2605.23096v2. Submission record describes it as a preprint.

- Primary paper: https://arxiv.org/html/2605.23096v2
- Submission record: https://arxiv.org/abs/2605.23096
- Author-linked code: https://github.com/lorenzorovida/encrypted-neural-networks-without-overflows
- The author-linked code README marks itself WIP and requires an author OpenFHE fork for Chebyshev SIMD polynomials. Not executed here.
- Hugging Face paper API returned 404 for this identifier during research; verification instead uses primary arXiv text and author-linked GitHub.

Finding: sampled activation ranges can miss legitimate bounded-domain inputs. Out-of-range polynomial activations can diverge, causing unusable CKKS outputs. Paper reports 5.18% naturally occurring overflow on a MNIST-to-USPS test shift and up to 46.7% for a deeper CIFAR model under searched realistic perturbations. Those are their workloads; they do not establish a corresponding failure rate for PrivnetAI.

Methods: sound input-domain range propagation, Remez polynomial synthesis, certified local and network-level approximation bounds; heterogeneous per-neuron polynomial evaluation via generalized Paterson–Stockmeyer in CKKS. Smooth activations such as GELU can approximate more accurately than ReLU at fixed degree. Evaluations cover fully connected and convolutional networks, not graph neural networks.

Scope: theorem guarantees hold on the declared bounded input domain. Certified polynomial approximation bounds do not natively include all cryptographic CKKS noise; CKKS errors in their table are sampled, and the limitations section explicitly proposes adding probabilistic cryptographic-noise modeling. Deeper arbitrary networks require bootstrapping/co-design; bounds may become loose; ill-scaled coefficients can reduce precision. Some reported parameter sets are marked slightly below 128-bit security, so benchmark parameters must be reselected for PrivnetAI's chosen security target.

Proposal consequence: extend certified-range design to fixed-topology GCN aggregation viewed as a sparse linear operator and bounded node-feature domain. This is a proposed research extension, not an established result. Compare sampled versus certified activation ranges, ReLU versus GELU/polynomial student activations, uniform versus per-channel polynomial degrees. Evaluate across graphs with different degrees and feature shifts. Record per-layer range violations, decoding failures, polynomial-approximation error, actual CKKS numeric error, class-margin preservation, accuracy, depth and latency. Hidden or changing adjacency requires a separate verifier/model, because the operator becomes variable or bilinear. Keep correctness/overflow robustness distinct from privacy/security.

## Revisiting Approximate FHE with Noise-Flooding (PKC 2025)

Flavio Bergamaschi, Anamaria Costache, Dana Dachman-Soled, Hunter Kippen, Lucas LaBuff, Rui Tang. *Revisiting the Security of Approximate FHE with Noise-Flooding Countermeasures*. PKC 2025, pp. 102–134. Publisher first-online date: 5 May 2025. Earlier preprint: ePrint 2024/424.

- Verified publisher page and primary abstract: https://link.springer.com/chapter/10.1007/978-3-031-91832-2_4
- Author page corroboration: https://www.ece.umd.edu/~danadach/
- Author-linked estimator: https://github.com/hunterkipt/Geometric-LWE-Estimator (associated estimator research; do not assume turnkey reproduction of PKC paper).
- The publisher abstract, author page and estimator README were inspected on the review date; downloaded copies are omitted from this archive.
- Full paper not obtained: ePrint PDF returned 403 and Springer PDF redirected to a gated landing page. Claims here are restricted to the publisher abstract and author material.

Primary abstract states that CKKS noise flooding can restore the stronger IND-CPA-D security notion at the cost of message precision. The paper studies a broad semi-honest attack class: adversary sees an honest party's public-key view and can query evaluation/decryption, with submitted ciphertexts either fresh or resulting from circuits on fresh independent ciphertexts. It estimates concrete security versus allowed decryption count before key refreshing and flooding variance, using techniques scaled to FHE-size dimensions and moduli.

Proposal consequence: standard ciphertext CPA security alone does not certify protocols that reveal decrypted approximate outputs. State who sees decrypted results and whether outputs return across a trust boundary; report queries per key, key-refresh policy, flooding variance and precision/accuracy cost. Distinguish this analyzed attack model from arbitrary malicious ciphertext attacks. Proposed graph experiment: hold model/graph and base CKKS parameters constant while varying bounded query budget, result-release policy and flooding strength; evaluate numerical error and classification-margin loss. Noise flooding addresses a cryptographic leakage channel, not differential privacy of individual records or malicious-server computation correctness.
