import os
import uuid
import shutil
import json
from pathlib import Path
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse
from starlette.background import BackgroundTask
from pydantic import ValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings, get_cors_origins
from models import (
    SessionStatus, SessionMetadata, SourceType, SlideshowOptions, UploadRequest, StatusResponse
)
from tasks import process_zip_session, cleanup_expired_sessions
from utils.downloader import downloader
from utils.media_processor import media_processor

app = FastAPI(title="Media ZIP Showcase API")

# Set up rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS for frontend - Environment-based configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# Serve static media
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")

@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")

@app.post("/api/upload")
@limiter.limit(settings.RATE_LIMIT_UPLOADS)
async def upload_zip(
    request: Request,
    file: UploadFile = File(...),
    slideshow_options: str = Form(None)
):
    """
    Accept a ZIP file upload, extract, and enqueue background processing.
    """
    # Validate file type and size
    if not file.filename or not file.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only ZIP files are allowed.")
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum allowed is 2GB.")

    session_id = str(uuid.uuid4())
    session_dir = settings.MEDIA_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    zip_path = session_dir / "input.zip"

    # Save uploaded file
    try:
        with open(zip_path, "wb") as f:
            content = await file.read()
            # This check is a bit redundant if file.size is trusted, but good for safety
            if len(content) > settings.MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="File too large after reading.")
            f.write(content)
    except Exception as e:
        # Clean up if saving fails
        shutil.rmtree(session_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Parse slideshow options
    options = None
    if slideshow_options:
        try:
            options = SlideshowOptions.parse_raw(slideshow_options)
        except ValidationError as e:
            shutil.rmtree(session_dir)
            raise HTTPException(status_code=400, detail=f"Invalid slideshow options: {e}")

    # Create session metadata
    now = datetime.utcnow()
    meta = SessionMetadata(
        session_id=session_id,
        source_type=SourceType.UPLOAD,
        original_filename=file.filename,
        submitted_at=now.isoformat(),
        expires_at=(now + timedelta(seconds=settings.MEDIA_SESSION_TTL)).isoformat(),
        metadata_expires_at=(now + timedelta(seconds=settings.METADATA_SESSION_TTL)).isoformat(),
        status=SessionStatus.QUEUED,
        slideshow_options=options
    )
    meta_path = settings.SESSIONS_DIR / f"{session_id}.json"
    with open(meta_path, 'w') as f:
        f.write(meta.json())

    # Enqueue background job
    process_zip_session.delay(session_id, SourceType.UPLOAD, None, options.dict() if options else None)

    return {"session_id": session_id, "status": SessionStatus.QUEUED}

@app.post("/api/submit_link")
@limiter.limit(settings.RATE_LIMIT_LINKS)
async def submit_link(
    request: Request,
    source_url: str = Form(...),
    source_type: str = Form(...),
    slideshow_options: str = Form(None)
):
    """
    Accept a public HTTP(s) or Google Drive link, validate, and enqueue background processing.
    """
    if source_type not in [SourceType.URL, SourceType.GOOGLE_DRIVE]:
        raise HTTPException(status_code=400, detail="Invalid source type.")
    if not downloader.validate_url(source_url):
        raise HTTPException(status_code=400, detail="Invalid URL.")

    session_id = str(uuid.uuid4())
    now = datetime.utcnow()
    options = None
    if slideshow_options:
        try:
            options = SlideshowOptions.parse_raw(slideshow_options)
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=f"Invalid slideshow options: {e}")

    # Extract filename from URL for display
    original_filename = None
    if source_url:
        try:
            from urllib.parse import urlparse, unquote
            parsed_url = urlparse(source_url)
            filename_from_url = unquote(parsed_url.path.split('/')[-1])
            if filename_from_url and filename_from_url.endswith('.zip'):
                original_filename = filename_from_url
        except:
            pass
    
    meta = SessionMetadata(
        session_id=session_id,
        source_type=source_type,
        source_url=source_url,
        original_filename=original_filename,
        submitted_at=now.isoformat(),
        expires_at=(now + timedelta(seconds=settings.MEDIA_SESSION_TTL)).isoformat(),
        metadata_expires_at=(now + timedelta(seconds=settings.METADATA_SESSION_TTL)).isoformat(),
        status=SessionStatus.QUEUED,
        slideshow_options=options
    )
    meta_path = settings.SESSIONS_DIR / f"{session_id}.json"
    with open(meta_path, 'w') as f:
        json.dump(meta.dict(), f, default=str)

    # Enqueue background job
    process_zip_session.delay(session_id, source_type, source_url, options.dict() if options else None)

    return {"session_id": session_id, "status": SessionStatus.QUEUED}

