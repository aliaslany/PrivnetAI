# PrivnetAI: expanded 2025–2026 research review

Checked 10 October 2026. This follow-up fills the gaps in the first review: Hugging Face had not previously been searched, and several 2025 papers had only secondary metadata. The environment's network configuration subsequently changed, enabling direct scholarly-source checks. Repository source files were not modified.

## What was actually reviewed

- **Hugging Face Papers:** six searches covering homomorphic graph learning, secure GNN inference, private graph learning, encrypted neural networks, CryptGNN, and encrypted graph training. Relevant paper abstracts were inspected; original papers and author code were then checked where available. Hugging Face AI-generated summaries were not used as substitutes for paper abstracts.
- **Hugging Face Hub:** targeted model searches for `homomorphic`, `CryptGNN`, and `LinGCN`, and dataset searches for `homomorphic` and `federated_graph`. These queries returned no matching entries. This does not establish that the Hub contains no relevant artifacts under other names.
- **GitHub:** author implementations, publication mirrors, primary project repositories, and exact-name repository searches. A repository update date does not establish a new paper date, and a PDF-only repository does not establish released runnable code.
- **Original publications:** focused 2025–2026 arXiv searches, full-text papers, PMLR proceedings, and publisher-deposited metadata. Where only an abstract was accessible, the evidence level is stated below.

Compact Hugging Face query provenance and selected paper metadata are archived in [search-provenance.json](search-provenance.json). The specialist notes retain primary-source URLs and verification limits; raw search dumps and downloaded papers are omitted. Searches were targeted, not exhaustive. No third-party paper's reported performance was reproduced here.

## Direct recent graph-computation comparators

