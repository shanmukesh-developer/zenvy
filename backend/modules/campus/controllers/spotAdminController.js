// Admin CRUD for Campus spots (Campus Buddy > Campus > "Campus spots": open chat rooms for the
// library, mess, gym…). Spots exist only when an admin creates them; the app lists the active ones of
// the student's campus (or spots with no campus = every campus). Changes reach the apps through the
// realtime 'campus' event (scope 'spots').
const crypto = require('crypto');
const { Op } = require('sequelize');
const { getProximityRoomModel, getProximityMessageModel } = require('../models/ProximityRoom');
const { getCampusModel } = require('../models/Campus');
const realtime = require('../../../utils/realtime');

const ICONS = ['MapPin', 'BookOpen', 'Utensils', 'Dumbbell', 'Users', 'Sofa', 'Mic', 'Coffee', 'Music', 'Gamepad2', 'Trees', 'Bus', 'Laptop', 'Building'];
const CATEGORIES = ['library', 'dining', 'sports', 'hostel', 'academic', 'common'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 60;
const DESC_MAX = 120;
const EMOJI_MAX = 16;
const MAX_SORT = 9999;

const graphemes = (s) => {
  try { return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length; } catch { return [...s].length; }
};

const bad = (message) => Object.assign(new Error(message), { status: 400 });

const serialize = (r, campusNames = new Map()) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.subtitle || '',
  emoji: r.emoji || null,
  icon: r.icon || 'MapPin',
  category: r.category || 'common',
  campusId: r.campusId || null,
  campusName: r.campusId ? campusNames.get(String(r.campusId)) || null : null,
  isActive: r.isActive !== false,
  sortOrder: r.sortOrder || 0,
  latitude: r.latitude ?? null,
  longitude: r.longitude ?? null,
  radiusMeters: r.radiusMeters ?? null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const optNumber = (v, label, min, max) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${label} must be a number from ${min} to ${max}.`);
  return n;
};

/** Validated column values from the request body (partial = only the fields present). */
const spotFields = async (body, partial) => {
  const b = body && typeof body === 'object' ? body : {};
  const out = {};
  if (!partial || b.name !== undefined) {
    const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : '';
    if (name.length < 2 || name.length > NAME_MAX) throw bad(`Spot name must be 2 to ${NAME_MAX} characters.`);
    out.name = name;
  }
  if (b.description !== undefined || b.subtitle !== undefined) {
    const raw = b.description !== undefined ? b.description : b.subtitle;
    if (raw !== null && typeof raw !== 'string') throw bad('Description must be text.');
    const d = String(raw || '').replace(/\s+/g, ' ').trim();
    if (d.length > DESC_MAX) throw bad(`Description must be at most ${DESC_MAX} characters.`);
    out.subtitle = d;
  }
  if (b.emoji !== undefined) {
    if (b.emoji !== null && typeof b.emoji !== 'string') throw bad('Emoji must be text.');
    const e = String(b.emoji || '').trim();
    if (e && (e.length > EMOJI_MAX || graphemes(e) !== 1 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(e))) throw bad('Emoji must be a single emoji (or empty).');
    out.emoji = e || null;
  }
  if (b.icon !== undefined) {
    if (!ICONS.includes(b.icon)) throw bad(`Icon must be one of: ${ICONS.join(', ')}.`);
    out.icon = b.icon;
  }
  if (b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) throw bad(`Category must be one of: ${CATEGORIES.join(', ')}.`);
    out.category = b.category;
  }
  if (b.campusId !== undefined) {
    if (b.campusId === null || b.campusId === '') out.campusId = null;
    else {
      if (typeof b.campusId !== 'string' || !UUID_RE.test(b.campusId)) throw bad('Pick a campus from the list.');
      const campus = await getCampusModel().findByPk(b.campusId);
      if (!campus) throw bad('That campus does not exist.');
      out.campusId = String(campus.id);
    }
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== 'boolean') throw bad('isActive must be true or false.');
    out.isActive = b.isActive;
  }
  if (b.sortOrder !== undefined) {
    const n = Number(b.sortOrder);
    if (!Number.isInteger(n) || n < 0 || n > MAX_SORT) throw bad(`Sort order must be a whole number from 0 to ${MAX_SORT}.`);
    out.sortOrder = n;
  }
  const lat = optNumber(b.latitude, 'Latitude', -90, 90);
  const lng = optNumber(b.longitude, 'Longitude', -180, 180);
  if (lat !== undefined) out.latitude = lat;
  if (lng !== undefined) out.longitude = lng;
  const radius = optNumber(b.radiusMeters, 'Radius', 20, 5000);
  if (radius !== undefined) out.radiusMeters = radius === null ? 150 : Math.round(radius);
  return out;
};

const slugBase = (name) => String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'spot';

const campusNameMap = async () => {
  const rows = await getCampusModel().findAll({ attributes: ['id', 'name'] });
  return new Map(rows.map((c) => [String(c.id), c.name]));
};

const sendError = (res, err, tag) => {
  if (err.status === 400) return res.status(400).json({ message: err.message });
  console.error(tag, err);
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
};

// GET /api/campus/admin/spots — every spot (active or not), in app order
const listSpots = async (req, res) => {
  try {
    const rows = await getProximityRoomModel().findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    const names = await campusNameMap();
    res.json({ spots: rows.map((r) => serialize(r, names)), icons: ICONS, categories: CATEGORIES });
  } catch (err) {
    sendError(res, err, '[SPOTS_ADMIN_LIST_ERR]');
  }
};

// POST /api/campus/admin/spots
const createSpot = async (req, res) => {
  try {
    const fields = await spotFields(req.body, false);
    const ProximityRoom = getProximityRoomModel();
    if (fields.sortOrder === undefined) {
      const last = await ProximityRoom.max('sortOrder');
      fields.sortOrder = Math.min(MAX_SORT, (Number.isFinite(last) ? last : -1) + 1);
    }
    let row = null;
    for (let i = 0; i < 5 && !row; i++) {
      const slug = `${slugBase(fields.name)}-${crypto.randomBytes(3).toString('hex')}`;
      if (await ProximityRoom.findOne({ where: { slug }, attributes: ['id'] })) continue;
      row = await ProximityRoom.create({
        icon: 'MapPin', category: 'common', subtitle: '', isActive: true, radiusMeters: 150,
        ...fields,
        slug,
      });
    }
    if (!row) return res.status(500).json({ message: 'Could not create the spot. Please try again.' });
    realtime.publish('campus', 'created', row.id, { scope: 'spots' });
    res.status(201).json({ spot: serialize(row, await campusNameMap()) });
  } catch (err) {
    sendError(res, err, '[SPOTS_ADMIN_CREATE_ERR]');
  }
};

// PUT /api/campus/admin/spots/:id
const updateSpot = async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(404).json({ message: 'Spot not found' });
    const row = await getProximityRoomModel().findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Spot not found' });
    const fields = await spotFields(req.body, true);
    if (!Object.keys(fields).length) return res.status(400).json({ message: 'Nothing to change.' });
    await row.update(fields);
    // Disabled, or moved to another campus: drop whoever is in the live room.
    if (fields.isActive === false || fields.campusId !== undefined) {
      try { req.app.get('io')?.of('/campus').in(`proximity:${row.slug}`).socketsLeave(`proximity:${row.slug}`); } catch { /* optional */ }
    }
    realtime.publish('campus', 'updated', row.id, { scope: 'spots' });
    res.json({ spot: serialize(row, await campusNameMap()) });
  } catch (err) {
    sendError(res, err, '[SPOTS_ADMIN_UPDATE_ERR]');
  }
};

// PUT /api/campus/admin/spots/reorder  { ids: [spotId, ...] } — sortOrder = position in the list
const reorderSpots = async (req, res) => {
  try {
    const ids = req.body && Array.isArray(req.body.ids) ? req.body.ids : null;
    if (!ids || !ids.length || ids.length > 500 || !ids.every((x) => typeof x === 'string' && UUID_RE.test(x)) || new Set(ids).size !== ids.length) {
      return res.status(400).json({ message: 'Send the spot ids in their new order.' });
    }
    const ProximityRoom = getProximityRoomModel();
    const found = await ProximityRoom.count({ where: { id: { [Op.in]: ids } } });
    if (found !== ids.length) return res.status(400).json({ message: 'Some spots no longer exist. Refresh and try again.' });
    await ProximityRoom.sequelize.transaction(async (t) => {
      for (let i = 0; i < ids.length; i++) {
        await ProximityRoom.update({ sortOrder: Math.min(i, MAX_SORT) }, { where: { id: ids[i] }, transaction: t });
      }
    });
    realtime.publish('campus', 'updated', null, { scope: 'spots' });
    const rows = await ProximityRoom.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    const names = await campusNameMap();
    res.json({ spots: rows.map((r) => serialize(r, names)) });
  } catch (err) {
    sendError(res, err, '[SPOTS_ADMIN_REORDER_ERR]');
  }
};

// DELETE /api/campus/admin/spots/:id — removes the spot and its room messages
const deleteSpot = async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(404).json({ message: 'Spot not found' });
    const ProximityRoom = getProximityRoomModel();
    const row = await ProximityRoom.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Spot not found' });
    const slug = row.slug;
    await ProximityRoom.sequelize.transaction(async (t) => {
      await getProximityMessageModel().destroy({ where: { roomId: row.id }, transaction: t });
      await row.destroy({ transaction: t });
    });
    try { req.app.get('io')?.of('/campus').in(`proximity:${slug}`).socketsLeave(`proximity:${slug}`); } catch { /* optional */ }
    realtime.publish('campus', 'deleted', row.id, { scope: 'spots' });
    res.json({ message: 'Spot deleted', id: row.id });
  } catch (err) {
    sendError(res, err, '[SPOTS_ADMIN_DELETE_ERR]');
  }
};

module.exports = { listSpots, createSpot, updateSpot, reorderSpots, deleteSpot, ICONS, CATEGORIES };
