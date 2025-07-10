import React from 'react';
import { Settings, Clock, Monitor, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

export interface SlideshowConfig {
  duration: number;
  resolution: string;
  transition: string;
  includeAudio: boolean;
}

interface SlideshowOptionsProps {
  config: SlideshowConfig;
  onChange: (config: SlideshowConfig) => void;
}

export const SlideshowOptions: React.FC<SlideshowOptionsProps> = ({ config, onChange }) => {
  const updateConfig = (updates: Partial<SlideshowConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <Card className="w-full max-w-2xl shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Slideshow Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duration per Image */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Duration per Image: {config.duration}s
          </Label>
          <Slider
            value={[config.duration]}
            onValueChange={([value]) => updateConfig({ duration: value })}
            min={1}
            max={10}
            step={0.5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1s</span>
            <span>5s</span>
            <span>10s</span>
          </div>
        </div>

        {/* Resolution */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Resolution
          </Label>
          <Select value={config.resolution} onValueChange={(value) => updateConfig({ resolution: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1280x720">720p (1280x720)</SelectItem>
              <SelectItem value="1920x1080">1080p (1920x1080)</SelectItem>
              <SelectItem value="3840x2160">4K (3840x2160)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Transition Effect */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Transition Effect
          </Label>
          <Select value={config.transition} onValueChange={(value) => updateConfig({ transition: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="fade">Fade</SelectItem>
              <SelectItem value="crossfade">Crossfade</SelectItem>
              <SelectItem value="slide">Slide</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Include Audio Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div>
            <Label className="font-medium">Include Background Music</Label>
            <p className="text-sm text-muted-foreground">
              Use audio files from ZIP as background music
            </p>
          </div>
          <button
            onClick={() => updateConfig({ includeAudio: !config.includeAudio })}
            className={`
              relative w-12 h-6 rounded-full transition-colors duration-300
              ${config.includeAudio ? 'bg-primary' : 'bg-muted'}
            `}
          >
            <div
              className={`
                absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm
                transition-transform duration-300
                ${config.includeAudio ? 'translate-x-6' : 'translate-x-0.5'}
              `}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
};