// Shared Friendship-pair helpers (friendController + Friends Connect).
//
// One Friendship row per unordered pair (B7). A block is directional (B5): `blockMeta` holds every
// user currently blocking the other, with where they blocked from (B2):
//   { "<blockerId>": "friends" | "connect" }
// `blockedBy` stays the first remaining blocker so older readers keep working. Rows written before
// blockMeta existed have it null: their only blocker is `blockedBy` (source unknown).
const { Op } = require('sequelize');

const parseMap = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

/** { blockerId: source|null } for a blocked row ({} when the row is not blocked). */
const blockersOf = (row) => {
  if (!row || row.status !== 'blocked') return {};
  const meta = parseMap(row.blockMeta);
  if (Object.keys(meta).length) return meta;
  return row.blockedBy ? { [String(row.blockedBy)]: null } : {};
};

const isBlocker = (row, userId) => Object.prototype.hasOwnProperty.call(blockersOf(row), String(userId));
const blockSourceOf = (row, userId) => blockersOf(row)[String(userId)] || null;

const pairWhere = (a, b) => ({
  [Op.or]: [
    { requesterId: a, recipientId: b },
    { requesterId: b, recipientId: a },
  ],
});

// In-process lock per unordered pair: check-then-create flows (request, block) for the same two
// people run one at a time, so A→B and B→A cannot both insert. The DB pair index (sweepMigrations)
// is the cross-process backstop.
const pairLocks = new Map();
const withPairLock = async (a, b, fn) => {
  const key = [String(a), String(b)].sort().join(':');
  const prev = pairLocks.get(key) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  const chain = prev.then(() => mine);
  pairLocks.set(key, chain);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (pairLocks.get(key) === chain) pairLocks.delete(key);
  }
};

const isUniqueErr = (err) => !!err && (err.name === 'SequelizeUniqueConstraintError'
  || /unique/i.test(String((err.parent && err.parent.message) || err.message || '')));

/** Every row between the pair (legacy data can hold two). Blocked rows first. */
const pairRows = async (Friendship, a, b, opts = {}) => {
  const rows = await Friendship.findAll({ where: pairWhere(a, b), order: [['createdAt', 'ASC']], ...opts });
  const rank = (r) => (r.status === 'blocked' ? 0 : r.status === 'accepted' ? 1 : 2);
  return rows.sort((x, y) => rank(x) - rank(y));
};

/**
 * `me` blocks `other` (source 'friends' | 'connect'). Idempotent; a second blocker is added next to
 * the first (mutual block), and a Connect source is sticky (a later Friends block of the same pair
 * never unmasks the Connect entry). Returns the blocked row.
 */
const applyBlock = async (Friendship, me, other, source = 'friends') => withPairLock(me, other, async () => {
  const m = String(me);
  const rows = await pairRows(Friendship, me, other);
  let row = rows[0] || null;
  if (row) {
    const meta = row.status === 'blocked' ? blockersOf(row) : {};
    const prevSource = meta[m];
    meta[m] = prevSource === 'connect' ? 'connect' : source;
    const firstBlocker = row.status === 'blocked' && row.blockedBy ? row.blockedBy : me;
    await row.update({ status: 'blocked', blockedBy: firstBlocker, blockMeta: JSON.stringify(meta) });
    // Any leftover duplicate rows for the pair are folded into this one.
    for (const extra of rows.slice(1)) await extra.destroy().catch(() => null);
    return row;
  }
  try {
    row = await Friendship.create({ requesterId: me, recipientId: other, status: 'blocked', blockedBy: me, blockMeta: JSON.stringify({ [m]: source }) });
  } catch (err) {
    if (!isUniqueErr(err)) throw err;
    row = (await pairRows(Friendship, me, other))[0];
    if (!row) throw err;
    const meta = row.status === 'blocked' ? blockersOf(row) : {};
    meta[m] = meta[m] === 'connect' ? 'connect' : source;
    await row.update({ status: 'blocked', blockedBy: row.status === 'blocked' && row.blockedBy ? row.blockedBy : me, blockMeta: JSON.stringify(meta) });
  }
  return row;
});

/**
 * `me` lifts their own block on `row`. The other person's block (if any) stays in force. Returns
 * true when the pair is fully unblocked (row deleted).
 */
const liftBlock = async (row, me) => {
  const meta = blockersOf(row);
  delete meta[String(me)];
  const left = Object.keys(meta);
  if (!left.length) {
    await row.destroy();
    return true;
  }
  await row.update({ blockedBy: left[0], blockMeta: JSON.stringify(meta) });
  return false;
};

/** Per-viewer nickname (B6): each side names the other privately. */
const nicknameFor = (row, viewerId) => {
  const map = parseMap(row && row.nicknames);
  const v = map[String(viewerId)];
  return typeof v === 'string' && v ? v : null;
};
const withNickname = (row, viewerId, nickname) => {
  const map = parseMap(row && row.nicknames);
  if (nickname) map[String(viewerId)] = nickname;
  else delete map[String(viewerId)];
  return Object.keys(map).length ? JSON.stringify(map) : null;
};

module.exports = {
  parseMap, blockersOf, isBlocker, blockSourceOf, pairWhere, pairRows, withPairLock, applyBlock, liftBlock,
  nicknameFor, withNickname, isUniqueErr,
};
