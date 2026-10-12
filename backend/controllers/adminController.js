const { getRestaurantModel } = require('../models/Restaurant');
const { getMenuItemModel } = require('../models/MenuItem');
const { getUserModel } = require('../models/User');
const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
const { getOrderModel } = require('../models/Order');
const { getVaultItemModel } = require('../models/VaultItem');
const { getGlobalConfigModel } = require('../models/GlobalConfig');
const { getVerificationLogModel } = require('../models/VerificationLog');
const { Op } = require('sequelize');

const { getStoreOpenState } = require('../utils/storeHours');
const { STORE_VENDOR_TYPES, isLocalVendorStore } = require('../utils/vendorTypes');

// Public restaurant listing cache: short TTL + cleared on every admin/vendor menu or status change.
let cachedRestaurantsResponse = null;
let cachedRestaurantsAt = 0;
const RESTAURANTS_CACHE_TTL_MS = 60 * 1000;
const clearRestaurantsCache = () => {
  cachedRestaurantsResponse = null;
  cachedRestaurantsAt = 0;
};
exports.clearRestaurantsCache = clearRestaurantsCache;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const realtime = require('../utils/realtime');
const { stripStoreSecrets, stripItemSecrets } = require('../utils/publicFields');
const { clearCachedUser } = require('../middleware/authMiddleware');
const { sendServerError } = require('../utils/httpErrors');

// Model rows in admin responses: never send password hashes to the browser.
const withoutPassword = (row) => {
  const json = row && typeof row.toJSON === 'function' ? row.toJSON() : { ...(row || {}) };
  delete json.password;
  return json;
};

// `systemUpdate` used to go to EVERY socket with full rows (rider rows with password hashes, wallet
// balances, coupons). Catalogue/config types still reach everyone (the customer home listens for them)
// but with IDs only; everything else goes to the admin room only, with secrets stripped.
const PUBLIC_SYSTEM_UPDATE_TYPES = new Set([
  'RESTAURANT_CREATED', 'RESTAURANT_UPDATED', 'RESTAURANT_DELETED', 'MENU_UPDATED', 'MENU_ITEM_DELETED',
  'GLOBAL_CONFIG_UPDATED', 'DATABASE_SEEDED', 'VAULT_UPDATED', 'VAULT_DELETED'
]);
const SECRET_KEYS = ['password', 'otp', 'otpHash', 'token', 'fcmToken', 'pushToken', 'resetToken', 'deliveryPin', 'pin'];
const stripSecrets = (data) => {
  if (!data || typeof data !== 'object') return data;
  const plain = typeof data.toJSON === 'function' ? data.toJSON() : { ...data };
  for (const k of SECRET_KEYS) delete plain[k];
  return plain;
};
const broadcastSystemUpdate = (req, type, data) => {
  const io = req.app.get('io');
  if (!io) return;
  if (PUBLIC_SYSTEM_UPDATE_TYPES.has(type)) {
    const d = data || {};
    io.emit('systemUpdate', { type, data: { id: d.id ?? null, restaurantId: d.restaurantId ?? null } });
  } else {
    io.to('admin-room').emit('systemUpdate', { type, data: stripSecrets(data) });
  }
};

exports.getSystemHealth = async (req, res) => {
  try {
    const { getSequelize } = require('../config/db');
    const sequelize = getSequelize();
    const dialect = sequelize.getDialect();
    res.json({
      database: dialect.toUpperCase(),
      persistence: dialect === 'postgres' ? 'PERSISTENT' : 'VOLATILE',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ message: 'Health Check Failed' });
  }
};

const logAuditAction = async (req, targetId, action, details) => {
  try {
    const VerificationLog = getVerificationLogModel();
    await VerificationLog.create({
      adminId: req.user?.id ? req.user.id.toString() : 'admin_default',
      targetId: targetId ? targetId.toString() : 'global',
      action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
    });
  } catch (error) {
    console.error('[AUDIT_LOG_ERROR]', error);
  }
};

// ─── Public Endpoints ─────────────────────────────────────────
exports.getRestaurants = async (req, res) => {
  try {
    // Stores (grocery, pharmacy, add-ons, …) are browsed via /api/catalogue; ?includeStores=true lists them too.
    const includeStores = String(req.query.includeStores || '').toLowerCase() === 'true';
    const fresh = cachedRestaurantsResponse && (Date.now() - cachedRestaurantsAt) < RESTAURANTS_CACHE_TTL_MS;
    if (fresh) {
      const list = includeStores ? cachedRestaurantsResponse : cachedRestaurantsResponse.filter(r => !STORE_VENDOR_TYPES.includes(String(r.vendorType || '').toUpperCase()));
      return res.json(list);
    }

    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    const { Op } = require('sequelize');

    // Batch-fetch all restaurants and their menu items in 2 queries (eliminates N+1)
    const restaurants = await Restaurant.findAll({ where: { isActive: true } });
    const restaurantIds = restaurants.map(r => r.id);

    const allMenuItems = restaurantIds.length > 0
      ? await MenuItem.findAll({ where: { restaurantId: { [Op.in]: restaurantIds } } })
      : [];

    // Index menu items by restaurantId for O(1) lookup
    const fallbackImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
    const cleanImageUrl = (url) => {
      if (!url || typeof url !== 'string') return fallbackImage;
      if (url.startsWith('data:image/') || url.length > 1000) return fallbackImage;
      return url;
    };

    const menuByRestaurant = {};
    for (const m of allMenuItems) {
      const mObj = stripItemSecrets(m.toJSON());
      let mTags = mObj.tags || [];
      if (typeof mTags === 'string') {
        try { mTags = JSON.parse(mTags); } catch { mTags = []; }
      }
      const cleanedImg = cleanImageUrl(mObj.imageUrl || mObj.image);
      const item = { ...mObj, tags: mTags, _id: m.id, id: m.id, image: cleanedImg, imageUrl: cleanedImg };
      if (!menuByRestaurant[m.restaurantId]) menuByRestaurant[m.restaurantId] = [];
      menuByRestaurant[m.restaurantId].push(item);
    }

    const result = restaurants.map(r => {
      const rObj = r.toJSON();
      stripStoreSecrets(rObj);
      const openState = getStoreOpenState(r);
      let tags = rObj.tags || [];
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch { tags = []; }
      }
      const cleanedImg = cleanImageUrl(rObj.imageUrl || rObj.image);
      return {
        ...rObj,
        _id: r.id,
        id: r.id,
        imageUrl: cleanedImg,
        image: cleanedImg,
        tags,
        categories: tags,
        // Real delivery time only when the restaurant has set one (no invented ETA)
        time: rObj.deliveryTime ? `${rObj.deliveryTime} min` : null,
        rating: rObj.rating > 0 ? rObj.rating : null,
        isOpen: openState.isOpen,
        opensAt: openState.opensAt || null,
        closedReason: openState.isOpen ? null : (openState.message || null),
        menu: menuByRestaurant[r.id] || []
      };
    });

    cachedRestaurantsResponse = result;
    cachedRestaurantsAt = Date.now();
    res.json(includeStores ? result : result.filter(r => !STORE_VENDOR_TYPES.includes(String(r.vendorType || '').toUpperCase())));
  } catch (error) {
    console.error('[RESTAURANTS_ERROR]', error);
    res.status(500).json({ message: 'Could not load restaurants right now. Pull down to refresh.' });
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(404).json({ message: 'Restaurant not found' });
    const restaurant = await Restaurant.findByPk(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    const menu = await MenuItem.findAll({ where: { restaurantId: restaurant.id } });
    const resObj = restaurant.toJSON();
    stripStoreSecrets(resObj);
    let tags = resObj.tags || [];
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch { tags = []; }
    }

    const openState = getStoreOpenState(restaurant);
    res.json({ 
      ...resObj, 
      _id: restaurant.id, 
      id: restaurant.id,
      tags,
      categories: tags,
      time: resObj.deliveryTime ? `${resObj.deliveryTime} min` : null,
      rating: resObj.rating > 0 ? resObj.rating : null,
      isOpen: openState.isOpen,
      opensAt: openState.opensAt || null,
      closedReason: openState.isOpen ? null : (openState.message || null),
      menu: menu.map(m => {
        const mObj = stripItemSecrets(m.toJSON());
        let mTags = mObj.tags || [];
        if (typeof mTags === 'string') {
          try { mTags = JSON.parse(mTags); } catch { mTags = []; }
        }
        return { ...mObj, tags: mTags, _id: m.id, id: m.id, image: mObj.imageUrl || mObj.image };
      })
    });
  } catch (error) {
    console.error('[GET_RESTAURANT_BY_ID_ERROR]', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMenuItemById = async (req, res) => {
  try {
    const MenuItem = getMenuItemModel();
    const Restaurant = getRestaurantModel();
    const VaultItem = getVaultItemModel();
    const id = String(req.params.id || '').trim();
    if (!UUID_RE.test(id)) return res.status(404).json({ message: 'This product is not available any more.', code: 'PRODUCT_NOT_FOUND' });

    const item = await MenuItem.findByPk(id);
    if (!item) {
      // Daily-deal (vault) items are claimed through POST /api/vault/claim/:id, never added to a basket.
      const vault = await VaultItem.findByPk(id);
      if (!vault) return res.status(404).json({ message: 'This product is not available any more.', code: 'PRODUCT_NOT_FOUND' });
      const v = vault.toJSON();
      return res.json({
        ...v,
        _id: vault.id,
        id: vault.id,
        image: v.imageUrl || v.image,
        isVaultItem: true,
        orderable: false,
        restaurantName: 'Zenvy Daily Deals',
        restaurantId: null
      });
    }

    const restaurant = await Restaurant.findByPk(item.restaurantId);
    const itemObj = stripItemSecrets(item.toJSON());
    let tags = itemObj.tags || [];
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch { tags = []; }
    }
    const specs = itemObj.specs && typeof itemObj.specs === 'object' ? itemObj.specs : {};
    const now = new Date();
    const inStock = !!itemObj.isAvailable || !!(itemObj.outOfStockUntil && new Date(itemObj.outOfStockUntil) <= now);
    const openState = restaurant ? getStoreOpenState(restaurant) : { isOpen: false };
    res.json({
      ...itemObj,
      _id: item.id,
      id: item.id,
      tags,
      image: itemObj.imageUrl || itemObj.image,
      originalPrice: specs.originalPrice || null,
      weight: specs.weight || null,
      rating: specs.rating || null,
      ratingCount: specs.ratingCount || 0,
      isAvailable: inStock,
      bookingOnly: !!specs.bookingOnly,
      // CampusBites stalls are display-only: customers order from the vendor by call / WhatsApp.
      orderable: inStock && !specs.bookingOnly && !!restaurant && !isLocalVendorStore(restaurant) && restaurant.isActive !== false && openState.isOpen,
      directOrderOnly: isLocalVendorStore(restaurant),
      restaurantName: restaurant ? restaurant.name : null,
      restaurantId: restaurant ? restaurant.id : null,
      vendorType: restaurant ? restaurant.vendorType : null,
      storeIsOpen: openState.isOpen,
      storeClosedReason: openState.isOpen ? null : (openState.message || null)
    });
  } catch (error) {
    console.error('[GET_PRODUCT_ERROR]', error);
    res.status(500).json({ message: 'Could not load this product right now. Please try again.' });
  }
};

exports.searchAll = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ restaurants: [], items: [] });
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();

    const { getSequelize } = require('../config/db');
    const sequelize = getSequelize();
    const isPostgres = sequelize && typeof sequelize.getDialect === 'function' && sequelize.getDialect() === 'postgres';
    const matchOp = isPostgres ? Op.iLike : Op.like;

    const matchedRestaurants = await Restaurant.findAll({
      where: {
        name: { [matchOp]: `%${q}%` },
        isActive: true
      }
    });

    const matchedItems = await MenuItem.findAll({
      where: {
        [Op.or]: [
          { name: { [matchOp]: `%${q}%` } },
          { category: { [matchOp]: `%${q}%` } }
        ],
        isAvailable: true
      }
    });

    res.json({
      restaurants: matchedRestaurants.map(r => ({ ...r.toJSON(), _id: r.id })),
      items: matchedItems.map(m => ({ ...m.toJSON(), _id: m.id }))
    });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

