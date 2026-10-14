const { Op } = require('sequelize');
const { getRidePoolModel } = require('../models/RidePool');
const { getSequelize } = require('../../../config/db');
const { campusScopeFor, sameCampusUsers, blockedIdsFor } = require('../campusHelpers');
const VERIFY_FIRST = { code: 'VERIFICATION_REQUIRED', message: 'Verify your college to use ride pools.' };

/** Who rides with whom is only shown to people on that ride; others see seat placeholders. */
const publicRide = (ride, viewerId) => {
  const json = typeof ride.toJSON === 'function' ? ride.toJSON() : { ...ride };
  const list = Array.isArray(json.passengers) ? json.passengers : [];
  const onRide = String(json.creatorId) === String(viewerId) || list.some((p) => p && String(p.id) === String(viewerId));
  if (!onRide) json.passengers = list.map((p) => (p && String(p.id) === String(json.creatorId) ? p : { id: null, name: 'Passenger' }));
  return json;
};


// Seat changes run in a transaction with a row lock so two students can never take the last seat.
const withLockedRide = async (rideId, work) => {
  const sequelize = getSequelize();
  const RidePool = getRidePoolModel();
  return sequelize.transaction(async (t) => {
    const ride = await RidePool.findByPk(rideId, { transaction: t, lock: t.LOCK.UPDATE });
    return work(ride, t);
  });
};

class RideError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// @desc    Create a ride-pool offer
// @route   POST /api/campus/ride-pool
const createRidePool = async (req, res) => {
  try {
    const scope = await campusScopeFor(req.user.id);
    if (!scope.verified || !scope.campusId) return res.status(403).json(VERIFY_FIRST);
    const {
      destination,
      departureTime,
      origin,
      totalSeats,
      farePerSeat,
      vehicleType,
    } = req.body;

    if (!destination || !destination.trim()) {
      return res.status(400).json({ message: 'Destination is required' });
    }
    if (!departureTime) {
      return res.status(400).json({ message: 'Departure time is required' });
    }
    if (!origin || !String(origin).trim()) {
      return res.status(400).json({ message: 'Where does the ride start from?' });
    }
    const departure = new Date(departureTime);
    if (Number.isNaN(departure.getTime()) || departure.getTime() < Date.now() - 5 * 60 * 1000) {
      return res.status(400).json({ message: 'Pick a departure time in the future.' });
    }
    const seats = parseInt(totalSeats, 10) || 4;
    if (seats < 2 || seats > 8) {
      return res.status(400).json({ message: 'Total seats must be between 2 and 8' });
    }
    // Fare is what the organiser asks for; 0 means a free ride. Never invented by the server.
    const fare = farePerSeat === undefined || farePerSeat === null || String(farePerSeat).trim() === ''
      ? NaN
      : Number(farePerSeat);
    if (!Number.isInteger(fare) || fare < 0 || fare > 5000) {
      return res.status(400).json({ message: 'Set a fare per seat between ₹0 (free) and ₹5000.' });
    }

    const RidePool = getRidePoolModel();
    const ride = await RidePool.create({
      creatorId: req.user.id,
      creatorName: req.user.name || 'A student',
      origin: String(origin).trim().slice(0, 120),
      destination: destination.trim().slice(0, 120),
      departureTime: departure,
      availableSeats: seats - 1, // creator takes one seat
      totalSeats: seats,
      farePerSeat: fare,
      vehicleType: ['Car', 'Auto', 'Bike'].includes(vehicleType) ? vehicleType : 'Car',
      passengers: [{ id: req.user.id, name: req.user.name || 'A student' }],
      status: 'open',
    });

    console.log(`🚗 [CAMPUS_RIDE] ${req.user.name} → ${ride.destination} @ ${ride.departureTime}`);
    res.status(201).json({ message: 'Ride posted', ride });
  } catch (err) {
    console.error('[CREATE_RIDE_ERR]', err);
    res.status(500).json({ message: 'Failed to post ride' });
  }
};

