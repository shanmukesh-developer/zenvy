/**
 * Task chat authorization (Phase 3). Called by guards/index.js conversationGuard for every chat:join,
 * message:send and call:invite on a Conversation with refType 'task' (after the base membership and
 * closedAt checks). It reads the task from the database on every call, so a socket that joined
 * earlier cannot keep sending after the task was cancelled, closed, moderated or a block was added.
 *
 *  - Only the poster and the accepted helper of THIS task, and only through the task's own
 *    conversation (task.conversationId), may use it.
 *  - 'join' (reading history) stays allowed for both of them in every state.
 *  - 'send' / 'call' need an active task (in_progress, submitted, disputed) or a completed task whose
 *    chat window (chatClosesAt, 7 days) is still open, a task not removed / hidden by a moderator,
 *    and no block between the two people.
 * Returns { ok } | { ok:false, code, error }. Never throws (guards/index.js also fails closed).
 */
const { getModel } = require('../index');

const SEND_STATES = ['in_progress', 'submitted', 'disputed'];

const taskGuard = async (conversation, userId, action = 'send') => {
  const FriendsTask = getModel('FriendsTask');
  if (!FriendsTask || !conversation || !conversation.refId) return { ok: false, code: 'CHAT_CLOSED', error: 'This chat is not available.' };
  const task = await FriendsTask.findByPk(conversation.refId, {
    attributes: ['id', 'posterId', 'helperId', 'status', 'modStatus', 'conversationId', 'chatClosesAt'],
  });
  const me = String(userId);
  if (!task || String(task.conversationId || '') !== String(conversation.id)) {
    return { ok: false, code: 'CHAT_CLOSED', error: 'This task chat is not available.' };
  }
  const isPoster = String(task.posterId) === me;
  const isHelper = !!task.helperId && String(task.helperId) === me;
  if (!isPoster && !isHelper) return { ok: false, code: 'NOT_TASK_MEMBER', error: 'Only the poster and the helper can use this chat.' };
  if (action === 'join') return { ok: true };

  if (['removed', 'hidden'].includes(task.modStatus)) {
    return { ok: false, code: 'CHAT_CLOSED', error: 'This task was taken down by a moderator, so its chat is read-only.' };
  }
  const completedOpen = task.status === 'completed' && task.chatClosesAt && new Date(task.chatClosesAt).getTime() > Date.now();
  if (!SEND_STATES.includes(task.status) && !completedOpen) {
    return { ok: false, code: 'CHAT_CLOSED', error: 'This task has ended, so its chat is read-only.' };
  }
  const other = isPoster ? task.helperId : task.posterId;
  try {
    const { isBlockedBetween } = require('../../campus/campusHelpers');
    if (await isBlockedBetween(me, String(other))) return { ok: false, code: 'BLOCKED', error: 'You cannot message this person.' };
  } catch {
    return { ok: false, code: 'NOT_ALLOWED', error: 'You cannot do that in this chat right now.' };
  }
  return { ok: true };
};

module.exports = { taskGuard, SEND_STATES };
