from abc import ABC, abstractmethod
from typing import Callable, List
import numpy as np
from app.models.recording import AudioConfig, DeviceInfo


class AudioSource(ABC):
    def __init__(self, config: AudioConfig):
        self.config = config

    @abstractmethod
    def start(self, callback: Callable[[np.ndarray], None]) -> None:
        """Bắt đầu capture. Audio driver sẽ gọi callback khi có data."""
        pass

    @abstractmethod
    def stop(self) -> None:
        """Dừng capture, giải phóng tài nguyên hardware."""
        pass

    @classmethod
    @abstractmethod
    def list_devices(cls) -> List[DeviceInfo]:
        """Liệt kê devices khả dụng cho loại nguồn này."""
        pass
