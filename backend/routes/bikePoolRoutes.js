const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getBikePoolModel } = require('../models/BikePool');
const { getUserModel } = require('../models/User');
const { Op } = require('sequelize');

const { getPoolRequestModel } = require('../models/PoolRequest');
const { sendServerError } = require('../utils/httpErrors');

// Atomic seat claim: decrements only while a seat is left and the ride is open.
const takeSeat = async (poolId) => {
  const BikePool = getBikePoolModel();
  const { literal } = require('sequelize');
  const [n] = await BikePool.update(
    { availableSeats: literal('"availableSeats" - 1') },
    { where: { id: poolId, status: 'Available', availableSeats: { [Op.gt]: 0 } } }
  );
  return n === 1;
};
// After a seat is taken: mark the ride Matched when full and fill the legacy coRiderId.
const finishSeatTaken = async (poolId, passengerId) => {
  const BikePool = getBikePoolModel();
  await BikePool.update({ status: 'Matched' }, { where: { id: poolId, status: 'Available', availableSeats: { [Op.lte]: 0 } } });
  await BikePool.update({ coRiderId: passengerId }, { where: { id: poolId, coRiderId: null } });
};

// Create a new bike pool post
router.post('/posts', protect, async (req, res) => {
  const { creatorRole, origin, destination, departureTime, rideVibe, vehicleType, availableSeats, autoApprove, stopovers, vehicleInfo, notes, isRecurring, recurringDays, estimatedFuelCost } = req.body;

  if (!creatorRole || !origin || !destination || !departureTime) {
    return res.status(400).json({ message: 'Role, origin, destination, and departure time are required.' });
  }
  const departure = new Date(departureTime);
  if (Number.isNaN(departure.getTime()) || departure.getTime() < Date.now() - 5 * 60 * 1000) {
    return res.status(400).json({ message: 'Pick a departure time that is still ahead.' });
  }
  const seats = availableSeats === undefined || availableSeats === null || availableSeats === '' ? 1 : Number(availableSeats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 6) {
    return res.status(400).json({ message: 'Seats must be between 1 and 6.' });
  }
  if (String(origin).length > 120 || String(destination).length > 120 || (notes && String(notes).length > 300)) {
    return res.status(400).json({ message: 'Please keep places under 120 characters and notes under 300.' });
  }

  try {
    const BikePool = getBikePoolModel();
    const User = getUserModel();
    const currentUser = await User.findByPk(req.user.id);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newPost = await BikePool.create({
      creatorId: currentUser.id,
      creatorRole,
      origin,
      destination,
      departureTime: departure,
      estimatedFuelCost: estimatedFuelCost || 0,
      splitAmount: 0,
      vehicleType: vehicleType || 'Bike',
      availableSeats: seats,
      autoApprove: autoApprove || false,
      isRecurring: isRecurring || false,
      recurringDays: recurringDays || [],
      stopovers: stopovers || [],
      rideVibe: rideVibe || 'Any',
      vehicleInfo: creatorRole === 'rider' ? vehicleInfo : null,
      genderPreference: currentUser.genderPreference || 'Any',
      notes,
      status: 'Available',
      paymentStatus: 'Unpaid'
    });

    res.status(201).json(newPost);
  } catch (err) {
    console.error('[BIKEPOOL_CREATE_ERROR]', err);
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

// List available bike pools
router.get('/posts', protect, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const User = getUserModel();

    const currentUser = await User.findByPk(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const availablePools = await BikePool.findAll({
      where: {
        status: 'Available',
        creatorId: { [Op.ne]: currentUser.id },
        availableSeats: { [Op.gt]: 0 },
        // Rides that left more than 30 minutes ago are no longer joinable
        departureTime: { [Op.gte]: new Date(Date.now() - 30 * 60 * 1000) }
      },
      include: [
        {
          model: User,
          as: 'creator',
          // No phone in the public board: it is shared only once a seat is approved (see /my-rides).
          attributes: ['id', 'name', 'gender', 'genderPreference', 'profileImage']
        }
      ],
      order: [['departureTime', 'ASC']]
    });

    // Enforce safety/gender matching rules in memory for high fidelity filtering
    const filteredPools = availablePools.filter(pool => {
      const creator = pool.creator;
      if (!creator) return false;

      const creatorGender = creator.gender || 'Prefer not to say';
      const creatorPref = creator.genderPreference || 'Any';
      const userGender = currentUser.gender || 'Prefer not to say';
      const userPref = currentUser.genderPreference || 'Any';

      // Rule 1: If creator wants Same Gender Only, genders must match
      if (creatorPref === 'Same Gender Only' && creatorGender !== userGender) {
        return false;
      }

      // Rule 2: If current user wants Same Gender Only, genders must match
      if (userPref === 'Same Gender Only' && creatorGender !== userGender) {
        return false;
      }

      return true;
    });

    res.json(filteredPools);
  } catch (err) {
    console.error('[BIKEPOOL_LIST_ERROR]', err);
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

// Join a bike pool post
router.post('/posts/:id/join', protect, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const User = getUserModel();
    const { id } = req.params;

    const pool = await BikePool.findByPk(id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'gender', 'genderPreference', 'karmaPoints'] }]
    });

    if (!pool) {
      return res.status(404).json({ message: 'Bike pool listing not found.' });
    }

    if (pool.status !== 'Available') {
      return res.status(400).json({ message: 'This ride is no longer available.' });
    }

    if (pool.creatorId === req.user.id) {
      return res.status(400).json({ message: 'You cannot join your own ride.' });
    }

    const currentUser = await User.findByPk(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Gender Matching Checks
    const creatorGender = pool.creator.gender || 'Prefer not to say';
    const creatorPref = pool.creator.genderPreference || 'Any';
    const userGender = currentUser.gender || 'Prefer not to say';
    const userPref = currentUser.genderPreference || 'Any';

    if ((creatorPref === 'Same Gender Only' || userPref === 'Same Gender Only') && creatorGender !== userGender) {
      return res.status(400).json({ message: 'Safety check failed: Gender preferences mismatch.' });
    }

    // Wallet Balance Check Removed. Free Community Ride!
    
    const PoolRequest = getPoolRequestModel();

    // Check if already requested
    const existingRequest = await PoolRequest.findOne({ where: { poolId: pool.id, passengerId: currentUser.id } });
    if (existingRequest && existingRequest.status !== 'Cancelled') {
      return res.status(400).json({ message: 'You have already requested to join this ride.' });
    }
    if (pool.availableSeats <= 0) {
      return res.status(400).json({ message: 'This ride is full.' });
    }
    // Claim ONE request row first (a double tap must never take two seats or earn karma twice):
    // reuse a withdrawn row only via a conditional flip, otherwise insert (unique on
    // poolId + passengerId, see config/db.js); whoever loses the race gets "already requested".
    const alreadyRequested = () => res.status(400).json({ message: 'You have already requested to join this ride.' });
    let requestId;
    if (existingRequest) {
      const [reopened] = await PoolRequest.update(
        { status: 'Pending' },
        { where: { id: existingRequest.id, status: 'Cancelled' } }
      );
      if (!reopened) return alreadyRequested();
      requestId = existingRequest.id;
    } else {
      try {
        const created = await PoolRequest.create({ poolId: pool.id, passengerId: currentUser.id, status: 'Pending' });
        requestId = created.id;
      } catch (createErr) {
        if (createErr && createErr.name === 'SequelizeUniqueConstraintError') return alreadyRequested();
        throw createErr;
      }
      // Without the unique index (old DB with duplicate rows) keep only the oldest live row.
      const live = await PoolRequest.findAll({
        where: { poolId: pool.id, passengerId: currentUser.id, status: { [Op.ne]: 'Cancelled' } },
        order: [['createdAt', 'ASC'], ['id', 'ASC']],
        attributes: ['id'],
      });
      if (live.length > 1 && String(live[0].id) !== String(requestId)) {
        await PoolRequest.update({ status: 'Cancelled' }, { where: { id: requestId } });
        return alreadyRequested();
      }
    }

    if (pool.autoApprove) {
      // Take the seat atomically: two students tapping at once can never overbook.
      const taken = await takeSeat(pool.id);
      if (!taken) {
        await PoolRequest.update({ status: 'Cancelled' }, { where: { id: requestId, status: 'Pending' } });
        return res.status(400).json({ message: 'This ride just filled up.' });
      }
      await PoolRequest.update({ status: 'Approved' }, { where: { id: requestId } });
      await finishSeatTaken(pool.id, currentUser.id);
      await pool.reload();
      return res.json({ message: 'Successfully joined ride!', pool });
    } else {
      return res.json({ message: 'Request sent to host for approval.', pool });
    }
  } catch (err) {
    console.error('[BIKEPOOL_JOIN_ERROR]', err);
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

// Approve a join request
router.post('/posts/:id/requests/:requestId/approve', protect, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const PoolRequest = getPoolRequestModel();
    
    const pool = await BikePool.findByPk(req.params.id);
    if (!pool) return res.status(404).json({ message: 'Pool not found.' });
    if (pool.creatorId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });
    if (pool.availableSeats <= 0) return res.status(400).json({ message: 'No seats left.' });

    const request = await PoolRequest.findByPk(req.params.requestId);
    if (!request || request.poolId !== pool.id) return res.status(404).json({ message: 'Request not found.' });
    if (request.status !== 'Pending') return res.status(400).json({ message: `This request is already ${String(request.status).toLowerCase()}.` });
    if (pool.status !== 'Available') return res.status(400).json({ message: 'This ride is no longer open.' });

    const [flipped] = await PoolRequest.update({ status: 'Approved' }, { where: { id: request.id, status: 'Pending' } });
    if (flipped === 0) return res.status(400).json({ message: 'This request was just withdrawn or answered.' });
    if (!(await takeSeat(pool.id))) {
      await PoolRequest.update({ status: 'Pending' }, { where: { id: request.id, status: 'Approved' } });
      return res.status(400).json({ message: 'No seats left.' });
    }
    await finishSeatTaken(pool.id, request.passengerId);
    await pool.reload();

    res.json({ message: 'Request approved.', pool });
  } catch (err) {
    console.error('[BIKEPOOL_APPROVE_ERROR]', err);
    res.status(500).json({ message: 'Could not approve this request right now.' });
  }
});

