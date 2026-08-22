const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getPGHostelModel } = require('../models/PGHostel');
const { getPGRoomModel } = require('../models/PGRoom');
const { getPGBookingModel } = require('../models/PGBooking');
const { getUserModel } = require('../models/User');

// GET all PGs (Student Search)
router.get('/', async (req, res) => {
  try {
    const PGHostel = getPGHostelModel();
    const pgs = await PGHostel.findAll({
      where: { isActive: true },
      order: [['distanceFromCollege', 'ASC']]
    });
    res.json(pgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET PG details & rooms
router.get('/:id', async (req, res) => {
  try {
    const PGHostel = getPGHostelModel();
    const PGRoom = getPGRoomModel();
    const pg = await PGHostel.findByPk(req.params.id, {
      include: [{ model: PGRoom, as: 'rooms', where: { isActive: true }, required: false }]
    });
    if (!pg) return res.status(404).json({ message: 'PG not found.' });
    res.json(pg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const { sendWhatsAppMessage } = require('../utils/whatsappUtil');

// POST Book a room
router.post('/:roomId/book', protect, async (req, res) => {
  try {
    const PGRoom = getPGRoomModel();
    const PGBooking = getPGBookingModel();
    const PGHostel = getPGHostelModel();
    const User = getUserModel();
    const room = await PGRoom.findByPk(req.params.roomId);
    
    if (!room || !room.isActive) return res.status(404).json({ message: 'Room not found.' });
    if (room.availableBeds <= 0) return res.status(400).json({ message: 'No beds available.' });

    const pgHostel = await PGHostel.findByPk(room.hostelId);
    const user = await User.findByPk(req.user.id);

    const booking = await PGBooking.create({
      userId: req.user.id,
      hostelId: room.hostelId,
      roomId: room.id,
      checkInDate: new Date(req.body.checkInDate || Date.now()),
      status: 'Pending'
    });

    const userName = user?.name || req.user.name || 'Zenvy Student';
    const userPhone = user?.phone || user?.mobile || req.user.phone || 'Not Provided';
    const userEmail = user?.email || req.user.email || 'Not Provided';
    const userHostel = user?.hostelBlock ? `${user.hostelBlock}, Room ${user.roomNumber || user.roomNo || ''}` : user?.address || 'SRM Campus';
    const pgName = pgHostel?.name || 'Verified Campus PG';
    const sharingType = room.sharingType ? `${room.sharingType} Sharing` : 'Standard';
    const rentAmount = room.pricePerBed || pgHostel?.baseRent || 0;
    const checkIn = new Date(req.body.checkInDate || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const whatsappMessage = `🏢 *NEW PG BOOKING REQUEST!* 🚀\n\n` +
      `👤 *Student Profile:*\n` +
      `• Name: *${userName}*\n` +
      `• Phone: *${userPhone}*\n` +
      `• Email: ${userEmail}\n` +
      `• Current Residence: ${userHostel}\n\n` +
      `🏠 *PG & Room Details:*\n` +
      `• PG Property: *${pgName}*\n` +
      `• Address: ${pgHostel?.address || 'Near SRM AP'}\n` +
      `• Room No: *Room ${room.roomNumber}* (${sharingType})\n` +
      `• Rent per Bed: *₹${rentAmount}/mo*\n` +
      `• Scheduled Check-In: *${checkIn}*\n` +
      `• Booking ID: #${(booking.id || '').substring(0, 8).toUpperCase()}\n\n` +
      `⚡ _Sent automatically via Zenvy Super Ecosystem._`;

    // Direct WhatsApp message notification to 9391955674
    try {
      await sendWhatsAppMessage('9391955674', whatsappMessage, 'PG_BOOKING');
    } catch (waErr) {
      console.error('[PG_WHATSAPP_ERROR]', waErr.message);
    }

    const whatsappUrl = `https://wa.me/919391955674?text=${encodeURIComponent(whatsappMessage)}`;

    res.status(201).json({ 
      message: 'Booking request sent successfully.', 
      booking,
      whatsappUrl,
      whatsappMessage
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST Create a PG (Owner / Admin)
router.post('/', protect, async (req, res) => {
  try {
    const PGHostel = getPGHostelModel();
    const { 
      name, address, distanceFromCollege, genderType, baseRent, securityDeposit, 
      amenities, images, description, messMenu, foodTimetable, rules, contactInfo, isActive 
    } = req.body;
    
    const pg = await PGHostel.create({
      ownerId: req.user.id,
      name, address, distanceFromCollege, genderType, baseRent, securityDeposit, 
      amenities, images, description, messMenu, foodTimetable, rules, contactInfo, isActive: isActive ?? true
    });
    res.status(201).json(pg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all PGs for Admin (includes inactive)
router.get('/admin/admin-all', protect, admin, async (req, res) => {
  try {
    const PGHostel = getPGHostelModel();
    const pgs = await PGHostel.findAll({
      order: [['distanceFromCollege', 'ASC']]
    });
    res.json(pgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT Update a PG Hostel
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const PGHostel = getPGHostelModel();
    const pg = await PGHostel.findByPk(req.params.id);
    if (!pg) return res.status(404).json({ message: 'PG not found.' });

    const { 
      name, address, distanceFromCollege, genderType, baseRent, securityDeposit, 
      amenities, images, description, messMenu, foodTimetable, rules, contactInfo, isActive 
    } = req.body;
    await pg.update({
      name, address, distanceFromCollege, genderType, baseRent, securityDeposit, 
      amenities, images, description, messMenu, foodTimetable, rules, contactInfo, isActive
    });
    res.json(pg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE a PG Hostel
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const PGHostel = getPGHostelModel();
    const pg = await PGHostel.findByPk(req.params.id);
    if (!pg) return res.status(404).json({ message: 'PG not found.' });
    await pg.destroy();
    res.json({ message: 'PG deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all rooms for a PG Hostel (Admin)
router.get('/:id/rooms-all', protect, admin, async (req, res) => {
  try {
    const PGRoom = getPGRoomModel();
    const rooms = await PGRoom.findAll({
      where: { hostelId: req.params.id }
    });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST Create a Room
router.post('/:id/rooms', protect, admin, async (req, res) => {
  try {
    const PGRoom = getPGRoomModel();
    const { roomNumber, sharingType, pricePerBed, totalBeds, availableBeds, floorNumber, hasAttachedBathroom, hasAC, hasBalcony, furnishing, isActive } = req.body;
    const room = await PGRoom.create({
      hostelId: req.params.id,
      roomNumber, sharingType, pricePerBed, totalBeds, availableBeds, floorNumber, hasAttachedBathroom, hasAC, hasBalcony, furnishing, isActive: isActive ?? true
    });
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT Update a Room
router.put('/:id/rooms/:roomId', protect, admin, async (req, res) => {
  try {
    const PGRoom = getPGRoomModel();
    const room = await PGRoom.findOne({
      where: { id: req.params.roomId, hostelId: req.params.id }
    });
    if (!room) return res.status(404).json({ message: 'Room not found.' });

    const { roomNumber, sharingType, pricePerBed, totalBeds, availableBeds, floorNumber, hasAttachedBathroom, hasAC, hasBalcony, furnishing, isActive } = req.body;
    await room.update({
      roomNumber, sharingType, pricePerBed, totalBeds, availableBeds, floorNumber, hasAttachedBathroom, hasAC, hasBalcony, furnishing, isActive
    });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE a Room
router.delete('/:id/rooms/:roomId', protect, admin, async (req, res) => {
  try {
    const PGRoom = getPGRoomModel();
    const room = await PGRoom.findOne({
      where: { id: req.params.roomId, hostelId: req.params.id }
    });
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    await room.destroy();
    res.json({ message: 'Room deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
