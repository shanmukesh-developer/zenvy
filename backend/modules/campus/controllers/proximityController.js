const { Op } = require('sequelize');
const { getProximityRoomModel, getProximityMessageModel } = require('../models/ProximityRoom');

// Default proximity rooms seeded per campus (configurable later)
const DEFAULT_ROOMS = [
  {
    name: 'Central Library 2F',
    slug: 'library-study',
    subtitle: 'Quiet Study Zone • 2nd Floor West Wing',
    icon: 'BookOpen',
    category: 'library',
    latitude: 16.4486,
    longitude: 80.6235,
    radiusMeters: 200,
  },
  {
    name: 'Canteen & Mess Hall 1',
    slug: 'mess-hall-1',
    subtitle: 'Dining Hall • Near Ganga Block',
    icon: 'Utensils',
    category: 'dining',
    latitude: 16.4478,
    longitude: 80.6242,
    radiusMeters: 150,
  },
  {
    name: 'Indoor Sports Arena',
    slug: 'sports-complex',
    subtitle: 'Badminton, TT & Gym Complex',
    icon: 'Dumbbell',
    category: 'sports',
    latitude: 16.4495,
    longitude: 80.6250,
    radiusMeters: 200,
  },
  {
    name: 'Hostel Common Room',
    slug: 'hostel-common',
    subtitle: 'Yamuna Block • Ground Floor',
    icon: 'Sofa',
    category: 'hostel',
    latitude: 16.4470,
    longitude: 80.6238,
    radiusMeters: 100,
  },
  {
    name: 'Amphitheatre Lawn',
    slug: 'amphitheatre',
    subtitle: 'Events & Open Mic Area',
    icon: 'Mic',
    category: 'common',
    latitude: 16.4490,
    longitude: 80.6228,
    radiusMeters: 250,
  },
];

// Haversine formula: distance in meters between two lat/lng points
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Seed default rooms if they don't exist
const seedDefaultRooms = async () => {
  const ProximityRoom = getProximityRoomModel();
  for (const room of DEFAULT_ROOMS) {
    const existing = await ProximityRoom.findOne({ where: { slug: room.slug } });
    if (!existing) {
      await ProximityRoom.create(room);
    }
  }
};

// GET /api/campus/proximity/rooms?lat=&lng=
const getProximityRooms = async (req, res) => {
  try {
    const ProximityRoom = getProximityRoomModel();
    
    // Seed defaults if needed
    const count = await ProximityRoom.count();
    if (count === 0) {
      await seedDefaultRooms();
    }

    const rooms = await ProximityRoom.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });
    // Lazy require: campusSocket requires this module's models at load time.
    const { getProximityLiveCount } = require('../campusSocket');

    const { lat, lng } = req.query;
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const result = rooms.map((room) => {
      let distance = null;
      let isNearby = false;

      if (!isNaN(userLat) && !isNaN(userLng)) {
        distance = Math.round(haversineDistance(userLat, userLng, room.latitude, room.longitude));
        isNearby = distance <= room.radiusMeters;
      }

      return {
        id: room.id,
        name: room.name,
        slug: room.slug,
        subtitle: room.subtitle,
        icon: room.icon,
        category: room.category,
        latitude: room.latitude,
        longitude: room.longitude,
        radiusMeters: room.radiusMeters,
        activeUserCount: getProximityLiveCount(room.slug),
        isNearby,
        distance,
      };
    });

    // Sort: nearby first, then by distance
    result.sort((a, b) => {
      if (a.isNearby && !b.isNearby) return -1;
      if (!a.isNearby && b.isNearby) return 1;
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      return b.activeUserCount - a.activeUserCount;
    });

    res.json({ rooms: result });
  } catch (err) {
    console.error('[PROXIMITY_ROOMS_ERR]', err);
    res.status(500).json({ message: 'Failed to load proximity rooms' });
  }
};

// GET /api/campus/proximity/rooms/:slug/messages?limit=50
const getProximityMessages = async (req, res) => {
  try {
    const ProximityRoom = getProximityRoomModel();
    const ProximityMessage = getProximityMessageModel();

    const room = await ProximityRoom.findOne({ where: { slug: req.params.slug } });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    // Only fetch messages from the last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const messages = await ProximityMessage.findAll({
      where: {
        roomId: room.id,
        createdAt: { [Op.gte]: since },
      },
      // Newest N messages, returned oldest-first for the chat view.
      order: [['createdAt', 'DESC']],
      limit,
    });
    messages.reverse();
    const { getProximityLiveCount } = require('../campusSocket');

    res.json({
      room: {
        id: room.id,
        name: room.name,
        slug: room.slug,
        subtitle: room.subtitle,
        icon: room.icon,
        category: room.category,
        activeUserCount: getProximityLiveCount(room.slug),
      },
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        text: m.text,
        type: m.type,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error('[PROXIMITY_MESSAGES_ERR]', err);
    res.status(500).json({ message: 'Failed to load messages' });
  }
};

// POST /api/campus/proximity/rooms/:slug/messages
const postProximityMessage = async (req, res) => {
  try {
    const ProximityRoom = getProximityRoomModel();
    const ProximityMessage = getProximityMessageModel();

    const room = await ProximityRoom.findOne({ where: { slug: req.params.slug } });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const msg = await ProximityMessage.create({
      roomId: room.id,
      senderId: req.user.id,
      senderName: req.user.name,
      text: text.trim().slice(0, 1000),
      type: 'text',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    res.status(201).json({
      message: {
        id: msg.id,
        senderId: msg.senderId,
        senderName: msg.senderName,
        text: msg.text,
        type: msg.type,
        createdAt: msg.createdAt,
      },
    });
  } catch (err) {
    console.error('[PROXIMITY_POST_MSG_ERR]', err);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

module.exports = {
  getProximityRooms,
  getProximityMessages,
  postProximityMessage,
  seedDefaultRooms,
  haversineDistance,
};
