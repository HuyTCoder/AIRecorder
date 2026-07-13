import sounddevice as sd
import numpy as np
from typing import Callable, List, Optional
import logging

from app.services.sources.base import AudioSource
from app.models.recording import AudioConfig, DeviceInfo
from app.utils.device_filter import filter_microphones

logger = logging.getLogger(__name__)


class MicrophoneSource(AudioSource):
    def __init__(self, device_id: Optional[int], config: AudioConfig):
        super().__init__(config)
        self.device_id = device_id
        self._stream: Optional[sd.InputStream] = None
        self._callback: Optional[Callable[[np.ndarray], None]] = None

    def _audio_callback(self, indata: np.ndarray, frames: int, time, status):
        if status:
            logger.warning(f"MicrophoneSource status: {status}")
        if self._callback:
            self._callback(indata.copy())

    def start(self, callback: Callable[[np.ndarray], None]) -> None:
        self._callback = callback

        self._stream = sd.InputStream(
            device=self.device_id,
            channels=self.config.channels,
            samplerate=self.config.sample_rate,
            dtype=self.config.dtype,
            blocksize=self.config.chunk_size,
            callback=self._audio_callback,
        )
        self._stream.start()
        logger.info(
            f"Microphone opened (Device ID: {self.device_id}, Channels: {self.config.channels}, Sample Rate: {self.config.sample_rate}Hz)"
        )

    def stop(self) -> None:
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None
        self._callback = None
        logger.info("MicrophoneSource stopped")

    @classmethod
    def list_devices(cls, advanced: bool = False) -> List[DeviceInfo]:
        devices = []
        try:
            sd_devices = sd.query_devices()

            # Prefer WASAPI on Windows to get full, non-truncated device names (MME limits to 31 chars)
            target_hostapi = sd.default.hostapi
            for i, hapi in enumerate(sd.query_hostapis()):
                if "WASAPI" in hapi["name"]:
                    target_hostapi = i
                    break

            # Find default input device for the chosen host API
            default_input_idx = sd.default.device[0]
            if target_hostapi != sd.default.hostapi:
                # If we switched to WASAPI, try to find its default input device
                api_info = sd.query_hostapis(target_hostapi)
                if api_info["default_input_device"] >= 0:
                    default_input_idx = api_info["default_input_device"]

            filtered = filter_microphones(
                raw_devices=list(sd_devices),
                default_input_idx=default_input_idx,
                default_hostapi=target_hostapi,
                advanced=advanced,
            )

            for idx, short_name, full_name, dev in filtered:
                devices.append(
                    DeviceInfo(
                        id=idx,
                        name=short_name,
                        full_name=full_name,
                        max_input_channels=dev["max_input_channels"],
                        max_output_channels=dev["max_output_channels"],
                        default_samplerate=dev["default_samplerate"],
                        is_default=(idx == default_input_idx),
                    )
                )
        except Exception as e:
            logger.error(f"Error listing microphone devices: {e}")
        return devices
