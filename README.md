# PrivNet.AI - Privacy-Preserving Geometric Deep Learning

Welcome to **PrivNet.AI** — an open-source platform combining **post-quantum cryptography** and **geometric deep learning** to enable **privacy-preserving machine learning on sensitive data** such as genomics, financial networks, and healthcare records.

[![Join Us on Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/4fby4D28QE)

## 🚀 Project Vision
Build a privacy-centric infrastructure where users can train graph-based models **without ever decrypting their data**.

We aim to use **isogeny-based cryptography** (post-quantum secure) and **graph neural networks (GNNs)** to perform secure, structure-aware learning on encrypted data.

> **Current Status**: This is a proof-of-concept (PoC) demonstrating encrypted linear operations on graph neural network features. The current implementation uses `EncryptionShim` (a cryptographic simulator) for demonstration purposes. See [Limitations](#-current-limitations) below.

---

## 🧩 Key Technologies
- **Graph Neural Networks** for structured data learning (PyTorch Geometric)
- **Post-Quantum Cryptography** (PQC) modules for future isogeny-based encryption
- **Homomorphic Encryption** operations framework (in development)
- **PyTorch** for deep learning infrastructure
- **Federated Learning & Differential Privacy** (planned for future integration)

---

## 🔧 Project Structure

```bash
📦 privnet-ai/
├── crypto/                  # Cryptographic modules
│   ├── encryption.py        # EncryptionShim (PoC simulator)
│   ├── homomorphic/         # Homomorphic encryption operations
│   ├── pqc/                 # Post-quantum cryptography (Kyber)
│   └── protocols/           # Cryptographic protocols
├── ml/                      # Machine learning modules
│   ├── models/              # GNN models (GCN, etc.)
│   ├── layers/              # Custom GNN layers
│   ├── training/            # Training utilities
│   └── geometric/           # Geometric learning components
├── core/                    # Core utilities
│   ├── config.py            # Configuration management
│   └── utils.py             # General utilities
├── data/                    # Datasets (Cora, CiteSeer, PubMed)
├── api/                     # API endpoints (FastAPI)
├── tests/                   # Test suite
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
├── deployment/              # Deployment configurations
├── CONTRIBUTING.md          # How to contribute
├── CODE_OF_CONDUCT.md       # Collaboration guidelines
├── roadmap.md               # Project vision and goals
└── README.md                # This file
```

---

## 🧠 Why this project matters?

Current ML systems expose data at many points: during training, inference, or transport. This is not acceptable for sensitive data (e.g., genome sequences, health records, financial transactions).

PrivNet.AI introduces a new paradigm: **Train on encrypted data. Analyze graphs with security. Scale with structure.**

---

## 🛠️ Getting Started

### Prerequisites
- Python 3.11+ (tested with 3.12+)
- pip or conda

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/chimans/privnet-ai.git
cd privnet-ai
```

2. **Create a virtual environment** (recommended)
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### Running the Proof-of-Concept

Train a Graph Convolutional Network (GCN) on Planetoid datasets and evaluate encrypted linear operations:

```bash
# Train on Cora dataset with encrypted linear head evaluation
python main.py --dataset cora --epochs 50 --enc_eval

# Available options:
# --dataset {cora|citeseer|pubmed}  # Choose dataset (default: cora)
# --epochs N                         # Training epochs (default: 100)
# --hidden N                         # Hidden dimension (default: 64)
# --lr FLOAT                         # Learning rate (default: 0.01)
# --device {auto|cpu|cuda}          # Device selection (default: auto)
# --enc_eval                         # Enable encrypted linear head evaluation
# --enc_scale FLOAT                  # Quantization scale for EncryptionShim (default: 256.0)
# --seed N                           # Random seed (default: 42)
```

### Example Output
```
Epoch 001 | loss=1.9463 | train=0.229 | val=0.138 | test=0.158
...
Epoch 050 | loss=0.5108 | train=0.979 | val=0.806 | test=0.831

=== Final ===
Device: cpu
Dataset: Cora
Train Acc: 0.979
Val   Acc: 0.810
Test  Acc: 0.827
Time (sec): 0.6
Encrypted linear head test acc: 0.492
```

---

## 📚 Documentation
- [roadmap.md](roadmap.md) – Project roadmap and development phases
- [README_INSTRUCTION.md](README_INSTRUCTION.md) – Detailed PoC documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) – Contribution guidelines
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) – Community guidelines

---

## 🔬 Current Implementation Details

### Architecture Overview
The current PoC demonstrates:
1. **GCN Training**: A two-layer Graph Convolutional Network trained on Planetoid datasets (Cora, CiteSeer, PubMed)
2. **Feature Extraction**: Hidden representations (`H`) are extracted after the first GCN layer
3. **Linear Head**: A ridge regression-based linear classifier is trained on plaintext features
4. **Encrypted Evaluation**: The linear head is applied to encrypted/masked features using `EncryptionShim`

### EncryptionShim (PoC Simulator)
The `EncryptionShim` is **not real cryptography**. It's a proof-of-concept simulator that:
- Quantizes floating-point values to fixed-point integers
- Applies random additive masking
- Supports linear operations (addition, scalar multiplication, matrix multiplication)
- Demonstrates the feasibility of linear computation on masked data

**Important**: This is a simulation for demonstration purposes only. Real cryptographic security requires proper homomorphic encryption schemes.

### ⚠️ Current Limitations
- `EncryptionShim` is not cryptographically secure — it's a quantization + masking simulator
- Only linear operations are supported; nonlinearities (ReLU, Softmax) cannot be executed in the masked domain
- Graph structure and node features are processed in plaintext during training
- No post-quantum resistance or zero-knowledge proofs implemented
- Feature extraction (`H`) happens in plaintext; only the linear head operates on masked data

See [README_INSTRUCTION.md](README_INSTRUCTION.md) for detailed technical documentation.

---

## 🧪 Testing

Run the test suite to verify the installation:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test files
pytest tests/test_encryption.py
pytest tests/test_models.py
pytest tests/test_integration.py
```

---

## 👥 How to Contribute
We welcome contributions from cryptographers, ML engineers, researchers, and developers.

### Ways to contribute:
- Build core GNN modules or crypto components
- Implement real homomorphic encryption schemes (CKKS, BFV)
- Improve documentation and add examples
- Write tests and improve test coverage
- Review code and suggest improvements
- Report bugs and suggest features

### 📌 Contribution checklist:
1. Fork this repo
2. Create a new feature branch: `git checkout -b feature/your-feature`
3. Make your changes with clear commits
4. Add tests for new functionality
5. Ensure all tests pass: `pytest`
6. Open a pull request and fill out the PR template

### Pull Request Template:
```markdown
### What does this PR do?
- Clearly explain your update/fix

### Checklist:
- [ ] My code follows the project style
- [ ] I've tested this locally
- [ ] I added tests for new functionality
- [ ] I linked any related Issue
```

---

## 📍 Project Status
We're in **early development** — currently building a proof-of-concept demonstrating encrypted linear operations on GNN features.

**Current Phase**: PoC with EncryptionShim simulator
**Next Steps**: See [roadmap.md](roadmap.md) for detailed development phases

Use `Issues` to suggest features or `Discussions` to brainstorm with us.

---

## 🗺️ Roadmap Highlights
See [roadmap.md](roadmap.md) for the complete development plan.

**Completed:**
- [x] Repo bootstrapping & structure setup
- [x] PoC with EncryptionShim and GCN on Planetoid datasets
- [x] Basic test suite

**In Progress / Planned:**
- [ ] Real homomorphic encryption integration (CKKS/BFV)
- [ ] Full encrypted inference pipeline
- [ ] Post-quantum cryptography (isogeny-based)
- [ ] Encrypted graph structure support
- [ ] Federated learning integration
- [ ] MVP deployment

---

## 📜 License
MIT License — free to use, modify, and contribute.

---

## ✨ Contact & Community
- **Discord**: [Join our community](https://discord.gg/4fby4D28QE)
- **GitHub Issues**: Report bugs, request features, or ask questions
- **Contributions**: See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
- **Roadmap**: Follow [roadmap.md](roadmap.md) for development progress

Let's build privacy-native AI together.

— The PrivNet.AI team

---

## 🙏 Acknowledgments
Special thanks to the open-source communities behind PyTorch, PyTorch Geometric, and the cryptographic research community working on privacy-preserving machine learning.
