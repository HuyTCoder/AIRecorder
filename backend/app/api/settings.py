from fastapi import APIRouter

from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.core.settings_manager import SettingsManager

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
def get_settings():
    """Retrieve application settings."""
    return SettingsManager.get_settings()


@router.post("", response_model=SettingsResponse)
def update_settings(updates: SettingsUpdate):
    """Update application settings."""
    return SettingsManager.update_settings(updates)
