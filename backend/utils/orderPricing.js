// Server-side order pricing. Every orderable line is priced from the database; nothing the
// client sends about prices is trusted. Used by POST /api/orders/quote and POST /api/orders.
const { Op } = require('sequelize');
const { getMenuItemModel } = require('../models/MenuItem');
const { getRestaurantModel } = require('../models/Restaurant');
const { isLocalVendorStore } = require('./vendorTypes');
const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const { getGlobalConfigModel } = require('../models/GlobalConfig');
const { calculateBadgePerks } = require('../middleware/rewardEngine');
const { calculateCustomizationCost } = require('./pricingSchema');
const { getStoreOpenState } = require('./storeHours');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QTY = 20;
const MAX_LINES = 50;
const DEFAULT_DELIVERY_FEE = 30;
const ADDON_VENDOR_TYPE = 'EXTRAS';

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

class PricingError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
  toBody() {
    return { message: this.message, code: this.code, ...this.extra };
  }
}

const readConfigNumber = async (key, fallback) => {
  try {
    const GlobalConfig = getGlobalConfigModel();
    if (!GlobalConfig) return fallback;
    const row = await GlobalConfig.findOne({ where: { key } });
    if (!row || row.value === null || row.value === undefined || row.value === '') return fallback;
    const n = Number(row.value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
};

// Coupons usable right now: not used, and not expired (null expiry = no expiry).
const activeCouponWhere = (code, userId) => ({
  code,
  userId,
  isUsed: false,
  [Op.or]: [{ expiryDate: null }, { expiryDate: { [Op.gt]: new Date() } }]
});

const couponDiscountFor = (coupon, { subtotal, deliveryFee }) => {
  if (!coupon) return { delivery: 0, items: 0 };
  if (coupon.type === 'FREEDEL') return { delivery: deliveryFee, items: 0 };
  if (coupon.type === 'DISCOUNT') {
    const value = Number(coupon.value) || 0;
    // Older DISCOUNT coupons were created without a value: they were worth 20% up to ₹50.
    const amount = value > 0 ? value : Math.min(50, Math.round(subtotal * 0.2));
    return { delivery: 0, items: Math.min(amount, subtotal) };
  }
  return { delivery: 0, items: 0 };
};

const isItemAvailable = (dbItem, now = new Date()) => {
  if (dbItem.isAvailable) return true;
  // "Out of stock until X" items come back on their own once X has passed.
  return !!(dbItem.outOfStockUntil && new Date(dbItem.outOfStockUntil) <= now);
};

/**
 * @param {object} args
 * @param {object} args.user      Sequelize User row (the customer)
 * @param {Array}  args.items     [{ menuItemId|id, quantity, customizations?, name? }]
 * @param {string} [args.couponCode]
 * @returns quote (throws PricingError for anything the customer must fix)
 */
const computeOrderQuote = async ({ user, items, couponCode }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PricingError(400, 'EMPTY_BASKET', 'Your basket is empty. Add something tasty first!');
  }
  if (items.length > MAX_LINES) {
    throw new PricingError(400, 'TOO_MANY_LINES', `That's a big basket! Please keep it to ${MAX_LINES} different items per order.`);
  }

  const MenuItem = getMenuItemModel();
  const Restaurant = getRestaurantModel();
  const { resolveLegacyItemId } = require('../scripts/catalogue_import');

  // 1. Resolve ids + validate quantities
  const lines = [];
  const problems = [];
  for (const raw of items) {
    const rawId = raw && (raw.menuItemId || raw.id || raw._id);
    const label = (raw && raw.name) ? String(raw.name).slice(0, 80) : 'An item';
    const qty = Number(raw && raw.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      throw new PricingError(400, 'INVALID_QUANTITY', `You can order 1 to ${MAX_QTY} of each item. Please check the quantity of "${label}".`);
    }
    let id = typeof rawId === 'string' ? rawId.trim() : (rawId != null ? String(rawId) : '');
    if (!UUID_RE.test(id)) {
      id = (await resolveLegacyItemId(id, raw && raw.name)) || null;
    }
    if (!id) {
      problems.push({ id: rawId != null ? String(rawId) : null, name: label, reason: 'not_found' });
      continue;
    }
    lines.push({ id, qty, customizations: raw.customizations && typeof raw.customizations === 'object' ? raw.customizations : null, label });
  }

  const ids = [...new Set(lines.map(l => l.id))];
  const dbItems = ids.length ? await MenuItem.findAll({ where: { id: ids } }) : [];
  const itemMap = new Map(dbItems.map(i => [i.id, i]));
  const restIds = [...new Set(dbItems.map(i => i.restaurantId))];
  const rests = restIds.length ? await Restaurant.findAll({ where: { id: restIds } }) : [];
  const restMap = new Map(rests.map(r => [r.id, r]));

  const isElite = !!(user && (user.isElite || (Array.isArray(user.badges) && user.badges.some(b => typeof b === 'string' && b.includes('Elite')))));
  const bookingOnly = [];
  const localVendorStores = new Map();
  for (const line of lines) {
    const dbItem = itemMap.get(line.id);
    const store = dbItem && restMap.get(dbItem.restaurantId);
    if (!dbItem || !store) { problems.push({ id: line.id, name: line.label, reason: 'not_found' }); continue; }
    if (isLocalVendorStore(store)) { localVendorStores.set(store.id, store); continue; }
    const specs = dbItem.specs && typeof dbItem.specs === 'object' ? dbItem.specs : {};
    if (specs.bookingOnly) { bookingOnly.push(dbItem.name); continue; }
    if (!isItemAvailable(dbItem) || !(Number(dbItem.price) > 0)) { problems.push({ id: dbItem.id, name: dbItem.name, reason: 'out_of_stock' }); continue; }
    if (store.isActive === false) { problems.push({ id: dbItem.id, name: dbItem.name, reason: 'store_unavailable' }); continue; }
    if (dbItem.isEliteOnly && !isElite) { problems.push({ id: dbItem.id, name: dbItem.name, reason: 'elite_only' }); continue; }
    line.dbItem = dbItem;
    line.store = store;
  }

  // CampusBites stalls are display-only: the customer orders straight from the vendor.
  if (localVendorStores.size) {
    const stalls = [...localVendorStores.values()];
    throw new PricingError(400, 'LOCAL_VENDOR_DIRECT_ORDER',
      `Order this directly from the stall by call or WhatsApp.${stalls.length === 1 ? ` ${stalls[0].name} takes the order and delivers it themselves.` : ''}`,
      { stores: stalls.map(st => ({ id: st.id, name: st.name, whatsappNumber: st.whatsappNumber || null })) });
  }
  if (bookingOnly.length) {
    throw new PricingError(400, 'BOOKING_ONLY_ITEMS', `${bookingOnly.join(', ')} ${bookingOnly.length > 1 ? 'are services' : 'is a service'} — please book ${bookingOnly.length > 1 ? 'them' : 'it'} from the service page instead of the basket.`, { bookingOnlyItems: bookingOnly });
  }
  if (problems.length) {
    const names = [...new Set(problems.map(p => p.name))];
    throw new PricingError(400, 'ITEMS_UNAVAILABLE',
      `Some items in your basket are no longer available: ${names.join(', ')}. Please remove ${names.length > 1 ? 'them' : 'it'} and try again.`,
      { unavailableItems: problems });
  }

  // 2. One store per order. Add-ons (EXTRAS) ride along with the main store's order.
  const mainStores = new Map();
  for (const l of lines) {
    if ((l.store.vendorType || '').toUpperCase() !== ADDON_VENDOR_TYPE) mainStores.set(l.store.id, l.store);
  }
  if (mainStores.size === 0) {
    throw new PricingError(400, 'ADDONS_ONLY', 'Add-ons can only be ordered together with a main item. Add something from a restaurant or store first.');
  }
  if (mainStores.size > 1) {
    const names = [...mainStores.values()].map(s => s.name);
    throw new PricingError(400, 'MULTIPLE_STORES',
      `Your basket has items from ${names.join(' and ')}. Each order comes from one store — please place a separate order for each.`,
      { stores: [...mainStores.values()].map(s => ({ id: s.id, name: s.name })) });
  }
  const store = [...mainStores.values()][0];
  const openState = getStoreOpenState(store);
  if (!openState.isOpen) {
    throw new PricingError(400, 'STORE_CLOSED', openState.message, { storeId: store.id, opensAt: openState.opensAt || null });
  }

  // 3. Price every line from the DB
  let subtotal = 0;
  const pricedLines = lines.map((l) => {
    const isAddOn = (l.store.vendorType || '').toUpperCase() === ADDON_VENDOR_TYPE;
    const basePrice = money(l.dbItem.price);
    const addOnPrice = isAddOn ? 0 : money(calculateCustomizationCost(basePrice, l.dbItem, l.customizations));
    const unitPrice = money(basePrice + addOnPrice);
    const lineTotal = money(unitPrice * l.qty);
    subtotal = money(subtotal + lineTotal);
    return {
      menuItemId: l.dbItem.id,
      id: l.dbItem.id,
      name: l.dbItem.name,
      quantity: l.qty,
      basePrice,
      addOnPrice,
      unitPrice,
      price: unitPrice,
      priceAtOrder: unitPrice,
      lineTotal,
      customizations: isAddOn ? null : l.customizations,
      image: l.dbItem.imageUrl || '',
      restaurantId: l.dbItem.restaurantId,
      isAddOn
    };
  });

  // 4. Fees
  const deliveryFee = money(await readConfigNumber('delivery_fee', DEFAULT_DELIVERY_FEE));
  const packagingFee = 0; // no packaging charge on Zenvy today
  const taxes = 0;        // prices are inclusive of taxes

  // 5. Discounts (all real, all server-side)
  const discounts = [];
  let deliveryDiscountLeft = deliveryFee;
  const addDeliveryDiscount = (type, label, amount) => {
    const a = money(Math.min(amount, deliveryDiscountLeft));
    if (a > 0) { discounts.push({ type, label, amount: a }); deliveryDiscountLeft = money(deliveryDiscountLeft - a); }
  };

  // Batching: another live order from the same store to the same hostel block shares the ride.
  if (user && user.hostelBlock) {
    try {
      const Order = getOrderModel();
      const User = getUserModel();
      const batchable = await Order.findOne({
        where: { restaurantId: store.id, status: ['Pending', 'Accepted', 'Preparing'], userId: { [Op.ne]: user.id } },
        include: [{ model: User, as: 'user', attributes: [], where: { hostelBlock: user.hostelBlock } }]
      });
      if (batchable) addDeliveryDiscount('batch', 'Shared ride with your block', Math.round(deliveryFee * 0.2));
    } catch { /* batching is a bonus, never block an order on it */ }
  }

  const perks = calculateBadgePerks(user);
  if (perks.deliveryDiscount > 0) addDeliveryDiscount('perk_delivery', `${perks.status} delivery perk`, Math.round(deliveryFee * perks.deliveryDiscount));

  let coupon = null;
  if (couponCode) {
    const { getCouponModel } = require('../models/Coupon');
    const Coupon = getCouponModel();
    coupon = await Coupon.findOne({ where: activeCouponWhere(String(couponCode).trim(), user.id) });
    if (!coupon) {
      throw new PricingError(400, 'COUPON_INVALID', 'That coupon is not valid any more (it may be used or expired). Remove it to continue.');
    }
  }
  let itemsDiscountLeft = subtotal;
  const addItemsDiscount = (type, label, amount) => {
    const a = money(Math.min(amount, itemsDiscountLeft));
    if (a > 0) { discounts.push({ type, label, amount: a }); itemsDiscountLeft = money(itemsDiscountLeft - a); }
  };
  if (perks.orderDiscount > 0) {
    // A flat perk can take at most half of the item total, so no order becomes free.
    addItemsDiscount('perk_order', `${perks.status} perk`, Math.min(perks.orderDiscount, Math.floor(subtotal * 0.5)));
  }
  if (coupon) {
    const c = couponDiscountFor(coupon, { subtotal, deliveryFee });
    if (c.delivery > 0) addDeliveryDiscount('coupon', `Coupon ${coupon.code}`, c.delivery);
    if (c.items > 0) addItemsDiscount('coupon', `Coupon ${coupon.code}`, c.items);
  }

  const totalDiscount = money(discounts.reduce((s, d) => s + d.amount, 0));
  const finalPrice = money(Math.max(0, subtotal + deliveryFee + packagingFee + taxes - totalDiscount));
  const sumOf = (types) => money(discounts.filter(d => types.includes(d.type)).reduce((s, d) => s + d.amount, 0));

  return {
    currency: 'INR',
    store: { id: store.id, name: store.name, vendorType: store.vendorType, isOffline: !!store.isOffline, zone: store.zone, location: store.location },
    lines: pricedLines,
    subtotal,
    deliveryFee,
    packagingFee,
    taxes,
    discounts,
    totalDiscount,
    finalPrice,
    coupon: coupon ? { code: coupon.code, type: coupon.type, discount: sumOf(['coupon']) } : null,
    // Split used for the Order columns
    batchDiscount: sumOf(['batch']),
    perkDiscount: sumOf(['perk_delivery', 'perk_order']),
    couponDiscount: sumOf(['coupon'])
  };
};

const PAYMENT_ALIASES = {
  cod: 'COD', cash: 'COD', 'cash on delivery': 'COD', 'cash_on_delivery': 'COD',
  wallet: 'Wallet', 'zenvy wallet': 'Wallet', zenvywallet: 'Wallet'
};
const normalizePaymentMethod = (pm) => {
  if (pm === undefined || pm === null || pm === '') return null;
  return PAYMENT_ALIASES[String(pm).trim().toLowerCase()] || null;
};
const PAYMENT_UNAVAILABLE_MESSAGE = 'Online payments are coming soon — please choose Cash on Delivery or Wallet.';

module.exports = {
  computeOrderQuote,
  PricingError,
  activeCouponWhere,
  normalizePaymentMethod,
  PAYMENT_UNAVAILABLE_MESSAGE,
  money,
  UUID_RE
};
