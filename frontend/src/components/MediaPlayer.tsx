import React from 'react';
import { PlayCircle, Image as ImageIcon, Film } from 'lucide-react';

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'slideshow';
  url: string;
  filename: string;
  duration?: number;
}

interface MediaPlayerProps {
  media: MediaItem | null;
  className?: string;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ media, className }) => {
  if (!media) {
    return (
      <div className={`flex items-center justify-center bg-muted/30 rounded-lg ${className}`}>
        <div className="text-center text-muted-foreground">
          <PlayCircle className="mx-auto h-16 w-16 opacity-50 mb-4" />
          <p className="text-lg font-medium">Select an item to play</p>
        </div>
      </div>
    );
  }

  const renderMedia = () => {
    switch (media.type) {
      case 'image':
        return <img src={media.url} alt={media.filename} className="w-full h-full object-contain" />;
      case 'video':
      case 'slideshow':
        return (
          <video key={media.url} controls autoPlay className="w-full h-full" controlsList="nodownload">
            <source src={media.url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        );
      default:
        return (
          <div className="text-center text-muted-foreground">
            <p>Unsupported media type</p>
          </div>
        );
    }
  };
  
  const Icon = media.type === 'image' ? ImageIcon : Film;

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden shadow-lg ${className}`}>
      {renderMedia()}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span>{media.filename}</span>
      </div>
    </div>
  );
};