import numpy as np
import threading
import queue
import logging
from typing import Callable, List, Optional
from app.services.sources.base import AudioSource
from app.models.recording import AudioConfig, DeviceInfo

logger = logging.getLogger(__name__)


class AudioMixer(AudioSource):
    def __init__(
        self,
        sources: List[AudioSource],
        config: AudioConfig,
        gains: Optional[List[float]] = None,
    ):
        super().__init__(config)
        self.sources = sources
        self.gains = gains if gains else [1.0] * len(sources)

        self._queues = [queue.Queue() for _ in sources]
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._callback: Optional[Callable[[np.ndarray], None]] = None

    def _create_source_callback(self, idx: int):
        def cb(chunk: np.ndarray):
            self._queues[idx].put(chunk)

        return cb

    def start(self, callback: Callable[[np.ndarray], None]) -> None:
        self._callback = callback
        self._running = True
        self._thread = threading.Thread(target=self._mixer_loop, daemon=True)
        self._thread.start()

        for idx, source in enumerate(self.sources):
            source.start(self._create_source_callback(idx))

        logger.info("AudioMixer started")

    def stop(self) -> None:
        for source in self.sources:
            source.stop()

        self._running = False
        for q in self._queues:
            q.put(None)

        if self._thread:
            self._thread.join()

        self._callback = None
        logger.info("AudioMixer stopped")

    def _mixer_loop(self):
        try:
            import time

            buffers = [np.array([], dtype=np.float32) for _ in self.sources]
            chunk_size = self.config.chunk_size
            last_log_time = time.time()

            while self._running:
                # Log queue size every 5 seconds
                current_time = time.time()
                if current_time - last_log_time > 5.0:
                    q_sizes = [q.qsize() for q in self._queues]
                    b_sizes = [len(b) for b in buffers]
                    logger.info(
                        f"Mixer stats - Queue sizes: {q_sizes}, Buffer sizes (frames): {b_sizes}"
                    )
                    last_log_time = current_time

                # 1. Fetch available data from all queues
                for i, q in enumerate(self._queues):
                    while len(buffers[i]) < chunk_size:
                        try:
                            chunk = q.get_nowait()
                            if chunk is None:
                                return

                            if chunk.ndim > 1:
                                if chunk.shape[1] > 1:
                                    chunk = chunk.mean(axis=1)
                                else:
                                    chunk = chunk.flatten()

                            buffers[i] = np.concatenate(
                                [buffers[i], chunk.astype(np.float32)]
                            )
                        except queue.Empty:
                            break

                # 2. Check if ANY buffer has enough data to mix
                # This prevents deadlocks if WASAPI loopback stops during system silence
                if any(len(b) >= chunk_size for b in buffers):
                    # Pad slower streams with silence to maintain sync
                    for i in range(len(buffers)):
                        if len(buffers[i]) < chunk_size:
                            needed = chunk_size - len(buffers[i])
                            buffers[i] = np.concatenate(
                                [buffers[i], np.zeros(needed, dtype=np.float32)]
                            )

                    mixed = np.zeros(chunk_size, dtype=np.float32)
                    for i in range(len(self.sources)):
                        c = buffers[i][:chunk_size]
                        buffers[i] = buffers[i][chunk_size:]
                        mixed += c * self.gains[i]

                    if self._callback:
                        self._callback(mixed)
                else:
                    time.sleep(0.01)

        except Exception as e:
            logger.error(f"AudioMixer error: {e}")

    @classmethod
    def list_devices(cls) -> List[DeviceInfo]:
        return []
