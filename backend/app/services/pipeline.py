import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Literal, Optional, List
from datetime import datetime, timezone
from dataclasses import dataclass, field
from fastapi import BackgroundTasks
from threading import Event, RLock
from uuid import uuid4

from app.services.repository import RecordingRepository
from app.models.recording import RecordingState
from app.services.asr_service import ASRService
from app.services.llm import SummaryService

logger = logging.getLogger(__name__)


class PipelineBusyError(RuntimeError):
    """Raised when another transcription is already queued or running."""


@dataclass
class PipelineTask:
    task_id: str
    session_id: str
    task_type: Literal["transcribe", "summarize"]
    status: Literal["pending", "running", "completed", "failed", "cancelled"]
    started_at: datetime
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
    cancel_event: Event = field(default_factory=Event, repr=False)


class PipelineTaskManager:
    """Background task runner cho STT và Summary. Non-blocking."""

    def __init__(
        self,
        repository: RecordingRepository,
        asr_service: ASRService,
        summary_service: Optional[SummaryService] = None,
    ):
        self.repository = repository
        self.asr_service = asr_service
        self.summary_service = summary_service
        self._tasks = {}  # In-memory store for task states
        self._executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="pipeline"
        )
        self._lock = RLock()

    async def submit(
        self,
        task_type: Literal["transcribe", "summarize"],
        session_id: str,
        background_tasks: BackgroundTasks,
    ) -> PipelineTask:
        # 1. Check and register under one lock so concurrent requests cannot both pass.
        with self._lock:
            if task_type == "transcribe":
                if any(
                    task.task_type == "transcribe" and task.finished_at is None
                    for task in self._tasks.values()
                ):
                    raise PipelineBusyError(
                        "Another transcription is already queued or running"
                    )

            task_id = f"task_{uuid4().hex[:8]}"
            task = PipelineTask(
                task_id=task_id,
                session_id=session_id,
                task_type=task_type,
                status="pending",
                started_at=datetime.now(timezone.utc),
            )
            self._tasks[task_id] = task

        # 2. Update recording state to transcribing/summarizing immediately
        session = self.repository.get(session_id)
        if session:
            if task_type == "transcribe":
                session.state = RecordingState.TRANSCRIBING
            elif task_type == "summarize":
                session.state = RecordingState.SUMMARIZING
            self.repository.save_metadata(session)

        # Queue work on a single worker so GPU transcription never runs concurrently.
        background_tasks.add_task(self._enqueue_task, task_id)

        return task

    def _enqueue_task(self, task_id: str) -> None:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task or task.cancel_event.is_set():
                return
            self._executor.submit(self._run_task, task_id)

    def cancel_transcription(self, session_id: str) -> PipelineTask:
        with self._lock:
            task = next(
                (
                    candidate
                    for candidate in reversed(list(self._tasks.values()))
                    if candidate.session_id == session_id
                    and candidate.task_type == "transcribe"
                    and candidate.finished_at is None
                ),
                None,
            )
            if not task:
                raise ValueError("No active transcription found")

            was_pending = task.status == "pending"
            task.cancel_event.set()
            task.status = "cancelled"
            task.error = "Cancelled by user"

            if was_pending:
                task.finished_at = datetime.now(timezone.utc)

        session = self.repository.get(session_id)
        if session:
            if session.state not in (
                RecordingState.TRANSCRIBED,
                RecordingState.TRANSCRIBED,
                RecordingState.COMPLETED,
                RecordingState.ERROR,
            ):
                session.state = RecordingState.ERROR
                self.repository.save_metadata(session)

        logger.info(
            "Transcription cancellation requested [Session: %s, Task: %s]",
            session_id,
            task.task_id,
        )
        return task

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True)

    def _run_task(self, task_id: str):
        task = self._tasks.get(task_id)
        if not task:
            return

        if task.cancel_event.is_set():
            if task.finished_at is None:
                task.finished_at = datetime.now(timezone.utc)
            return

        task.status = "running"
        logger.info(
            f"{task.task_type.capitalize()} started [Session: {task.session_id}, Task: {task_id}]"
        )

        session = self.repository.get(task.session_id)
        if not session:
            task.status = "failed"
            task.error = "Session not found"
            return

        try:
            if task.task_type == "transcribe":
                transcript = self.asr_service.transcribe(
                    self.repository.get_audio_path(session.id),
                    task.cancel_event,
                )
                if task.cancel_event.is_set():
                    return
                session.transcript = transcript
                self.repository.save_transcript(session.id, session.transcript)
                session.state = RecordingState.TRANSCRIBED
            elif task.task_type == "summarize":
                if self.summary_service is None:
                    raise ValueError("SummaryService is not initialized")

                full_text = " ".join([s.text for s in session.transcript])
                if not full_text.strip():
                    raise ValueError("Cannot summarize an empty transcript")

                result = self.summary_service.summarize(full_text)
                session.summary = result.summary
                session.key_points = result.key_points
                session.action_items = result.action_items

            if task.task_type == "summarize":
                session.state = RecordingState.COMPLETED
            self.repository.save_metadata(session)

            task.status = "completed"
            logger.info(
                f"{task.task_type.capitalize()} completed successfully [Session: {task.session_id}]"
            )
        except Exception as e:
            if task.cancel_event.is_set():
                return
            session.state = RecordingState.ERROR
            session.error_source = task.task_type
            self.repository.save_metadata(session)

            task.status = "failed"
            task.error = str(e)
            logger.error(f"Task {task_id} failed: {e}")
        finally:
            if task.cancel_event.is_set():
                task.status = "cancelled"
            task.finished_at = datetime.now(timezone.utc)

    def get_task(self, task_id: str) -> Optional[PipelineTask]:
        return self._tasks.get(task_id)

    def get_tasks_for_session(self, session_id: str) -> List[PipelineTask]:
        return [t for t in self._tasks.values() if t.session_id == session_id]
