import React from 'react';
import { Clock, CheckCircle, AlertCircle, Loader2, XCircle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export type SessionStatus = 'queued' | 'downloading' | 'processing' | 'ready' | 'generating_slideshow' | 'failed';

export interface Session {
  session_id: string;
  status: SessionStatus;
  submitted_at: string;
  expires_at: string;
  original_filename?: string;
  progress?: number;
  error?: string;
  mediaCount?: {
    images: number;
    videos: number;
  };
}

interface SessionStatusProps {
  sessions: Session[];
  onViewSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  loading?: boolean;
}

const getStatusConfig = (status: SessionStatus) => {
  switch (status) {
    case 'queued':
      return {
        icon: Clock,
        label: 'Queued',
        color: 'bg-muted text-muted-foreground',
        variant: 'secondary' as const
      };
    case 'downloading':
      return {
        icon: Download,
        label: 'Downloading',
        color: 'bg-media-processing text-primary-foreground',
        variant: 'default' as const
      };
    case 'processing':
      return {
        icon: Loader2,
        label: 'Processing',
        color: 'bg-media-processing text-primary-foreground animate-processing-spin',
        variant: 'default' as const
      };
    case 'ready':
      return {
        icon: CheckCircle,
        label: 'Ready',
        color: 'bg-media-success text-primary-foreground',
        variant: 'default' as const
      };
    case 'generating_slideshow':
      return {
        icon: Loader2,
        label: 'Slideshow generating',
        color: 'bg-media-processing text-primary-foreground animate-processing-spin',
        variant: 'default' as const
      };
    case 'failed':
      return {
        icon: XCircle,
        label: 'Failed',
        color: 'bg-destructive text-destructive-foreground',
        variant: 'destructive' as const
      };
  }
};

const formatTimeRemaining = (expiresAt: string) => {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m`;
  }
};

export const SessionStatus: React.FC<SessionStatusProps> = ({ 
  sessions, 
  onViewSession, 
  onDeleteSession,
  loading = false
}) => {
  if (loading) {
    return (
      <Card className="w-full max-w-2xl shadow-soft">
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">
            <Loader2 className="mx-auto h-12 w-12 mb-4 animate-spin" />
            <p className="text-lg font-medium mb-2">Loading sessions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (sessions.length === 0) {
    return (
      <Card className="w-full max-w-2xl shadow-soft">
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">
            <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No active sessions</p>
            <p className="text-sm">Upload a ZIP file to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl shadow-soft">
      <CardHeader>
        <CardTitle>Processing Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.map((session) => {
          const statusConfig = getStatusConfig(session.status);
          const StatusIcon = statusConfig.icon;
          
          return (
            <div
              key={session.session_id}
              className="p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded-full ${statusConfig.color}`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">
                        {session.original_filename 
                          ? `${session.original_filename.replace('.zip', '')}_${session.session_id.slice(0, 8)}`
                          : `Session ${session.session_id.slice(0, 8)}`
                        }
                      </p>
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground truncate">
                      Created {new Date(session.submitted_at).toLocaleString()}
                    </p>
                    
                    {session.mediaCount && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {session.mediaCount.images} images, {session.mediaCount.videos} videos
                      </p>
                    )}
                    
                    {session.error && (
                      <p className="text-xs text-destructive mt-1">{session.error}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      Expires in {formatTimeRemaining(session.expires_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.submitted_at).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {(session.status === 'ready' || session.status === 'generating_slideshow') && (
                      <Button
                        size="sm"
                        variant="gradient"
                        onClick={() => onViewSession(session.session_id)}
                      >
                        View
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeleteSession(session.session_id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Progress bar for active sessions */}
              {(session.status === 'downloading' || session.status === 'processing') && (
                <div className="mt-3">
                  <Progress 
                    value={session.progress || 0} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {session.progress || 0}% complete
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};