# PrivNet.AI — proposed roadmap

Prepared 10 October 2026 for review. This draft revises the roadmap using current implementation evidence and verified 2025–2026 research. It has not been applied to the tracked repository roadmap.

> A research framework for privacy-preserving graph inference and future collaborative learning under explicit cryptographic assumptions.

## Goal and scope

Build a reproducible graph-learning system whose privacy claims, numerical fidelity, and execution costs can be independently assessed. The first cryptographic milestone is real CKKS inference; encrypted/collaborative training and verifiable computation remain longer-term targets.

Work advances through evidence gates. Calendar estimates should be assigned after each milestone has an owner, a concrete workload, and available resources. A phase is complete only when its outputs and exit criteria have been demonstrated.

## Current state

- [x] Repository, documentation, and a working Python/PyTorch Geometric CPU development workflow.
- [x] Plaintext two-layer GCN training on Cora.
- [x] Educational masked linear-head simulation, explicitly separated from cryptographic execution.
- [x] External three-seed diagnosis demonstrating correct fixed-point weight/feature scaling.
- [x] Targeted 2025–2026 literature review covering GitHub, Hugging Face, and primary papers.
- [ ] Repository numerical and CLI import defects repaired. Last full test result was 7 passed and 1 failed.
- [ ] Real homomorphic encryption, full encrypted GCN inference, authenticated PQ communication, private topology, encrypted training, and verifiable execution.

Existing checked outreach items are historical project records; they do not substitute for technical acceptance criteria. The numerical correction was demonstrated in an external experiment and remains to be implemented in repository code.

## Initial protocol

The first inference benchmark uses a client and an honest-but-curious evaluator. The client keeps the secret decryption key. For the encrypted-head milestone, the client computes hidden features locally; for the full-GCN milestone, it encrypts original node features.

| Component | Initial disclosure policy |
|---|---|
| Node features and encrypted intermediate values | Client plaintext; evaluator receives ciphertexts only. |
| Topology, graph size, dimensions, packing layout | Public. Graph-topology confidentiality is a separate mode. |
| Model weights and architecture | Plaintext at evaluator; no model-confidentiality guarantee against the client. |
| Labels and training data | Used in the declared offline baseline; protected training is a separate protocol. |
| Decryption key | Client only; never serialized into evaluator context or payload. |
| Predictions | Decrypted by the client; any further disclosure is explicitly specified. |
| Timing, sizes, query patterns | Recorded as disclosed metadata unless a later protocol protects them. |

Document output recipients and allowed evaluations before exposing a service. A baseline that keeps outputs client-only does not establish security for one that returns plaintext decryptions to an adversary. Malicious-server correctness and arbitrary chosen-ciphertext security require additional protocol work.

## M0 — Correctness, reproducibility, and specification

**Status:** partial evidence exists; coding work pending.

Deliverables:

- [ ] Fix the legacy CLI encryption import and the shim's unscaled weight rounding; define feature, weight, output, and bias scales and accumulator bounds.
- [ ] Keep the shim labeled as educational arithmetic. It bundles a mask with its payload and is not a privacy mechanism.
- [ ] Report full GCN, float ridge head, and corresponding simulated outputs separately. Preserve graph semantics, weights, splits, and seeds in each arithmetic comparison.
- [ ] Record dependency versions, dataset provenance/hashes, seeds, commands, checkpoint selection, and results; make the numerical experiment reproducible from a prepared environment.
- [ ] Specify actors, protected data, model visibility, output policy, key ownership, adversary, and disclosed metadata.
- [ ] Retire SIDH/SIKE as planned security foundations. Specify CKKS computation, PQ key establishment, and authentication as separate components.

**Exit gate:** existing intended tests execute and pass after substantive fixes; CLI runs without the import workaround; matched numerical outputs report error and agreement; reproduction evidence and a protocol specification are available. Tune on validation data, then freeze the evaluation protocol before final test runs. External simulation results do not mark real encryption complete.

## M1 — Genuine CKKS encrypted-head inference

**Dependency:** M0.

Deliverables:

- [ ] Select a maintained CKKS backend; OpenFHE is the initial candidate, with a compatible current SEAL-based backend as an alternative.
- [ ] Evaluate the identical hidden-feature ridge classifier in float and real CKKS, including bias.
- [ ] Use separate client/evaluator processes or equivalently auditable context boundaries. Client secret keys remain client-side; evaluator holds only required public/evaluation material.
- [ ] Perform actual encryption, ciphertext evaluation, ciphertext return, and client decryption. Preserve public model and topology assumptions.
- [ ] Publish library versions, ring dimension, modulus chain, scale, secret distribution, depth, selected security target, and estimator model. Distinguish classical and quantum estimates; never infer whole-system PQ security from a handshake.
- [ ] Measure key generation, evaluation-key size, encryption, setup, online evaluation, decryption, ciphertext bytes, communication, and peak memory separately.

**Proposed fidelity target:** at least 99.5% same-model prediction agreement and at most 0.5 percentage-point absolute accuracy difference on the locked benchmark, evaluated separately for each of five fixed seeds. Publish maximum/mean logit error and class margins. These are planning targets to validate, not existing achievements; any revision must be recorded before final test evaluation.

