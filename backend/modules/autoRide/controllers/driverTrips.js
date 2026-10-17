// Driver trips (/api/auto-ride/driver/trips): drafts, publish (feature switch + verification gates),
// lifecycle actions, the live seat map, passenger list (first name + code + seats only), boarding
// check-in with booking code + PIN, passenger no-show, full-auto requests accept / decline.
const { Op } = require('sequelize');
const { getModel } = require('../index');
const E = require('../enums');
const { fail, cleanText, isUuid, num, parseTime, hit } = require('../services/util');
const S = require('../services/serialize');
const alloc = require('../services/allocation');
const actions = require('../services/tripActions');
const notify = require('../services/notify');
const { withTripLock } = require('../services/locks');
const { transitionTrip } = require('../services/stateMachine');
const { readSettings, assertOn } = require('../services/flag');
const { seatMapFor } = require('./customer');

const T = E.TRIP_STATUS;
const B = E.BOOKING_STATUS;
const M = () => ({
  Trip: getModel('AutoTrip'), Booking: getModel('AutoBooking'), Vehicle: getModel('AutoVehicle'), Route: getModel('AutoRoute'),
  Pickup: getModel('AutoPickupPoint'), Private: getModel('AutoPrivateRequest'), Event: getModel('AutoTripEvent'),
});

const ownTrip = async (req) => {
  const id = String(req.params.id || '');
  const t = isUuid(id) ? await M().Trip.findByPk(id) : null;
  // Another driver's trip is 404 (ids cannot be probed).
  if (!t || String(t.driverId) !== String(req.driver.id)) throw fail(404, 'NOT_FOUND', 'Trip not found.');
  return t;
};

const present = async (req, trip) => {
  const { Route, Pickup, Vehicle } = M();
  const [route, pickup, vehicle] = await Promise.all([Route.findByPk(trip.routeId), Pickup.findByPk(trip.pickupPointId), Vehicle.findByPk(trip.vehicleId)]);
  return S.tripDriver(req, trip, { route, pickup, vehicle });
};

