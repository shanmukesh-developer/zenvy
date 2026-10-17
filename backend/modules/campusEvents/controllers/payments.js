// Razorpay webhook: POST /api/campus-events/webhooks/razorpay, mounted in server.js with express.raw on
// this exact path BEFORE the global express.json (the signature is over the raw bytes).
//  1. 503 PAYMENT_NOT_CONFIGURED until the keys are set (Razorpay retries later).
//  2. X-Razorpay-Signature = hex HMAC-SHA256(raw body, RAZORPAY_WEBHOOK_SECRET), compared in constant time;
//     anything else -> 400 and nothing changes.
//  3. De-duplicated by x-razorpay-event-id (unique CeWebhookEvents row): a replay answers 200 duplicate.
//  4. payment.captured / order.paid -> CePayment SUCCESS (amount must match the server price), then in the
//     event lock: PENDING_PAYMENT -> CONFIRMED (or PENDING_APPROVAL) + tickets. A late success (registration
//     already expired / cancelled) takes a free place if there is one, otherwise it is refunded automatically.
//     payment.failed -> CePayment FAILED; the registration stays unconfirmed (paymentStatus FAILED) until its
//     payment window ends.
const crypto = require('crypto');
const { Op } = require('sequelize');
const E = require('../enums');
const { isUniqueError, sendError, money, toPaise } = require('../services/util');
const clock = require('../services/clock');
const cap = require('../services/capacity');
const tickets = require('../services/tickets');
const payments = require('../services/payments');
const outcomes = require('../services/outcomes');
const audit = require('../services/audit');
const notify = require('../services/notify');
const { getModel } = require('../index');

const R = E.REG_STATUS;
const P = E.PAYMENT_STATUS;
const PR = E.PAY_ROW_STATUS;
const N = E.NOTIFY;

const captured = async (entity) => {
  const Pay = getModel('CePayment');
  const orderId = entity && entity.order_id ? String(entity.order_id) : null;
  const paymentId = entity && entity.id ? String(entity.id) : null;
  if (!orderId || !paymentId) return 'ignored:no_ids';
  const pay = await Pay.findOne({ where: { providerOrderId: orderId } });
  if (!pay) return 'ignored:unknown_order';
  if (Number(entity.amount) !== Number(pay.amountPaise)) {
    await pay.update({ failureReason: `amount mismatch ${entity.amount} != ${pay.amountPaise}` });
    console.warn('[CAMPUS_EVENTS_WEBHOOK] amount mismatch for order', orderId);
    return 'rejected:amount_mismatch';
  }
  if ([PR.SUCCESS, PR.REFUND_PENDING, PR.REFUNDED].includes(pay.status)) return 'duplicate:already_captured';
  const reg0 = await getModel('CeRegistration').findByPk(pay.registrationId);
  if (!reg0) return 'ignored:no_registration';
  const out = await cap.inLock(reg0.eventId, async (t, ev) => {
    const [n] = await Pay.update({ status: PR.SUCCESS, providerPaymentId: paymentId, capturedAt: clock.now() }, { where: { id: pay.id, status: { [Op.in]: [PR.CREATED, PR.FAILED] } }, transaction: t });
    if (!n) return { result: 'duplicate:already_captured' };
    const reg = await getModel('CeRegistration').findByPk(pay.registrationId, { transaction: t });
    const paidCols = { paymentStatus: P.SUCCESS, paidAt: clock.now() };
    if (reg.status === R.PENDING_PAYMENT) {
      const status = ev.approvalRequired ? R.PENDING_APPROVAL : R.CONFIRMED;
      await reg.update({ ...paidCols, status, ...(status === R.CONFIRMED ? { confirmedAt: clock.now() } : {}), paymentExpiresAt: null }, { transaction: t });
      if (status === R.CONFIRMED) await tickets.issueFor(reg, ev, t);
      await audit.write({ eventId: ev.id, registrationId: reg.id, action: 'payment.captured', details: { paise: pay.amountPaise } }, t);
      return { result: 'confirmed', reg };
    }
    // Late success: the window ended or the student cancelled.
    const key = reg.capacityKey;
    const slot = reg.slotId ? await getModel('CeSlot').findByPk(reg.slotId, { transaction: t }) : null;
    const dup = await getModel('CeRegistration').findOne({ where: { id: { [Op.ne]: reg.id }, userId: reg.userId, capacityKey: key, teamId: reg.teamId ? reg.teamId : null, status: { [Op.in]: E.OPEN_REG_STATUSES } }, transaction: t });
    const unit = reg.status === R.EXPIRED && !dup && ev.status === E.EVENT_STATUS.PUBLISHED && cap.startOf(ev, slot).getTime() > clock.nowMs()
      ? await cap.lowestFree(key, cap.capacityOf(ev, slot), t) : null;
    if (unit) {
      const status = ev.approvalRequired ? R.PENDING_APPROVAL : R.CONFIRMED;
      await reg.update({ ...paidCols, status, unitNo: unit, expiredAt: null, ...(status === R.CONFIRMED ? { confirmedAt: clock.now() } : {}) }, { transaction: t });
      if (status === R.CONFIRMED) await tickets.issueFor(reg, ev, t);
      if (reg.teamId) await getModel('CeTeam').update({ status: E.TEAM_STATUS.SUBMITTED, registrationId: reg.id }, { where: { id: reg.teamId }, transaction: t });
      await audit.write({ eventId: ev.id, registrationId: reg.id, action: 'payment.captured_late_confirmed', details: { paise: pay.amountPaise } }, t);
      return { result: 'confirmed_late', reg };
    }
    await reg.update({ paymentStatus: P.REFUND_PENDING, refundAmount: money(reg.total), paidAt: clock.now() }, { transaction: t });
    await audit.write({ eventId: ev.id, registrationId: reg.id, action: 'payment.captured_late_refund', details: { paise: pay.amountPaise, status: reg.status } }, t);
    return { result: 'refund_late', reg };
  });
  if (out.reg) {
    if (out.result === 'refund_late') {
      notify.toUsers([out.reg.userId], 'Payment received after the place was released', `We are refunding ₹${money(out.reg.total)} to your payment method.`, { type: N.REFUND_PENDING, registrationId: out.reg.id, eventId: out.reg.eventId });
      outcomes.refundNow(out.reg);
    } else {
      notify.toUsers([out.reg.userId], 'Payment confirmed', `We received ₹${money(out.reg.total)}.`, { type: N.PAYMENT_CONFIRMED, registrationId: out.reg.id, eventId: out.reg.eventId });
      outcomes.registered(out.reg, out.event);
    }
  }
  outcomes.swept(out.swept, out.event);
  return out.result;
};

