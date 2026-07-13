from fastapi import APIRouter, Query
from typing import List, Dict
from app.services.sources.microphone import MicrophoneSource
from app.services.sources.system_audio import SystemAudioSource
from app.models.recording import DeviceInfo

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("")
async def list_devices(
    advanced: bool = Query(
        False, description="Hiện toàn bộ thiết bị, bao gồm thiết bị ảo và alias"
    ),
) -> Dict[str, List[DeviceInfo]]:
    mic_devices = MicrophoneSource.list_devices(advanced=advanced)
    sys_devices = SystemAudioSource.list_devices(advanced=advanced)

    return {"microphones": mic_devices, "system_audio": sys_devices}
