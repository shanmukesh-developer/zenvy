// Realtime sync layer: tells connected clients that something changed so they can refetch,
// without anyone pulling to refresh.
//
// • publish(type, action, id, extra?)  → `data:changed` to EVERY socket on the default namespace
//   (customers, guests, riders, stores, admins). Payload is IDs only:
//   { type, action, id, storeId?, scope?, at }. Never put names, prices, phones, wallets etc. here.
// • notifyAdmin(type, action, id, extra?) → `admin:changed` to the 'admin-room' only, same shape.
//
// Bursts are debounced: events are collected for DEBOUNCE_MS and sent once, de-duplicated by
// type/action/id. If a single flush holds more than BULK_THRESHOLD events of one type (bulk import,
// seeding), they collapse into ONE event { type, action: 'updated', id: null, bulk: true, count }.
//
// Rider dispatch (not debounced, ids only):
// • setRiderOnline(riderId, online) → every socket of `rider_<id>` joins / leaves RIDERS_ONLINE_ROOM.
//   Only call with online=true for an authenticated rider whose DeliveryPartner row is isOnline && isApproved.
// • deliveryRequest(orderId)     → `delivery_request { orderId }` to RIDERS_ONLINE_ROOM (order became claimable).
// • deliveryRequestGone(orderId) → `delivery_request_gone { orderId }` (claimed / cancelled / left the pool).
//
// Store/product events also clear the in-memory public restaurant listing cache immediately (not
// debounced) so the refetch a client makes on receipt already sees fresh data.

const ADMIN_ROOM = 'admin-room';
const PUBLIC_EVENT = 'data:changed';
const ADMIN_EVENT = 'admin:changed';
const DEBOUNCE_MS = 400;
const BULK_THRESHOLD = 20;

const PUBLIC_TYPES = new Set(['store', 'product', 'config', 'announcement', 'coupon', 'pg', 'wall', 'campus']);
const ADMIN_TYPES = new Set([...PUBLIC_TYPES, 'order', 'ticket', 'verification', 'pg_booking', 'wall_submission', 'service_booking', 'rider', 'user']);
const ACTIONS = new Set(['created', 'updated', 'deleted']);
const CACHE_TYPES = new Set(['store', 'product']);

let ioRef = null;
const queues = { public: new Map(), admin: new Map() };
const timers = { public: null, admin: null };

const init = (io) => { ioRef = io || null; };

const clearListingCache = () => {
  try { require('../controllers/adminController').clearRestaurantsCache(); } catch (e) { console.error('[REALTIME_CACHE_CLEAR]', e.message); }
};

// Only plain id-like strings / numbers survive; anything else becomes null.
const safeId = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  return s && s.length <= 100 && /^[A-Za-z0-9_.:-]+$/.test(s) ? s : null;
};

const buildEvent = (type, action, id, extra = {}) => {
  const evt = { type, action: ACTIONS.has(action) ? action : 'updated', id: safeId(id) };
  const storeId = safeId(extra.storeId);
  if (storeId !== null) evt.storeId = storeId;
  if (typeof extra.scope === 'string' && /^[a-z0-9_-]{1,40}$/.test(extra.scope)) evt.scope = extra.scope;
  return evt;
};

const flush = (channel) => {
  timers[channel] = null;
  const queue = queues[channel];
  if (!queue.size) return;
  const events = Array.from(queue.values());
  queue.clear();
  if (!ioRef) return;

  const at = new Date().toISOString();
  const byType = new Map();
  for (const e of events) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type).push(e);
  }
  const target = channel === 'admin' ? ioRef.to(ADMIN_ROOM) : ioRef;
  const eventName = channel === 'admin' ? ADMIN_EVENT : PUBLIC_EVENT;
  try {
    for (const [type, list] of byType) {
      if (list.length > BULK_THRESHOLD) {
        const storeIds = new Set(list.map((e) => e.storeId).filter(Boolean));
        const bulk = { type, action: 'updated', id: null, bulk: true, count: list.length, at };
        if (storeIds.size === 1) bulk.storeId = [...storeIds][0];
        target.emit(eventName, bulk);
      } else {
        for (const e of list) target.emit(eventName, { ...e, at });
      }
    }
  } catch (err) {
    console.error('[REALTIME_EMIT_ERROR]', err.message);
  }
};

