const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB, getSequelize } = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: function(origin, callback) { callback(null, origin || '*'); },
  credentials: true
}));
app.use(express.json());

// Connect to PostgreSQL, then initialize routes
const startServer = async () => {
  try {
    await connectDB();

    // Routes
    app.use('/api/users', require('./routes/userRoutes'));
    app.use('/api/restaurants', require('./routes/restaurantRoutes'));
    app.use('/api/orders', require('./routes/orderRoutes'));
    app.use('/api/delivery', require('./routes/deliveryPartnerRoutes'));
    app.use('/api/search', require('./routes/searchRoutes'));
    app.use('/api/blocks', require('./routes/blockRoutes'));
    app.use('/api/vault', require('./routes/vaultRoutes'));
    app.use('/api/admin', require('./routes/adminRoutes'));

    // Basic Health Check
    app.get('/', (req, res) => {
      res.status(200).json({ status: 'success', message: 'Zenvy API (PostgreSQL) is running...', version: '2.0.0' });
    });

    // Socket.io
    io.on('connection', (socket) => {
      console.log(`[SOCKET CONNECT] ${socket.id}`);
      socket.on('joinOrder', async (orderId) => {
        await socket.join(String(orderId).trim());
        console.log(`[SOCKET JOIN] ${socket.id} → room ${orderId}`);
      });
      socket.on('partnerLocationUpdate', (data) => {
        io.to(String(data.orderId).trim()).emit('partnerLocation', { lat: data.lat, lng: data.lng });
      });
      socket.on('disconnect', () => {
        console.log(`[SOCKET DISCONNECT] ${socket.id}`);
      });
    });

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();
