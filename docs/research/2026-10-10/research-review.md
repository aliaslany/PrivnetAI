# PrivnetAI: research review and improved proposal

Reviewed and expanded 10 October 2026. Inputs: the repository's May 2025 `Report.pdf`, README, roadmap, current implementation, onboarding measurements, research papers and code, Hugging Face Papers/Hub searches, and a new controlled numerical experiment. Repository source files were not changed. See [the expanded 2025–2026 review](research-2025-2026-addendum.md) for direct recent comparators and updated proposal implications.

## Main recommendation

Develop a reproducible, real-CKKS private graph-inference benchmark before attempting encrypted training, private topology, and zero-knowledge verification together. A promising research direction is joint optimization of graph-specific ciphertext packing, activation placement, and numerical precision under an explicit leakage model. Novelty remains to be established against the complete literature.

## Search coverage and evidence

The first review used accessible author repositories while the HTTPS proxy rejected several scholarly sites; Hugging Face had not been searched. After the runtime network configuration changed, the follow-up searched Hugging Face Papers and targeted model/dataset catalogs, GitHub, arXiv, and publication records. Relevant original papers and author code were inspected where accessible. Some individual publication routes remain unavailable. This is a targeted review with sources through 2026, not an exhaustive search or proof of novelty. Repository update dates and Hugging Face ingestion/revision dates were not treated as first publication dates. The cited systems were not installed or benchmarked here.