// @desc    List open ride-pool offers
// @route   GET /api/campus/ride-pool
const getRidePools = async (req, res) => {
  try {
    const RidePool = getRidePoolModel();
    const scope = await campusScopeFor(req.user.id);
    if (!scope.verified || !scope.campusId) return res.status(403).json(VERIFY_FIRST);
    const rows = await RidePool.findAll({
      where: {
        creatorId: sameCampusUsers(scope.campusId),
        status: 'open',
        // Rides that left more than 30 minutes ago are no longer bookable
        departureTime: { [Op.gte]: new Date(Date.now() - 30 * 60 * 1000) },
      },
      order: [['departureTime', 'ASC']],
      limit: 100,
    });
    const blocked = await blockedIdsFor(req.user.id);
    const rides = rows.filter((r) => !blocked.has(r.creatorId)).map((r) => publicRide(r, req.user.id));
    res.json({ rides });
  } catch (err) {
    console.error('[GET_RIDE_ERR]', err);
    res.status(500).json({ message: 'Failed to load rides' });
  }
};

// @desc    Book a seat on a ride
// @route   POST /api/campus/ride-pool/:id/join
const joinRidePool = async (req, res) => {
  try {
    const scope = await campusScopeFor(req.user.id);
    if (!scope.verified || !scope.campusId) return res.status(403).json(VERIFY_FIRST);
    // Same campus only, and never with someone you blocked / who blocked you (creator never changes).
    const rid = String(req.params.id || '');
    const peek = /^[0-9a-f-]{36}$/i.test(rid) ? await getRidePoolModel().findByPk(rid, { attributes: ['id', 'creatorId'] }) : null;
    if (!peek) return res.status(404).json({ message: 'Ride not found' });
    const creatorScope = await campusScopeFor(peek.creatorId);
    if (creatorScope.campusId !== scope.campusId || (await blockedIdsFor(req.user.id)).has(peek.creatorId)) {
      return res.status(404).json({ message: 'Ride not found' });
    }
    const ride = await withLockedRide(req.params.id, async (ride, t) => {
      if (!ride) throw new RideError(404, 'Ride not found');
      if (ride.status !== 'open') throw new RideError(400, `This ride is ${ride.status}`);
      const passengers = ride.passengers || [];
      if (passengers.some((p) => p.id === req.user.id)) throw new RideError(400, 'You have already booked a seat');
      if (ride.availableSeats <= 0) throw new RideError(400, 'No seats left on this ride');

      ride.passengers = [...passengers, { id: req.user.id, name: req.user.name || 'A student' }];
      ride.availableSeats = Math.max(0, ride.availableSeats - 1);
      if (ride.availableSeats === 0) ride.status = 'full';
      await ride.save({ transaction: t });
      return ride;
    });

    res.json({ message: 'Seat booked', ride: publicRide(ride, req.user.id) });
  } catch (err) {
    if (err instanceof RideError) return res.status(err.status).json({ message: err.message });
    console.error('[JOIN_RIDE_ERR]', err);
    res.status(500).json({ message: 'Failed to book seat' });
  }
};

// @desc    Release your seat on a ride
// @route   POST /api/campus/ride-pool/:id/leave
const leaveRidePool = async (req, res) => {
  try {
    const ride = await withLockedRide(req.params.id, async (ride, t) => {
      if (!ride) throw new RideError(404, 'Ride not found');
      if (ride.creatorId === req.user.id) throw new RideError(400, 'The organiser cannot leave their own ride');

      const current = ride.passengers || [];
      const passengers = current.filter((p) => p.id !== req.user.id);
      if (passengers.length === current.length) throw new RideError(400, 'You do not have a seat on this ride');

      ride.passengers = passengers;
      ride.availableSeats = Math.min(ride.totalSeats || ride.availableSeats + 1, ride.availableSeats + 1);
      if (ride.status === 'full') ride.status = 'open';
      await ride.save({ transaction: t });
      return ride;
    });

    res.json({ message: 'Seat released', ride: publicRide(ride, req.user.id) });
  } catch (err) {
    if (err instanceof RideError) return res.status(err.status).json({ message: err.message });
    console.error('[LEAVE_RIDE_ERR]', err);
    res.status(500).json({ message: 'Failed to release seat' });
  }
};

module.exports = { createRidePool, getRidePools, joinRidePool, leaveRidePool };
