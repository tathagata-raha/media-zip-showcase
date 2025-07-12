// API service for communicating with the FastAPI backend

export type SessionStatus = 'queued' | 'downloading' | 'processing' | 'ready' | 'generating_slideshow' | 'failed';

export interface Session {
  session_id: string;
  status: SessionStatus;
  source_type: 'upload' | 'url' | 'google_drive';
  source_url?: string;
  original_filename?: string;
  submitted_at: string;
  expires_at: string;
  metadata_expires_at: string;
  error_message?: string;
  slideshow_options?: any;
  manifest?: any;
  progress?: number;
}

export interface SlideshowOptions {
  image_duration: number;
  transition_effect: 'none' | 'fade' | 'crossfade';
  resolution: [number, number];
  background_music?: string;
}

export interface UploadResponse {
  session_id: string;
  status: SessionStatus;
}

export interface SessionListResponse {
  session_id: string;
  status: SessionStatus;
  submitted_at: string;
  expires_at: string;
  original_filename?: string;
}

const API_BASE = '/api';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  // Upload a ZIP file
  async uploadFile(file: File, slideshowOptions?: SlideshowOptions): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (slideshowOptions) {
      formData.append('slideshow_options', JSON.stringify(slideshowOptions));
    }

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${errorText}`);
    }

    return response.json();
  }

  // Submit a URL for processing
  async submitUrl(url: string, sourceType: 'url' | 'google_drive', slideshowOptions?: SlideshowOptions): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('source_url', url);
    formData.append('source_type', sourceType);
    
    if (slideshowOptions) {
      formData.append('slideshow_options', JSON.stringify(slideshowOptions));
    }

    const response = await fetch(`${API_BASE}/submit_link`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`URL submission failed: ${errorText}`);
    }

    return response.json();
  }

  // Get session status and manifest
  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>(`/session/${sessionId}`);
  }

  // Get list of all sessions
  async getSessions(): Promise<SessionListResponse[]> {
    return this.request<SessionListResponse[]>('/sessions');
  }

  // Delete a session
  async deleteSession(sessionId: string): Promise<void> {
    await this.request<void>(`/session/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // Get media file URL
  getMediaUrl(sessionId: string, filename: string): string {
    return `${API_BASE}/media/${sessionId}/${filename}`;
  }

  // Check if a URL is a Google Drive link
  isGoogleDriveUrl(url: string): boolean {
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  }

  // Cleanup all media on the server
  async cleanupMedia(): Promise<{ message: string }> {
    const response = await fetch('/api/cleanup', { method: 'GET' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cleanup failed: ${errorText}`);
    }
    return response.json();
  }
}

export const apiService = new ApiService(); 