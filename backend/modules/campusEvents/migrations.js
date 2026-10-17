/**
 * Zenvy Campus Events: idempotent, additive-only migrations (run on every boot, every dialect, after sync()).
 * Named UNIQUE / partial UNIQUE indexes the capacity engine, teams, tickets and payments rely on as race
 * guards underneath the event lock (a second process, a retry or a bug can never double-sell a unit,
 * register a student twice, put one player in two teams, issue two tickets or record two admissions).
 * Partial indexes work on SQLite and Postgres. Every statement is wrapped: a failure logs, never blocks boot.
 *
 * Rollback: nothing here alters or drops data. The feature stays off unless GlobalConfig
 * CAMPUS_EVENTS_ENABLED is true; the Ce* tables can be dropped after an export.
 */
const E = require('./enums');

const inList = (arr) => arr.map((s) => `'${s}'`).join(', ');

const INDEXES = [
  // One live registration per capacity unit (seat / slot place / team place).
  ['ce_reg_unit_live', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_reg_unit_live" ON "CeRegistrations" ("capacityKey", "unitNo") WHERE "status" IN (${inList(E.LIVE_REG_STATUSES)}) AND "unitNo" IS NOT NULL;`],
  // One open (live or waitlisted) individual / slot registration per student per event-or-slot.
  ['ce_reg_user_live', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_reg_user_live" ON "CeRegistrations" ("userId", "capacityKey") WHERE "status" IN (${inList(E.OPEN_REG_STATUSES)}) AND "teamId" IS NULL;`],
  // One open registration per team.
  ['ce_reg_team_live', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_reg_team_live" ON "CeRegistrations" ("teamId") WHERE "status" IN (${inList(E.OPEN_REG_STATUSES)}) AND "teamId" IS NOT NULL;`],
  ['ce_reg_code', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_reg_code" ON "CeRegistrations" ("code");'],
  ['ce_reg_user_idem', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_reg_user_idem" ON "CeRegistrations" ("userId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;'],
  // Teams: one open membership per team per user; one accepted exclusive membership per event per user.
  ['ce_member_team_user_open', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_member_team_user_open" ON "CeTeamMembers" ("teamId", "userId") WHERE "status" IN (${inList(E.OPEN_MEMBER_STATUSES)});`],
  ['ce_member_exclusive', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_member_exclusive" ON "CeTeamMembers" ("exclusiveKey", "userId") WHERE "exclusiveKey" IS NOT NULL;'],
  ['ce_team_event_name', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_team_event_name" ON "CeTeams" ("eventId", "nameKey") WHERE "status" <> '${E.TEAM_STATUS.CANCELLED}';`],
  ['ce_team_join_token', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_team_join_token" ON "CeTeams" ("joinTokenHash") WHERE "joinTokenHash" IS NOT NULL;'],
  // Tickets: unique typed code; one live ticket per holder per registration.
  ['ce_ticket_code', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_ticket_code" ON "CeTickets" ("ticketCode");'],
  ['ce_ticket_holder', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_ticket_holder" ON "CeTickets" ("registrationId", "holderKey") WHERE "status" IN (${inList(E.LIVE_TICKET_STATUSES)});`],
  // Single-use admission: at most one successful CONFIRM per ticket.
  ['ce_checkin_admitted', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_checkin_admitted" ON "CeCheckIns" ("ticketId") WHERE "action" = 'CONFIRM' AND "result" = '${E.CHECKIN_RESULT.VALID}';`],
  // Payments: provider ids unique; at most one successful payment per registration.
  ['ce_pay_provider_payment', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_pay_provider_payment" ON "CePayments" ("providerPaymentId") WHERE "providerPaymentId" IS NOT NULL;'],
  ['ce_pay_provider_order', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_pay_provider_order" ON "CePayments" ("providerOrderId") WHERE "providerOrderId" IS NOT NULL;'],
  ['ce_pay_one_success', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_pay_one_success" ON "CePayments" ("registrationId") WHERE "status" IN ('${E.PAY_ROW_STATUS.SUCCESS}', '${E.PAY_ROW_STATUS.REFUND_PENDING}', '${E.PAY_ROW_STATUS.REFUNDED}');`],
  // Webhook replay guard.
  ['ce_webhook_event', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_webhook_event" ON "CeWebhookEvents" ("provider", "eventId");'],
  // One organizer row per user; one active staff grant per event per user.
  ['ce_organizer_user', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_organizer_user" ON "CeOrganizers" ("userId");'],
  ['ce_staff_event_user', `CREATE UNIQUE INDEX IF NOT EXISTS "ce_staff_event_user" ON "CeEventStaff" ("eventId", "userId") WHERE "status" = '${E.STAFF_STATUS.ACTIVE}';`],
  ['ce_event_slug', 'CREATE UNIQUE INDEX IF NOT EXISTS "ce_event_slug" ON "CeEvents" ("slug") WHERE "slug" IS NOT NULL;'],
  // Plain lookups.
  ['ce_reg_team', 'CREATE INDEX IF NOT EXISTS "ce_reg_team" ON "CeRegistrations" ("teamId");'],
  ['ce_reg_expiry', 'CREATE INDEX IF NOT EXISTS "ce_reg_expiry" ON "CeRegistrations" ("status", "holdExpiresAt");'],
];

const runCampusEventsMigrations = async (sequelize) => {
  if (!sequelize) return { ok: 0, warn: 0 };
  let ok = 0;
  let warn = 0;
  for (const [label, sql] of INDEXES) {
    try {
      await sequelize.query(sql);
      ok++;
    } catch (err) {
      warn++;
      console.warn(`⚠️ [CAMPUS_EVENTS_MIGRATION_WARN] ${label}: ${err.message}`);
    }
  }
  if (warn === 0) console.log(`✅ [CAMPUS_EVENTS_MIGRATION] ${ok} index checks ok.`);
  return { ok, warn };
};

module.exports = { runCampusEventsMigrations, INDEXES };
