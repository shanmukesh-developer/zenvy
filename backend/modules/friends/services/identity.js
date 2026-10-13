/**
 * The ONLY place that turns users into author/identity payloads for Friends responses.
 *  Named:      { userId, name, avatarUrl, campusCode, year?, branch?, verified, badges[], entity? }
 *  Anonymous:  { anonymous: true, alias, isMine? }   (isMine only when the viewer is the author)
 * Never outputs authorId, reporterId, targetOwnerId or a reviewer. scrub() is a last line of defence
 * that removes those keys from any object before it is sent.
 */
const { Op } = require('sequelize');
const { getModel } = require('../index');

const PRIVATE_KEYS = new Set(['authorId', 'reporterId', 'targetOwnerId', 'reviewerId', 'posterPrivateId', 'aliasUserId']);

const avatarFor = (req, user) => {
  try {
    return require('../../campus/campusHelpers').avatarUrlFor(req, user);
  } catch {
    return null;
  }
};

/**
 * Batch-loads named identities for many users at once.
 * @returns {Promise<Map<string, object>>} userId -> identity
 */
const loadIdentities = async (req, userIds, { viewerId } = {}) => {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
  const out = new Map();
  if (!ids.length) return out;
  const User = getModel('User');
  const CampusProfile = getModel('CampusProfile');
  const Campus = getModel('Campus');
  const FriendsSettings = getModel('FriendsSettings');
  const FriendsBadge = getModel('FriendsBadge');
  const FriendsEdge = getModel('FriendsEdge');

  const [users, profiles, settings, badges, follows] = await Promise.all([
    User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name', 'profileImage', 'isActive'] }),
    CampusProfile ? CampusProfile.findAll({ where: { userId: { [Op.in]: ids } }, attributes: ['userId', 'campusId', 'year', 'branch', 'verificationStatus'] }) : [],
    FriendsSettings ? FriendsSettings.findAll({ where: { userId: { [Op.in]: ids } }, attributes: ['userId', 'profileVisibility', 'showYear', 'showBranch'] }) : [],
    FriendsBadge ? FriendsBadge.findAll({ where: { userId: { [Op.in]: ids } }, attributes: ['userId', 'code'] }) : [],
    viewerId && FriendsEdge ? FriendsEdge.findAll({ where: { userId: viewerId, kind: 'follow', targetType: 'user', targetId: { [Op.in]: ids } }, attributes: ['targetId'] }) : [],
  ]);
  const campusIds = [...new Set(profiles.map((p) => p.campusId).filter(Boolean))];
  const campuses = Campus && campusIds.length ? await Campus.findAll({ where: { id: { [Op.in]: campusIds } }, attributes: ['id', 'code'] }) : [];
  const campusCode = new Map(campuses.map((c) => [String(c.id), c.code]));
  const profileOf = new Map(profiles.map((p) => [String(p.userId), p]));
  const settingsOf = new Map(settings.map((s) => [String(s.userId), s]));
  const followed = new Set(follows.map((f) => String(f.targetId)));
  const badgesOf = new Map();
  badges.forEach((b) => {
    const k = String(b.userId);
    if (!badgesOf.has(k)) badgesOf.set(k, []);
    badgesOf.get(k).push(b.code);
  });

  for (const u of users) {
    const id = String(u.id);
    const p = profileOf.get(id);
    const s = settingsOf.get(id);
    const isSelf = viewerId && String(viewerId) === id;
    const visibleToViewer = isSelf || !s || s.profileVisibility !== 'followers' || followed.has(id);
    const identity = {
      userId: id,
      name: u.name || 'Student',
      avatarUrl: avatarFor(req, u),
      campusCode: p && p.campusId ? campusCode.get(String(p.campusId)) || null : null,
      verified: !!p && p.verificationStatus === 'verified',
      badges: (badgesOf.get(id) || []).sort(),
    };
    if (visibleToViewer && p) {
      if (!s || s.showYear !== false) identity.year = p.year || null;
      if (!s || s.showBranch !== false) identity.branch = p.branch || null;
    }
    if (!visibleToViewer) identity.limited = true;
    out.set(id, identity);
  }
  return out;
};

/** Identity of one user (null when the user does not exist). */
const identityOf = async (req, userId, opts) => (await loadIdentities(req, [userId], opts)).get(String(userId)) || null;

const anonymousIdentity = (alias, { isMine } = {}) => (isMine ? { anonymous: true, alias, isMine: true } : { anonymous: true, alias });

/**
 * Author payload for a content row: row.isAnonymous + row.aliasName decide the shape.
 * @param {object} row       must have authorId (read here, never copied out)
 * @param {Map} identities   from loadIdentities
 */
const authorOf = (row, identities, viewerId, entities) => {
  if (row.isAnonymous) return anonymousIdentity(row.aliasName || 'Anonymous', { isMine: !!viewerId && String(row.authorId) === String(viewerId) });
  const base = identities.get(String(row.authorId)) || { userId: null, name: 'Former student', avatarUrl: null, verified: false, badges: [] };
  if (row.entityId && entities && entities.get(String(row.entityId))) return { ...base, entity: entities.get(String(row.entityId)) };
  return base;
};

/** Public shape of a verified entity. */
const entityIdentity = (req, e) => ({
  id: e.id,
  type: e.type,
  name: e.name,
  handle: e.handle,
  avatarUrl: e.avatarUrl ? require('../../campus/campusHelpers').absolutize(req, e.avatarUrl) : null,
  verified: !!e.verified,
});

/** Removes private keys anywhere in a JSON-able value (last line of defence before res.json). */
const scrub = (value) => {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) if (!PRIVATE_KEYS.has(k)) out[k] = scrub(v);
    return out;
  }
  return value;
};

/** True when a payload contains any private key (tests deep-scan responses with this). */
const leaksPrivate = (value) => {
  if (Array.isArray(value)) return value.some(leaksPrivate);
  if (value && typeof value === 'object') return Object.entries(value).some(([k, v]) => PRIVATE_KEYS.has(k) || leaksPrivate(v));
  return false;
};

module.exports = { loadIdentities, identityOf, anonymousIdentity, authorOf, entityIdentity, scrub, leaksPrivate, PRIVATE_KEYS };
