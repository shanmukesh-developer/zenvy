// Deletes CampusMedia photos once nothing points at them any more (B19). Wall, birthday and
// community photos are stored in CampusMedia by utils/imageStore; deleting / replacing / rejecting
// the owner row used to leave the bytes behind forever.
//
//  • releaseMedia(values, purpose)   — right after an owner row is deleted or its photo replaced.
//  • sweepUnreferencedMedia()        — periodic backstop (retentionCron): photos of these purposes
//    older than a grace period that no owner table mentions any more.
// A photo is only deleted when no text column of its owner tables still mentions its id, so a
// photo shared by two rows (or re-attached) is kept.
const { Op } = require('sequelize');

const MEDIA_ID_RE = /\/api\/campus\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// purpose -> models whose text columns may reference such a photo
const OWNERS = {
  post: ['CommunityPost'],
  wall: ['WallSubmission', 'WallEvent'],
  birthday: ['BirthdayCelebration', 'BirthdayWish'],
};
const SWEEP_PURPOSES = Object.keys(OWNERS);
const GRACE_MS = 24 * 60 * 60 * 1000; // an upload attached a moment later is never swept

const models = () => {
  try {
    const s = require('../config/db').getSequelize();
    return (s && s.models) || {};
  } catch {
    return {};
  }
};

const mediaIdsIn = (values) => {
  const out = new Set();
  for (const v of [].concat(values || [])) {
    if (v === null || v === undefined) continue;
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    for (const m of s.matchAll(MEDIA_ID_RE)) out.add(m[1].toLowerCase());
  }
  return [...out];
};

const textColumns = (Model) => Object.entries(Model.rawAttributes)
  .filter(([, a]) => a.type && ['STRING', 'TEXT', 'JSON', 'JSONB'].includes(a.type.key))
  .map(([name, a]) => a.field || name);

const isReferenced = async (id, purpose, M) => {
  for (const name of OWNERS[purpose] || []) {
    const Model = M[name];
    if (!Model) continue;
    const cols = textColumns(Model);
    if (!cols.length) continue;
    const s = Model.sequelize;
    const hit = await Model.findOne({
      where: { [Op.or]: cols.map((c) => s.where(s.cast(s.col(c), 'TEXT'), { [Op.like]: `%${id}%` })) },
      attributes: [Model.primaryKeyAttribute],
    });
    if (hit) return true;
  }
  return false;
};

/** Deletes the photos named in `values` (URLs / objects) of `purpose` that are no longer referenced. */
const releaseMedia = async (values, purpose) => {
  const M = models();
  const CampusMedia = M.CampusMedia;
  if (!CampusMedia || !OWNERS[purpose]) return 0;
  const ids = mediaIdsIn(values).filter((x) => UUID_RE.test(x));
  if (!ids.length) return 0;
  let deleted = 0;
  try {
    const rows = await CampusMedia.findAll({ where: { id: { [Op.in]: ids }, purpose }, attributes: ['id'] });
    for (const r of rows) {
      if (await isReferenced(String(r.id), purpose, M)) continue;
      deleted += await CampusMedia.destroy({ where: { id: r.id, purpose } });
    }
  } catch (err) {
    console.warn('[MEDIA_RELEASE_WARN]', err.message);
  }
  return deleted;
};

const sweepCursor = new Map(); // purpose -> createdAt of the last checked row

/** Periodic backstop: unreferenced wall / birthday / community photos older than the grace period. */
const sweepUnreferencedMedia = async ({ now = new Date(), limit = 300, purposes = SWEEP_PURPOSES } = {}) => {
  const M = models();
  const CampusMedia = M.CampusMedia;
  const stats = { checked: 0, deleted: 0 };
  if (!CampusMedia) return stats;
  const cutoff = new Date(now.getTime() - GRACE_MS);
  for (const purpose of purposes) {
    if (!OWNERS[purpose]) continue;
    // Walks forward from where the last run stopped (old, still-used photos never block the queue),
    // and wraps around once the end is reached.
    const after = sweepCursor.get(purpose);
    const rows = await CampusMedia.findAll({
      where: { purpose, createdAt: after ? { [Op.lt]: cutoff, [Op.gt]: after } : { [Op.lt]: cutoff } },
      attributes: ['id', 'createdAt'],
      order: [['createdAt', 'ASC']],
      limit,
    });
    if (rows.length < limit) sweepCursor.delete(purpose);
    else sweepCursor.set(purpose, rows[rows.length - 1].createdAt);
    for (const r of rows) {
      stats.checked += 1;
      if (await isReferenced(String(r.id), purpose, M)) continue;
      stats.deleted += await CampusMedia.destroy({ where: { id: r.id, purpose } });
    }
  }
  return stats;
};

module.exports = { releaseMedia, sweepUnreferencedMedia, mediaIdsIn, OWNERS, GRACE_MS };
