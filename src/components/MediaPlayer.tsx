import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'slideshow';
  url: string;
  filename: string;
  thumbnail?: string;
  duration?: number; // for videos/slideshow
}

interface MediaPlayerProps {
  media: MediaItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  sessionId: string;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ 
  media, 
  currentIndex, 
  onIndexChange,
  sessionId 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentMedia = media[currentIndex];

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    if (currentMedia?.type === 'image') return;
    
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handlePrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : media.length - 1;
    onIndexChange(newIndex);
    setIsPlaying(false);
  };

  const handleNext = () => {
    const newIndex = currentIndex < media.length - 1 ? currentIndex + 1 : 0;
    onIndexChange(newIndex);
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = ([value]: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/session/${sessionId}`;
    if (navigator.share) {
      await navigator.share({
        title: 'Media Playlist',
        url: url
      });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  if (!currentMedia) {
    return (
      <Card className="w-full aspect-video bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">No media available</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Media Display */}
      <Card className="overflow-hidden shadow-media">
        <CardContent className="p-0 relative">
          <div className="aspect-video bg-black relative group">
            {currentMedia.type === 'image' ? (
              <img
                src={currentMedia.url}
                alt={currentMedia.filename}
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                src={currentMedia.url}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                controls={false}
              />
            )}
            
            {/* Overlay Controls */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {currentMedia.type !== 'image' && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handlePlayPause}
                  className="bg-black/50 hover:bg-black/70 text-white h-16 w-16 rounded-full"
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8" />
                  )}
                </Button>
              )}
            </div>
            
            {/* Media Type Badge */}
            <div className="absolute top-4 left-4">
              <Badge variant="secondary" className="bg-black/50 text-white">
                {currentMedia.type === 'slideshow' ? 'Generated Slideshow' : 
                 currentMedia.type === 'video' ? 'Video' : 'Image'}
              </Badge>
            </div>
            
            {/* Action Buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="bg-black/50 hover:bg-black/70 text-white"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="bg-black/50 hover:bg-black/70 text-white"
              >
                <a href={currentMedia.url} download={currentMedia.filename}>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{currentMedia.filename}</h3>
                <p className="text-sm text-muted-foreground">
                  {currentIndex + 1} of {media.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {media.filter(m => m.type === 'image').length} images,{' '}
                  {media.filter(m => m.type === 'video').length} videos
                </span>
              </div>
            </div>
            
            {/* Progress Bar for Videos */}
            {currentMedia.type !== 'image' && duration > 0 && (
              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  onValueChange={handleSeek}
                  min={0}
                  max={duration}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            )}
            
            {/* Playback Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                
                {currentMedia.type !== 'image' && (
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Volume Control */}
              {currentMedia.type !== 'image' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="w-20">
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      onValueChange={([value]) => {
                        setVolume(value);
                        setIsMuted(value === 0);
                      }}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};