// ─── Restaurant & Menu Control ────────────────────────────────
// Stores (restaurants, non-food stores, CampusBites stalls) are Restaurant rows; their products are MenuItem rows.
// Admin writes go through explicit field lists: rating / clickCount are never set by hand (they come from
// real reviews and taps), and the portal password hash is never sent back or broadcast.

class AdminInputError extends Error {}

const RESTAURANT_FIELDS = [
  'name', 'location', 'imageUrl', 'vendorType', 'deliveryTime', 'commissionRate', 'commissionType',
  'tags', 'operatingHours', 'isActive', 'isOffline', 'isOpenNow', 'zone', 'lat', 'lon',
  'isFeatured', 'featuredUntil', 'featuredBadge', 'promoOffer', 'campus', 'whatsappNumber',
  'subscriptionTier', 'stallDescription', 'brandTheme'
];
const MENU_ITEM_FIELDS = [
  'name', 'price', 'description', 'imageUrl', 'category', 'tags', 'isVegetarian', 'isAvailable',
  'outOfStockUntil', 'isEliteOnly', 'customCommission', 'specs', 'ownerName', 'ownerPhone'
];
const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const cleanTags = (tags) => (Array.isArray(tags) ? tags : String(tags || '').split(','))
  .map((t) => String(t).trim()).filter(Boolean).slice(0, 30);

const publicRestaurant = (r) => {
  const json = r && typeof r.toJSON === 'function' ? r.toJSON() : { ...(r || {}) };
  delete json.password;
  return { ...json, _id: json.id };
};

const pickRestaurantFields = (body = {}, { creating = false } = {}) => {
  const out = {};
  for (const key of RESTAURANT_FIELDS) if (body[key] !== undefined) out[key] = body[key];

  if (creating || out.name !== undefined) {
    out.name = String(out.name || '').trim();
    if (!out.name) throw new AdminInputError('Store name is required.');
    if (out.name.length > 120) throw new AdminInputError('Store name must be 120 characters or fewer.');
  }
  if (creating || out.location !== undefined) out.location = String(out.location || '').trim() || 'Main Campus';
  if (out.vendorType !== undefined) {
    out.vendorType = String(out.vendorType || '').trim().toUpperCase().replace(/[^A-Z_]/g, '');
    if (!out.vendorType) throw new AdminInputError('Pick a store type.');
  }
  if (out.deliveryTime !== undefined) {
    if (out.deliveryTime === null || out.deliveryTime === '') out.deliveryTime = null;
    else {
      const n = Number(out.deliveryTime);
      if (!Number.isInteger(n) || n < 5 || n > 240) throw new AdminInputError('Delivery time must be a whole number of minutes between 5 and 240.');
      out.deliveryTime = n;
    }
  }
  if (out.commissionType !== undefined && !['percentage', 'flat'].includes(out.commissionType)) {
    throw new AdminInputError("Commission type must be 'percentage' or 'flat'.");
  }
  if (out.commissionRate !== undefined) {
    const n = Number(out.commissionRate);
    const max = (out.commissionType || body.commissionType) === 'flat' ? 1000 : 100;
    if (!Number.isFinite(n) || n < 0 || n > max) throw new AdminInputError(`Commission must be between 0 and ${max}.`);
    out.commissionRate = n;
  }
  if (out.operatingHours !== undefined) {
    const h = out.operatingHours || {};
    const s = HHMM_RE.exec(String(h.start || '').trim());
    const e = HHMM_RE.exec(String(h.end || '').trim());
    if (!s || !e) throw new AdminInputError('Operating hours must be 24-hour times like 09:00 and 22:00.');
    out.operatingHours = { start: `${s[1].padStart(2, '0')}:${s[2]}`, end: `${e[1].padStart(2, '0')}:${e[2]}` };
  }
  if (out.whatsappNumber !== undefined) {
    const digits = String(out.whatsappNumber || '').replace(/\D/g, '');
    const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    if (!ten) out.whatsappNumber = null;
    else if (!/^[6-9]\d{9}$/.test(ten)) throw new AdminInputError('WhatsApp number must be a 10-digit Indian mobile number.');
    else out.whatsappNumber = `91${ten}`; // same format as wa.me links and the existing rows
  }
  if (out.tags !== undefined) out.tags = cleanTags(out.tags);
  for (const key of ['isActive', 'isOffline', 'isOpenNow', 'isFeatured']) if (out[key] !== undefined) out[key] = toBool(out[key]);
  if (out.featuredUntil === '') out.featuredUntil = null;
  for (const key of ['lat', 'lon']) {
    if (out[key] === undefined) continue;
    if (out[key] === null || out[key] === '') { out[key] = null; continue; }
    const n = Number(out[key]);
    if (!Number.isFinite(n)) throw new AdminInputError('Latitude and longitude must be numbers.');
    out[key] = n;
  }
  return out;
};

