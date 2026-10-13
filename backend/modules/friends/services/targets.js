/**
 * Registry of reportable / moderatable targets. Each phase registers its content types here
 * (post, reply, forum_post, task, space, connect_profile, ...). Phase 0 ships 'profile' and 'message'.
 *
 * resolver = {
 *   load(id, { viewerId }) -> null | { ownerId, campusId, subTab, snapshot: { excerpt, mediaIds, anonymous, alias, createdAt } }
 *        null when the target does not exist OR the viewer may not see it (same 404 either way).
 *   statuses: ['pending_review','hidden','removed','visible']   statuses setStatus supports
 *   setStatus(id, status, { transaction })                       moderation hooks (optional)
 *   revealAuthor(id) -> userId | null                            anonymous content only (optional)
 *   currentState(id) -> object                                   admin detail view (optional)
 * }
 */
const { getModel } = require('../index');

const registry = new Map();

const register = (type, resolver) => { registry.set(type, resolver); };
const get = (type) => registry.get(type) || null;
const has = (type) => registry.has(type);

const excerpt = (text, n = 280) => {
  if (typeof text !== 'string') return '';
  const t = text.trim();
  return t.length > n ? `${t.slice(0, n)}...` : t;
};

// ── profile ─────────────────────────────────────────────────────────────────
register('profile', {
  statuses: [],
  async load(id) {
    const User = getModel('User');
    const user = await User.findByPk(id, { attributes: ['id', 'name', 'createdAt'] });
    if (!user) return null;
    const CampusProfile = getModel('CampusProfile');
    const p = CampusProfile ? await CampusProfile.findOne({ where: { userId: id }, attributes: ['campusId', 'bio'] }) : null;
    return {
      ownerId: user.id,
      campusId: p ? p.campusId : null,
      subTab: 'pulse',
      snapshot: { excerpt: excerpt(`${user.name}${p && p.bio ? ` | ${p.bio}` : ''}`), mediaIds: [], anonymous: false, createdAt: user.createdAt },
    };
  },
  async currentState(id) {
    const User = getModel('User');
    const u = await User.findByPk(id, { attributes: ['id', 'name', 'isActive'] });
    return u ? { exists: true, name: u.name, isActive: u.isActive !== false } : { exists: false };
  },
});

// ── message (campus chat, task chat, Connect chat) ──────────────────────────
const MEDIA_ID_RE = /\/api\/campus\/media\/([0-9a-f-]{36})/i;
register('message', {
  statuses: ['removed', 'hidden', 'visible'],
  async load(id, { viewerId } = {}) {
    const Message = getModel('Message');
    const Conversation = getModel('Conversation');
    const msg = await Message.findByPk(id);
    if (!msg) return null;
    const conv = await Conversation.findByPk(msg.conversationId);
    // Only people in the chat can report a message in it (no reporting by guessed id).
    if (!conv || (viewerId && !(conv.participants || []).includes(viewerId))) return null;
    let text = msg.text;
    try { text = require('../../campus/campusHelpers').readableText(text); } catch { /* keep */ }
    const media = (String(msg.mediaUrl || '').match(MEDIA_ID_RE) || [])[1];
    let campusId = null;
    try {
      const CampusProfile = getModel('CampusProfile');
      const p = CampusProfile ? await CampusProfile.findOne({ where: { userId: msg.senderId }, attributes: ['campusId'] }) : null;
      campusId = p ? p.campusId : null;
    } catch { /* optional */ }
    const subTab = conv.refType === 'task' ? 'tasks' : conv.refType === 'connect' ? 'connect' : 'chat';
    return {
      ownerId: msg.senderId,
      campusId,
      subTab,
      snapshot: {
        excerpt: msg.isDeletedForEveryone ? '[deleted]' : excerpt(text),
        mediaIds: media ? [media] : [],
        anonymous: false,
        conversationId: conv.id,
        createdAt: msg.createdAt,
      },
    };
  },
  async setStatus(id, status, { transaction } = {}) {
    const Message = getModel('Message');
    const msg = await Message.findByPk(id, { transaction });
    if (!msg) return false;
    msg.isDeletedForEveryone = status !== 'visible';
    await msg.save({ transaction });
    return true;
  },
  async currentState(id) {
    const Message = getModel('Message');
    const msg = await Message.findByPk(id, { attributes: ['id', 'isDeletedForEveryone'] });
    return msg ? { exists: true, removed: !!msg.isDeletedForEveryone } : { exists: false };
  },
});

module.exports = { register, get, has, excerpt };
