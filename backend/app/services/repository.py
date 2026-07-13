import json
import logging
import re
import shutil
import os
from typing import List, Optional
from pathlib import Path
from datetime import datetime
from app.models.recording import (
    RecordingSession,
    RecordingState,
    AudioConfig,
    TranscriptSegment,
)

logger = logging.getLogger(__name__)
SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


class RecordingRepository:
    """Quản lý tất cả bản ghi đã lưu trên disk. Không biết audio driver."""

    def __init__(self, base_dir: str = "recordings"):
        path = Path(base_dir)
        if not path.is_absolute():
            backend_root = Path(__file__).parent.parent.parent
            self.base_dir = backend_root / path
        else:
            self.base_dir = path

        self.base_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def validate_session_id(session_id: str) -> None:
        """Reject path separators and traversal before building a disk path."""
        if not SESSION_ID_PATTERN.fullmatch(session_id):
            raise ValueError("Invalid recording ID")

    def _candidate_session_dirs(self, session_id: str) -> List[Path]:
        self.validate_session_id(session_id)
        candidates = [self.base_dir / session_id]

        if self.base_dir.name == "recordings":
            candidates.extend(
                [
                    self.base_dir.parent / "backend" / "recordings" / session_id,
                    self.base_dir.parent / "recordings" / session_id,
                    Path.cwd() / "recordings" / session_id,
                    Path.cwd() / "backend" / "recordings" / session_id,
                ]
            )

        return [p for p in candidates if p is not None]

    def _get_session_dir(self, session_id: str) -> Path:
        for candidate in self._candidate_session_dirs(session_id):
            if candidate.exists():
                return candidate
        return self.base_dir / session_id

    def _get_metadata_path(self, session_id: str) -> Path:
        return self._get_session_dir(session_id) / "metadata.json"

    def get_audio_path(self, session_id: str) -> Path:
        return self._get_session_dir(session_id) / "recording.wav"

    def get_transcript_path(self, session_id: str) -> Path:
        return self._get_session_dir(session_id) / "transcript.json"

    def save_transcript(
        self, session_id: str, transcript: List[TranscriptSegment]
    ) -> None:
        path = self.get_transcript_path(session_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "recording_id": session_id,
            "text": " ".join(segment.text for segment in transcript),
            "segments": [
                {
                    "id": segment.id,
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text,
                    "speaker": segment.speaker,
                }
                for segment in transcript
            ],
        }
        temporary_path = path.with_suffix(".tmp")
        with open(temporary_path, "w", encoding="utf-8") as file:
            json.dump(data, file, indent=2)
        temporary_path.replace(path)

    def load_transcript(self, session_id: str) -> Optional[List[TranscriptSegment]]:
        path = self.get_transcript_path(session_id)
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as file:
                data = json.load(file)
            return [
                TranscriptSegment(**segment) for segment in data.get("segments", [])
            ]
        except (OSError, json.JSONDecodeError, TypeError, ValueError) as error:
            logger.error("Error loading transcript for %s: %s", session_id, error)
            return None

    def save_metadata(self, session: RecordingSession) -> None:
        path = self._get_metadata_path(session.id)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "id": session.id,
            "title": session.title,
            "state": session.state.value,
            "created_at": session.created_at.isoformat()
            if session.created_at
            else None,
            "use_mic": session.use_mic,
            "use_system": session.use_system,
            "stopped_at": session.stopped_at.isoformat()
            if session.stopped_at
            else None,
            "duration": session.duration,
            # Transcript is persisted in transcript.json and intentionally omitted here
            # to keep metadata.json lightweight for fast listing.
            "transcript": [],
            "summary": session.summary,
            "key_points": session.key_points,
            "action_items": session.action_items,
            "error_source": session.error_source,
            "config": {
                "sample_rate": session.config.sample_rate,
                "channels": session.config.channels,
                "chunk_size": session.config.chunk_size,
                "dtype": session.config.dtype,
            },
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def load_metadata(
        self, session_id: str, include_transcript: bool = True
    ) -> Optional[RecordingSession]:
        path = self._get_metadata_path(session_id)
        if not path.exists():
            return None

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            config_data = data.get("config", {})
            config = AudioConfig(
                sample_rate=config_data.get("sample_rate", 16000),
                channels=config_data.get("channels", 1),
                chunk_size=config_data.get("chunk_size", 1024),
                dtype=config_data.get("dtype", "int16"),
            )

            transcript: List[TranscriptSegment] = []
            if include_transcript:
                transcript = self.load_transcript(session_id) or []
                if not transcript:
                    # Backward compatibility for legacy metadata that still embeds transcript.
                    transcript_data = data.get("transcript", [])
                    transcript = [
                        TranscriptSegment(**segment) for segment in transcript_data
                    ]

            created_at = data.get("created_at")
            stopped_at = data.get("stopped_at")

            return RecordingSession(
                id=data["id"],
                title=data.get("title"),
                state=RecordingState(data["state"]),
                created_at=datetime.fromisoformat(created_at)
                if created_at
                else datetime.now(),
                use_mic=data["use_mic"],
                use_system=data["use_system"],
                config=config,
                stopped_at=datetime.fromisoformat(stopped_at) if stopped_at else None,
                duration=data.get("duration"),
                transcript=transcript,
                summary=data.get("summary"),
                key_points=data.get("key_points", []),
                action_items=data.get("action_items", []),
                error_source=data.get("error_source"),
            )
        except Exception as e:
            logger.error(f"Error loading metadata for {session_id}: {e}")
            return None

    def get(
        self, session_id: str, include_transcript: bool = True
    ) -> Optional[RecordingSession]:
        return self.load_metadata(session_id, include_transcript=include_transcript)

    def list(self, include_transcript: bool = False) -> List[RecordingSession]:
        sessions = []
        if not self.base_dir.exists():
            return sessions

        # Sắp xếp thư mục theo thời gian tạo, mới nhất lên đầu
        directories = [d for d in self.base_dir.iterdir() if d.is_dir()]
        directories.sort(key=lambda x: os.path.getmtime(x), reverse=True)

        for d in directories:
            session = self.load_metadata(d.name, include_transcript=include_transcript)
            if session:
                sessions.append(session)
        return sessions

    def recover_interrupted_sessions(self) -> int:
        recovered = 0
        for session in self.list(include_transcript=False):
            if session.state not in (
                RecordingState.TRANSCRIBING,
                RecordingState.SUMMARIZING,
            ):
                continue

            session.state = RecordingState.ERROR
            self.save_metadata(session)
            recovered += 1
            logger.warning(
                "Marked interrupted pipeline session as error [Session: %s]",
                session.id,
            )

        return recovered

    def delete(self, session_id: str) -> None:
        self.validate_session_id(session_id)
        path = self.base_dir / session_id
        if path.exists() and path.is_dir():
            shutil.rmtree(path)
            logger.info(f"Deleted recording {session_id}")
