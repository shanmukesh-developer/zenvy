// Razorpay provider boundary: webhook signature (raw body, constant time), event-id dedupe, late success,
// refunds through the provider, 503 until configured. No network: the HTTP client is stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

test.before(async () => { await H.setup({ label: 'ce-payments' }); await H.setFlag(true); });
test.after(async () => { await H.configureRazorpay(false); await H.teardown(); });

const onlineEvent = (extra = {}) => H.mkEvent({ capacity: 1, priceType: 'PAID', price: 150, paymentModes: ['ONLINE'], waitlistEnabled: false, ...extra });
const startOnline = async (event, user) => {
  const r = await H.register(event.id, user, { paymentMode: 'ONLINE' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const o = await H.api('POST', `/api/campus-events/registrations/${r.body.registration.id}/pay/razorpay-order`, user.token);
  assert.equal(o.status, 200);
  return { regId: r.body.registration.id, orderId: o.body.orderId };
};
const captured = (orderId, paymentId = `pay_${Math.random().toString(36).slice(2, 10)}`, amount = 15000) => ({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, currency: 'INR', status: 'captured' } } } });

test('webhook: 503 PAYMENT_NOT_CONFIGURED without keys; order endpoint 503 too', async () => {
  await H.configureRazorpay(false);
  const w = await H.webhook({ event: 'payment.captured' });
  assert.equal(w.status, 503);
  assert.equal(w.body.code, 'PAYMENT_NOT_CONFIGURED');
  const s = await H.mkStudent();
  const reg = await H.ctx.M('CeRegistration').create({ code: 'EV-TESTAA', eventId: '00000000-0000-4000-8000-000000000001', capacityKey: '00000000-0000-4000-8000-000000000001', userId: s.id, status: 'PENDING_PAYMENT', paymentMode: 'ONLINE' });
  const o = await H.api('POST', `/api/campus-events/registrations/${reg.id}/pay/razorpay-order`, s.token);
  assert.equal(o.status, 503);
  assert.equal(o.body.code, 'PAYMENT_NOT_CONFIGURED');
  await reg.destroy();
});

test('webhook signature: bad / missing / wrong-secret signatures change nothing; valid one confirms', async () => {
  await H.configureRazorpay(true);
  const { event } = await onlineEvent();
  const s = await H.mkStudent();
  const { regId, orderId } = await startOnline(event, s);
  const bad = await H.webhook(captured(orderId), { badSig: true });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'BAD_SIGNATURE');
  const wrong = await H.webhook(captured(orderId), { secret: 'not-the-secret' });
  assert.equal(wrong.status, 400);
  const raw = await fetch(`${H.ctx.base}/api/campus-events/webhooks/razorpay`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(captured(orderId)) });
  assert.equal(raw.status, 400, 'missing signature');
  assert.equal((await H.ctx.M('CeRegistration').findByPk(regId)).status, 'PENDING_PAYMENT');
  const ok = await H.webhook(captured(orderId, 'pay_sig_ok'));
  assert.equal(ok.status, 200);
  assert.equal(ok.body.result, 'confirmed');
  assert.equal((await H.ctx.M('CeRegistration').findByPk(regId)).status, 'CONFIRMED');
  const pay = await H.ctx.M('CePayment').findOne({ where: { registrationId: regId } });
  assert.equal(pay.status, 'SUCCESS');
  assert.equal(pay.providerPaymentId, 'pay_sig_ok');
  for (const k of Object.keys(pay.get({ plain: true }))) assert.ok(!/card|cvv|vpa|bank/i.test(k), `no card data column ${k}`);
});

