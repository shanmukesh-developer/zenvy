// Admin write paths for "Today on Campus" (mess menu, events) and "The 9 PM Question".
// Read endpoints live in pulseController.js; these let the team publish real content.
const { getDailyQuestionModel, getCampusEventModel, getMessMenuModel } = require('../models');
const realtime = require('../../../utils/realtime');

const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'];
const EVENT_CATEGORIES = ['sports', 'cultural', 'academic', 'general'];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// PUT /api/campus/admin/mess-menu  { menuDate: 'YYYY-MM-DD', meal, items }
// Creates or replaces the menu for that date + meal.
const upsertMessMenu = async (req, res) => {
  try {
    const { menuDate, meal, items } = req.body || {};
    const cleanMeal = String(meal || '').toLowerCase();
    if (!DATE_ONLY.test(String(menuDate || ''))) return res.status(400).json({ message: 'menuDate must be YYYY-MM-DD' });
    if (!MEALS.includes(cleanMeal)) return res.status(400).json({ message: `meal must be one of: ${MEALS.join(', ')}` });
    const text = Array.isArray(items) ? items.map(String).map((x) => x.trim()).filter(Boolean).join(', ') : String(items || '').trim();
    if (!text) return res.status(400).json({ message: 'Add at least one menu item' });

    const MessMenu = getMessMenuModel();
    const existing = await MessMenu.findOne({ where: { menuDate, meal: cleanMeal } });
    const row = existing
      ? await existing.update({ items: text.slice(0, 255) })
      : await MessMenu.create({ menuDate, meal: cleanMeal, items: text.slice(0, 255) });
    realtime.publish('campus', existing ? 'updated' : 'created', row.id, { scope: 'mess_menu' });
    res.status(existing ? 200 : 201).json({ message: 'Mess menu saved', menu: row });
  } catch (err) {
    console.error('[PULSE_ADMIN_MENU_ERR]', err);
    res.status(500).json({ message: 'Could not save the mess menu' });
  }
};

// DELETE /api/campus/admin/mess-menu/:id
const deleteMessMenu = async (req, res) => {
  try {
    const removed = await getMessMenuModel().destroy({ where: { id: req.params.id } });
    if (!removed) return res.status(404).json({ message: 'Menu entry not found' });
    realtime.publish('campus', 'deleted', req.params.id, { scope: 'mess_menu' });
    res.json({ message: 'Menu entry removed' });
  } catch (err) {
    console.error('[PULSE_ADMIN_MENU_DEL_ERR]', err);
    res.status(500).json({ message: 'Could not remove the menu entry' });
  }
};

// GET /api/campus/admin/events — upcoming and recent events
const listEvents = async (req, res) => {
  try {
    const rows = await getCampusEventModel().findAll({ order: [['startsAt', 'DESC']], limit: 100 });
    res.json({ events: rows });
  } catch (err) {
    console.error('[PULSE_ADMIN_EVENTS_ERR]', err);
    res.status(500).json({ message: 'Could not load events' });
  }
};

const eventFields = (body, partial) => {
  const out = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) throw new Error('Event title is required');
    out.title = title.slice(0, 255);
  }
  if (!partial || body.startsAt !== undefined) {
    const startsAt = validDate(body.startsAt);
    if (!startsAt) throw new Error('startsAt must be a valid date-time');
    out.startsAt = startsAt;
  }
  if (body.endsAt !== undefined) out.endsAt = body.endsAt ? validDate(body.endsAt) : null;
  if (body.location !== undefined) out.location = String(body.location || '').trim().slice(0, 255) || null;
  if (body.description !== undefined) out.description = String(body.description || '').trim() || null;
  if (body.category !== undefined) {
    const c = String(body.category || '').toLowerCase();
    out.category = EVENT_CATEGORIES.includes(c) ? c : 'general';
  }
  return out;
};

// POST /api/campus/admin/events  { title, startsAt, endsAt?, location?, category?, description? }
const createEvent = async (req, res) => {
  try {
    let fields;
    try { fields = eventFields(req.body || {}, false); } catch (e) { return res.status(400).json({ message: e.message }); }
    const row = await getCampusEventModel().create(fields);
    realtime.publish('campus', 'created', row.id, { scope: 'event' });
    res.status(201).json({ message: 'Event published', event: row });
  } catch (err) {
    console.error('[PULSE_ADMIN_EVENT_CREATE_ERR]', err);
    res.status(500).json({ message: 'Could not publish the event' });
  }
};

// PUT /api/campus/admin/events/:id
const updateEvent = async (req, res) => {
  try {
    const row = await getCampusEventModel().findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Event not found' });
    let fields;
    try { fields = eventFields(req.body || {}, true); } catch (e) { return res.status(400).json({ message: e.message }); }
    await row.update(fields);
    realtime.publish('campus', 'updated', row.id, { scope: 'event' });
    res.json({ message: 'Event updated', event: row });
  } catch (err) {
    console.error('[PULSE_ADMIN_EVENT_UPDATE_ERR]', err);
    res.status(500).json({ message: 'Could not update the event' });
  }
};

// DELETE /api/campus/admin/events/:id
const deleteEvent = async (req, res) => {
  try {
    const removed = await getCampusEventModel().destroy({ where: { id: req.params.id } });
    if (!removed) return res.status(404).json({ message: 'Event not found' });
    realtime.publish('campus', 'deleted', req.params.id, { scope: 'event' });
    res.json({ message: 'Event removed' });
  } catch (err) {
    console.error('[PULSE_ADMIN_EVENT_DEL_ERR]', err);
    res.status(500).json({ message: 'Could not remove the event' });
  }
};

// PUT /api/campus/admin/daily-question  { promptDate: 'YYYY-MM-DD', question, opensAt?, closesAt? }
// Schedules (or edits) the 9 PM question for a day.
const upsertDailyQuestion = async (req, res) => {
  try {
    const { promptDate, question, opensAt, closesAt } = req.body || {};
    if (!DATE_ONLY.test(String(promptDate || ''))) return res.status(400).json({ message: 'promptDate must be YYYY-MM-DD' });
    const text = String(question || '').trim();
    if (!text) return res.status(400).json({ message: 'Write the question first' });

    const DailyQuestion = getDailyQuestionModel();
    const fields = {
      question: text.slice(0, 255),
      opensAt: opensAt ? validDate(opensAt) : null,
      closesAt: closesAt ? validDate(closesAt) : null,
    };
    const existing = await DailyQuestion.findOne({ where: { promptDate } });
    const row = existing ? await existing.update(fields) : await DailyQuestion.create({ promptDate, ...fields });
    realtime.publish('campus', existing ? 'updated' : 'created', row.id, { scope: 'daily_question' });
    res.status(existing ? 200 : 201).json({ message: 'Question scheduled', question: row });
  } catch (err) {
    console.error('[PULSE_ADMIN_QUESTION_ERR]', err);
    res.status(500).json({ message: 'Could not schedule the question' });
  }
};

module.exports = {
  upsertMessMenu,
  deleteMessMenu,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  upsertDailyQuestion,
};
