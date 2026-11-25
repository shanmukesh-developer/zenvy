/**
 * Lucky Spin rule (owner, 25 Nov 2026): every 5 delivered orders = 1 free spin (was every 2). Mirrors
 * backend/utils/spinRules.js ORDERS_PER_SPIN; the server's GET /api/rewards/spin-progress also sends `ordersPerSpin`,
 * which wins whenever it is known. Every finished order counts: food, groceries, bakery, stall, Mega Basket,
 * In-Campus Booking pickups and laundry / service bookings.
 */
export const ORDERS_PER_SPIN = 5;
