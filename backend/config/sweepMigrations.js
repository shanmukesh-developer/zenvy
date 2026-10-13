// Small idempotent schema fixes from the 2026-10-13 sweep follow-ups, run once per boot after
// connectDB(). Kept out of config/db.js on purpose (that file is owned by the Friends Phase 0 work).
// New nullable columns (DeliveryPartners.sosAt / sosLocation, MegaBaskets.idempotencyKey,
// ServiceBookings.idempotencyKey, Users.lastGiftKey) are added by db.js addMissingColumns from the
// models; this file only does what addMissingColumns cannot: type widening and indexes.
const runSweepMigrations = async (sequelize) => {
  if (!sequelize) return;
  const isPg = sequelize.getDialect() === 'postgres';
  const step = async (label, sql) => {
    try {
      await sequelize.query(sql);
    } catch (err) {
      console.warn(`⚠️ [SWEEP_MIGRATION_WARN] ${label}:`, err.message);
    }
  };

  if (isPg) {
    // admin-2: audit details were VARCHAR(255); long JSON details failed to insert and the audit
    // row was lost. VARCHAR -> TEXT is binary-compatible in Postgres (no table rewrite). Skipped
    // when it is already TEXT.
    try {
      const [rows] = await sequelize.query(
        `SELECT data_type FROM information_schema.columns WHERE table_name = 'VerificationLogs' AND column_name = 'details' LIMIT 1;`
      );
      const type = rows && rows[0] && String(rows[0].data_type || '').toLowerCase();
      if (type && type !== 'text') {
        await step('VerificationLogs.details TEXT', 'ALTER TABLE "VerificationLogs" ALTER COLUMN "details" TYPE TEXT;');
        console.log('✅ [SWEEP_MIGRATION] VerificationLogs.details widened to TEXT.');
      }
    } catch (err) {
      console.warn('⚠️ [SWEEP_MIGRATION_WARN] VerificationLogs.details check:', err.message);
    }
  }

  // One row per (user, client key). Partial unique indexes (Postgres and SQLite both support
  // WHERE). If old duplicates exist the index is not built; the routes also guard in code.
  await step('mega_baskets_user_idempotency_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "mega_baskets_user_idempotency_key" ON "MegaBaskets" ("userId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;');
  await step('service_bookings_user_idempotency_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "service_bookings_user_idempotency_key" ON "ServiceBookings" ("userId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;');
};

module.exports = { runSweepMigrations };
