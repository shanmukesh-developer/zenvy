require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const logFile = path.join(__dirname, 'socket_debug.txt');
const log = (msg) => {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
  } catch (_) { /* file may not exist — ignore */ }
};

// Surge Pricing Engine (Zone-Aware) ────────────────────────
const SURGE_WINDOW_MS = 2 * 60 * 1000;
const SURGE_THRESHOLD = 4;
const SURGE_MULTIPLIER = 1.25;

let zoneOrders = {}; // { zoneName: [timestamps] }
let activeSurgeZones = new Set();

function checkSurgeState(io, zone = 'Amaravathi_Central') {
  if (!zoneOrders[zone]) zoneOrders[zone] = [];
  
  const now = Date.now();
  zoneOrders[zone].push(now); // Track incoming order for this zone
  
  // Clean up old timestamps for this zone
  zoneOrders[zone] = zoneOrders[zone].filter(t => now - t < SURGE_WINDOW_MS);
  
  const count = zoneOrders[zone].length;
  const isNowSurge = count >= SURGE_THRESHOLD;
  const wasSurge = activeSurgeZones.has(zone);

  if (!wasSurge && isNowSurge) {
    activeSurgeZones.add(zone);
    io.emit('surge_active', { zone, multiplier: SURGE_MULTIPLIER, orderCount: count });
    log(`[SURGE] Zone ${zone} ACTIVE — ${count} orders`);
  } else if (wasSurge && !isNowSurge) {
    activeSurgeZones.delete(zone);
    io.emit('surge_ended', { zone });
    log(`[SURGE] Zone ${zone} ENDED`);
  }
}

// Periodic cleanup and check for all zones
setInterval(() => {
  const now = Date.now();
  Object.keys(zoneOrders).forEach(zone => {
    const oldCount = zoneOrders[zone].length;
    zoneOrders[zone] = zoneOrders[zone].filter(t => now - t < SURGE_WINDOW_MS);
    if (oldCount >= SURGE_THRESHOLD && zoneOrders[zone].length < SURGE_THRESHOLD) {
      activeSurgeZones.delete(zone);
      if (typeof io !== 'undefined') io.emit('surge_ended', { zone });
      log(`[SURGE] Zone ${zone} ENDED (Timeout)`);
    }
  });
}, 30000);

// Periodic cleanup and check for all zones

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002'
];

