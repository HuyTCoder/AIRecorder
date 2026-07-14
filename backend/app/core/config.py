import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Voice Note AI"
    API_V1_STR: str = "/api/v1"

    # ASR Configuration
    ASR_ENGINE: str = "zipformer"
    ZIPFORMER_MODEL_DIR: str = "models"
    ZIPFORMER_NUM_THREADS: int = 2

    # Server Configuration
    # The desktop client and backend run on the same machine.  Do not expose
    # recording controls or locally stored settings to the LAN by default.
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Debug mode — expose detailed error messages (set False in production)
    DEBUG: bool = False

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development"}:
                return True
            if normalized in {
                "0",
                "false",
                "no",
                "off",
                "release",
                "prod",
                "production",
            }:
                return False
        return bool(value)

    # CORS Origins (accepts comma-separated values, e.g. "http://localhost:3000,http://localhost:5173")
    # `null` is the production Electron file-origin; the localhost origins
    # are used by electron-vite in development.
    CORS_ORIGINS_STR: str = "null,http://localhost:5173,http://127.0.0.1:5173"

    # Audio pipeline defaults — single source of truth cho toàn bộ pipeline
    # Thay đổi ở đây → tự động áp dụng cho MicrophoneSource, SystemAudioSource,
    # AudioMixer, AudioWriter mà không cần sửa code ở bất kỳ class nào.
    AUDIO_SAMPLE_RATE: int = 16000  # Hz — chuẩn STT (Zipformer)
    AUDIO_CHANNELS: int = 1  # mono — đủ cho STT
    AUDIO_CHUNK_SIZE: int = 1024  # frames per callback (~64ms ở 16kHz)
    AUDIO_DTYPE: str = "int16"  # PCM 16-bit

    @property
    def CORS_ORIGINS(self) -> List[str]:
        if not self.CORS_ORIGINS_STR or self.CORS_ORIGINS_STR == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS_STR.split(",")]

    @property
    def audio_config(self):  # type: ignore[return]
        # Import lazy để tránh circular import (models import config)
        from app.models.recording import AudioConfig

        return AudioConfig(
            sample_rate=self.AUDIO_SAMPLE_RATE,
            channels=self.AUDIO_CHANNELS,
            chunk_size=self.AUDIO_CHUNK_SIZE,
            dtype=self.AUDIO_DTYPE,
        )

    # Settings configuration
    model_config = SettingsConfigDict(
        env_file=os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
