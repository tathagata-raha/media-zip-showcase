import { useState, useEffect, useCallback } from 'react';
import { apiService, type Session, type SessionListResponse, type SessionStatus } from '@/lib/api';

export interface SessionWithProgress extends SessionListResponse {
  progress?: number;
  mediaCount?: {
    images: number;
    videos: number;
  };
}

export function useSessions() {
  const [sessions, setSessions] = useState<SessionWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all sessions
  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const sessionList = await apiService.getSessions();
      
      // Filter out expired sessions
      const now = Date.now();
      const activeSessions = sessionList.filter(session => {
        const expiresAt = new Date(session.expires_at).getTime();
        return expiresAt > now;
      });
      
      // Enhance sessions with additional data
      const enhancedSessions: SessionWithProgress[] = await Promise.all(
        activeSessions.map(async (session) => {
          try {
            // Get detailed session info for active sessions
            if (['queued', 'downloading', 'processing'].includes(session.status)) {
              const detailedSession = await apiService.getSession(session.session_id);
              
              // Calculate progress based on status
              let progress = 0;
              if (detailedSession.status === 'downloading') progress = 25;
              else if (detailedSession.status === 'processing') progress = 75;
              else if (detailedSession.status === 'ready') progress = 100;
              
              // Extract media count from manifest
              let mediaCount;
              if (detailedSession.manifest) {
                mediaCount = {
                  images: detailedSession.manifest.images?.length || 0,
                  videos: detailedSession.manifest.videos?.length || 0,
                };
              }
              
              return {
                ...session,
                progress,
                mediaCount,
              };
            }
            
            return session;
          } catch (err) {
            // If detailed fetch fails, return basic session info
            return session;
          }
        })
      );
      
      setSessions(enhancedSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for updates on active sessions
  useEffect(() => {
    fetchSessions();
    
    // Set up polling for active sessions
    const interval = setInterval(() => {
      const hasActiveSessions = sessions.some(
        session => ['queued', 'downloading', 'processing'].includes(session.status)
      );
      
      if (hasActiveSessions) {
        fetchSessions();
      }
    }, 3000); // Poll every 3 seconds for active sessions
    
    return () => clearInterval(interval);
  }, [fetchSessions, sessions]);

  // Add a new session to the list
  const addSession = useCallback((session: SessionWithProgress) => {
    setSessions(prev => [session, ...prev]);
  }, []);

  // Update a session
  const updateSession = useCallback((sessionId: string, updates: Partial<SessionWithProgress>) => {
    setSessions(prev => 
      prev.map(session => 
        session.session_id === sessionId 
          ? { ...session, ...updates }
          : session
      )
    );
  }, []);

  // Remove a session (local only)
  const removeSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(session => session.session_id !== sessionId));
  }, []);

  // Delete a session (API call + local removal)
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await apiService.deleteSession(sessionId);
      removeSession(sessionId);
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }, [removeSession]);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    addSession,
    updateSession,
    removeSession,
    deleteSession,
  };
} 