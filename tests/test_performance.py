import time
import torch
from crypto.encryption import EncryptionShim

class TestPerformance:
    def test_encryption_speed(self):
        """Benchmark encryption/decryption speed"""
        shim = EncryptionShim()
        x = torch.randn(1000, 100)
        
        start = time.time()
        enc_x = shim.encrypt_tensor(x)
        encrypt_time = time.time() - start
        
        start = time.time()
        x_dec = shim.decrypt_tensor(enc_x)
        decrypt_time = time.time() - start
        
        print(f"Encryption time: {encrypt_time:.4f}s")
        print(f"Decryption time: {decrypt_time:.4f}s")
        
        # Basic performance threshold
        assert encrypt_time < 1.0  # Should encrypt 100k elements in <1s
        assert decrypt_time < 1.0