**Exit gate:** real cryptographic execution meets the recorded fidelity and security targets, and a fresh prepared-environment run reproduces the measured result. Disabled security checks, a plaintext simulation backend, or lower-security performance settings do not satisfy the gate. Label the result encrypted-head inference; training and earlier feature extraction remain plaintext.

## M2 — Complete GCN inference with public topology

**Dependency:** M1.

Deliverables:

- [ ] Encrypt original node features and implement every layer of the selected graph model: normalization, neighbor aggregation, projection, activation, and final output.
- [ ] Preserve the chosen graph operator, self-loop convention, bias, and train/validation/test masks.
- [ ] Calibrate and train/distill an HE-compatible model with declared activation ranges; compare polynomial degrees and suitable smooth-activation students.
- [ ] Keep three model evaluations separate: original float GCN, float HE-compatible GCN, and the identical CKKS circuit.
- [ ] Validate on Cora and at least one additional documented graph dataset. Report results per dataset and seed.
- [ ] Use maintained, security-checked parameters and account for client preprocessing and any disclosed metadata.

**Proposed fidelity targets:** model-adaptation loss at most 2 percentage points and additional CKKS loss at most 0.5 point, with at least 99.5% prediction agreement against the identical HE-compatible float model. Apply the targets separately to every locked dataset and each of five fixed seeds; also report averages and variation. The two loss budgets are distinct. Record infeasibility and any model/target revision openly based on validation evidence before final test evaluation.

**Exit gate:** original features remain encrypted throughout evaluator computation; corresponding float/CKKS operators are matched; all loss sources and resource costs are reported. A ridge head alone does not satisfy the full-GCN gate.

## M3 — Graph-specific research and benchmark release

**Dependency:** a validated M2 baseline. Range/layout investigations can begin earlier, but improvement claims require genuine encrypted execution.

Research question:

> Which graph-aware layouts and precision policies reduce encrypted-inference cost while meeting declared disclosure limits and prediction-error bounds?

Deliverables:

- [ ] Implement and document appropriate recent baseline methods: FicGCN-style sparse aggregation and scheduling; dense/reference CKKS; optional EinHops/Rotom-assisted layouts; TGHE-style batching only when its preprocessing/disclosures are allowed.
- [ ] Treat unavailable author code as an implementation/reproduction task, not a benchmark already executed. Match tasks, graph operators, security, hardware, and disclosure policies before numerical comparisons.
- [ ] Investigate graph-specific activation-range bounds, precision allocation, node reordering, and partitioned/ego-graph packing.
- [ ] For fixed public topology, derive range bounds for the actual sparse operator, bounded features, weights, and activations. Symmetric-normalization spectral bounds do not automatically imply a row-sum bound. Changing or hidden topology needs a separate analysis.
- [ ] Separate certified polynomial-approximation error from empirically measured CKKS error. Define the bounded input domain and how out-of-domain inputs are handled.
- [ ] Use the condition `float winning margin > 2 × maximum per-sample logit error` as a numerical fidelity criterion. Observed sample errors alone do not certify unseen inputs or cryptographic security.
- [ ] Count rotations, multiplications, key switches, ciphertexts, occupied slots, evaluation-key memory, layout conversion, and offline/online cost. Demonstrate work actually removed by pruning/compaction.
- [ ] Run Cora/CiteSeer/PubMed as resources permit, plus controlled graph-size, degree, feature-width, depth, and feature-shift experiments. Distinguish sampled-query inference from whole-graph processing.
- [ ] Publish ablations, seed variation, performance repetition/uncertainty, commands, versioned artifacts, and an honest comparison of security/disclosure modes.

**Exit gate:** a measurable improvement over compatible baselines at matched fidelity, security, and permitted disclosure; evidence identifies which optimization caused it. A systematic literature comparison precedes any novelty claim. Unsuccessful hypotheses are recorded rather than hidden by easier tests or weaker parameters.

**Release:** a technical benchmark report/whitepaper and reproducible research CLI. Website documentation can accompany the release. Expanded UI and domain forks follow demonstrated capability and workload demand.

## M4 — Stronger privacy and authenticated communication

**Dependencies:** M0 for communication design; M2/M3 evidence for privacy/performance extensions. This work can run in parallel rather than postponing all protocol security until optimization finishes.

### Communication and output policy

- [ ] Integrate standardized ML-KEM key establishment and an appropriate authenticated encryption/session protocol; choose standardized signatures where their authentication role is needed.
- [ ] Replace the reversible-string Kyber mock with a maintained implementation for the defined protocol. Test interoperability, context binding, and replay/error handling.
- [ ] Specify output recipients, queries per key, key-refresh rules, and whether decrypted values cross a trust boundary. Evaluate applicable CKKS output-leakage countermeasures with explicit assumptions and measured precision cost.
- [ ] Document the security of the composition. PQ transport does not make weak HE parameters, conventional proof assumptions, or unauthenticated evaluation automatically PQ-secure.

