import json
from pathlib import Path
from app.schemas.settings import SettingsResponse, SettingsUpdate, StoredSettings

SETTINGS_FILE = Path(__file__).parent.parent.parent / "settings.json"


class SettingsManager:
    """Manages application settings persisted in a JSON file."""

    @classmethod
    def get_settings(cls) -> SettingsResponse:
        stored = cls.get_runtime_settings()
        return SettingsResponse(**stored.model_dump())

    @classmethod
    def get_runtime_settings(cls) -> StoredSettings:
        if not SETTINGS_FILE.exists():
            return StoredSettings()

        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)

                # Migrate old api_key to gemini_api_key if needed
                if "api_key" in data and "gemini_api_key" not in data:
                    data["gemini_api_key"] = data["api_key"]

                return StoredSettings(**data)
        except Exception:
            return StoredSettings()

    @classmethod
    def update_settings(cls, updates: SettingsUpdate) -> SettingsResponse:
        current = cls.get_runtime_settings()
        update_data = updates.model_dump(exclude_unset=True)

        # Merge updates
        for key, value in update_data.items():
            if hasattr(current, key):
                setattr(current, key, value)

        # Save to file
        try:
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(current.model_dump(), f, ensure_ascii=False, indent=2)
        except Exception as e:
            raise RuntimeError(f"Could not save settings: {e}")

        return SettingsResponse(**current.model_dump())