const draftInput = async (req, body, current = null) => {
  const { Vehicle, Route, Pickup } = M();
  const settings = await readSettings();
  const pick = (k) => (body[k] !== undefined ? body[k] : current ? current[k] : undefined);
  const vehicleId = String(pick('vehicleId') || '');
  const v = isUuid(vehicleId) ? await Vehicle.findByPk(vehicleId) : null;
  if (!v || String(v.driverId) !== String(req.driver.id)) throw fail(400, 'INVALID_INPUT', 'Pick one of your autos.', { field: 'vehicleId' });
  const routeId = String(pick('routeId') || '');
  const route = isUuid(routeId) ? await Route.findByPk(routeId) : null;
  if (!route || route.isActive === false) throw fail(400, 'INVALID_INPUT', 'Pick an active route.', { field: 'routeId' });
  const pickupPointId = String(pick('pickupPointId') || '');
  const pickup = isUuid(pickupPointId) ? await Pickup.findByPk(pickupPointId) : null;
  if (!pickup || pickup.isActive === false || String(pickup.routeId) !== String(route.id)) throw fail(400, 'INVALID_INPUT', 'Pick a pickup point on this route.', { field: 'pickupPointId' });
  const departureAt = parseTime(pick('departureAt'), 'departureAt');
  const bookingOpensAt = pick('bookingOpensAt') ? parseTime(pick('bookingOpensAt'), 'bookingOpensAt') : null;
  if (bookingOpensAt && bookingOpensAt.getTime() >= departureAt.getTime()) throw fail(400, 'INVALID_INPUT', 'Booking must open before the departure time.', { field: 'bookingOpensAt' });
  const maxCap = Math.min(v.approvedCapacity || v.rcSeatingCapacity || 1, settings.platformMaxCapacity);
  const capacity = num(pick('capacity'), { min: 1, max: maxCap, int: true, field: 'capacity', label: 'Capacity' }) || maxCap;
  const seatFare = num(pick('seatFare'), { min: 1, max: E.LIMITS.MAX_FARE, field: 'seatFare', label: 'Seat fare' });
  if (seatFare === null) throw fail(400, 'INVALID_INPUT', 'Set the fare per seat.', { field: 'seatFare' });
  const privateBookingEnabled = pick('privateBookingEnabled') === true;
  const fullAutoFare = num(pick('fullAutoFare'), { min: 1, max: E.LIMITS.MAX_FULL_FARE, field: 'fullAutoFare', label: 'Full-auto fare' });
  if (privateBookingEnabled && !fullAutoFare) throw fail(400, 'INVALID_INPUT', 'Set a full-auto fare to accept full-auto bookings.', { field: 'fullAutoFare' });
  // Optional full-auto extra charges: { extraCharges: { amount, note } } (null / amount 0 clears them), or the
  // flat extraChargesAmount / extraChargesNote. Bounded: <= MAX_EXTRA_CHARGES and <= the full-auto fare.
  const ec = body.extraCharges !== undefined ? (body.extraCharges || { amount: null, note: null }) : null;
  const ecAmountRaw = ec ? ec.amount : pick('extraChargesAmount');
  const ecNoteRaw = ec ? ec.note : pick('extraChargesNote');
  const ecMax = Math.min(E.LIMITS.MAX_EXTRA_CHARGES, fullAutoFare || E.LIMITS.MAX_EXTRA_CHARGES);
  const extraChargesAmount = num(ecAmountRaw, { min: 0, max: ecMax, field: 'extraCharges.amount', label: 'Extra charges' }) || null;
  const extraChargesNote = extraChargesAmount ? cleanText(ecNoteRaw, 120) : '';
  if (extraChargesAmount && extraChargesNote.length < 3) throw fail(400, 'INVALID_INPUT', 'Say what the extra charges are for (e.g. luggage, night charge).', { field: 'extraCharges.note' });
  if (extraChargesAmount && !fullAutoFare) throw fail(400, 'INVALID_INPUT', 'Extra charges apply to full-auto bookings: set a full-auto fare first.', { field: 'extraCharges.amount' });
  const minDefault = Math.min(capacity, Number(route.minSeatsToDepartDefault) || capacity);
  const minSeatsToDepart = num(pick('minSeatsToDepart'), { min: 1, max: capacity, int: true, field: 'minSeatsToDepart', label: 'Minimum seats to depart' }) || minDefault;
  const permitted = Array.isArray(route.permittedStops) ? route.permittedStops.map(String) : [];
  const stopsRaw = pick('stops');
  const stops = Array.isArray(stopsRaw) ? [...new Set(stopsRaw.map((s) => cleanText(s, 80)).filter(Boolean))].slice(0, 10) : [];
  const bad = stops.filter((s) => !permitted.includes(s));
  if (bad.length) throw fail(400, 'INVALID_INPUT', `Stops must be from the route's permitted stops: ${permitted.join(', ') || 'none'}.`, { field: 'stops' });
  return {
    vehicleId: v.id, routeId: route.id, pickupPointId: pickup.id, departureAt, bookingOpensAt, capacity, seatFare,
    fullAutoFare: fullAutoFare || null, privateBookingEnabled,
    extraChargesAmount, extraChargesNote: extraChargesAmount ? extraChargesNote : null,
    seatSelectionEnabled: pick('seatSelectionEnabled') === undefined ? true : pick('seatSelectionEnabled') !== false,
    minSeatsToDepart, stops, destinationLabel: route.destinationLabel,
  };
};

// GET /api/auto-ride/driver/trips?scope=active|past|draft
const list = async (req, res) => {
  const scope = String(req.query.scope || '').toLowerCase();
  const where = { driverId: req.driver.id };
  if (scope === 'active') where.status = { [Op.in]: E.ACTIVE_TRIP_STATUSES };
  else if (scope === 'draft') where.status = T.DRAFT;
  else if (scope === 'past') where.status = { [Op.in]: E.TERMINAL_TRIP_STATUSES };
  const rows = await M().Trip.findAll({ where, order: [['departureAt', scope === 'past' ? 'DESC' : 'ASC']], limit: 100 });
  res.json({ trips: await Promise.all(rows.map((t) => present(req, t))) });
};

// POST /api/auto-ride/driver/trips  (DRAFT)
const create = async (req, res) => {
  hit('driver_write', req.driver.id);
  const data = await draftInput(req, req.body || {});
  const drafts = await M().Trip.count({ where: { driverId: req.driver.id, status: T.DRAFT } });
  if (drafts >= 10) throw fail(409, 'TOO_MANY_DRAFTS', 'You have 10 draft trips. Publish or delete some first.');
  const trip = await M().Trip.create({ ...data, driverId: req.driver.id, status: T.DRAFT, mode: E.MODE.SHARED });
  await M().Event.create({ tripId: trip.id, fromStatus: null, toStatus: T.DRAFT, actorType: 'driver', actorId: String(req.driver.id), note: 'Draft created' });
  res.status(201).json({ trip: await present(req, trip) });
};

// GET /api/auto-ride/driver/trips/:id
const detail = async (req, res) => {
  const trip = await ownTrip(req);
  res.json({ trip: await present(req, trip) });
};

