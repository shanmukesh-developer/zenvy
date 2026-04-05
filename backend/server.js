const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB, getSequelize } = require('./config/db');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'socket_debug.txt');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
};

// SRM Gate-2 Delivery Point
const GATE2_COORD = { lat: 16.4645, lng: 80.5055 };

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const notifiedGateOrders = new Set();

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
        const room = String(orderId).trim();
        await socket.join(room);
        log(`[JOIN] ${socket.id} -> ${room}`);
      });
      socket.on('updateLocation', (data) => {
        const room = String(data.orderId).trim();
        io.to(room).emit('locationUpdated', { lat: data.lat, lng: data.lng });
        
        // Proximity Check for Gate-2 (50 meters)
        const distance = getDistanceFromLatLonInKm(data.lat, data.lng, GATE2_COORD.lat, GATE2_COORD.lng);
        if (distance < 0.05 && !notifiedGateOrders.has(room)) {
          io.to(room).emit('driverAtGate', { message: "Driver has reached GATE-2 Delivery Point" });
          notifiedGateOrders.add(room);
          log(`[GATE] ${data.orderId} reached Gate-2`);
        }
        
        log(`[LOC] ${data.orderId} moved to ${data.lat}, ${data.lng}`);
      });
      
      socket.on('sos_alert', (data) => {
        log(`[CRITICAL SOS] Triggered by ${data.riderName} (ID: ${data.riderId}) at ${data.timestamp}`);
        io.emit('sos_received', data);
      });

      socket.on('admin_announcement', (data) => {
        log(`[MEGAPHONE] Admin broadcast: "${data.message}" (type: ${data.type})`);
        io.emit('global_announcement', data);
      });

      socket.on('inventory_update', (data) => {
        log(`[INVENTORY] Item ${data.itemId} is now ${data.isAvailable ? 'available' : 'SOLD OUT'}`);
        io.emit('inventory_updated', data);
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
    console.error('❌ Server failed to start. CRITICAL ERROR:');
    console.error(error);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
};

startServer();
