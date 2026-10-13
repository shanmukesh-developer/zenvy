// Opaque cursors: base64url of "<createdAt ISO>|<id>" (or "<score>|<id>"), ORDER BY key DESC, id DESC.
const { Op } = require('sequelize');
const { fail, isUuid } = require('./http');

const MAX_PAGE = 30;

const pageSize = (raw, fallback = 20) => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, MAX_PAGE);
};

const encode = (row, field = 'createdAt') => {
  if (!row) return null;
  const v = row[field] instanceof Date ? row[field].toISOString() : String(row[field]);
  return Buffer.from(`${v}|${row.id}`, 'utf8').toString('base64url');
};

/** Returns { value, id } or null; throws 400 BAD_CURSOR on garbage. kind: 'date' | 'number'. */
const decode = (cursor, kind = 'date') => {
  if (cursor === undefined || cursor === null || cursor === '') return null;
  try {
    const raw = Buffer.from(String(cursor), 'base64url').toString('utf8');
    const i = raw.lastIndexOf('|');
    const v = raw.slice(0, i);
    const id = raw.slice(i + 1);
    if (i < 1 || !isUuid(id)) throw new Error('shape');
    if (kind === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error('num');
      return { value: n, id };
    }
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new Error('date');
    return { value: d, id };
  } catch {
    throw fail(400, 'BAD_CURSOR', 'That page link is not valid any more. Pull to refresh.');
  }
};

/** Sequelize condition for "after this cursor" in a (field DESC, id DESC) ordering. */
const after = (cursor, field = 'createdAt', kind = 'date') => {
  const c = decode(cursor, kind);
  if (!c) return null;
  return {
    [Op.or]: [
      { [field]: { [Op.lt]: c.value } },
      { [field]: c.value, id: { [Op.lt]: c.id } },
    ],
  };
};

/** Splits a limit+1 fetch into { items, nextCursor }. */
const page = (rows, limit, field = 'createdAt') => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore && items.length ? encode(items[items.length - 1], field) : null };
};

module.exports = { encode, decode, after, page, pageSize, MAX_PAGE };
