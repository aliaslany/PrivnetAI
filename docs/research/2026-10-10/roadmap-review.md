# PrivNet.AI roadmap review

Reviewed 10 October 2026 against the current checkout, controlled Cora arithmetic experiments, and the expanded 2025–2026 paper/code review. This is a roadmap review and proposed replacement; it does not implement repository fixes or cryptographic capabilities.

## Assessment

The vision is worth retaining, but the implementation sequence needs a substantive revision. The existing roadmap uses expired Q2–Q4 2025 phases, depends on SIDH/SIKE research for its cryptographic foundation, and moves toward encrypted training and deployment before specifying or validating a genuine encrypted-inference protocol. Its mathematical and outreach tasks do not establish readiness for those capabilities.

The next concrete deliverable should be a **reproducible, same-model CKKS classifier**, followed by **complete public-topology GCN inference**. Private topology, collaborative/encrypted training, post-quantum communication, and verifiable computation remain explicit targets, with separate assumptions and completion criteria.

## Priority findings

| Priority | Current roadmap location | Finding | Recommended change |
|---|---|---|---|
| Critical | Opening description; lines 24, 49, 73 | “Post-quantum-secure” is not supported by the current simulator. SIDH/SIKE are broken and key exchange does not provide encrypted arithmetic. | Use conditional research language. Retire SIDH/SIKE as security prerequisites; choose maintained lattice HE for computation and standardized PQ primitives for communication/authentication. |
| High | Phases 1–3, lines 18, 43, 67 | Calendar labels are stale and do not reflect current implementation or dependencies. | Replace them with milestone gates, status evidence, and a clear next deliverable. Estimate dates after scope, ownership, and resources are assigned. |
| High | Lines 30, 50–51 | `EncryptedGraph` is specified before deciding which graph components are confidential and who holds keys. | Define actors, public/private data, topology disclosure, weights, outputs, adversary, and key ownership first; derive serialization and interfaces from that protocol. |
| High | Lines 55–56 | “Encrypted vs non-encrypted” comparisons conflate different architectures and numerical encodings. | Compare original float GCN, float HE-compatible GCN, identical real-CKKS GCN, and simulator separately. Keep weights, graph operator, splits, and evaluation targets matched in each arithmetic comparison. |
| High | Lines 61–63, 78–79 | Formal validation and encrypted training are broad promises without intermediate feasible targets. | State assumptions and prove the actual protocol/approximation properties being claimed. Demonstrate inference before protected last-layer training or a defined multiparty training protocol. |
| High | Prototype/advanced research goals | Packing and adaptive polynomial activations now overlap substantial recent work. | Make FicGCN, DESIGN, TGHE, CryptGNN, and the 2026 overflow work explicit comparison points. Establish a graph-specific contribution rather than claiming novelty from combining existing components. |
| Medium | Lines 32, 36–39, 83–85 | Framework selection is already settled in code; broad algebraic topics lack an implementation dependency or measurable result. | Record PyTorch Geometric as the current choice. Prioritize sparse graph operators, activation ranges, fixed-point error, CKKS depth, and protocol composition. Keep other mathematics as optional research tied to a concrete question. |
| Medium | Lines 89–101 | Whitepaper, UI, and domain forks lack technical release gates. A CLI already exists. | Release the reproducible baseline and benchmark report first. Domain pilots and expanded interfaces follow demonstrated protocol and fidelity requirements. |

Line references refer to the inspected [tracked roadmap](../../../roadmap.md) at commit `be0400f8e8d22fcfff2d011bc1c1dd9b7a2f4767`; file content was preserved.

## What can be marked complete

| Capability | Evidence-backed status |
|---|---|
| Repository, docs, Python/PyG CPU workflow | Present; development execution was validated during onboarding. |
| Plaintext GCN training | Implemented; Cora training completed. |
| Masked linear-head demonstration | Implemented educational simulator. It provides no established cryptographic privacy. |
| Numerical diagnosis | Completed outside the checkout for three seeds; the repository encoding defect remains unfixed. |
| Targeted 2025–2026 literature review | Completed with GitHub, Hugging Face, and primary papers; cited systems were not benchmarked here. |
| All existing tests passing | Pending. Last verified run: 7 passed, 1 failed due to weight rounding. |
| Genuine HE, complete encrypted GCN, real PQ communication | Pending; no such implementation was validated. |
| Private topology, encrypted training, verifiable execution | Pending. Encrypted model/trainer files are currently empty. |
| Historical LinkedIn/community tasks | Checked in the existing roadmap; not independently verified in this review. |

