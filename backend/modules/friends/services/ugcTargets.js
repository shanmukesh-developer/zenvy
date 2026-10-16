/**
 * C2: report / moderation resolvers for campus content outside Friends (see services/targets.js for the
 * resolver contract). Registered when targets.js loads.
 *
 *   whisper            CampusWhisper       anonymous: the author never leaves the server; admins see it
 *                                          only through the audited reveal-author action.
 *   community_post     CommunityPost       Pulse "Community" feed posts, replies and food reviews
 *   lost_found         CampusLostAndFound  campus lost & found board
 *   proximity_message  ProximityMessage    campus spot (proximity room) chat
 *   group              Conversation        campus group chats (name / description)
 *   poll               CampusPoll          polls inside a chat
 *
 * Hidden / pending_review / removed are kept in FriendsContentState (services/ugc.js) and every list
 * filters on it; the content row itself is kept for the audit trail (reversible on appeal), except that
 * a removed group loses its name / description and stops being discoverable.
 */
const { getModel } = require('../index');
const { register, excerpt } = require('./targets');
const ugc = require('./ugc');

const STATUSES = ['pending_review', 'hidden', 'removed', 'visible'];
const MEDIA_ID_RE = /\/api\/campus\/media\/([0-9a-f-]{36})/i;
const mediaOf = (url) => {
  const m = String(url || '').match(MEDIA_ID_RE);
  return m ? [m[1]] : [];
};

const campusOf = async (userId) => {
  if (!userId) return null;
  const CampusProfile = getModel('CampusProfile');
  if (!CampusProfile) return null;
  const p = await CampusProfile.findOne({ where: { userId: String(userId) }, attributes: ['campusId'] });
  return p && p.campusId ? String(p.campusId) : null;
};

const stateResolver = (type, ownerOf) => ({
  async setStatus(id, status, { transaction } = {}) {
    let ownerId = null;
    try { ownerId = ownerOf ? await ownerOf(id, transaction) : null; } catch { ownerId = null; }
    await ugc.setState(type, id, status, { transaction, ownerId });
    return true;
  },
  async currentState(id) {
    const status = await ugc.stateOf(type, id);
    return { exists: true, status };
  },
});

// ── whisper ─────────────────────────────────────────────────────────────────
register('whisper', {
  statuses: STATUSES,
  ...stateResolver('whisper', async (id, transaction) => {
    const W = getModel('CampusWhisper');
    const w = W ? await W.findByPk(id, { attributes: ['userId'], transaction }) : null;
    return w ? w.userId : null;
  }),
  async load(id) {
    const W = getModel('CampusWhisper');
    const w = W ? await W.findByPk(id) : null;
    if (!w) return null;
    return {
      ownerId: w.userId, // server only: FriendsReport.targetOwnerId is never sent to users
      campusId: await campusOf(w.userId),
      subTab: 'campus',
      snapshot: { excerpt: excerpt(`[${w.topic || 'General'}] ${w.text}`), mediaIds: [], anonymous: true, alias: w.alias, createdAt: w.createdAt },
    };
  },
  async revealAuthor(id) {
    const W = getModel('CampusWhisper');
    const w = W ? await W.findByPk(id, { attributes: ['userId'] }) : null;
    return w ? w.userId : null;
  },
  async currentState(id) {
    const W = getModel('CampusWhisper');
    const w = W ? await W.findByPk(id, { attributes: ['id'] }) : null;
    return w ? { exists: true, status: await ugc.stateOf('whisper', id) } : { exists: false };
  },
});

// ── community_post ──────────────────────────────────────────────────────────
register('community_post', {
  statuses: STATUSES,
  async setStatus(id, status, { transaction } = {}) {
    const P = getModel('CommunityPost');
    const p = P ? await P.findByPk(id, { attributes: ['id', 'userId', 'parentId'], transaction }) : null;
    await ugc.setState('community_post', id, status, { transaction, ownerId: p ? p.userId : null });
    // Open feeds drop it at once (the same event the app already handles for a deleted post).
    if (status !== 'visible' && p) {
      try { require('../../../utils/realtime').broadcast('community_post_deleted', { id: p.id, parentId: p.parentId || null }); } catch { /* optional */ }
    }
    return true;
  },
  async load(id) {
    const P = getModel('CommunityPost');
    const p = P ? await P.findByPk(id) : null;
    if (!p) return null;
    return {
      ownerId: p.userId,
      campusId: await campusOf(p.userId),
      subTab: 'campus',
      snapshot: {
        excerpt: excerpt(`${p.userName || 'Student'}: ${p.content || ''}${p.restaurantName ? ` (review of ${p.restaurantName})` : ''}`),
        mediaIds: mediaOf(p.imageUrl),
        anonymous: false,
        createdAt: p.createdAt,
      },
    };
  },
  async currentState(id) {
    const P = getModel('CommunityPost');
    const p = P ? await P.findByPk(id, { attributes: ['id'] }) : null;
    return p ? { exists: true, status: await ugc.stateOf('community_post', id) } : { exists: false };
  },
});

