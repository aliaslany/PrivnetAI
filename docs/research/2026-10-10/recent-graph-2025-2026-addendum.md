# Focused 2025–2026 graph privacy literature addendum

Reviewed 2026-10-10. This addendum supersedes the earlier inaccessible-primary-source status for CryptGNN. Primary sources from arXiv, Crossref and PMLR were accessible during this review. ACM's article page returned HTTP 403; its publisher-deposited Crossref record corroborated venue, author and publication metadata. All quantitative results below are **authors' reported results, not benchmarks reproduced by us**.

Search coverage: focused arXiv query for graph neural/GNN AND homomorphic encryption/secure inference/secure multi-party computation/two-party computation, submissions 2025-01-01 through 2026-10-10, sorted newest; also checked primary GitHub repositories and exact name searches. This is a focused review, not exhaustive proof of novelty. Hugging Face coverage is documented in the [expanded research review](research-2025-2026-addendum.md). Temporary search responses and downloaded source caches are not included in this archive; persistent primary-source URLs are recorded below.

## FicGCN — published ICML 2025

**FicGCN: Unveiling the Homomorphic Encryption Efficiency from Irregular Graph Convolutional Networks**. Zhaoxuan Kan, Husheng Han, Shangyi Shi, Tenghui Hua, Hang Lu, Xiaowei Li, Jianan Mu, Xing Hu. Proceedings of the 42nd International Conference on Machine Learning, PMLR 267:28832–28848, July 13–19, 2025.

Primary publisher: https://proceedings.mlr.press/v267/kan25a.html . Publisher's full PDF via its GitHub repository: https://raw.githubusercontent.com/mlresearch/v267/main/assets/kan25a/kan25a.pdf . Matching paper repository: https://github.com/TielingDurant/FicGCN (README says `ICML2025FicGCN`; root contains only `README.md` and `Re_FicGCN.pdf`, so this is a paper mirror, not a verified code release).

- Mechanisms: latency-aware feature packing, sparse intra-ciphertext aggregation to reduce rotations, and region-based graph node reordering. Balances sparse aggregation with dense feature transformation rather than maximizing slot utilization in isolation.
- Threat model Section 2.4: **server has plaintext adjacency A and model weights W**, client encrypts features X and keeps secret key, server honest-but-curious. Thus this is a particularly relevant efficient feature-private CKKS comparator, but it does not hide graph topology or model weights from the server.
- Evaluation: Cora (2,708 nodes, 1,433 features), CiteSeer (3,327 / 3,703), CoraFull (19,793 / 8,710) use two-layer graph autoencoders with square activations and 32/16 hidden/output feature dimensions; also NTU skeleton STGCN. Single-thread Intel i7-9750H, Microsoft SEAL 3.7.2. Table 6 says 128-bit security for citation graphs, ≥80-bit for NTU; equal-security comparisons are necessary.
- Main Table 3: Cora 64.12 s vs Penguin 128.82 s (~2.01x); CiteSeer 79.98 s vs Penguin 142.90 s (~1.78x); CoraFull 7,733 s vs CryptoGCN 31,735 s (~4.10x). These are specific graph/model/platform results, not expected PrivnetAI performance. Do not use its speedups over weaker baselines as universal claims.
- Improvement implication: adopt a real packing/rotation cost model, sparse aggregation and data layout scheduling first; implement normalized adjacency and the trained square model consistently and compare with the same graph, model and cryptographic strength. Task is GAE in these benchmarks, not our node classifier, so reproduce the adapted protocol before numerical cross-paper comparisons.

## CryptGNN — published CCS 2025

**CryptGNN: Enabling Secure Inference for Graph Neural Networks**. Pritam Sen, Yao Ma, Cristian Borcea. arXiv 2509.09107v1 submitted **September 11, 2025**. Publisher-deposited Crossref metadata verifies *Proceedings of the 2025 ACM SIGSAC Conference on Computer and Communications Security*, DOI **10.1145/3719027.3765232**, print publication **November 19, 2025**, online **November 22, 2025**.

