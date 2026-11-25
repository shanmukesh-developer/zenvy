// Admin > Grocery store (owner, 26 Nov 2026): ZenWe's own house grocery store, managed Blinkit-style
// (utils/houseGrocery). Every route is admin-only (mounted after protect + admin in routes/adminRoutes) and every
// change is audited (VerificationLog) and clears the app's catalogue caches.
//
//   GET    /api/admin/house-grocery                     { store, categories: [{ id, name, imageUrl, order, itemCount }], productCount }
//   POST   /api/admin/house-grocery/setup               creates the house store when missing
//   POST   /api/admin/house-grocery/categories          { name, imageUrl? }
//   PUT    /api/admin/house-grocery/categories/order    { ids: [categoryId...] } (every category, new order)
//   PUT    /api/admin/house-grocery/categories/:id      { name?, imageUrl? } (a rename moves its products along)
//   DELETE /api/admin/house-grocery/categories/:id      only while no product is in it
//   GET    /api/admin/house-grocery/products?q=&category=
//   POST   /api/admin/house-grocery/products            { name, imageUrl?, price, originalPrice?, packSize?, dietType?, isAvailable?, description?, category }
//   PUT    /api/admin/house-grocery/products/:id        same fields, each optional
//   DELETE /api/admin/house-grocery/products/:id
//   POST   /api/admin/house-grocery/products/stock      { ids: [...], isAvailable: boolean } (bulk in stock / sold out)
//
// Pack size ("1 kg", "500 ml") is the product's specs.weight, the field the catalogue already sends as `weight` and
// the app's product cards already show; specs.autoWeights is false (a sealed pack, never the automatic
// 250 g / 500 g / 1 kg choices of utils/productOptions). MRP is MenuItem.originalPrice (+ specs.originalPrice).
const { Op } = require('sequelize');
const hg = require('../utils/houseGrocery');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIETS = ['veg', 'nonveg', 'egg'];

class InputError extends Error {
  constructor(message, status = 400, code = 'INVALID_INPUT') { super(message); this.status = status; this.code = code; }
}

const models = () => require('../config/db').getSequelize().models;
const admin = () => require('./adminController');

const fail = (res, err, fallback) => {
  if (err instanceof InputError) return res.status(err.status).json({ code: err.code, message: err.message });
  console.error('[HOUSE_GROCERY_ERROR]', err);
  return res.status(500).json({ message: fallback });
};

const changed = (req, kind, action, id, storeId) => {
  try { admin().clearRestaurantsCache(); } catch { /* caches expire in 30 s */ }
  try { require('../utils/realtime').publish(kind, action, id, storeId ? { storeId } : {}); } catch { /* best effort */ }
  const io = req.app && req.app.get('io');
  if (io && kind === 'product') { try { io.emit('systemUpdate', { type: 'MENU_UPDATED', data: { id, restaurantId: storeId || null } }); } catch { /* best effort */ } }
};
const audit = (req, targetId, action, details) => admin().logAuditAction(req, targetId, action, details);

const requireStore = async () => {
  const store = await hg.findHouseStore();
  if (!store) throw new InputError('ZenWe Grocery is not set up yet. Use "Set up ZenWe Grocery" first.', 409, 'HOUSE_STORE_MISSING');
  return store;
};

// ── Validation ────────────────────────────────────────────────────────────────
const text = (v, max, label, { required = false } = {}) => {
  if (v === undefined || v === null) {
    if (required) throw new InputError(`${label} is required.`);
    return null;
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw new InputError(`${label} must be text.`);
  const t = String(v).trim().replace(/\s+/g, ' ');
  if (!t && required) throw new InputError(`${label} is required.`);
  if (t.length > max) throw new InputError(`${label} must be ${max} characters or fewer.`);
  return t || null;
};
const money = (v, label, { required = false } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new InputError(`${label} is required.`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) throw new InputError(`${label} must be between ₹0.01 and ₹1,00,000.`);
  return Math.round(n * 100) / 100;
};
const bool = (v, label) => {
  if (v === true || v === 'true' || v === 1) return true;
  if (v === false || v === 'false' || v === 0) return false;
  throw new InputError(`${label} must be true or false.`);
};
/** Photo: an uploaded media link or a hosted https image (inline base64 is moved to the media store). */
const image = async (v, req, keep = null) => {
  if (v === undefined) return undefined;
  if (v === null || String(v).trim() === '') return null;
  if (typeof v !== 'string' || v.length > 2_000_000) throw new InputError('Photo must be an uploaded image.');
  const { storeImageRef } = require('../utils/imageStore');
  const r = await storeImageRef(v.trim(), { req, ownerId: req.user && req.user.id, purpose: 'menu', keep });
  if (!r.ok) throw new InputError(`Photo: ${r.message}`);
  return r.value;
};

const readSpecs = (raw) => {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = {}; } }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
};