const readItemSpecs = (specs) => {
  if (typeof specs === 'string') { try { specs = JSON.parse(specs); } catch { specs = {}; } }
  return specs && typeof specs === 'object' && !Array.isArray(specs) ? specs : {};
};

// specs are merged into the stored ones (bookingOnly, weight, brand, extraFor... are kept); a key sent as null is removed.
const pickMenuItemFields = (body = {}, existing = null) => {
  const out = {};
  for (const key of MENU_ITEM_FIELDS) if (body[key] !== undefined) out[key] = body[key];
  if (out.imageUrl === undefined && body.image !== undefined) out.imageUrl = body.image;

  if (!existing || out.name !== undefined) {
    out.name = String(out.name || '').trim();
    if (!out.name) throw new AdminInputError('Product name is required.');
    if (out.name.length > 200) throw new AdminInputError('Product name must be 200 characters or fewer.');
  }
  if (!existing || out.price !== undefined) {
    const price = Number(out.price);
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new AdminInputError('Price must be between ₹0 and ₹1,00,000.');
    out.price = Math.round(price * 100) / 100;
  }
  if (out.imageUrl !== undefined) out.imageUrl = String(out.imageUrl || '').trim() || null;
  if (out.category !== undefined) out.category = String(out.category || '').trim() || null;
  if (out.tags !== undefined) out.tags = cleanTags(out.tags);
  for (const key of ['isVegetarian', 'isAvailable', 'isEliteOnly']) if (out[key] !== undefined) out[key] = toBool(out[key]);
  if (out.outOfStockUntil === '') out.outOfStockUntil = null;
  if (out.isAvailable === true) out.outOfStockUntil = null;

  if (out.specs !== undefined) {
    const incoming = readItemSpecs(out.specs);
    const merged = { ...readItemSpecs(existing && existing.specs) };
    for (const [key, value] of Object.entries(incoming)) {
      if (value === null || value === '') delete merged[key];
      else merged[key] = value;
    }
    if (merged.originalPrice !== undefined) {
      const mrp = Number(merged.originalPrice);
      const price = out.price !== undefined ? out.price : Number(existing && existing.price);
      if (!Number.isFinite(mrp) || mrp <= 0 || mrp > 100000) throw new AdminInputError('MRP must be a positive amount.');
      if (Number.isFinite(price) && mrp < price) throw new AdminInputError('MRP cannot be lower than the selling price.');
      merged.originalPrice = Math.round(mrp * 100) / 100;
    }
    out.specs = merged;
  }
  return out;
};

const sendAdminError = (res, error, fallback) => {
  if (error instanceof AdminInputError) return res.status(400).json({ message: error.message });
  if (error && error.name === 'SequelizeValidationError') return res.status(400).json({ message: error.errors?.[0]?.message || fallback });
  console.error('[ADMIN_CATALOGUE_ERROR]', error);
  return res.status(500).json({ message: fallback });
};

exports.getAllRestaurants = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    const { fn, col } = require('sequelize');
    const [restaurants, counts] = await Promise.all([
      Restaurant.findAll({ attributes: { exclude: ['password'] }, order: [['name', 'ASC']] }),
      MenuItem.findAll({ attributes: ['restaurantId', [fn('COUNT', col('id')), 'count']], group: ['restaurantId'], raw: true })
    ]);
    const countBy = new Map(counts.map((c) => [c.restaurantId, Number(c.count) || 0]));
    res.json(restaurants.map((r) => {
      const open = getStoreOpenState(r);
      return {
        ...publicRestaurant(r),
        itemCount: countBy.get(r.id) || 0,
        isOpen: !!open.isOpen,
        opensAt: open.opensAt || null,
        closedReason: open.isOpen ? null : (open.message || null)
      };
    }));
  } catch (error) {
    sendAdminError(res, error, 'Could not load stores.');
  }
};

exports.getAllMenuItems = async (req, res) => {
  try {
    const MenuItem = getMenuItemModel();
    const where = {};
    if (req.query.restaurantId) {
      if (!UUID_RE.test(String(req.query.restaurantId))) return res.status(404).json({ message: 'Store not found.' });
      where.restaurantId = req.query.restaurantId;
    }
    const items = await MenuItem.findAll({ where, order: [['category', 'ASC'], ['name', 'ASC']] });
    res.json(items.map(i => ({ ...i.toJSON(), _id: i.id })));
  } catch (error) {
    sendAdminError(res, error, 'Could not load products.');
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const data = pickRestaurantFields(req.body, { creating: true });
    if (req.body.password && typeof req.body.password === 'string' && req.body.password.trim().length >= 6) {
      data.password = req.body.password.trim(); // hashed by the model hook
    }
    const restaurant = await Restaurant.create(data);
    clearRestaurantsCache();
    broadcastSystemUpdate(req, 'RESTAURANT_CREATED', publicRestaurant(restaurant));
    realtime.publish('store', 'created', restaurant.id, { storeId: restaurant.id });
    await logAuditAction(req, restaurant.id, 'CREATE_RESTAURANT', { name: restaurant.name });
    res.status(201).json(publicRestaurant(restaurant));
  } catch (error) {
    sendAdminError(res, error, 'Could not create the store.');
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ message: 'Store not found.' });
    const Restaurant = getRestaurantModel();
    const restaurant = await Restaurant.findByPk(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Store not found.' });

    const updateData = pickRestaurantFields(req.body);
    if (req.body.password && typeof req.body.password === 'string' && req.body.password.trim().length >= 6) {
      updateData.password = req.body.password.trim(); // hashed by the model hook
    }
    await restaurant.update(updateData);
    clearRestaurantsCache();
    broadcastSystemUpdate(req, 'RESTAURANT_UPDATED', publicRestaurant(restaurant));
    realtime.publish('store', 'updated', restaurant.id, { storeId: restaurant.id });
    await logAuditAction(req, restaurant.id, 'UPDATE_RESTAURANT', { name: restaurant.name, fields: Object.keys(updateData).filter(k => k !== 'password') });
    res.json(publicRestaurant(restaurant));
  } catch (error) {
    sendAdminError(res, error, 'Could not update the store.');
  }
};

exports.upsertMenuItem = async (req, res) => {
  try {
    const MenuItem = getMenuItemModel();
    const Restaurant = getRestaurantModel();
    const { id } = req.params;
    let menuItem;
    if (id && id !== 'new') {
      if (!UUID_RE.test(String(id))) return res.status(404).json({ message: 'Product not found.' });
      menuItem = await MenuItem.findByPk(id);
      if (!menuItem) return res.status(404).json({ message: 'Product not found.' });
      await menuItem.update(pickMenuItemFields(req.body, menuItem));
    } else {
      const restaurantId = String(req.body.restaurantId || '');
      if (!UUID_RE.test(restaurantId) || !(await Restaurant.findByPk(restaurantId, { attributes: ['id'] }))) {
        return res.status(400).json({ message: 'Pick the store this product belongs to.' });
      }
      menuItem = await MenuItem.create({ ...pickMenuItemFields(req.body), restaurantId });
    }
    clearRestaurantsCache();
    realtime.publish('product', id && id !== 'new' ? 'updated' : 'created', menuItem.id, { storeId: menuItem.restaurantId });
    broadcastSystemUpdate(req, 'MENU_UPDATED', { id: menuItem.id, restaurantId: menuItem.restaurantId });
    const io = req.app.get('io');
    if (io) {
      io.emit('inventory_updated', { itemId: menuItem.id, restaurantId: menuItem.restaurantId, isAvailable: menuItem.isAvailable });
    }
    await logAuditAction(req, menuItem.id, 'UPSERT_MENU_ITEM', { name: menuItem.name, price: menuItem.price });
    res.json({ ...menuItem.toJSON(), _id: menuItem.id });
  } catch (error) {
    sendAdminError(res, error, 'Could not save the product.');
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ message: 'Product not found.' });
    const MenuItem = getMenuItemModel();
    const item = await MenuItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Product not found.' });
    await item.destroy();
    clearRestaurantsCache();
    broadcastSystemUpdate(req, 'MENU_ITEM_DELETED', { id: req.params.id, restaurantId: item.restaurantId });
    realtime.publish('product', 'deleted', req.params.id, { storeId: item.restaurantId });
    await logAuditAction(req, req.params.id, 'DELETE_MENU_ITEM', { id: req.params.id, name: item.name });
    res.json({ message: 'Product deleted.' });
  } catch (error) {
    sendAdminError(res, error, 'Could not delete the product.');
  }
};


