/**
 * conversationGuard(conversation, userId, action) -> { ok: true } | { ok: false, code, error }
 * Called by campusSocket for chat:join ('join'), message:send ('send') and call:invite ('call'),
 * AFTER the normal membership check. Plain chats (refType null) are unaffected.
 *  - A closed conversation (closedAt set) refuses 'send' and 'call' (history stays readable).
 *  - refType 'task' / 'connect' dispatch to their phase guards.
 * Never throws: an unexpected error refuses the action (fail closed for linked chats only).
 */
const { taskGuard } = require('./taskGuard');
const { connectGuard } = require('./connectGuard');

const GUARDS = { task: taskGuard, connect: connectGuard };

const conversationGuard = async (conversation, userId, action = 'send') => {
  if (!conversation) return { ok: false, code: 'NOT_FOUND', error: 'Conversation not found' };
  const refType = conversation.refType || null;
  try {
    if (conversation.closedAt && action !== 'join') {
      return { ok: false, code: 'CHAT_CLOSED', error: 'This chat is closed.' };
    }
    const guard = refType ? GUARDS[refType] : null;
    if (refType && !guard) return { ok: false, code: 'CHAT_CLOSED', error: 'This chat is not available.' };
    if (!guard) return { ok: true };
    const r = await guard(conversation, userId, action);
    return r && r.ok ? { ok: true } : { ok: false, code: (r && r.code) || 'NOT_ALLOWED', error: (r && r.error) || 'You cannot do that in this chat.' };
  } catch (err) {
    console.warn('[FRIENDS_CONV_GUARD_WARN]', refType, action, err.message);
    return refType || conversation.closedAt ? { ok: false, code: 'NOT_ALLOWED', error: 'You cannot do that in this chat right now.' } : { ok: true };
  }
};

module.exports = { conversationGuard };
