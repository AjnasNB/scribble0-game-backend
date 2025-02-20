const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://scribble0byajnas.vercel.app',
  'http://scribble.ajnasnb.com',
  'https://scribble.ajnasnb.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"]
  }
});

const PORT =  5000;
const MAX_PLAYERS = 8;

// Test endpoints
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend is running!',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/room-info', (req, res) => {
  const roomStats = {
    totalRooms: rooms.size,
    activeRooms: Array.from(rooms.entries()).map(([roomId, room]) => ({
      roomId,
      players: room.players.size,
      hasAdmin: !!room.admin,
      isGameRunning: room.gameStarted
    }))
  };
  res.json(roomStats);
});

app.get('/api/server-status', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    maxPlayers: MAX_PLAYERS
  });
});

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
        if (room.players.size >= MAX_PLAYERS) {
          socket.emit('error', { message: 'Room is full (max 8 players)' });
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
      maxPlayers: MAX_PLAYERS,
      gameStarted: room.gameStarted
    });

    // Notify all users in the room about the new player count
    io.to(roomId).emit('playerCountUpdate', {
      playerCount: room.players.size,
      maxPlayers: MAX_PLAYERS
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
          playerCount: room.players.size,
          maxPlayers: MAX_PLAYERS
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