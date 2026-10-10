# PrivNetAI research archive — 10 October 2026

This archive preserves the research findings, numerical diagnosis and roadmap proposal reviewed on **2026-10-10** for future work. The repository baseline was [`be0400f8e8d22fcfff2d011bc1c1dd9b7a2f4767`](https://github.com/aliaslany/PrivnetAI/tree/be0400f8e8d22fcfff2d011bc1c1dd9b7a2f4767). The [existing roadmap](../../../roadmap.md) and application code remain unchanged; the proposed milestones below are not implemented or adopted by this archive.

## Findings to carry forward

- Build a matched-model, real-CKKS inference baseline before combining encrypted training, private topology and verifiable computation. Specify the permitted disclosures, output recipients and security parameters first.
- Separate model-adaptation loss from arithmetic error. The current CLI compares a complete GCN with a different ridge classifier, and its simulator rounds weights without a weight scale.
- Compare with recent work on sparse graph packing, interactive protocols, compiler layouts and bounded activation ranges. The review covers 2025–2026 papers, GitHub artifacts and targeted Hugging Face searches; it is not exhaustive and does not establish novelty.
- Assign cryptographic primitives distinct roles. SIDH/SIKE cannot underpin the proposal; CKKS computation, standardized post-quantum communication and signatures address different requirements.

## Documents and evidence

| Artifact | Contents |
|---|---|
| [Research review](research-review.md) | Overall proposal improvements, implementation findings and numerical diagnosis |
| [2025–2026 review](research-2025-2026-addendum.md) | Recent papers, GitHub/Hugging Face coverage and comparison limits |
| [Graph literature notes](recent-graph-2025-2026-addendum.md) | FicGCN, CryptGNN, PrivGNN and TGHE primary-paper details |
| [Arithmetic and compiler notes](pqc-2025-2026/literature-notes.md) | EinHops, 2026 overflow/range work and PKC 2025 output-security considerations |
| [DESIGN static audit](DESIGN-audit.md) | Commit-pinned source findings; third-party code was not executed |
| [Roadmap assessment](roadmap-review.md) | Changes recommended to the current roadmap |
| [Proposed roadmap](roadmap-proposed.md) | Future deliverables, dependency order and proposed acceptance gates |
| [Numerical results](numerical-ablation.json) | Original three-seed measurements and configuration |
| [Reproduction helper](numerical_ablation.py) | Portable replay of the arithmetic experiment |
| [Search provenance](search-provenance.json) | Review date, baseline commit, Hugging Face queries and selected metadata |

Primary-source links and access limitations are recorded in the notes. Publication, submission and revision dates are distinguished. Third-party timings and accuracy figures are author-reported and were not reproduced. Raw downloaded papers, source snapshots and large search dumps are omitted.

## Numerical result

The Cora experiment uses the standard Planetoid split, 50 training epochs and the best validation checkpoint for seeds 42, 43 and 44. The corrected simulation uses feature and weight scales of 4096.

| Seed | Full float GCN accuracy | Float ridge accuracy | Current shim accuracy | Corrected simulation accuracy | Test prediction agreement with float ridge |
|---|---:|---:|---:|---:|---:|
| 42 | 82.7% | 77.7% | 51.2% | 77.7% | 100.0% |
| 43 | 82.4% | 79.3% | 57.0% | 79.3% | 100.0% |
| 44 | 81.5% | 77.4% | 67.9% | 77.4% | 99.8% |

These are **fixed-point simulations, not homomorphic-encryption results or privacy guarantees**. Bias is added in plaintext to match the existing CLI. The full GCN and ridge classifier have different architectures. Three seeds on one dataset provide an exploratory diagnosis; roadmap accuracy thresholds are future targets. The original training traces are retained for [seed 42](numerical-ablation-seed-42.log), [seed 43](numerical-ablation-seed-43.log) and [seed 44](numerical-ablation-seed-44.log).

## Reproduction

Run from the repository root using an environment with the repository dependencies installed. The recorded environment used Python 3.12.14, PyTorch 2.6.0+cpu, PyTorch Geometric 2.8.0.post1, NumPy 2.5.3 and SciPy 1.18.1, with two CPU threads. These versions document the run; the repository dependency manifest is not a frozen environment.

```bash
OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 python docs/research/2026-10-10/numerical_ablation.py
```

The helper resolves the repository root from its own location, reads the Cora dataset through the existing loader and writes new JSON/results to a fresh temporary directory, whose path it prints. If Cora is absent, the PyTorch Geometric loader downloads and processes it under `data/Cora`; network access to its dataset source is then required. The recorded run used cached Cora data. To retain a replay, supply `--output-dir /path/to/fresh-results`. The helper rejects the archive directory and existing result files to preserve recorded evidence. Timestamps and training times vary; dependency/platform changes can also change numerical values.

The portable helper was replayed on the recorded environment before archiving. All three seeds matched every archived numerical metric exactly, excluding timestamps and training times. Local Markdown links and JSON validity were also checked.

The original onboarding test run reported **7 passed, 1 failed**. The diagnosed failure is the existing simulator precision assertion in `tests/test_encryption.py`; the encrypted-evaluation CLI also has an import-path issue. This archive documents those application defects and does not fix them. Real CKKS execution, encrypted training, private topology and proof-system integration remain unvalidated.
