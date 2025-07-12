# Media ZIP Showcase Backend

A FastAPI backend for processing ZIP files containing media (images/videos) and generating slideshows.

## Features

- **ZIP Processing**: Extract and filter media files from ZIP archives
- **Background Processing**: Asynchronous processing with Celery + Redis
- **Slideshow Generation**: Create videos from image collections with transitions
- **Session Management**: Temporary sessions with auto-cleanup
- **Multiple Sources**: Support for file upload, HTTP links, and Google Drive
- **Media Filtering**: Automatic classification of images, videos, and audio

## Quick Start

### Using Docker Compose (Recommended)

```bash
cd backend
docker-compose up --build
```

This will start:
- Redis (port 6379)
- FastAPI backend (port 8000)
- Celery worker
- Celery beat (for cleanup tasks)

### Manual Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Start Redis:
```bash
redis-server
```

3. Start Celery worker:
```bash
celery -A tasks.celery_app worker --loglevel=info
```

4. Start Celery beat (in another terminal):
```bash
celery -A tasks.celery_app beat --loglevel=info
```

5. Start FastAPI server:
```bash
uvicorn app:app --reload
```

## API Endpoints

### Upload ZIP File
```
POST /api/upload
Content-Type: multipart/form-data

file: ZIP file
slideshow_options: JSON string (optional)
```

### Submit Link
```
POST /api/submit_link
Content-Type: application/x-www-form-urlencoded

source_url: URL to ZIP file
source_type: "url" or "google_drive"
slideshow_options: JSON string (optional)
```

### Get Session Status
```
GET /api/session/{session_id}
```

### List All Sessions
```
GET /api/sessions
```

### Serve Media File
```
GET /api/media/{session_id}/{filename}
```

### Session Viewer Page
```
GET /session/{session_id}
```

## Configuration

Environment variables (see `config.py`):
- `REDIS_URL`: Redis connection string
- `MAX_FILE_SIZE`: Maximum ZIP file size (default: 2GB)
- `MEDIA_SESSION_TTL`: Media cleanup time (default: 12 hours)
- `METADATA_SESSION_TTL`: Metadata cleanup time (default: 24 hours)

## Project Structure

```
backend/
├── app.py                 # FastAPI application
├── tasks.py              # Celery background tasks
├── config.py             # Configuration settings
├── models.py             # Pydantic data models
├── utils/                # Utility modules
│   ├── downloader.py     # File download utilities
│   ├── media_processor.py # Media file processing
│   └── slideshow_generator.py # Video slideshow generation
├── static/               # Static files (served by FastAPI)
│   └── media/           # Session media files
├── sessions/             # Session metadata JSON files
└── requirements.txt      # Python dependencies
```

## Session Lifecycle

1. **Upload/Submit**: User uploads ZIP or submits link
2. **Queued**: Task added to Celery queue
3. **Downloading**: Downloading and extracting ZIP (if URL)
4. **Processing**: Filtering media, generating slideshow
5. **Ready**: Session ready for viewing
6. **Failed**: Error occurred during processing

## Auto-Cleanup

- Media files: Deleted after 5 hours
- Metadata: Deleted after 24 hours
- Cleanup runs every 30 minutes via Celery beat

## Security Features

- File size limits
- File type validation
- Path sanitization
- ZIP bomb protection
- Directory traversal prevention 