// ── Views ─────────────────────────────────────────────────────────────────────
const storeView = (s) => (s ? {
  id: s.id, name: s.name, isActive: s.isActive !== false, location: s.location, operatingHours: s.operatingHours,
  imageUrl: s.imageUrl || null, logoUrl: s.logoUrl || null, deliveryGroup: s.deliveryGroup || 'grocery',
} : null);

const productView = (m) => {
  const specs = readSpecs(m.specs);
  return {
    id: m.id,
    name: m.name,
    imageUrl: m.imageUrl || null,
    price: Number(m.price) || 0,
    originalPrice: m.originalPrice !== null && m.originalPrice !== undefined ? Number(m.originalPrice) : (Number(specs.originalPrice) || null),
    packSize: typeof specs.weight === 'string' || typeof specs.weight === 'number' ? String(specs.weight) : null,
    dietType: DIETS.includes(m.dietType) ? m.dietType : (m.isVegetarian === false ? 'nonveg' : 'veg'),
    isAvailable: m.isAvailable !== false && m.isAvailable !== 0,
    description: m.description || null,
    category: m.category || null,
    updatedAt: m.updatedAt,
  };
};

const countsByCategory = async (storeId) => {
  const { MenuItem } = models();
  const rows = await MenuItem.findAll({
    where: { restaurantId: storeId },
    attributes: ['category', [MenuItem.sequelize.fn('COUNT', MenuItem.sequelize.col('id')), 'n']],
    group: ['category'],
    raw: true,
  });
  return new Map(rows.map((r) => [String(r.category || '').toLowerCase(), Number(r.n) || 0]));
};

// ── Store + categories ────────────────────────────────────────────────────────
exports.getOverview = async (req, res) => {
  try {
    const store = await hg.findHouseStore();
    const cats = await hg.readCategories();
    const counts = store ? await countsByCategory(store.id) : new Map();
    const productCount = [...counts.values()].reduce((a, b) => a + b, 0);
    const known = new Set(cats.map((c) => c.name.toLowerCase()));
    // Products whose category is not in the list (e.g. a category deleted from the database by hand).
    const uncategorised = [...counts.entries()].filter(([k]) => !known.has(k)).reduce((a, [, n]) => a + n, 0);
    res.json({
      store: storeView(store),
      categories: cats.map((c) => ({ ...c, itemCount: counts.get(c.name.toLowerCase()) || 0 })),
      productCount,
      uncategorised,
    });
  } catch (err) { fail(res, err, 'Could not load the Grocery store.'); }
};

exports.setup = async (req, res) => {
  try {
    const { store, created } = await hg.ensureHouseStore();
    if (created) {
      changed(req, 'store', 'created', store.id);
      await audit(req, store.id, 'HOUSE_GROCERY_SETUP', { name: store.name });
    }
    res.status(created ? 201 : 200).json({ store: storeView(store), created });
  } catch (err) { fail(res, err, 'Could not set up the Grocery store.'); }
};

const categoryName = (v) => text(v, 60, 'Category name', { required: true });

