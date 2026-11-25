/**
 * Cut-out worker (owner, 25 Nov 2026: the Home slideshow dishes float "like the basket in Groceries"). Background job
 * 'media.cutouts' (jobs/index.js): makes a transparent cut-out of every dish photo, one photo at a time, on this
 * server (utils/cutout: ~1.5-2 s and up to ~1 GB per photo with ISNet, so never in a request handler).
 *
 * Which dishes: a MenuItem with an imageUrl whose cutoutSourceUrl is not that imageUrl (new dish, or the photo
 * changed), plus 'pending' rows an admin sent back ("Redo cut-out") and claims older than STALE_MS (a process died
 * mid-photo). A failed photo is marked 'failed' with its cutoutSourceUrl, so it is not tried again until the photo
 * changes or an admin presses Redo. Order: admin's redo requests, the admin's slideshow dishes, dishes on discount
 * (the automatic slideshow picks from those), then every other dish, oldest first (the backfill).
 *
 * Safe with several processes: the job is single-runner (utils/jobs.runExclusive) and every row is claimed with a
 * conditional update before work starts. CUTOUTS=off turns the worker off.
 */
const { Op } = require('sequelize');

const STALE_MS = 15 * 60 * 1000;
const GAP_MS = 1500;
const MAX_PER_RUN = 40;
const BUDGET_MS = 4 * 60 * 1000;
const MAX_INPUT_SIDE = 1600; // photos are shrunk to this before the model (memory; the output is capped at 800 px)
const FETCH_MAX_BYTES = 8 * 1024 * 1024;

// Owner, 25 Nov 2026: "stop auto cut-out, I will use round images only". OFF unless CUTOUTS=on: no background job,
// no model download, and no cut-out is sent to the apps (the slideshow shows the round photo or the admin's own image).
const enabled = () => String(process.env.CUTOUTS || '').trim().toLowerCase() === 'on';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sequelizeOf = () => require('../config/db').getSequelize();

/** WHERE for rows that need a cut-out now. */
const needsWork = (sequelize, now = Date.now()) => {
  const col = (c) => sequelize.col(`MenuItem.${c}`);
  const cutoff = new Date(now - STALE_MS);
  return {
    [Op.and]: [
      { imageUrl: { [Op.ne]: null } },
      { imageUrl: { [Op.ne]: '' } },
      { imageUrl: { [Op.notLike]: 'data:%' } },
      // Not claimed by a run that is still going.
      { [Op.or]: [{ cutoutStatus: null }, { cutoutStatus: { [Op.ne]: 'pending' } }, { cutoutAt: null }, { cutoutAt: { [Op.lt]: cutoff } }] },
      { [Op.or]: [{ cutoutSourceUrl: null }, sequelize.where(col('cutoutSourceUrl'), Op.ne, col('imageUrl')), { cutoutStatus: 'pending' }] },
    ],
  };
};

const ATTRS = ['id', 'restaurantId', 'imageUrl', 'cutoutStatus', 'cutoutAt', 'cutoutSourceUrl'];

/** The next dish to work on (see the order above), or null. */
const nextCandidate = async (MenuItem, sequelize, skip) => {
  const base = needsWork(sequelize);
  const notSkipped = skip.size ? [{ id: { [Op.notIn]: [...skip] } }] : [];
  const order = [['createdAt', 'ASC'], ['id', 'ASC']];
  const tiers = [];
  tiers.push({ cutoutStatus: 'pending', cutoutAt: null });
  const picked = await require('./homeSlideshow').pickedIds();
  if (picked.length) tiers.push({ id: { [Op.in]: picked } });
  tiers.push(sequelize.where(sequelize.col('MenuItem.originalPrice'), Op.gt, sequelize.col('MenuItem.price')));
  tiers.push(null);
  for (const t of tiers) {
    const row = await MenuItem.findOne({ where: { [Op.and]: [...base[Op.and], ...notSkipped, ...(t ? [t] : [])] }, attributes: ATTRS, order, raw: true });
    if (row) return row;
  }
  return null;
};

