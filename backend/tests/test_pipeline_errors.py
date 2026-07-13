import asyncio
import os
import sys
import shutil
from pathlib import Path
from fastapi import BackgroundTasks

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.recording import AudioConfig, RecordingState
from app.services.repository import RecordingRepository
from app.services.pipeline import PipelineTaskManager

class MockASRSuccess:
    def transcribe(self, audio_path, cancel_event=None):
        from app.models.recording import TranscriptSegment
        return [TranscriptSegment(id=0, start=0.0, end=1.0, text="Mock text")]

class MockASRFail:
    def transcribe(self, audio_path, cancel_event=None):
        raise RuntimeError("ASR Connection Failed")

class MockSummarySuccess:
    def summarize(self, text):
        from app.services.llm import SummaryResult
        return SummaryResult(summary="Mock summary", key_points=[], action_items=[])

class MockSummaryFail:
    def summarize(self, text):
        raise RuntimeError("LLM Token Limit Exceeded")

async def run_scenario(name, asr, summary):
    print(f"\n{'='*40}")
    print(f"RUNNING SCENARIO: {name}")
    print(f"{'='*40}")
    
    # Strip spaces and dots for the folder name
    folder_name = name.replace(' ', '_').replace('.', '')
    fixtures_dir = Path(__file__).parent / "fixtures"
    base_dir = fixtures_dir / f"recordings_test_{folder_name}"
    if base_dir.exists():
        shutil.rmtree(base_dir)
        
    repo = RecordingRepository(base_dir=str(base_dir))
    
    # 1. Create a fake completed recording
    import uuid
    from datetime import datetime, timezone
    from app.models.recording import RecordingSession
    session_id = str(uuid.uuid4())
    session = RecordingSession(
        id=session_id,
        state=RecordingState.STOPPED,
        created_at=datetime.now(timezone.utc),
        use_mic=True,
        use_system=False,
        config=AudioConfig()
    )
    repo.save_metadata(session)
    print(f"[Init] Session created: {session.id}, State: {session.state}")
    
    pipeline = PipelineTaskManager(repo, asr, summary)
    
    # 2. Transcribe
    task1 = await pipeline.submit("transcribe", session.id, BackgroundTasks())
    print(f"[Transcribe] Task submitted: {task1.task_id}")
    pipeline._run_task(task1.task_id) # Run synchronously
    
    session = repo.get(session.id)
    print(f"[Transcribe] End State: {session.state.value}")
    print(f"[Transcribe] Error Source: {session.error_source}")
    
    if session.state != RecordingState.TRANSCRIBED:
        print("[Abort] Cannot summarize because transcribe failed.")
        return
        
    # 3. Summarize
    task2 = await pipeline.submit("summarize", session.id, BackgroundTasks())
    print(f"[Summarize] Task submitted: {task2.task_id}")
    pipeline._run_task(task2.task_id)
    
    session = repo.get(session.id)
    print(f"[Summarize] End State: {session.state.value}")
    print(f"[Summarize] Error Source: {session.error_source}")

async def main():
    await run_scenario(
        "1. Success both",
        MockASRSuccess(),
        MockSummarySuccess()
    )
    
    await run_scenario(
        "2. Transcription Error",
        MockASRFail(),
        MockSummarySuccess()
    )
    
    await run_scenario(
        "3. Transcribe Success but Summary Error",
        MockASRSuccess(),
        MockSummaryFail()
    )

if __name__ == "__main__":
    asyncio.run(main())