test('webhook dedupe: same event id twice -> processed once; a second delivery of the same payment under a new id is harmless', async () => {
  await H.configureRazorpay(true);
  const { event } = await onlineEvent();
  const s = await H.mkStudent();
  const { regId, orderId } = await startOnline(event, s);
  const payload = captured(orderId, 'pay_dupe');
  const first = await H.webhook(payload, { eventId: 'evt_dupe_1' });
  const second = await H.webhook(payload, { eventId: 'evt_dupe_1' });
  assert.equal(first.body.result, 'confirmed');
  assert.equal(second.body.duplicate, true);
  const third = await H.webhook(payload, { eventId: 'evt_dupe_2' });
  assert.equal(third.body.result, 'duplicate:already_captured');
  const parallel = await Promise.all([H.webhook(payload, { eventId: 'evt_dupe_3' }), H.webhook(payload, { eventId: 'evt_dupe_3' })]);
  assert.equal(parallel.filter((x) => x.body.duplicate).length, 1);
  assert.equal(await H.ctx.M('CeTicket').count({ where: { registrationId: regId } }), 1, 'one ticket');
  assert.equal(await H.ctx.M('CePayment').count({ where: { registrationId: regId, status: 'SUCCESS' } }), 1);
  assert.equal(await H.ctx.M('CeWebhookEvent').count({ where: { eventId: 'evt_dupe_1' } }), 1);
});

test('late success: payment window over + place taken -> automatic refund; place still free -> confirmed late', async () => {
  await H.configureRazorpay(true);
  const { event } = await onlineEvent();
  const a = await H.mkStudent();
  const b = await H.mkStudent();
  const pa = await startOnline(event, a);
  H.advance(16 * H.MIN);
  await H.runJobs();
  assert.equal((await H.ctx.M('CeRegistration').findByPk(pa.regId)).status, 'EXPIRED');
  const pb = await startOnline(event, b);
  const late = await H.webhook(captured(pa.orderId, 'pay_late_a'));
  assert.equal(late.body.result, 'refund_late');
  await H.idle();
  const ra = await H.ctx.M('CeRegistration').findByPk(pa.regId);
  assert.equal(ra.status, 'EXPIRED');
  assert.equal(ra.paymentStatus, 'REFUNDED');
  assert.ok(H.razorpayCalls.some((c) => /pay_late_a\/refund$/.test(c.url)));
  assert.equal((await H.ctx.M('CeRegistration').findByPk(pb.regId)).status, 'PENDING_PAYMENT', 'the other student keeps the place');
  // Place free: expire b, nobody else -> b's late payment confirms.
  H.advance(16 * H.MIN);
  await H.runJobs();
  const ok = await H.webhook(captured(pb.orderId, 'pay_late_b'));
  assert.equal(ok.body.result, 'confirmed_late');
  assert.equal((await H.ctx.M('CeRegistration').findByPk(pb.regId)).status, 'CONFIRMED');
  assert.deepEqual((await H.checkInvariants(event.id)).problems, []);
});

test('refund retries: provider down -> REFUND_PENDING stays, job retries exactly once when it is back', async () => {
  await H.configureRazorpay(true);
  const { event } = await onlineEvent({ cancellationPolicy: { userCancelUntilHours: 0, refundPct: 100 } });
  const s = await H.mkStudent();
  const { regId, orderId } = await startOnline(event, s);
  await H.webhook(captured(orderId, 'pay_retry'));
  H.setRazorpayFail(true);
  await H.api('POST', `/api/campus-events/registrations/${regId}/cancel`, s.token, {});
  await H.idle();
  let reg = await H.ctx.M('CeRegistration').findByPk(regId);
  assert.equal(reg.paymentStatus, 'REFUND_PENDING');
  assert.ok(reg.refundAttempts >= 1);
  H.setRazorpayFail(false);
  const j = await H.runJobs();
  assert.equal(j.refunds, 1);
  reg = await H.ctx.M('CeRegistration').findByPk(regId);
  assert.equal(reg.paymentStatus, 'REFUNDED');
  const before = H.razorpayCalls.filter((c) => /pay_retry\/refund$/.test(c.url)).length;
  await H.runJobs();
  assert.equal(H.razorpayCalls.filter((c) => /pay_retry\/refund$/.test(c.url)).length, before, 'no second refund call');
  assert.ok((await H.notificationsFor(s.id)).some((n) => n.type === 'CE_REFUND_DONE'));
});