exports.addCategory = async (req, res) => {
  try {
    const body = req.body || {};
    const name = categoryName(body.name);
    const list = await hg.readCategories();
    if (list.length >= hg.MAX_CATEGORIES) throw new InputError(`At most ${hg.MAX_CATEGORIES} categories.`);
    if (list.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new InputError(`There is already a category called "${name}".`, 409, 'CONFLICT');
    const imageUrl = (await image(body.imageUrl, req)) || null;
    const cat = { id: require('crypto').randomUUID(), name, imageUrl, order: list.length };
    await hg.writeCategories([...list, cat]);
    changed(req, 'store', 'updated', 'house-categories');
    await audit(req, cat.id, 'HOUSE_GROCERY_CATEGORY_ADD', { name, imageUrl: !!imageUrl });
    res.status(201).json({ category: { ...cat, itemCount: 0 } });
  } catch (err) { fail(res, err, 'Could not add the category.'); }
};

exports.updateCategory = async (req, res) => {
  try {
    const body = req.body || {};
    const list = await hg.readCategories();
    const at = list.findIndex((c) => c.id === String(req.params.id));
    if (at < 0) throw new InputError('Category not found.', 404, 'NOT_FOUND');
    const cat = { ...list[at] };
    const before = cat.name;
    if (body.name !== undefined) {
      const name = categoryName(body.name);
      if (list.some((c, i) => i !== at && c.name.toLowerCase() === name.toLowerCase())) throw new InputError(`There is already a category called "${name}".`, 409, 'CONFLICT');
      cat.name = name;
    }
    if (body.imageUrl !== undefined) cat.imageUrl = (await image(body.imageUrl, req, cat.imageUrl)) || null;
    let moved = 0;
    if (cat.name !== before) {
      const store = await hg.findHouseStore();
      if (store) {
        const { MenuItem } = models();
        const rows = await MenuItem.findAll({ where: { restaurantId: store.id }, attributes: ['id', 'category'] });
        const ids = rows.filter((r) => String(r.category || '').toLowerCase() === before.toLowerCase()).map((r) => r.id);
        if (ids.length) [moved] = await MenuItem.update({ category: cat.name }, { where: { id: { [Op.in]: ids } } });
      }
    }
    list[at] = cat;
    await hg.writeCategories(list);
    changed(req, 'store', 'updated', 'house-categories');
    await audit(req, cat.id, 'HOUSE_GROCERY_CATEGORY_UPDATE', { from: before, name: cat.name, imageChanged: body.imageUrl !== undefined, productsMoved: moved });
    res.json({ category: cat, productsMoved: moved });
  } catch (err) { fail(res, err, 'Could not save the category.'); }
};

exports.reorderCategories = async (req, res) => {
  try {
    const ids = (req.body || {}).ids;
    const list = await hg.readCategories();
    if (!Array.isArray(ids) || ids.length !== list.length || new Set(ids.map(String)).size !== ids.length) {
      throw new InputError('Send ids: every category id once, in the new order.');
    }
    const byId = new Map(list.map((c) => [c.id, c]));
    if (ids.some((id) => !byId.has(String(id)))) throw new InputError('Unknown category in the new order. Reload the page and try again.');
    const saved = await hg.writeCategories(ids.map((id) => byId.get(String(id))));
    changed(req, 'store', 'updated', 'house-categories');
    await audit(req, 'house-categories', 'HOUSE_GROCERY_CATEGORY_REORDER', { order: saved.map((c) => c.name) });
    res.json({ categories: saved });
  } catch (err) { fail(res, err, 'Could not save the order.'); }
};

exports.deleteCategory = async (req, res) => {
  try {
    const list = await hg.readCategories();
    const cat = list.find((c) => c.id === String(req.params.id));
    if (!cat) throw new InputError('Category not found.', 404, 'NOT_FOUND');
    const store = await hg.findHouseStore();
    const n = store ? ((await countsByCategory(store.id)).get(cat.name.toLowerCase()) || 0) : 0;
    if (n > 0) throw new InputError(`"${cat.name}" still has ${n} product${n === 1 ? '' : 's'}. Move or delete them first.`, 409, 'CATEGORY_NOT_EMPTY');
    await hg.writeCategories(list.filter((c) => c.id !== cat.id));
    changed(req, 'store', 'updated', 'house-categories');
    await audit(req, cat.id, 'HOUSE_GROCERY_CATEGORY_DELETE', { name: cat.name });
    res.json({ message: 'Category deleted.' });
  } catch (err) { fail(res, err, 'Could not delete the category.'); }
};

// ── Products ──────────────────────────────────────────────────────────────────
const likeOp = (model) => (model.sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like);

exports.listProducts = async (req, res) => {
  try {
    const store = await hg.findHouseStore();
    if (!store) return res.json({ products: [], total: 0 });
    const { MenuItem } = models();
    const where = { restaurantId: store.id };
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60).replace(/[\\%_]/g, ' ') : '';
    if (q) where.name = { [likeOp(MenuItem)]: `%${q}%` };
    if (typeof req.query.category === 'string' && req.query.category.trim()) where.category = req.query.category.trim();
    const rows = await MenuItem.findAll({ where, order: [['category', 'ASC'], ['name', 'ASC']], limit: 1000 });
    res.json({ products: rows.map(productView), total: rows.length });
  } catch (err) { fail(res, err, 'Could not load the products.'); }
};

