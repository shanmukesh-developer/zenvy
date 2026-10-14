// Rentals notifications: push (+ in-app list via sendPushToTokens recipients) and an ids-only socket
// nudge to the student's own room so open screens refetch. Admin queue changes go to admin-room.
// Never throws, never blocks the request (fire-and-forget).
const realtime = require('../../../utils/realtime');

const push = (userIds, title, body, data = {}) => {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
  if (!ids.length) return;
  Promise.resolve()
    .then(() => require('../../campus/campusHelpers').pushToUsers(ids, title, body, data))
    .catch((err) => console.warn('[RENTALS_PUSH_WARN]', err.message));
};

/** `rental:changed` { kind, id, status? } to each user's socket room (no names, phones or prices). */
const nudge = (userIds, kind, id, status) => {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
  ids.forEach((uid) => realtime.toUser(uid, 'rental:changed', { kind, id, ...(status ? { status } : {}) }));
};

/** Booking event to both / one party: push + socket. */
const booking = (b, { to, title, body, type }) => {
  const recipients = to === 'owner' ? [b.ownerId] : to === 'renter' ? [b.renterId] : [b.ownerId, b.renterId];
  if (title) push(recipients, title, body, { type, bookingId: b.id, screen: 'rental_booking' });
  nudge([b.ownerId, b.renterId], 'booking', b.id, b.status);
  realtime.notifyAdmin('rental_booking', 'updated', b.id);
};

const admin = (type, action, id) => realtime.notifyAdmin(type, action, id);
/** Public listing visibility changed (approved / paused / deleted): browsers refetch. */
const listingChanged = (id) => realtime.publish('rental', 'updated', id);

module.exports = { push, nudge, booking, admin, listingChanged };
