// scripts/services_laundry_only_v1.js (owner, 24 Nov 2026: launch with Laundry only; PG stays, Rentals, Campus
// events and the non-laundry services paused; Co-Ride kept as it is): the admins' switches go off once, GET
// /api/config/sections reports them off (the app hides those sections), the PG gate answers FEATURE_OFF while Co-Ride
// stays open, and an admin switching one back on is kept by a later start.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const H = require('./helpers');

let base; let server; let script; let sw;
test.before(async () => {
  await H.setup();
  const seq = H.ctx.sequelize;
  const db = require(path.join(H.B, 'config/db.js'));
  db.getSequelize = () => seq;
  const express = require(path.join(H.B, 'node_modules/express'));
  sw = H.r('utils/featureSwitches');
  const app = express();
  app.use('/api/config', H.r('routes/appConfigRoutes'));
  app.post('/gate/pg', sw.requireOn('pgStays'), (req, res) => res.json({ ok: true }));
  app.post('/gate/coride', sw.requireOn('coRide'), (req, res) => res.json({ ok: true }));
  server = await require('../listenFree').listenFree(app);
  base = `http://127.0.0.1:${server.address().port}`;
  script = H.r('scripts/services_laundry_only_v1');
});
test.after(async () => {
  delete process.env.DISABLE_SERVICES_LAUNDRY_ONLY_ONCE;
  if (server) await new Promise((res) => server.close(() => res()));
  await H.teardown();
});

const sections = async () => {
  await H.r('utils/responseCache').invalidate('sections');
  const res = await fetch(`${base}/api/config/sections`);
  return (await res.json()).sections;
};
const marker = () => H.ctx.sequelize.models.GlobalConfig.findOne({ where: { key: script.MARKER } });
const post = async (p) => (await fetch(`${base}${p}`, { method: 'POST' })).status;

test('the env switch keeps it from running', async () => {
  process.env.DISABLE_SERVICES_LAUNDRY_ONLY_ONCE = 'true';
  assert.deepStrictEqual(await script.runLaundryOnlyOnce(), { skipped: 'disabled' });
  delete process.env.DISABLE_SERVICES_LAUNDRY_ONLY_ONCE;
  const s = await sections();
  assert.strictEqual(s.pg.on, true);
  assert.strictEqual(s.services.techServices, true);
  assert.strictEqual(await marker(), null);
});

test('runs once: every paused section reports on:false, laundry stays, the gates refuse', async () => {
  const out = await script.runLaundryOnlyOnce();
  assert.ok(!out.error, JSON.stringify(out));
  assert.strictEqual(out.pgStays, 'switched off');
  assert.strictEqual(out.coRide, undefined, 'Co-Ride is never touched');
  assert.strictEqual(out.autoRide, undefined, 'shared autos are never touched');
  assert.strictEqual(out.techServices, 'switched off');
  assert.strictEqual(out.rentals, 'switched off');
  assert.ok(await marker());
  const s = await sections();
  assert.strictEqual(s.pg.on, false); assert.strictEqual(s.pg.live, false);
  assert.strictEqual(s.coride.on, true, 'Co-Ride stays on');
  assert.strictEqual(s.rentals.on, false); assert.strictEqual(s.rentals.live, false);
  assert.deepStrictEqual(s.events, { live: false, on: false });
  assert.strictEqual(s.services.laundry, true);
  assert.strictEqual(s.services.techServices, false);
  assert.strictEqual(await post('/gate/pg'), 403);
  assert.strictEqual(await post('/gate/coride'), 200);
});

test('an admin switches PG back on: shown at once, and a later start leaves it on', async () => {
  await sw.setOn('pgStays', true);
  const res = await fetch(`${base}/api/config/sections`); // no manual cache drop: setOn clears it
  assert.strictEqual((await res.json()).sections.pg.on, true);
  assert.deepStrictEqual(await script.runLaundryOnlyOnce(), { skipped: 'already done' });
  assert.strictEqual(await sw.isOn('pgStays', { fresh: true }), true);
  assert.strictEqual(await post('/gate/pg'), 200);
  assert.strictEqual(await post('/gate/coride'), 200);
});
