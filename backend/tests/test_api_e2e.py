import time
import requests
import os

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_e2e():
    print("1. Checking Health / Devices")
    res = requests.get(f"{BASE_URL}/devices")
    assert res.status_code == 200, "Devices API failed"
    data = res.json()
    mic_device = data["microphones"][0] if data["microphones"] else None
    mic_id = mic_device["id"] if mic_device else None
    sys_id = data["system_audio"][0]["id"] if data["system_audio"] else None
    sample_rate = mic_device["default_samplerate"] if mic_device else 48000
    
    print(f"   Found mic_id: {mic_id}, sys_id: {sys_id}, sr: {sample_rate}")

    print("2. Starting Recording (API)")
    res = requests.post(f"{BASE_URL}/recordings", json={
        "use_mic": True,
        "use_system": False,
        "mic_device_id": mic_id or 0,
        "sample_rate": int(sample_rate),
        "title": "E2E Test Recording"
    })
    assert res.status_code == 201, f"Start recording failed: {res.text}"
    rec_id = res.json()["id"]
    print(f"   Recording started: {rec_id}")

    print("3. Wait 3 seconds...")
    time.sleep(3)

    print("4. Stopping Recording (API)")
    res = requests.post(f"{BASE_URL}/recordings/{rec_id}/stop")
    assert res.status_code == 200, "Stop recording failed"
    print(f"   Recording stopped. Duration: {res.json()['duration']}s")

    print("5. Checking if WAV file is properly created")
    # Check the file in the recordings dir at workspace root
    wav_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "recordings", rec_id, "recording.wav")
    assert os.path.exists(wav_path), "WAV file does not exist!"
    size = os.path.getsize(wav_path)
    assert size > 0, "WAV file is empty!"
    print(f"   WAV file exists and size is {size} bytes.")

    print("6. Testing Stream Endpoint")
    res = requests.get(f"{BASE_URL}/recordings/{rec_id}/stream", stream=True)
    assert res.status_code == 200, "Stream endpoint failed"
    print("   Stream endpoint OK. Content-Type:", res.headers.get("content-type"))

    print("7. Testing Pipeline (Transcribe)")
    res = requests.post(f"{BASE_URL}/recordings/{rec_id}/transcribe")
    assert res.status_code == 202, "Transcribe submit failed"
    
    print("   Waiting for transcription to complete...")
    for _ in range(15):
        res = requests.get(f"{BASE_URL}/recordings/{rec_id}")
        state = res.json()["state"]
        if state == "stopped" or state == "error":
            break
        time.sleep(1)
        
    print(f"   Transcription finished with state: {state}")
    
    # Check transcript
    res = requests.get(f"{BASE_URL}/recordings/{rec_id}/transcript")
    print(f"   Transcript text: {res.json().get('text')}")

    print("E2E API Test Completed Successfully!")

if __name__ == "__main__":
    try:
        test_e2e()
    except Exception as e:
        print(f"TEST FAILED: {e}")
