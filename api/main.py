from fastapi import FastAPI
from crypto.pqc.kyber import Kyber

app = FastAPI()

@app.get("/")
async def root():
    kyber = Kyber()
    pk, sk = kyber.keygen()
    sample_data = "privnetai-demo"
    encrypted = kyber.encrypt(pk, sample_data)
    decrypted = kyber.decrypt(sk, encrypted)
    return {
        "original": sample_data,
        "encrypted": encrypted.hex(),
        "decrypted": decrypted
    }