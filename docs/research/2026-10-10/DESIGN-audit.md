# DESIGN: source audit for PrivNetAI

Review date: 2026-10-10. This is a literature and static source review, not a reproduced benchmark, security proof, or code execution audit. No PrivNetAI source was changed.

## Verified identity and publication status

- Paper: **DESIGN: Encrypted GNN Inference via Server-Side Input Graph Pruning**, Kaixiang Zhao, Joseph Yousry Attalla, Qian Lou, and Yushun Dong.
- [Original arXiv record](https://arxiv.org/abs/2507.05649): first submitted **8 July 2025**, revised **14 July 2025**, current accessible version **v2**. The arXiv comment says “Under Review in Conference on Neural Information Processing Systems (NeurIPS 2025).” This does not establish conference acceptance.
- [Hugging Face paper page](https://huggingface.co/papers/2507.05649) displays “Published on Jul 14, 2025,” corresponding to the revision, and links the author repository. Its presence is a paper listing; the page does not provide a model, dataset, or Space implementing the method.
- [Author GitHub repository](https://github.com/LabRAI/DESIGN), inspected at commit `859225550559b96dc025b7ceaa5819c919da1c5e`. The repository README also identifies the work as NeurIPS 2025 under review.
- The original paper, Hugging Face page and pinned author source were inspected on the review date. Persistent primary-source and commit-pinned code links are provided below; downloaded source snapshots are omitted from this archive.

## What the authors propose

The paper targets **inference**, with a model trained in plaintext. A client supplies an encrypted adjacency matrix and encrypted node features; the server computes encrypted node degrees, compares them homomorphically with thresholds, and forms encrypted importance masks. It then masks less important nodes and incident edges and combines polynomial activations of different degrees using encrypted level masks. The client decrypts the result. The appendix specifies a two-layer GCN with only **two hidden channels**, initially trained with a quadratic activation.

This is directly relevant prior art for graph-private HE inference and degree-guided adaptive polynomial execution. It does not demonstrate encrypted training, post-quantum transport/authentication, differential privacy of outputs, or verified correctness against a malicious server.

## Strengths and useful ideas

1. It treats graph topology as confidential rather than limiting encryption to a final classifier.
2. Degree-based importance is cheaper to compute than many richer encrypted graph statistics.
3. It explicitly acknowledges the cost and approximation errors of encrypted comparisons.
4. It releases inspectable source and describes ablations and polynomial-degree tradeoffs.

These are research ideas and author-reported evaluations, not independently established performance for our application.

## Central efficiency issue: encrypted masking does not itself skip work

The paper explicitly describes **logical** pruning. Equation (3) multiplies features and adjacency entries by encrypted keep masks. Equation (5) evaluates multiple activation polynomials and combines them with encrypted importance masks.

The pinned implementation confirms the fixed-size computation:

- [`design_model.py`, lines 254–269](https://github.com/LabRAI/DESIGN/blob/859225550559b96dc025b7ceaa5819c919da1c5e/design_model.py#L254) encrypts every adjacency diagonal and each feature vector.
- [Lines 394–426](https://github.com/LabRAI/DESIGN/blob/859225550559b96dc025b7ceaa5819c919da1c5e/design_model.py#L394) mask every feature vector and every adjacency diagonal, append every result, and preserve their counts.
- [Lines 272–330](https://github.com/LabRAI/DESIGN/blob/859225550559b96dc025b7ceaa5819c919da1c5e/design_model.py#L272) aggregate over all `self.N` diagonals. This dimension is not reduced after pruning.
- [Lines 458–479](https://github.com/LabRAI/DESIGN/blob/859225550559b96dc025b7ceaa5819c919da1c5e/design_model.py#L458) evaluate **each** importance level's polynomial on the entire packed hidden-feature ciphertext, then multiply by masks and sum. They do not execute only the chosen polynomial for each hidden node.

**Our assessment:** The shown implementation does not physically compact the graph, omit ciphertexts, or provide a public schedule that skips the work represented by encrypted zeros. Its encrypted pruning adds operations, while its adaptive activation computes all polynomial branches before selection. A secret encrypted zero is not a known plaintext zero that an evaluator can exploit to skip an operation. Consequently, the claimed reduction in graph-processing volume and average activation work needs a reproducible explanation beyond the visible masking implementation.

This finding does not prove that every possible encrypted-pruning scheme is inefficient. It means this specific implementation does not establish the proposed mechanism's claimed cost reduction. Efficient compaction, public preprocessing, public workload schedules, or an explicit leakage allowance would need separate specification and measurement.

## Numerical and reproducibility caveats

### Comparison approximation domain

The implementation uses `p(t) = -0.25*t^3 + 0.75*t + 0.5` on degree minus threshold. Its own [lines 198–200](https://github.com/LabRAI/DESIGN/blob/859225550559b96dc025b7ceaa5819c919da1c5e/design_model.py#L198) note that the difference must be approximately in `[-1, 1]` and that normalization may be needed. The inspected path uses raw degrees and thresholds such as `[5.0, 2.0]`; no corresponding normalization is evident. For example, `p(3) = -4`, which cannot act as an approximate binary selection mask. Approximation-domain coverage and resulting mask error must be validated before relying on pruning results.

### Accuracy claims conflict across artifacts

The repository README says “up to 2× latency reduction with ≤2 pp accuracy loss vs. plaintext.” The paper's Table 2 instead reports:

| Dataset | Plaintext | DESIGN | Difference |
|---|---:|---:|---:|
| Cora | 84.00% | 74.00% | −10.00 pp |
| CiteSeer | 60.00% | 45.00% | −15.00 pp |
| PubMed | 80.00% | 55.00% | −25.00 pp |

Report these as conflicting **author claims**, not as a verified ≤2 pp fidelity result. Table 1 also does not show DESIGN winning every comparison: on ogbn-proteins it reports 8.49 s versus OpenFHE's 7.69 s.

### Evaluation scope

- [`utils.py`, lines 70–76](https://github.com/LabRAI/DESIGN/blob/859225550559b96dc025b7ceaa5819c919da1c5e/utils.py#L70) computes classification accuracy over **all nodes**, despite comments elsewhere describing test-mask evaluation. The multi-label metric likewise uses all flattened labels and thresholded predictions.
- [Lines 106–113](https://github.com/LabRAI/DESIGN/blob/859225550559b96dc025b7ceaa5819c919da1c5e/utils.py#L106) subsample PubMed, Yelp, and ogbn-proteins to 4,000 nodes and generate new random splits. This matters when interpreting large-dataset scalability claims.
- The visible code calls `to_dense_adj` without importing it in `utils.py`, and calls `get_A_bar` without importing it in `design_model.py`. These are static reproducibility blockers; we did not install bindings or run/fix the authors' code.
- Code sets ring degree 8,192 with coefficient-modulus bit sizes totaling 230, whereas the paper describes degrees 32,768/65,536. Official SEAL's default classical 128-bit limit at degree 8,192 is 218 bits ([source](https://github.com/microsoft/SEAL/blob/main/native/src/seal/util/hestdparms.h#L29)); its default context requests `tc128` ([source](https://github.com/microsoft/SEAL/blob/main/native/src/seal/context.h#L500)). Parameter validity and the selected Python binding must therefore be checked. A classical 128-bit setting should also not be silently relabeled as 128-bit quantum security.

## Threat-model interpretation

The intended server sees encrypted adjacency, features, scores, and masks and lacks the client's decryption key. Graph dimensions, ciphertext counts, public thresholds, model architecture, execution schedule, and inference output disclosure are not hidden merely by encrypting numerical contents. The demonstration generates a decryptor in the same process for benchmarking; that does not by itself establish or refute an independently deployed client/server boundary. A real implementation must separate client key material from server execution.

The reviewed paper inherits confidentiality claims from CKKS; the material examined does not establish a separate malicious-server correctness protocol, a model-extraction guarantee, or an output differential-privacy guarantee. Any server-visible schedule that changes based on secret pruning decisions needs explicit leakage analysis.

## Implications for PrivNetAI

1. **Cite DESIGN as 2025 prior art** for encrypted degree scoring, graph masking, and adaptive polynomial selection. Do not claim those broad ideas as ours alone.
2. **Reproduce pruning complexity before importing its speedup.** Count ciphertext multiplications, rotations, depth, packing occupancy, transmitted ciphertexts, preprocessing, and elapsed time. Distinguish logical masked gating from a physical reduction of work.
3. Start with a correct complete polynomial GCN under an explicit threat model and identical float-versus-HE architecture. Our fixed-point ablation already shows why head changes and arithmetic errors must be separated from cryptographic costs.
4. If introducing adaptive schedules, define whether topology, retained-node counts, importance assignments, or schedule decisions become public. Compare against fixed-schedule masking and any proposed compaction protocol using the same leakage and security conditions.
5. A promising new research question is **which graph-aware optimizations actually lower observable HE work while preserving a stated leakage policy and classifier fidelity**. That is a proposed question, not an established novelty claim.

Keep equivariant obfuscation literature separate: a secret feature transformation is not automatically semantically secure HE and requires its own attack/threat analysis.
