import os
import sys
import io
import wave
from fastapi.testclient import TestClient

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

def create_dummy_wav(sample_rate=16000, channels=1, duration_sec=2) -> bytes:
    """Tạo byte file WAV giả để test"""
    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2) # 16-bit
        wf.setframerate(sample_rate)
        
        # 16000 samples/sec * 2 seconds = 32000 samples
        # Mỗi sample là 2 byte (int16)
        dummy_data = b"\x00" * (sample_rate * channels * 2 * duration_sec)
        wf.writeframes(dummy_data)
        
    return wav_io.getvalue()

def test_upload_wav_success():
    client = TestClient(app)
    
    # Chuẩn bị dữ liệu file WAV giả
    wav_bytes = create_dummy_wav(sample_rate=16000, channels=1, duration_sec=5)
    
    # Gọi endpoint upload
    with client as c:
        response = c.post(
            "/api/v1/recordings/upload",
            files={"file": ("test_recording.wav", wav_bytes, "audio/wav")},
            data={"title": "Test Upload Audio Title"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Upload Audio Title"
        assert data["state"] == "stopped"
        assert abs(data["duration"] - 5.0) < 0.1
        
        # Kiểm tra file đã lưu trong thư mục recordings
        session_id = data["id"]
        repo = app.state.repository
        audio_path = repo.get_audio_path(session_id)
        metadata_path = repo._get_metadata_path(session_id)
        
        assert audio_path.exists()
        assert metadata_path.exists()
        assert audio_path.stat().st_size == len(wav_bytes)
        
        # Dọn dẹp
        repo.delete(session_id)
        print("\n[PASSED] Test upload WAV success. Session cleaned up.")

if __name__ == "__main__":
    test_upload_wav_success()
