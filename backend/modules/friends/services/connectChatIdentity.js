/**
 * Connect chat identity masking (shared chat layer).
 *
 * A Connect chat is an ordinary Conversation (refType 'connect'). The chat layer (REST list/history and
 * the /campus socket) normally carries account ids and real names. For Connect chats every other person
 * must appear only as their Connect profile id plus Connect display name, never their account id, real
 * name or avatar.
 *
 *  identityFor(conversation) -> null (not a Connect chat) | Map<userId, { alias, name }>
 *  maskFor(payload, viewerId, ident) -> deep copy where every account id of someone other than the viewer
 *    (as a value or an object key) becomes that person's alias, and senderName / userName / lastSender
 *    next to such an id becomes their Connect name.
 * Fails closed: if profiles cannot be loaded, other people get a generic alias and name.
 */
const { Op } = require('sequelize');
const { getModel } = require('../index');

const TTL_MS = 30 * 1000;
const cache = new Map(); // conversationId -> { at, ident }

const FALLBACK_NAME = 'Connect user';

const participantsOf = (conversation) => {
  let list = conversation && conversation.participants;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  return Array.isArray(list) ? list.map(String) : [];
};

const identityFor = async (conversation) => {
  if (!conversation || conversation.refType !== 'connect') return null;
  const key = String(conversation.id);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ident;

  const ids = participantsOf(conversation);
  const ident = new Map();
  ids.forEach((id, i) => ident.set(id, { alias: `connect-user-${i + 1}`, name: FALLBACK_NAME }));
  try {
    const Profile = getModel('ConnectProfile');
    if (Profile && ids.length) {
      const rows = await Profile.findAll({ where: { userId: { [Op.in]: ids } }, attributes: ['id', 'userId', 'displayName'] });
      rows.forEach((p) => ident.set(String(p.userId), { alias: String(p.id), name: p.displayName || FALLBACK_NAME }));
    }
  } catch (err) {
    console.warn('[CONNECT_CHAT_IDENTITY_WARN]', err.message);
  }
  cache.set(key, { at: Date.now(), ident });
  if (cache.size > 5000) cache.delete(cache.keys().next().value);
  return ident;
};

const NAME_FOR = { senderId: 'senderName', userId: 'userName', lastSenderId: 'lastSender' };

const maskFor = (payload, viewerId, ident) => {
  if (!ident) return payload;
  const me = viewerId == null ? null : String(viewerId);
  const other = (v) => (typeof v === 'string' || typeof v === 'number') && String(v) !== me && ident.has(String(v));
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v instanceof Date) return v;
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[other(k) ? ident.get(String(k)).alias : k] = walk(val);
      for (const [idKey, nameKey] of Object.entries(NAME_FOR)) {
        if (v[idKey] == null) continue;
        const who = ident.get(String(v[idKey]));
        if (!who) continue;
        if (String(v[idKey]) !== me) out[nameKey] = who.name;
        else if (nameKey in v && nameKey !== 'lastSender') out[nameKey] = who.name;
      }
      return out;
    }
    if (other(v)) return ident.get(String(v)).alias;
    return v;
  };
  return walk(payload);
};

module.exports = { identityFor, maskFor };
