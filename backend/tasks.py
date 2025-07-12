import os
import shutil
import json
import psutil
import random
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

def log_memory_usage(stage: str):
    """Log memory usage at different stages"""
    process = psutil.Process(os.getpid())
    memory_mb = process.memory_info().rss / 1024 ** 2
    print(f"[DEBUG] {stage} - Memory usage: {memory_mb:.2f} MB")

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

@celery_app.task(bind=True, time_limit=1800, soft_time_limit=1500)  # 30 min hard limit, 25 min soft limit
def process_zip_session(self, session_id: str, source_type: str, source_url: str = None, slideshow_options: dict = None):
    """
    Main background task to process a session: download/extract ZIP, filter media, then queue slideshow generation.
    """
    session_dir = settings.MEDIA_DIR / session_id
    session_meta_path = settings.SESSIONS_DIR / f"{session_id}.json"
    status = SessionStatus.QUEUED
    error_message = None
    try:
        log_memory_usage("Starting process_zip_session")
        print(f"[DEBUG] Starting process_zip_session for session_id={session_id}, source_type={source_type}")
        # Update status: downloading
        status = SessionStatus.DOWNLOADING
        _update_session_status(session_meta_path, status)
        
        # Step 1: Get the ZIP file
        zip_path = session_dir / "input.zip"
        if source_type in ['url', 'google_drive']:
            print(f"[DEBUG] Downloading and extracting ZIP from URL: {source_url}")
            downloader.download_and_extract_zip(source_url, session_id)
            extracted_dir = session_dir
        else: # source_type == 'upload'
            if not zip_path.exists():
                raise FileNotFoundError("Uploaded zip file not found.")
            print(f"[DEBUG] Extracting uploaded ZIP: {zip_path}")
            status = SessionStatus.PROCESSING
            _update_session_status(session_meta_path, status, progress=10)
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
                    if not str(target_path.resolve()).startswith(str(session_dir.resolve())):
                        raise ValueError("Path traversal attempt detected during extraction.")
                    with open(target_path, "wb") as f:
                        f.write(zip_ref.read(info.filename))
            os.remove(zip_path) # Clean up original zip
            extracted_dir = session_dir
        print(f"[DEBUG] Extraction complete. Directory: {extracted_dir}")
        log_memory_usage("After ZIP extraction")
        
        # Update status: processing
        status = SessionStatus.PROCESSING
        _update_session_status(session_meta_path, status, progress=50)
        print(f"[DEBUG] Starting media processing for session: {session_id}")
        # Filter and process media
        manifest = media_processor.process_session_directory(extracted_dir)
        print(f"[DEBUG] Media processing complete. Images: {len(manifest.images)}, Videos: {len(manifest.videos)}, Audio: {len(manifest.audio_files)}")
        log_memory_usage("After media processing")
        
        # Save manifest immediately so playlist is available
        manifest.created_at = datetime.utcnow()
        manifest_path = extracted_dir / "manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump(manifest.dict(), f, default=str)
        print(f"[DEBUG] Manifest saved: {manifest_path}")
        log_memory_usage("After saving manifest")
        
        # Update session metadata to READY so users can access playlist immediately
        status = SessionStatus.READY
        _update_session_status(session_meta_path, status, manifest=manifest.dict(), progress=90)
        print(f"[DEBUG] Session ready for playlist access. Slideshow will be generated in background.")
        
        # Queue slideshow generation as separate background task if images found
        if manifest.images:
            print(f"[DEBUG] Queuing slideshow generation for {len(manifest.images)} images")
            # Update status to show slideshow is generating
            _update_session_status(session_meta_path, SessionStatus.GENERATING_SLIDESHOW, manifest=manifest.dict(), progress=90)
            generate_slideshow.delay(session_id, slideshow_options or {})
        else:
            # No images, mark as 100% complete
            _update_session_status(session_meta_path, status, manifest=manifest.dict(), progress=100)
        
        print(f"[DEBUG] process_zip_session complete for session_id={session_id}")
        log_memory_usage("Task completion")
    except Exception as e:
        print(f"[ERROR] Exception in process_zip_session: {e}")
        status = SessionStatus.FAILED
        error_message = str(e)
        _update_session_status(session_meta_path, status, error_message=error_message)
        # Clean up on failure
        if session_dir.exists():
            shutil.rmtree(session_dir)
        raise

