import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Link2, FileVideo, FileImage, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onUpload: (source: File | string, type: 'file' | 'url' | 'google_drive') => void;
  isUploading?: boolean;
  slideshowOptions?: any;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, isUploading = false }) => {
  const [urlInput, setUrlInput] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 500 * 1024 * 1024) { // 500MB limit
        toast({
          title: "File too large",
          description: "Please upload a ZIP file smaller than 500MB",
          variant: "destructive"
        });
        return;
      }
      
      if (!file.name.toLowerCase().endsWith('.zip')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a ZIP file",
          variant: "destructive"
        });
        return;
      }

      onUpload(file, 'file');
    }
  }, [onUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false
  });

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
      return;
    }

    // Basic URL validation and source type detection
    try {
      new URL(urlInput);
      const isGoogleDrive = /drive\.google\.com|docs\.google\.com/.test(urlInput);
      const type = isGoogleDrive ? 'google_drive' : 'url';
      
      onUpload(urlInput, type);
      setUrlInput('');
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid HTTP(s) URL",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl shadow-media">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={uploadMode === 'file' ? 'gradient' : 'outline'}
              size="sm"
              onClick={() => setUploadMode('file')}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload ZIP
            </Button>
            <Button
              variant={uploadMode === 'url' ? 'gradient' : 'outline'}
              size="sm"
              onClick={() => setUploadMode('url')}
              className="flex-1"
            >
              <Link2 className="mr-2 h-4 w-4" />
              From URL
            </Button>
          </div>

          {uploadMode === 'file' ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-all duration-300 bg-gradient-hero
                ${isDragActive 
                  ? 'border-primary bg-primary/10 scale-105' 
                  : 'border-primary/20 hover:border-primary/40'
                }
                ${isUploading ? 'pointer-events-none opacity-50' : ''}
              `}
            >
              <input {...getInputProps()} />
              
              <div className="space-y-4">
                {isUploading ? (
                  <Loader2 className="mx-auto h-12 w-12 text-media-processing animate-processing-spin" />
                ) : (
                  <div className="mx-auto h-12 w-12 text-primary bg-primary/10 rounded-full flex items-center justify-center">
                    <Upload className="h-6 w-6" />
                  </div>
                )}
                
                <div>
                  <p className="text-lg font-medium">
                    {isUploading
                      ? 'Processing your upload...'
                      : isDragActive
                      ? 'Drop your ZIP file here'
                      : 'Drag & drop a ZIP file here'
                    }
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {!isUploading && 'or click to browse (max 500MB)'}
                  </p>
                </div>

                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileImage className="h-3 w-3" />
                    JPG, PNG
                  </div>
                  <div className="flex items-center gap-1">
                    <FileVideo className="h-3 w-3" />
                    MP4, WEBM
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="url-input">ZIP File URL</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="url-input"
                    placeholder="https://example.com/media.zip or Google Drive share link"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                    disabled={isUploading}
                  />
                  <Button
                    onClick={handleUrlSubmit}
                    disabled={isUploading || !urlInput.trim()}
                    variant={isUploading ? 'processing' : 'gradient'}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-processing-spin" />
                    ) : (
                      'Download'
                    )}
                  </Button>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Supports direct download links and public Google Drive share links
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};