/** Image bytes of a dish photo: our own media rows are read directly, other http(s) links are downloaded safely. */
const fetchPhoto = async (url) => {
  const { mediaIdOf } = require('./imageStore');
  const mid = mediaIdOf(url);
  if (mid) {
    const { getCampusMediaModel } = require('../modules/campus/models/CampusMedia');
    const Media = getCampusMediaModel && getCampusMediaModel();
    const row = Media && await Media.findByPk(mid);
    if (!row) return { ok: false, code: 'MEDIA_GONE' };
    const buf = await require('./mediaStorage').readAllBytes(row);
    return buf && buf.length ? { ok: true, buf } : { ok: false, code: 'MEDIA_EMPTY' };
  }
  if (!/^https?:\/\//i.test(String(url))) return { ok: false, code: 'NOT_A_LINK' };
  const got = await require('./imageImport').downloadImage(url, { maxBytes: FETCH_MAX_BYTES, timeoutMs: 20000 });
  return got.ok ? { ok: true, buf: got.buf } : { ok: false, code: got.code };
};

/** Upright, at most MAX_INPUT_SIDE px (EXIF rotation applied once, so the mask and the colours line up). */
const prepare = async (buf) => {
  const sharp = require('sharp');
  const meta = await sharp(buf).metadata();
  const img = sharp(buf).rotate().resize(MAX_INPUT_SIDE, MAX_INPUT_SIDE, { fit: 'inside', withoutEnlargement: true });
  return meta.hasAlpha ? img.png().toBuffer() : img.jpeg({ quality: 92 }).toBuffer();
};

/** Absolute media link like the dish photo's own (same host), else this deployment's public base. */
const mediaUrl = (id, sourceUrl) => {
  const m = /^(https?:\/\/[^/\s]+)\/api\/campus\/media\//i.exec(String(sourceUrl || ''));
  const base = m ? m[1] : require('./imageStore').publicBase(null);
  return `${base}/api/campus/media/${id}`;
};

/**
 * One dish: claim, fetch, cut out, store. Resolves 'done' | 'failed' | 'lost' (someone else claimed it or the
 * photo changed meanwhile).
 */
const processOne = async (MenuItem, row, { make, fetchImpl, log }) => {
  const now = new Date();
  // Claimed only while nobody else holds it (not 'pending' with a fresh cutoutAt) and the photo is the one we read.
  const free = { [Op.or]: [{ cutoutStatus: null }, { cutoutStatus: { [Op.ne]: 'pending' } }, { cutoutAt: null }, { cutoutAt: { [Op.lt]: new Date(now.getTime() - STALE_MS) } }] };
  const [claimed] = await MenuItem.update(
    { cutoutStatus: 'pending', cutoutAt: now },
    { where: { id: row.id, imageUrl: row.imageUrl, ...free }, silent: true, hooks: false },
  );
  if (!claimed) return 'lost';
  const source = row.imageUrl;
  let result = null;
  let reason = null;
  try {
    const got = await fetchImpl(source);
    if (!got.ok) reason = got.code || 'FETCH_FAILED';
    else {
      const input = await prepare(got.buf);
      const cut = await make(input);
      if (!cut || !cut.buffer) reason = 'NO_CUTOUT';
      else {
        const saved = await require('./imageStore').saveImageBytes(cut.buffer, { ownerId: row.restaurantId, purpose: 'menu' });
        result = mediaUrl(saved.id, source);
      }
    }
  } catch (err) {
    reason = String(err && err.message || err).slice(0, 120);
  }
  const fields = result
    ? { cutoutUrl: result, cutoutSourceUrl: source, cutoutStatus: 'done', cutoutAt: new Date() }
    : { cutoutUrl: null, cutoutSourceUrl: source, cutoutStatus: 'failed', cutoutAt: new Date() };
  const [n] = await MenuItem.update(fields, { where: { id: row.id, imageUrl: source }, silent: true, hooks: false });
  if (!n) return 'lost'; // the photo changed while we worked: the next run makes the new one
  if (!result) log(`[CUTOUT] ${row.id} failed: ${reason}`);
  return result ? 'done' : 'failed';
};

/**
 * One run of the worker. Options (tests): make (makeCutout stand-in), fetchImpl, gapMs, maxItems, budgetMs, log,
 * waitForModel (default true outside tests: while ISNet is still downloading the run waits for the next tick, so the
 * backfill is made with the approved model rather than the small fallback).
 */
const runCutoutQueue = async (opts = {}) => {
  const out = { done: 0, failed: 0, lost: 0 };
  if (!enabled()) return { ...out, skipped: 'off' };
  const isTest = process.env.NODE_ENV === 'test';
  const {
    make = (buf) => require('./cutout').makeCutout(buf),
    fetchImpl = fetchPhoto,
    gapMs = isTest ? 0 : GAP_MS,
    maxItems = MAX_PER_RUN,
    budgetMs = BUDGET_MS,
    log = console.log,
    waitForModel = !isTest,
  } = opts;
  const sequelize = sequelizeOf();
  const MenuItem = sequelize && sequelize.models && sequelize.models.MenuItem;
  if (!MenuItem || !MenuItem.rawAttributes.cutoutStatus) return { ...out, skipped: 'models not ready' };

  const started = Date.now();
  const skip = new Set();
  let first = true;
  while (out.done + out.failed + out.lost < maxItems && Date.now() - started < budgetMs) {
    const row = await nextCandidate(MenuItem, sequelize, skip);
    if (!row) break;
    if (first) {
      first = false;
      // Something to do: make sure the ISNet file is there or on its way (downloads once, in the background).
      if (!isTest && require('./cutoutModel').ensureIsnet() === 'downloading' && waitForModel) return { ...out, waiting: 'model download' };
    } else if (gapMs) {
      await sleep(gapMs);
    }
    skip.add(row.id);
    const r = await processOne(MenuItem, row, { make, fetchImpl, log });
    out[r]++;
  }
  if (out.done || out.failed) {
    // Home's store list carries cutoutUrl: drop the cached copy so the next refresh has the new cut-outs.
    try { require('../controllers/adminController').clearRestaurantsCache(); } catch { /* best effort */ }
  }
  return out;
};

/** Admin counts for the Home slideshow page. */
const counts = async () => {
  const sequelize = sequelizeOf();
  const MenuItem = sequelize && sequelize.models && sequelize.models.MenuItem;
  if (!MenuItem) return null;
  const withPhoto = { imageUrl: { [Op.ne]: null } };
  const [total, done, failed, waiting] = await Promise.all([
    MenuItem.count({ where: { [Op.and]: [withPhoto, { imageUrl: { [Op.ne]: '' } }] } }),
    MenuItem.count({ where: { cutoutStatus: 'done', [Op.and]: [sequelize.where(sequelize.col('cutoutSourceUrl'), Op.eq, sequelize.col('imageUrl'))] } }),
    MenuItem.count({ where: { cutoutStatus: 'failed', [Op.and]: [sequelize.where(sequelize.col('cutoutSourceUrl'), Op.eq, sequelize.col('imageUrl'))] } }),
    MenuItem.count({ where: needsWork(sequelize) }),
  ]);
  return { total, done, failed, waiting };
};

/**
 * What the slideshow shows for a dish row (admin + tests): 'custom' | 'cutout' | 'round', and the cut-out's state:
 * 'done' | 'failed' | 'pending' (queued or being made) | 'none' (no photo).
 */
const cutoutState = (m) => {
  if (!m || !m.imageUrl || /^data:/i.test(String(m.imageUrl))) return 'none';
  if (m.cutoutSourceUrl !== m.imageUrl || m.cutoutStatus === 'pending' || !m.cutoutStatus) return 'pending';
  return m.cutoutStatus === 'done' && m.cutoutUrl ? 'done' : 'failed';
};
/** The cut-out link when it belongs to the dish's current photo, else null. */
const currentCutout = (m) => (enabled() && cutoutState(m) === 'done' ? m.cutoutUrl : null);
const slideImageOf = (m) => {
  if (m.slideshowImageUrl) return { shows: 'custom', url: m.slideshowImageUrl };
  const c = currentCutout(m);
  if (c && !m.slideshowRoundPhoto) return { shows: 'cutout', url: c };
  return { shows: 'round', url: m.imageUrl || null };
};

/** A relative media link (stored when no public address was known, e.g. local dev) made absolute for this request. */
const absoluteUrl = (u, req) => (typeof u === 'string' && u.startsWith('/api/') ? `${require('./imageStore').publicBase(req)}${u}` : u);

module.exports = { absoluteUrl, runCutoutQueue, enabled, counts, cutoutState, currentCutout, slideImageOf, fetchPhoto, needsWork, STALE_MS };
