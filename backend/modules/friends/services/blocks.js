// Blocked user ids (either direction) for Friends list queries, cached 30 s per user.
// friendController block/unblock calls clearBlocks() so a block applies at once.
const TTL_MS = 30 * 1000;
const cache = new Map(); // userId -> { at, ids:Set }

const blockedIds = async (userId) => {
  const key = String(userId || '');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ids;
  const { blockedIdsFor } = require('../../campus/campusHelpers');
  const ids = await blockedIdsFor(key);
  if (cache.size > 5000) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), ids });
  return ids;
};

const isBlocked = async (a, b) => (await blockedIds(a)).has(String(b));

// B1: with REDIS_URL set a block / unblock clears the same entries on every instance (utils/cacheBus).
const clearBlocks = require('../../../utils/cacheBus').wrap('friends.blocks', (...userIds) => {
  if (!userIds.length) { cache.clear(); return; }
  userIds.forEach((u) => cache.delete(String(u)));
}, { resync: () => cache.clear() });

module.exports = { blockedIds, isBlocked, clearBlocks };