// ─── Fleet Management ──────────────────────────────────────────
exports.getAllRiders = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: riders } = await DeliveryPartner.findAndCountAll({ 
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      riders: riders.map(r => ({ ...r.toJSON(), _id: r.id })),
      total: count,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.approveRider = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const rider = await DeliveryPartner.findByPk(req.params.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    await rider.update({ isApproved: req.body.isApproved });
    broadcastSystemUpdate(req, 'RIDER_STATUS_CHANGED', { id: req.params.id, isApproved: req.body.isApproved });
    realtime.notifyAdmin('rider', 'updated', rider.id);
    // Live dispatch room: an unapproved rider stops receiving delivery_request at once.
    realtime.setRiderOnline(rider.id, !!(rider.isApproved && rider.isOnline));
    clearCachedUser(rider.id);
    res.json({ ...withoutPassword(rider), _id: rider.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.resetRiderSos = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const rider = await DeliveryPartner.findByPk(req.params.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    await rider.update({ isSosActive: false });
    broadcastSystemUpdate(req, 'RIDER_SOS_RESET', { id: req.params.id });
    await logAuditAction(req, rider.id, 'FLEET_SOS_RESET', { name: rider.name });
    res.json({ message: 'SOS reset successful' });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.updateRider = async (req, res) => {
  try {
    const DeliveryPartner = getDeliveryPartnerModel();
    const rider = await DeliveryPartner.findByPk(req.params.id);
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    
    // Prevent mass assignment of sensitive/calculated metrics
    const allowedFields = [
      'name', 'phone', 'vehicleType', 'vehicleNumber', 'photoUrl', 'bio',
      'emergencyContact', 'isOnline', 'isAvailable', 'isApproved'
    ];
    const updateData = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    if (req.body.password && typeof req.body.password === 'string' && req.body.password.trim().length >= 6) {
      // Plain text: the DeliveryPartner beforeUpdate hook hashes it (hashing here too stored
      // bcrypt(bcrypt(pw)) and locked the rider out).
      updateData.password = req.body.password.trim();
    }
    await rider.update(updateData);
    broadcastSystemUpdate(req, 'RIDER_UPDATED', rider);
    realtime.notifyAdmin('rider', 'updated', rider.id);
    const riderData = rider.toJSON();
    delete riderData.password;
    res.json({ ...riderData, _id: rider.id });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

// ─── User & Elite Tiering ──────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const User = getUserModel();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    // Optional ?search= matches name, phone or email.
    const search = String(req.query.search || '').trim().slice(0, 64);
    let where;
    if (search) {
      const { getSequelize } = require('../config/db');
      const sequelize = getSequelize();
      const isPostgres = sequelize && typeof sequelize.getDialect === 'function' && sequelize.getDialect() === 'postgres';
      const matchOp = isPostgres ? Op.iLike : Op.like;
      const pattern = `%${search.replace(/[%_\\]/g, '')}%`; // wildcards stripped from user input
      where = {
        [Op.or]: [
          { name: { [matchOp]: pattern } },
          { phone: { [matchOp]: pattern } },
          { email: { [matchOp]: pattern } },
        ],
      };
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      users: users.map(u => ({ ...u.toJSON(), _id: u.id })),
      total: count,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.setEliteStatus = async (req, res) => {
  try {
    const User = getUserModel();
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.update({ isElite: req.body.isElite });
    broadcastSystemUpdate(req, 'USER_ELITE_STATUS', { userId: req.params.userId, isElite: req.body.isElite });
    realtime.notifyAdmin('user', 'updated', user.id);
    await logAuditAction(req, user.id, 'ELITE_STATUS_CHANGE', { email: user.email, isElite: req.body.isElite });
    clearCachedUser(user.id);
    res.json({ ...withoutPassword(user), _id: user.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateUserWallet = async (req, res) => {
  try {
    const User = getUserModel();
    const { amount } = req.body;
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
 
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ message: 'Invalid amount value' });
    }
    // Atomic, conditional adjustment: an order debit, tip or refund landing at the same moment is
    // never overwritten (the old read-modify-write could wipe it out).
    const [changed] = await User.update(
      { walletBalance: User.sequelize.literal(`COALESCE("walletBalance", 0) + ${delta}`) },
      { where: { id: user.id, ...(delta < 0 ? { walletBalance: { [Op.gte]: -delta } } : {}) } }
    );
    if (changed === 0) {
      return res.status(400).json({ message: 'Wallet balance cannot be negative' });
    }
    await user.reload({ attributes: ['id', 'walletBalance', 'email'] });
    const newBalance = Number(user.walletBalance) || 0;
    
    await logAuditAction(req, user.id, 'WALLET_UPDATE', { email: user.email, added: amount, newBalance });
    broadcastSystemUpdate(req, 'USER_UPDATED', { userId: user.id, walletBalance: newBalance });
    realtime.notifyAdmin('user', 'updated', user.id);
    
    res.json({ message: 'Wallet updated', walletBalance: newBalance });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const VerificationLog = getVerificationLogModel();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const { count, rows: logs } = await VerificationLog.findAndCountAll({
      order: [['timestamp', 'DESC']],
      limit,
      offset
    });

    res.json({
      logs: logs.map(l => ({ ...l.toJSON(), _id: l.id })),
      total: count,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.updateGlobalConfig = async (req, res) => {
  try {
    const GlobalConfig = getGlobalConfigModel();
    const { key, value, description } = req.body;
    const [_config, created] = await GlobalConfig.upsert({ key, value, description });
    broadcastSystemUpdate(req, 'GLOBAL_CONFIG_UPDATED', { key, value });
    realtime.publish('config', 'updated', key, { scope: 'global' });
    res.json({ key, value, description, created });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getGlobalConfig = async (req, res) => {
  try {
    const GlobalConfig = getGlobalConfigModel();
    const configs = await GlobalConfig.findAll();
    res.json(configs.map(c => ({ ...c.toJSON(), _id: c.id })));
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

// ─── Dashboard Stats ──────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const Order = getOrderModel();
    const DeliveryPartner = getDeliveryPartnerModel();
    const Restaurant = getRestaurantModel();
    
    // Optimized single-pass aggregation
    const [totalOrders, activeFleet, localVendorCount] = await Promise.all([
      Order.count(),
      DeliveryPartner.count({ where: { isApproved: true } }),
      Restaurant.count({ where: { vendorType: 'LOCAL_VENDOR', isActive: true } })
    ]);

    const deliveredStats = await Order.findAll({
      where: { status: 'Delivered' },
      attributes: [[require('sequelize').fn('SUM', require('sequelize').col('totalPrice')), 'revenue']]
    });

    const activeOrdersList = await Order.findAll({
      where: { status: { [Op.notIn]: ['Delivered', 'Cancelled'] } },
      attributes: ['totalPrice']
    });

    const totalRevenue = Number(deliveredStats[0]?.dataValues.revenue || 0);
    const activeRevenue = activeOrdersList.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const activeOrdersCount = activeOrdersList.length;

    res.json({
      revenue: `₹${totalRevenue.toLocaleString()}`,
      activeRevenue: `₹${activeRevenue.toLocaleString()}`,
      orderActivity: totalOrders.toString(),
      activeFleet: activeFleet.toString(),
      commission: `₹${Math.round(totalRevenue * 0.1).toLocaleString()}`,
      activeOrders: activeOrdersCount.toString(),
      localVendorCount: localVendorCount.toString()
    });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.getFinanceReport = async (req, res) => {
  try {
    const Order = getOrderModel();
    const Restaurant = getRestaurantModel();
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total stats (non-paginated)
    const allDelivered = await Order.findAll({ 
      where: { status: 'Delivered' },
      attributes: ['totalPrice', 'finalPrice', 'restaurantId', 'deliveryFee']
    });

    const restaurants = await Restaurant.findAll();
    const restaurantMap = restaurants.reduce((acc, r) => ({ ...acc, [r.id]: r }), {});

    // Commission uses each store's own rate/type; orders without a known store earn none.
    const orderAmount = (o) => Number(o.finalPrice ?? o.totalPrice) || 0;
    const commissionFor = (o) => {
      const rest = restaurantMap[o.restaurantId];
      if (!rest) return 0;
      const rate = Number(rest.commissionRate) || 0;
      return rest.commissionType === 'flat' ? rate : orderAmount(o) * (rate / 100);
    };

    const totalRevenue = allDelivered.reduce((s, o) => s + orderAmount(o), 0);
    const totalDeliveryFees = allDelivered.reduce((s, o) => s + (Number(o.deliveryFee) || 0), 0);
    const totalCommission = allDelivered.reduce((s, o) => s + commissionFor(o), 0);

    // Get paginated transactions
    const { count, rows: orders } = await Order.findAndCountAll({
      where: { status: 'Delivered' },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const transactions = orders.map(order => {
      const restaurant = restaurantMap[order.restaurantId];
      return {
        _id: order.id,
        orderId: order.id.slice(-6),
        restaurantName: restaurant ? restaurant.name : 'Unknown store',
        totalAmount: orderAmount(order),
        commissionEarned: Math.round(commissionFor(order)),
        deliveryFee: Number(order.deliveryFee) || 0,
        timestamp: order.createdAt
      };
    });

    res.json({
      transactions,
      totalRevenue: Math.round(totalRevenue),
      totalCommission: Math.round(totalCommission),
      totalDeliveryFees: Math.round(totalDeliveryFees),
      total: count,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

// ─── Seed Database ─────────────────────────────────────────────
exports.seedDatabase = async (req, res) => {
  try {
    clearRestaurantsCache();
    let { restaurants } = req.body;
    
    if (!restaurants || !Array.isArray(restaurants) || restaurants.length === 0) {
      // No built-in sample restaurants: only real partner data sent by the admin is imported.
      return res.status(400).json({ message: 'Send the restaurants to import as { restaurants: [...] }.' });
    }

    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();

    console.log(`[SEED] Processing ${restaurants.length} nodes...`);

    for (const restData of restaurants) {
      // Use UPSERT by name to avoid foreign key violations with Orders
      // PostgreSQL requires a unique constraint for true upsert, 
      // but we'll do 1: Find/Delete-Item or 2: Generic Create
      
      let restaurant = await Restaurant.findOne({ where: { name: restData.name } });
      
      if (!restaurant) {
        restaurant = await Restaurant.create({
          name: restData.name,
          location: restData.location || 'Main Campus',
          imageUrl: restData.imageUrl || restData.image,
          vendorType: restData.vendorType || 'RESTAURANT',
          commissionRate: restData.commissionRate || 10,
          commissionType: restData.commissionType || 'percentage',
          operatingHours: restData.operatingHours || { start: '09:00', end: '22:00' },
          isActive: restData.isActive !== undefined ? restData.isActive : true,
          tags: restData.categories || restData.tags || [],
          brandTheme: restData.brandTheme || null,
          subscriptionTier: restData.subscriptionTier || 'free',
          rating: Number(restData.rating) > 0 ? Number(restData.rating) : 0 // no invented ratings: 0 shows as "New"
        });
      } else {
        // Update existing to refresh images/tags
        await restaurant.update({
          imageUrl: restData.imageUrl || restData.image,
          vendorType: restData.vendorType || 'RESTAURANT',
          tags: restData.categories || restData.tags || [],
          brandTheme: restData.brandTheme || null
        });
      }

      if (restData.menu && Array.isArray(restData.menu)) {
        // Clear items only for THIS restaurant to preserve DB integrity
        await MenuItem.destroy({ where: { restaurantId: restaurant.id } });

        const vendorTagMap = {
          'PHARMACY': ['pharmacy', 'medicine'],
          'STATIONARY': ['stationary', 'books'],
          'LAUNDRY': ['laundry', 'dry-wash'],
          'GYM': ['gym', 'high-protein', 'healthy'],
          'DRINKS': ['drinks'],
          'SEASONAL': ['seasonal'],
          'RENTAL': ['rental'],
          'GROCERY': ['fruits', 'healthy'],
          'SWEETS': ['sweets'],
          'RESTAURANT': [],
          'GLOBAL_MARKET': []
        };
        const vendorTags = vendorTagMap[restData.vendorType] || [];

        for (const item of restData.menu) {
          const itemTags = [...new Set([
            ...vendorTags,
            ...(item.tags || []),
            ...(item.category ? [item.category.toLowerCase()] : [])
          ])];
          await MenuItem.create({
            restaurantId: restaurant.id,
            name: item.name,
            price: item.price,
            description: item.description,
            imageUrl: item.image || item.imageUrl,
            category: item.category,
            tags: itemTags,
            isAvailable: true,
            isEliteOnly: false
          });
        }
      }
    }

    broadcastSystemUpdate(req, 'DATABASE_SEEDED', { count: restaurants.length });
    realtime.publish('store', 'updated', null); // id null = refetch the whole catalogue
    realtime.publish('product', 'updated', null);
    res.json({ message: `Successfully synchronized ${restaurants.length} restaurants.` });
  } catch (error) {
    console.error('[SEED_ERROR]', error);
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

// ─── Zenvy Vault Control (Stubs for PostgreSQL) ─────────────────
exports.getVaultItems = async (req, res) => {
  try {
    const VaultItem = getVaultItemModel();
    const items = await VaultItem.findAll({ order: [['createdAt', 'DESC']] });
    res.json(items.map(i => ({ ...i.toJSON(), _id: i.id })));
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

const pickVaultFields = (body = {}, existing = null) => {
  const out = {};
  for (const key of ['name', 'price', 'originalPrice', 'remainingCount', 'imageUrl', 'isActive', 'streakRequirement']) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  if (!existing || out.name !== undefined) {
    out.name = String(out.name || '').trim();
    if (!out.name) throw new AdminInputError('Deal name is required.');
  }
  for (const key of ['price', 'originalPrice']) {
    if (existing && out[key] === undefined) continue;
    const n = Number(out[key]);
    if (!Number.isFinite(n) || n < 0 || n > 100000) throw new AdminInputError('Prices must be between ₹0 and ₹1,00,000.');
    out[key] = Math.round(n * 100) / 100;
  }
  const price = out.price !== undefined ? out.price : Number(existing && existing.price);
  const mrp = out.originalPrice !== undefined ? out.originalPrice : Number(existing && existing.originalPrice);
  if (Number.isFinite(price) && Number.isFinite(mrp) && mrp < price) throw new AdminInputError('The original price cannot be lower than the deal price.');
  for (const key of ['remainingCount', 'streakRequirement']) {
    if (out[key] === undefined) continue;
    const n = Number(out[key]);
    if (!Number.isInteger(n) || n < 0 || n > 100000) throw new AdminInputError(key === 'remainingCount' ? 'Stock must be a whole number (0 or more).' : 'Streak requirement must be a whole number (0 or more).');
    out[key] = n;
  }
  if (out.imageUrl !== undefined) out.imageUrl = String(out.imageUrl || '').trim() || null;
  if (out.isActive !== undefined) out.isActive = toBool(out.isActive);
  return out;
};

exports.upsertVaultItem = async (req, res) => {
  try {
    const VaultItem = getVaultItemModel();
    const { id } = req.params;
    let item;
    if (id && id !== 'new') {
      if (!UUID_RE.test(String(id))) return res.status(404).json({ message: 'Deal not found.' });
      item = await VaultItem.findByPk(id);
      if (!item) return res.status(404).json({ message: 'Deal not found.' });
      await item.update(pickVaultFields(req.body, item));
    } else {
      item = await VaultItem.create(pickVaultFields(req.body));
    }
    broadcastSystemUpdate(req, 'VAULT_UPDATED', item);
    realtime.publish('coupon', id && id !== 'new' ? 'updated' : 'created', item.id, { scope: 'vault' });
    await logAuditAction(req, item.id, 'UPSERT_VAULT_ITEM', { name: item.name, price: item.price, remainingCount: item.remainingCount });
    res.json({ ...item.toJSON(), _id: item.id });
  } catch (error) {
    sendAdminError(res, error, 'Could not save the deal.');
  }
};

exports.deleteVaultItem = async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ message: 'Deal not found.' });
    const VaultItem = getVaultItemModel();
    const removed = await VaultItem.destroy({ where: { id: req.params.id } });
    if (!removed) return res.status(404).json({ message: 'Deal not found.' });
    broadcastSystemUpdate(req, 'VAULT_DELETED', { id: req.params.id });
    realtime.publish('coupon', 'deleted', req.params.id, { scope: 'vault' });
    await logAuditAction(req, req.params.id, 'DELETE_VAULT_ITEM', { id: req.params.id });
    res.json({ message: 'Deal deleted.' });
  } catch (error) {
    sendAdminError(res, error, 'Could not delete the deal.');
  }
};

// ─── Gamification & Rewards Analytics ──────────────────────────

exports.getRewardsAnalytics = async (req, res) => {
  try {
    const User = getUserModel();
    const users = await User.findAll({ 
      where: { role: 'student' },
      attributes: ['completedOrders', 'spinsUsed', 'badges', 'name', 'zenPoints']
    });

    let totalSpinsEarned = 0;
    let totalSpinsUsed = 0;
    let totalZenPoints = 0;
    const badgeCounts = {};
    const tiers = { Elite: 0, Diamond: 0, Platinum: 0, Gold: 0, Silver: 0, Bronze: 0, None: 0 };
    
    const topPerformers = users
      .map(u => {
        const uJson = u.toJSON();
        const earned = Math.floor((uJson.completedOrders || 0) / 2);
        totalSpinsEarned += earned;
        totalSpinsUsed += (uJson.spinsUsed || 0);
        totalZenPoints += (uJson.zenPoints || 0);
        
        let badges = [];
        if (Array.isArray(uJson.badges)) {
          badges = uJson.badges;
        } else if (typeof uJson.badges === 'string') {
          try {
            badges = JSON.parse(uJson.badges);
          } catch {
            badges = [];
          }
        }
        badges.forEach(b => {
          badgeCounts[b] = (badgeCounts[b] || 0) + 1;
        });

        // Tier classification based on highest badge held
        let userTier = 'None';
        if (badges.some(b => b.includes('Elite'))) userTier = 'Elite';
        else if (badges.some(b => b.includes('Diamond'))) userTier = 'Diamond';
        else if (badges.some(b => b.includes('Platinum'))) userTier = 'Platinum';
        else if (badges.some(b => b.includes('Gold'))) userTier = 'Gold';
        else if (badges.some(b => b.includes('Silver'))) userTier = 'Silver';
        else if (badges.some(b => b.includes('Bronze'))) userTier = 'Bronze';
        
        tiers[userTier]++;

        return {
          name: uJson.name,
          completedOrders: uJson.completedOrders,
          badgesCount: badges.length,
          zenPoints: uJson.zenPoints || 0,
          tier: userTier
        };
      })
      .sort((a, b) => b.completedOrders - a.completedOrders)
      .slice(0, 5);

    res.json({
      totalSpinsEarned,
      totalSpinsUsed,
      totalZenPoints,
      activeRewardUsers: users.filter(u => u.completedOrders > 0).length,
      badgeDistribution: badgeCounts,
      tierDistribution: tiers,
      topPerformers,
      redemptionRate: totalSpinsEarned > 0 ? (totalSpinsUsed / totalSpinsEarned * 100).toFixed(1) : 0
    });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const Restaurant = getRestaurantModel();
    const MenuItem = getMenuItemModel();
    const id = req.params.id;
    if (!UUID_RE.test(String(id))) return res.status(404).json({ message: 'Store not found.' });

    const restaurant = await Restaurant.findByPk(id);
    if (!restaurant) return res.status(404).json({ message: 'Store not found.' });
    
    // Check for non-terminal active orders before deletion
    const { getOrderModel } = require('../models/Order');
    const Order = getOrderModel();
    if (Order) {
      const activeOrdersCount = await Order.count({
        where: {
          restaurantId: id,
          status: { [Op.notIn]: ['Delivered', 'Cancelled'] }
        }
      });
      if (activeOrdersCount > 0) {
        return res.status(400).json({ 
          message: `This store has ${activeOrdersCount} active order(s). Finish or cancel them before deleting it.` 
        });
      }
      // Deleting sets restaurantId to NULL on its orders, so money still owed to the store would
      // drop out of Payouts. Settle first (or switch the store off instead of deleting it).
      const unsettledCount = await Order.count({ where: { restaurantId: id, status: 'Delivered', payoutSettled: false } });
      if (unsettledCount > 0) {
        return res.status(400).json({
          message: `This store has ${unsettledCount} delivered order(s) that are not settled yet. Settle its payout first, or switch the store off instead of deleting it.`
        });
      }
    }

    // Cleanup items
    await MenuItem.destroy({ where: { restaurantId: id } });
    await restaurant.destroy();
    clearRestaurantsCache();
    
    broadcastSystemUpdate(req, 'RESTAURANT_DELETED', { id });
    realtime.publish('store', 'deleted', id, { storeId: id });
    logAuditAction(req, id, 'RESTAURANT_DELETE', `Deleted restaurant "${restaurant.name}"`);
    
    res.json({ message: 'Store deleted.' });
  } catch (error) {
    sendAdminError(res, error, 'Could not delete the store.');
  }
};

exports.getOrderVolumeStats = async (req, res) => {
  try {
    const Order = getOrderModel();
    const { getSequelize } = require('../config/db');
    const sequelize = getSequelize();
    const dialect = sequelize.getDialect();
    
    let stats;
    if (dialect === 'postgres') {
      stats = await Order.findAll({
        attributes: [
          [sequelize.fn('date_trunc', 'hour', sequelize.col('createdAt')), 'hour'],
          [sequelize.fn('count', sequelize.col('id')), 'count']
        ],
        where: {
          createdAt: { [Op.gte]: new Date(Date.now() - 12 * 60 * 60 * 1000) }
        },
        group: [sequelize.fn('date_trunc', 'hour', sequelize.col('createdAt'))],
        order: [[sequelize.fn('date_trunc', 'hour', sequelize.col('createdAt')), 'ASC']]
      });
    } else {
      stats = await Order.findAll({
        attributes: [
          [sequelize.fn('strftime', '%Y-%m-%d %H:00:00', sequelize.col('createdAt')), 'hour'],
          [sequelize.fn('count', sequelize.col('id')), 'count']
        ],
        where: {
          createdAt: { [Op.gte]: new Date(Date.now() - 12 * 60 * 60 * 1000) }
        },
        group: [sequelize.fn('strftime', '%Y-%m-%d %H:00:00', sequelize.col('createdAt'))],
        order: [[sequelize.fn('strftime', '%Y-%m-%d %H:00:00', sequelize.col('createdAt')), 'ASC']]
      });
    }
 
    // Buckets are UTC hours. `timestamp` is ISO so clients can format in their own zone;
    // `hour` is kept for older clients and is formatted in IST (the campus time zone).
    const toDate = (value) => {
      if (value instanceof Date) return value;
      const text = String(value);
      return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text.replace(' ', 'T')}Z`);
    };
    res.json(stats.map(s => {
      const date = toDate(s.dataValues.hour);
      const valid = !Number.isNaN(date.getTime());
      return {
        timestamp: valid ? date.toISOString() : null,
        hour: valid ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : '',
        count: parseInt(s.dataValues.count, 10) || 0
      };
    }));
  } catch (error) {
    console.error('[VOLUME_STATS_ERROR]', error);
    res.status(500).json({ message: 'Failed to aggregate volume telemetry' });
  }
};

exports.batchUpdateOrders = async (req, res) => {
  try {
    const Order = getOrderModel();
    const { targetStatus, newStatus } = req.body;
    
    if (!targetStatus || !newStatus) return res.status(400).json({ message: 'Missing parameters' });

    // Only transitions that go through the real per-order side effects are allowed in bulk:
    //  • Pending → Accepted: conditional flip (never resurrects a cancelled order), acceptedAt,
    //    customer/store status events, live rider pool and rider push.
    //  • pre-pickup → Cancelled: cancelAndRefund (Wallet refund + coupon restore, exactly once).
    // A raw bulk UPDATE skipped all of that (Wallet money kept, riders never told, no deliveredAt).
    const CANCELLABLE_FROM = ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup'];
    const isAccept = targetStatus === 'Pending' && newStatus === 'Accepted';
    const isCancel = newStatus === 'Cancelled' && CANCELLABLE_FROM.includes(targetStatus);
    if (!isAccept && !isCancel) {
      return res.status(400).json({ message: 'Bulk update supports only Pending → Accepted, or cancelling orders that have not been picked up. Update other orders one by one.' });
    }

    const io = req.app.get('io');
    const emitStatus = (order, payload) => {
      if (!io) return;
      io.to(String(order.id)).emit('statusUpdated', payload);
      io.to('admin-room').emit('statusUpdated', payload);
      if (order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('statusUpdated', payload);
    };
    const matched = await Order.findAll({ where: { status: targetStatus }, order: [['createdAt', 'ASC']], limit: 200 });
    let updatedCount = 0;
    for (const order of matched) {
      try {
        if (isAccept) {
          const now = new Date();
          const [n] = await Order.update({ status: 'Accepted', acceptedAt: now }, { where: { id: order.id, status: 'Pending' } });
          if (n === 0) continue;
          updatedCount++;
          emitStatus(order, { id: order.id, status: 'Accepted' });
          realtime.notifyAdmin('order', 'updated', order.id);
          if (!order.deliveryPartnerId) {
            realtime.deliveryRequest(order.id);
            const restaurant = await getRestaurantModel().findByPk(order.restaurantId, { attributes: ['id', 'name', 'location'] });
            await require('../utils/riderDispatch').pushNearestRiders({
              restaurant,
              orderId: order.id,
              limit: 5,
              title: '🛵 New Order Ready!',
              body: `${restaurant?.name || 'A store'} has an order waiting for a rider.`,
            });
          }
        } else {
          const { cancelAndRefund } = require('./orderController');
          const { cancelled, refunded } = await cancelAndRefund(order, { reason: 'Cancelled by Zenvy support', onlyFromStatuses: [targetStatus] });
          if (!cancelled) continue;
          updatedCount++;
          emitStatus(order, { id: order.id, status: 'Cancelled', refundedToWallet: refunded });
          if (io) io.to(String(order.id)).emit('orderCancelled', { orderId: order.id, reason: 'ADMIN' });
          realtime.notifyAdmin('order', 'updated', order.id);
          if (order.deliveryPartnerId) {
            await getDeliveryPartnerModel().update({ currentOrderId: null }, { where: { id: order.deliveryPartnerId, currentOrderId: order.id } });
          }
        }
      } catch (e) {
        console.error('[BATCH_ORDER_UPDATE_ERROR]', order.id, e.message);
      }
    }

    broadcastSystemUpdate(req, 'BATCH_ORDER_UPDATE', { targetStatus, newStatus, count: updatedCount });
    await logAuditAction(req, 'global', 'BATCH_ORDER_UPDATE', `Updated ${updatedCount} orders from ${targetStatus} to ${newStatus}`);

    res.json({ message: `Successfully updated ${updatedCount} orders.`, count: updatedCount });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.getAllCoupons = async (req, res) => {
  try {
    const { getCouponModel } = require('../models/Coupon');
    const Coupon = getCouponModel();
    const User = getUserModel();
    const coupons = await Coupon.findAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(coupons.map(c => ({ ...c.toJSON(), _id: c.id })));
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const { getCouponModel } = require('../models/Coupon');
    const Coupon = getCouponModel();
    const { code, type, value, userId, expiryDate } = req.body;
    
    if (!code || !userId) {
      return res.status(400).json({ message: 'Code and User ID are required' });
    }

    const User = getUserModel();
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if code is unique
    const existing = await Coupon.findOne({ where: { code } });
    if (existing) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code,
      type: type || 'FREEDEL',
      value: value || 0,
      userId,
      isUsed: false,
      expiryDate: expiryDate ? new Date(expiryDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await logAuditAction(req, coupon.id, 'CREATE_COUPON', { code: coupon.code, userId });
    broadcastSystemUpdate(req, 'COUPON_CREATED', coupon);
    realtime.publish('coupon', 'created', coupon.id, { scope: 'coupon' });

    res.status(201).json({ ...coupon.toJSON(), _id: coupon.id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { getCouponModel } = require('../models/Coupon');
    const Coupon = getCouponModel();
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    
    await coupon.destroy();
    await logAuditAction(req, req.params.id, 'DELETE_COUPON', { code: coupon.code });
    broadcastSystemUpdate(req, 'COUPON_DELETED', { id: req.params.id });
    realtime.publish('coupon', 'deleted', req.params.id, { scope: 'coupon' });
    
    res.json({ message: 'Coupon successfully removed/revoked' });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

// ─── Finance & Operations (Payouts & Refunds) ────────────────
exports.getRestaurantPayouts = async (req, res) => {
  try {
    const Order = getOrderModel();
    const Restaurant = getRestaurantModel();
    
    // Group only Delivered, unsettled orders to calculate real earnings
    const deliveredOrders = await Order.findAll({ 
      where: { status: 'Delivered', payoutSettled: false }
    });
    const restaurants = await Restaurant.findAll();
    const restMap = restaurants.reduce((acc, r) => ({ ...acc, [r.id]: r }), {});

    const payouts = {};
    deliveredOrders.forEach(o => {
      const rest = restMap[o.restaurantId];
      if (!rest) return;
      // Store GMV is the item subtotal: finalPrice also contains the rider's delivery fee (and
      // platform coupon discounts), which is not the store's money.
      const price = Number(o.totalPrice) || 0;
      // Same rule as getFinanceReport: the store's own rate (0% stays 0%) and 'flat' = ₹ per order.
      const commissionRate = Number(rest.commissionRate) || 0;
      const commission = rest.commissionType === 'flat' ? Math.min(commissionRate, price) : price * (commissionRate / 100);
      
      if (!payouts[rest.id]) {
        payouts[rest.id] = {
          restaurantId: rest.id,
          restaurantName: rest.name,
          vendorType: rest.vendorType,
          totalOrders: 0,
          totalGMV: 0,
          totalCommission: 0,
          netPayout: 0
        };
      }
      payouts[rest.id].totalOrders += 1;
      payouts[rest.id].totalGMV += price;
      payouts[rest.id].totalCommission += commission;
      payouts[rest.id].netPayout += (price - commission);
    });

    res.json(Object.values(payouts).map(p => ({
      ...p,
      totalGMV: Math.round(p.totalGMV),
      totalCommission: Math.round(p.totalCommission),
      netPayout: Math.round(p.netPayout)
    })));
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.settleRestaurantPayout = async (req, res) => {
  try {
    const Order = getOrderModel();
    const { restaurantId } = req.body;
    if (!restaurantId) return res.status(400).json({ message: 'restaurantId is required' });

    // Mark all delivered, unpaid orders for this restaurant as settled
    const [updatedCount] = await Order.update(
      { payoutSettled: true },
      { where: { restaurantId, status: 'Delivered', payoutSettled: false } }
    );

    await logAuditAction(req, restaurantId, 'RESTAURANT_PAYOUT_SETTLED', { restaurantId, updatedOrdersCount: updatedCount });

    res.json({ message: 'Restaurant payout marked as settled successfully', updatedOrdersCount: updatedCount });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.getDisputedOrders = async (req, res) => {
  try {
    const Order = getOrderModel();
    const User = require('../models/User').getUserModel();
    
    const disputes = await Order.findAll({
      where: { status: 'Cancelled' },
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['name', 'phone'] }]
    });
    res.json(disputes.map(d => ({ ...d.toJSON(), _id: d.id, userId: d.user || { name: 'Student', phone: '' } })));
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.processManualRefund = async (req, res) => {
  try {
    const Order = getOrderModel();
    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Cancelled') return res.status(400).json({ message: 'Can only refund Cancelled orders.' });
    if (order.paymentMethod === 'COD') return res.status(400).json({ message: 'COD orders do not require refunds.' });
    if (order.paymentMethod === 'Wallet') return res.status(400).json({ message: 'Wallet orders are refunded to the Wallet automatically when they are cancelled.' });
    const VerificationLog = getVerificationLogModel();
    const already = VerificationLog ? await VerificationLog.findOne({ where: { targetId: String(order.id), action: 'MANUAL_REFUND_PROCESSED' } }) : null;
    if (already) return res.status(400).json({ message: 'This order has already been refunded.' });

    const user = await User.findByPk(order.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const refundAmount = order.finalPrice || order.totalPrice;
    
    // Perform manual wallet refund (atomic increment)
    await User.increment('walletBalance', { by: refundAmount, where: { id: user.id } });
    await user.reload();
    
    await logAuditAction(req, order.id, 'MANUAL_REFUND_PROCESSED', { amount: refundAmount, userId: user.id });
    
    res.json({ message: 'Refund successful', refundAmount, walletBalance: user.walletBalance });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

// ─── God-Tier Administrative Endpoints ───────────────────────

exports.toggleUserBan = async (req, res) => {
  try {
    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isActive = req.body.isActive !== undefined ? req.body.isActive : !user.isActive;
    await user.save();
    
    const action = user.isActive ? 'USER_UNBANNED' : 'USER_BANNED';
    await logAuditAction(req, user.id, action, { userId: user.id });
    realtime.notifyAdmin('user', 'updated', user.id);
    // Apply the ban at once: drop the 60 s auth cache entry and close the user's live sockets.
    clearCachedUser(user.id);
    if (!user.isActive) {
      try { req.app.get('io')?.in(`user_${user.id}`).disconnectSockets(true); } catch { /* best effort */ }
    }

    res.json({ message: `User account ${user.isActive ? 'reactivated' : 'suspended'}`, user: withoutPassword(user) });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.broadcastPushNotification = async (req, res) => {
  try {
    const { title, body, targetBlock, category } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'Title and body required' });
    
    const { getUserModel } = require('../models/User');
    const User = getUserModel();
    let whereClause = { isActive: true };
    const isTargeted = !!(targetBlock && targetBlock !== 'All Campus Blocks');
    if (isTargeted) {
      whereClause.hostelBlock = targetBlock;
    }
    const activeUsers = await User.findAll({ where: whereClause, attributes: ['id', 'fcmTokens'] });
    
    let allTokens = [];
    activeUsers.forEach(user => {
      if (user.fcmTokens) {
        let tokenList = user.fcmTokens;
        if (typeof tokenList === 'string') {
          try {
            tokenList = JSON.parse(tokenList);
          } catch {
            tokenList = [tokenList];
          }
        }
        if (Array.isArray(tokenList)) {
          tokenList.forEach(t => {
            const tokenStr = typeof t === 'string' ? t : t?.token;
            if (tokenStr) allTokens.push(tokenStr);
          });
        }
      }
    });

    // Remove duplicates
    allTokens = [...new Set(allTokens.filter(Boolean))];

    if (activeUsers.length > 0) {
      const { sendPushToTokens } = require('../utils/push');
      // Saved in every targeted user's notification list, then pushed to their devices.
      await sendPushToTokens(allTokens, title, body, { type: 'global_broadcast', targetBlock: targetBlock || 'all', category: category || 'announcement' },
        { recipients: activeUsers.map((u) => u.id) });
    }
    
    // Campus-wide only: also reach devices subscribed to the 'all' topic. A block-targeted
    // broadcast must not go to the whole campus.
    if (!isTargeted) {
      const { sendPushToTopic } = require('../utils/push');
      await sendPushToTopic('all', title, body, { type: 'global_broadcast', targetBlock: 'all', category: category || 'announcement' });
    }

    // Broadcast via Socket.io so active users get live toast & save to notification history
    try {
      const io = req.app.get('io');
      if (io) {
        const announcement = {
          title,
          body,
          message: `${title}: ${body}`,
          targetBlock: targetBlock || 'All Campus Blocks',
          category: category || 'announcement',
          type: 'info'
        };
        if (isTargeted) {
          // Only the targeted block's students (each signed-in user socket is in user_<id>).
          const rooms = activeUsers.map((u) => `user_${u.id}`);
          if (rooms.length > 0) io.to(rooms).emit('global_announcement', announcement);
        } else {
          io.emit('global_announcement', announcement);
        }
      }
    } catch (sockErr) {
      console.error('Failed to emit admin broadcast socket announcement:', sockErr);
    }

    await logAuditAction(req, null, 'GLOBAL_PUSH_SENT', { title, body, userCount: activeUsers.length });
    realtime.publish('announcement', 'created', null, { scope: 'broadcast' });
    
    res.json({ message: `Push notification broadcasted successfully to approximately ${activeUsers.length} active devices.` });
  } catch (error) {
    console.error('Broadcast push failed:', error);
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.getRecentReviews = async (req, res) => {
  try {
    const Order = getOrderModel();
    const User = require('../models/User').getUserModel();
    const Restaurant = getRestaurantModel();
    const { Op } = require('sequelize');

    const reviews = await Order.findAll({
      where: {
        review: { [Op.not]: null }
      },
      attributes: { exclude: ['deliveryPin'] },
      order: [['createdAt', 'DESC']],
      limit: 50,
      include: [
        { model: User, as: 'user', attributes: ['name', 'phone'] },
      ]
    });
    
    // Quick and dirty manual join for restaurant name since associations might be missing
    const restaurants = await Restaurant.findAll();
    const restMap = restaurants.reduce((acc, r) => ({ ...acc, [r.id]: r.name }), {});

    const mapped = reviews.map(r => {
      const data = r.toJSON();
      data.restaurantName = restMap[r.restaurantId] || 'Unknown store';
      return data;
    });

    res.json(mapped);
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const Order = getOrderModel();
    const order = await Order.findByPk(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Review not found' });
    
    order.review = null;
    order.rating = null;
    await order.save();
    
    await logAuditAction(req, order.id, 'REVIEW_DELETED', { orderId: order.id });
    if (order.restaurantId) realtime.publish('store', 'updated', order.restaurantId, { storeId: order.restaurantId, scope: 'reviews' });
    res.json({ message: 'Review successfully removed from the ecosystem.' });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.getRiderPayouts = async (req, res) => {
  try {
    const Order = getOrderModel();
    const DeliveryPartner = getDeliveryPartnerModel();
    
    // Group only Delivered, unsettled rider orders
    const deliveredOrders = await Order.findAll({ 
      where: { status: 'Delivered', riderPayoutSettled: false }
    });

    const riders = await DeliveryPartner.findAll();
    const riderMap = riders.reduce((acc, r) => ({ ...acc, [r.id]: r }), {});

    const payouts = {};
    deliveredOrders.forEach(o => {
      if (!o.deliveryPartnerId) return;
      const fee = o.deliveryFee || 0;
      const rid = o.deliveryPartnerId;
      const rider = riderMap[rid];
      
      if (!payouts[rid]) {
        payouts[rid] = {
          riderId: rid,
          riderName: rider ? rider.name : 'Unknown Rider',
          riderPhone: rider ? rider.phone : '',
          totalDeliveries: 0,
          totalDeliveryFees: 0,
        };
      }
      payouts[rid].totalDeliveries += 1;
      payouts[rid].totalDeliveryFees += fee;
    });

    // Customer tips are credited to DeliveryPartner.walletBalance (rateOrder) and were invisible
    // here. Show the unpaid tip balance too, including riders with tips but no unsettled orders.
    riders.forEach((r) => {
      const tips = Number(r.walletBalance) || 0;
      if (tips <= 0) return;
      if (!payouts[r.id]) {
        payouts[r.id] = { riderId: r.id, riderName: r.name, riderPhone: r.phone || '', totalDeliveries: 0, totalDeliveryFees: 0 };
      }
      payouts[r.id].unsettledTips = tips;
    });

    res.json(Object.values(payouts).map(p => ({
      ...p,
      totalDeliveryFees: Math.round(p.totalDeliveryFees),
      unsettledTips: Math.round(p.unsettledTips || 0),
      totalPayout: Math.round(p.totalDeliveryFees + (p.unsettledTips || 0))
    })));
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};

exports.settleRiderPayout = async (req, res) => {
  try {
    const Order = getOrderModel();
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ message: 'riderId is required' });

    // Mark all delivered, unpaid orders for this rider as settled
    const [updatedCount] = await Order.update(
      { riderPayoutSettled: true },
      { where: { deliveryPartnerId: riderId, status: 'Delivered', riderPayoutSettled: false } }
    );
    // Tips are cleared only when the admin says they were paid too (body.includeTips === true),
    // and only by the amount they saw, atomically, so a tip arriving now is not wiped.
    let tipsSettled = 0;
    const tipsSeen = Number(req.body.tipsAmount);
    if (req.body.includeTips === true && Number.isFinite(tipsSeen) && tipsSeen > 0) {
      const DeliveryPartner = getDeliveryPartnerModel();
      const [n] = await DeliveryPartner.update(
        { walletBalance: DeliveryPartner.sequelize.literal(`"walletBalance" - ${tipsSeen}`) },
        { where: { id: riderId, walletBalance: { [Op.gte]: tipsSeen } } }
      );
      if (n > 0) tipsSettled = tipsSeen;
    }

    await logAuditAction(req, riderId, 'RIDER_PAYOUT_SETTLED', { riderId, updatedOrdersCount: updatedCount, tipsSettled });

    res.json({ message: 'Rider payout marked as settled successfully', updatedOrdersCount: updatedCount, tipsSettled });
  } catch (error) {
    sendServerError(res, error, '[ADMINCONTROLLER_ERROR]');
  }
};


