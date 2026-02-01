const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('Watch Party Server is running');
});

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
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, userId, username }) => {
    socket.join(roomId);
    console.log(`User ${username} (${userId}) joined room ${roomId}`);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: {},
        videoState: { isPlaying: false, playedSeconds: 0, url: '', lastUpdated: Date.now(), updatedBy: '' },
        messages: []
      };
    }

    rooms[roomId].users[userId] = { id: userId, username, socketId: socket.id };

    // Broadcast updated user list to room
    io.to(roomId).emit('update-users', Object.values(rooms[roomId].users));

    // Send current room state to the new user
    socket.emit('sync-state', {
      videoState: rooms[roomId].videoState,
      messages: rooms[roomId].messages,
      users: Object.values(rooms[roomId].users)
    });

    // Notify others
    socket.to(roomId).emit('user-connected', userId);
  });

  socket.on('video-state', ({ roomId, videoState }) => {
    if (rooms[roomId]) {
      // Merge the new video state with existing state and add server metadata
      rooms[roomId].videoState = {
        ...rooms[roomId].videoState,
        ...videoState,
        lastUpdated: Date.now()
      };
      // Broadcast the updated video state to all users in the room (including sender for confirmation)
      io.to(roomId).emit('video-state', rooms[roomId].videoState);
    }
  });

  socket.on('chat-message', ({ roomId, message }) => {
    if (rooms[roomId]) {
      const msg = { ...message, timestamp: Date.now() };
      rooms[roomId].messages.push(msg);
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

  socket.on('leave-room', ({ roomId, userId }) => {
    console.log(`User ${userId} explicitly leaving room ${roomId}`);
    
    if (rooms[roomId] && rooms[roomId].users[userId]) {
      const username = rooms[roomId].users[userId].username;
      delete rooms[roomId].users[userId];
      
      socket.leave(roomId);
      
      io.to(roomId).emit('user-disconnected', userId);
      io.to(roomId).emit('update-users', Object.values(rooms[roomId].users));
      console.log(`User ${username} (${userId}) left room ${roomId}`);

      if (Object.keys(rooms[roomId].users).length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted (empty)`);
      }
    }
  });

  socket.on('disconnecting', () => {
    const roomsJoined = [...socket.rooms];
    roomsJoined.forEach(roomId => {
      // Skip the socket's own room (socket.id is always in socket.rooms)
      if (roomId === socket.id) return;
      
      if (rooms[roomId]) {
        // Find user ID by socket ID
        const userId = Object.keys(rooms[roomId].users).find(key => rooms[roomId].users[key].socketId === socket.id);
        if (userId) {
          const username = rooms[roomId].users[userId].username;
          delete rooms[roomId].users[userId];
          io.to(roomId).emit('user-disconnected', userId);
          io.to(roomId).emit('update-users', Object.values(rooms[roomId].users));
          console.log(`User ${username} (${userId}) left room ${roomId}`);

          if (Object.keys(rooms[roomId].users).length === 0) {
            delete rooms[roomId];
            console.log(`Room ${roomId} deleted (empty)`);
          }
        }
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
