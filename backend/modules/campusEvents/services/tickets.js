// Tickets: issued ONLY for CONFIRMED registrations, inside the same transaction as the confirmation.
//  QR token  ZE1.<ticketId>.<tokenVersion>.<HMAC-SHA256(secret, "ZE1.<id>.<ver>") base64url>   (no PII)
//  ticketCode 10-char Crockford base32 for typing at the gate (unique index ce_ticket_code).
//  Kinds: INDIVIDUAL / SLOT (one per registration), TEAM (one per team, holder = captain, shown to every
//  accepted member) or MEMBER (one per accepted member when the event takes attendance per member).
//  void / reissue: reissue bumps tokenVersion and the code, so an old QR / code stops working at once.
// Secret: CAMPUS_EVENTS_TICKET_SECRET. Required in production: without it tickets are not issued
// (503 TICKETS_NOT_CONFIGURED, logged once) and the server still boots. Dev / test: random per process.
const crypto = require('crypto');
const { Op } = require('sequelize');
const { getModel } = require('../index');
const E = require('../enums');
const { fail, newTicketCode, isUniqueError, safeEqual } = require('./util');
const { isProduction } = require('../../../utils/env');

const PREFIX = 'ZE1';
let devSecret = null;
let warned = false;

const secret = () => {
  const s = String(process.env.CAMPUS_EVENTS_TICKET_SECRET || '').trim();
  if (s.length >= 16) return s;
  if (isProduction()) {
    if (!warned) {
      warned = true;
      console.error('🛑 [CAMPUS_EVENTS_TICKETS] CAMPUS_EVENTS_TICKET_SECRET is missing (or shorter than 16 chars) in production: tickets will not be issued until it is set on Render.');
    }
    return null;
  }
  if (!devSecret) devSecret = crypto.randomBytes(32).toString('hex');
  return devSecret;
};
const configured = () => !!secret();
const assertConfigured = () => {
  if (!configured()) throw fail(503, 'TICKETS_NOT_CONFIGURED', 'Tickets are not available right now. Please try again later.');
};

const mac = (id, ver) => crypto.createHmac('sha256', secret()).update(`${PREFIX}.${id}.${ver}`).digest('base64url');
const tokenFor = (ticket) => (configured() ? `${PREFIX}.${ticket.id}.${ticket.tokenVersion}.${mac(ticket.id, ticket.tokenVersion)}` : null);

const TOKEN_RE = /^ZE1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(\d{1,6})\.([A-Za-z0-9_-]{20,64})$/i;
/** { id, ver } when the token's signature is valid, else null (constant-time compare). */
const parseToken = (token) => {
  if (typeof token !== 'string' || token.length > 200) return null;
  const m = TOKEN_RE.exec(token.trim());
  if (!m || !configured()) return null;
  const id = m[1].toLowerCase();
  const ver = Number(m[2]);
  return safeEqual(mac(id, ver), m[3]) ? { id, ver } : null;
};

const uniqueCode = async (t) => {
  const Ticket = getModel('CeTicket');
  for (let i = 0; i < 6; i++) {
    const code = newTicketCode();
    if (!(await Ticket.findOne({ where: { ticketCode: code }, attributes: ['id'], transaction: t }))) return code;
  }
  return newTicketCode();
};

/** Desired tickets for a confirmed registration. */
const plan = async (reg, event, t) => {
  if (reg.type === E.REG_TYPE.TEAM) {
    const out = [{ kind: E.TICKET_KIND.TEAM, holderKey: 'TEAM', userId: reg.userId, memberId: null }];
    if (event.attendancePerMember) {
      const members = await getModel('CeTeamMember').findAll({ where: { teamId: reg.teamId, status: E.MEMBER_STATUS.ACCEPTED }, transaction: t });
      for (const m of members) out.push({ kind: E.TICKET_KIND.MEMBER, holderKey: String(m.userId), userId: m.userId, memberId: m.id });
    }
    return out;
  }
  return [{ kind: reg.slotId ? E.TICKET_KIND.SLOT : E.TICKET_KIND.INDIVIDUAL, holderKey: String(reg.userId), userId: reg.userId, memberId: null }];
};

/** Creates any missing live tickets for a CONFIRMED registration (idempotent). Returns created rows. */
const issueFor = async (reg, event, t) => {
  if (reg.status !== E.REG_STATUS.CONFIRMED) return [];
  assertConfigured();
  const Ticket = getModel('CeTicket');
  const existing = await Ticket.findAll({ where: { registrationId: reg.id, status: { [Op.in]: E.LIVE_TICKET_STATUSES } }, transaction: t });
  const have = new Set(existing.map((x) => x.holderKey));
  const created = [];
  for (const p of await plan(reg, event, t)) {
    if (have.has(p.holderKey)) continue;
    try {
      created.push(await Ticket.create({
        eventId: reg.eventId, registrationId: reg.id, slotId: reg.slotId || null, teamId: reg.teamId || null, memberId: p.memberId,
        userId: p.userId, holderKey: p.holderKey, kind: p.kind, ticketCode: await uniqueCode(t), tokenVersion: 1, status: E.TICKET_STATUS.ACTIVE,
      }, { transaction: t }));
    } catch (err) {
      if (!isUniqueError(err)) throw err;
      const e = new Error('ticket race'); e.code = 'CE_RETRY'; throw e;
    }
  }
  return created;
};

/** Cancels every ACTIVE ticket of a registration (USED tickets stay as history). */
const cancelFor = async (regId, t, { status = E.TICKET_STATUS.CANCELLED, reason = null, holderKey } = {}) => {
  const where = { registrationId: regId, status: E.TICKET_STATUS.ACTIVE };
  if (holderKey) where.holderKey = String(holderKey);
  const [n] = await getModel('CeTicket').update({ status, voidReason: reason ? String(reason).slice(0, 300) : null }, { where, transaction: t });
  return n;
};

/** Reissue: new tokenVersion + new code (old QR / code dead). USED tickets cannot be reissued. */
const reissue = async (ticket, t) => {
  if (ticket.status === E.TICKET_STATUS.USED) throw fail(409, 'TICKET_USED', 'This ticket was already used at entry.');
  assertConfigured();
  const reg = await getModel('CeRegistration').findByPk(ticket.registrationId, { transaction: t });
  if (!reg || reg.status !== E.REG_STATUS.CONFIRMED) throw fail(409, 'NOT_CONFIRMED', 'Only tickets of confirmed registrations can be reissued.');
  await ticket.update({ tokenVersion: (Number(ticket.tokenVersion) || 1) + 1, ticketCode: await uniqueCode(t), status: E.TICKET_STATUS.ACTIVE, voidReason: null }, { transaction: t });
  return ticket;
};

module.exports = { secret, configured, assertConfigured, tokenFor, parseToken, issueFor, cancelFor, reissue, PREFIX, _resetWarn: () => { warned = false; } };
