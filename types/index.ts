export interface VideoState {
  isPlaying: boolean;
  playedSeconds: number;
  url: string;
  lastUpdated: number;
  updatedBy: string;
  serverTimestamp?: number;  // Server time when state was set
  isBuffering?: boolean;      // Client buffering state
  playbackRate?: number;      // For drift correction
}

export interface SyncStatus {
  isSynced: boolean;
  drift: number;              // Seconds of drift
  lastSyncTime: number;       // Timestamp of last sync
  syncAttempts: number;       // Number of sync attempts
  isBuffering: boolean;       // Current buffer state
  connectionQuality?: string; // Connection quality: good, fair, poor
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
  joinedAt?: number;
}

export interface Room {
  id: string;
  hostId: string;             // User ID of current host
  videoState: VideoState;
  users: { [userId: string]: User };
  messages: { [messageId: string]: ChatMessage };
  createdAt: number;
  syncCheckpoint?: number;    // Last sync checkpoint timestamp
}