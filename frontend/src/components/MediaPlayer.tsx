import React, { useEffect, useState, useRef } from 'react';
import { PlayCircle, Image as ImageIcon, Film, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import 'media-chrome';

// Declare the custom elements for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'media-controller': any;
      'media-control-bar': any;
      'media-play-button': any;
      'media-seek-backward-button': any;
      'media-seek-forward-button': any;
      'media-mute-button': any;
      'media-volume-range': any;
      'media-time-range': any;
      'media-time-display': any;
      'media-duration-display': any;
      'media-fullscreen-button': any;
    }
  }
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'slideshow';
  url: string;
  filename: string;
  duration?: number;
  thumbnailUrl?: string;
}

interface MediaPlayerProps {
  media: MediaItem | null;
  className?: string;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ media, className, onNext, onPrev, hasNext, hasPrev }) => {
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Load Media Chrome components for all browsers
    const loadMediaChrome = async () => {
      try {
        // Load polyfills for older browsers if needed
        if (!window.customElements) {
          await import('@webcomponents/custom-elements');
        }
        await import('media-chrome');
      } catch (error) {
        console.warn('Media Chrome failed to load:', error);
      }
    };
    loadMediaChrome();
  }, []);

  // Set autoplay when media changes (from navigation or playlist selection)
  useEffect(() => {
    if (media && (media.type === 'video' || media.type === 'slideshow')) {
      setShouldAutoplay(true);
      // Reset autoplay flag after a short delay
      const timer = setTimeout(() => setShouldAutoplay(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [media?.url]); // Trigger when URL changes (new media selected)

  // Handle video ended event to auto-advance
  useEffect(() => {
    if (!onNext || !hasNext || !media?.url) return;

    const setupVideoListener = () => {
      const video = videoRef.current;
      if (!video) {
        // Retry after a short delay if video element isn't available yet
        setTimeout(setupVideoListener, 100);
        return;
      }

      const handleVideoEnded = () => {
        if (hasNext) {
          console.log('Video ended, auto-advancing to next video');
          onNext();
        }
      };

      video.addEventListener('ended', handleVideoEnded);
      return () => {
        video.removeEventListener('ended', handleVideoEnded);
      };
    };

    const cleanup = setupVideoListener();
    return cleanup;
  }, [onNext, hasNext, media?.url]);

  // Enhanced navigation handlers with autoplay trigger
  const handleNext = () => {
    if (onNext) {
      setShouldAutoplay(true);
      onNext();
    }
  };

  const handlePrev = () => {
    if (onPrev) {
      setShouldAutoplay(true);
      onPrev();
    }
  };

  if (!media) {
    return (
      <Card className={`shadow-media ${className}`}>
        <CardContent className="flex items-center justify-center p-16">
          <div className="text-center text-muted-foreground">
            <PlayCircle className="mx-auto h-16 w-16 opacity-50 mb-4" />
            <p className="text-lg font-medium">Select an item to play</p>
            <p className="text-sm mt-2">Choose from the playlist to start viewing</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderVideo = () => {
    return (
      <media-controller 
        style={{ 
          width: '100%', 
          height: '100%',
          maxWidth: '100%',
          maxHeight: '80vh',
          display: 'block',
          position: 'relative',
          margin: '0 auto'
        }}
      >
        <video
          slot="media"
          key={media.url}
          src={media.url}
          preload="metadata"
          playsInline
          autoPlay={shouldAutoplay}
          muted={shouldAutoplay} // Muted autoplay for browser compatibility
          style={{ 
            width: '100%', 
            height: '100%',
            maxWidth: '100%',
            maxHeight: '80vh',
            objectFit: 'contain',
            display: 'block',
            backgroundColor: 'black'
          }}
          ref={videoRef}
        />
        <media-control-bar 
          style={{ 
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: '10'
          }}
        >
          <media-play-button></media-play-button>
          <media-seek-backward-button seekoffset="5"></media-seek-backward-button>
          <media-seek-forward-button seekoffset="5"></media-seek-forward-button>
          <media-time-display showduration></media-time-display>
          <media-time-range style={{ flex: '1', minWidth: '100px' }}></media-time-range>
          <media-duration-display></media-duration-display>
          <media-mute-button></media-mute-button>
          <media-volume-range></media-volume-range>
          <media-fullscreen-button></media-fullscreen-button>
        </media-control-bar>
      </media-controller>
    );
  };

  const renderMedia = () => {
    switch (media.type) {
      case 'image':
        return (
          <div className="relative group">
            <div className="bg-black rounded-lg overflow-hidden">
              <img 
                src={media.url} 
                alt={media.filename} 
                className="w-full h-auto max-h-[60vh] object-contain"
              />
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrev}
                disabled={!hasPrev}
                className="bg-black/80 hover:bg-black/90 text-white"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNext}
                disabled={!hasNext}
                className="bg-black/80 hover:bg-black/90 text-white"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        );
      case 'video':
      case 'slideshow':
        return (
          <div className="space-y-4">
            <div className="bg-black rounded-lg overflow-hidden">
              <div className="flex items-center justify-center min-h-[300px] max-h-[80vh]">
                {renderVideo()}
              </div>
            </div>
            <div className="flex justify-between items-center px-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrev}
                disabled={!hasPrev}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNext}
                disabled={!hasNext}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center text-muted-foreground p-8">
            <AlertCircle className="mx-auto h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Unsupported media type</p>
            <p className="text-sm mt-2">This file format is not supported</p>
          </div>
        );
    }
  };

  return (
    <Card className={`shadow-media overflow-hidden ${className}`}>
      <CardContent className="p-0">
        {renderMedia()}
        
        {/* Media Info Footer */}
        <div className="p-4 border-t bg-card/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm truncate">{media.filename}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {media.type === 'slideshow' ? 'Generated Slideshow' : media.type}
                {media.duration && ` • ${Math.round(media.duration)}s`}
                {' • Media Chrome Controls'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {media.type === 'image' && <ImageIcon className="h-4 w-4 text-muted-foreground" />}
              {(media.type === 'video' || media.type === 'slideshow') && <Film className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};