// 🌐 Production-Resilient CORS Handler
const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  // Allow any Render subdomain for this specific project
  if (origin.includes('hostelbites') && origin.endsWith('.onrender.com')) return true;
  if (origin.includes('zenvy') && origin.endsWith('.onrender.com')) return true;
  return false;
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  connectTimeout: 45000,
  pingTimeout: 20000,
  pingInterval: 25000
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    nexus: 'connected', 
    timestamp: new Date(),
    uptime: process.uptime()
  });
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

    // 🚀 Automated One-Time Production Seed
    const { unifiedSeed } = require('./scripts/unified_seed');
    const { getUserModel } = require('./models/User');
    const User = getUserModel();
    if (User) {
      const userCount = await User.count();
      const { getSequelize } = require('./config/db');
      const instance = getSequelize();
      const Restaurant = instance.models.Restaurant;
      const restCount = Restaurant ? await Restaurant.count() : 0;
      
      if (userCount === 0 || restCount === 0) {
        console.log(`🌱 [AUTO_SEED] Data missing (Users: ${userCount}, Rests: ${restCount}). Initializing...`);
        await unifiedSeed();
        console.log('✅ [AUTO_SEED] Production defaults initialized.');
      }
    }

    // 🦾 Secure Manual Seed Trigger (Free Tier workaround)
    app.post('/api/seed', async (req, res) => {
      const { key } = req.body;
      if (key === (process.env.JWT_SECRET || 'nexus_protocol_9')) {
        console.log('📥 [MANUAL_SEED] Triggered via API');
        await unifiedSeed();
        return res.json({ message: 'Seeding complete' });
      }
      res.status(403).json({ error: 'Access Denied' });
    });
    app.use('/api/blocks', require('./routes/blockRoutes'));
    app.use('/api/vault', require('./routes/vaultRoutes'));
    app.use('/api/admin', require('./routes/adminRoutes'));
    app.use('/api/rewards', require('./routes/rewardRoutes'));
    app.use('/api/community', require('./routes/communityRoutes'));
    
    // Global Error Handler
    const { errorHandler } = require('./middleware/errorMiddleware');
    app.use(errorHandler);

    // Serve uploaded files statically
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    app.use('/uploads', express.static(uploadsDir));

    // Persistent Base64 Image Storage (survives on Render)
    const storage = multer.memoryStorage();
    const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
    
    app.post('/api/upload', upload.single('image'), (req, res) => {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      
      const mimetype = req.file.mimetype;
      const base64Data = req.file.buffer.toString('base64');
      const imageUrl = `data:${mimetype};base64,${base64Data}`;
      
      res.json({ imageUrl });
    });

    // Basic Health Check
    app.get('/', (req, res) => {
      res.status(200).json({ status: 'success', message: 'Zenvy API (PostgreSQL) is running...', version: '2.0.1' });
    });

    // Socket.io
    io.on('connection', (socket) => {
      console.log(`[SOCKET CONNECT] ${socket.id}`);
      socket.on('joinOrder', async (orderId) => {
        const room = String(orderId).trim();
        await socket.join(room);
        log(`[JOIN] ${socket.id} -> ${room}`);
      });
      socket.on('joinRoom', async (roomName) => {
        const room = String(roomName).trim();
        await socket.join(room);
        log(`[JOIN_ROOM] ${socket.id} -> ${room}`);
      });
      socket.on('joinAdmin', async () => {
        await socket.join('admin-room');
        log(`[JOIN_ADMIN] ${socket.id}`);
      });
      socket.on('updateLocation', (data) => {
        const room = String(data.orderId).trim();
        io.to(room).emit('checkpointUpdated', { currentCheckpoint: data.currentCheckpoint });
        log(`[CHECKPOINT] ${data.orderId} → ${data.currentCheckpoint}`);
      });
      
      socket.on('sos_alert', (data) => {
        log(`[CRITICAL SOS] Triggered by ${data.riderName} (ID: ${data.riderId}) at ${data.timestamp}`);
        io.to('admin-room').emit('sos_received', data);
      });

      socket.on('admin_announcement', (data) => {
        log(`[MEGAPHONE] Admin broadcast: "${data.message}" (type: ${data.type})`);
        io.emit('global_announcement', data);
      });

      socket.on('inventory_update', (data) => {
        log(`[INVENTORY] Item ${data.itemId} is now ${data.isAvailable ? 'available' : 'SOLD OUT'}`);
        io.emit('inventory_updated', data);
      });

      socket.on('typing_start', (data) => {
        socket.to(String(data.orderId)).emit('typing_start', { sender: data.sender });
      });

      socket.on('typing_end', (data) => {
        socket.to(String(data.orderId)).emit('typing_end', { sender: data.sender });
      });

      socket.on('sendMessage', (data) => {
        const room = String(data.orderId).trim();
        log(`[CHAT] ${data.senderRole} (${data.sender}) in room ${room}: ${data.message}`);
        io.to(room).emit('receiveMessage', {
          sender: data.sender,
          senderRole: data.senderRole,
          message: data.message,
          timestamp: new Date()
        });
      });

      socket.on('report_issue', (data) => {
        const room = String(data.orderId).trim();
        log(`[ISSUE] ${data.senderRole} reported: ${data.issueType} for order ${room}`);
        // Notify both parties in the room and the admin
        io.to(room).emit('issue_alert', {
          orderId: data.orderId,
          senderRole: data.senderRole,
          issueType: data.issueType,
          details: data.details,
          timestamp: new Date()
        });
        io.to('admin-room').emit('admin_issue_reported', data);
      });

      // ── Cross-Portal: Rider ↔ Admin ↔ Customer ────────────────

      // Rider came online: broadcast to admin dashboard
      socket.on('rider_connected', (data) => {
        log(`[RIDER ONLINE] ${data.name} (${data.driverId})`);
        io.to('admin-room').emit('admin_rider_online', { riderId: data.driverId, name: data.name, timestamp: new Date().toISOString() });
      });

      // Rider went offline
      socket.on('rider_disconnected', (data) => {
        log(`[RIDER OFFLINE] ${data.driverId}`);
        io.to('admin-room').emit('admin_rider_offline', { riderId: data.driverId, timestamp: new Date().toISOString() });
      });

      // Rider toggled online/offline status
      socket.on('rider_status_change', (data) => {
        log(`[RIDER STATUS] ${data.name} → ${data.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        io.to('admin-room').emit('admin_rider_status', { riderId: data.riderId, name: data.name, isOnline: data.isOnline });
      });

      // Rider accepted → notify admin + join the broadcast room
      socket.on('rider_accepted', async (data) => {
        const room = String(data.orderId).trim();
        await socket.join(room);
        log(`[RIDER ACCEPTED] ${data.riderName} accepted order ${data.orderId}`);
        io.to('admin-room').emit('admin_order_accepted', { orderId: data.orderId, riderId: data.riderId, riderName: data.riderName });
      });

      // Rider live GPS → admin map + customer tracking (already via updateLocation, this is admin stream)
      socket.on('rider_location_update', (data) => {
        // Broadcast checkpoint to admin dashboard room ONLY
        io.to('admin-room').emit('admin_rider_location', {
          riderId: data.riderId,
          riderName: data.riderName,
          currentCheckpoint: data.currentCheckpoint,
          activeOrderCount: data.activeOrderCount,
          isOnline: data.isOnline,
          timestamp: Date.now()
        });
        // Also emit to specific order room for customer tracking
        if (data.activeOrderId) {
            io.to(String(data.activeOrderId)).emit('checkpointUpdated', { currentCheckpoint: data.currentCheckpoint });
        }
        log(`[GPS] Rider ${data.riderName} at ${data.currentCheckpoint}`);
      });

      // Rider completed a delivery
      socket.on('rider_delivered', (data) => {
        log(`[DELIVERED] ${data.riderName} completed order ${data.orderId} (+₹${data.earnings})`);
        io.to('admin-room').emit('admin_delivery_complete', {
          orderId: data.orderId,
          riderId: data.riderId,
          riderName: data.riderName,
          earnings: data.earnings,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('disconnect', () => {
        console.log(`[SOCKET DISCONNECT] ${socket.id}`);
      });
    });

    const PORT = process.env.PORT || 5005;
    
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is in use. Process probably hasn't exited yet. Shutting down...`);
        process.exit(1); 
      }
    });

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

module.exports = { 
  checkSurgeState, 
  isSurgeActive: (zone) => activeSurgeZones.has(zone), 
  SURGE_MULTIPLIER 
};
