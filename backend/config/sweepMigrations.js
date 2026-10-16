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

    // Rider support tickets (POST /api/delivery/support) set riderId and leave userId NULL. Tickets tables
    // created before that change still have userId NOT NULL (sync() never relaxes a constraint), so every
    // rider ticket failed with a 500. DROP NOT NULL is idempotent and does not rewrite the table.
    try {
      const [rows] = await sequelize.query(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'Tickets' AND column_name = 'userId' LIMIT 1;`
      );
      if (rows && rows[0] && String(rows[0].is_nullable || '').toUpperCase() === 'NO') {
        await step('Tickets.userId nullable', 'ALTER TABLE "Tickets" ALTER COLUMN "userId" DROP NOT NULL;');
        console.log('✅ [SWEEP_MIGRATION] Tickets.userId is now nullable (rider tickets).');
      }
    } catch (err) {
      console.warn('⚠️ [SWEEP_MIGRATION_WARN] Tickets.userId check:', err.message);
    }
  }

  if (sequelize.getDialect() === 'sqlite') {
    // Same rider-ticket fix for SQLite (local / fallback DB): SQLite cannot drop a NOT NULL, so an old
    // Tickets table is rebuilt once with the identical definition minus NOT NULL on userId (rows and
    // indexes kept). Skipped when userId is already nullable.
    try {
      const [cols] = await sequelize.query("PRAGMA table_info('Tickets')");
      const userCol = (cols || []).find((c) => c.name === 'userId');
      if (userCol && Number(userCol.notnull) === 1) {
        const [[tbl]] = await sequelize.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Tickets'");
        const [idx] = await sequelize.query("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'Tickets' AND sql IS NOT NULL");
        const createSql = String((tbl && tbl.sql) || '');
        const relaxed = createSql
          .replace(/^CREATE TABLE\s+[`"]?Tickets[`"]?/i, 'CREATE TABLE `Tickets_rebuild`')
          .replace(/([`"]userId[`"]\s+[A-Z0-9_() ]*?)\s+NOT NULL/i, '$1');
        if (relaxed !== createSql && /Tickets_rebuild/.test(relaxed) && !/[`"]userId[`"][^,]*NOT NULL/i.test(relaxed)) {
          const names = cols.map((c) => `"${c.name}"`).join(', ');
          // Plain statements on the default connection (no Sequelize transaction: SQLite runs those on their
          // own connection, where foreign_keys=OFF would not apply and DROP TABLE would cascade).
          await sequelize.query('PRAGMA foreign_keys=OFF');
          try {
            await sequelize.query('BEGIN IMMEDIATE');
            try {
              await sequelize.query('DROP TABLE IF EXISTS "Tickets_rebuild"');
              await sequelize.query(relaxed);
              await sequelize.query(`INSERT INTO "Tickets_rebuild" (${names}) SELECT ${names} FROM "Tickets"`);
              await sequelize.query('DROP TABLE "Tickets"');
              await sequelize.query('ALTER TABLE "Tickets_rebuild" RENAME TO "Tickets"');
              for (const i of idx || []) await sequelize.query(i.sql);
              await sequelize.query('COMMIT');
            } catch (rebuildErr) {
              await sequelize.query('ROLLBACK').catch(() => {});
              throw rebuildErr;
            }
            console.log('✅ [SWEEP_MIGRATION] SQLite Tickets.userId is now nullable (rider tickets).');
          } finally {
            await sequelize.query('PRAGMA foreign_keys=ON');
          }
        } else {
          console.warn('⚠️ [SWEEP_MIGRATION_WARN] SQLite Tickets.userId: unexpected table definition, left as is.');
        }
      }
    } catch (err) {
      console.warn('⚠️ [SWEEP_MIGRATION_WARN] SQLite Tickets.userId check:', err.message);
    }
  }

  // One row per (user, client key). Partial unique indexes (Postgres and SQLite both support
  // WHERE). If old duplicates exist the index is not built; the routes also guard in code.
  await step('mega_baskets_user_idempotency_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "mega_baskets_user_idempotency_key" ON "MegaBaskets" ("userId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;');
  await step('service_bookings_user_idempotency_key',
    'CREATE UNIQUE INDEX IF NOT EXISTS "service_bookings_user_idempotency_key" ON "ServiceBookings" ("userId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;');

  // Read-path indexes (perf pass). Names follow Sequelize's own convention so a model-declared
  // index of the same columns is recognised as existing. Plain IF NOT EXISTS: no-op once built.
  // • My orders: WHERE "userId" = ? ORDER BY "createdAt" DESC LIMIT 50.
  await step('orders_user_id_created_at',
    'CREATE INDEX IF NOT EXISTS "orders_user_id_created_at" ON "Orders" ("userId", "createdAt");');
  // • Notifications list (declared in the model; created here too in case the table predates it).
  await step('notifications_user_id_created_at',
    'CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at" ON "Notifications" ("userId", "createdAt");');
  // • Unread badge: COUNT(*) WHERE "userId" = ? AND "readAt" IS NULL (polled by the apps).
  await step('notifications_user_unread',
    'CREATE INDEX IF NOT EXISTS "notifications_user_unread" ON "Notifications" ("userId") WHERE "readAt" IS NULL;');
  // • Store menus: WHERE "restaurantId" IN (...) [AND "isAvailable"] for listings and the cart.
  await step('menu_items_restaurant_id',
    'CREATE INDEX IF NOT EXISTS "menu_items_restaurant_id" ON "MenuItems" ("restaurantId");');

  // 2026-10-15 fix hunt (B7): one Friendship row per UNORDERED pair. Expression index (Postgres
  // LEAST/GREATEST, SQLite scalar min/max). If legacy duplicate pairs exist the index is not built
  // and only logs; the app also serialises pair writes (utils/friendshipBlocks withPairLock).
  await step('friendships_unordered_pair', isPg
    ? 'CREATE UNIQUE INDEX IF NOT EXISTS "friendships_unordered_pair" ON "Friendships" (LEAST("requesterId", "recipientId"), GREATEST("requesterId", "recipientId"));'
    : 'CREATE UNIQUE INDEX IF NOT EXISTS "friendships_unordered_pair" ON "Friendships" (min("requesterId", "recipientId"), max("requesterId", "recipientId"));');

  // B15: one community review per (user, delivered order). Partial: posts / legacy reviews have no orderId.
  await step('community_posts_user_order_review',
    'CREATE UNIQUE INDEX IF NOT EXISTS "community_posts_user_order_review" ON "CommunityPosts" ("userId", "orderId") WHERE "orderId" IS NOT NULL;');
  // B25: one product review per (user, product). Not built (only logs) while legacy duplicates exist.
  await step('product_reviews_user_product_unique',
    'CREATE UNIQUE INDEX IF NOT EXISTS "product_reviews_user_product_unique" ON "ProductReviews" ("userId", "productId");');
};

module.exports = { runSweepMigrations };