const enqueue = (channel, evt) => {
  const key = `${evt.type}|${evt.action}|${evt.id}|${evt.storeId || ''}|${evt.scope || ''}`;
  queues[channel].set(key, evt);
  if (!timers[channel]) {
    timers[channel] = setTimeout(() => flush(channel), DEBOUNCE_MS);
    if (typeof timers[channel].unref === 'function') timers[channel].unref();
  }
};

// Public, non-sensitive change → every socket. Never throws.
const publish = (type, action, id, extra = {}) => {
  try {
    if (!PUBLIC_TYPES.has(type)) return;
    if (CACHE_TYPES.has(type)) clearListingCache();
    enqueue('public', buildEvent(type, action, id, extra));
  } catch (err) {
    console.error('[REALTIME_PUBLISH_ERROR]', err.message);
  }
};

// Admin-only change → 'admin-room'. Never throws.
const notifyAdmin = (type, action, id, extra = {}) => {
  try {
    if (!ADMIN_TYPES.has(type)) return;
    enqueue('admin', buildEvent(type, action, id, extra));
  } catch (err) {
    console.error('[REALTIME_ADMIN_ERROR]', err.message);
  }
};

// ── Rider dispatch room ─────────────────────────────────────────────────────
const RIDERS_ONLINE_ROOM = 'riders_online';
const DELIVERY_REQUEST_EVENT = 'delivery_request';
const DELIVERY_REQUEST_GONE_EVENT = 'delivery_request_gone';
// Statuses in which an order with no rider sits in the pool (GET /delivery/orders/pending).
const CLAIMABLE_STATUSES = ['Accepted', 'Preparing', 'ReadyForPickup'];

const setRiderOnline = (riderId, online) => {
  try {
    const id = safeId(riderId);
    if (!ioRef || id === null) return;
    const sockets = ioRef.in(`rider_${id}`);
    if (online) sockets.socketsJoin(RIDERS_ONLINE_ROOM);
    else sockets.socketsLeave(RIDERS_ONLINE_ROOM);
  } catch (err) {
    console.error('[REALTIME_RIDER_ROOM_ERROR]', err.message);
  }
};

const emitToRiders = (event, orderId) => {
  try {
    const id = safeId(orderId);
    if (!ioRef || id === null) return;
    ioRef.to(RIDERS_ONLINE_ROOM).emit(event, { orderId: id });
  } catch (err) {
    console.error('[REALTIME_RIDER_EMIT_ERROR]', err.message);
  }
};
// Stall orders (Order.fulfilment = 'VENDOR') are delivered by the stall itself and must never reach
// riders: the order's fulfilment is checked before the event goes out (defence in depth for every caller).
const deliveryRequest = (orderId) => {
  const id = safeId(orderId);
  if (!ioRef || id === null) return;
  Promise.resolve()
    .then(() => {
      const { getOrderModel } = require('../models/Order');
      const Order = getOrderModel();
      return Order ? Order.findByPk(id, { attributes: ['id', 'fulfilment'] }) : null;
    })
    .then((order) => {
      if (order && order.fulfilment === 'VENDOR') return;
      emitToRiders(DELIVERY_REQUEST_EVENT, id);
    })
    .catch((err) => console.error('[REALTIME_DELIVERY_REQUEST_ERROR]', err.message));
};
const deliveryRequestGone = (orderId) => emitToRiders(DELIVERY_REQUEST_GONE_EVENT, orderId);

module.exports = {
  init, publish, notifyAdmin, PUBLIC_EVENT, ADMIN_EVENT, ADMIN_ROOM,
  setRiderOnline, deliveryRequest, deliveryRequestGone,
  RIDERS_ONLINE_ROOM, DELIVERY_REQUEST_EVENT, DELIVERY_REQUEST_GONE_EVENT, CLAIMABLE_STATUSES,
};
