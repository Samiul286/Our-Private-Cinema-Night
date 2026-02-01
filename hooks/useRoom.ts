import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { VideoState, ChatMessage, User } from '@/types';

export const useRoom = (roomId: string, userId: string, username: string) => {
  const socket = useSocket();
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Join room and setup listeners
  useEffect(() => {
    if (!roomId || !userId || !username) return;

    // Join the room
    socket.emit('join-room', { roomId, userId, username });

    const handleSyncState = (state: { videoState: VideoState, messages: ChatMessage[], users: User[] }) => {
      console.log('Received sync-state:', state);
      if (state.videoState) setVideoState(state.videoState);
      if (state.messages) setMessages(state.messages);
      if (state.users) setUsers(state.users);
    };

    const handleUpdateUsers = (updatedUsers: User[]) => {
      console.log('Received update-users:', updatedUsers);
      setUsers(updatedUsers);
    };

    const handleVideoState = (newState: VideoState) => {
      // console.log('Received video-state:', newState);
      setVideoState(newState);
    };

    const handleChatMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    };

    const handleUserConnected = (connectedUserId: string) => {
      console.log('User connected:', connectedUserId);
      // Note: update-users overrides this usually, but good for notifications if needed
    };

    const handleUserDisconnected = (disconnectedUserId: string) => {
      console.log('User disconnected:', disconnectedUserId);
      // Note: update-users overrides this
    };

    socket.on('sync-state', handleSyncState);
    socket.on('update-users', handleUpdateUsers);
    socket.on('video-state', handleVideoState);
    socket.on('chat-message', handleChatMessage);
    socket.on('user-connected', handleUserConnected);
    socket.on('user-disconnected', handleUserDisconnected);

    return () => {
      socket.off('sync-state', handleSyncState);
      socket.off('update-users', handleUpdateUsers);
      socket.off('video-state', handleVideoState);
      socket.off('chat-message', handleChatMessage);
      socket.off('user-connected', handleUserConnected);
      socket.off('user-disconnected', handleUserDisconnected);

      // Emit leave-room when component unmounts
      socket.emit('leave-room', { roomId, userId });
    };
  }, [socket, roomId, userId, username]);

  const updateVideoState = useCallback((newState: Partial<VideoState>) => {
    if (!roomId) return;
    // Include updatedBy field to track who made this change
    const stateWithMetadata = {
      ...newState,
      updatedBy: userId
    };
    // Emit to server which will broadcast to all users
    socket.emit('video-state', { roomId, videoState: stateWithMetadata });
  }, [socket, roomId, userId]);

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

  // Leave room currently handled by simple disconnect or unmount logic in server
  // But we can add an explicit one if needed.
  const leaveRoom = useCallback(() => {
    if (roomId && userId) {
      socket.emit('leave-room', { roomId, userId });
    }
  }, [socket, roomId, userId]);

  return {
    videoState,
    messages,
    users,
    joinRoom: () => { }, // Handled in useEffect now
    leaveRoom,
    updateVideoState,
    sendMessage
  };
};