**Exit gate:** the protocol's key establishment/authentication and output policy are demonstrated. This gate is required before any remote pilot making those security claims. Signatures authenticate data/messages; they do not prove the correct GNN was evaluated.

### Private topology and model privacy

- [ ] Choose a distinct private-topology and/or model-confidentiality protocol, with encrypted adjacency, appropriate MPC, or a justified hybrid.
- [ ] Specify collusion assumptions, graph-size/degree/template leakage, access patterns, and interaction requirements.
- [ ] Compare with CryptGNN/PrivGNN under compatible assumptions, including preprocessing, network latency, communication, and client work.
- [ ] Evaluate whether stronger privacy changes the range analysis, sparsity optimizations, or cost model.

**Exit gate:** the promised graph/model components and relevant access patterns are protected under the specified protocol; the cost of stronger privacy is measured. Feature encryption alone does not meet a private-topology claim.

## M5 — Protected training, verifiability, and domain pilots

These are explicit research branches, not prerequisites that must all be solved before releasing M3. Each branch starts when its own inference, ownership, and protocol requirements are established.

### Protected training

- [ ] Start with a defined protected last-layer training experiment before full GNN backpropagation.
- [ ] Specify ownership/protection of features, labels, edges, gradients, updates, checkpoints, and final model. State what remains plaintext at each participant.
- [ ] Choose outsourced encrypted training or collaborative/federated training as distinct protocols; evaluate suitable HE/MPC/threshold mechanisms.
- [ ] Compare identical plaintext optimization with protected training, measuring convergence, utility, setup, compute, and communication.
- [ ] If using differential privacy, define node/edge/graph adjacency, a privacy budget, and accounting. Secure aggregation and federated learning alone do not establish those guarantees.

**Exit gate:** actual protected training steps execute under the declared assumptions and are reproducible. Full encrypted GNN training is claimed only when all stated forward/backward/update operations are validated; encrypted inference or secure averaging alone is insufficient.

### Verifiable computation

- [ ] Define a concrete malicious-evaluator problem and first verify an inference circuit with input/model commitments and the stated preprocessing/arithmetic.
- [ ] Select a proof mechanism whose assumptions fit the required adversary and quantum-security claims. Separate inference proofs from training proofs.
- [ ] Measure prover/verifier time, memory, proof size, completeness/soundness assumptions, and the effect of approximate arithmetic.

**Exit gate:** the proof attests to the specified computation and identities under documented assumptions. Ordinary signatures, numerical-error bounds, and transport encryption do not meet this gate.

### Domain pilots

- [ ] Choose one public or appropriately provisioned biomedical/financial workload based on validated protocol capability.
- [ ] Map its topology/features/output sensitivity to the implemented mode and document limits.
- [ ] Demonstrate correctness, utility, operation within a stated resource budget, and supported key/communication handling before making deployment claims.

## Supporting research

Retain algebraic geometry, isogeny mathematics, sheaf/topological models, and GNN-assisted cryptanalysis as optional research tracks with concrete questions and separate artifacts. They are not security prerequisites for the initial CKKS graph-inference system. SIDH/SIKE remain retired from the security design.

Reuse published cryptographic assumptions and established libraries; formal work should address protocol composition, explicit leakage, graph-dependent numerical bounds, and the actual guarantees being claimed. A proof that a lattice hardness assumption is universally true is not a reasonable roadmap deliverable.

## Research references and review provenance

- [FicGCN, ICML 2025](https://proceedings.mlr.press/v267/kan25a.html): sparse HE aggregation and packing, public topology.
- [CryptGNN, CCS 2025](https://arxiv.org/abs/2509.09107) and [PrivGNN, 2025 preprint](https://arxiv.org/abs/2511.02185): interactive/private-topology baselines.
- [DESIGN, 2025 preprint](https://huggingface.co/papers/2507.05649), [author code](https://github.com/LabRAI/DESIGN): adaptive pruning/activations, subject to reproduction caveats.
- [TGHE, June 2026 preprint](https://arxiv.org/abs/2606.26664): template batching with disclosed structural metadata.
- [EinHops, 2025](https://huggingface.co/papers/2507.07972), [author code](https://github.com/baahl-nyu/einhops), and [Rotom, 2026](https://github.com/cmu-cryptosystems/Rotom): tensor packing/compiler methods.
- [Encrypted Neural Networks without Overflows, 2026](https://arxiv.org/abs/2605.23096): bounded-domain range and approximation work requiring graph-specific extension.
- [Approximate-FHE security, PKC 2025](https://link.springer.com/chapter/10.1007/978-3-031-91832-2_4): output-security considerations; full paper was unavailable in this review.
- [Microsoft SIDH/SIKE warning](https://github.com/microsoft/PQCrypto-SIDH#warning): retired protocols.
- [Expanded source review](research-2025-2026-addendum.md), [numerical evidence](numerical-ablation.json), and [roadmap assessment](roadmap-review.md).

This roadmap does not mark third-party headline results, external arithmetic simulation, or unimplemented protocols as completed project capabilities.
