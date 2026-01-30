export interface VideoState {
  isPlaying: boolean;
  playedSeconds: number;
  url: string;
  lastUpdated: number;
  updatedBy: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
  joinedAt: number;
}

export interface Room {
  id: string;
  videoState: VideoState;
  users: { [userId: string]: User };
  messages: { [messageId: string]: ChatMessage };
  createdAt: number;
}