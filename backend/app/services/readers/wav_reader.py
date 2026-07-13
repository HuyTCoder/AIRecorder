import wave
import numpy as np
import time
import threading
from typing import Callable, Optional
import logging
from app.models.recording import AudioConfig

logger = logging.getLogger(__name__)


class WavReader:
    """Mock reader that reads from a WAV file to simulate an AudioSource."""

    def __init__(self, file_path: str, config: AudioConfig):
        self.file_path = file_path
        self.config = config
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._callback: Optional[Callable[[np.ndarray], None]] = None

    def start(self, callback: Callable[[np.ndarray], None]) -> None:
        self._callback = callback
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()
        logger.info(f"WavReader started with file {self.file_path}")

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join()
        self._callback = None
        logger.info("WavReader stopped")

    def _read_loop(self):
        try:
            with wave.open(self.file_path, "rb") as wf:
                sleep_time = self.config.chunk_size / self.config.sample_rate

                while self._running:
                    data = wf.readframes(self.config.chunk_size)
                    if not data:
                        break  # End of file

                    audio_data = np.frombuffer(data, dtype=np.int16)
                    if wf.getnchannels() > 1:
                        audio_data = audio_data.reshape(-1, wf.getnchannels())

                    if self._callback:
                        self._callback(audio_data)

                    time.sleep(sleep_time)
        except Exception as e:
            logger.error(f"WavReader error: {e}")
