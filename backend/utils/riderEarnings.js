// C6: the ONE rule for what a rider earns per delivered order. Used by the rider app API (today / week /
// history / order payloads / delivered reply), the admin rider payout list, rider payout statements and
// DeliveryPartner.totalEarnings.
//
// Rule:
//   Orders placed from 24 Nov 2026 carry Order.riderEarningPaise, fixed when the order is placed: a flat rider
//   incentive (default ₹3, GlobalConfig RIDER_INCENTIVE_PER_ORDER in rupees). ZenWe keeps the rest of the delivery
//   + platform fee. The customer's bill does not change. When that column is set, it is the earning.
//   Older orders (column null) keep the rule below, so past earnings and statements never change:
//   earning = the order's stored delivery fee.
//   A fee of ₹0 earns ₹0 (owner, 6 Nov 2026: a store with a ₹0 special delivery price must not cost ZenWe ₹30
//   per order). The old "₹30 when the fee is 0" fallback is kept ONLY for legacy orders saved before the
//   server-computed bill existed (Order.priceBreakdown is null), so old history and old statements do not change.
//   Callers must load 'priceBreakdown' with 'deliveryFee' (EARNING_ATTRS); a row without the key is read as legacy.
//   Stall orders (fulfilment 'VENDOR') have no Zenvy rider and earn nothing.
//   Tips are separate (rider wallet, C5 ledger) and are never part of the per-order earning.
//   Cash a rider collects for COD orders is separate too (rider cash ledger, utils/riderCash): it is
//   never netted off earnings.
//
// Why this rule: it is the number every rider saw per order and in "Earned today", it is what
// DeliveryPartner.totalEarnings accumulated, and it is the higher of the two old views. The old admin
// payout list summed the raw deliveryFee, which paid ₹0 for an order whose fee was 0 (delivery_fee set
// to 0) while the rider app showed ₹30. For every order with a fee > 0 both old views already agreed.
//
// deliveryFee is the GROSS fee stored at order creation (before batch / perk / coupon delivery
// discounts, which Zenvy funds), so a discount never reduces the rider's earning.
const BASE_DELIVERY_FEE = 30;
const BASE_DELIVERY_FEE_PAISE = BASE_DELIVERY_FEE * 100;

/** Rupees -> integer paise, round half up (same as utils/walletLedger.toPaise). */
const toPaise = (rupees) => {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n * 100 + 0.5);
};

const isStallOrder = (order) => String((order && order.fulfilment) || '').toUpperCase() === 'VENDOR';

/** The Order columns earningPaise reads (add them to every query whose rows are passed in). */
const EARNING_ATTRS = ['deliveryFee', 'fulfilment', 'priceBreakdown', 'riderEarningPaise'];

// Flat rider incentive per order (rupees), used for orders placed from 24 Nov 2026.
const DEFAULT_RIDER_INCENTIVE = 3;
const INCENTIVE_KEY = 'RIDER_INCENTIVE_PER_ORDER';

/** The incentive (paise) to fix on a new rider order: GlobalConfig RIDER_INCENTIVE_PER_ORDER (₹0..₹500) or ₹3. */
const currentIncentivePaise = async () => {
  try {
    const { getGlobalConfigModel } = require('../models/GlobalConfig');
    const GlobalConfig = getGlobalConfigModel();
    const row = GlobalConfig ? await GlobalConfig.findOne({ where: { key: INCENTIVE_KEY }, attributes: ['value'] }) : null;
    let v = row ? row.value : null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* plain text */ } }
    if (v && typeof v === 'object') v = v.rupees;
    const n = Number(v);
    if (v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 && n <= 500) return toPaise(n);
  } catch (err) {
    console.warn('[RIDER_INCENTIVE] config read failed, using the default:', err.message);
  }
  return toPaise(DEFAULT_RIDER_INCENTIVE);
};

