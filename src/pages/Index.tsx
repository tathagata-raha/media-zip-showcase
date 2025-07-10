import React, { useState, useEffect } from 'react';
import { Upload, Zap, Clock, CheckCircle } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { SlideshowOptions, type SlideshowConfig } from '@/components/SlideshowOptions';
import { SessionStatus, type Session } from '@/components/SessionStatus';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

// Mock data for demo - in real app this would come from your FastAPI backend
const mockSessions: Session[] = [
  {
    id: 'abc123',
    status: 'ready',
    sourceType: 'file',
    sourceInfo: 'vacation_photos.zip',
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    mediaCount: { images: 12, videos: 3 }
  },
  {
    id: 'def456',
    status: 'processing',
    sourceType: 'url',
    sourceInfo: 'https://example.com/media.zip',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4.5 * 60 * 60 * 1000).toISOString(),
    progress: 65
  }
];

const Index = () => {
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const [isUploading, setIsUploading] = useState(false);
  const [slideshowConfig, setSlideshowConfig] = useState<SlideshowConfig>({
    duration: 3,
    resolution: '1280x720',
    transition: 'fade',
    includeAudio: false
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  // Mock upload handler - replace with actual API calls to your FastAPI backend
  const handleUpload = async (source: File | string, type: 'file' | 'url') => {
    setIsUploading(true);
    
    // Simulate upload process
    const newSession: Session = {
      id: Math.random().toString(36).substr(2, 9),
      status: 'downloading',
      sourceType: type,
      sourceInfo: type === 'file' ? (source as File).name : source as string,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      progress: 0
    };
    
    setSessions(prev => [newSession, ...prev]);
    
    toast({
      title: "Upload started",
      description: `Processing ${type === 'file' ? 'file' : 'URL'}: ${newSession.sourceInfo}`,
    });
    
    // Simulate progress updates
    setTimeout(() => {
      setSessions(prev => prev.map(s => 
        s.id === newSession.id 
          ? { ...s, status: 'processing', progress: 45 }
          : s
      ));
    }, 2000);
    
    setTimeout(() => {
      setSessions(prev => prev.map(s => 
        s.id === newSession.id 
          ? { 
              ...s, 
              status: 'ready', 
              progress: 100,
              mediaCount: { images: Math.floor(Math.random() * 20) + 5, videos: Math.floor(Math.random() * 5) }
            }
          : s
      ));
      setIsUploading(false);
      
      toast({
        title: "Processing complete!",
        description: "Your media is ready to view",
      });
    }, 5000);
  };

  const handleViewSession = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    toast({
      title: "Session deleted",
      description: "Session and all media have been removed",
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
            <SessionStatus
              sessions={sessions}
              onViewSession={handleViewSession}
              onDeleteSession={handleDeleteSession}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