Primary abstract/full text: https://arxiv.org/abs/2509.09107 and https://arxiv.org/html/2509.09107v1 . Publisher metadata: https://api.crossref.org/works/10.1145/3719027.3765232 . No linked public author implementation identified in its paper or exact-name GitHub repository searches; secondary reading lists are not code artifacts.

- Distributed MPC, not CKKS/FHE: additive shares protect client node features and source/destination edge indices; model parameters are also shared. CryptMPL secures message passing using masked rotations/batches; CryptMUL avoids a trusted server for matrix/elementwise products.
- Authors' threat model permits up to P−1 colluding **honest-but-curious** computing parties, also collusion with model owner or a controlled client. Architecture/type/order/number of layers are public. Secure channels assumed. This is not active/malicious security. Section 8 explicitly lists active adversaries/verifiable computation and secure training as future work.
- Main whole-model experiments: GIN graph classification on FAUST, PROTEINS and ENZYMES, plus synthetic graphs. Cora, CiteSeer and PPI primarily test the message-passing primitive, not full-model Cora classification accuracy. 64-bit additive shares; 3.4 GHz Intel i7 with parties in separate processes, plus an AWS experiment; each timing averaged over 30 repetitions.
- Authors report matching plaintext classification accuracy in their whole-model experiments, FAUST ~22.3 s in three-party inference (6,890 nodes / 41,328 edges), synthetic 20,000 nodes / 200,000 edges ~75 s. Primary performance comparison excludes the initial server preprocessing. Separate FAUST accounting gives ~0.9 s client preprocessing, 7.5 s Beaver setup, 23.1 s online inference. Explain cold-start vs repeated-query costs.
- Authors compare message passing to SecGNN (~1.5x on one synthetic setup), and to a **hypothetical dense adjacency CrypTen baseline** (25x on PPI with six parties). These are not comparisons against the most efficient packed-HE algorithms. Communication for large synthetic graphs: 81.9 MB per party versus 6,103 MB in their CrypTen baseline; upload 12 MB versus 3,050 MB.
- Improvement implication: make topology privacy and model privacy explicit, separate leakage from numeric approximation, and compare interactive MPC with single-server HE under matched threat models. Malicious integrity/verifiability could differentiate future work but is not achieved by simply adding transport encryption or a PQC handshake.

## PrivGNN — 2025 preprint, a distinct name collision

**PrivGNN: High-Performance Secure Inference for Cryptographic Graph Neural Networks**. Fuyi Wang, Zekai Chen, Mingyuan Fan, Jianying Zhou, Lei Pan, Leo Yu Zhang. arXiv **2511.02185v1**, **November 4, 2025**. No published venue verified in reviewed metadata; treat as a preprint. **This is distinct from earlier DP PrivGNN/PrivGnn work.**

Primary abstract/full text: https://arxiv.org/abs/2511.02185 and https://arxiv.org/html/2511.02185v1 . No author implementation link identified in the paper; exact GitHub search yielded only a survey list, not this paper's code.

- Client-server interactive 2PC combines additive secret sharing with function secret sharing. Both client's graph and server's weights are private. Both participants semi-honest; active security not established.
- Offline-online secure protocols include linear transforms, quadratic/arbitrary-degree polynomial evaluation, ReLU and piecewise polynomial approximations of sigmoid/tanh. The online quadratic protocol uses one communication round; offline work must be counted separately.
- Evaluation covers MNIST/CIFAR CNNs and **QM9 molecular graphs**, not Cora node classification. Testbed: two servers with 64-core CPUs, 128 GB RAM and 2 RTX 2080 Ti GPUs; LAN 1 Gbps / 0.1 ms; 32-bit arithmetic ring (also scalability plots for 32/64/128/256 bits). Fixed-point truncation and reformulated activations cause accuracy differences.
- QM9 reported secure accuracy 96.42% vs plaintext 97.93% (**1.51 percentage-point loss**, not 0.1%). Table 3 reports 2.48 s online + 5.45 s offline = 7.93 s total, versus SecMPNN 102.57 s. The paper states existing baseline results were sourced from prior papers, so independent implementation/hardware matching is not established.
- Crucial correction: the abstract's 1.3–4.7x speedup range appears in Section 6.3 for **ResNet32/CIFAR100**, not a universal GNN speedup. Do not use it as direct evidence for Cora. QM9 framing as accuracy is itself the authors' metric; do not reinterpret it as standard regression MAE.
- Improvement implication: evaluate approximation/truncation explicitly, include offline costs and WAN sensitivity, and assess interactive ReLU/piecewise protocols if a hybrid MPC branch is within project scope.

