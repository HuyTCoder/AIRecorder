import os
import logging
from huggingface_hub import snapshot_download
from app.services.punctuation.restorer import ImprovedPunctuationRestorer

logger = logging.getLogger(__name__)


class PunctuationService:
    def __init__(self, model_repo="welcomyou/vibert-capu-onnx"):
        self.model_repo = model_repo
        self.restorer = None
        self.base_dir = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        self.model_dir = os.path.join(self.base_dir, "models", "vibert-capu")

    def initialize(self):
        """Downloads the model if necessary and initializes the ONNX restorer."""
        if not os.path.exists(os.path.join(self.model_dir, "vibert-capu.int8.onnx")):
            logger.info(
                f"Downloading punctuation model from {self.model_repo} to {self.model_dir}..."
            )
            os.makedirs(self.model_dir, exist_ok=True)
            snapshot_download(
                repo_id=self.model_repo,
                local_dir=self.model_dir,
                allow_patterns=["*.json", "*.txt", "*.onnx"],
                ignore_patterns=[
                    "*.bin",
                    "*.safetensors",
                    "*.h5",
                    "*.msgpack",
                    "*.pt",
                ],  # ignore PyTorch/TF weights
            )
            logger.info("Punctuation model downloaded successfully.")

        logger.info("Initializing ImprovedPunctuationRestorer...")
        # Restorer will automatically load the INT8 ONNX model from models/vibert-capu
        self.restorer = ImprovedPunctuationRestorer(
            confidence=0.3, prefer_int8=True, execution_provider="cpu"
        )
        logger.info("PunctuationService initialized.")

    def restore(self, text: str) -> str:
        """Adds punctuation and capitalization to the input text."""
        if not self.restorer:
            logger.warning(
                "PunctuationService is not initialized. Returning original text."
            )
            return text

        if not text or not text.strip():
            return ""

        return self.restorer.restore(text)