// PATCH /api/auto-ride/driver/trips/:id   (drafts only: published trips can't change fare / capacity / seats)
const update = async (req, res) => {
  hit('driver_write', req.driver.id);
  const trip = await ownTrip(req);
  if (trip.status !== T.DRAFT) throw fail(409, 'TRIP_LOCKED', 'A published trip cannot be edited. Cancel it and publish a new one if needed.');
  const data = await draftInput(req, req.body || {}, trip.get({ plain: true }));
  const [n] = await M().Trip.update(data, { where: { id: trip.id, status: T.DRAFT } });
  if (!n) throw fail(409, 'TRIP_LOCKED', 'This trip was published meanwhile.');
  await trip.reload();
  res.json({ trip: await present(req, trip) });
};

// DELETE /api/auto-ride/driver/trips/:id  (draft -> CANCELLED)
const removeDraft = async (req, res) => {
  const trip = await ownTrip(req);
  if (trip.status !== T.DRAFT) throw fail(409, 'TRIP_LOCKED', 'Use the cancel action for a published trip.');
  const out = await withTripLock(trip.id, async (t, tr) => transitionTrip(tr, T.CANCELLED, { actor: 'driver', actorId: req.driver.id, t, note: 'Draft deleted', set: { cancelledBy: 'driver', cancelReason: 'Draft deleted' } }));
  res.json({ trip: await present(req, out) });
};

// POST /api/auto-ride/driver/trips/:id/publish
const publish = async (req, res) => {
  hit('driver_write', req.driver.id);
  await ownTrip(req);
  const trip = await actions.publish({ tripId: req.params.id, driverId: req.driver.id });
  res.json({ trip: await present(req, trip) });
};

// POST /api/auto-ride/driver/trips/:id/actions/:action
const action = async (req, res) => {
  hit('driver_write', req.driver.id);
  await ownTrip(req);
  const out = await actions.runAction({ tripId: req.params.id, driverId: req.driver.id, action: String(req.params.action || ''), body: req.body || {} });
  const trip = await M().Trip.findByPk(req.params.id);
  res.json({ trip: await present(req, trip), ...(out.cancelled ? { bookingsCancelled: out.cancelled.length } : {}) });
};

// GET /api/auto-ride/driver/trips/:id/bookings  (first name + code + seats; never phones / PINs)
const bookings = async (req, res) => {
  const trip = await ownTrip(req);
  const rows = await M().Booking.findAll({ where: { tripId: trip.id, status: { [Op.notIn]: [B.EXPIRED] } }, order: [['createdAt', 'ASC']] });
  const { getUserModel } = require('../../../models/User');
  const ids = [...new Set(rows.map((b) => String(b.userId)))];
  const users = ids.length ? await getUserModel().findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name'] }) : [];
  const byId = new Map(users.map((u) => [String(u.id), u]));
  res.json({ trip: { id: trip.id, ...S.tripStatus(trip) }, bookings: rows.map((b) => S.bookingDriver(b, byId.get(String(b.userId)))) });
};

// GET /api/auto-ride/driver/trips/:id/seats
const seats = async (req, res) => {
  const trip = await ownTrip(req);
  res.json({ tripId: trip.id, ...S.tripStatus(trip), ...(await seatMapFor(trip, null)) });
};

// POST /api/auto-ride/driver/trips/:id/check-in { bookingCode, pin, cashCollected? }
const checkIn = async (req, res) => {
  hit('check_in', req.driver.id);
  const trip = await ownTrip(req);
  const body = req.body || {};
  const r = await alloc.checkIn({ tripId: trip.id, driverId: req.driver.id, bookingCode: body.bookingCode, pin: body.pin, cashCollected: body.cashCollected === true });
  if (!r.already) notify.bookingEvent(r.booking, { title: 'You are checked in ✅', body: 'Have a safe ride with Zenvy Auto-Ride.', type: 'AUTO_BOARDED' });
  const { getUserModel } = require('../../../models/User');
  const u = await getUserModel().findByPk(r.booking.userId, { attributes: ['id', 'name'] });
  res.json({ booking: S.bookingDriver(r.booking, u), trip: { id: r.trip.id, ...S.tripStatus(r.trip) }, duplicate: !!r.already });
};

// POST /api/auto-ride/driver/trips/:id/bookings/:bookingId/no-show
const noShow = async (req, res) => {
  const trip = await ownTrip(req);
  const bookingId = String(req.params.bookingId || '');
  if (!isUuid(bookingId)) throw fail(404, 'NOT_FOUND', 'Booking not found.');
  const r = await alloc.markNoShow({ tripId: trip.id, driverId: req.driver.id, bookingId });
  notify.bookingEvent(r.booking, { title: 'Marked as no-show', body: 'The driver marked you as not at the pickup point. Contact support if this is wrong.', type: 'AUTO_NO_SHOW' });
  notify.tripEvent(r.trip, {});
  res.json({ booking: S.bookingDriver(r.booking, null), trip: { id: r.trip.id, ...S.tripStatus(r.trip) } });
};