## TGHE — June 2026 preprint

**TGHE: Template-based Graph Homomorphic Encryption for Privacy-Preserving GNN Inference in Edge-Cloud Systems**. Ngoc Bao Anh Le, Thai T. Vu, John Le, Heath Cooper, Jun Shen. arXiv **2606.26664v1**, **June 25, 2026**. No conference/journal venue verified; treat as a preprint.

Primary abstract/full text: https://arxiv.org/abs/2606.26664 and https://arxiv.org/html/2606.26664v1 . Paper links backbone https://github.com/storyandwine/GEARSage-DGraphFin; that is not necessarily the released TGHE implementation. No clear TGHE-specific code link identified.

- Ego-centric inference: trusted edge extracts/canonicalizes bounded 2-hop computation trees, groups identical shapes, SIMD-packs many queries under CKKS. Approximate template fitting handles unmatched shapes; topology collapse locally preaggregates linear hop-2 neighbors, reducing encrypted operations. Target: two-layer GEARSage with trainable quadratic activations, degree caps 10/5, 17 features → 32 hidden channels.
- Server honest-but-curious, client keeps secret key. Protects features and outputs; **explicitly accepts structural leakage**. Server sees template signatures, degrees/per-hop child counts, and plaintext edge type/direction/timestamp correction metadata. It does not claim full topology hiding. Paper suggests client-precomputed correction terms as a hardening option.
- Evaluation: 10,000 sampled query nodes drawn from DGraphFin (3.7 million nodes / 4.3 million edges), not a full encrypted computation on all 3.7 million nodes. Google Cloud n2-standard-16, 16 vCPUs / 64 GB, Microsoft SEAL CKKS degree 16,384, authors state 128-bit security; batch capacity 128.
- Reported sequential encrypted baseline: 7,751.7 s, AUC 0.7973. Template-base: 576.0 s, AUC 0.7950. Collapse: 115.9 s, AUC 0.7959, 66.9x vs sequential baseline and 5.0x vs base. **Reported <0.002 loss compares packed HE with adapted sequential HE (0.0014)**. Original plaintext GEARSage backbone AUC 0.8460; total backbone → collapse loss ≈ 0.0501. The paper itself explains square/polynomial adaptation and degree caps create the earlier loss. Do not say 66.9x vs FicGCN, or no accuracy loss vs original ReLU model.
- Improvement implication: batch structurally compatible encrypted queries, move allowed linear preprocessing to the client, and report each accuracy-loss source separately. Check whether degree/template/edge metadata exposure meets the intended privacy goal before adopting the design.

## Other reviewed 2025–2026 source coverage

- DESIGN 2507.05649v2 (July 2025), https://github.com/LabRAI/DESIGN; original paper and author repository inspected. See the [detailed static audit](DESIGN-audit.md).
- Rotom, 2025 ePrint / USENIX Security 2026, and its official CMU repository were previously reviewed; it is a tensor compiler transfer source, not a direct private-GNN evaluation. See the [research review](research-review.md).
- [FedGraph 2410.06340](https://arxiv.org/abs/2410.06340) has a verified **v4 update September 2, 2025** and primary abstract that now discusses encrypted low-rank communication and scale to 100-million-node graphs; initial submission remains October 8, 2024. Do not confuse revision date with a new 2025 paper or whole encrypted inference of 100 million nodes.

Suggested final prioritized comparators: **FicGCN 2025** for packed feature-private HE; **CryptGNN 2025** for topology/model-private MPC; **TGHE 2026** for workload-batched CKKS with explicit leakage and preprocessing; **DESIGN 2025** subject to independent implementation consistency audit. PrivGNN 2025 is an additional interactive/molecular comparator with concrete approximation and preprocessing caveats.
