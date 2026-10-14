// Server-side rental pricing and availability rules. The app only displays what this returns:
// prices are never read from the client.
const { fail, money } = require('./util');
const { LIMITS } = require('../enums');

const HOUR = 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000; // India has no DST

/** { date: 'YYYY-MM-DD', dow: 0-6 (Sun = 0), minutes: minutes since IST midnight } */
const istParts = (d) => {
  const t = new Date(new Date(d).getTime() + IST_OFFSET_MS);
  return {
    date: t.toISOString().slice(0, 10),
    dow: t.getUTCDay(),
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
  };
};
/** IST midnight of a 'YYYY-MM-DD' date, as a Date. */
const istDayStart = (dateStr) => new Date(`${dateStr}T00:00:00+05:30`);

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMinutes = (hhmm) => {
  const m = HHMM_RE.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmtHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parses an ISO date-time from the client; throws INVALID_TIME. */
const parseTime = (v, field) => {
  if (typeof v !== 'string' && typeof v !== 'number') throw fail(400, 'INVALID_TIME', `Pick a ${field === 'endAt' ? 'return' : 'pickup'} date and time.`, { field });
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw fail(400, 'INVALID_TIME', `That ${field === 'endAt' ? 'return' : 'pickup'} time is not valid.`, { field });
  return d;
};

/** Validates a trip window (shape only, not availability). opts.forBooking adds lead-time rules. */
const validateWindow = (start, end, { forBooking = false, now = Date.now() } = {}) => {
  if (end.getTime() <= start.getTime()) throw fail(400, 'INVALID_TIME', 'The return time must be after the pickup time.');
  if (end.getTime() - start.getTime() > LIMITS.MAX_BOOKING_DAYS * 24 * HOUR) {
    throw fail(400, 'TOO_LONG', `A rental can be at most ${LIMITS.MAX_BOOKING_DAYS} days.`);
  }
  if (forBooking) {
    if (start.getTime() < now + LIMITS.MIN_LEAD_MINUTES * 60 * 1000) {
      throw fail(400, 'TOO_SOON', `Pickup must be at least ${LIMITS.MIN_LEAD_MINUTES} minutes from now so the owner can respond.`);
    }
    if (start.getTime() > now + LIMITS.MAX_ADVANCE_DAYS * 24 * HOUR) {
      throw fail(400, 'TOO_FAR', `You can book up to ${LIMITS.MAX_ADVANCE_DAYS} days ahead.`);
    }
  }
};

/**
 * Price for renting `listing` from start to end.
 * Hours are rounded up and never below the listing's minimum hours. With both rates, full days use
 * the day rate and the leftover hours the hour rate, capped at one more day. Day-rate only: whole days
 * rounded up. Hour-rate only: hours x rate.
 */
const quote = (listing, start, end) => {
  const perHour = Number(listing.pricePerHour) > 0 ? Number(listing.pricePerHour) : null;
  const perDay = Number(listing.pricePerDay) > 0 ? Number(listing.pricePerDay) : null;
  if (!perHour && !perDay) throw fail(409, 'NO_PRICE', 'This vehicle has no price set yet.');
  const rawHours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / HOUR));
  const minHours = Math.max(1, Number(listing.minHours) || 1);
  const hours = Math.max(rawHours, minHours);

  let rent;
  let mode;
  let days = 0;
  let remHours = 0;
  if (perHour && perDay) {
    days = Math.floor(hours / 24);
    remHours = hours % 24;
    rent = days * perDay + Math.min(remHours * perHour, perDay);
    mode = days > 0 ? (remHours > 0 ? 'MIXED' : 'DAILY') : 'HOURLY';
    if (days === 0 && remHours * perHour > perDay) mode = 'DAILY';
  } else if (perDay) {
    days = Math.max(1, Math.ceil(hours / 24));
    rent = days * perDay;
    mode = 'DAILY';
  } else {
    rent = hours * perHour;
    mode = 'HOURLY';
    remHours = hours;
  }
  rent = money(rent);
  const deposit = money(Number(listing.securityDeposit) || 0);
  const tripDays = Math.max(1, Math.ceil(hours / 24));
  const kmAllowance = Number(listing.kmLimitPerDay) > 0 ? Number(listing.kmLimitPerDay) * tripDays : null;
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    hours,
    rawHours,
    minHoursApplied: hours > rawHours,
    days,
    remHours,
    mode,
    pricePerHour: perHour,
    pricePerDay: perDay,
    rent,
    deposit,
    payAtHandover: money(rent + deposit),
    kmAllowance,
    extraPerKm: Number(listing.extraPerKm) > 0 ? Number(listing.extraPerKm) : null,
    currency: 'INR',
    paymentNote: 'Pay the rent and the refundable deposit in cash to the owner at pickup. The deposit is returned in cash when you bring the vehicle back.',
  };
};

/**
 * Weekly hours + blocked dates. Returns null when the window is allowed, or { code, message }.
 * Pickup and return moments must fall inside the owner's hours for those days (the vehicle can stay
 * with the renter overnight); no part of the trip may touch a blocked date.
 */
const scheduleProblem = (listing, start, end) => {
  const weekly = listing.weeklyHours && typeof listing.weeklyHours === 'object' ? listing.weeklyHours : {};
  const hasWeekly = Object.keys(weekly).length > 0;
  if (hasWeekly) {
    for (const [moment, label] of [[start, 'Pickup'], [end, 'Return']]) {
      const p = istParts(moment);
      const w = weekly[String(p.dow)];
      if (!w) return { code: 'OUTSIDE_HOURS', message: `${label} is not possible on ${DAY_NAMES[p.dow]}s for this vehicle.` };
      const a = toMinutes(w.start);
      const b = toMinutes(w.end);
      if (a === null || b === null) continue;
      const inside = a <= b ? p.minutes >= a && p.minutes <= b : p.minutes >= a || p.minutes <= b;
      if (!inside) return { code: 'OUTSIDE_HOURS', message: `${label} on ${DAY_NAMES[p.dow]} must be between ${fmtHHMM(a)} and ${fmtHHMM(b)}.` };
    }
  }
  const blocked = Array.isArray(listing.blockedDates) ? listing.blockedDates : [];
  for (const r of blocked) {
    if (!r || !r.start || !r.end) continue;
    const bs = istDayStart(r.start).getTime();
    const be = istDayStart(r.end).getTime() + 24 * HOUR;
    if (Number.isNaN(bs) || Number.isNaN(be)) continue;
    if (start.getTime() < be && end.getTime() > bs) {
      return { code: 'DATES_BLOCKED', message: r.start === r.end ? `The owner is not renting on ${r.start}.` : `The owner is not renting from ${r.start} to ${r.end}.` };
    }
  }
  return null;
};

module.exports = { quote, scheduleProblem, validateWindow, parseTime, istParts, istDayStart, toMinutes, HHMM_RE, HOUR };
