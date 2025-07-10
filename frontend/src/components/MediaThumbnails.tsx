import React from 'react';
import { type MediaItem } from './MediaPlayer';
import { ImageIcon, Film } from 'lucide-react';

interface MediaThumbnailsProps {
  media: MediaItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export const MediaThumbnails: React.FC<MediaThumbnailsProps> = ({ media, currentIndex, onSelect, className }) => {
  return (
    <div className={`space-y-3 ${className}`}>
        <h3 className="text-lg font-semibold px-1">Playlist</h3>
        <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {media.map((item, index) => {
                const isSelected = index === currentIndex;
                const Icon = item.type === 'image' ? ImageIcon : Film;
                return (
                    <button
                        key={item.id}
                        onClick={() => onSelect(index)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                            isSelected
                                ? 'bg-primary/10 text-primary ring-2 ring-primary/50'
                                : 'hover:bg-muted/50'
                        }`}
                    >
                        <div className="flex-shrink-0 w-16 h-12 bg-muted rounded-md flex items-center justify-center">
                           {item.type === 'slideshow' ? (
                             <img src="/slideshow-thumb.png" alt="Slideshow" className="w-full h-full object-cover rounded-md"/>
                           ) : item.type === 'image' ? (
                             <img src={item.url} alt={item.filename} className="w-full h-full object-cover rounded-md"/>
                           ) : (
                            <Icon className="w-6 h-6 text-muted-foreground" />
                           )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.filename}</p>
                            <p className="text-xs text-muted-foreground">{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    </div>
  );
};