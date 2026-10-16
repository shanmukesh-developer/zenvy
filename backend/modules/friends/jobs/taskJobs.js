/**
 * Friends > Tasks background jobs (one process on Render free; every step is a conditional UPDATE, so
 * running twice, or on two instances at once, never double-applies anything).
 *  1. Expiry:       open / assigned tasks whose deadline passed -> expired.
 *  2. Auto-confirm: tasks left in `submitted` for TASK_AUTO_CONFIRM_DAYS (default 7, decision D4)
 *                   -> completed (autoConfirmed:true). Karma and notifications only for the winner.
 *  3. Chat close:   task chats of completed tasks close 7 days after completion (chatClosesAt);
 *                   chats of cancelled / expired tasks are closed (history stays readable).
 * jobs/index.js schedules runOnce on ONE process (utils/jobs.runExclusive, same timing as start(),
 * which is kept for tests / tools); reads also apply the same rules lazily per task, so the API is
 * exact between runs. Disabled when NODE_ENV=test or FRIENDS_TASK_JOBS=off.
 */
const { Op } = require('sequelize');
const { getModel } = require('../index');

const INTERVAL_MS = 5 * 60 * 1000;
const FIRST_RUN_MS = 45 * 1000;
const BATCH = 200;

let timer = null;
let running = null;

const ctl = () => require('../controllers/tasksController')._internal;

const expireDue = async () => {
  const FriendsTask = getModel('FriendsTask');
  const now = new Date();
  const due = await FriendsTask.findAll({
    where: { status: { [Op.in]: ['open', 'assigned'] }, deadlineAt: { [Op.lt]: now } },
    attributes: ['id', 'posterId', 'helperId', 'status'],
    limit: BATCH,
  });
  let expired = 0;
  for (const t of due) {
    if (await ctl().expireOne(t)) {
      expired++;
      ctl().emitTask({ id: t.id, status: 'expired' }, [t.posterId, t.helperId]);
    }
  }
  return expired;
};

const autoConfirmDue = async () => {
  const FriendsTask = getModel('FriendsTask');
  const cutoff = new Date(Date.now() - ctl().autoConfirmDays() * 24 * 60 * 60 * 1000);
  const due = await FriendsTask.findAll({ where: { status: 'submitted', modStatus: 'visible', submittedAt: { [Op.lt]: cutoff } }, limit: BATCH });
  let confirmed = 0;
  for (const t of due) if (await ctl().autoConfirmOne(t)) confirmed++;
  return confirmed;
};

const closeChats = async () => {
  const FriendsTask = getModel('FriendsTask');
  const Conversation = getModel('Conversation');
  const now = new Date();
  // Only tasks whose chat is still open (B26): the closed ones used to fill the 1000-row page
  // forever, so newer chats were never closed.
  const openChats = FriendsTask.sequelize.literal('(SELECT "id" FROM "Conversations" WHERE "closedAt" IS NULL)');
  const rows = await FriendsTask.findAll({
    where: {
      conversationId: { [Op.ne]: null, [Op.in]: openChats },
      [Op.or]: [
        { status: 'completed', chatClosesAt: { [Op.lt]: now } },
        { status: { [Op.in]: ['cancelled', 'expired'] } },
        { modStatus: 'removed' },
      ],
    },
    attributes: ['conversationId'],
    limit: 1000,
  });
  const ids = rows.map((r) => r.conversationId).filter(Boolean);
  if (!ids.length) return 0;
  const [n] = await Conversation.update({ closedAt: now }, { where: { id: { [Op.in]: ids }, closedAt: null } });
  return n;
};

/** One pass of every job. Concurrent calls in this process share one run. */
const runOnce = async () => {
  if (running) return running;
  running = (async () => {
    const stats = { expired: 0, autoConfirmed: 0, chatsClosed: 0 };
    if (!getModel('FriendsTask')) return stats;
    try { stats.expired = await expireDue(); } catch (err) { console.warn('[FRIENDS_TASK_JOB_WARN] expiry:', err.message); }
    try { stats.autoConfirmed = await autoConfirmDue(); } catch (err) { console.warn('[FRIENDS_TASK_JOB_WARN] auto-confirm:', err.message); }
    try { stats.chatsClosed = await closeChats(); } catch (err) { console.warn('[FRIENDS_TASK_JOB_WARN] chat close:', err.message); }
    if (stats.expired || stats.autoConfirmed || stats.chatsClosed) console.log(`[FRIENDS_TASK_JOB] expired ${stats.expired}, auto-confirmed ${stats.autoConfirmed}, chats closed ${stats.chatsClosed}`);
    return stats;
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
};

const start = () => {
  if (timer || process.env.NODE_ENV === 'test' || process.env.FRIENDS_TASK_JOBS === 'off') return false;
  const tick = () => { runOnce().catch(() => {}); };
  const first = setTimeout(() => {
    tick();
    timer = setInterval(tick, INTERVAL_MS);
    if (timer.unref) timer.unref();
  }, FIRST_RUN_MS);
  if (first.unref) first.unref();
  timer = first;
  return true;
};

const stop = () => {
  if (timer) { clearTimeout(timer); clearInterval(timer); }
  timer = null;
};

module.exports = { runOnce, start, stop, expireDue, autoConfirmDue, closeChats };