// GET /api/auto-ride/driver/private-requests?status=REQUESTED
const privateRequests = async (req, res) => {
  const where = { driverId: req.driver.id };
  const st = String(req.query.status || '').toUpperCase();
  if (st) {
    if (!Object.values(E.PRIVATE_STATUS).includes(st)) throw fail(400, 'INVALID_INPUT', 'Unknown status.');
    where.status = st;
  }
  const rows = await M().Private.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
  const { getUserModel } = require('../../../models/User');
  const ids = [...new Set(rows.map((r) => String(r.userId)))];
  const users = ids.length ? await getUserModel().findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name'] }) : [];
  const byId = new Map(users.map((u) => [String(u.id), u]));
  res.json({ requests: rows.map((r) => S.privateRequestDriver(r, byId.get(String(r.userId)))) });
};

// POST /api/auto-ride/driver/private-requests/:id/accept
const acceptPrivate = async (req, res) => {
  await assertOn();
  const id = String(req.params.id || '');
  if (!isUuid(id)) throw fail(404, 'NOT_FOUND', 'Request not found.');
  const r = await alloc.acceptPrivateRequest({ requestId: id, driverId: req.driver.id });
  if (r.conflict) {
    notify.toCustomers([r.request.userId], 'Full-auto request could not be booked', 'Other passengers booked seats on this auto first. Nothing was charged. Pick another auto.', { type: 'AUTO_PRIVATE_CONFLICT', requestId: r.request.id });
    notify.nudgeCustomers([r.request.userId], 'private_request', r.request.id, r.request.status);
    throw fail(409, 'SEATS_ALREADY_BOOKED', 'Seats on this auto were booked by other passengers, so it can no longer be booked as a full auto.', { request: S.privateRequestDriver(r.request, null) });
  }
  if (r.paymentFailed) {
    notify.toCustomers([r.request.userId], 'Full-auto request declined', 'Your Zenvy Wallet balance was not enough. Nothing was charged.', { type: 'AUTO_PRIVATE_DECLINED', requestId: r.request.id });
    notify.nudgeCustomers([r.request.userId], 'private_request', r.request.id, r.request.status);
    throw fail(409, 'PAYMENT_FAILED', 'The passenger\'s wallet balance was not enough. The request was declined.');
  }
  if (!r.already) {
    notify.bookingEvent(r.booking, { title: 'Full auto booked ✅', body: `The driver accepted. Booking ${r.booking.bookingCode}, ₹${r.booking.amount}.`, type: 'AUTO_PRIVATE_ACCEPTED', requestId: r.request.id });
    // Live update for the request screen (it then opens the booking from request.bookingId).
    notify.nudgeCustomers([r.request.userId], 'private_request', r.request.id, r.request.status);
    for (const o of r.others || []) {
      notify.toCustomers([o.userId], 'Full-auto request closed', 'The auto was booked by someone else. Pick another auto.', { type: 'AUTO_PRIVATE_CONFLICT', requestId: o.id });
      notify.nudgeCustomers([o.userId], 'private_request', o.id, E.PRIVATE_STATUS.CONFLICT);
    }
    notify.tripEvent(r.trip, {});
  }
  const { getUserModel } = require('../../../models/User');
  const u = await getUserModel().findByPk(r.request.userId, { attributes: ['id', 'name'] });
  res.json({ request: S.privateRequestDriver(r.request, u), booking: r.booking ? S.bookingDriver(r.booking, u) : null, trip: { id: r.trip.id, ...S.tripStatus(r.trip) } });
};

// POST /api/auto-ride/driver/private-requests/:id/decline { reason? }
const declinePrivate = async (req, res) => {
  const id = String(req.params.id || '');
  if (!isUuid(id)) throw fail(404, 'NOT_FOUND', 'Request not found.');
  const r = await alloc.declinePrivateRequest({ requestId: id, driverId: req.driver.id, reason: (req.body || {}).reason });
  notify.toCustomers([r.userId], 'Full-auto request declined', `The driver declined${r.declineReason ? `: ${r.declineReason}` : '.'} Nothing was charged.`, { type: 'AUTO_PRIVATE_DECLINED', requestId: r.id });
  notify.nudgeCustomers([r.userId], 'private_request', r.id, r.status);
  res.json({ request: S.privateRequestDriver(r, null) });
};

module.exports = { list, create, detail, update, removeDraft, publish, action, bookings, seats, checkIn, noShow, privateRequests, acceptPrivate, declinePrivate };
