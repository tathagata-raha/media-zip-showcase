from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from pathlib import Path

class SessionStatus(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"

class SourceType(str, Enum):
    UPLOAD = "upload"
    URL = "url"
    GOOGLE_DRIVE = "google_drive"

class TransitionEffect(str, Enum):
    NONE = "none"
    FADE = "fade"
    CROSSFADE = "crossfade"

class SlideshowOptions(BaseModel):
    image_duration: float = Field(default=3.0, ge=0.5, le=10.0, description="Duration per image in seconds")
    transition_effect: TransitionEffect = Field(default=TransitionEffect.FADE, description="Transition effect between images")
    resolution: tuple = Field(default=(1280, 720), description="Output video resolution (width, height)")
    background_music: Optional[str] = Field(default=None, description="Background music file path if present in ZIP")

class SessionMetadata(BaseModel):
    session_id: str
    source_type: SourceType
    source_url: Optional[str] = None
    submitted_at: datetime
    expires_at: datetime
    metadata_expires_at: datetime
    status: SessionStatus
    error_message: Optional[str] = None
    slideshow_options: Optional[SlideshowOptions] = None
    manifest: Optional[Dict[str, Any]] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class MediaFile(BaseModel):
    filename: str
    file_path: str
    file_type: str  # "image", "video", "audio"
    file_size: int
    dimensions: Optional[tuple] = None  # (width, height) for images/videos
    duration: Optional[float] = None  # for videos/audio

class SessionManifest(BaseModel):
    session_id: str
    images: List[MediaFile] = []
    videos: List[MediaFile] = []
    audio_files: List[MediaFile] = []
    slideshow_video: Optional[str] = None
    total_files: int = 0
    total_size: int = 0
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class UploadRequest(BaseModel):
    source_type: SourceType
    source_url: Optional[str] = None
    slideshow_options: Optional[SlideshowOptions] = None

class SessionResponse(BaseModel):
    session_id: str
    status: SessionStatus
    submitted_at: datetime
    expires_at: datetime
    manifest: Optional[SessionManifest] = None
    error_message: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class StatusResponse(BaseModel):
    session_id: str
    status: SessionStatus
    progress: Optional[float] = None  # 0.0 to 1.0
    message: Optional[str] = None
    error_message: Optional[str] = None 