import os
import shutil
import json
from pathlib import Path
from datetime import datetime, timedelta
from celery import Celery
from celery.schedules import crontab
from config import settings
from models import SessionStatus, SessionMetadata, SlideshowOptions
from utils.downloader import downloader, DownloadError
from utils.media_processor import media_processor
from utils.slideshow_generator import slideshow_generator
import zipfile

celery_app = Celery(
    'media_tasks',
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.beat_schedule = {
    'cleanup-media-sessions': {
        'task': 'tasks.cleanup_expired_sessions',
        'schedule': crontab(minute='*/30'),  # every 30 minutes
    },
}

@celery_app.task(bind=True)
def process_zip_session(self, session_id: str, source_type: str, source_url: str = None, slideshow_options: dict = None):
    """
    Main background task to process a session: download/extract ZIP, filter media, generate slideshow, build manifest.
    """
    session_dir = settings.MEDIA_DIR / session_id
    session_meta_path = settings.SESSIONS_DIR / f"{session_id}.json"
    status = SessionStatus.QUEUED
    error_message = None
    try:
        # Update status: downloading
        status = SessionStatus.DOWNLOADING
        _update_session_status(session_meta_path, status)
        
        # Step 1: Get the ZIP file
        zip_path = session_dir / "input.zip"
        if source_type in ['url', 'google_drive']:
            downloader.download_and_extract_zip(source_url, session_id)
            # Since download_and_extract_zip already extracts, we can skip to processing
            extracted_dir = session_dir
        else: # source_type == 'upload'
            if not zip_path.exists():
                raise FileNotFoundError("Uploaded zip file not found.")

            # Step 2: Securely extract the zip for uploads
            status = SessionStatus.PROCESSING
            _update_session_status(session_meta_path, status, progress=10) # Start processing progress
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                total_size = 0
                file_count = 0
                for info in zip_ref.infolist():
                    if info.is_dir():
                        continue
                    
                    # Security checks
                    if '..' in info.filename or info.filename.startswith('/'):
                        raise ValueError("Path traversal attempt detected in ZIP.")
                    
                    file_count += 1
                    if file_count > settings.MAX_FILES_PER_ZIP:
                        raise ValueError(f"Exceeded max file limit of {settings.MAX_FILES_PER_ZIP}.")
                    
                    total_size += info.file_size
                    if total_size > settings.MAX_EXTRACTED_SIZE:
                         raise ValueError(f"Exceeded max extracted size of {settings.MAX_EXTRACTED_SIZE} bytes.")
                
                # Extract files one by one with sanitized names
                for info in zip_ref.infolist():
                    if info.is_dir():
                        continue
                    
                    safe_filename = media_processor.sanitize_filename(Path(info.filename).name)
                    target_path = session_dir / safe_filename
                    
                    # Ensure target is within the session directory
                    if not str(target_path.resolve()).startswith(str(session_dir.resolve())):
                        raise ValueError("Path traversal attempt detected during extraction.")

                    # Write file safely
                    with open(target_path, "wb") as f:
                        f.write(zip_ref.read(info.filename))
            
            os.remove(zip_path) # Clean up original zip
            extracted_dir = session_dir

        # Update status: processing
        status = SessionStatus.PROCESSING
        _update_session_status(session_meta_path, status, progress=50)

        # Filter and process media
        manifest = media_processor.process_session_directory(extracted_dir)

        # Generate slideshow if images found
        slideshow_path = None
        if manifest.images:
            opts = SlideshowOptions(**(slideshow_options or {}))
            slideshow_path = extracted_dir / "slideshow.mp4"
            music_file = None
            if manifest.audio_files:
                music_file = Path(manifest.audio_files[0].file_path)
            slideshow_generator.generate_slideshow(
                [Path(img.file_path) for img in manifest.images],
                slideshow_path,
                opts,
                background_music_path=music_file
            )
            manifest.slideshow_video = str(slideshow_path.relative_to(settings.MEDIA_DIR))

        # Save manifest
        manifest.created_at = datetime.utcnow()
        manifest_path = extracted_dir / "manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump(manifest.dict(), f, default=str)

        # Update session metadata
        status = SessionStatus.READY
        _update_session_status(session_meta_path, status, manifest=manifest.dict(), progress=100)

    except Exception as e:
        status = SessionStatus.FAILED
        error_message = str(e)
        _update_session_status(session_meta_path, status, error_message=error_message)
        # Clean up on failure
        if session_dir.exists():
            shutil.rmtree(session_dir)
        raise

@celery_app.task
def cleanup_expired_sessions():
    """Delete expired media and metadata files."""
    now = datetime.utcnow()
    
    # Clean media (older than MEDIA_SESSION_TTL)
    for session_dir in settings.MEDIA_DIR.iterdir():
        if session_dir.is_dir():
            meta_path = settings.SESSIONS_DIR / f"{session_dir.name}.json"
            if meta_path.exists():
                try:
                    with open(meta_path) as f:
                        meta = json.load(f)
                    expires_at = datetime.fromisoformat(meta['expires_at'])
                    if now > expires_at:
                        shutil.rmtree(session_dir, ignore_errors=True)
                        print(f"Cleaned up expired session: {session_dir.name}")
                except Exception as e:
                    print(f"Error processing session {session_dir.name}: {e}")
    
    # Clean metadata (older than METADATA_SESSION_TTL)
    for meta_file in settings.SESSIONS_DIR.glob("*.json"):
        try:
            with open(meta_file) as f:
                meta = json.load(f)
            metadata_expires_at = datetime.fromisoformat(meta['metadata_expires_at'])
            if now > metadata_expires_at:
                os.remove(meta_file)
                print(f"Cleaned up expired metadata: {meta_file.name}")
        except Exception as e:
            print(f"Error processing metadata {meta_file.name}: {e}")

def _update_session_status(meta_path, status, manifest=None, error_message=None, progress=None):
    if not meta_path.exists():
        return
    with open(meta_path, 'r') as f:
        meta = json.load(f)
    meta['status'] = status
    if manifest:
        meta['manifest'] = manifest
    if error_message:
        meta['error_message'] = error_message
    if progress is not None:
        meta['progress'] = progress
    with open(meta_path, 'w') as f:
        json.dump(meta, f, default=str) 