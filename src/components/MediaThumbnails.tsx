import React from 'react';
import { Play, Image as ImageIcon, Film } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { MediaItem } from './MediaPlayer';

interface MediaThumbnailsProps {
  media: MediaItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export const MediaThumbnails: React.FC<MediaThumbnailsProps> = ({ 
  media, 
  currentIndex, 
  onSelect 
}) => {
  const getMediaIcon = (type: MediaItem['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'video':
        return <Film className="h-4 w-4" />;
      case 'slideshow':
        return <Play className="h-4 w-4" />;
    }
  };

  const getMediaBadgeColor = (type: MediaItem['type']) => {
    switch (type) {
      case 'image':
        return 'bg-blue-500';
      case 'video':
        return 'bg-green-500';
      case 'slideshow':
        return 'bg-purple-500';
    }
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <h3 className="font-medium mb-4">Media Gallery</h3>
        <ScrollArea className="h-96">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {media.map((item, index) => (
              <button
                key={item.id}
                onClick={() => onSelect(index)}
                className={`
                  group relative aspect-square rounded-lg overflow-hidden
                  border-2 transition-all duration-200
                  ${index === currentIndex 
                    ? 'border-primary shadow-glow ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                  }
                `}
              >
                {/* Thumbnail */}
                <div className="w-full h-full bg-muted relative">
                  {item.type === 'image' ? (
                    <img
                      src={item.thumbnail || item.url}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    </div>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-full h-full flex items-center justify-center">
                      {item.type !== 'image' && (
                        <div className="bg-black/50 rounded-full p-2">
                          <Play className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Type Badge */}
                  <div className="absolute top-2 left-2">
                    <div className={`
                      p-1 rounded-full text-white text-xs
                      ${getMediaBadgeColor(item.type)}
                    `}>
                      {getMediaIcon(item.type)}
                    </div>
                  </div>
                  
                  {/* Current Indicator */}
                  {index === currentIndex && (
                    <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none">
                      <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                        ▶
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Filename */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2">
                  <p className="text-xs truncate" title={item.filename}>
                    {item.filename}
                  </p>
                  {item.duration && (
                    <p className="text-xs opacity-75">
                      {Math.floor(item.duration / 60)}:{(item.duration % 60).toFixed(0).padStart(2, '0')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
        
        {/* Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              {media.filter(m => m.type === 'image').length} images
            </div>
            <div className="flex items-center gap-1">
              <Film className="h-4 w-4" />
              {media.filter(m => m.type === 'video').length} videos
            </div>
            {media.some(m => m.type === 'slideshow') && (
              <div className="flex items-center gap-1">
                <Play className="h-4 w-4" />
                Generated slideshow
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};