@celery_app.task(bind=True, time_limit=1800, soft_time_limit=1500)
def generate_slideshow(self, session_id: str, slideshow_options: dict = None):
    """
    Background task to generate slideshow for an already processed session.
    """
    session_dir = settings.MEDIA_DIR / session_id
    session_meta_path = settings.SESSIONS_DIR / f"{session_id}.json"
    
    try:
        print(f"[DEBUG] Starting slideshow generation for session: {session_id}")
        log_memory_usage("Starting slideshow generation task")
        
        # Load existing manifest
        manifest_path = session_dir / "manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError("Manifest not found for slideshow generation")
        
        with open(manifest_path, 'r') as f:
            manifest_data = json.load(f)
        
        # Generate slideshow
        slideshow_path = session_dir / "slideshow.mp4"
        opts = SlideshowOptions(**(slideshow_options or {}))
        
        # Get image paths from manifest
        image_paths = [Path(img['file_path']) for img in manifest_data.get('images', [])]
        
        if not image_paths:
            print(f"[DEBUG] No images found for slideshow generation")
            return
        
        # Randomly select images if there are more than the configured limit
        max_images = settings.MAX_SLIDESHOW_IMAGES
        if len(image_paths) > max_images:
            print(f"[DEBUG] Found {len(image_paths)} images, randomly selecting {max_images} for slideshow")
            random.shuffle(image_paths)
            image_paths = image_paths[:max_images]
            print(f"[DEBUG] Selected {len(image_paths)} images for slideshow generation")
            print(f"[DEBUG] Selected images: {[path.name for path in image_paths]}")
        else:
            print(f"[DEBUG] Using all {len(image_paths)} images for slideshow generation")
        
        # Get background music if available
        music_file = None
        audio_files = manifest_data.get('audio_files', [])
        if audio_files:
            music_file = Path(audio_files[0]['file_path'])
        
        # Generate slideshow
        success = slideshow_generator.generate_slideshow(
            image_paths,
            slideshow_path,
            opts,
            background_music_path=music_file
        )
        
        if success:
            # Update manifest with slideshow
            manifest_data['slideshow_video'] = str(slideshow_path.relative_to(settings.MEDIA_DIR))
            manifest_data['slideshow_ready'] = True
            
            # Save updated manifest
            with open(manifest_path, 'w') as f:
                json.dump(manifest_data, f, default=str)
            
            # Update session status to 100% complete
            _update_session_status(session_meta_path, SessionStatus.READY, manifest=manifest_data, progress=100)
            
            print(f"[DEBUG] Slideshow generation complete: {slideshow_path}")
            log_memory_usage("After slideshow generation")
        else:
            print(f"[ERROR] Slideshow generation failed")
            
    except Exception as e:
        print(f"[ERROR] Exception in generate_slideshow: {e}")
        # Update session with error but don't fail the whole session
        _update_session_status(session_meta_path, SessionStatus.READY, error_message=f"Slideshow generation failed: {str(e)}")
        raise

@celery_app.task
def cleanup_expired_sessions():
    """Delete expired media and metadata files."""
    now = datetime.utcnow()
    print(f"[DEBUG] Running cleanup_expired_sessions at {now}")
    
    # Clean media (older than MEDIA_SESSION_TTL)
    cleaned_media_count = 0
    for session_dir in settings.MEDIA_DIR.iterdir():
        if session_dir.is_dir():
            meta_path = settings.SESSIONS_DIR / f"{session_dir.name}.json"
            if meta_path.exists():
                try:
                    with open(meta_path) as f:
                        meta = json.load(f)
                    expires_at = datetime.fromisoformat(meta['expires_at'])
                    print(f"[DEBUG] Session {session_dir.name}: expires_at={expires_at}, now={now}, expired={now > expires_at}")
                    if now > expires_at:
                        shutil.rmtree(session_dir, ignore_errors=True)
                        print(f"[INFO] Cleaned up expired session: {session_dir.name}")
                        cleaned_media_count += 1
                except Exception as e:
                    print(f"[ERROR] Error processing session {session_dir.name}: {e}")
            else:
                print(f"[DEBUG] No metadata found for session directory: {session_dir.name}")
    
    # Clean metadata (older than METADATA_SESSION_TTL)
    cleaned_metadata_count = 0
    for meta_file in settings.SESSIONS_DIR.glob("*.json"):
        try:
            with open(meta_file) as f:
                meta = json.load(f)
            metadata_expires_at = datetime.fromisoformat(meta['metadata_expires_at'])
            print(f"[DEBUG] Metadata {meta_file.name}: expires_at={metadata_expires_at}, now={now}, expired={now > metadata_expires_at}")
            if now > metadata_expires_at:
                os.remove(meta_file)
                print(f"[INFO] Cleaned up expired metadata: {meta_file.name}")
                cleaned_metadata_count += 1
        except Exception as e:
            print(f"[ERROR] Error processing metadata {meta_file.name}: {e}")
    
    print(f"[INFO] Cleanup complete: {cleaned_media_count} media sessions, {cleaned_metadata_count} metadata files cleaned")

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