import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Share2, Download, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MediaPlayer, type MediaItem } from '@/components/MediaPlayer';
import { MediaThumbnails } from '@/components/MediaThumbnails';
import { useToast } from '@/hooks/use-toast';
import { apiService, type Session } from '@/lib/api';

const SessionView = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [videosOnly, setVideosOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [isSlideshowGenerating, setIsSlideshowGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load session data
  const loadSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionData = await apiService.getSession(sessionId!);
      setSession(sessionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    loadSession();
  }, [sessionId]);

  // Update countdown timer
  useEffect(() => {
    if (!session) return;
    
    const updateTimeRemaining = () => {
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
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
  }, [session]);

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

  // Convert session manifest to media items
  const convertToMediaItems = (session: Session): MediaItem[] => {
    const mediaItems: MediaItem[] = [];
    
    if (!session.manifest) return mediaItems;
    
    // Add slideshow first if available
    if (session.manifest.slideshow_video) {
      // Extract just the filename from the slideshow_video path
      const slideshowFilename = session.manifest.slideshow_video.includes('/') 
        ? session.manifest.slideshow_video.split('/').pop() 
        : session.manifest.slideshow_video;
      
      mediaItems.push({
        id: 'slideshow',
        type: 'slideshow',
        url: apiService.getMediaUrl(session.session_id, slideshowFilename),
        filename: 'slideshow.mp4',
        duration: session.manifest.images?.length * 3 || 30 // Estimate duration
      });
    }
    
    // Add images
    session.manifest.images?.forEach((image, index) => {
      if (!image.filename.startsWith('._')) {
        mediaItems.push({
          id: `image-${index}`,
          type: 'image',
          url: apiService.getMediaUrl(session.session_id, image.filename),
          filename: image.filename
        });
      }
    });
    
    // Add videos
    session.manifest.videos?.forEach((video, index) => {
      if (!video.filename.startsWith('._')) {
        // Generate thumbnail URL if thumbnail_path exists
        const thumbnailUrl = video.thumbnail_path 
          ? apiService.getMediaUrl(session.session_id, video.thumbnail_path.split('/').pop() || video.thumbnail_path)
          : undefined;
          
        mediaItems.push({
          id: `video-${index}`,
          type: 'video',
          url: apiService.getMediaUrl(session.session_id, video.filename),
          filename: video.filename,
          duration: video.duration,
          thumbnailUrl: thumbnailUrl
        });
      }
    });
    
    return mediaItems;
  };

  const media = session ? convertToMediaItems(session) : [];

  // Smart navigation functions that respect videosOnly filter
  const getNextIndex = () => {
    if (videosOnly) {
      // Find next video/slideshow
      for (let i = currentMediaIndex + 1; i < media.length; i++) {
        if (media[i].type === 'video' || media[i].type === 'slideshow') {
          return i;
        }
      }
      return currentMediaIndex; // No next video found
    } else {
      // Normal navigation
      return Math.min(currentMediaIndex + 1, media.length - 1);
    }
  };

  const getPrevIndex = () => {
    if (videosOnly) {
      // Find previous video/slideshow
      for (let i = currentMediaIndex - 1; i >= 0; i--) {
        if (media[i].type === 'video' || media[i].type === 'slideshow') {
          return i;
        }
      }
      return currentMediaIndex; // No previous video found
    } else {
      // Normal navigation
      return Math.max(currentMediaIndex - 1, 0);
    }
  };

  const hasNextVideo = () => {
    if (videosOnly) {
      return getNextIndex() !== currentMediaIndex;
    } else {
      return currentMediaIndex < media.length - 1;
    }
  };

  const hasPrevVideo = () => {
    if (videosOnly) {
      return getPrevIndex() !== currentMediaIndex;
    } else {
      return currentMediaIndex > 0;
    }
  };
  
  // Update slideshow generation status when session changes
  useEffect(() => {
    if (session) {
      const isGenerating = session.status === 'generating_slideshow';
      setIsSlideshowGenerating(isGenerating);
    }
  }, [session]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin mb-4" />
            <h1 className="text-xl font-bold mb-2">Loading Session</h1>
            <p className="text-muted-foreground mb-4">
              Please wait while we load your media...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="text-xl font-bold mb-2">Session Not Found</h1>
            <p className="text-muted-foreground mb-4">
              {error || 'This session may have expired or been deleted.'}
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
            <h1 className="text-xl font-bold mb-2">No Media Found</h1>
            <p className="text-muted-foreground mb-4">
              This session doesn't contain any media files.
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
                  Session {session.session_id.slice(0, 8)}
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
                  {isSlideshowGenerating && (
                    <span className="block text-blue-600">
                      Slideshow: {session.progress}% complete
                    </span>
                  )}
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
        {/* Slideshow Generation Status */}
        {isSlideshowGenerating && (
          <div className="mb-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <div>
                      <h3 className="font-medium text-blue-900">Slideshow Generation in Progress</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Your slideshow is being generated in the background. You can browse and play other media while you wait.
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadSession}
                    className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Status
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Media Player */}
          <div className="lg:col-span-2 space-y-6">
            <MediaPlayer
              media={media[currentMediaIndex] || null}
              onNext={() => setCurrentMediaIndex(getNextIndex())}
              onPrev={() => setCurrentMediaIndex(getPrevIndex())}
              hasNext={hasNextVideo()}
              hasPrev={hasPrevVideo()}
            />
          </div>
          
          {/* Thumbnails Sidebar */}
          <div className="lg:col-span-1">
            <MediaThumbnails
              media={media}
              currentIndex={currentMediaIndex}
              onSelect={setCurrentMediaIndex}
              videosOnly={videosOnly}
              onVideosOnlyChange={setVideosOnly}
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