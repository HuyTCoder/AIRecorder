import asyncio
import os
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.recording import AudioConfig
from app.services.repository import RecordingRepository
from app.services.recorder import RecorderService
from app.services.pipeline import PipelineTaskManager
from app.services.asr_service import ASRService
from app.schemas.recording import StartRecordingRequest
from fastapi import BackgroundTasks

class DummyASR(ASRService):
    def transcribe(self, audio_path, cancel_event=None):
        from app.models.recording import TranscriptSegment
        return [TranscriptSegment(id=0, start=0.0, end=1.0, text="Test transcript")]

class DummySummary:
    def summarize(self, text):
        from app.services.llm import SummaryResult
        return SummaryResult(summary="Test summary", key_points=["kp1"], action_items=["ai1"])

async def main():
    print("=== Testing Repository ===")
    base_dir = Path("recordings_scratch_test")
    repo = RecordingRepository(base_dir=str(base_dir))
    print("Repository created.")

    print("=== Testing RecorderService & AudioWriter ===")
    # Construct RecorderService with repository and default config
    audio_config = AudioConfig()
    svc = RecorderService(repository=repo, default_config=audio_config)
    
    # Use StartRecordingRequest to start
    req = StartRecordingRequest(use_mic=True, use_system=False, title="E2E Test Session")
    session = svc.start(req)
    print(f"Recording started. ID: {session.id}, State: {session.state}")
    
    # Wait for some audio to be 'written'
    time.sleep(2)
    session = svc.stop(session.id)
    print(f"Recording stopped. ID: {session.id}, State: {session.state}, Duration: {session.duration}")
    
    print("=== Check if WAV file is created correctly ===")
    wav_path = repo.get_audio_path(session.id)
    if wav_path.exists() and wav_path.stat().st_size > 0:
        print(f"WAV file created successfully: {wav_path} (Size: {wav_path.stat().st_size} bytes)")
    else:
        print("WAV file missing or empty!")

    print("=== Testing Pipeline ===")
    pipeline = PipelineTaskManager(repo, DummyASR(), DummySummary())
    task = await pipeline.submit("transcribe", session.id, BackgroundTasks())
    print(f"Pipeline transcribe task submitted: {task.task_id}")
    
    # Process it synchronously for the test
    pipeline._run_task(task.task_id)
    updated = repo.get(session.id)
    print(f"Post-transcribe state: {updated.state}")
    print(f"Transcript generated: {updated.transcript[0].text if updated.transcript else 'None'}")
    
    task2 = await pipeline.submit("summarize", session.id, BackgroundTasks())
    print(f"Pipeline summarize task submitted: {task2.task_id}")
    pipeline._run_task(task2.task_id)
    updated = repo.get(session.id)
    print(f"Post-summarize state: {updated.state}")
    print(f"Summary generated: {updated.summary}")
    
    # Cleanup
    import shutil
    shutil.rmtree(base_dir)
    print("Test cleanup completed.")

if __name__ == "__main__":
    asyncio.run(main())