// Reject a join request
router.post('/posts/:id/requests/:requestId/reject', protect, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const PoolRequest = getPoolRequestModel();
    
    const pool = await BikePool.findByPk(req.params.id);
    if (!pool) return res.status(404).json({ message: 'Pool not found.' });
    if (pool.creatorId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

    const request = await PoolRequest.findByPk(req.params.requestId);
    if (!request || request.poolId !== pool.id) return res.status(404).json({ message: 'Request not found.' });

    if (request.status !== 'Pending') return res.status(400).json({ message: `This request is already ${String(request.status).toLowerCase()}.` });
    request.status = 'Rejected';
    await request.save();

    res.json({ message: 'Request rejected.' });
  } catch (err) {
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

// Complete ride
router.post('/posts/:id/complete', protect, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const User = getUserModel();
    const { id } = req.params;

    const pool = await BikePool.findByPk(id);

    if (!pool) {
      return res.status(404).json({ message: 'Bike pool listing not found.' });
    }

    const PoolRequest = getPoolRequestModel();
    const hasApproved = await PoolRequest.findOne({ where: { poolId: pool.id, status: 'Approved' } });

    if (pool.status !== 'Matched' && !(pool.status === 'Available' && hasApproved)) {
      return res.status(400).json({ message: 'Only matched or joined rides can be completed.' });
    }

    if (pool.creatorId !== req.user.id && pool.coRiderId !== req.user.id) {
      return res.status(403).json({ message: 'You are not a participant in this ride.' });
    }

    // The person calling this must be the creator (only they can complete a multi-passenger ride)
    if (pool.creatorId !== req.user.id) {
      return res.status(403).json({ message: 'Only the creator can complete the ride.' });
    }

    const karmaReward = 50; // 50 Karma points for eco-friendly ride

    try {
      const { getSequelize } = require('../config/db');
      const sequelize = getSequelize();

      await sequelize.transaction(async (t) => {
        // Exactly once: only the request that flips the ride to Completed hands out karma.
        const [flipped] = await BikePool.update(
          { status: 'Completed', paymentStatus: 'Paid' },
          { where: { id: pool.id, status: { [Op.in]: ['Matched', 'Available'] } }, transaction: t }
        );
        if (flipped === 0) throw Object.assign(new Error('This ride is already completed.'), { userFacing: true });
        const freshCreator = await User.findByPk(pool.creatorId, { transaction: t, lock: true });
        freshCreator.karmaPoints = (freshCreator.karmaPoints || 0) + karmaReward;
        await freshCreator.save({ transaction: t });

        // Get all approved requests
        const approvedRequests = await PoolRequest.findAll({
          where: { poolId: pool.id, status: 'Approved' },
          transaction: t
        });

        // One karma reward per passenger, however many request rows they have.
        const paidPassengers = new Set([String(pool.creatorId)]);
        for (const req of approvedRequests) {
          if (paidPassengers.has(String(req.passengerId))) continue;
          paidPassengers.add(String(req.passengerId));
          const passenger = await User.findByPk(req.passengerId, { transaction: t, lock: true });
          if (passenger) {
            passenger.karmaPoints = (passenger.karmaPoints || 0) + karmaReward;
            await passenger.save({ transaction: t });
          }
        }

        pool.status = 'Completed';
        pool.paymentStatus = 'Paid';
      });

      const updatedCreator = await User.findByPk(pool.creatorId);

      res.json({
        message: 'Ride completed successfully! Everyone earned +50 Karma Points 🍃!',
        pool,
        karmaPoints: updatedCreator.karmaPoints
      });
    } catch (txErr) {
      if (txErr.userFacing) return res.status(400).json({ message: txErr.message });
      console.error('[BIKEPOOL_COMPLETE_TX_ERROR]', txErr);
      return res.status(500).json({ message: 'Could not complete this ride right now. Please try again.' });
    }
  } catch (err) {
    console.error('[BIKEPOOL_COMPLETE_ERROR]', err);
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

// Cancel a ride.
// - Host: the whole ride is cancelled and every open request is closed.
// - Passenger: only their own seat is released (the ride reopens if it was full).
router.post('/posts/:id/cancel', protect, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const PoolRequest = getPoolRequestModel();
    const { id } = req.params;

    const pool = await BikePool.findByPk(id);

    if (!pool) {
      return res.status(404).json({ message: 'Bike pool listing not found.' });
    }

    if (pool.status === 'Completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed ride.' });
    }
    if (pool.status === 'Cancelled') {
      return res.status(400).json({ message: 'This ride is already cancelled.' });
    }

    if (pool.creatorId === req.user.id) {
      const [closed] = await BikePool.update({ status: 'Cancelled' }, { where: { id: pool.id, status: { [Op.notIn]: ['Completed', 'Cancelled'] } } });
      if (!closed) return res.status(409).json({ message: 'This ride was just completed or cancelled. Please refresh.' });
      pool.status = 'Cancelled';
      await PoolRequest.update(
        { status: 'Cancelled' },
        { where: { poolId: pool.id, status: { [Op.in]: ['Pending', 'Approved'] } } }
      );
      return res.json({ message: 'Ride cancelled. Your co-riders have been released.', pool });
    }

    const myRequest = await PoolRequest.findOne({
      where: { poolId: pool.id, passengerId: req.user.id, status: { [Op.in]: ['Pending', 'Approved'] } }
    });
    if (!myRequest) {
      return res.status(403).json({ message: 'You are not part of this ride.' });
    }

    const wasApproved = myRequest.status === 'Approved';
    // Conditional: a double tap can release the seat only once.
    const [withdrawn] = await PoolRequest.update(
      { status: 'Cancelled' },
      { where: { id: myRequest.id, status: myRequest.status } }
    );
    if (!withdrawn) return res.status(409).json({ message: 'Your request was just updated. Please refresh.' });

    if (wasApproved) {
      const { literal } = require('sequelize');
      await BikePool.update({ availableSeats: literal('COALESCE("availableSeats", 0) + 1') }, { where: { id: pool.id } });
      await BikePool.update({ status: 'Available' }, { where: { id: pool.id, status: 'Matched' } });
      if (pool.coRiderId === req.user.id) {
        const next = await PoolRequest.findOne({ where: { poolId: pool.id, status: 'Approved' }, order: [['createdAt', 'ASC']] });
        await BikePool.update({ coRiderId: next ? next.passengerId : null }, { where: { id: pool.id } });
      }
      await pool.reload();
    }
    return res.json({ message: wasApproved ? 'You left this ride. Your seat is free again.' : 'Your join request was withdrawn.', pool });
  } catch (err) {
    console.error('[BIKEPOOL_CANCEL_ERROR]', err);
    res.status(500).json({ message: 'Failed to cancel pool.' });
  }
});