| Paper and verified year | Sources inspected | What it contributes | Comparison boundary |
|---|---|---|---|
| **FicGCN**, ICML 2025 | [PMLR paper and full PDF](https://proceedings.mlr.press/v267/kan25a.html); [GitHub PDF mirror](https://github.com/TielingDurant/FicGCN) | Latency-aware packing, sparse intra-ciphertext aggregation, and adjacency-based node reordering reduce rotations and balance aggregation against feature transformation. | Server sees adjacency and weights; client features are encrypted. Citation-graph experiments use graph autoencoders with square activations, not our node classifier. The identified GitHub repository is a paper mirror, not an implementation release. |
| **CryptGNN**, September 2025 preprint; CCS 2025 | [Original paper](https://arxiv.org/abs/2509.09107); [publication DOI](https://doi.org/10.1145/3719027.3765232) corroborated by publisher metadata | Multiparty secret sharing protects features, edge indices, and model parameters. Secure message passing is a central contribution. | Honest-but-curious participants and collusion model; active/malicious security and training are future work. Secure channels assumed. No public author implementation identified. |
| **DESIGN**, July 2025 preprint | [Hugging Face](https://huggingface.co/papers/2507.05649), [paper](https://arxiv.org/abs/2507.05649), [author GitHub](https://github.com/LabRAI/DESIGN) | Encrypted degree-based importance masks, graph pruning, and adaptive polynomial activations. | Acceptance was not verified; accessible paper/repo say under review. Static code and paper inconsistencies warrant reproduction before treating speedups or accuracy as established. Details below. |
| **PrivGNN**, November 2025 preprint | [Original paper](https://arxiv.org/abs/2511.02185) | Interactive two-party inference with additive and function secret sharing; polynomial and ReLU protocols. | Distinct from older differential-privacy papers with similar names. Semi-honest assumptions. QM9 graph experiments and offline costs differ from our Cora workflow; no public author code identified. |
| **TGHE**, June 2026 preprint | [Original paper](https://arxiv.org/abs/2606.26664) | Canonical ego-graph templates, SIMD batching, and permitted client-side linear preprocessing reduce CKKS evaluation cost. | Template signatures, degrees, and some edge metadata are disclosed. Evaluates 10,000 sampled DGraphFin queries, not encrypted processing of the entire multi-million-node graph. No confirmed TGHE-specific implementation release. |

Specific reported results illustrate why comparison boundaries matter:

- **FicGCN:** reports Cora 64.12 s versus Penguin 128.82 s on its graph-autoencoder experiment, and CoraFull 4.10× versus CryptoGCN. These are particular models, hardware, and security settings. They are not predicted PrivnetAI speedups.
- **TGHE:** reports 66.9× versus its sequential encrypted baseline. Its approximately 0.0014 AUC loss compares two adapted encrypted models, while original plaintext backbone AUC 0.8460 versus final packed result 0.7959 gives approximately 0.0501 total loss. Separate model adaptation from packing loss.
- **CryptGNN:** includes graph classification and message-passing benchmarks. Online performance excludes some setup; cold-start and repeated-query costs must be reported separately. Its MPC topology protection cannot be compared directly with topology-public HE as if the privacy guarantees were identical.
- **PrivGNN:** reported QM9 secure accuracy differs from plaintext by 1.51 percentage points, and offline preprocessing is substantial. Its headline 1.3–4.7× range concerns a CNN experiment, not a universal GNN result.

Full source-backed details: [graph-paper notes](recent-graph-2025-2026-addendum.md).

## Relevant 2025–2026 arithmetic, compiler, and security work

| Work | Sources and evidence level | Implication for PrivnetAI |
|---|---|---|
| **EinHops**, 10 July 2025 | [Hugging Face](https://huggingface.co/papers/2507.07972), [full paper](https://arxiv.org/abs/2507.07972), [author GitHub](https://github.com/baahl-nyu/einhops) | Makes CKKS tensor packing inspectable through einsum. Use as a dense-tensor baseline; compare sparse aggregation and graph layouts. Its single-ciphertext and expanded-dimension limits matter for large adjacency matrices. Include evaluation-key memory, which is large in its reported configurations. |
| **Rotom**, 2025 ePrint / USENIX Security 2026 | [Official author repository](https://github.com/cmu-cryptosystems/Rotom); author-declared publication and substantive implementation documentation inspected in the first pass | Automated layout search and fewer rotations support compiler-assisted implementation. GNN-specific gains must be measured independently. |
| **Encrypted Neural Networks without Overflows**, submitted 21 May 2026; revised 25 August 2026 | [Full paper](https://arxiv.org/abs/2605.23096), [author GitHub](https://github.com/lorenzorovida/encrypted-neural-networks-without-overflows); HF identifier returned 404 | Certified activation ranges and polynomial-error analysis can improve robustness under distribution shifts. Certification assumes a bounded input domain and does not fully include CKKS cryptographic noise. Experiments are FC/CNN, not GNN; code is WIP. |
| **Revisiting the Security of Approximate FHE with Noise-Flooding Countermeasures**, PKC 2025, online 5 May 2025; earlier preprint 2024/424 | [Primary publisher abstract](https://link.springer.com/chapter/10.1007/978-3-031-91832-2_4) and author page; full text unavailable. [Author-linked estimator](https://github.com/hunterkipt/Geometric-LWE-Estimator) | Connect output exposure, observed decryptions per key, flooding, and concrete security. State who receives scores and query/key-refresh policies. This evidence does not establish arbitrary malicious-ciphertext security or a numerical flooding recommendation. |

Full arithmetic notes: [2025–2026 numerical/compiler review](pqc-2025-2026/literature-notes.md).

Hugging Face also surfaced **FHAIM** ([February 2026 paper](https://huggingface.co/papers/2602.05838), [linked code](https://github.com/mayank64ce/mbi)), combining encrypted tabular synthetic-data generation with differential privacy. This was screened at abstract level and is an adjacent training direction, not a direct GNN-inference comparator. Equivariant-encryption/representation-obfuscation work likewise requires its own security analysis rather than being treated as interchangeable with HE.

## DESIGN implementation audit

The author repository was inspected at commit `859225550559b96dc025b7ceaa5819c919da1c5e`. It was not installed, executed, or repaired. Findings describe that snapshot and do not establish that every possible implementation of the paper is invalid.

1. Masked-zero adjacency entries remain in the same diagonals and feature ciphertexts; aggregation continues over the same representation. Adaptive activation evaluates each level's polynomial over the complete vector, then masks and sums. Logical pruning alone does not demonstrate fewer HE operations. An actual compaction, public schedule, or another independently verified cost-saving mechanism is needed before importing a speedup claim.
2. The comparison polynomial is applied to raw degree differences despite its documented limited interval. For its cubic, `p(3) = -4`, outside a useful mask range.
3. README's claimed ≤2 percentage-point accuracy loss does not match the paper's Cora/CiteSeer/PubMed table losses of 10/15/25 points.
4. The inspected accuracy routine evaluates all nodes despite comments describing test-mask evaluation; some datasets are sampled to 4,000 nodes. Missing imports and differing encryption parameters further complicate reproduction.

Detailed primary-paper and code references: [DESIGN audit](DESIGN-audit.md). These findings reinforce the need to audit runnable artifacts rather than accepting GitHub or paper headline claims.

## Revised improvement priorities

The earlier numerical diagnosis still holds: weight encoding largely explains the shim's accuracy loss. The recent literature strengthens the next steps and makes a generic “graph packing plus adaptive polynomial activations” novelty claim insufficient.

1. Establish matched float, fixed-point, and genuine CKKS baselines before optimizing. Preserve graph operator, weights, bias, splits, and activation definitions across corresponding comparisons.
2. Adapt **FicGCN** as a feature-private, topology-public packing baseline. Compare **TGHE** only where client preprocessing and disclosed metadata fit the intended threat model. Use **CryptGNN/PrivGNN** to evaluate the additional cost of private topology and interactive computation.
3. Explore graph-specific certified activation ranges and precision allocation, building on the 2026 overflow paper. Report approximation error and real CKKS error separately. Investigate varying graph degrees and feature shifts; do not claim a GNN certificate from the non-GNN paper alone.
4. Count the work an optimization actually removes: rotations, ciphertext multiplications, keys, bytes, and online/offline cost. Show whether graph masking merely changes values or also reduces computation.
5. Evaluate topology leakage, output exposure, and numerical fidelity jointly. A potentially stronger research question is: **which graph-aware optimizations measurably reduce encrypted-inference cost while satisfying explicit disclosure limits and prediction-error bounds?** Establish novelty through systematic comparison and reproducible experiments.

The targeted review now includes both GitHub and Hugging Face and several direct 2025–2026 research papers. Coverage depth varies and is documented. Published papers, preprints, revised older papers, abstract-only sources, code audits, author-reported results, and our simulated numerical experiment remain distinct.
