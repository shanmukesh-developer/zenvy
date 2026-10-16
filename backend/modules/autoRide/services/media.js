// Driver documents / photos: private CampusMedia rows (purpose 'auto_driver_doc', owner = driver id),
// uploaded through POST /api/auto-ride/driver/media (drivers are not Users, so the campus upload route
// is not theirs). Admins load them with their Bearer token; drivers and customers only get 1-hour
// signed links. Every reference a driver sends must be one of their own uploads with that purpose.
const { Op } = require('sequelize');
const { fail } = require('./util');

const PURPOSE = 'auto_driver_doc';
const PATH_RE = /\/api\/campus\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i;

const toPath = (ref) => {
  if (typeof ref !== 'string') return null;
  const m = PATH_RE.exec(ref.trim());
  return m ? `/api/campus/media/${m[1].toLowerCase()}` : null;
};
const idOf = (path) => {
  const m = PATH_RE.exec(String(path || ''));
  return m ? m[1].toLowerCase() : null;
};

/** Checks that every path is the driver's own private upload. Returns normalised paths. */
const checkOwn = async (driverId, refs, { field, keep = [] }) => {
  const paths = [];
  for (const r of refs) {
    const p = toPath(r);
    if (!p) throw fail(400, 'INVALID_MEDIA', 'Upload the photo through the driver app first.', { field });
    if (!paths.includes(p)) paths.push(p);
  }
  const keepSet = new Set((keep || []).map(toPath).filter(Boolean));
  const ids = paths.filter((p) => !keepSet.has(p)).map(idOf);
  if (ids.length) {
    const { getCampusMediaModel } = require('../../campus/models/CampusMedia');
    const rows = await getCampusMediaModel().findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'ownerId', 'purpose', 'isPrivate'] });
    const byId = new Map(rows.map((r) => [String(r.id).toLowerCase(), r]));
    for (const id of ids) {
      const row = byId.get(id);
      if (!row || String(row.ownerId) !== String(driverId) || row.purpose !== PURPOSE || !row.isPrivate) {
        throw fail(400, 'INVALID_MEDIA', 'One of the photos was not uploaded from your driver account. Please upload it again.', { field });
      }
    }
  }
  return paths;
};

/** { key: ref } map restricted to `allowed` keys, every value checked. Missing keys keep `current`. */
const checkDocMap = async (driverId, input, allowed, current = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(400, 'INVALID_INPUT', 'documents must be an object.', { field: 'documents' });
  const out = { ...(current || {}) };
  for (const [k, v] of Object.entries(input)) {
    if (!allowed.includes(k)) throw fail(400, 'INVALID_INPUT', `Unknown document "${k}". Allowed: ${allowed.join(', ')}.`, { field: `documents.${k}` });
    if (v === null || v === '') { delete out[k]; continue; }
    const [p] = await checkOwn(driverId, [v], { field: `documents.${k}`, keep: Object.values(current || {}) });
    out[k] = p;
  }
  return out;
};

module.exports = { PURPOSE, toPath, checkOwn, checkDocMap };
