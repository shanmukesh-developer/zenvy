// Rental bookings: request -> accept / decline / expire -> handover (pickup PIN) -> return (return PIN)
// -> complete -> ratings. Money is server-priced and paid in cash between the students.
const crypto = require('crypto');
const { Op, Transaction } = require('sequelize');
const { getModel, getSequelize } = require('../index');
const E = require('../enums');
const { fail, cleanText, isUuid, num, hit, money } = require('../services/util');
const { checkRefs } = require('../services/media');
const { quote, scheduleProblem, validateWindow, parseTime, HOUR } = require('../services/pricing');
const S = require('../services/serialize');
const notify = require('../services/notify');
const { assertLicenceFor } = require('./licence');

const B = E.BOOKING_STATUS;
const M = () => ({
  Listing: getModel('RentalListing'),
  Booking: getModel('RentalBooking'),
  Licence: getModel('RentalLicence'),
  Review: getModel('RentalReview'),
  Report: getModel('RentalReport'),
  User: getModel('User'),
});
const USER_ATTRS = ['id', 'name', 'phone', 'profileImage', 'isActive'];

// ── Per-listing serialisation ───────────────────────────────────────────────
// In-process queue per listing + a write transaction (SQLite: IMMEDIATE; Postgres: SELECT ... FOR UPDATE
// on the listing row), so two concurrent requests for overlapping times can never both be stored.
const queues = new Map();
const withListingLock = async (listingId, fn) => {
  const key = String(listingId);
  const prev = queues.get(key) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  const chained = prev.then(() => mine);
  queues.set(key, chained);
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (queues.get(key) === chained) queues.delete(key);
  }
};
const tx = (fn) => getSequelize().transaction({ type: Transaction.TYPES.IMMEDIATE }, fn);
const lockOpt = (t) => (getSequelize().getDialect() === 'postgres' ? { transaction: t, lock: t.LOCK.UPDATE } : { transaction: t });

const overlapping = (Booking, listingId, start, end, t, exceptId) => Booking.findOne({
  where: {
    listingId,
    status: { [Op.in]: E.HOLDING_STATUSES },
    startAt: { [Op.lt]: end },
    endAt: { [Op.gt]: start },
    ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}),
  },
  attributes: ['id', 'status'],
  transaction: t,
});

const newPin = (avoid) => {
  let p;
  do { p = String(crypto.randomInt(0, 10000)).padStart(4, '0'); } while (p === avoid);
  return p;
};

/** Ratings a student received in one role (RENTER = as owner; OWNER = as renter). */
const ratingOf = async (userId, role) => {
  const { Review, Booking } = M();
  const rows = await Review.findAll({ where: { revieweeId: userId, role, isHidden: { [Op.not]: true } }, attributes: ['rating'] });
  const trips = role === 'OWNER'
    ? await Booking.count({ where: { renterId: userId, status: B.COMPLETED } })
    : await Booking.count({ where: { ownerId: userId, status: B.COMPLETED } });
  const avg = rows.length ? Math.round((rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / rows.length) * 10) / 10 : null;
  return { avg, count: rows.length, trips };
};

/** Full payload for one viewer (loads listing / users / licence as needed). */
const present = async (req, booking, viewerId) => {
  const { Listing, User, Licence } = M();
  const [listing, owner, renter] = await Promise.all([
    Listing.findByPk(booking.listingId),
    User.findByPk(booking.ownerId, { attributes: USER_ATTRS }),
    User.findByPk(booking.renterId, { attributes: USER_ATTRS }),
  ]);
  const isOwner = String(viewerId) === String(booking.ownerId);
  const ctx = { listing, owner, renter };
  if (isOwner) {
    ctx.renterLicence = await Licence.findOne({ where: { userId: booking.renterId } });
    ctx.renterRating = await ratingOf(booking.renterId, 'OWNER');
  } else {
    ctx.ownerRating = await ratingOf(booking.ownerId, 'RENTER');
  }
  return S.bookingFor(req, booking, viewerId, ctx);
};

/** Loads a booking the caller is a party to (404 otherwise, so ids cannot be probed). */
const loadParty = async (req, t) => {
  const id = String(req.params.id || '');
  if (!isUuid(id)) throw fail(404, 'NOT_FOUND', 'Booking not found.');
  const { Booking } = M();
  const row = await Booking.findByPk(id, t ? lockOpt(t) : undefined);
  const uid = String(req.user.id);
  if (!row || (String(row.ownerId) !== uid && String(row.renterId) !== uid)) throw fail(404, 'NOT_FOUND', 'Booking not found.');
  return row;
};
const asOwner = (row, req) => {
  if (String(row.ownerId) !== String(req.user.id)) throw fail(403, 'OWNER_ONLY', 'Only the vehicle owner can do this.');
};