| Work | Evidence inspected | Connection to PrivnetAI | Limits |
|---|---|---|---|
| **Rotom: Bridging Usability and Performance: A Tensor Compiler for Autovectorizing Homomorphic Encryption**, Edward Chen, Fraser Brown, Wenting Zheng; ePrint 2025/1319, USENIX Security 2026 | [Author repository](https://github.com/cmu-cryptosystems/Rotom) explicitly names the paper and venue, and describes layout search, autovectorization, roll rewrites, and reduced ciphertext rotations. | Treat ciphertext layout as a compiler optimization problem. Evaluate layouts for graph aggregation and feature projection; measure rotations, ciphertext count, and evaluation-key storage. | General tensor compilation does not establish a graph-specific speedup. Current repository backend features may postdate the paper. |
| **Fhelipe: A Tensor Compiler with Automatic Data Packing for Simple and Efficient Fully Homomorphic Encryption**, PLDI 2024 | [Author repository](https://github.com/fhelipe-compiler/fhelipe) describes automatic packing and links the [paper DOI](https://doi.org/10.1145/3656382). | A useful compiler baseline for packing and reducing manual HE implementation effort. | Its application results must not be transferred to Cora or our hardware without reproduction. |
| **FedGraph: A Research Library and Benchmark for Federated Graph Learning**, 2024 preprint, arXiv:2410.06340 | [Author repository](https://github.com/FedGraph/fedgraph) supplies the citation and documents cross-client edges, node/link/graph tasks, and non-IID settings. | Use established partitioning and communication benchmarks if the proposal moves toward collaborative training. | Federated training is a different threat model from outsourced single-client encrypted inference. Encryption is optional in its examples. Current threshold/OpenFHE paths are implementation developments, not verified 2024-paper results. |
| **LinGCN: Structural Linearized Graph Convolutional Network for Homomorphically Encrypted Inference**, NeurIPS 2023 | [Official implementation](https://github.com/harveyp123/LinGCN-Neurips23) describes differentiable structural linearization, teacher-guided node-wise polynomial replacement, and operator fusion. | Reduce nonlinear depth deliberately; retrain or distill the HE-compatible model rather than inserting arbitrary polynomials into a frozen model. | Experiments concern STGCN skeleton recognition, not Cora node classification. Its reported latency reductions are not predictions for PrivnetAI. |
| **CryptoGCN: Fast and Scalable Homomorphically Encrypted Graph Convolutional Network Inference**, NeurIPS 2022 | [Official implementation](https://github.com/ranran0523/CryptoGCN) links the NeurIPS paper and implements real HE. | Establishes that encrypted GCN inference already exists. The proposal needs a specific efficiency, fidelity, leakage, or reproducibility contribution. | An older baseline, not new research. Historical code vendors old SEAL; reproduce only after addressing current library compatibility and security updates. |

**Updated primary verification:** [CryptGNN: Enabling Secure Inference for Graph Neural Networks](https://arxiv.org/abs/2509.09107) is now verified from original text and publisher-deposited metadata: September 2025 preprint, CCS 2025, DOI [10.1145/3719027.3765232](https://doi.org/10.1145/3719027.3765232). It uses multiparty secret sharing to protect graph, features, and model under an honest-but-curious collusion model; malicious security is not established. Additional direct recent comparators include DESIGN (2025), FicGCN (ICML 2025), PrivGNN (November 2025), and TGHE (June 2026), detailed in the linked addendum. These materially strengthen the required baseline comparison and narrow any novelty claim about graph packing or adaptive activations.

## New finding: isolate numerical loss from model changes

The existing CLI compares a complete two-layer GCN against a separately fitted ridge classifier on first-layer features. Those are different models: the ridge head omits the GCN's second graph convolution. Consequently, their accuracy difference cannot be attributed entirely to encryption.

We ran the existing 50-epoch Cora training pipeline for seeds 42, 43, and 44, selected the best validation checkpoint as the repository does, then evaluated identical hidden features, ridge weights, and bias in three arithmetic paths.

| Seed | Complete float GCN | Same float ridge head | Existing shim | Correctly scaled integer simulation, feature and weight scales 4096 | Test prediction agreement with float ridge |
|---|---:|---:|---:|---:|---:|
| 42 | 82.7% | 77.7% | 51.2% | 77.7% | 100.0% |
| 43 | 82.4% | 79.3% | 57.0% | 79.3% | 100.0% |
| 44 | 81.5% | 77.4% | 67.9% | 77.4% | 99.8% |

The existing shim rounds weights directly to integers. A weight 0.4 becomes zero. Correct encoding uses separate scales: `round(s_x H) @ round(s_w W) / (s_x s_w)`, with consistently represented bias. The experiment records observed integer accumulator magnitudes; establishing safe bounds for the declared input domain remains a requirement. At feature/weight scale 4096, maximum test-logit error was approximately 0.0037–0.0048. Increasing weight scale alone plateaued because feature quantization then dominated.

These are **simulated integer arithmetic results, not CKKS results or privacy guarantees**. Bias was added in plaintext to match the current CLI. Three seeds on one public benchmark are an exploratory diagnosis, not a broad statistical evaluation. Choose future hyperparameters using validation data, then lock them before final test evaluation.

Reproduction from the checkout root with dependencies installed: `OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 python docs/research/2026-10-10/numerical_ablation.py`. New results go to a fresh temporary directory printed by the script. The original [JSON results](numerical-ablation.json), script and seed logs are retained beside this review; see [archive instructions](README.md) for prerequisites and environment details.

## Correct the security foundation

1. **Retire SIDH/SIKE as the proposed security foundation.** [Microsoft's official warning](https://github.com/microsoft/PQCrypto-SIDH#warning) states they were proven insecure and cites the 2022 Castryck–Decru attack. This does not mean all isogeny-based schemes are broken. A signature scheme such as SQIsign is not an HE engine.
2. **Assign each primitive a specific role.** CKKS supplies approximate encrypted computation. [ML-KEM / FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) establishes shared secrets; [ML-DSA / FIPS 204](https://csrc.nist.gov/pubs/fips/204/final) and [SLH-DSA / FIPS 205](https://csrc.nist.gov/pubs/fips/205/final) supply signatures. Their standardized status is corroborated by [official OQS documentation](https://github.com/open-quantum-safe/liboqs). A KEM does not enable homomorphic learning, and a signature does not prove correct model execution.
3. **Keep the shim explicitly educational.** `EncTensor` bundles the additive mask with the masked payload. If a recipient sees both, recovering the quantized input is immediate. The deterministic generator, plaintext features/training, and reversible-string Kyber mock establish no cryptographic privacy or post-quantum security. Removing the mask field alone is insufficient: computing the correction `rW` requires an actual protocol.
4. **Specify output and integrity rules.** Who decrypts? Who receives plaintext predictions? Does the client accept server-chosen ciphertexts or reveal decryptions? [SEAL's security guidance](https://github.com/microsoft/SEAL/blob/main/SECURITY.md) warns about CKKS output leakage and decryption-oracle behavior and documents missing ciphertext authentication/circuit privacy. Address these in protocol design rather than assuming HE solves them.
5. **Use maintained backends and documented security parameters.** [OpenFHE](https://github.com/openfheorg/openfhe-development) supports CKKS, threshold operations, and scheme switching. Its [parameter guidance](https://github.com/openfheorg/openfhe-development/blob/main/src/pke/examples/README.md) and [security definitions](https://github.com/openfheorg/openfhe-development/blob/main/src/core/include/lattice/stdlatticeparms.h) distinguish classical and quantum levels; `HEStd_NotSet` disables checks. A working demo parameter set is not a security claim. For any future SEAL backend, its [v4.4.0 security update](https://github.com/microsoft/SEAL/blob/v4.4.0/CHANGES.md), dated July 2026 in the tagged README, is relevant; PrivnetAI currently has no installed SEAL dependency.

## Improved research question

**How can graph-specific ciphertext layouts, HE-compatible model structure, and numerical precision jointly reduce private-inference cost while preserving prediction fidelity under a stated security and leakage model?**

Suggested proposal wording:

> PrivNet.AI studies private inference for graph neural networks under specified lattice-based encryption assumptions. We first protect node features while treating topology as public, and evaluate numerical fidelity and system cost against identical plaintext models. We investigate graph-specific packing, reduced nonlinear depth, and precision allocation, with authenticated post-quantum communication as a separate protocol layer. Private topology, collaborative training, and verifiable computation are subsequent research targets.

The original report also discusses GNN-assisted lattice/isogeny cryptanalysis. That is a separate research track from privacy-preserving GNN execution and needs its own task definition, attack baselines, and citations. Do not present learned parameter recommendations as cryptographic proofs. The report's bare reference to “zkGNNs (2022)” needs authors, title, venue, and a stable identifier before it can support a claim.

## Practical milestones and acceptance criteria

### 1. Matched-model real-HE baseline

Keep identical features, weights, and biases across float, fixed-point simulator, and real CKKS evaluation. Encrypt the hidden-feature classifier first because it is the smallest circuit matching the current PoC. The client holds the secret key; the server receives ciphertexts and necessary evaluation keys. Label this encrypted-head inference, not encrypted graph training. Confirm correctness, parameter security estimates, and end-to-end encryption/evaluation/decryption costs.

### 2. Complete GCN inference with public topology

Encrypt input features and implement the entire chosen inference circuit, including adjacency aggregation. Compare the original float GCN, the plaintext HE-compatible GCN, and its CKKS execution separately. Use low-degree polynomial activations with calibration/retraining or distillation; measure their approximation ranges. Explore fusion and layout search guided by LinGCN, Fhelipe, and Rotom. Do not assume their existing speedups transfer.

### 3. Graph-specific experiments

Start with Cora, then CiteSeer/PubMed and a different graph task where useful. Vary graph size, degree, feature width, model depth, and packing strategy. Record accuracy, same-model prediction agreement, maximum/mean logit error, rotations, key switches, multiplicative depth, ciphertext/evaluation-key bytes, memory, and separate setup versus online latency. Report hardware and all security-relevant parameters. Compare methods at matched privacy targets, security parameters, and accuracy.

For each input, a sufficient fidelity condition is `winning_float_margin > 2 * max_absolute_logit_error`; then the predicted class is unchanged. This is a numerical condition, not a security proof. A useful follow-up is to derive conservative graph/activation error bounds and use validation margins to allocate precision. Do not certify unseen data merely from observed test errors.

### 4. Stronger threat models after the baseline

Private edges require a protocol that hides adjacency and relevant access patterns; encrypting features alone leaves topology public. Benchmark HE/MPC alternatives under the same leakage model. Multi-institution training requires explicit collusion assumptions, handling of cross-client edges, and potentially threshold HE/secure aggregation. Federated learning alone does not prevent gradient or graph leakage; differential privacy needs a defined node/edge/graph adjacency relation and a stated privacy budget.

### 5. Verifiability as a separate contribution

Choose a concrete malicious-server problem and specify what a proof attests to, including model identity, preprocessing, arithmetic, and input commitments. Budget proving and verification costs. Conventional proof-system assumptions are not automatically post-quantum. Avoid promising full encrypted training plus post-quantum zero-knowledge before demonstrating a specific protocol.

## Deliverables and current limits

This archive preserves the authored reviews, compact search provenance, numerical reproduction script, JSON results and seed logs. Primary-source URLs are retained; downloaded third-party papers and source snapshots are omitted. Application code and the existing roadmap remain unchanged. Genuine CKKS performance, private topology, encrypted training, and proof-system integration were not evaluated. The expanded search improves recent-paper coverage; systematic literature comparison and baseline reproduction remain prerequisites to a novelty claim.
