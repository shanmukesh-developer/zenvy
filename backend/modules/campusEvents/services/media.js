// Event posters / gallery: public CampusMedia rows (purpose 'event_poster') uploaded through
// POST /api/campus/media. Every reference an organizer sends must be one of their own uploads with that
// purpose (an admin editing keeps the paths already stored on the event).
const { Op } = require('sequelize');
const { fail } = require('./util');

const PURPOSE = 'event_poster';
const PATH_RE = /\/api\/campus\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i;

const toPath = (ref) => {
  if (typeof ref !== 'string') return null;
  const m = PATH_RE.exec(ref.trim());
  return m ? `/api/campus/media/${m[1].toLowerCase()}` : null;
};
const idOf = (p) => {
  const m = PATH_RE.exec(String(p || ''));
  return m ? m[1].toLowerCase() : null;
};

/** Normalised paths, each the user's own 'event_poster' upload (or already in `keep`). */
const checkPosters = async (userId, refs, { field, max = 6, keep = [] }) => {
  const list = refs === undefined || refs === null ? [] : (Array.isArray(refs) ? refs : [refs]);
  const paths = [];
  for (const r of list) {
    if (r === null || r === '') continue;
    const p = toPath(r);
    if (!p) throw fail(400, 'INVALID_MEDIA', 'Upload the poster through the app first.', { field });
    if (!paths.includes(p)) paths.push(p);
  }
  if (paths.length > max) throw fail(400, 'INVALID_INPUT', `You can add at most ${max} images.`, { field });
  const keepSet = new Set((keep || []).map(toPath).filter(Boolean));
  const toCheck = paths.filter((p) => !keepSet.has(p)).map(idOf);
  if (toCheck.length) {
    const { getCampusMediaModel } = require('../../campus/models/CampusMedia');
    const rows = await getCampusMediaModel().findAll({ where: { id: { [Op.in]: toCheck } }, attributes: ['id', 'ownerId', 'purpose'] });
    const byId = new Map(rows.map((r) => [String(r.id).toLowerCase(), r]));
    for (const id of toCheck) {
      const row = byId.get(id);
      if (!row || String(row.ownerId) !== String(userId) || row.purpose !== PURPOSE) {
        throw fail(400, 'INVALID_MEDIA', 'One of the images was not uploaded from your account as an event poster. Please upload it again.', { field });
      }
    }
  }
  return paths;
};

module.exports = { PURPOSE, toPath, checkPosters };