// Retrieve user's rides (My active/completed/cancelled rides)
router.get('/my-rides', protect, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const User = getUserModel();
    const PoolRequest = getPoolRequestModel();

    // Rides I host, plus every ride I asked to join (pending, approved, rejected or cancelled)
    const myRequests = await PoolRequest.findAll({ where: { passengerId: req.user.id }, attributes: ['poolId'] });
    const requestedPoolIds = [...new Set(myRequests.map(r => r.poolId).filter(Boolean))];
    const myRides = await BikePool.findAll({
      where: {
        [Op.or]: [
          { creatorId: req.user.id },
          { coRiderId: req.user.id },
          ...(requestedPoolIds.length ? [{ id: { [Op.in]: requestedPoolIds } }] : [])
        ]
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'phone', 'gender', 'profileImage']
        },
        {
          model: User,
          as: 'coRider',
          attributes: ['id', 'name', 'phone', 'gender', 'profileImage']
        },
        {
          model: PoolRequest,
          as: 'requests',
          include: [
            {
              model: User,
              as: 'passenger',
              attributes: ['id', 'name', 'phone', 'gender', 'profileImage']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Phone numbers only between people who actually share the ride: the host sees approved
    // passengers' numbers, an approved passenger sees the host's. Nobody else's.
    const me = req.user.id;
    const scrubbed = myRides.map((ride) => {
      const json = ride.toJSON();
      const isHost = json.creatorId === me;
      const requests = Array.isArray(json.requests) ? json.requests : [];
      const approvedIds = new Set(requests.filter((r) => r.status === 'Approved').map((r) => r.passengerId));
      const iAmApproved = approvedIds.has(me);
      if (json.creator && !isHost && !iAmApproved) delete json.creator.phone;
      if (json.coRider && json.coRider.id !== me && !(isHost && approvedIds.has(json.coRider.id))) delete json.coRider.phone;
      json.requests = requests.map((r) => {
        if (r.passenger && r.passengerId !== me && !(isHost && r.status === 'Approved')) {
          const { phone: _phone, ...rest } = r.passenger;
          return { ...r, passenger: rest };
        }
        return r;
      });
      return json;
    });
    res.json(scrubbed);
  } catch (err) {
    console.error('[BIKEPOOL_MYRIDES_ERROR]', err);
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

// ─── Admin Moderation Routes ────────────────────────────────
router.post('/admin/:id/force-cancel', protect, admin, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const pool = await BikePool.findByPk(req.params.id);
    if (!pool) return res.status(404).json({ message: 'Pool not found.' });
    if (pool.status === 'Completed' || pool.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot cancel a completed or already cancelled ride.' });
    }
    pool.status = 'Cancelled';
    await pool.save();
    res.json({ message: 'Listing forcibly cancelled by Admin.', pool });
  } catch (err) {
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

router.post('/admin/:id/mark-paid', protect, admin, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const pool = await BikePool.findByPk(req.params.id);
    if (!pool) return res.status(404).json({ message: 'Pool not found.' });
    pool.paymentStatus = 'Paid';
    await pool.save();
    res.json({ message: 'Listing forcibly marked as Paid by Admin.', pool });
  } catch (err) {
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

// Admin All Pools
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const BikePool = getBikePoolModel();
    const User = getUserModel();
    const pools = await BikePool.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'phone', 'gender'] },
        { model: User, as: 'coRider', attributes: ['id', 'name', 'phone'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(pools);
  } catch (err) {
    sendServerError(res, err, '[BIKEPOOLROUTES_ERROR]');
  }
});

module.exports = router;