/** Expires a REQUESTED booking whose answer window has passed. Returns true if it did. */
const expireIfStale = async (row, t) => {
  if (row.status !== B.REQUESTED || !row.respondBy || new Date(row.respondBy).getTime() > Date.now()) return false;
  const { Booking } = M();
  const [n] = await Booking.update({ status: B.EXPIRED, expiredAt: new Date() }, { where: { id: row.id, status: B.REQUESTED }, transaction: t });
  if (n) row.status = B.EXPIRED;
  return n > 0;
};

// ── Handlers ────────────────────────────────────────────────────────────────

// POST /api/rentals/bookings { listingId, startAt, endAt, note? }
const create = async (req, res) => {
  const body = req.body || {};
  const listingId = String(body.listingId || '');
  if (!isUuid(listingId)) throw fail(400, 'INVALID_INPUT', 'Pick a vehicle to book.', { field: 'listingId' });
  const start = parseTime(body.startAt, 'startAt');
  const end = parseTime(body.endAt, 'endAt');
  validateWindow(start, end, { forBooking: true });
  const note = cleanText(body.note, 500, { multiline: true }) || null;
  hit('booking_request', req.user.id);
  const { Listing, Booking, Licence, User } = M();
  const renterId = req.user.id;
  const ctx = req.rentals.ctx;

  const booking = await withListingLock(listingId, () => tx(async (t) => {
    const listing = await Listing.findByPk(listingId, lockOpt(t));
    if (!listing || listing.status !== E.LISTING_STATUS.APPROVED) throw fail(404, 'NOT_FOUND', 'This vehicle is not available any more.');
    if (String(listing.ownerId) === String(renterId)) throw fail(400, 'OWN_VEHICLE', 'You cannot book your own vehicle.');
    if (listing.campusId && ctx.campusId && String(listing.campusId) !== String(ctx.campusId)) {
      throw fail(403, 'CAMPUS_MISMATCH', 'This vehicle is listed for another campus.');
    }
    const owner = await User.findByPk(listing.ownerId, { attributes: ['id', 'isActive'], transaction: t });
    if (!owner || owner.isActive === false) throw fail(404, 'NOT_FOUND', 'This vehicle is not available any more.');
    const lic = await Licence.findOne({ where: { userId: renterId }, transaction: t });
    assertLicenceFor(lic, listing, { at: end });
    const problem = scheduleProblem(listing, start, end);
    if (problem) throw fail(409, problem.code, problem.message);
    const clash = await overlapping(Booking, listing.id, start, end, t);
    if (clash) throw fail(409, 'SLOT_TAKEN', 'Someone has already booked or requested this vehicle for part of that time. Try other times.');
    const openCount = await Booking.count({ where: { renterId, status: B.REQUESTED }, transaction: t });
    if (openCount >= E.LIMITS.MAX_OPEN_REQUESTS_PER_RENTER) {
      throw fail(429, 'TOO_MANY_OPEN_REQUESTS', `You already have ${openCount} requests waiting for owners. Cancel one or wait for answers.`);
    }
    const q = quote(listing, start, end);
    const respondBy = new Date(Math.min(Date.now() + E.LIMITS.RESPOND_WINDOW_MS, start.getTime()));
    return Booking.create({
      listingId: listing.id,
      ownerId: listing.ownerId,
      renterId,
      startAt: start,
      endAt: end,
      status: B.REQUESTED,
      billableHours: q.hours,
      rentAmount: q.rent,
      depositAmount: q.deposit,
      payAtHandover: q.payAtHandover,
      kmAllowance: q.kmAllowance,
      priceBreakdown: q,
      vehicleTitle: S.titleOf(listing).slice(0, 120),
      vehicleType: listing.vehicleType,
      renterNote: note,
      respondBy,
    }, { transaction: t });
  }));

  notify.booking(booking, {
    to: 'owner',
    title: 'New rental request 🚗',
    body: `${S.firstName(ctx.user && ctx.user.name)} wants your ${booking.vehicleTitle}. Answer within 2 hours.`,
    type: 'RENTAL_REQUEST',
  });
  notify.admin('rental_booking', 'created', booking.id);
  res.status(201).json({ booking: await present(req, booking, renterId) });
};

