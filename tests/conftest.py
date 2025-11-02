import pytest
import torch
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from datasets import load_planetoid

@pytest.fixture
def small_graph_data():
    """Fixture providing small test graph data"""
    dataset, data = load_planetoid(name="Cora")
    # Return subset for faster testing
    return dataset, data

@pytest.fixture
def encryption_shim():
    """Fixture providing configured encryption shim"""
    from crypto.encryption import EncryptionShim
    return EncryptionShim(scale=128.0, seed=42)
