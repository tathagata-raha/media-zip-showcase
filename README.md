# 📁 Media ZIP Showcase

A full-stack web application for processing and sharing ZIP files containing images, videos, and audio. Upload ZIP files or provide download links, and the system will extract media, generate slideshows, and create temporary playlists for easy sharing.

## ✨ Features

### 🎯 Core Functionality
- **ZIP Processing**: Upload ZIP files (max 500MB) or provide public/Google Drive URLs
- **Media Classification**: Automatically categorizes images, videos, and audio files
- **Slideshow Generation**: Creates MP4 slideshows from images with customizable settings
- **Temporary Sessions**: Auto-expiring sessions (5-hour media, 24-hour metadata)
- **Real-time Status**: Live progress tracking with WebSocket-like updates

### 🎨 Slideshow Customization
- **Duration Control**: 0.5-10 seconds per image
- **Resolution Options**: 1280x720 (HD) or 1920x1080 (Full HD)
- **Transitions**: None, Fade, or Crossfade effects
- **Background Music**: Optional audio overlay from uploaded files

### 🔒 Security Features
- **Path Traversal Protection**: Prevents ZIP bomb and directory traversal attacks
- **File Validation**: Strict file type and size limits
- **Rate Limiting**: Upload and link submission rate limits
- **Input Sanitization**: Filename and URL validation
- **CORS Protection**: Configurable origin restrictions

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Redis
- FFmpeg (for video processing)

### 1. Backend Setup

```bash
# Clone and navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Copy environment template (optional)
cp config.example.env .env

# Start Redis (if not already running)
redis-server

# Run database migrations (create directories)
python -c "from config import ensure_directories; ensure_directories()"

# Start FastAPI server
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start Background Workers

```bash
# In separate terminals:

# Celery worker
celery -A tasks.celery_app worker --loglevel=info

# Celery beat (scheduled tasks)
celery -A tasks.celery_app beat --loglevel=info
```

### 3. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Access Application

- **Main App**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **Static Session Viewer**: http://localhost:8000/session/{session_id}

## 🐋 Docker Deployment

```bash
# Navigate to backend directory
cd backend

# Start all services
docker-compose up --build

# Access application at http://localhost:8000
```

The Docker setup includes:
- **Backend**: FastAPI server (port 8000)
- **Worker**: Celery worker for background processing
- **Beat**: Celery beat for scheduled cleanup
- **Redis**: Message broker and result backend

## 📁 Project Structure

```
media-zip-showcase/
├── backend/                    # FastAPI backend
│   ├── app.py                 # Main FastAPI application
│   ├── tasks.py               # Celery background tasks
│   ├── models.py              # Pydantic data models
│   ├── config.py              # Configuration management
│   ├── utils/                 # Utility modules
│   │   ├── downloader.py      # URL/Google Drive download
│   │   ├── media_processor.py # File classification
│   │   └── slideshow_generator.py # Video generation
│   ├── static/                # Static files (built frontend)
│   ├── requirements.txt       # Python dependencies
│   └── docker-compose.yml     # Docker configuration
├── frontend/                  # React TypeScript frontend
│   ├── src/
│   │   ├── pages/            # Main pages (Index, SessionView)
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # API client and utilities
│   └── package.json         # Node.js dependencies
└── README.md                # This file
```

## 🔧 Configuration

### Environment Variables

Key configuration options (see `backend/config.example.env`):

```bash
# File Limits
MAX_FILE_SIZE=524288000        # 500MB upload limit
MAX_EXTRACTED_SIZE=1073741824  # 1GB extraction limit

# Session TTL
MEDIA_SESSION_TTL=18000        # 5 hours (media files)
METADATA_SESSION_TTL=86400     # 24 hours (session data)

# Security
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
RATE_LIMIT_UPLOADS=5/minute    # Upload rate limit
RATE_LIMIT_LINKS=10/minute     # Link submission rate limit

# Redis
REDIS_URL=redis://localhost:6379/0
```

### Supported File Formats

- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`
- **Videos**: `.mp4`, `.webm`, `.avi`, `.mov`, `.mkv`
- **Audio**: `.mp3`, `.wav`, `.ogg`, `.aac`, `.flac`

## 🛠️ API Endpoints

### Upload & Processing
- `POST /api/upload` - Upload ZIP file
- `POST /api/submit_link` - Submit download URL
- `GET /api/session/{id}` - Get session status
- `GET /api/sessions` - List all sessions

### Media Access
- `GET /api/media/{session_id}/{filename}` - Download media file
- `GET /session/{session_id}` - Static session viewer

### Frontend Routes
- `/` - Main upload interface
- `/session/{session_id}` - React session viewer

## 🔄 Session Lifecycle

1. **Queued**: Session created, background job scheduled
2. **Downloading**: Downloading from URL (if applicable)
3. **Processing**: Extracting ZIP, classifying media, generating slideshow
4. **Ready**: Session complete, media accessible
5. **Failed**: Error occurred during processing

## 🧹 Cleanup System

- **Media Files**: Auto-deleted after 5 hours
- **Session Metadata**: Auto-deleted after 24 hours
- **Cleanup Job**: Runs every 30 minutes via Celery Beat

## 🔒 Security Measures

### File Security
- ZIP bomb protection with extraction size limits
- Path traversal prevention
- Filename sanitization
- Magic number validation for file types

### Network Security
- Rate limiting on upload endpoints
- CORS origin restrictions
- URL validation for downloads
- Private IP address blocking

### Session Security
- Cryptographically secure UUID4 session IDs
- No guessable session identifiers
- Automatic session expiration

## 📊 Recent Improvements

### ✅ Fixed Issues
- **Missing Configuration**: Added `MAX_EXTRACTED_SIZE` setting
- **Rate Limiting**: Implemented upload and link submission limits
- **CORS Security**: Environment-based origin configuration
- **Frontend Deployment**: Built React app served from backend
- **Slideshow Transitions**: Fixed complex crossfade implementation
- **Docker Configuration**: Added missing environment variables

### 🎯 Security Enhancements
- Added slowapi for rate limiting
- Improved CORS configuration
- Enhanced URL validation
- Better error handling and cleanup

### 🚀 Performance Improvements
- Optimized slideshow generation
- Simplified transition effects
- Better memory management

## 🐛 Troubleshooting

### Common Issues

**Redis Connection Error**
```bash
# Start Redis
redis-server
# Or with Docker
docker run -d -p 6379:6379 redis:alpine
```

**FFmpeg Not Found**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

**Permission Errors**
```bash
# Ensure proper permissions for media directories
chmod -R 755 backend/static/
```

### Development Tips

- Use `uvicorn app:app --reload` for auto-reloading during development
- Monitor Celery workers with `celery -A tasks.celery_app events`
- Check Redis status with `redis-cli ping`

## 📝 License

This project is provided as-is for educational and demonstration purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Built with**: FastAPI, Celery, Redis, React, TypeScript, MoviePy, OpenCV 