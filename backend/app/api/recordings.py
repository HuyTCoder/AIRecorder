from typing import Annotated, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, status, UploadFile, File, Form
from fastapi.responses import FileResponse
import logging
import io
import wave
import uuid
from datetime import datetime, timezone

from app.schemas.recording import (
    StartRecordingRequest,
    UpdateRecordingRequest,
    RecordingResponse,
    TaskResponse,
    TranscriptResponse,
    SummaryResponse,
    TranscriptSegmentSchema,
)
from app.models.recording import RecordingState, RecordingSession, AudioConfig
from app.services.recorder import RecorderService
from app.services.repository import RecordingRepository
from app.services.pipeline import PipelineBusyError, PipelineTaskManager
from app.api.deps import get_recorder_service, get_repository, get_pipeline_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recordings", tags=["recordings"])
SessionId = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]+$")]


def _to_response(session, include_transcript: bool = True) -> RecordingResponse:
    return RecordingResponse(
        id=session.id,
        title=session.title or "Bản ghi âm mới",
        state=session.state,
        source_type=session.source_type,
        use_mic=session.use_mic,
        use_system=session.use_system,
        created_at=session.created_at,
        duration=session.duration,
        transcript=[
            {"id": s.id, "start": s.start, "end": s.end, "text": s.text}
            for s in session.transcript
        ]
        if include_transcript
        else [],
        summary=session.summary,
        key_points=session.key_points,
        action_items=session.action_items,
        error_source=session.error_source,
    )


