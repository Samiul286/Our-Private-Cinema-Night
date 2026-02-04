import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { VideoState, ChatMessage, User } from '@/types';

export const useRoom = (roomId: string, userId: string, username: string) => {
  const socket = useSocket();
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hostId, setHostId] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState({ isSynced: true, drift: 0, isBuffering: false, lastSyncTime: 0, syncAttempts: 0, connectionQuality: 'good' });

  // computed property
  const isHost = hostId === userId;

  // Join room and setup listeners
  useEffect(() => {
    if (!roomId || !userId || !username) return;

    // Join the room
    socket.emit('join-room', { roomId, userId, username });

    const handleSyncState = (state: { videoState: VideoState, messages: ChatMessage[], users: User[], hostId: string }) => {
      console.log('Received sync-state:', state);
      if (state.videoState) setVideoState(state.videoState);
      if (state.messages) setMessages(state.messages);
      if (state.users) setUsers(state.users);
      if (state.hostId) setHostId(state.hostId);
    };

    const handleUpdateUsers = (updatedUsers: User[]) => {
      console.log('Received update-users:', updatedUsers);
      setUsers(updatedUsers);
    };

    const handleVideoState = (newState: VideoState) => {
      setVideoState(newState);
    };

    const handleChatMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    };

    const handleUserConnected = (connectedUserId: string) => {
      console.log('User connected:', connectedUserId);
    };

    const handleUserDisconnected = (disconnectedUserId: string) => {
      console.log('User disconnected:', disconnectedUserId);
    };

    const handleHostAssigned = ({ isHost }: { isHost: boolean }) => {
      if (isHost) {
        console.log('You are now the host');
        // Could trigger a toast notification here
      }
    };

    const handleHostChanged = ({ hostId, hostUsername }: { hostId: string, hostUsername: string }) => {
      console.log(`Host changed to ${hostUsername} (${hostId})`);
      setHostId(hostId);
    };

    const handleSyncCorrection = (correction: { playedSeconds: number, isPlaying: boolean, serverTimestamp: number, drift: number, connectionQuality?: string }) => {
      console.log(`Received sync correction. Drift: ${correction.drift.toFixed(2)}s, Quality: ${correction.connectionQuality || 'unknown'}`);
      // Update local video state with corrected values (VideoPlayer will react to this)
      setVideoState(prev => prev ? { ...prev, isPlaying: correction.isPlaying, playedSeconds: correction.playedSeconds, lastUpdated: Date.now() } : null);
      setSyncStatus(prev => ({ 
        ...prev, 
        isSynced: false, 
        drift: correction.drift,
        connectionQuality: correction.connectionQuality || 'unknown'
      }));

      // Reset synced status after a moment
      setTimeout(() => {
        setSyncStatus(prev => ({ ...prev, isSynced: true, drift: 0 }));
      }, 2000);
    };

    socket.on('sync-state', handleSyncState);
    socket.on('update-users', handleUpdateUsers);
    socket.on('video-state', handleVideoState);
    socket.on('chat-message', handleChatMessage);
    socket.on('user-connected', handleUserConnected);
    socket.on('user-disconnected', handleUserDisconnected);
    socket.on('host-assigned', handleHostAssigned);
    socket.on('host-changed', handleHostChanged);
    socket.on('sync-correction', handleSyncCorrection);

    return () => {
      socket.off('sync-state', handleSyncState);
      socket.off('update-users', handleUpdateUsers);
      socket.off('video-state', handleVideoState);
      socket.off('chat-message', handleChatMessage);
      socket.off('user-connected', handleUserConnected);
      socket.off('user-disconnected', handleUserDisconnected);
      socket.off('host-assigned', handleHostAssigned);
      socket.off('host-changed', handleHostChanged);
      socket.off('sync-correction', handleSyncCorrection);
    };
  }, [socket, roomId, userId, username]);

  const updateVideoState = useCallback((newState: Partial<VideoState>) => {
    if (!roomId) return;
    // include updatedBy field to track who made this change
    const stateWithMetadata = {
      ...newState,
      updatedBy: userId
    };
    socket.emit('video-state', { roomId, videoState: stateWithMetadata });
  }, [socket, roomId, userId]);

  const reportPosition = useCallback((playedSeconds: number, isBuffering: boolean = false) => {
    if (userId && roomId) {
      socket.emit('position-report', { roomId, userId, playedSeconds, isBuffering });
      if (isBuffering !== syncStatus.isBuffering) {
        socket.emit('buffer-state', { roomId, userId, isBuffering });
        setSyncStatus(prev => ({ ...prev, isBuffering }));
      }
    }
  }, [socket, roomId, userId, syncStatus.isBuffering]);

  const sendMessage = useCallback((message: string) => {
    if (!roomId || !message.trim()) return;
    const msg = {
      userId,
      username,
      message: message.trim(),
      // timestamp will be added by server
    };
    socket.emit('chat-message', { roomId, message: msg });
  }, [socket, roomId, userId, username]);

  const leaveRoom = useCallback(() => {
    // handled by disconnect
  }, []);

  return {
    videoState,
    messages,
    users,
    isHost,
    hostId,
    syncStatus,
    joinRoom: () => { },
    leaveRoom,
    updateVideoState,
    sendMessage,
    reportPosition
  };
};