const failed = async (entity) => {
  const Pay = getModel('CePayment');
  const orderId = entity && entity.order_id ? String(entity.order_id) : null;
  if (!orderId) return 'ignored:no_ids';
  const pay = await Pay.findOne({ where: { providerOrderId: orderId } });
  if (!pay) return 'ignored:unknown_order';
  const [n] = await Pay.update({ status: PR.FAILED, failureReason: String((entity.error_description || entity.error_code || 'failed')).slice(0, 300) }, { where: { id: pay.id, status: PR.CREATED } });
  if (!n) return 'duplicate:not_open';
  const [m] = await getModel('CeRegistration').update({ paymentStatus: P.FAILED }, { where: { id: pay.registrationId, status: R.PENDING_PAYMENT } });
  if (m) {
    const reg = await getModel('CeRegistration').findByPk(pay.registrationId);
    notify.toUsers([reg.userId], 'Payment failed', 'Your payment did not go through. You can try again before the payment time runs out.', { type: N.PAYMENT_FAILED, registrationId: reg.id, eventId: reg.eventId, dedupe: pay.id });
    notify.nudge([reg.userId], 'registration', reg.id, reg.status);
  }
  return 'failed_recorded';
};

/** The raw-body webhook handler (see server.js). */
const razorpayWebhook = async (req, res) => {
  try {
    if (!getModel('CeWebhookEvent')) return res.status(503).json({ code: 'STARTING', message: 'Starting up.' });
    if (!payments.razorpay.keysPresent()) return res.status(503).json({ code: 'PAYMENT_NOT_CONFIGURED', message: 'Online payments are not configured.' });
    const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody : (Buffer.isBuffer(req.body) ? req.body : null);
    if (!raw) return res.status(400).json({ code: 'BAD_BODY', message: 'Raw body required.' });
    if (!payments.razorpay.verifyWebhookSignature(raw, req.get('x-razorpay-signature'))) {
      console.warn('[CAMPUS_EVENTS_WEBHOOK] bad signature');
      return res.status(400).json({ code: 'BAD_SIGNATURE', message: 'Signature check failed.' });
    }
    let body;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ code: 'BAD_BODY', message: 'Body is not JSON.' }); }
    const eventId = String(req.get('x-razorpay-event-id') || '').slice(0, 80) || `sha:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 64)}`;
    const Webhook = getModel('CeWebhookEvent');
    let row;
    try {
      row = await Webhook.create({ provider: 'RAZORPAY', eventId, type: String(body.event || '').slice(0, 60), receivedAt: clock.now() });
    } catch (err) {
      if (isUniqueError(err)) return res.json({ ok: true, duplicate: true });
      throw err;
    }
    const entity = body && body.payload && body.payload.payment && body.payload.payment.entity;
    let result = 'ignored:event_type';
    if (body.event === 'payment.captured' || body.event === 'order.paid') result = await captured(entity);
    else if (body.event === 'payment.failed') result = await failed(entity);
    await row.update({ result: String(result).slice(0, 60) });
    return res.json({ ok: true, result });
  } catch (err) {
    // Not stored as processed: delete the dedupe row so Razorpay's retry can run again.
    try {
      const eventId = String(req.get('x-razorpay-event-id') || '');
      if (eventId) await getModel('CeWebhookEvent').destroy({ where: { provider: 'RAZORPAY', eventId, result: null } });
    } catch { /* retried later */ }
    return sendError(res, err, 'CAMPUS_EVENTS_WEBHOOK');
  }
};

module.exports = { razorpayWebhook, captured, failed, toPaise };
