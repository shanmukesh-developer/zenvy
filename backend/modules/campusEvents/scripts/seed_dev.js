// DEV-ONLY Campus Events fixtures for building the apps locally: makes an existing local user an ACTIVE
// organizer and creates three clearly labelled "DEV" published events (free individual workshop, slot
// activity with pay at venue, team tournament) on that user's campus, and turns CAMPUS_EVENTS_ENABLED on.
// Refused on production (utils/seedGuard: NODE_ENV=production, RENDER, or a Postgres DATABASE_URL) and on
// any non-SQLite database. Nothing it creates can pass for real data (every title starts with "DEV").
//   node modules/campusEvents/scripts/seed_dev.js <organizerUserId>
const { seedAllowed } = require('../../../utils/seedGuard');

const main = async () => {
  if (!seedAllowed('modules/campusEvents/scripts/seed_dev.js')) process.exit(1);
  require('dotenv').config();
  const { connectDB, getSequelize } = require('../../../config/db');
  await connectDB();
  const db = getSequelize();
  if (db.getDialect() !== 'sqlite') { console.error('Refusing: dev seed runs on the local SQLite database only.'); process.exit(1); }
  const M = (n) => db.models[n];
  const userId = process.argv[2];
  const user = userId ? await M('User').findByPk(userId) : null;
  if (!user) { console.error('Usage: node modules/campusEvents/scripts/seed_dev.js <existing local user id>'); process.exit(1); }
  const profile = await M('CampusProfile').findOne({ where: { userId } });
  if (!profile || !profile.campusId) { console.error('That user has no campus profile: verify the account locally first.'); process.exit(1); }
  const [org] = await M('CeOrganizer').findOrCreate({ where: { userId }, defaults: { campusId: profile.campusId, displayName: 'DEV Organizer', status: 'ACTIVE', grantedAt: new Date() } });
  await org.update({ status: 'ACTIVE' });
  const day = 24 * 60 * 60 * 1000;
  const t0 = Date.now() + 3 * day;
  const base = { campusId: profile.campusId, organizerUserId: userId, organizerId: org.id, status: 'PUBLISHED', publishedAt: new Date(), venue: 'DEV Venue (fixture)', description: 'DEV fixture event for local app development. Not real.', regOpensAt: new Date(), regClosesAt: new Date(t0 - 60 * 60 * 1000) };
  const mk = async (title, extra) => {
    const existing = await M('CeEvent').findOne({ where: { title } });
    return existing || M('CeEvent').create({ ...base, title, startAt: new Date(t0), endAt: new Date(t0 + 3 * 60 * 60 * 1000), ...extra });
  };
  await mk('DEV Free Workshop', { category: 'WORKSHOP', format: 'INDIVIDUAL', capacity: 30, priceType: 'FREE' });
  const slotEv = await mk('DEV Drone Soccer Slots', { category: 'RECREATION', format: 'SLOT', priceType: 'PAID', price: 50, paymentModes: ['VENUE'], maxBookingsPerStudent: 2 });
  if (!(await M('CeSlot').count({ where: { eventId: slotEv.id } }))) {
    for (let i = 0; i < 3; i++) await M('CeSlot').create({ eventId: slotEv.id, label: `DEV slot ${i + 1}`, startAt: new Date(t0 + i * 60 * 60 * 1000), endAt: new Date(t0 + (i + 1) * 60 * 60 * 1000), capacity: 4, status: 'OPEN' });
  }
  await mk('DEV Cricket Cup', { category: 'TOURNAMENT', format: 'TEAM', maxTeams: 4, teamMin: 2, teamMax: 11, priceType: 'FREE' });
  await require('../services/flag').writeFlag(true);
  console.log('Campus Events DEV fixtures ready.');
  await db.close();
};

main().catch((err) => { console.error(err); process.exit(1); });
