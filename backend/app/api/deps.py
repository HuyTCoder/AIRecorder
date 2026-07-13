from fastapi import Request
from app.services.recorder import RecorderService
from app.services.repository import RecordingRepository
from app.services.pipeline import PipelineTaskManager


def get_recorder_service(request: Request) -> RecorderService:
    return request.app.state.recorder_service


def get_repository(request: Request) -> RecordingRepository:
    return request.app.state.repository


def get_pipeline_manager(request: Request) -> PipelineTaskManager:
    return request.app.state.pipeline_manager