// GET /api/rentals/bookings?role=renter|owner&scope=open|past
const list = async (req, res) => {
  const { Booking, Listing, User } = M();
  const role = String(req.query.role || '').toLowerCase();
  const uid = req.user.id;
  const where = role === 'owner' ? { ownerId: uid } : role === 'renter' ? { renterId: uid } : { [Op.or]: [{ ownerId: uid }, { renterId: uid }] };
  const scope = String(req.query.scope || '').toLowerCase();
  if (scope === 'open') where.status = { [Op.in]: E.OPEN_STATUSES };
  else if (scope === 'past') where.status = { [Op.notIn]: E.OPEN_STATUSES };
  const rows = await Booking.findAll({ where, order: [['startAt', scope === 'past' ? 'DESC' : 'ASC']], limit: 100 });
  const listingIds = [...new Set(rows.map((r) => r.listingId))];
  const userIds = [...new Set(rows.flatMap((r) => [r.ownerId, r.renterId]))];
  const [listings, users] = await Promise.all([
    listingIds.length ? Listing.findAll({ where: { id: { [Op.in]: listingIds } } }) : [],
    userIds.length ? User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: USER_ATTRS }) : [],
  ]);
  const lById = new Map(listings.map((l) => [String(l.id), l]));
  const uById = new Map(users.map((u) => [String(u.id), u]));
  res.json({
    bookings: rows.map((r) => S.bookingFor(req, r, uid, {
      listing: lById.get(String(r.listingId)), owner: uById.get(String(r.ownerId)), renter: uById.get(String(r.renterId)),
    })),
  });
};

// GET /api/rentals/bookings/:id
const getOne = async (req, res) => {
  const row = await loadParty(req);
  if (await expireIfStale(row)) notify.booking(row, {});
  res.json({ booking: await present(req, row, req.user.id) });
};

/** Runs a state change on one booking inside the listing lock + a transaction. */
const mutate = (req, fn) => {
  const id = String(req.params.id || '');
  if (!isUuid(id)) throw fail(404, 'NOT_FOUND', 'Booking not found.');
  return M().Booking.findByPk(id, { attributes: ['id', 'listingId'] }).then((peek) => {
    if (!peek) throw fail(404, 'NOT_FOUND', 'Booking not found.');
    return withListingLock(peek.listingId, () => tx(async (t) => fn(await loadParty(req, t), t)));
  });
};

// POST /api/rentals/bookings/:id/accept
const accept = async (req, res) => {
  const { Booking, Listing, Licence } = M();
  let expired = false;
  const row = await mutate(req, async (b, t) => {
    asOwner(b, req);
    if (await expireIfStale(b, t)) { expired = true; return b; }
    if (b.status !== B.REQUESTED) throw fail(409, 'INVALID_STATE', `This request is already ${b.status.toLowerCase()}.`);
    const listing = await Listing.findByPk(b.listingId, { transaction: t });
    if (!listing || listing.status === E.LISTING_STATUS.DELETED) throw fail(409, 'INVALID_STATE', 'This vehicle was removed.');
    const lic = await Licence.findOne({ where: { userId: b.renterId }, transaction: t });
    assertLicenceFor(lic, listing, { requireVerified: true, at: b.endAt });
    const clash = await overlapping(Booking, b.listingId, new Date(b.startAt), new Date(b.endAt), t, b.id);
    if (clash) throw fail(409, 'SLOT_TAKEN', 'You already have another booking at this time.');
    const pickupPin = newPin();
    await b.update({ status: B.ACCEPTED, acceptedAt: new Date(), pickupPin, returnPin: newPin(pickupPin), pinAttempts: 0 }, { transaction: t });
    return b;
  });
  if (expired) {
    notify.booking(row, { to: 'renter', title: 'Rental request expired', body: `The owner did not answer in time for ${row.vehicleTitle}.`, type: 'RENTAL_EXPIRED' });
    throw fail(409, 'EXPIRED', 'This request expired before you answered.');
  }
  notify.booking(row, {
    to: 'renter',
    title: 'Rental confirmed ✅',
    body: `Your ${row.vehicleTitle} booking is confirmed. Pay ₹${row.payAtHandover} in cash at pickup (incl. refundable deposit).`,
    type: 'RENTAL_ACCEPTED',
  });
  res.json({ booking: await present(req, row, req.user.id) });
};

