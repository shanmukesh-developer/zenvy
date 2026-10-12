const jwt = require('jsonwebtoken');

// ── In-Memory Auth Cache (Reduces DB lookups by ~80% under 500+ users) ──
const AUTH_CACHE = new Map();
const AUTH_CACHE_TTL = 60 * 1000; // 60 seconds
const AUTH_CACHE_MAX = 2000; // Max entries to prevent memory bloat

const getCachedUser = (userId) => {
  const entry = AUTH_CACHE.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > AUTH_CACHE_TTL) {
    AUTH_CACHE.delete(userId);
    return null;
  }
  return entry.user;
};

const setCachedUser = (userId, user) => {
  // Evict oldest entries if cache is full
  if (AUTH_CACHE.size >= AUTH_CACHE_MAX) {
    const firstKey = AUTH_CACHE.keys().next().value;
    AUTH_CACHE.delete(firstKey);
  }
  AUTH_CACHE.set(userId, { user, ts: Date.now() });
};

// Drop a cached account right after a ban / role change / approval change so it applies at once
// instead of after the 60 s TTL.
const clearCachedUser = (userId) => {
  if (userId !== undefined && userId !== null) AUTH_CACHE.delete(userId);
};

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer') && !req.headers.authorization.includes('cookie-managed')) {
    token = req.headers.authorization.split(' ')[1];
  } else {
    token = req.cookies?.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    token = token.replace(/['"]+/g, '').trim();

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[AUTH_FATAL] JWT_SECRET is not configured on the server.');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, secret);
    
    // Check cache first (avoids DB hit for 500+ concurrent users)
    const cached = getCachedUser(decoded.id);
    if (cached) {
      // Partner sessions from before a password reset (older tokenVersion) are signed out.
      if (cached.role === 'restaurant' && (Number(decoded.tv) || 0) !== (Number(cached.tokenVersion) || 0)) {
        return res.status(401).json({ message: 'Your password was changed. Please sign in again.', code: 'SESSION_REVOKED' });
      }
      req.user = cached;
      return next();
    }
    
    if (decoded.role === 'restaurant') {
       const { getRestaurantModel } = require('../models/Restaurant');
       const Restaurant = getRestaurantModel();
       if (Restaurant) {
         const dbRest = await Restaurant.findByPk(decoded.id, { attributes: ['id', 'name', 'tokenVersion'] });
         if (!dbRest) return res.status(401).json({ message: 'Restaurant not found' });
         const tokenVersion = Number(dbRest.tokenVersion) || 0;
         setCachedUser(decoded.id, { id: dbRest.id, role: 'restaurant', name: dbRest.name, tokenVersion });
         if ((Number(decoded.tv) || 0) !== tokenVersion) {
           return res.status(401).json({ message: 'Your password was changed. Please sign in again.', code: 'SESSION_REVOKED' });
         }
         req.user = { id: dbRest.id, role: 'restaurant', name: dbRest.name };
         return next();
       }
    }
    
    if (decoded.role === 'rider') {
       const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
       const DeliveryPartner = getDeliveryPartnerModel();
       if (DeliveryPartner) {
         const dbRider = await DeliveryPartner.findByPk(decoded.id);
         if (!dbRider) return res.status(401).json({ message: 'Rider not found' });
         req.user = { id: dbRider.id, role: 'rider', name: dbRider.name };
         setCachedUser(decoded.id, req.user);
         return next();
       }
    }

    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    if (User) {
      const dbUser = await User.findByPk(decoded.id);
      if (!dbUser) return res.status(401).json({ message: 'User not found' });
      if (dbUser.isActive === false) return res.status(403).json({ message: 'Account suspended. Please contact support.' });
      const userPayload = {
        id: dbUser.id,
        role: dbUser.role || 'student',
        name: dbUser.name,
        phone: dbUser.phone,
        email: dbUser.email,
        hostelBlock: dbUser.hostelBlock,
        roomNumber: dbUser.roomNumber,
        isActive: dbUser.isActive
      };
      req.user = userPayload;
      setCachedUser(decoded.id, userPayload);
    } else {
      req.user = decoded;
    }
    return next();
  } catch (error) {
    console.warn('[AUTH_WARN] Token verification failed:', error.message);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const admin = (req, res, next) => {
  if (req.user && typeof req.user.role === 'string' && req.user.role.toLowerCase() === 'admin') {
    next();
  } else {
    console.warn(`[SECURITY_WARN] User ${req.user?.id} attempted to access Admin route.`);
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};

const rider = (req, res, next) => {
  if (req.user && typeof req.user.role === 'string' && req.user.role.toLowerCase() === 'rider') {
    next();
  } else {
    console.warn(`[SECURITY_WARN] User ${req.user?.id} attempted to access Rider route.`);
    res.status(403).json({ message: 'Forbidden: Delivery Partner access required' });
  }
};

const vendor = (req, res, next) => {
  const role = req.user?.role;
  if (typeof role === 'string' && (role.toLowerCase() === 'restaurant' || role.toLowerCase() === 'admin')) {
    next();
  } else {
    console.warn(`[SECURITY_WARN] User ${req.user?.id} attempted to access Vendor route.`);
    res.status(403).json({ message: 'Forbidden: Restaurant or Admin access required' });
  }
};

// Rider route that also needs an admin-approved account (self sign-ups get a token before approval).
const approvedRider = async (req, res, next) => {
  if (!(req.user && typeof req.user.role === 'string' && req.user.role.toLowerCase() === 'rider')) {
    return res.status(403).json({ message: 'Forbidden: Delivery Partner access required' });
  }
  try {
    const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
    const partner = await getDeliveryPartnerModel().findByPk(req.user.id, { attributes: ['id', 'isApproved'] });
    if (!partner) return res.status(401).json({ message: 'Rider not found' });
    if (!partner.isApproved) {
      return res.status(403).json({ code: 'RIDER_NOT_APPROVED', message: 'Your account is waiting for admin approval.' });
    }
    return next();
  } catch (err) {
    console.error('[APPROVED_RIDER_ERROR]', err.message);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

module.exports = { protect, admin, rider, vendor, approvedRider, clearCachedUser };
