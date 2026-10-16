// Queue numbers for autos at a pickup point. One sequence per (pickup point, route, IST day,
// operating period), assigned by the server at publish: a counter row (unique key
// auto_queue_counters_key) bumped with a compare-and-set UPDATE inside the publish transaction,
// with the partial unique index auto_trips_queue_unique as the backstop. Drivers never choose a number.
// Queue order is the order autos checked in; the departure order may differ (dispatch rules, FULL first).
const { getModel } = require('../index');
const { istYmd, istShift } = require('../../../utils/istTime');
const { fail } = require('./util');
const { lockOpt } = require('./locks');

const hhmm = (d) => istShift(d).toISOString().slice(11, 16);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** { key, label } of the route's operating period containing `when` (IST); 'DAY' when none configured. */
const periodFor = (route, when) => {
  const periods = Array.isArray(route && route.operatingPeriods) ? route.operatingPeriods.filter((p) => p && TIME_RE.test(p.start) && TIME_RE.test(p.end) && p.key) : [];
  if (!periods.length) return { key: 'DAY', label: 'All day' };
  const t = hhmm(when);
  const p = periods.find((x) => (x.start <= x.end ? t >= x.start && t < x.end : t >= x.start || t < x.end));
  if (!p) {
    throw fail(400, 'OUTSIDE_OPERATING_HOURS', `This route runs ${periods.map((x) => `${x.start}-${x.end}`).join(', ')} (IST). Pick a departure time inside those hours.`, { field: 'departureAt' });
  }
  return { key: String(p.key).toUpperCase().slice(0, 20), label: p.label || p.key };
};

/** Next queue number for the trip's key, inside transaction t. Returns { operatingDate, periodKey, queueNumber }. */
const nextQueueNumber = async ({ pickupPointId, routeId, departureAt, route, t }) => {
  const Counter = getModel('AutoQueueCounter');
  const operatingDate = istYmd(departureAt);
  const periodKey = periodFor(route, departureAt).key;
  const key = { pickupPointId, routeId, operatingDate, periodKey };
  let counter = await Counter.findOne({ where: key, ...lockOpt(t) });
  if (!counter) counter = await Counter.create({ ...key, lastNumber: 0 }, { transaction: t });
  const current = Number(counter.lastNumber) || 0;
  const [n] = await Counter.update({ lastNumber: current + 1 }, { where: { id: counter.id, lastNumber: current }, transaction: t });
  if (!n) {
    const e = fail(409, 'QUEUE_RETRY', 'The queue moved just now. Please try again.');
    throw e;
  }
  return { operatingDate, periodKey, queueNumber: current + 1 };
};

const queueKey = ({ pickupPointId, routeId, departureAt, route }) => `queue:${pickupPointId}:${routeId}:${istYmd(departureAt)}:${periodFor(route, departureAt).key}`;

module.exports = { periodFor, nextQueueNumber, queueKey, hhmm };
