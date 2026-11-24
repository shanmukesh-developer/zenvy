// Home slideshow admin (owner, 24-25 Nov 2026; admin Config > Home slideshow).
//   GET  /api/admin/home-slideshow                 the picked dishes per diet (+ cut-out worker counts)
//   PUT  /api/admin/home-slideshow                 { nonveg?: [menuItemId...], veg?: [...] } (max 4 each; [] = automatic)
//   GET  /api/admin/home-slideshow/dishes?q=&diet=  dishes with a photo to pick / fix (name or store name)
//   PUT  /api/admin/menu-items/:id/slideshow       { slideshowImage, clearSlideshowImage, roundPhoto, redoCutout }
// Every change is audited and clears the app's caches (store list, GET /api/config/home-slideshow).
const { Op } = require('sequelize');
const realtime = require('../utils/realtime');
const slideshow = require('../utils/homeSlideshow');
const queue = require('../utils/cutoutQueue');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM_ATTRS = ['id', 'restaurantId', 'name', 'price', 'originalPrice', 'imageUrl', 'dietType', 'isVegetarian', 'isAvailable', 'isTestData',
  'cutoutUrl', 'cutoutSourceUrl', 'cutoutStatus', 'cutoutAt', 'slideshowImageUrl', 'slideshowRoundPhoto', 'createdAt'];

const models = () => require('../config/db').getSequelize().models;
const ac = () => require('./adminController');

const dietOf = (m) => {
  const d = String(m.dietType || '').toLowerCase();
  if (d === 'veg' || d === 'nonveg' || d === 'egg') return d;
  return m.isVegetarian === true || m.isVegetarian === 1 ? 'veg' : 'nonveg';
};

/** Admin view of one dish: what the slideshow shows for it and the cut-out's state. */
const dishView = (m, storeName, req = null) => {
  const img = /^data:/i.test(String(m.imageUrl || '')) ? null : (m.imageUrl || null);
  const abs = (u) => queue.absoluteUrl(u, req);
  const slide = queue.slideImageOf({ ...m, imageUrl: img });
  return {
    id: m.id,
    name: m.name,
    restaurantId: m.restaurantId,
    storeName: storeName || null,
    price: Number(m.price) || 0,
    originalPrice: m.originalPrice === null || m.originalPrice === undefined ? null : Number(m.originalPrice),
    diet: dietOf(m),
    isAvailable: m.isAvailable !== false && m.isAvailable !== 0,
    imageUrl: img,
    cutoutUrl: abs(queue.currentCutout({ ...m, imageUrl: img })),
    cutoutStatus: queue.cutoutState({ ...m, imageUrl: img }),
    slideshowImageUrl: m.slideshowImageUrl || null,
    slideshowRoundPhoto: !!m.slideshowRoundPhoto,
    shows: slide.shows,
    showsUrl: abs(slide.url),
  };
};

const storeNames = async (rows) => {
  const ids = [...new Set(rows.map((r) => r.restaurantId).filter(Boolean))];
  if (!ids.length) return new Map();
  const stores = await models().Restaurant.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name'], raw: true });
  return new Map(stores.map((s) => [s.id, s.name]));
};

const viewsFor = async (ids, req) => {
  if (!ids.length) return [];
  const rows = await models().MenuItem.findAll({ where: { id: { [Op.in]: ids } }, attributes: ITEM_ATTRS, raw: true });
  const names = await storeNames(rows);
  const byId = new Map(rows.map((r) => [String(r.id).toLowerCase(), r]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map((r) => dishView(r, names.get(r.restaurantId), req));
};

const payload = async (value, req) => {
  let cutouts = null;
  try {
    cutouts = { enabled: queue.enabled(), ...(await queue.counts()), model: require('../utils/cutout').modelName(), modelFile: require('../utils/cutoutModel').modelStatus() };
  } catch { /* counts are extra */ }
  return {
    ids: value,
    nonveg: await viewsFor(value.nonveg, req),
    veg: await viewsFor(value.veg, req),
    max: slideshow.MAX,
    cutouts,
  };
};

const fail = (res, err, message) => {
  console.error('[HOME_SLIDESHOW_ERROR]', err && err.message);
  res.status(500).json({ message });
};

exports.getHomeSlideshow = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json(await payload(await slideshow.read({ fresh: true }), req));
  } catch (err) { fail(res, err, 'Could not load the slideshow. Please try again.'); }
};

exports.setHomeSlideshow = async (req, res) => {
  try {
    const current = await slideshow.read({ fresh: true });
    const v = await slideshow.validate(req.body, current);
    if (!v.ok) return res.status(400).json({ message: v.message });
    const saved = await slideshow.save(v.value);
    await ac().logAuditAction(req, 'global', 'HOME_SLIDESHOW_SET', { before: current, after: saved });
    // The apps' cached answer (GET /api/config/home-slideshow) is dropped and they refetch.
    realtime.publish('config', 'updated', 'home_slideshow', { scope: 'home_slideshow' });
    res.json(await payload(saved, req));
  } catch (err) { fail(res, err, 'Could not save the slideshow. Please try again.'); }
};

