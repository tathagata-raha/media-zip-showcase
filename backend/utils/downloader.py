import os
import re
import requests
import httpx
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse, parse_qs
import zipfile
import tempfile
import shutil

from config import settings

class DownloadError(Exception):
    """Custom exception for download errors"""
    pass

class Downloader:
    """Handles downloading files from various sources"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def validate_url(self, url: str) -> bool:
        """Validate if URL is safe and accessible"""
        try:
            parsed = urlparse(url)
            # Check for safe schemes
            if parsed.scheme not in ['http', 'https']:
                return False
            
            # Check for localhost or private IP addresses
            if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
                return False
            
            # Check for private IP ranges
            if parsed.hostname:
                try:
                    import ipaddress
                    ip = ipaddress.ip_address(parsed.hostname)
                    if ip.is_private or ip.is_loopback:
                        return False
                except ValueError:
                    # Not an IP address, continue
                    pass
            
            return True
        except Exception:
            return False
    
    def is_google_drive_url(self, url: str) -> bool:
        """Check if URL is a Google Drive share link"""
        return 'drive.google.com' in url or 'docs.google.com' in url
    
    def extract_google_drive_file_id(self, url: str) -> Optional[str]:
        """Extract file ID from Google Drive URL"""
        patterns = [
            r'/file/d/([a-zA-Z0-9_-]+)',
            r'/spreadsheets/d/([a-zA-Z0-9_-]+)',
            r'/presentation/d/([a-zA-Z0-9_-]+)',
            r'/document/d/([a-zA-Z0-9_-]+)',
            r'id=([a-zA-Z0-9_-]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def get_google_drive_download_url(self, file_id: str) -> str:
        """Convert Google Drive file ID to direct download URL"""
        # Use the newer Google Drive API endpoint for better reliability
        return f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    
    def get_google_drive_public_url(self, file_id: str) -> str:
        """Convert Google Drive file ID to public share URL"""
        return f"https://drive.google.com/uc?export=download&id={file_id}"
    
    def download_file(self, url: str, destination: Path) -> Tuple[Path, int]:
        """
        Download file from URL to destination
        
        Returns:
            Tuple of (file_path, file_size)
        """
        try:
            # Handle Google Drive URLs
            if self.is_google_drive_url(url):
                file_id = self.extract_google_drive_file_id(url)
                if not file_id:
                    raise DownloadError("Invalid Google Drive URL")
                # Try the public URL first, fallback to API URL
                try:
                    url = self.get_google_drive_public_url(file_id)
                except Exception:
                    url = self.get_google_drive_download_url(file_id)
            
            # Validate URL
            if not self.validate_url(url):
                raise DownloadError("Invalid URL")
            
            # Download with progress tracking
            response = self.session.get(url, stream=True, timeout=settings.DOWNLOAD_TIMEOUT)
            response.raise_for_status()
            
            # Check content length
            content_length = response.headers.get('content-length')
            if content_length:
                file_size = int(content_length)
                if file_size > settings.MAX_DOWNLOAD_SIZE:
                    raise DownloadError(f"File too large: {file_size} bytes")
            
            # Download file
            with open(destination, 'wb') as f:
                downloaded_size = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded_size += len(chunk)
                        if downloaded_size > settings.MAX_DOWNLOAD_SIZE:
                            f.close()
                            os.unlink(destination)
                            raise DownloadError("File too large")
            
            return destination, downloaded_size
            
        except requests.exceptions.Timeout:
            raise DownloadError("Download timeout - file may be too large or server too slow")
        except requests.exceptions.ConnectionError:
            raise DownloadError("Connection failed - check if URL is accessible")
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                raise DownloadError("File not found at the provided URL")
            elif e.response.status_code == 403:
                raise DownloadError("Access denied - file may be private or require authentication")
            else:
                raise DownloadError(f"HTTP error {e.response.status_code}: {e.response.reason}")
        except requests.exceptions.RequestException as e:
            raise DownloadError(f"Download failed: {str(e)}")
        except Exception as e:
            raise DownloadError(f"Unexpected error: {str(e)}")
    
    def download_and_extract_zip(self, url: str, session_id: str) -> Path:
        """
        Download ZIP file and extract to session directory
        
        Returns:
            Path to extracted directory
        """
        session_dir = settings.MEDIA_DIR / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        
        # Download to temporary file
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
        
        try:
            # Download file
            downloaded_path, file_size = self.download_file(url, temp_path)
            
            # Validate it's a ZIP file
            if not zipfile.is_zipfile(downloaded_path):
                raise DownloadError("Downloaded file is not a valid ZIP archive")
            
            # Extract ZIP
            with zipfile.ZipFile(downloaded_path, 'r') as zip_ref:
                # Check for ZIP bomb
                total_size = 0
                file_count = 0
                
                for info in zip_ref.infolist():
                    total_size += info.file_size
                    file_count += 1
                    
                    if file_count > settings.MAX_FILES_PER_ZIP:
                        raise DownloadError(f"Too many files in ZIP: {file_count}")
                    
                    if total_size > settings.MAX_DOWNLOAD_SIZE:
                        raise DownloadError(f"ZIP contents too large: {total_size} bytes")
                
                # Extract files
                zip_ref.extractall(session_dir)
            
            return session_dir
            
        finally:
            # Clean up temporary file
            if temp_path.exists():
                temp_path.unlink()
    
    def cleanup_session(self, session_id: str):
        """Clean up session directory"""
        session_dir = settings.MEDIA_DIR / session_id
        if session_dir.exists():
            shutil.rmtree(session_dir)

# Global downloader instance
downloader = Downloader() 