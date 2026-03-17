const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: function(origin, callback){
    // Allow all origins for debugging, but reflect them so credentials: true works
    callback(null, origin || "*");
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/restaurants', require('./routes/restaurantRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/delivery', require('./routes/deliveryPartnerRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));

// Basic Route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'HostelBites API is running...',
    version: '1.0.0',
    endpoints: {
      search: '/api/search',
      restaurants: '/api/restaurants',
      orders: '/api/orders'
    }
  });
});

// Catch-all for 404s
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found on this server.`
  });
});

// Socket.io Real-time connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a specific order room for tracking
  socket.on('joinOrder', (orderId) => {
    socket.join(orderId);
    console.log(`User/Rider joined room: ${orderId}`);
  });

  // Delivery partner updates location
  socket.on('updateLocation', ({ orderId, lat, lng, riderName }) => {
    // Broadcast location to everyone in the order room
    io.to(orderId).emit('locationUpdated', { lat, lng, riderName });
    console.log(`Location updated for order ${orderId} by ${riderName}: ${lat}, ${lng}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// MongoDB Connection and Server Start
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Wait for DB to connect before listening
    await connectDB();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
};

startServer();
