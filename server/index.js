const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Health metrics
const serverMetrics = {
  startTime: Date.now(),
  totalConnections: 0,
  currentConnections: 0,
  totalRoomsCreated: 0,
  totalMessages: 0,
  totalDisconnections: 0,
  errors: []
};

app.get('/', (req, res) => {
  res.send('Watch Party Server is running');
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  const uptime = Date.now() - serverMetrics.startTime;
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'healthy',
    uptime: uptime,
    uptimeFormatted: formatUptime(uptime),
    timestamp: new Date().toISOString(),
    connections: serverMetrics.currentConnections,
    activeRooms: Object.keys(rooms).length,
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
    }
  });
});

// Detailed health check endpoint
app.get('/health/detailed', (req, res) => {
  const uptime = Date.now() - serverMetrics.startTime;
  const memoryUsage = process.memoryUsage();

  // Calculate room statistics
  const roomStats = Object.entries(rooms).map(([roomId, room]) => ({
    roomId,
    userCount: Object.keys(room.users).length,
    messageCount: room.messages.length,
    videoUrl: room.videoState.url || 'none',
    isPlaying: room.videoState.isPlaying
  }));

  res.status(200).json({
    status: 'healthy',
    server: {
      uptime: uptime,
      uptimeFormatted: formatUptime(uptime),
      startTime: new Date(serverMetrics.startTime).toISOString(),
      currentTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    },
    metrics: {
      totalConnections: serverMetrics.totalConnections,
      currentConnections: serverMetrics.currentConnections,
      totalDisconnections: serverMetrics.totalDisconnections,
      totalRoomsCreated: serverMetrics.totalRoomsCreated,
      activeRooms: Object.keys(rooms).length,
      totalMessages: serverMetrics.totalMessages,
      averageMessagesPerConnection: serverMetrics.totalConnections > 0
        ? (serverMetrics.totalMessages / serverMetrics.totalConnections).toFixed(2)
        : 0
    },
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapUsedMB: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: memoryUsage.heapTotal,
      heapTotalMB: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: memoryUsage.rss,
      rssMB: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      external: memoryUsage.external,
      externalMB: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
    },
    rooms: roomStats,
    recentErrors: serverMetrics.errors.slice(-10) // Last 10 errors
  });
});

// Helper function to format uptime
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for simplicity in this demo, restrict in prod
    methods: ['GET', 'POST']
  }
});

// Store room state in memory for this simple implementation
// { [roomId]: { users: {}, videoState: {}, messages: [] } }
const rooms = {};

