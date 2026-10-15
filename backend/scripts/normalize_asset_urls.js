// Startup normalisation: image URLs that point at app-relative '/assets/...' files.
// No host serves them (not the backend, not the admin site, not the apps), so every one was a
// broken image (404) — the seeded KFC / Domino's / McDonald's banners + logos and the default
// AppConfig category tiles. They are set to null (the apps already show their own placeholder).
// Idempotent and safe to run twice / on several instances at once:
//  - only values that start with '/assets/' or 'assets/' are touched; absolute URLs
//    (https://...), media URLs (/api/campus/media/...) and nulls are never changed;
//  - each write is conditional on the old value, so a concurrent admin edit wins.
// Set DISABLE_ASSET_URL_FIX=true to switch it off.

const RELATIVE_ASSET = /^\/?assets\//i;
const isRelativeAsset = (v) => typeof v === 'string' && RELATIVE_ASSET.test(v.trim());

const BRAND_KEYS = ['logoUrl', 'bannerUrl', 'coverUrl', 'imageUrl', 'heroImage', 'backgroundImage', 'backgroundUrl'];

const parseJson = (v) => {
  if (v && typeof v === 'object') return v;
  if (typeof v !== 'string' || !v.trim()) return null;
  try { return JSON.parse(v); } catch { return null; }
};

const runAssetUrlFix = async () => {
  if (String(process.env.DISABLE_ASSET_URL_FIX || '').toLowerCase() === 'true') return { skipped: true };
  const { Op } = require('sequelize');
  const out = { storeImages: 0, storeBrand: 0, items: 0, config: 0 };
  const like = (col) => ({ [Op.or]: [{ [col]: { [Op.like]: '/assets/%' } }, { [col]: { [Op.like]: 'assets/%' } }] });

  const { getRestaurantModel } = require('../models/Restaurant');
  const Restaurant = getRestaurantModel && getRestaurantModel();
  if (Restaurant) {
    for (const col of ['imageUrl', 'logoUrl']) {
      if (!Restaurant.rawAttributes[col]) continue;
      const rows = await Restaurant.findAll({ where: like(col), attributes: ['id', col] });
      for (const r of rows) {
        const old = r.get(col);
        if (!isRelativeAsset(old)) continue;
        const [n] = await Restaurant.update({ [col]: null }, { where: { id: r.id, [col]: old }, hooks: false });
        out.storeImages += n;
      }
    }
    if (Restaurant.rawAttributes.brandTheme) {
      const rows = await Restaurant.findAll({ where: { brandTheme: { [Op.like]: '%assets/%' } }, attributes: ['id', 'brandTheme'] });
      for (const r of rows) {
        const raw = r.getDataValue('brandTheme');
        const theme = parseJson(raw);
        if (!theme || typeof theme !== 'object') continue;
        let changed = false;
        const next = { ...theme };
        for (const k of BRAND_KEYS) {
          if (isRelativeAsset(next[k])) { next[k] = null; changed = true; }
        }
        if (!changed) continue;
        // Static update does not run the model's JSON setter (an object was stored as
        // "[object Object]"): write the JSON text itself, without the setter/validation pass.
        const [n] = await Restaurant.update({ brandTheme: JSON.stringify(next) }, { where: { id: r.id, brandTheme: raw }, hooks: false, validate: false });
        out.storeBrand += n;
      }
    }
  }

  const { getMenuItemModel } = require('../models/MenuItem');
  const MenuItem = getMenuItemModel && getMenuItemModel();
  if (MenuItem && MenuItem.rawAttributes.imageUrl) {
    const rows = await MenuItem.findAll({ where: like('imageUrl'), attributes: ['id', 'imageUrl'] });
    for (const r of rows) {
      const old = r.get('imageUrl');
      if (!isRelativeAsset(old)) continue;
      const [n] = await MenuItem.update({ imageUrl: null }, { where: { id: r.id, imageUrl: old }, hooks: false });
      out.items += n;
    }
  }

  const AppConfig = require('../models/AppConfig');
  const Config = AppConfig && AppConfig.getAppConfigModel && AppConfig.getAppConfigModel();
  if (Config) {
    const rows = await Config.findAll({
      where: { [Op.or]: [{ categories: { [Op.like]: '%assets/%' } }, { banners: { [Op.like]: '%assets/%' } }] },
    });
    for (const row of rows) {
      const update = {};
      const where = { id: row.id };
      for (const [col, keys] of [['categories', ['img', 'imageUrl']], ['banners', ['imageUrl', 'img']]]) {
        const raw = row.getDataValue(col);
        const list = parseJson(raw);
        if (!Array.isArray(list)) continue;
        let changed = false;
        const next = list.map((entry) => {
          if (!entry || typeof entry !== 'object') return entry;
          const e = { ...entry };
          for (const k of keys) if (isRelativeAsset(e[k])) { e[k] = null; changed = true; }
          return e;
        });
        if (changed) { update[col] = JSON.stringify(next); where[col] = raw; }
      }
      if (!Object.keys(update).length) continue;
      const [n] = await Config.update(update, { where, hooks: false, validate: false });
      out.config += n;
    }
  }
  if (out.storeImages || out.storeBrand || out.items || out.config) {
    try { require('../utils/responseCache').invalidateAll(); } catch { /* cache optional */ }
  }
  return out;
};

module.exports = { runAssetUrlFix, isRelativeAsset };