// POST /api/rentals/bookings/:id/decline { reason? }
const decline = async (req, res) => {
  const reason = cleanText(req.body && req.body.reason, 300) || null;
  const row = await mutate(req, async (b, t) => {
    asOwner(b, req);
    if (await expireIfStale(b, t)) throw fail(409, 'EXPIRED', 'This request has already expired.');
    if (b.status !== B.REQUESTED) throw fail(409, 'INVALID_STATE', `This request is already ${b.status.toLowerCase()}.`);
    await b.update({ status: B.DECLINED, declinedAt: new Date(), declineReason: reason }, { transaction: t });
    return b;
  });
  notify.booking(row, { to: 'renter', title: 'Rental request declined', body: `The owner could not rent ${row.vehicleTitle} for those times${reason ? `: ${reason}` : '.'}`, type: 'RENTAL_DECLINED' });
  res.json({ booking: await present(req, row, req.user.id) });
};

// POST /api/rentals/bookings/:id/cancel { reason? }  renter: before pickup time; owner: confirmed booking, reason required
const cancel = async (req, res) => {
  const reason = cleanText(req.body && req.body.reason, 300) || null;
  let by = null;
  const row = await mutate(req, async (b, t) => {
    const isRenter = String(b.renterId) === String(req.user.id);
    if (isRenter) {
      if (![B.REQUESTED, B.ACCEPTED].includes(b.status)) throw fail(409, 'INVALID_STATE', 'This booking can no longer be cancelled.');
      if (new Date(b.startAt).getTime() <= Date.now()) throw fail(409, 'TOO_LATE', 'The pickup time has passed. Ask the owner to cancel, or report a problem.');
      by = 'RENTER';
    } else {
      if (b.status === B.REQUESTED) throw fail(409, 'USE_DECLINE', 'Decline the request instead.');
      if (b.status !== B.ACCEPTED) throw fail(409, 'INVALID_STATE', b.status === B.ACTIVE ? 'The trip has started. Complete the return instead.' : 'This booking can no longer be cancelled.');
      if (!reason || reason.length < 5) throw fail(400, 'REASON_REQUIRED', 'Tell the renter why you are cancelling (at least 5 characters).', { field: 'reason' });
      by = 'OWNER';
    }
    await b.update({ status: B.CANCELLED, cancelledAt: new Date(), cancelledBy: by, cancelReason: reason }, { transaction: t });
    return b;
  });
  notify.booking(row, by === 'RENTER'
    ? { to: 'owner', title: 'Rental cancelled', body: `The renter cancelled ${row.vehicleTitle}${reason ? `: ${reason}` : '.'}`, type: 'RENTAL_CANCELLED' }
    : { to: 'renter', title: 'Rental cancelled by owner', body: `${row.vehicleTitle}: ${reason}`, type: 'RENTAL_CANCELLED' });
  res.json({ booking: await present(req, row, req.user.id) });
};

