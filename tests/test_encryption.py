import pytest
import torch
from crypto.encryption import EncryptionShim, EncTensor

class TestEncryptionShim:
    def test_encrypt_decrypt_roundtrip(self):
        """Test that encryption followed by decryption preserves data"""
        shim = EncryptionShim(scale=256.0, seed=42)
        x = torch.randn(3, 4)
        enc_x = shim.encrypt_tensor(x)
        x_dec = shim.decrypt_tensor(enc_x)
        
        # Should be approximately equal due to quantization
        assert torch.allclose(x, x_dec, atol=1/256.0)
    
    def test_linear_operations(self):
        """Test encrypted linear operations"""
        shim = EncryptionShim(scale=128.0, seed=1)
        x = torch.randn(4, 3)
        W = torch.randn(3, 2)
        
        # Plain computation
        y_plain = x @ W
        
        # Encrypted computation
        enc_x = shim.encrypt_tensor(x)
        enc_y = shim.matmul_linear_only(enc_x, W)
        y_dec = shim.decrypt_tensor(enc_y)
        
        assert torch.allclose(y_plain, y_dec, atol=0.1)
