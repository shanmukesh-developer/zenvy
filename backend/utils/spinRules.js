// Lucky Spin rule (owner, 25 Nov 2026): every 5 delivered orders = 1 free spin (was every 2). The ONE place the
// number lives: rewardController, userRoutes /rewards, admin analytics, the SPIN_EARNED push and the app's
// spin-progress pop-up all read it from here.
//
// Every finished order of any kind counts (User.completedOrders, +1 exactly once per order): restaurant / grocery /
// bakery / stall Orders (services/BadgeService.creditCustomerForDelivery), Mega Basket deliveries, In-Campus Booking
// pickups (COLLECTED) and service bookings (COMPLETED) (BadgeService.creditCustomerForCompletion).
//
// Carry-over (scripts/spin_rule_5_v1.js, once): spins already earned under the old every-2 rule are kept in
// User.spinBonus = floor(completed / 2) - floor(completed / 5) at the switch, so nobody's unused spins drop.
const ORDERS_PER_SPIN = 5;
const LEGACY_ORDERS_PER_SPIN = 2;

const NO_SPINS_MESSAGE = `No spins left. Every ${ORDERS_PER_SPIN} delivered orders earn you a new spin!`;

const nonNeg = (v) => Math.max(0, Math.floor(Number(v) || 0));

/** Spins ever earned: one per ORDERS_PER_SPIN finished orders, plus the carry-over from the old rule. */
const spinsEarned = (user) => Math.floor(nonNeg(user && user.completedOrders) / ORDERS_PER_SPIN) + nonNeg(user && user.spinBonus);

/** Unused spins, never negative. */
const spinsAvailable = (user) => Math.max(0, spinsEarned(user) - nonNeg(user && user.spinsUsed));

/** True when an order count just completed a group of ORDERS_PER_SPIN (a new spin was earned by that order). */
const earnedSpinAt = (completedOrders) => {
  const n = nonNeg(completedOrders);
  return n > 0 && n % ORDERS_PER_SPIN === 0;
};

/** Progress towards the next spin: { deliveredCount, progress (0..ORDERS_PER_SPIN-1), toNext (1..ORDERS_PER_SPIN) }. */
const progressOf = (user) => {
  const deliveredCount = nonNeg(user && user.completedOrders);
  const progress = deliveredCount % ORDERS_PER_SPIN;
  return { deliveredCount, progress, toNext: ORDERS_PER_SPIN - progress };
};

/** Splits User.lastCompletedRef ("order:<id>", "basket:<id>", "campus:<id>", "service:<id>"). */
const parseRef = (ref) => {
  const s = String(ref || '');
  const i = s.indexOf(':');
  if (i <= 0) return { kind: null, id: null };
  return { kind: s.slice(0, i), id: s.slice(i + 1) || null };
};

/** The GET /api/rewards/spin-progress payload. */
const spinProgressJson = (user) => {
  const { kind, id } = parseRef(user && user.lastCompletedRef);
  const p = progressOf(user);
  return {
    ordersPerSpin: ORDERS_PER_SPIN,
    deliveredCount: p.deliveredCount,
    progress: p.progress,
    toNext: p.toNext,
    spinsAvailable: spinsAvailable(user),
    spinsUsed: nonNeg(user && user.spinsUsed),
    // The last finished order counted: the app shows its pop-up once per delivered order.
    justEarnedSpin: earnedSpinAt(p.deliveredCount),
    lastDeliveredAt: (user && user.lastCompletedAt) || null,
    lastDeliveredOrderId: id,
    lastDeliveredKind: kind,
  };
};

/** Old-rule spins over new-rule spins for a completed-order count (the carry-over a user keeps at the switch). */
const legacyCarryOver = (completedOrders) => {
  const n = nonNeg(completedOrders);
  return Math.max(0, Math.floor(n / LEGACY_ORDERS_PER_SPIN) - Math.floor(n / ORDERS_PER_SPIN));
};

module.exports = {
  ORDERS_PER_SPIN,
  LEGACY_ORDERS_PER_SPIN,
  NO_SPINS_MESSAGE,
  spinsEarned,
  spinsAvailable,
  earnedSpinAt,
  progressOf,
  spinProgressJson,
  legacyCarryOver,
  parseRef,
};
