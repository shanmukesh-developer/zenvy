/**
 * Friends > Spaces background jobs (one process on Render free). Every step is a conditional UPDATE,
 * so running twice, or on two instances at once, never double-applies anything.
 *  1. Reminders:  "Remind me" rows with sentAt null for Spaces starting within 10 min (or live) get one
 *                 SPACE_REMINDER push; the row is claimed with UPDATE ... WHERE sentAt IS NULL first,
 *                 so a reminder is never sent twice. Starts missed while the server slept (more than
 *                 10 min ago) are marked skipped 'missed' instead.
 *  2. Expiry:     scheduled Spaces nobody started 60 min after their time -> expired.
 *  3. Abandoned:  rooms this process holds: host gone > 2 min with no co-host -> ended 'host_left';
 *                 nobody present > 5 min -> ended 'empty' (socket/spacesState.sweep).
 *                 Live Spaces with NO room in this process (never joined, or lost in a restart) and no
 *                 activity for 5 min -> ended 'empty', or 'server_restart' when the last activity was
 *                 before this process started.
 * The routes file calls start(); the room sweep runs every 15 s, the database steps every minute.
 * Disabled when NODE_ENV=test or FRIENDS_SPACE_JOBS=off (tests call runOnce / sweep directly).
 */
const { Op } = require('sequelize');
const { getModel } = require('../index');
const S = require('../models/spaces/enums');
const state = require('../socket/spacesState');

const TICK_MS = 15 * 1000;
const DB_EVERY_TICKS = 4;
const FIRST_RUN_MS = 30 * 1000;

let timer = null;
let ticks = 0;
let running = null;

const ctl = () => require('../controllers/spacesController')._internal;

const expireDue = async (now = new Date()) => {
  const FriendsSpace = getModel('FriendsSpace');
  const cutoff = new Date(now.getTime() - S.EXPIRE_AFTER_MINUTES * 60 * 1000);
  const due = await FriendsSpace.findAll({ where: { status: 'scheduled', scheduledFor: { [Op.lt]: cutoff } }, attributes: ['id'], limit: 200 });
  let expired = 0;
  for (const s of due) if (await ctl().finishSpace(s.id, { to: 'expired', from: ['scheduled'], reason: 'expired', notifyHolders: false })) expired++;
  return expired;
};

const endOrphans = async (now = new Date()) => {
  const FriendsSpace = getModel('FriendsSpace');
  const cutoff = new Date(now.getTime() - S.emptyMs());
  const live = await FriendsSpace.findAll({ where: { status: 'live' }, attributes: ['id', 'startedAt', 'lastActiveAt'], limit: 500 });
  let ended = 0;
  for (const s of live) {
    if (state.getRoom(s.id)) continue; // the in-memory sweep owns rooms this process holds
    const last = s.lastActiveAt || s.startedAt;
    if (last && new Date(last) > cutoff) continue;
    const reason = last && new Date(last).getTime() < state.BOOT_AT ? 'server_restart' : 'empty';
    if (await ctl().finishSpace(s.id, { to: 'ended', from: ['live'], reason })) ended++;
  }
  return ended;
};

/** One pass of every job. Concurrent calls in this process share one run. */
const runOnce = async ({ now = new Date() } = {}) => {
  if (running) return running;
  running = (async () => {
    const stats = { reminders: 0, missed: 0, expired: 0, abandoned: 0, orphaned: 0 };
    if (!getModel('FriendsSpace')) return stats;
    try {
      const r = await ctl().sendReminders({ now });
      stats.reminders = r.sent;
      stats.missed = r.missed;
    } catch (err) { console.warn('[FRIENDS_SPACE_JOB_WARN] reminders:', err.message); }
    try { stats.expired = await expireDue(now); } catch (err) { console.warn('[FRIENDS_SPACE_JOB_WARN] expiry:', err.message); }
    try { stats.abandoned = (await state.sweep(now.getTime())).length; } catch (err) { console.warn('[FRIENDS_SPACE_JOB_WARN] sweep:', err.message); }
    try { stats.orphaned = await endOrphans(now); } catch (err) { console.warn('[FRIENDS_SPACE_JOB_WARN] orphans:', err.message); }
    if (stats.reminders || stats.missed || stats.expired || stats.abandoned || stats.orphaned) {
      console.log(`[FRIENDS_SPACE_JOB] reminders ${stats.reminders}, missed ${stats.missed}, expired ${stats.expired}, abandoned ${stats.abandoned}, orphaned ${stats.orphaned}`);
    }
    return stats;
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
};

const start = () => {
  if (timer || process.env.NODE_ENV === 'test' || process.env.FRIENDS_SPACE_JOBS === 'off') return false;
  const tick = () => {
    ticks++;
    if (ticks % DB_EVERY_TICKS === 0) runOnce().catch(() => {});
    else state.sweep().catch(() => {});
  };
  const first = setTimeout(() => {
    runOnce().catch(() => {});
    timer = setInterval(tick, TICK_MS);
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

module.exports = { runOnce, start, stop, expireDue, endOrphans };
