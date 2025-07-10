import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Share2, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MediaPlayer, type MediaItem } from '@/components/MediaPlayer';
import { MediaThumbnails } from '@/components/MediaThumbnails';
import { useToast } from '@/hooks/use-toast';

// Mock media data - in real app this would come from your FastAPI backend
const mockMediaData: Record<string, MediaItem[]> = {
  'abc123': [
    {
      id: '1',
      type: 'slideshow',
      url: '/api/placeholder/video/720/480',
      filename: 'Generated_Slideshow.mp4',
      duration: 36
    },
    {
      id: '2',
      type: 'image',
      url: '/api/placeholder/800/600',
      filename: 'beach_sunset.jpg'
    },
    {
      id: '3',
      type: 'image',
      url: '/api/placeholder/800/600',
      filename: 'mountain_view.jpg'
    },
    {
      id: '4',
      type: 'video',
      url: '/api/placeholder/video/720/480',
      filename: 'family_video.mp4',
      duration: 15
    },
    {
      id: '5',
      type: 'image',
      url: '/api/placeholder/800/600',
      filename: 'city_lights.jpg'
    }
  ],
  'def456': [
    {
      id: '6',
      type: 'image',
      url: '/api/placeholder/800/600',
      filename: 'nature_photo.jpg'
    }
  ]
};

const SessionView = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const { toast } = useToast();

  // Mock session data - in real app this would come from your FastAPI backend
  const media = sessionId ? mockMediaData[sessionId] || [] : [];
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

  useEffect(() => {
    const updateTimeRemaining = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining('Expired');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Media Playlist',
          text: 'Check out this media collection',
          url: url
        });
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied",
          description: "Share link copied to clipboard",
        });
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard",
      });
    }
  };

  const downloadAll = () => {
    toast({
      title: "Download started",
      description: "Preparing ZIP file with all media...",
    });
    // In real app, this would trigger a download endpoint
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">Invalid Session</h1>
            <p className="text-muted-foreground mb-4">
              The session ID is missing or invalid.
            </p>
            <Button asChild>
              <Link to="/">Return Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-2">Session Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This session may have expired or been deleted.
            </p>
            <Button asChild>
              <Link to="/">Return Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md shadow-media">
          <CardContent className="p-8 text-center">
            <Clock className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">Session Expired</h1>
            <p className="text-muted-foreground mb-4">
              This media collection has expired and is no longer available.
            </p>
            <Button asChild variant="gradient">
              <Link to="/">Create New Collection</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
              
              <div>
                <h1 className="font-bold">Media Collection</h1>
                <p className="text-sm text-muted-foreground">
                  Session {sessionId?.slice(0, 8)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <Badge variant={timeRemaining.includes('h') ? 'secondary' : 'destructive'}>
                    Expires in {timeRemaining}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {media.length} media files
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={downloadAll}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Media Player */}
          <div className="lg:col-span-2 space-y-6">
            <MediaPlayer
              media={media}
              currentIndex={currentMediaIndex}
              onIndexChange={setCurrentMediaIndex}
              sessionId={sessionId}
            />
          </div>
          
          {/* Thumbnails Sidebar */}
          <div className="lg:col-span-1">
            <MediaThumbnails
              media={media}
              currentIndex={currentMediaIndex}
              onSelect={setCurrentMediaIndex}
            />
          </div>
        </div>
        
        {/* Auto-deletion Notice */}
        <div className="mt-12">
          <Card className="bg-gradient-hero border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-medium text-primary">Temporary Collection</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This media collection will be automatically deleted in {timeRemaining} for privacy. 
                    Download any files you want to keep before expiration.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SessionView;