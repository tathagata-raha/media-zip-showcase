import os
from pathlib import Path
from typing import Optional

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings

class Settings(BaseSettings):
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    # File Upload Configuration
    MAX_FILE_SIZE: int = 2 * 1024 * 1024 * 1024  # 2GB
    MAX_EXTRACTED_SIZE: int = 1024 * 1024 * 1024  # 1GB extracted content limit
    ALLOWED_IMAGE_FORMATS: list = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    ALLOWED_VIDEO_FORMATS: list = ['.mp4', '.webm', '.avi', '.mov', '.mkv']
    ALLOWED_AUDIO_FORMATS: list = ['.mp3', '.wav', '.ogg', '.aac', '.flac']
    
    # Session Configuration
    MEDIA_SESSION_TTL: int = 30 * 24 * 60 * 60  # 30 days in seconds
    METADATA_SESSION_TTL: int = 30 * 24 * 60 * 60  # 30 days in seconds
    
    # Slideshow Configuration
    DEFAULT_IMAGE_DURATION: float = 3.0  # seconds
    DEFAULT_RESOLUTION: tuple = (1280, 720)
    DEFAULT_TRANSITION_EFFECT: str = "fade"
    AVAILABLE_TRANSITIONS: list = ["none", "fade", "crossfade"]
    MAX_SLIDESHOW_IMAGES: int = 30  # Maximum number of images to use in slideshow
    
    # Paths
    BASE_DIR: Path = Path(__file__).parent
    STATIC_DIR: Path = BASE_DIR / "static"
    MEDIA_DIR: Path = STATIC_DIR / "media"
    SESSIONS_DIR: Path = BASE_DIR / "sessions"
    
    # Security
    MAX_IMAGES_PER_SESSION: int = 100
    MAX_VIDEOS_PER_SESSION: int = 20
    MAX_FILES_PER_ZIP: int = 200
    
    # Download Configuration
    DOWNLOAD_TIMEOUT: int = 300  # 5 minutes
    MAX_DOWNLOAD_SIZE: int = 2 * 1024 * 1024 * 1024  # 2GB
    
    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    # Rate Limiting
    RATE_LIMIT_UPLOADS: str = "5/minute"  # 5 uploads per minute per IP
    RATE_LIMIT_LINKS: str = "10/minute"  # 10 link submissions per minute per IP
    
    class Config:
        env_file = ".env"

# Create global settings instance
settings = Settings()

# Parse CORS origins from comma-separated string
def get_cors_origins() -> list:
    """Parse CORS origins from comma-separated string"""
    return [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

# Ensure directories exist
def ensure_directories():
    """Create necessary directories if they don't exist."""
    directories = [
        settings.STATIC_DIR,
        settings.MEDIA_DIR,
        settings.SESSIONS_DIR
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

# Initialize directories
ensure_directories() 