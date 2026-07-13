import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.api.router import api_router
from app.services.repository import RecordingRepository
from app.services.recorder import RecorderService
from app.services.pipeline import PipelineTaskManager
from app.services.zipformer import ZipformerService
from app.services.llm import SummaryService

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RECORDINGS_DIR = PROJECT_ROOT / "recordings"

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/app.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Initializing Voice Note AI Backend...")
    logger.info(f"Project Name: {settings.PROJECT_NAME}")
    logger.info(f"API Prefix: {settings.API_V1_STR}")
    logger.info(f"CORS Origins: {settings.CORS_ORIGINS}")
    logger.info(f"Recordings directory: {RECORDINGS_DIR}")

    # Initialize Core Services
    app.state.repository = RecordingRepository(base_dir=str(RECORDINGS_DIR))
    recovered_sessions = app.state.repository.recover_interrupted_sessions()
    if recovered_sessions:
        logger.warning(
            "Recovered %s interrupted pipeline session(s)", recovered_sessions
        )
    app.state.recorder_service = RecorderService(
        repository=app.state.repository, default_config=settings.audio_config
    )
    if settings.ASR_ENGINE == "zipformer":
        app.state.asr_service = ZipformerService(
            models_dir=settings.ZIPFORMER_MODEL_DIR,
            num_threads=settings.ZIPFORMER_NUM_THREADS,
        )
    else:
        raise ValueError(f"Unsupported ASR_ENGINE: {settings.ASR_ENGINE}")
    app.state.summary_service = SummaryService()
    app.state.pipeline_manager = PipelineTaskManager(
        repository=app.state.repository,
        asr_service=app.state.asr_service,
        summary_service=app.state.summary_service,
    )

    yield

    # Shutdown actions
    logger.info("Shutting down Voice Note AI Backend...")
    app.state.pipeline_manager.shutdown()
    active = app.state.recorder_service.get_active()
    if active:
        logger.info(f"Stopping active recording session {active.id} on shutdown")
        try:
            app.state.recorder_service.stop(active.id)
        except Exception as e:
            logger.error(f"Error stopping active recording: {e}")


app = FastAPI(title=settings.PROJECT_NAME, version="0.1.0", lifespan=lifespan)

# Set CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include central router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} Backend API",
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_STR}/health",
    }


# --- Global Error Handlers ---


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.error(f"HTTP error occurred: {exc.detail} (Status code: {exc.status_code})")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {"code": exc.status_code, "message": exc.detail},
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error occurred: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "message": "Validation error",
                "details": exc.errors(),
            },
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error occurred: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "message": "Internal server error",
                "details": str(exc)
                if settings.DEBUG
                else "An unexpected error occurred.",
            },
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
