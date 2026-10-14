// Rentals images live in CampusMedia (bytes in the DB, short URL /api/campus/media/<id>); rows only
// store the short path. Every reference a student sends is checked: it must be their own upload with
// the right purpose (documents / licences must be private uploads).
const { Op } = require('sequelize');
const { fail } = require('./util');

const PATH_RE = /\/api\/campus\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i;

/** '/api/campus/media/<id>' for any accepted form of a media reference, else null. */
const toPath = (ref) => {
  if (typeof ref !== 'string') return null;
  const m = PATH_RE.exec(ref.trim());
  return m ? `/api/campus/media/${m[1].toLowerCase()}` : null;
};
const idOf = (path) => {
  const m = PATH_RE.exec(String(path || ''));
  return m ? m[1].toLowerCase() : null;
};

/**
 * Validates a list of media references for `userId`. Returns normalised paths in order.
 * purposes: allowed CampusMedia.purpose values. A reference that was already stored on the row
 * (keep) is accepted without re-checking ownership (e.g. an admin-moved photo).
 */
const checkRefs = async (userId, refs, { purposes, field, min = 0, max = 6, keep = [], label = 'photo' }) => {
  if (refs === undefined || refs === null) refs = [];
  if (!Array.isArray(refs)) throw fail(400, 'INVALID_INPUT', `${field} must be a list of uploaded ${label}s.`, { field });
  const paths = [];
  for (const r of refs) {
    const p = toPath(r);
    if (!p) throw fail(400, 'INVALID_MEDIA', `Upload the ${label} through the app first.`, { field });
    if (!paths.includes(p)) paths.push(p);
  }
  if (paths.length < min) throw fail(400, 'INVALID_INPUT', min === 1 ? `Add at least one ${label}.` : `Add at least ${min} ${label}s.`, { field });
  if (paths.length > max) throw fail(400, 'INVALID_INPUT', `You can add at most ${max} ${label}s.`, { field });
  const keepSet = new Set((keep || []).map(toPath).filter(Boolean));
  const toCheck = paths.filter((p) => !keepSet.has(p)).map(idOf);
  if (toCheck.length) {
    const { getCampusMediaModel } = require('../../campus/models/CampusMedia');
    const Media = getCampusMediaModel();
    const rows = await Media.findAll({ where: { id: { [Op.in]: toCheck } }, attributes: ['id', 'ownerId', 'purpose', 'isPrivate'] });
    const byId = new Map(rows.map((r) => [String(r.id).toLowerCase(), r]));
    for (const id of toCheck) {
      const row = byId.get(id);
      if (!row || String(row.ownerId) !== String(userId) || !purposes.includes(row.purpose)) {
        throw fail(400, 'INVALID_MEDIA', `One of the ${label}s was not uploaded from your account. Please upload it again.`, { field });
      }
    }
  }
  return paths;
};

module.exports = { toPath, idOf, checkRefs };
