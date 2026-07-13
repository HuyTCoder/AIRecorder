import pyaudiowpatch as pyaudio
import numpy as np
from typing import Callable, List, Optional
import logging

from app.services.sources.base import AudioSource
from app.models.recording import AudioConfig, DeviceInfo
from app.utils.wav_utils import resample

logger = logging.getLogger(__name__)


class SystemAudioSource(AudioSource):
    def __init__(self, config: AudioConfig, device_id: Optional[int] = None):
        super().__init__(config)
        self.device_id = device_id
        self._pa = pyaudio.PyAudio()
        self._stream = None
        self._callback: Optional[Callable[[np.ndarray], None]] = None

    def _audio_callback(self, in_data, frame_count, time_info, status):
        if status:
            logger.warning(f"SystemAudioSource status: {status}")
        if self._callback and in_data:
            audio_data = np.frombuffer(in_data, dtype=np.int16)

            if self.device_channels > 1:
                audio_data = audio_data.reshape(-1, self.device_channels)
                # Convert to mono if requested config is mono
                if self.config.channels == 1:
                    audio_data = audio_data.mean(axis=1).astype(np.int16)

            # Resample if device sample rate differs from config
            if self.device_sr != self.config.sample_rate:
                audio_data = resample(
                    audio_data, self.device_sr, self.config.sample_rate
                )

            # Convert to float32 to match MicrophoneSource and config.dtype
            audio_data = audio_data.astype(np.float32) / 32768.0

            self._callback(audio_data)

        return (in_data, pyaudio.paContinue)

    def start(self, callback: Callable[[np.ndarray], None]) -> None:
        self._callback = callback

        try:
            target_device = None
            if self.device_id is not None:
                # User specifically requested a device, which we assume is already a loopback device
                target_device = self._pa.get_device_info_by_index(self.device_id)
            else:
                # Auto-detect default output loopback
                wasapi_info = self._pa.get_host_api_info_by_type(pyaudio.paWASAPI)
                default_speakers = self._pa.get_device_info_by_index(
                    wasapi_info["defaultOutputDevice"]
                )

                target_device = default_speakers
                if not target_device["isLoopbackDevice"]:
                    for loopback in self._pa.get_loopback_device_info_generator():
                        if default_speakers["name"] in loopback["name"]:
                            target_device = loopback
                            break

            self.device_channels = target_device["maxInputChannels"]
            self.device_sr = int(target_device["defaultSampleRate"])

            logger.info(
                f"System Audio opened (Device: {target_device['name']}, Channels: {self.device_channels}, Sample Rate: {self.device_sr}Hz)"
            )

            self._stream = self._pa.open(
                format=pyaudio.paInt16,
                channels=self.device_channels,
                rate=self.device_sr,
                frames_per_buffer=self.config.chunk_size,
                input=True,
                input_device_index=target_device["index"],
                stream_callback=self._audio_callback,
            )
            self._stream.start_stream()
        except Exception as e:
            logger.error(f"Failed to start SystemAudioSource: {e}")
            raise e

    def stop(self) -> None:
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
            self._stream = None
        self._callback = None
        logger.info("SystemAudioSource stopped")

    def close(self) -> None:
        if hasattr(self, "_pa") and self._pa:
            self._pa.terminate()

    @classmethod
    def list_devices(cls, advanced: bool = False) -> List[DeviceInfo]:
        pa = pyaudio.PyAudio()
        devices = []
        try:
            wasapi_info = pa.get_host_api_info_by_type(pyaudio.paWASAPI)
            default_out = wasapi_info.get("defaultOutputDevice", -1)

            seen_names: set = set()
            for loopback in pa.get_loopback_device_info_generator():
                full_name: str = loopback["name"]

                # In basic mode, skip virtual routing devices
                if not advanced:
                    name_lower = full_name.lower()
                    if any(
                        kw in name_lower
                        for kw in (
                            "voicemeeter",
                            "vb-audio",
                            "vb audio",
                            "cable",
                            "rtx voice",
                            "nvidia broadcast",
                            "steam streaming",
                            "virtual",
                        )
                    ):
                        continue

                if full_name in seen_names:
                    continue
                seen_names.add(full_name)

                is_default = False
                if default_out >= 0:
                    out_dev = pa.get_device_info_by_index(default_out)
                    if out_dev["name"] in full_name:
                        is_default = True

                # Shorten display name (strip "[Loopback]" suffix the user doesn't need)
                short_name = (
                    full_name.replace(" [Loopback]", "")
                    .replace("[Loopback]", "")
                    .strip()
                )

                devices.append(
                    DeviceInfo(
                        id=loopback["index"],
                        name=short_name,
                        full_name=full_name,
                        max_input_channels=loopback["maxInputChannels"],
                        max_output_channels=0,
                        default_samplerate=loopback["defaultSampleRate"],
                        is_default=is_default,
                    )
                )
        except Exception as e:
            logger.error(f"Error listing system audio devices: {e}")
        finally:
            pa.terminate()
        return devices
