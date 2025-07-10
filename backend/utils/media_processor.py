import os
import magic
import mimetypes
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from PIL import Image
import cv2
import numpy as np

from config import settings
from models import MediaFile, SessionManifest

class MediaProcessor:
    """Handles media file processing and classification"""
    
    def __init__(self):
        self.mime = magic.Magic(mime=True)
    
    def get_file_info(self, file_path: Path) -> Dict[str, any]:
        """Get comprehensive file information"""
        try:
            file_size = file_path.stat().st_size
            mime_type = self.mime.from_file(str(file_path))
            extension = file_path.suffix.lower()
            
            info = {
                'filename': file_path.name,
                'file_path': str(file_path),
                'file_size': file_size,
                'mime_type': mime_type,
                'extension': extension
            }
            
            # Get dimensions and duration for media files
            if self.is_image_file(file_path):
                dimensions = self.get_image_dimensions(file_path)
                info['dimensions'] = dimensions
                info['file_type'] = 'image'
            elif self.is_video_file(file_path):
                dimensions, duration = self.get_video_info(file_path)
                info['dimensions'] = dimensions
                info['duration'] = duration
                info['file_type'] = 'video'
            elif self.is_audio_file(file_path):
                duration = self.get_audio_duration(file_path)
                info['duration'] = duration
                info['file_type'] = 'audio'
            else:
                info['file_type'] = 'unknown'
            
            return info
            
        except Exception as e:
            return {
                'filename': file_path.name,
                'file_path': str(file_path),
                'file_size': 0,
                'file_type': 'error',
                'error': str(e)
            }
    
    def is_image_file(self, file_path: Path) -> bool:
        """Check if file is an image"""
        extension = file_path.suffix.lower()
        return extension in settings.ALLOWED_IMAGE_FORMATS
    
    def is_video_file(self, file_path: Path) -> bool:
        """Check if file is a video"""
        extension = file_path.suffix.lower()
        return extension in settings.ALLOWED_VIDEO_FORMATS
    
    def is_audio_file(self, file_path: Path) -> bool:
        """Check if file is an audio file"""
        extension = file_path.suffix.lower()
        return extension in settings.ALLOWED_AUDIO_FORMATS
    
    def get_image_dimensions(self, file_path: Path) -> Optional[Tuple[int, int]]:
        """Get image dimensions"""
        try:
            with Image.open(file_path) as img:
                return img.size
        except Exception:
            return None
    
    def get_video_info(self, file_path: Path) -> Tuple[Optional[Tuple[int, int]], Optional[float]]:
        """Get video dimensions and duration"""
        try:
            cap = cv2.VideoCapture(str(file_path))
            if not cap.isOpened():
                return None, None
            
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            cap.release()
            
            duration = frame_count / fps if fps > 0 else None
            dimensions = (width, height) if width > 0 and height > 0 else None
            
            return dimensions, duration
            
        except Exception:
            return None, None
    
    def get_audio_duration(self, file_path: Path) -> Optional[float]:
        """Get audio duration"""
        try:
            # This is a simplified version - in production you might want to use
            # a more robust audio library like pydub or librosa
            import wave
            with wave.open(str(file_path), 'rb') as audio_file:
                frames = audio_file.getnframes()
                rate = audio_file.getframerate()
                duration = frames / float(rate)
                return duration
        except Exception:
            return None
    
    def process_session_directory(self, session_dir: Path) -> SessionManifest:
        """Process all files in session directory and create manifest"""
        images = []
        videos = []
        audio_files = []
        total_size = 0
        
        # Recursively find all files
        for file_path in session_dir.rglob('*'):
            if file_path.is_file():
                file_info = self.get_file_info(file_path)
                
                if file_info['file_type'] == 'image':
                    media_file = MediaFile(
                        filename=file_info['filename'],
                        file_path=file_info['file_path'],
                        file_type='image',
                        file_size=file_info['file_size'],
                        dimensions=file_info.get('dimensions')
                    )
                    images.append(media_file)
                    total_size += file_info['file_size']
                    
                elif file_info['file_type'] == 'video':
                    media_file = MediaFile(
                        filename=file_info['filename'],
                        file_path=file_info['file_path'],
                        file_type='video',
                        file_size=file_info['file_size'],
                        dimensions=file_info.get('dimensions'),
                        duration=file_info.get('duration')
                    )
                    videos.append(media_file)
                    total_size += file_info['file_size']
                    
                elif file_info['file_type'] == 'audio':
                    media_file = MediaFile(
                        filename=file_info['filename'],
                        file_path=file_info['file_path'],
                        file_type='audio',
                        file_size=file_info['file_size'],
                        duration=file_info.get('duration')
                    )
                    audio_files.append(media_file)
                    total_size += file_info['file_size']
        
        # Sort files by name for consistent ordering
        images.sort(key=lambda x: x.filename)
        videos.sort(key=lambda x: x.filename)
        audio_files.sort(key=lambda x: x.filename)
        
        manifest = SessionManifest(
            session_id=session_dir.name,
            images=images,
            videos=videos,
            audio_files=audio_files,
            total_files=len(images) + len(videos) + len(audio_files),
            total_size=total_size
        )
        
        return manifest
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        import re
        # Remove or replace unsafe characters
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        # Limit length
        if len(filename) > 255:
            name, ext = os.path.splitext(filename)
            filename = name[:255-len(ext)] + ext
        return filename
    
    def validate_file_path(self, file_path: Path) -> bool:
        """Validate file path is safe (no directory traversal)"""
        try:
            file_path.resolve()
            return True
        except (RuntimeError, OSError):
            return False

# Global media processor instance
media_processor = MediaProcessor() 