/** The fixed incentive stored on the order, or null for an order placed before it existed. */
const storedIncentivePaise = (order) => {
  const v = order ? order.riderEarningPaise : null;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/** True for an order saved before the server bill (Order.priceBreakdown) existed. */
const isLegacyOrder = (order) => order.priceBreakdown === null || order.priceBreakdown === undefined || order.priceBreakdown === '';

/** What the rider earns for this order, in paise. */
const earningPaise = (order) => {
  if (!order || isStallOrder(order)) return 0;
  const fixed = storedIncentivePaise(order);
  if (fixed !== null) return fixed;
  const fee = toPaise(order.deliveryFee);
  if (fee > 0) return fee;
  return isLegacyOrder(order) ? BASE_DELIVERY_FEE_PAISE : 0;
};

/** Same, in rupees (the rider app and older code read rupees). */
const earningRupees = (order) => Math.round(earningPaise(order)) / 100;

/** Sum over many orders, in paise. */
const sumEarningsPaise = (orders) => (orders || []).reduce((s, o) => s + earningPaise(o), 0);

/**
 * The same rule as a SQL expression (per row, paise) for aggregates: SUM(<this>).
 * floor(x*100 + 0.5) like toPaise; SQLite has no FLOOR before 3.35 (CAST truncates toward zero).
 */
const earningPaiseSql = (dialect, feeCol = '"deliveryFee"', fulfilmentCol = '"fulfilment"', billCol = '"priceBreakdown"', incentiveCol = '"riderEarningPaise"') => {
  const v = `(COALESCE(${feeCol}, 0) * 100 + 0.5)`;
  const paise = dialect === 'postgres' ? `FLOOR(${v})` : `(CAST(${v} AS INTEGER) - (CASE WHEN ${v} < CAST(${v} AS INTEGER) THEN 1 ELSE 0 END))`;
  return `(CASE WHEN UPPER(COALESCE(${fulfilmentCol}, '')) = 'VENDOR' THEN 0 WHEN ${incentiveCol} IS NOT NULL THEN ${incentiveCol} WHEN ${paise} > 0 THEN ${paise} WHEN ${billCol} IS NULL THEN ${BASE_DELIVERY_FEE_PAISE} ELSE 0 END)`;
};

/**
 * Where the customer's delivery + platform fee goes, for the rider app ("₹23 from the customer: ZenWe ₹20, you ₹3").
 * null for orders without a fixed incentive (older orders: the rider earns the delivery fee, nothing to split).
 */
const feeSplit = (order) => {
  if (!order || isStallOrder(order) || storedIncentivePaise(order) === null) return null;
  const deliveryFeePaise = Math.max(0, toPaise(order.deliveryFee));
  const platformFeePaise = Math.max(0, toPaise(order.platformFee));
  const feesPaise = deliveryFeePaise + platformFeePaise;
  const riderPaise = earningPaise(order);
  const rupees = (p) => Math.round(p) / 100;
  return {
    deliveryFee: rupees(deliveryFeePaise),
    platformFee: rupees(platformFeePaise),
    customerFees: rupees(feesPaise),
    zenweShare: rupees(Math.max(0, feesPaise - riderPaise)),
    riderIncentive: rupees(riderPaise),
  };
};

/**
 * Where the whole order amount goes, for the rider's order history: the restaurant's share (item subtotal minus
 * ZenWe's commission, the store payout snapshot Order.storeNetPaise), the rider's incentive, and ZenWe's share
 * (everything else: commission + delivery / platform / packaging fees + taxes − discounts − the rider incentive).
 * The three add up to what the customer paid (same parts as utils/revenueReport). null on orders without a fixed
 * incentive or without the commission snapshot.
 */
const orderSplit = (order) => {
  if (!order || isStallOrder(order) || storedIncentivePaise(order) === null) return null;
  const v = order.storeNetPaise;
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return null;
  const customerPaise = Math.max(0, toPaise(order.finalPrice));
  const restaurantPaise = Math.max(0, Math.round(Number(v)));
  const riderPaise = earningPaise(order);
  const rupees = (p) => Math.round(p) / 100;
  return {
    customerPaid: rupees(customerPaise),
    restaurant: rupees(restaurantPaise),
    zenwe: rupees(customerPaise - restaurantPaise - riderPaise),
    riderIncentive: rupees(riderPaise),
  };
};

module.exports = {
  BASE_DELIVERY_FEE, BASE_DELIVERY_FEE_PAISE, EARNING_ATTRS, DEFAULT_RIDER_INCENTIVE, INCENTIVE_KEY, isLegacyOrder, toPaise,
  earningPaise, earningRupees, sumEarningsPaise, earningPaiseSql, isStallOrder, currentIncentivePaise, feeSplit, orderSplit,
};