@router.post("", response_model=RecordingResponse, status_code=status.HTTP_201_CREATED)
async def start_recording(
    request: StartRecordingRequest,
    recorder: RecorderService = Depends(get_recorder_service),
):
    try:
        session = recorder.start(request)
        return _to_response(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting recording: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/upload", response_model=RecordingResponse, status_code=status.HTTP_201_CREATED)
async def upload_recording(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    repo: RecordingRepository = Depends(get_repository),
):
    """
    Nhập một file âm thanh (đã được Frontend chuẩn hoá sang WAV 16kHz mono 16bit) từ bên ngoài.
    """
    # Sinh ID cho session mới
    session_id = f"rec_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"
    
    # Đọc dữ liệu file
    file_bytes = await file.read()
    
    # Đoán và trích xuất cấu hình thực tế từ file WAV để lấy thời lượng và các thuộc tính khác
    duration = 0.0
    audio_config = AudioConfig()
    try:
        with wave.open(io.BytesIO(file_bytes), "rb") as wf:
            channels = wf.getnchannels()
            sample_rate = wf.getframerate()
            sampwidth = wf.getsampwidth()
            n_frames = wf.getnframes()
            duration = n_frames / sample_rate
            
            audio_config = AudioConfig(
                sample_rate=sample_rate,
                channels=channels,
                dtype="int16" if sampwidth == 2 else ("int32" if sampwidth == 4 else "int8")
            )
    except Exception as e:
        logger.warning(f"Failed to parse WAV header from uploaded file: {e}. Falling back to default settings.")
        # Dùng thông số mặc định nếu có lỗi đọc header
        duration = len(file_bytes) / 32000
        
    session = RecordingSession(
        id=session_id,
        state=RecordingState.STOPPED,
        created_at=datetime.now(timezone.utc),
        use_mic=True,
        use_system=False,
        duration=duration,
        title=title or file.filename or "Bản ghi âm nhập từ file",
        config=audio_config
    )
    
    # Tạo thư mục lưu trữ bản ghi
    session_dir = repo._get_session_dir(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)
    
    # Lưu file âm thanh
    audio_path = repo.get_audio_path(session_id)
    with open(audio_path, "wb") as f:
        f.write(file_bytes)
        
    # Ghi metadata.json
    repo.save_metadata(session)
    
    logger.info(f"Successfully uploaded audio file to session: {session_id}, duration: {duration:.2f}s")
    
    return _to_response(session)


@router.get("", response_model=List[RecordingResponse])
async def list_recordings(repo: RecordingRepository = Depends(get_repository)):
    sessions = repo.list(include_transcript=False)
    return [_to_response(s, include_transcript=False) for s in sessions]


@router.get("/{session_id}", response_model=RecordingResponse)
async def get_recording(
    session_id: SessionId, repo: RecordingRepository = Depends(get_repository)
):
    session = repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Recording not found")
    return _to_response(session)


@router.patch("/{session_id}", response_model=RecordingResponse)
async def update_recording(
    session_id: SessionId,
    request: UpdateRecordingRequest,
    repo: RecordingRepository = Depends(get_repository),
):
    session = repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Recording not found")

    session.title = request.title
    repo.save_metadata(session)
    return _to_response(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recording(
    session_id: SessionId,
    repo: RecordingRepository = Depends(get_repository),
    recorder: RecorderService = Depends(get_recorder_service),
):
    active = recorder.get_active()
    if active and active.id == session_id:
        try:
            recorder.stop(session_id)
        except Exception as e:
            logger.warning(f"Error stopping active recording before delete: {e}")

    session = repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Recording not found")

    repo.delete(session_id)


@router.post("/{session_id}/pause", response_model=RecordingResponse)
async def pause_recording(
    session_id: SessionId, recorder: RecorderService = Depends(get_recorder_service)
):
    try:
        session = recorder.pause(session_id)
        return _to_response(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{session_id}/resume", response_model=RecordingResponse)
async def resume_recording(
    session_id: SessionId, recorder: RecorderService = Depends(get_recorder_service)
):
    try:
        session = recorder.resume(session_id)
        return _to_response(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{session_id}/stop", response_model=RecordingResponse)
async def stop_recording(
    session_id: SessionId, recorder: RecorderService = Depends(get_recorder_service)
):
    try:
        session = recorder.stop(session_id)
        return _to_response(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{session_id}/stream")
async def stream_recording(
    session_id: SessionId, repo: RecordingRepository = Depends(get_repository)
):
    session = repo.get(session_id)
    if not session:
        logger.warning(f"Stream requested for non-existent session: {session_id}")
        raise HTTPException(status_code=404, detail="Recording not found")

    wav_path = repo.get_audio_path(session_id)
    logger.info(
        f"Stream request for session={session_id}, wav_path={wav_path}, exists={wav_path.exists()}"
    )

    if not wav_path.exists():
        logger.error(f"Audio file missing for session={session_id} at {wav_path}")
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(wav_path, media_type="audio/wav")


@router.post(
    "/{session_id}/transcribe",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def transcribe_recording(
    session_id: SessionId,
    background_tasks: BackgroundTasks,
    repo: RecordingRepository = Depends(get_repository),
    pipeline: PipelineTaskManager = Depends(get_pipeline_manager),
):
    session = repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Recording not found")

    if session.state not in (
        RecordingState.STOPPED,
        RecordingState.COMPLETED,
        RecordingState.ERROR,
    ):
        raise HTTPException(
            status_code=400, detail="Recording must be stopped before transcribing"
        )
    if not repo.get_audio_path(session_id).is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")

    try:
        task = await pipeline.submit("transcribe", session_id, background_tasks)
    except PipelineBusyError as error:
        raise HTTPException(status_code=409, detail=str(error))
    return TaskResponse(
        task_id=task.task_id,
        session_id=task.session_id,
        task_type=task.task_type,
        status=task.status,
    )


@router.post("/{session_id}/transcribe/cancel", response_model=TaskResponse)
async def cancel_transcription(
    session_id: SessionId,
    pipeline: PipelineTaskManager = Depends(get_pipeline_manager),
):
    try:
        task = pipeline.cancel_transcription(session_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))

    return TaskResponse(
        task_id=task.task_id,
        session_id=task.session_id,
        task_type=task.task_type,
        status=task.status,
    )


@router.post(
    "/{session_id}/summarize",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def summarize_recording(
    session_id: SessionId,
    background_tasks: BackgroundTasks,
    repo: RecordingRepository = Depends(get_repository),
    pipeline: PipelineTaskManager = Depends(get_pipeline_manager),
):
    session = repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Recording not found")

    task = await pipeline.submit("summarize", session_id, background_tasks)
    return TaskResponse(
        task_id=task.task_id,
        session_id=task.session_id,
        task_type=task.task_type,
        status=task.status,
    )


@router.get("/{session_id}/transcript", response_model=TranscriptResponse)
async def get_recording_transcript(
    session_id: SessionId, repo: RecordingRepository = Depends(get_repository)
):
    session = repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Recording not found")
    if not session.transcript:
        # Return empty structure instead of 404 to match frontend fallback or return a blank response
        return TranscriptResponse(recording_id=session_id, text="", segments=[])

    full_text = " ".join([s.text for s in session.transcript])
    return TranscriptResponse(
        recording_id=session_id,
        text=full_text,
        segments=[
            TranscriptSegmentSchema(id=s.id, start=s.start, end=s.end, text=s.text, speaker=s.speaker)
            for s in session.transcript
        ],
    )


@router.get("/{session_id}/summary", response_model=SummaryResponse)
async def get_recording_summary(
    session_id: SessionId, repo: RecordingRepository = Depends(get_repository)
):
    session = repo.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Recording not found")
    if not session.summary:
        raise HTTPException(status_code=404, detail="Summary not yet available")

    return SummaryResponse(
        recording_id=session_id,
        summary=session.summary,
        key_points=session.key_points,
        action_items=session.action_items,
    )