// ── lost_found ──────────────────────────────────────────────────────────────
register('lost_found', {
  statuses: STATUSES,
  ...stateResolver('lost_found', async (id, transaction) => {
    const L = getModel('CampusLostAndFound');
    const it = L ? await L.findByPk(id, { attributes: ['userId'], transaction }) : null;
    return it ? it.userId : null;
  }),
  async load(id, { viewerId } = {}) {
    const L = getModel('CampusLostAndFound');
    const it = L ? await L.findByPk(id) : null;
    if (!it) return null;
    const campusId = await campusOf(it.userId);
    // The board is campus-only: people of other campuses cannot see (or report) its items.
    if (viewerId && (!campusId || campusId !== (await campusOf(viewerId)))) return null;
    return {
      ownerId: it.userId,
      campusId,
      subTab: 'campus',
      snapshot: {
        excerpt: excerpt(`${String(it.type || '').toUpperCase()}: ${it.title}${it.description ? ` | ${it.description}` : ''} @ ${it.location || ''}`),
        mediaIds: mediaOf(it.imageUrl),
        anonymous: false,
        createdAt: it.createdAt,
      },
    };
  },
});

// ── proximity_message ───────────────────────────────────────────────────────
register('proximity_message', {
  statuses: STATUSES,
  ...stateResolver('proximity_message', async (id, transaction) => {
    const M = getModel('ProximityMessage');
    const m = M ? await M.findByPk(id, { attributes: ['senderId'], transaction }) : null;
    return m ? m.senderId : null;
  }),
  async load(id, { viewerId } = {}) {
    const M = getModel('ProximityMessage');
    const R = getModel('ProximityRoom');
    const m = M ? await M.findByPk(id) : null;
    if (!m) return null;
    const room = R ? await R.findByPk(m.roomId) : null;
    if (viewerId) {
      const { spotVisibleTo } = require('../../campus/controllers/proximityController');
      if (!spotVisibleTo(room, await campusOf(viewerId))) return null;
    }
    return {
      ownerId: m.senderId,
      campusId: (room && room.campusId) || (await campusOf(m.senderId)),
      subTab: 'campus',
      snapshot: { excerpt: excerpt(`${m.senderName || 'Student'} in ${room ? room.name : 'a campus spot'}: ${m.text}`), mediaIds: [], anonymous: false, createdAt: m.createdAt },
    };
  },
});

// ── group ───────────────────────────────────────────────────────────────────
const groupOwner = (c) => {
  const admins = Array.isArray(c.adminIds) ? c.adminIds : [];
  return admins[0] || null;
};
register('group', {
  statuses: STATUSES,
  async setStatus(id, status, { transaction } = {}) {
    const C = getModel('Conversation');
    const c = C ? await C.findByPk(id, { transaction }) : null;
    if (!c || !c.isGroup) return false;
    await ugc.setState('group', id, status, { transaction, ownerId: groupOwner(c) });
    if (status !== 'visible') {
      const S = getModel('CampusGroupSetting');
      if (S) await S.update({ discoverable: false }, { where: { conversationId: id }, transaction });
    }
    if (status === 'removed') {
      // The report snapshot keeps the old name / description for the audit trail.
      c.name = 'Group removed by moderators';
      c.description = '';
      await c.save({ transaction });
    }
    return true;
  },
  async load(id, { viewerId } = {}) {
    const C = getModel('Conversation');
    const c = C ? await C.findByPk(id) : null;
    if (!c || !c.isGroup) return null;
    if (viewerId && !(c.participants || []).includes(viewerId)) {
      // Not a member: only a discoverable group of the viewer's own campus can be reported.
      const S = getModel('CampusGroupSetting');
      const s = S ? await S.findByPk(id) : null;
      if (!s || !s.discoverable || !s.campusId || String(s.campusId) !== (await campusOf(viewerId))) return null;
    }
    const owner = groupOwner(c);
    return {
      ownerId: owner,
      campusId: owner ? await campusOf(owner) : null,
      subTab: 'campus',
      snapshot: { excerpt: excerpt(`Group "${c.name || ''}"${c.description ? ` | ${c.description}` : ''}`), mediaIds: mediaOf(c.groupAvatar), anonymous: false, conversationId: c.id, createdAt: c.createdAt },
    };
  },
  async currentState(id) {
    const C = getModel('Conversation');
    const c = C ? await C.findByPk(id, { attributes: ['id', 'name'] }) : null;
    return c ? { exists: true, name: c.name, status: await ugc.stateOf('group', id) } : { exists: false };
  },
});

// ── poll ────────────────────────────────────────────────────────────────────
register('poll', {
  statuses: STATUSES,
  ...stateResolver('poll', async (id, transaction) => {
    const P = getModel('CampusPoll');
    const p = P ? await P.findByPk(id, { attributes: ['creatorId'], transaction }) : null;
    return p ? p.creatorId : null;
  }),
  async load(id, { viewerId } = {}) {
    const P = getModel('CampusPoll');
    const C = getModel('Conversation');
    const p = P ? await P.findByPk(id) : null;
    if (!p) return null;
    const c = C ? await C.findByPk(p.conversationId) : null;
    if (!c || (viewerId && !(c.participants || []).includes(viewerId))) return null;
    const options = (Array.isArray(p.options) ? p.options : []).map((o) => (o && typeof o === 'object' ? o.text || o.label || '' : String(o))).filter(Boolean);
    return {
      ownerId: p.creatorId,
      campusId: await campusOf(p.creatorId),
      subTab: 'campus',
      snapshot: { excerpt: excerpt(`Poll: ${p.question}${options.length ? ` | ${options.join(' / ')}` : ''}`), mediaIds: [], anonymous: false, conversationId: c.id, createdAt: p.createdAt },
    };
  },
});

module.exports = { STATUSES };
