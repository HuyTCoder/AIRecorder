from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.recording import RecordingState


class StartRecordingRequest(BaseModel):
    use_mic: bool = True
    use_system: bool = False
    mic_device_id: Optional[int] = None
    system_device_id: Optional[int] = None
    gains: Optional[List[float]] = None
    sample_rate: Optional[int] = None
    title: Optional[str] = None


class UpdateRecordingRequest(BaseModel):
    title: str


class TranscriptSegmentSchema(BaseModel):
    id: int
    start: float
    end: float
    text: str
    speaker: Optional[str] = None


class RecordingResponse(BaseModel):
    id: str
    title: Optional[str] = None
    state: RecordingState
    source_type: str
    use_mic: bool
    use_system: bool
    created_at: datetime
    duration: Optional[float] = None
    transcript: List[TranscriptSegmentSchema] = []
    summary: Optional[str] = None
    key_points: List[str] = []
    action_items: List[str] = []
    error_source: Optional[str] = None


class TaskResponse(BaseModel):
    task_id: str
    session_id: str
    task_type: str
    status: str


class TranscriptResponse(BaseModel):
    recording_id: str
    text: str
    segments: List[TranscriptSegmentSchema]


class SummaryResponse(BaseModel):
    recording_id: str
    summary: str
    key_points: List[str]
    action_items: List[str]