/** Owner types the renter's PIN. Wrong PINs are counted; 5 misses lock it for 15 minutes. */
const checkPin = async (b, pin, expected, t) => {
  const now = Date.now();
  if (b.pinLockedUntil && new Date(b.pinLockedUntil).getTime() > now) {
    const mins = Math.ceil((new Date(b.pinLockedUntil).getTime() - now) / 60000);
    throw fail(429, 'PIN_LOCKED', `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }
  const given = String(pin || '').replace(/\D/g, '');
  const ok = given.length === 4 && expected && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(String(expected)));
  if (ok) return { pinAttempts: 0, pinLockedUntil: null };
  const attempts = (Number(b.pinAttempts) || 0) + 1;
  if (attempts >= E.LIMITS.PIN_MAX_ATTEMPTS) {
    await b.update({ pinAttempts: 0, pinLockedUntil: new Date(now + E.LIMITS.PIN_LOCK_MS) }, { transaction: t });
    return { error: fail(429, 'PIN_LOCKED', 'Too many wrong PINs. Try again in 15 minutes.') };
  }
  await b.update({ pinAttempts: attempts }, { transaction: t });
  return { error: fail(400, 'WRONG_PIN', `That PIN is not right. ${E.LIMITS.PIN_MAX_ATTEMPTS - attempts} tries left.`, { attemptsLeft: E.LIMITS.PIN_MAX_ATTEMPTS - attempts }) };
};

// Wrong-PIN counters must persist even though the request fails: commit first, then throw.
const pinStep = async (req, res, { from, to, pinField, stampField, early, push }) => {
  let pinError = null;
  const row = await mutate(req, async (b, t) => {
    asOwner(b, req);
    if (b.status !== from) throw fail(409, 'INVALID_STATE', from === B.ACCEPTED ? 'This booking is not ready for pickup.' : 'This trip is not in progress.');
    if (early) early(b);
    const r = await checkPin(b, req.body && req.body.pin, b[pinField], t);
    if (r.error) { pinError = r.error; return b; }
    await b.update({ status: to, [stampField]: new Date(), ...r }, { transaction: t });
    return b;
  });
  if (pinError) throw pinError;
  notify.booking(row, push(row));
  res.json({ booking: await present(req, row, req.user.id) });
};

// POST /api/rentals/bookings/:id/handover { pin }  (owner enters the renter's pickup PIN)
const handover = (req, res) => pinStep(req, res, {
  from: B.ACCEPTED,
  to: B.ACTIVE,
  pinField: 'pickupPin',
  stampField: 'handoverAt',
  early: (b) => {
    if (Date.now() < new Date(b.startAt).getTime() - HOUR) throw fail(409, 'TOO_EARLY', 'Pickup opens 1 hour before the booked time.');
    if (Date.now() > new Date(b.endAt).getTime()) throw fail(409, 'TOO_LATE', 'This booking has already ended.');
  },
  push: (b) => ({ to: 'renter', title: 'Trip started 🔑', body: `Enjoy the ride! Return ${b.vehicleTitle} by ${new Date(b.endAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}.`, type: 'RENTAL_STARTED' }),
});

// POST /api/rentals/bookings/:id/return { pin }  (owner enters the renter's return PIN)
const markReturned = (req, res) => pinStep(req, res, {
  from: B.ACTIVE,
  to: B.RETURNED,
  pinField: 'returnPin',
  stampField: 'returnedAt',
  push: (b) => ({ to: 'renter', title: 'Vehicle returned', body: `Thanks for returning ${b.vehicleTitle}. Collect your ₹${b.depositAmount} deposit in cash.`, type: 'RENTAL_RETURNED' }),
});

/** COMPLETED bookkeeping shared by the owner action and the auto-complete job. */
const bumpTripCount = async (listingId, t) => {
  const { Listing } = M();
  await Listing.increment('tripCount', { by: 1, where: { id: listingId }, transaction: t });
};

// POST /api/rentals/bookings/:id/complete { extraKm?, otherCharges?, note? }
const complete = async (req, res) => {
  const body = req.body || {};
  const extraKm = num(body.extraKm, { min: 0, max: 5000, int: true, field: 'extraKm', label: 'Extra km' }) || 0;
  const otherCharges = num(body.otherCharges, { min: 0, max: 50000, field: 'otherCharges', label: 'Other charges' }) || 0;
  const note = cleanText(body.note, 300) || null;
  const row = await mutate(req, async (b, t) => {
    asOwner(b, req);
    if (b.status !== B.RETURNED) throw fail(409, 'INVALID_STATE', 'Mark the vehicle as returned first.');
    const listing = await M().Listing.findByPk(b.listingId, { transaction: t });
    const perKm = listing && Number(listing.extraPerKm) > 0 ? Number(listing.extraPerKm) : 0;
    if (extraKm > 0 && !perKm) throw fail(400, 'NO_KM_RATE', 'This vehicle has no extra-km charge set.', { field: 'extraKm' });
    const kmCharge = money(extraKm * perKm);
    const extras = money(kmCharge + otherCharges);
    await b.update({
      status: B.COMPLETED,
      completedAt: new Date(),
      extraCharges: extras,
      extraBreakdown: { extraKm, perKm: perKm || null, kmCharge, otherCharges, note },
      finalAmount: money((Number(b.rentAmount) || 0) + extras),
      ownerNote: note,
    }, { transaction: t });
    await bumpTripCount(b.listingId, t);
    return b;
  });
  notify.booking(row, {
    to: 'renter',
    title: 'Trip completed ⭐',
    body: row.extraCharges > 0 ? `Extra charges of ₹${row.extraCharges} were added by the owner. Rate your trip.` : `How was ${row.vehicleTitle}? Rate your trip.`,
    type: 'RENTAL_COMPLETED',
  });
  res.json({ booking: await present(req, row, req.user.id) });
};

const recomputeListingRating = async (listingId) => {
  const { Review, Listing } = M();
  const rows = await Review.findAll({ where: { listingId, role: 'RENTER', isHidden: { [Op.not]: true } }, attributes: ['rating'] });
  const count = rows.length;
  const avg = count ? rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count : 0;
  await Listing.update({ ratingAvg: Math.round(avg * 100) / 100, ratingCount: count }, { where: { id: listingId } });
};

// POST /api/rentals/bookings/:id/rate { rating 1-5, text? }
const rate = async (req, res) => {
  const body = req.body || {};
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw fail(400, 'INVALID_INPUT', 'Pick a rating from 1 to 5 stars.', { field: 'rating' });
  const text = cleanText(body.text, 500, { multiline: true }) || null;
  const { Booking, Review } = M();
  const b = await loadParty(req);
  if (b.status !== B.COMPLETED) throw fail(409, 'INVALID_STATE', 'You can rate once the trip is completed.');
  const isRenter = String(b.renterId) === String(req.user.id);
  const stamp = isRenter ? 'renterRatedAt' : 'ownerRatedAt';
  // Conditional claim: a double tap can never rate twice.
  const [n] = await Booking.update({ [stamp]: new Date() }, { where: { id: b.id, [stamp]: null } });
  if (!n) throw fail(409, 'ALREADY_RATED', 'You have already rated this trip.');
  try {
    await Review.create({
      bookingId: b.id,
      listingId: b.listingId,
      reviewerId: req.user.id,
      revieweeId: isRenter ? b.ownerId : b.renterId,
      role: isRenter ? 'RENTER' : 'OWNER',
      rating,
      text,
    });
  } catch (err) {
    await Booking.update({ [stamp]: null }, { where: { id: b.id } }).catch(() => {});
    if (/unique|constraint/i.test(String(err && (err.name || err.message)))) throw fail(409, 'ALREADY_RATED', 'You have already rated this trip.');
    throw err;
  }
  if (isRenter) await recomputeListingRating(b.listingId);
  notify.push(isRenter ? b.ownerId : b.renterId, 'New rating', `You received ${rating}★ for ${b.vehicleTitle}.`, { type: 'RENTAL_RATED', bookingId: b.id, screen: 'rental_booking' });
  notify.nudge([b.ownerId, b.renterId], 'booking', b.id, b.status);
  await b.reload();
  res.json({ booking: await present(req, b, req.user.id), message: 'Thanks for rating!' });
};

// POST /api/rentals/bookings/:id/report { category, description, photos? }
const report = async (req, res) => {
  const body = req.body || {};
  const category = String(body.category || '').toUpperCase();
  if (!E.REPORT_CATEGORIES.includes(category)) throw fail(400, 'INVALID_INPUT', 'Pick what went wrong.', { field: 'category' });
  const description = cleanText(body.description, 2000, { multiline: true });
  if (description.length < 10) throw fail(400, 'INVALID_INPUT', 'Describe what happened (at least 10 characters).', { field: 'description' });
  hit('report', req.user.id);
  const { Report } = M();
  const b = await loadParty(req);
  const reportable = [B.ACCEPTED, B.ACTIVE, B.RETURNED, B.COMPLETED, B.CANCELLED, B.EXPIRED];
  if (!reportable.includes(b.status)) throw fail(409, 'INVALID_STATE', 'You can report a problem once the booking is confirmed.');
  const already = await Report.count({ where: { bookingId: b.id, reporterId: req.user.id } });
  if (already >= 3) throw fail(429, 'TOO_MANY_REPORTS', 'You have already reported this booking. Our team will contact you.');
  const photos = await checkRefs(req.user.id, body.photos, { purposes: ['rental_report'], field: 'photos', max: 4, label: 'photo' });
  const isRenter = String(b.renterId) === String(req.user.id);
  const row = await Report.create({
    bookingId: b.id,
    listingId: b.listingId,
    reporterId: req.user.id,
    reporterRole: isRenter ? 'RENTER' : 'OWNER',
    againstUserId: isRenter ? b.ownerId : b.renterId,
    category,
    description,
    photos,
    status: 'OPEN',
  });
  notify.admin('rental_report', 'created', row.id);
  res.status(201).json({ report: { id: row.id, category, status: row.status, createdAt: row.createdAt }, message: 'Reported. The Zenvy team will look into it and contact you.' });
};

module.exports = {
  create, list, getOne, accept, decline, cancel, handover, markReturned, complete, rate, report,
  withListingLock, bumpTripCount, recomputeListingRating, expireIfStale, ratingOf,
};
