/**
 * Connect chat authorization (Phase 4). Called by guards/index.js conversationGuard for every chat:join,
 * message:send and call:invite on a Conversation with refType 'connect' (after the base membership and
 * closedAt checks). The match is read from the database on every call, so a socket that joined earlier
 * loses access the moment the match ends, a block is added or a sanction starts.
 *
 *  - Only the two people of an ACTIVE match, through that match's own conversation, may use it.
 *    An ended match (unmatched / blocked / deleted) refuses 'join' too: the chat leaves both views.
 *  - 'call' is always refused (decision D6: no voice or video calls in Connect).
 *  - 'send' also needs: no block either way (a block found here ends the match), no Connect / Friends
 *    sanction, and the per-user message rate limits (connect_message 20/min, connect_message_day 500/day).
 *  - campusSocket message:send passes { text } (4th argument): the text goes through the content policy
 *    plus the Connect explicit / solicitation filter.
 * Returns { ok } | { ok:false, code, error }. Never throws (guards/index.js also fails closed).
 */
const { Op } = require('sequelize');
const { getModel } = require('../index');
const limiter = require('../services/limiter');

const MIN = 60 * 1000;
limiter.define('connect_message', 20, MIN);
limiter.define('connect_message_day', 500, 24 * 60 * MIN);

// Unwanted sexual solicitation / explicit requests. Checked on the content policy's normalised text
// (leetspeak undone) after letters split by separators are joined ("n.u.d.e.s" -> "nudes").
const EXPLICIT_WORDS = ['nudes', 'nude pic', 'nude pics', 'nude photo', 'nude photos', 'sexting', 'sext', 'sex chat', 'onlyfans', 'hookup for cash', 'naked pic', 'naked pics', 'naked photo'];
const EXPLICIT_SQUASHED = ['sendnudes', 'sendnude', 'sendmenudes', 'sendmeanude', 'nudepic', 'sexchat', 'sextme', 'onlyfans'];

const explicitCheck = (text) => {
  try {
    const { normalise, squash } = require('../services/contentPolicy');
    // Runs of 3+ single letters split by separators ("n u d e s", "n.u.d.e.s") are joined into one word.
    const joined = normalise(text)
      .replace(/(^|[^a-z])([a-z](?:[\s.\-_*]+[a-z]){2,})(?=[^a-z]|$)/g, (m, pre, run) => pre + run.replace(/[^a-z]/g, ''))
      .replace(/\s+/g, ' ');
    if (EXPLICIT_WORDS.some((w) => new RegExp(`(^|[^a-z])${w.split(' ').join('\\s+')}([^a-z]|$)`).test(joined))) return true;
    const sq = squash(text);
    return EXPLICIT_SQUASHED.some((w) => sq.includes(w));
  } catch {
    return false;
  }
};

const connectGuard = async (conversation, userId, action = 'send', extra = {}) => {
  const ConnectMatch = getModel('ConnectMatch');
  if (!ConnectMatch || !conversation || !conversation.refId) return { ok: false, code: 'CHAT_CLOSED', error: 'This chat is not available.' };
  if (action === 'call') return { ok: false, code: 'CALLS_DISABLED', error: 'Calls are not available in Connect chats.' };
  const match = await ConnectMatch.findByPk(conversation.refId, {
    attributes: ['id', 'userLowId', 'userHighId', 'status', 'conversationId'],
  });
  const me = String(userId);
  if (!match || String(match.conversationId || '') !== String(conversation.id)) {
    return { ok: false, code: 'CHAT_CLOSED', error: 'This chat is not available.' };
  }
  const isLow = String(match.userLowId) === me;
  const isHigh = String(match.userHighId) === me;
  if (!isLow && !isHigh) return { ok: false, code: 'NOT_MATCHED', error: 'You can only message your matches.' };
  if (match.status !== 'active') return { ok: false, code: 'MATCH_ENDED', error: 'This match has ended.' };
  const other = String(isLow ? match.userHighId : match.userLowId);

  let blocked = false;
  try {
    const { isBlockedBetween } = require('../../campus/campusHelpers');
    blocked = await isBlockedBetween(me, other);
  } catch {
    return { ok: false, code: 'NOT_ALLOWED', error: 'You cannot do that in this chat right now.' };
  }
  if (blocked) {
    // A block made anywhere (Friends, chat, Connect) ends the match for good.
    try {
      const deletion = require('../services/connectDeletion');
      await deletion.endMatch(match.id, { status: 'blocked', by: null });
    } catch { /* the refusal below still applies */ }
    return { ok: false, code: 'BLOCKED', error: 'You cannot message this person.' };
  }
  if (action === 'join') return { ok: true };

  // Sending needs Connect itself to be on and the sender to still pass the Friends gate (verified,
  // same campus, not sanctioned): turning the feature off or revoking verification stops the chat too.
  try {
    const flags = require('../services/featureFlags');
    const eligibility = require('../services/eligibility');
    const [ctx, cfg] = await Promise.all([eligibility.loadContext(me), flags.getConfig()]);
    if (!flags.isEnabled(cfg, 'connect')) return { ok: false, code: 'FEATURE_OFF', error: 'Connect is switched off right now.' };
    eligibility.assertAllowed(ctx, cfg, 'connect');
  } catch (err) {
    return { ok: false, code: (err && err.code) || 'NOT_ALLOWED', error: (err && err.status && err.message) || 'You cannot send Connect messages right now.' };
  }

  const FriendsSanction = getModel('FriendsSanction');
  if (FriendsSanction) {
    const sanction = await FriendsSanction.findOne({
      where: {
        userId: me,
        scope: { [Op.in]: ['friends', 'connect'] },
        liftedAt: null,
        [Op.or]: [{ until: null }, { until: { [Op.gt]: new Date() } }],
      },
      attributes: ['id'],
    });
    if (sanction) return { ok: false, code: 'FRIENDS_SANCTIONED', error: 'You cannot send Connect messages right now.' };
  }

  if (extra && typeof extra.text === 'string' && extra.text.trim()) {
    if (explicitCheck(extra.text)) return { ok: false, code: 'CONTENT_BLOCKED', error: 'That message is not allowed in Connect.' };
    try {
      const { check } = require('../services/contentPolicy');
      const r = check(extra.text, { kind: 'chat' });
      if (r.decision === 'block') return { ok: false, code: 'CONTENT_BLOCKED', error: 'That message is not allowed in Connect.' };
    } catch { /* policy is best effort here */ }
  }

  const burst = limiter.take(me, 'connect_message');
  if (!burst.ok) return { ok: false, code: 'RATE_LIMITED', error: 'You are sending messages too fast. Please slow down.' };
  const day = limiter.take(me, 'connect_message_day');
  if (!day.ok) return { ok: false, code: 'RATE_LIMITED', error: 'You have sent a lot of Connect messages today. Try again tomorrow.' };
  return { ok: true };
};

module.exports = { connectGuard, explicitCheck };
