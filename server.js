const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Store room and user information
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  // Join room
  socket.on('joinRoom', ({ roomId, isAdmin }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      // If room doesn't exist and user is admin, create new room
      if (isAdmin) {
        rooms.set(roomId, {
          admin: socket.id,
          players: new Set(),
          timer: null,
          gameStarted: false
        });
      } else {
        socket.emit('error', { message: 'Room does not exist' });
        socket.disconnect();
        return;
      }
    } else {
      const room = rooms.get(roomId);
      
      if (isAdmin) {
        if (room.admin) {
          socket.emit('error', { message: 'Room already has an admin' });
          socket.disconnect();
          return;
        }
        room.admin = socket.id;
      } else {
        if (room.players.size >= 2) {
          socket.emit('error', { message: 'Room is full' });
          socket.disconnect();
          return;
        }
        room.players.add(socket.id);
      }
    }

    const room = rooms.get(roomId);
    socket.emit('joined', {
      isAdmin: room.admin === socket.id,
      playerCount: room.players.size,
      gameStarted: room.gameStarted
    });

    // Notify all users in the room about the new player count
    io.to(roomId).emit('playerCountUpdate', {
      playerCount: room.players.size
    });
  });

  // Handle drawing (only allowed for players when timer is running)
  socket.on('draw', (data) => {
    const roomId = Array.from(socket.rooms)[1];
    if (roomId) {
      const room = rooms.get(roomId);
      if (room && room.gameStarted && room.players.has(socket.id)) {
        socket.to(roomId).emit('draw', data);
      }
    }
  });

  // Handle timer controls (admin only)
  socket.on('setTimer', ({ roomId, duration }) => {
    const room = rooms.get(roomId);
    if (room && room.admin === socket.id) {
      if (room.timer) {
        clearTimeout(room.timer);
      }
      room.gameStarted = true;
      io.to(roomId).emit('timerStart', { duration });
      room.timer = setTimeout(() => {
        room.gameStarted = false;
        io.to(roomId).emit('timerEnd');
      }, duration * 1000);
    }
  });

  // Handle stop game (admin only)
  socket.on('stopGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.admin === socket.id) {
      if (room.timer) {
        clearTimeout(room.timer);
      }
      room.gameStarted = false;
      room.timer = null;
      io.to(roomId).emit('gameStopped');
    }
  });

  // Handle clear canvas (admin only)
  socket.on('clearCanvas', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.admin === socket.id) {
      io.to(roomId).emit('canvasCleared');
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.admin === socket.id) {
        room.admin = null;
        if (room.timer) {
          clearTimeout(room.timer);
        }
        room.gameStarted = false;
        io.to(roomId).emit('adminLeft');
      } else if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        io.to(roomId).emit('playerCountUpdate', {
          playerCount: room.players.size
        });
      }
      
      // Clean up empty rooms
      if (!room.admin && room.players.size === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 