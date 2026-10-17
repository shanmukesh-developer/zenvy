// Concurrency: no overbooking under parallel requests, with and without the in-process queue (the second
// mode proves SQLite IMMEDIATE transactions + the partial unique indexes hold on their own, as they do
// across processes / instances).
// Owner scenarios: #6 race for the final slot, #14 tournament capacity (two captains, one last place).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

const locks = () => H.r('modules/campusEvents/services/locks');

test.before(async () => { await H.setup({ label: 'ce-concurrency' }); await H.setFlag(true); });
test.after(async () => { locks().setInProcessQueue(true); await H.teardown(); });

const raceFinalSlot = async (mode) => {
  locks().setInProcessQueue(mode === 'queue');
  const { event, slots } = await H.mkEvent({ format: 'SLOT', slots: [{ capacity: 1 }], waitlistEnabled: false, title: `Final slot race ${mode}` });
  const users = await Promise.all(Array.from({ length: 12 }, () => H.mkStudent()));
  const res = await Promise.all(users.map((u) => H.register(event.id, u, { slotId: slots[0].id })));
  const won = res.filter((x) => x.status === 201);
  const lost = res.filter((x) => x.status !== 201);
  assert.equal(won.length, 1, `${mode}: exactly one booking for the final slot (${res.map((x) => x.status).join(',')})`);
  assert.ok(lost.every((x) => x.status === 409 && ['SLOT_FULL', 'CONFLICT'].includes(x.body.code)), `${mode}: losers get 409 (${lost.map((x) => x.body.code).join(',')})`);
  assert.deepEqual((await H.checkInvariants(event.id)).problems, []);
  locks().setInProcessQueue(true);
};

test('#6 race for the final slot (with in-process queue)', async () => { await raceFinalSlot('queue'); });
test('#6 race for the final slot (without in-process queue: database guards only)', async () => { await raceFinalSlot('db'); });

const raceTeams = async (mode) => {
  locks().setInProcessQueue(mode === 'queue');
  const { event } = await H.mkEvent({ format: 'TEAM', maxTeams: 1, teamMin: 2, teamMax: 2, waitlistEnabled: false, title: `Last team place ${mode}` });
  const teams = [];
  for (let i = 0; i < 4; i++) {
    const cap = await H.mkStudent();
    const p = await H.mkStudent();
    const t = (await H.api('POST', `/api/campus-events/${event.id}/teams`, cap.token, { name: `Team ${mode} ${i}` })).body.team;
    const inv = await H.api('POST', `/api/campus-events/teams/${t.id}/invitations`, cap.token, { userId: p.id });
    await H.api('POST', `/api/campus-events/team-invitations/${inv.body.invitation.id}/respond`, p.token, { accept: true });
    teams.push({ cap, t });
  }
  const res = await Promise.all(teams.map(({ cap, t }) => H.api('POST', `/api/campus-events/teams/${t.id}/submit`, cap.token, { acceptRules: true, rulesVersion: 1 })));
  const won = res.filter((x) => x.status === 201);
  assert.equal(won.length, 1, `${mode}: one team gets the last place (${res.map((x) => `${x.status}:${x.body && x.body.code}`).join(',')})`);
  assert.ok(res.filter((x) => x.status !== 201).every((x) => x.status === 409));
  assert.equal(await H.ctx.M('CeRegistration').count({ where: { eventId: event.id, status: 'CONFIRMED' } }), 1);
  assert.deepEqual((await H.checkInvariants(event.id)).problems, []);
  locks().setInProcessQueue(true);
};

test('#14 tournament capacity: two+ captains race for the last team place (with queue)', async () => { await raceTeams('queue'); });
test('#14 tournament capacity: race without the in-process queue', async () => { await raceTeams('db'); });

test('#14 tournament capacity: full tournament -> waitlisted team promoted when a team withdraws', async () => {
  const { event } = await H.mkEvent({ format: 'TEAM', maxTeams: 1, teamMin: 1, teamMax: 2, waitlistEnabled: true, title: 'Waitlist Cup' });
  const c1 = await H.mkStudent();
  const c2 = await H.mkStudent();
  const t1 = (await H.api('POST', `/api/campus-events/${event.id}/teams`, c1.token, { name: 'First' })).body.team;
  const t2 = (await H.api('POST', `/api/campus-events/${event.id}/teams`, c2.token, { name: 'Second' })).body.team;
  assert.equal((await H.api('POST', `/api/campus-events/teams/${t1.id}/submit`, c1.token, { acceptRules: true, rulesVersion: 1 })).body.registration.status, 'CONFIRMED');
  const w = await H.api('POST', `/api/campus-events/teams/${t2.id}/submit`, c2.token, { acceptRules: true, rulesVersion: 1 });
  assert.equal(w.body.registration.status, 'WAITLISTED');
  assert.equal(w.body.waitlisted, true);
  await H.api('POST', `/api/campus-events/teams/${t1.id}/cancel`, c1.token);
  const g = await H.ctx.M('CeRegistration').findByPk(w.body.registration.id);
  assert.equal(g.status, 'CONFIRMED');
  assert.equal(await H.ctx.M('CeTicket').count({ where: { registrationId: g.id, kind: 'TEAM', status: 'ACTIVE' } }), 1);
});

test('invariant under random parallel hold / confirm / cancel / register (both modes)', async () => {
  for (const mode of ['queue', 'db']) {
    locks().setInProcessQueue(mode === 'queue');
    const { event, slots } = await H.mkEvent({ format: 'SLOT', maxBookingsPerStudent: 2, waitlistEnabled: true, slots: [{ startOffsetH: 0, capacity: 3 }, { startOffsetH: 1, capacity: 2 }], title: `Invariant ${mode}` });
    const users = await Promise.all(Array.from({ length: 10 }, () => H.mkStudent()));
    let seed = mode === 'queue' ? 7 : 11;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let round = 0; round < 5; round++) {
      const ops = [];
      for (let i = 0; i < 14; i++) {
        const u = users[rnd(users.length)];
        const slot = slots[rnd(slots.length)];
        const kind = rnd(4);
        ops.push((async () => {
          if (kind === 0) return H.api('POST', `/api/campus-events/${event.id}/slots/${slot.id}/hold`, u.token, {});
          if (kind === 1) return H.register(event.id, u, { slotId: slot.id });
          const mine = await H.ctx.M('CeRegistration').findAll({ where: { userId: u.id, eventId: event.id } });
          const pick = mine[rnd(Math.max(1, mine.length))];
          if (!pick) return null;
          if (kind === 2) return H.api('POST', `/api/campus-events/registrations/${pick.id}/confirm`, u.token, { acceptRules: true, rulesVersion: 1 });
          return H.api('POST', `/api/campus-events/registrations/${pick.id}/cancel`, u.token, {});
        })());
      }
      const res = await Promise.all(ops);
      assert.ok(res.every((x) => !x || x.status < 500), `${mode}: no 5xx (${res.filter((x) => x && x.status >= 500).map((x) => JSON.stringify(x.body)).join(' | ')})`);
      if (round === 2) { H.advance(11 * H.MIN); await H.runJobs(); }
      const inv = await H.checkInvariants(event.id);
      assert.deepEqual(inv.problems, [], `${mode} round ${round}`);
    }
    locks().setInProcessQueue(true);
  }
});
