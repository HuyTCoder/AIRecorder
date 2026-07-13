from abc import ABC, abstractmethod
from pathlib import Path
from threading import Event
from typing import Optional

from app.models.recording import TranscriptSegment


class ASRService(ABC):
    """Abstract base class for ASR backends."""

    @abstractmethod
    def transcribe(
        self,
        audio_path: Path,
        cancel_event: Optional[Event] = None,
    ) -> list[TranscriptSegment]:
        """
        Transcribes the given audio file.

        Args:
            audio_path: Path to the audio file.
            cancel_event: Event to signal cancellation.

        Returns:
            List of TranscriptSegment objects.
        """
        pass
