import React, { useState } from 'react';
import { Upload, Zap, Clock, CheckCircle } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { SlideshowOptions, type SlideshowConfig } from '@/components/SlideshowOptions';
import { SessionStatus } from '@/components/SessionStatus';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useSessions, type SessionWithProgress } from '@/hooks/useSessions';
import { apiService, type SlideshowOptions as ApiSlideshowOptions } from '@/lib/api';

const Index = () => {
  const { sessions, loading, error, addSession, removeSession } = useSessions();
  const [isUploading, setIsUploading] = useState(false);
  const [slideshowConfig, setSlideshowConfig] = useState<SlideshowConfig>({
    duration: 3,
    resolution: '1280x720',
    transition: 'fade',
    includeAudio: false
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  // Real upload handler with API integration
  const handleUpload = async (source: File | string, type: 'file' | 'url' | 'google_drive') => {
    setIsUploading(true);
    
    try {
      // Convert slideshow config to API format
      const apiSlideshowOptions: ApiSlideshowOptions = {
        image_duration: slideshowConfig.duration,
        transition_effect: slideshowConfig.transition as 'none' | 'fade' | 'crossfade',
        resolution: slideshowConfig.resolution === '1280x720' ? [1280, 720] : [1920, 1080],
        background_music: slideshowConfig.includeAudio ? 'auto' : undefined,
      };
      
      let response;
      
      if (type === 'file') {
        response = await apiService.uploadFile(source as File, apiSlideshowOptions);
      } else {
        const url = source as string;
        // The 'type' from FileUpload ('url' or 'google_drive') directly matches the API's expected source_type
        response = await apiService.submitUrl(url, type, apiSlideshowOptions);
      }
      
      // Add session to local state
      const newSession: SessionWithProgress = {
        session_id: response.session_id,
        status: response.status as any,
        submitted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        progress: 0,
      };
      
      addSession(newSession);
      
      toast({
        title: "Upload started",
        description: `Processing ${type === 'file' ? 'file' : 'URL'}: ${type === 'file' ? (source as File).name : source as string}`,
      });
      
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewSession = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  const handleDeleteSession = (sessionId: string) => {
    // Note: Backend doesn't have a delete endpoint, so we just remove from local state
    // In a real app, you'd want to add a DELETE /api/session/{id} endpoint
    removeSession(sessionId);
    toast({
      title: "Session removed",
      description: "Session removed from view (will be auto-deleted after expiration)",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-hero border-b">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Zap className="h-4 w-4" />
              Temporary Sessions • Auto-Delete in 5 Hours
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Process & Share
              <span className="bg-gradient-primary bg-clip-text text-transparent"> Media Collections</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload ZIP files containing images and videos. We'll extract them, generate slideshows, 
              and create a temporary playlist for easy sharing.
            </p>
            
            <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                ZIP files up to 500MB
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                5-hour temporary access
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Automatic slideshow generation
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 space-y-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Upload Section */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Upload Media</h2>
              <p className="text-muted-foreground">
                Upload a ZIP file or provide a download link to get started
              </p>
            </div>
            
            <FileUpload onUpload={handleUpload} isUploading={isUploading} />
          </div>

          {/* Slideshow Options */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Slideshow Settings</h2>
              <p className="text-muted-foreground">
                Customize how your image slideshow will be generated
              </p>
            </div>
            
            <SlideshowOptions 
              config={slideshowConfig} 
              onChange={setSlideshowConfig} 
            />
          </div>
        </div>

        {/* Sessions Status */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-2">Active Sessions</h2>
            <p className="text-muted-foreground">
              Monitor your processing sessions and access completed media
            </p>
          </div>
          
          <div className="flex justify-center">
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}
            <SessionStatus
              sessions={sessions}
              onViewSession={handleViewSession}
              onDeleteSession={handleDeleteSession}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