io.on('connection', (socket) => {
  serverMetrics.totalConnections++;
  serverMetrics.currentConnections++;
  console.log(`[CONNECTION] Socket ${socket.id} connected | Current: ${serverMetrics.currentConnections} | Total: ${serverMetrics.totalConnections}`);

  socket.on('join-room', ({ roomId, userId, username }) => {
    socket.join(roomId);
    console.log(`[JOIN-ROOM] User "${username}" (${userId}) joined room "${roomId}" via socket ${socket.id}`);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: {},
        hostId: userId, // First user becomes host
        videoState: {
          isPlaying: false,
          playedSeconds: 0,
          url: '',
          lastUpdated: Date.now(),
          updatedBy: '',
          serverTimestamp: Date.now(),
          isBuffering: false,
          playbackRate: 1.0
        },
        messages: [],
        createdAt: Date.now(),
        syncCheckpoint: Date.now()
      };
      serverMetrics.totalRoomsCreated++;
      console.log(`[ROOM] Room ${roomId} created with host ${username} (${userId}) | Total rooms: ${serverMetrics.totalRoomsCreated}`);
    }

    rooms[roomId].users[userId] = { id: userId, username, socketId: socket.id };

    // Broadcast updated user list to room
    io.to(roomId).emit('update-users', Object.values(rooms[roomId].users));

    // Send current room state to the new user
    socket.emit('sync-state', {
      videoState: rooms[roomId].videoState,
      messages: rooms[roomId].messages,
      users: Object.values(rooms[roomId].users),
      hostId: rooms[roomId].hostId
    });

    // Notify user if they are the host
    if (rooms[roomId].hostId === userId) {
      socket.emit('host-assigned', { isHost: true });
      console.log(`[HOST] ${username} (${userId}) is the host of room ${roomId}`);
    }

    // Notify others
    socket.to(roomId).emit('user-connected', userId);
  });

  socket.on('video-state', ({ roomId, videoState }) => {
    if (rooms[roomId]) {
      const now = Date.now();

      // Merge the new video state with existing state and add server metadata
      rooms[roomId].videoState = {
        ...rooms[roomId].videoState,
        ...videoState,
        lastUpdated: now,
        serverTimestamp: now
      };

      // Log state change for debugging
      const action = videoState.isPlaying !== undefined
        ? (videoState.isPlaying ? 'PLAY' : 'PAUSE')
        : videoState.playedSeconds !== undefined
          ? 'SEEK'
          : 'UPDATE';

      console.log(`[SYNC] ${action} | Room: ${roomId} | By: ${videoState.updatedBy} | Position: ${rooms[roomId].videoState.playedSeconds.toFixed(2)}s | Playing: ${rooms[roomId].videoState.isPlaying}`);

      // Broadcast the updated video state to all users in the room
      io.to(roomId).emit('video-state', rooms[roomId].videoState);
    }
  });

  // Handle client position reports for drift detection
  socket.on('position-report', ({ roomId, userId, playedSeconds, isBuffering }) => {
    if (rooms[roomId]) {
      const serverState = rooms[roomId].videoState;
      const drift = Math.abs(playedSeconds - serverState.playedSeconds);
      const now = Date.now();

      // Track user connection quality
      if (!rooms[roomId].users[userId].connectionQuality) {
        rooms[roomId].users[userId].connectionQuality = {
          lastReportTime: now,
          averageDrift: 0,
          reportCount: 0,
          quality: 'good' // good, fair, poor
        };
      }

      const quality = rooms[roomId].users[userId].connectionQuality;
      quality.reportCount++;
      quality.averageDrift = ((quality.averageDrift * (quality.reportCount - 1)) + drift) / quality.reportCount;
      quality.lastReportTime = now;

      // Determine connection quality based on average drift
      if (quality.averageDrift < 0.5) {
        quality.quality = 'good';
      } else if (quality.averageDrift < 1.5) {
        quality.quality = 'fair';
      } else {
        quality.quality = 'poor';
      }

      // If drift is significant and video is playing, send correction
      if (drift > 0.3 && serverState.isPlaying && !isBuffering) { // Tighter threshold
        console.log(`[DRIFT] Detected ${drift.toFixed(2)}s drift for user ${userId} in room ${roomId} (Quality: ${quality.quality})`);

        // Send targeted sync correction to this specific client
        const targetSocketId = rooms[roomId].users[userId]?.socketId;
        if (targetSocketId) {
          io.to(targetSocketId).emit('sync-correction', {
            playedSeconds: serverState.playedSeconds,
            isPlaying: serverState.isPlaying,
            serverTimestamp: Date.now(),
            drift: drift,
            connectionQuality: quality.quality
          });
        }
      }
    }
  });

  // Handle buffer state changes
  socket.on('buffer-state', ({ roomId, userId, isBuffering }) => {
    if (rooms[roomId] && rooms[roomId].users[userId]) {
      console.log(`[BUFFER] User ${userId} in room ${roomId} is ${isBuffering ? 'buffering' : 'ready'}`);

      // Broadcast buffer state to other users for awareness
      socket.to(roomId).emit('user-buffer-state', { userId, isBuffering });
    }
  });

  socket.on('chat-message', ({ roomId, message }) => {
    if (rooms[roomId]) {
      const msg = { ...message, timestamp: Date.now() };
      rooms[roomId].messages.push(msg);
      serverMetrics.totalMessages++;
      // Keep only last 100 messages to prevent memory explosion
      if (rooms[roomId].messages.length > 100) {
        rooms[roomId].messages.shift();
      }
      io.to(roomId).emit('chat-message', msg);
    }
  });

  // Signaling
  socket.on('signal', ({ roomId, to, signal }) => {
    // Find socket ID of the target user if possible, or just broadcast to room unique filtering on client
    // Better: We mapped userId to socketId in rooms[roomId].users
    if (rooms[roomId] && rooms[roomId].users[to]) {
      const targetSocketId = rooms[roomId].users[to].socketId;
      io.to(targetSocketId).emit('signal', { from: signal.from, type: signal.type, data: signal.data });
    } else {
      // Fallback or just broadcast to room (client must filter)
      // socket.to(roomId).emit('signal', signal); 
      // We will adhere to the plan: "to specific socket ID" is better for performance
      console.warn(`Target user ${to} not found in room ${roomId}`);
    }
  });

  socket.on('disconnecting', () => {
    const roomsJoined = [...socket.rooms];
    roomsJoined.forEach(roomId => {
      if (rooms[roomId]) {
        // Find user ID by socket ID
        const userId = Object.keys(rooms[roomId].users).find(key => rooms[roomId].users[key].socketId === socket.id);
        if (userId) {
          const username = rooms[roomId].users[userId].username;
          const wasHost = rooms[roomId].hostId === userId;

          delete rooms[roomId].users[userId];
          io.to(roomId).emit('user-disconnected', userId);
          io.to(roomId).emit('update-users', Object.values(rooms[roomId].users));
          console.log(`[DISCONNECT] User ${username} (${userId}) left room ${roomId}`);

          // Handle host transfer if the disconnecting user was the host
          if (wasHost && Object.keys(rooms[roomId].users).length > 0) {
            // Assign next user as host (first in the users object)
            const newHostId = Object.keys(rooms[roomId].users)[0];
            const newHost = rooms[roomId].users[newHostId];
            rooms[roomId].hostId = newHostId;

            console.log(`[HOST] Host transferred to ${newHost.username} (${newHostId}) in room ${roomId}`);

            // Notify all users of the new host
            io.to(roomId).emit('host-changed', {
              hostId: newHostId,
              hostUsername: newHost.username
            });

            // Notify the new host specifically
            io.to(newHost.socketId).emit('host-assigned', { isHost: true });
          }

          if (Object.keys(rooms[roomId].users).length === 0) {
            delete rooms[roomId];
            console.log(`[ROOM] Room ${roomId} deleted (empty)`);
          }
        }
      }
    });
  });

  socket.on('disconnect', (reason) => {
    serverMetrics.currentConnections--;
    serverMetrics.totalDisconnections++;
    console.log(`[DISCONNECT] Socket ${socket.id} disconnected (Reason: ${reason}) | Current: ${serverMetrics.currentConnections}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