For seed 42, the full float GCN achieved 82.7%, its separately fitted float ridge head 77.7%, and the current shim 51.2%. Correctly scaled integer simulation recovered the ridge-head accuracy on all three seeds with 99.8–100% prediction agreement. This separates a fixable encoding defect from the loss caused by replacing the second graph convolution with a different classifier. It does not establish real CKKS performance or confidentiality.

## How the latest research changes the plan

- **[FicGCN, ICML 2025](https://proceedings.mlr.press/v267/kan25a.html):** include sparse aggregation, layout scheduling, and rotation counts in the baseline. Its server sees topology and weights; its citation benchmarks use graph autoencoders, so adapt the method carefully before comparing against our node classifier. The identified GitHub repository is a PDF mirror, not released implementation code.
- **[DESIGN, July 2025](https://huggingface.co/papers/2507.05649):** degree-guided pruning and adaptive polynomials are existing ideas. The inspected code has accuracy/evaluation and cost-accounting concerns. Require a reproduced reduction in operations, rather than treating masked zeros as skipped work.
- **[TGHE, June 2026](https://arxiv.org/abs/2606.26664):** template batching is relevant only when permitted graph metadata disclosures and trusted client preprocessing fit the protocol. Its reported speedup is against its own sequential baseline, and its small packing loss excludes earlier model-adaptation loss.
- **[CryptGNN, CCS 2025](https://arxiv.org/abs/2509.09107), and [PrivGNN, November 2025](https://arxiv.org/abs/2511.02185):** private edges/model parameters already have interactive MPC approaches. A stronger-privacy track must report collusion assumptions, offline work, communication, and network latency.
- **[Encrypted Neural Networks without Overflows, 2026](https://arxiv.org/abs/2605.23096):** graph-specific activation-range analysis and precision allocation are promising extensions. Its certificates concern declared bounded domains and approximation error; they do not automatically certify all CKKS noise or GNN operators.
- **[EinHops, July 2025](https://huggingface.co/papers/2507.07972), and [Rotom, 2026](https://github.com/cmu-cryptosystems/Rotom):** use transparent/automatic packing as comparison tools. Include evaluation-key memory and layout-conversion costs, and respect their workload limits.
- **[Approximate-FHE security, PKC 2025](https://link.springer.com/chapter/10.1007/978-3-031-91832-2_4):** output recipients, decryption exposure, and per-key query policies belong in the initial protocol specification. This abstract-level source does not provide a universal noise-flooding recipe or malicious-input security guarantee.

## Recommended sequence

1. **M0 — Correctness and protocol specification:** repair encoding/import defects, establish reproducibility, and define initial privacy and output guarantees.
2. **M1 — Genuine CKKS head:** perform real encryption, evaluation, and client decryption for the identical ridge classifier; report fidelity, security parameters, and all costs.
3. **M2 — Complete public-topology GCN:** encrypt original features and implement all chosen aggregation/projection/activation layers. Measure model-adaptation loss separately from CKKS error.
4. **M3 — Defensible graph research:** evaluate range bounds, precision, and layouts against adapted recent baselines with matched disclosure limits and security.
5. **M4 — Stronger protocols:** add PQ authenticated communication and pursue private topology/model privacy where justified; avoid implying that those components prove honest computation.
6. **M5 — Training and verifiability tracks:** start with narrow protected-training and inference-proof targets, then assess full encrypted training and training proofs independently.

M4 communication work can proceed in parallel once M0 specifies the protocol; it is required before a remote pilot making communication-security claims. M5 branches need not wait for every optional M4 privacy mode, but must satisfy their own threat-model requirements.

The full proposed replacement, with deliverables and gates, is in [roadmap-proposed.md](roadmap-proposed.md). Numeric acceptance thresholds there are proposed engineering targets, not achieved results. A systematic novelty check and benchmark reproduction remain outstanding.
