import logging
import dataclasses
from datetime import datetime, timezone
from typing import Optional, List
from uuid import uuid4

from app.models.recording import RecordingSession, RecordingState, AudioConfig
from app.schemas.recording import StartRecordingRequest
from app.services.sources.base import AudioSource
from app.services.sources.microphone import MicrophoneSource
from app.services.sources.system_audio import SystemAudioSource
from app.services.audio_mixer import AudioMixer
from app.services.audio_writer import AudioWriter
from app.services.repository import RecordingRepository

logger = logging.getLogger(__name__)


class ActiveContext:
    def __init__(
        self, session: RecordingSession, source: AudioSource, writer: AudioWriter
    ):
        self.session = session
        self.source = source
        self.writer = writer
        self.paused = False


class RecorderService:
    """Chỉ điều khiển 1 phiên ghi âm đang active. Không biết disk layout."""

    def __init__(self, repository: RecordingRepository, default_config: AudioConfig):
        self.repository = repository
        self.default_config = default_config
        self._active: Optional[ActiveContext] = None

    def start(self, request: StartRecordingRequest) -> RecordingSession:
        if self._active:
            raise ValueError("A recording is already active.")

        config = self.default_config
        if request.sample_rate is not None:
            config = dataclasses.replace(config, sample_rate=request.sample_rate)

        active_sources: List[AudioSource] = []
        if request.use_mic:
            active_sources.append(MicrophoneSource(request.mic_device_id, config))
        if request.use_system:
            active_sources.append(SystemAudioSource(config, request.system_device_id))

        if not active_sources:
            raise ValueError("At least one audio source must be selected.")

        source = (
            active_sources[0]
            if len(active_sources) == 1
            else AudioMixer(
                active_sources,
                config,
                request.gains,
            )
        )

        session_id = f"rec_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:4]}"
        session = RecordingSession(
            id=session_id,
            state=RecordingState.RECORDING,
            created_at=datetime.now(timezone.utc),
            use_mic=request.use_mic,
            use_system=request.use_system,
            config=config,
            title=request.title,
        )

        # Lưu metadata trước để tạo thư mục
        self.repository.save_metadata(session)

        wav_path = self.repository.get_audio_path(session.id)
        writer = AudioWriter(wav_path, config)
        writer.start()

        self._active = ActiveContext(session, source, writer)

        def callback(chunk):
            if self._active and not self._active.paused:
                writer.push(chunk)

        source.start(callback=callback)
        logger.info(
            f"Recording started [Session: {session.id}] (Mic: {request.use_mic}, System: {request.use_system})"
        )
        return session

    def pause(self, session_id: str) -> RecordingSession:
        if not self._active or self._active.session.id != session_id:
            raise ValueError("Session is not active.")

        if self._active.session.state == RecordingState.RECORDING:
            self._active.session.state = RecordingState.PAUSED
            self._active.paused = True
            self.repository.save_metadata(self._active.session)
            logger.info(f"Recording paused [Session: {session_id}]")

        return self._active.session

    def resume(self, session_id: str) -> RecordingSession:
        if not self._active or self._active.session.id != session_id:
            raise ValueError("Session is not active.")

        if self._active.session.state == RecordingState.PAUSED:
            self._active.session.state = RecordingState.RECORDING
            self._active.paused = False
            self.repository.save_metadata(self._active.session)
            logger.info(f"Recording resumed [Session: {session_id}]")

        return self._active.session

    def stop(self, session_id: str) -> RecordingSession:
        if not self._active or self._active.session.id != session_id:
            raise ValueError("Session is not active.")

        self._active.source.stop()
        if hasattr(self._active.source, "close"):
            self._active.source.close()

        duration = self._active.writer.stop_and_finalize()

        session = self._active.session
        session.state = RecordingState.STOPPED
        session.stopped_at = datetime.now(timezone.utc)
        session.duration = duration

        self.repository.save_metadata(session)
        logger.info(
            f"Recording stopped [Session: {session.id}], duration: {duration:.2f}s"
        )
        self._active = None

        return session

    def get_active(self) -> Optional[RecordingSession]:
        return self._active.session if self._active else None
