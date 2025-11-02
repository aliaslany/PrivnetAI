# privnetai/core/config.py
@dataclass
class Config:
    crypto: CryptoConfig
    model: ModelConfig
    training: TrainingConfig
    
    @classmethod
    def from_yaml(cls, path: str):
        # Load from YAML configuration files
