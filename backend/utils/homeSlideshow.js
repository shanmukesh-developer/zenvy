/**
 * Home slideshow picks (owner, 25 Nov 2026: "the admin should pick the slideshow dishes"). GlobalConfig HOME_SLIDESHOW
 * = { nonveg: [menuItemId...], veg: [menuItemId...] }, at most MAX per diet, in the order the admin set. An empty list
 * means automatic: the app picks the biggest discounts, one per restaurant (customer-mobile HomeNov2026 pickDeals).
 * Admin: GET / PUT /api/admin/home-slideshow. App: GET /api/config/home-slideshow (cached, cleared on every change).
 */
const KEY = 'HOME_SLIDESHOW';
const MAX = 4;
const DIETS = ['nonveg', 'veg'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL_MS = 30 * 1000;

const models = () => {
  const s = require('../config/db').getSequelize();
  return (s && s.models) || {};
};

const empty = () => ({ nonveg: [], veg: [] });

/** Any stored value -> { nonveg: [...ids], veg: [...ids] } (bad entries dropped, never throws). */
const normalize = (raw) => {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  const out = empty();
  if (!v || typeof v !== 'object') return out;
  for (const d of DIETS) {
    const seen = new Set();
    for (const id of Array.isArray(v[d]) ? v[d] : []) {
      const s = String(id || '').toLowerCase();
      if (UUID_RE.test(s) && !seen.has(s) && seen.size < MAX) { seen.add(s); out[d].push(s); }
    }
  }
  return out;
};

let cache = { at: 0, value: null };
const clearCache = () => { cache = { at: 0, value: null }; };

/** The saved picks (short in-process cache; pass { fresh: true } to read the database). */
const read = async ({ fresh = false } = {}) => {
  if (!fresh && cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  const GlobalConfig = models().GlobalConfig;
  let value = empty();
  if (GlobalConfig) {
    const row = await GlobalConfig.findOne({ where: { key: KEY }, attributes: ['value'] });
    value = normalize(row && row.value);
  }
  cache = { at: Date.now(), value };
  return value;
};

/**
 * Checks an admin's { nonveg, veg } (lists of menu item ids). Each diet is optional (missing = keep the saved one).
 * Resolves { ok: true, value } or { ok: false, message }.
 */
const validate = async (body, current = empty()) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Send { nonveg: [...], veg: [...] }.' };
  const value = { nonveg: [...current.nonveg], veg: [...current.veg] };
  const all = new Set();
  for (const d of DIETS) {
    if (body[d] === undefined) continue;
    if (!Array.isArray(body[d])) return { ok: false, message: `${d === 'veg' ? 'Veg' : 'Non-veg'} must be a list of dishes.` };
    if (body[d].length > MAX) return { ok: false, message: `At most ${MAX} dishes per list.` };
    const ids = body[d].map((x) => String(x || '').toLowerCase());
    if (ids.some((id) => !UUID_RE.test(id))) return { ok: false, message: 'Unknown dish in the list.' };
    if (new Set(ids).size !== ids.length) return { ok: false, message: 'A dish is in the list twice.' };
    value[d] = ids;
  }
  for (const d of DIETS) for (const id of value[d]) all.add(id);
  if (all.size) {
    const MenuItem = models().MenuItem;
    const { Op } = require('sequelize');
    const found = MenuItem ? await MenuItem.findAll({ where: { id: { [Op.in]: [...all] } }, attributes: ['id'], raw: true }) : [];
    const have = new Set(found.map((r) => String(r.id).toLowerCase()));
    const missing = [...all].filter((id) => !have.has(id));
    if (missing.length) return { ok: false, message: 'A dish in the list no longer exists. Reload the page and try again.', missing };
  }
  return { ok: true, value };
};

/** Saves the picks (already validated) and clears the caches. */
const save = async (value) => {
  const GlobalConfig = models().GlobalConfig;
  const v = normalize(value);
  const row = await GlobalConfig.findOne({ where: { key: KEY } });
  if (row) await row.update({ value: v });
  else await GlobalConfig.create({ key: KEY, value: v, description: 'Home slideshow dishes per diet (admin Config > Home slideshow)' });
  clearCache();
  return v;
};

/** Every picked id (both diets), for the cut-out worker's priority. */
const pickedIds = async () => {
  try {
    const v = await read();
    return [...v.nonveg, ...v.veg];
  } catch {
    return [];
  }
};

module.exports = { KEY, MAX, DIETS, normalize, read, validate, save, clearCache, pickedIds };