@app.get("/api/session/{session_id}")
async def get_session_status(session_id: str):
    """
    Get the status and manifest for a session.
    """
    meta_path = settings.SESSIONS_DIR / f"{session_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Session not found.")
    with open(meta_path) as f:
        meta = json.load(f)
    return meta

@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session and all its associated files.
    """
    # Delete session metadata
    meta_path = settings.SESSIONS_DIR / f"{session_id}.json"
    if meta_path.exists():
        meta_path.unlink()
    
    # Delete session media directory
    session_dir = settings.MEDIA_DIR / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir, ignore_errors=True)
    
    return {"message": "Session deleted successfully"}

@app.get("/api/sessions")
async def list_sessions():
    """
    List all active/queued sessions (for dashboard/status page).
    """
    sessions = []
    now = datetime.utcnow()
    for meta_file in settings.SESSIONS_DIR.glob("*.json"):
        try:
            with open(meta_file) as f:
                meta = json.load(f)
            
            # Check if session has expired (media expiration, not metadata expiration)
            expires_at = datetime.fromisoformat(meta["expires_at"])
            if now > expires_at:
                # Skip expired sessions
                continue
                
            sessions.append({
                "session_id": meta["session_id"],
                "status": meta["status"],
                "submitted_at": meta["submitted_at"],
                "expires_at": meta["expires_at"],
                "original_filename": meta.get("original_filename")
            })
        except Exception as e:
            # Skip corrupted metadata files
            print(f"Error reading session metadata {meta_file}: {e}")
            continue
    return sessions

@app.post("/api/cleanup")
async def manual_cleanup():
    """
    Manually trigger cleanup of expired sessions (for testing/debugging).
    """
    try:
        # Run cleanup task
        result = cleanup_expired_sessions.delay()
        return {"message": "Cleanup task queued", "task_id": result.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@app.get("/api/media/{session_id}/{filename}")
async def get_media_file(session_id: str, filename: str):
    """
    Serve a media file from a session.
    """
    session_dir = settings.MEDIA_DIR / session_id
    file_path = session_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(file_path)

@app.get("/session/{session_id}")
async def session_page(session_id: str):
    """
    Serve the session viewer page (static HTML fallback).
    """
    meta_path = settings.SESSIONS_DIR / f"{session_id}.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Session not found.")
    
    # Return the session viewer HTML page
    return FileResponse(settings.STATIC_DIR / "session_view.html")

@app.get("/api/cleanup")
def cleanup_media():
    """
    Delete everything under static/media (MEDIA_DIR) and all session metadata files (SESSIONS_DIR).
    """
    try:
        # Delete all media
        for item in settings.MEDIA_DIR.iterdir():
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                item.unlink()
        # Delete all session metadata
        for meta_file in settings.SESSIONS_DIR.glob("*.json"):
            meta_file.unlink()
        return {"message": "All media and sessions cleaned up successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    Serve the React SPA for all unmatched routes (client-side routing fallback).
    """
    # Only serve SPA for routes that don't start with /api or /static
    if full_path.startswith(("api/", "static/", "session/")):
        raise HTTPException(status_code=404, detail="Not found")
    
    # Serve the main React app for client-side routing
    return FileResponse(settings.STATIC_DIR / "index.html") 

