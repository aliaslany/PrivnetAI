import pytest
import torch
from ml.models.models import GCN

class TestGCN:
    def test_model_initialization(self):
        """Test GCN model can be initialized with correct dimensions"""
        model = GCN(in_channels=64, hidden_channels=32, out_channels=7)
        assert model.conv1.in_channels == 64
        assert model.conv1.out_channels == 32
        assert model.conv2.out_channels == 7
    
    def test_forward_pass(self):
        """Test forward pass produces correct output shape"""
        model = GCN(in_channels=10, hidden_channels=16, out_channels=3)
        x = torch.randn(5, 10)  # 5 nodes, 10 features
        edge_index = torch.tensor([[0, 1, 2, 3], [1, 2, 3, 4]], dtype=torch.long)
        
        out = model(x, edge_index)
        assert out.shape == (5, 3)
    
    def test_hidden_representation(self):
        """Test forward_hidden method"""
        model = GCN(in_channels=10, hidden_channels=16, out_channels=3)
        x = torch.randn(5, 10)
        edge_index = torch.tensor([[0, 1, 2, 3], [1, 2, 3, 4]], dtype=torch.long)
        
        hidden = model.forward_hidden(x, edge_index)
        assert hidden.shape == (5, 16)