/** Validated product fields from the body. `existing` = the row being edited (fields then optional). */
const productFields = async (body, req, existing = null) => {
  const out = {};
  const creating = !existing;
  if (creating || body.name !== undefined) out.name = text(body.name, 120, 'Product name', { required: true });
  if (creating || body.price !== undefined) out.price = money(body.price, 'Price', { required: true });
  if (creating || body.category !== undefined) {
    const name = text(body.category, 60, 'Category', { required: true });
    const cat = (await hg.readCategories()).find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!cat) throw new InputError(`There is no category called "${name}". Add it under Categories first.`);
    out.category = cat.name;
  }
  if (body.description !== undefined) out.description = text(body.description, 500, 'Description');
  if (body.imageUrl !== undefined) out.imageUrl = await image(body.imageUrl, req, existing ? existing.imageUrl : null);
  if (body.dietType !== undefined || creating) {
    const d = body.dietType === undefined || body.dietType === null || body.dietType === '' ? 'veg' : String(body.dietType).toLowerCase();
    if (!DIETS.includes(d)) throw new InputError("Veg / non-veg must be 'veg', 'nonveg' or 'egg'.");
    out.dietType = d;
    out.isVegetarian = d === 'veg';
  }
  if (body.isAvailable !== undefined) {
    out.isAvailable = bool(body.isAvailable, 'In stock');
    if (out.isAvailable) out.outOfStockUntil = null;
  } else if (creating) out.isAvailable = true;

  const specs = { ...readSpecs(existing && existing.specs) };
  specs.autoWeights = false; // a sealed pack: never the automatic 250 g / 500 g / 1 kg choices
  if (body.packSize !== undefined) {
    const p = text(body.packSize, 40, 'Pack size');
    if (p) specs.weight = p; else delete specs.weight;
  }
  if (body.originalPrice !== undefined) {
    const mrp = money(body.originalPrice, 'MRP');
    if (mrp === null) delete specs.originalPrice; else specs.originalPrice = mrp;
    out.originalPrice = mrp;
  }
  const price = out.price !== undefined ? out.price : Number(existing && existing.price);
  const mrpNow = out.originalPrice !== undefined ? out.originalPrice : (existing ? (existing.originalPrice ?? null) : null);
  if (mrpNow !== null && Number.isFinite(price) && mrpNow < price) throw new InputError('MRP cannot be lower than the price.');
  out.specs = specs;
  return out;
};

const findProduct = async (id) => {
  if (!UUID_RE.test(String(id))) throw new InputError('Product not found.', 404, 'NOT_FOUND');
  const store = await requireStore();
  const item = await models().MenuItem.findOne({ where: { id: String(id), restaurantId: store.id } });
  if (!item) throw new InputError('Product not found.', 404, 'NOT_FOUND');
  return { store, item };
};

exports.createProduct = async (req, res) => {
  try {
    const store = await requireStore();
    const fields = await productFields(req.body || {}, req);
    const item = await models().MenuItem.create({ ...fields, restaurantId: store.id, deliveryGroup: null });
    changed(req, 'product', 'created', item.id, store.id);
    await audit(req, item.id, 'HOUSE_GROCERY_PRODUCT_ADD', { name: item.name, price: item.price, category: item.category });
    res.status(201).json({ product: productView(item) });
  } catch (err) { fail(res, err, 'Could not add the product.'); }
};

exports.updateProduct = async (req, res) => {
  try {
    const { store, item } = await findProduct(req.params.id);
    const fields = await productFields(req.body || {}, req, item);
    const before = productView(item);
    await item.update(fields);
    const after = productView(item);
    const diff = Object.fromEntries(Object.keys(after).filter((k) => k !== 'updatedAt' && JSON.stringify(after[k]) !== JSON.stringify(before[k])).map((k) => [k, k === 'imageUrl' ? 'changed' : after[k]]));
    changed(req, 'product', 'updated', item.id, store.id);
    await audit(req, item.id, 'HOUSE_GROCERY_PRODUCT_UPDATE', { name: item.name, changed: diff });
    res.json({ product: after });
  } catch (err) { fail(res, err, 'Could not save the product.'); }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { store, item } = await findProduct(req.params.id);
    const name = item.name;
    await item.destroy();
    changed(req, 'product', 'deleted', String(req.params.id), store.id);
    await audit(req, String(req.params.id), 'HOUSE_GROCERY_PRODUCT_DELETE', { name });
    res.json({ message: 'Product deleted.' });
  } catch (err) { fail(res, err, 'Could not delete the product.'); }
};

exports.setStock = async (req, res) => {
  try {
    const body = req.body || {};
    const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))] : null;
    if (!ids || !ids.length || ids.length > 500 || ids.some((id) => !UUID_RE.test(id))) throw new InputError('Send ids: 1 to 500 product ids.');
    const isAvailable = bool(body.isAvailable, 'In stock');
    const store = await requireStore();
    const { MenuItem } = models();
    const [n] = await MenuItem.update(
      isAvailable ? { isAvailable: true, outOfStockUntil: null } : { isAvailable: false },
      { where: { id: { [Op.in]: ids }, restaurantId: store.id } },
    );
    changed(req, 'product', 'updated', 'house-stock', store.id);
    await audit(req, store.id, 'HOUSE_GROCERY_STOCK', { isAvailable, count: n });
    res.json({ updated: n });
  } catch (err) { fail(res, err, 'Could not change the stock.'); }
};
