import wave
import numpy as np
import threading
import queue
import logging
from pathlib import Path
from typing import Optional
from app.models.recording import AudioConfig

logger = logging.getLogger(__name__)


class AudioWriter:
    def __init__(self, output_path: Path, config: AudioConfig):
        self.output_path = output_path
        self.config = config
        self._queue = queue.Queue()
        self._running = False
        self._thread = None
        self._frames_written = 0
        self._write_error: Optional[Exception] = None

    def push(self, chunk: np.ndarray) -> None:
        """Thread-safe, non-blocking call to push audio chunk"""
        self._queue.put(chunk.copy())

    def start(self):
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self._running = True
        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()
        logger.info(f"AudioWriter started writing to {self.output_path}")

    def stop_and_finalize(self) -> float:
        self._running = False
        self._queue.put(None)  # Sentinel to stop worker
        if self._thread:
            self._thread.join(timeout=5)

        if self._write_error:
            raise RuntimeError(f"AudioWriter failed: {self._write_error}")

        duration = self._frames_written / self.config.sample_rate
        logger.info(f"AudioWriter stopped. Total duration: {duration:.2f}s")
        return duration

    def _worker_loop(self):
        try:
            self.output_path.parent.mkdir(parents=True, exist_ok=True)
            with wave.open(str(self.output_path), "wb") as wf:
                wf.setnchannels(self.config.channels)
                wf.setsampwidth(2)  # 16-bit PCM
                wf.setframerate(self.config.sample_rate)

                while self._running or not self._queue.empty():
                    try:
                        chunk = self._queue.get(timeout=0.1)
                    except queue.Empty:
                        if not self._running:
                            break
                        continue

                    if chunk is None:  # Sentinel received
                        break

                    if isinstance(chunk, np.ndarray):
                        if (
                            chunk.ndim > 1
                            and chunk.shape[1] > 1
                            and self.config.channels == 1
                        ):
                            chunk = chunk.mean(axis=1)

                        if chunk.dtype == np.float32:
                            chunk = (np.clip(chunk, -1.0, 1.0) * 32767).astype(np.int16)
                        elif chunk.dtype.kind in {"i", "u"}:
                            chunk = chunk.astype(np.int16)

                        if chunk.size:
                            wf.writeframes(chunk.tobytes())
                            self._frames_written += len(chunk)

        except Exception as e:
            self._write_error = e
            logger.error(f"AudioWriter worker error: {e}")
