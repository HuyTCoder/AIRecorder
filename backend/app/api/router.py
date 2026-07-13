from fastapi import APIRouter
from app.api import devices, recordings, settings

api_router = APIRouter()
api_router.include_router(devices.router)
api_router.include_router(recordings.router)
api_router.include_router(settings.router)


@api_router.get("/health", tags=["health"])
async def health_check():
    """
    Check the health of the API server.
    """
    return {"status": "ok", "version": "0.1.0", "project": "Voice Note AI"}
