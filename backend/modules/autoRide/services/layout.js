// Seat layouts (top-down, rows front to back): { rows: [['D', 1], [2, 3, 4], [5, 6, 7, 8]] }.
// 'D' = driver seat (never bookable), null = gap, numbers = passenger seats 1..capacity, each once.
// The admin sets / confirms the layout at vehicle approval; trips snapshot it at publish.
const { fail } = require('./util');
const { LIMITS } = require('../enums');

/**
 * Default arrangement for any capacity: driver row (+1 seat beside the driver when capacity >= 4),
 * then the remaining seats spread over benches of at most 4 (8 -> D+1 | 3 | 4).
 */
const defaultLayout = (capacity) => {
  const cap = Math.max(1, Math.min(LIMITS.ABSOLUTE_MAX_CAPACITY, Number(capacity) || 1));
  const front = cap >= 4 ? 1 : 0;
  const rows = [front ? ['D', 1] : ['D']];
  const rem = cap - front;
  const benches = Math.max(1, Math.ceil(rem / 4));
  let next = front + 1;
  for (let b = 0; b < benches; b++) {
    const left = cap - next + 1;
    const size = Math.floor(left / (benches - b)) || left;
    const row = [];
    for (let i = 0; i < size && next <= cap; i++) row.push(next++);
    if (row.length) rows.push(row);
  }
  return { rows };
};

/** Validates an admin-supplied layout for `capacity` seats; returns a clean copy. */
const validateLayout = (layout, capacity) => {
  if (!layout || typeof layout !== 'object' || !Array.isArray(layout.rows)) {
    throw fail(400, 'INVALID_LAYOUT', 'seatLayout must be { rows: [[...], ...] }.', { field: 'seatLayout' });
  }
  const rows = layout.rows;
  if (!rows.length || rows.length > LIMITS.MAX_LAYOUT_ROWS) throw fail(400, 'INVALID_LAYOUT', `A layout has 1 to ${LIMITS.MAX_LAYOUT_ROWS} rows.`, { field: 'seatLayout' });
  const seen = new Set();
  let drivers = 0;
  const clean = rows.map((row) => {
    if (!Array.isArray(row) || !row.length || row.length > LIMITS.MAX_LAYOUT_COLS) {
      throw fail(400, 'INVALID_LAYOUT', `Each row has 1 to ${LIMITS.MAX_LAYOUT_COLS} places.`, { field: 'seatLayout' });
    }
    return row.map((cell) => {
      if (cell === null) return null;
      if (cell === 'D') { drivers++; return 'D'; }
      const n = Number(cell);
      if (!Number.isInteger(n) || n < 1 || n > capacity || seen.has(n)) {
        throw fail(400, 'INVALID_LAYOUT', `Seats must be numbered 1 to ${capacity}, each exactly once.`, { field: 'seatLayout' });
      }
      seen.add(n);
      return n;
    });
  });
  if (drivers !== 1) throw fail(400, 'INVALID_LAYOUT', 'The layout needs exactly one driver seat (D).', { field: 'seatLayout' });
  if (seen.size !== capacity) throw fail(400, 'INVALID_LAYOUT', `The layout must show all ${capacity} passenger seats.`, { field: 'seatLayout' });
  return { rows: clean };
};

/** Layout for a trip of `capacity` seats taken from a vehicle layout (extra seats become gaps). */
const layoutForTrip = (vehicleLayout, capacity) => {
  let base = vehicleLayout && Array.isArray(vehicleLayout.rows) ? vehicleLayout : null;
  if (!base) return defaultLayout(capacity);
  const rows = base.rows.map((r) => r.map((c) => (typeof c === 'number' && c > capacity ? null : c)));
  const count = rows.flat().filter((c) => typeof c === 'number').length;
  if (count !== capacity) return defaultLayout(capacity);
  base = { rows };
  return base;
};

module.exports = { defaultLayout, validateLayout, layoutForTrip };