exports.searchDishes = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { MenuItem, Restaurant } = models();
    const sequelize = MenuItem.sequelize;
    const like = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
    const q = String(req.query.q || '').trim().slice(0, 80).replace(/[%_\\]/g, '');
    const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 40));
    const and = [{ imageUrl: { [Op.ne]: null } }, { imageUrl: { [Op.ne]: '' } }];
    if (q) {
      const stores = await Restaurant.findAll({ where: { name: { [like]: `%${q}%` } }, attributes: ['id'], raw: true });
      const or = [{ name: { [like]: `%${q}%` } }];
      if (stores.length) or.push({ restaurantId: { [Op.in]: stores.map((s) => s.id) } });
      and.push({ [Op.or]: or });
    } else {
      // Nothing typed: the dishes on discount (the ones the automatic slideshow chooses from).
      and.push(sequelize.where(sequelize.col('originalPrice'), Op.gt, sequelize.col('price')));
    }
    const diet = String(req.query.diet || '').toLowerCase();
    let rows = await MenuItem.findAll({ where: { [Op.and]: and }, attributes: ITEM_ATTRS, order: [['name', 'ASC']], limit: diet ? 300 : limit, raw: true });
    if (diet === 'veg') rows = rows.filter((r) => dietOf(r) === 'veg');
    else if (diet === 'nonveg') rows = rows.filter((r) => dietOf(r) !== 'veg');
    rows = rows.slice(0, limit);
    const names = await storeNames(rows);
    res.json({ dishes: rows.map((r) => dishView(r, names.get(r.restaurantId), req)) });
  } catch (err) { fail(res, err, 'Could not search the dishes. Please try again.'); }
};

let kickTimer = null;
/** Redo pressed: start a worker run soon on this process when it runs jobs (never inside the request). */
const kickWorker = () => {
  if (process.env.NODE_ENV === 'test' || !queue.enabled() || kickTimer) return;
  if (!require('../utils/processRole').runsJobs()) return;
  kickTimer = setTimeout(() => {
    kickTimer = null;
    require('../jobs').runJob('media.cutouts').catch(() => {});
  }, 2000);
  if (kickTimer.unref) kickTimer.unref();
};

exports.setDishSlideshow = async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!UUID_RE.test(id)) return res.status(404).json({ message: 'Dish not found.' });
    const { MenuItem } = models();
    const item = await MenuItem.findByPk(id);
    if (!item) return res.status(404).json({ message: 'Dish not found.' });
    const b = req.body || {};
    const patch = {};
    const changes = {};
    if (b.clearSlideshowImage === true) {
      patch.slideshowImageUrl = null;
      changes.customImage = 'removed';
    } else if (b.slideshowImage !== undefined && b.slideshowImage !== null && b.slideshowImage !== '') {
      const { storeImageRef, sendImageError } = require('../utils/imageStore');
      const r = await storeImageRef(b.slideshowImage, { req, ownerId: item.restaurantId, purpose: 'menu', keep: item.slideshowImageUrl });
      if (!r.ok) return sendImageError(res, r);
      patch.slideshowImageUrl = r.value;
      changes.customImage = 'set';
    }
    if (b.roundPhoto !== undefined) {
      if (typeof b.roundPhoto !== 'boolean') return res.status(400).json({ message: 'roundPhoto must be true or false.' });
      patch.slideshowRoundPhoto = b.roundPhoto;
      changes.roundPhoto = b.roundPhoto;
    }
    if (b.redoCutout === true) {
      if (!item.imageUrl) return res.status(400).json({ message: 'This dish has no photo to cut out.' });
      Object.assign(patch, { cutoutStatus: 'pending', cutoutAt: null, cutoutSourceUrl: null });
      changes.redoCutout = true;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nothing to change.' });
    await item.update(patch, { silent: true });
    await ac().logAuditAction(req, item.id, 'MENU_ITEM_SLIDESHOW', { name: item.name, restaurantId: item.restaurantId, ...changes });
    ac().clearRestaurantsCache();
    realtime.publish('product', 'updated', item.id, { storeId: item.restaurantId, scope: 'slideshow' });
    if (changes.redoCutout) kickWorker();
    const fresh = await MenuItem.findByPk(item.id, { attributes: ITEM_ATTRS, raw: true });
    const names = await storeNames([fresh]);
    res.json({ dish: dishView(fresh, names.get(fresh.restaurantId), req) });
  } catch (err) { fail(res, err, 'Could not change the dish. Please try again.'); }
};

/** Public: GET /api/config/home-slideshow -> { nonveg: [ids], veg: [ids] } (empty = automatic). */
exports.getPublicHomeSlideshow = async (req, res) => {
  try {
    const v = await slideshow.read({ fresh: true });
    res.json({ nonveg: v.nonveg, veg: v.veg });
  } catch (err) {
    console.warn('[HOME_SLIDESHOW_PUBLIC]', err && err.message);
    res.json({ nonveg: [], veg: [] }); // automatic
  }
};

exports._dishView = dishView;
