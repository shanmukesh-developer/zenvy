/**
 * Zenvy Friends: idempotent, additive-only migrations. Runs after runCampusMigrations on every boot
 * (production and dev). Every statement is wrapped so one failure never blocks startup.
 *
 * Rollback: nothing here alters or drops an existing column. Turn every Friends feature flag off
 * (the API answers FEATURE_OFF), then optionally drop the Friends* / Connect* / Space* tables after an export.
 */
const E = require('../models/foundation/enums');

const PHASES = ['forum', 'pulse', 'tasks', 'connect', 'spaces'];

const quoteList = (values) => values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');

const runFriendsMigrations = async (sequelize) => {
  if (!sequelize) return { ok: 0, warn: 0 };
  const dialect = sequelize.getDialect();
  const isPg = dialect === 'postgres';
  let ok = 0;
  let warn = 0;

  const run = async (label, sql) => {
    try {
      await sequelize.query(sql);
      ok++;
      return true;
    } catch (err) {
      warn++;
      console.warn(`⚠️ [FRIENDS_MIGRATION_WARN] ${label}: ${err.message}`);
      return false;
    }
  };

  // Postgres only; SQLite relies on the model validators.
  // B26: a constraint whose definition changed (e.g. a new enum value) is replaced. Each constraint
  // carries a comment with a hash of its expression; when the hash differs (or a constraint from
  // before this check has none), it is dropped and re-added NOT VALID (new rows are checked, existing
  // rows are never re-validated, so startup cannot fail on legacy data).
  const addCheck = async (table, name, expr) => {
    if (!isPg) return true;
    const sig = require('crypto').createHash('sha1').update(String(expr)).digest('hex').slice(0, 16);
    try {
      const [rows] = await sequelize.query(
        `SELECT obj_description(c.oid, 'pg_constraint') AS sig FROM pg_constraint c WHERE c.conname = :name AND c.conrelid = to_regclass(:tbl)`,
        { replacements: { name, tbl: `"${table}"` } },
      );
      if (rows && rows.length && rows[0].sig === sig) return true;
    } catch (err) {
      console.warn(`⚠️ [FRIENDS_MIGRATION_WARN] check ${name} lookup: ${err.message}`);
      return run(`check ${name}`, `DO $$ BEGIN ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expr}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    }
    return run(`check ${name}`, `DO $$ BEGIN
      ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}";
      ALTER TABLE "${table}" ADD CONSTRAINT "${name}" CHECK (${expr}) NOT VALID;
      COMMENT ON CONSTRAINT "${name}" ON "${table}" IS '${sig}';
    END $$;`);
  };

  // Column adds on SQLite have no IF NOT EXISTS: check first so a re-run is silent.
  const addColumn = async (table, column, sqliteType, pgType) => {
    if (isPg) return run(`${table}.${column}`, `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${pgType};`);
    try {
      const desc = await sequelize.getQueryInterface().describeTable(table);
      if (desc[column]) return true;
    } catch {
      return false; // table missing: nothing to add to
    }
    return run(`${table}.${column}`, `ALTER TABLE "${table}" ADD COLUMN "${column}" ${sqliteType};`);
  };

  const ts = isPg ? 'TIMESTAMP WITH TIME ZONE' : 'DATETIME';
  const uuid = isPg ? 'UUID' : 'UUID';

  // ── Existing tables (nullable) ─────────────────────────────────────────────
  await addColumn('Friendships', 'blockedBy', uuid, 'UUID');
  // Single-direction block rows were always created by the person who blocked.
  await run('Friendships.blockedBy backfill', `UPDATE "Friendships" SET "blockedBy" = "requesterId" WHERE "status" = 'blocked' AND "blockedBy" IS NULL;`);
  await addColumn('Conversations', 'refType', 'VARCHAR(16)', 'VARCHAR(16)');
  await addColumn('Conversations', 'refId', uuid, 'UUID');
  await addColumn('Conversations', 'closedAt', ts, ts);
  await addColumn('CampusProfiles', 'dobLockedAt', ts, ts);
  await run('idx conv_ref', 'CREATE INDEX IF NOT EXISTS "conv_ref" ON "Conversations" ("refType", "refId");');

  // ── Foundation indexes (mirror the model-declared ones, for tables created before an index existed) ──
  const indexes = [
    ['fs_user_uq', true, 'FriendsSettings', '"userId"'],
    ['fc_user', false, 'FriendsConsents', '"userId", "kind"'],
    ['fe_uq', true, 'FriendsEdges', '"userId", "kind", "targetType", "targetId"'],
    ['fe_target', false, 'FriendsEdges', '"targetType", "targetId", "kind"'],
    ['fen_handle_uq', true, 'FriendsEntities', '"campusId", "handle"'],
    ['fr_uq', true, 'FriendsReactions', '"userId", "targetType", "targetId", "kind"'],
    ['fr_target', false, 'FriendsReactions', '"targetType", "targetId", "kind"'],
    ['fk_user_uq', true, 'FriendsKarma', '"userId"'],
    ['fb_uq', true, 'FriendsBadges', '"userId", "code"'],
    ['fal_uq', true, 'FriendsAliases', '"threadKey", "userId"'],
    ['fal_alias_uq', true, 'FriendsAliases', '"threadKey", "alias"'],
    ['frp_dedupe', true, 'FriendsReports', '"reporterId", "targetType", "targetId"'],
    ['frp_queue', false, 'FriendsReports', '"status", "severity", "createdAt"'],
    ['frp_target', false, 'FriendsReports', '"targetType", "targetId"'],
    ['frp_campus', false, 'FriendsReports', '"campusId", "status"'],
    ['fma_target', false, 'FriendsModActions', '"targetType", "targetId"'],
    ['fma_actor', false, 'FriendsModActions', '"actorId", "createdAt"'],
    ['fma_action', false, 'FriendsModActions', '"action", "createdAt"'],
    ['fma_subject', false, 'FriendsModActions', '"subjectUserId", "createdAt"'],
    ['fsn_user', false, 'FriendsSanctions', '"userId", "scope"'],
    ['fap_uq', true, 'FriendsAppeals', '"userId", "actionId"'],
    ['fap_status', false, 'FriendsAppeals', '"status", "createdAt"'],
    ['fcs_target_uq', true, 'FriendsContentStates', '"targetType", "targetId"'],
    ['fcs_status', false, 'FriendsContentStates', '"targetType", "status"'],
  ];
  for (const [name, unique, table, cols] of indexes) {
    await run(`idx ${name}`, `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${name}" ON "${table}" (${cols});`);
  }

  // ── Postgres CHECK constraints ─────────────────────────────────────────────
  await addCheck('FriendsSettings', 'fs_visibility_chk', `"profileVisibility" IN (${quoteList(E.PROFILE_VISIBILITY)})`);
  await addCheck('FriendsEdges', 'fe_kind_chk', `"kind" IN (${quoteList(E.EDGE_KINDS)})`);
  await addCheck('FriendsEdges', 'fe_target_chk', `"targetType" IN (${quoteList(E.EDGE_TARGETS)})`);
  await addCheck('FriendsEntities', 'fen_type_chk', `"type" IN (${quoteList(E.ENTITY_TYPES)})`);
  await addCheck('FriendsEntities', 'fen_status_chk', `"status" IN (${quoteList(E.ENTITY_STATUS)})`);
  await addCheck('FriendsReactions', 'fr_kind_chk', `"kind" IN (${quoteList(E.REACTION_KINDS)})`);
  await addCheck('FriendsReports', 'frp_status_chk', `"status" IN (${quoteList(E.REPORT_STATUS)})`);
  await addCheck('FriendsReports', 'frp_severity_chk', `"severity" IN (${quoteList(E.SEVERITIES)})`);
  await addCheck('FriendsReports', 'frp_category_chk', `"category" IN (${quoteList(E.REPORT_CATEGORIES)})`);
  await addCheck('FriendsReports', 'frp_target_chk', `"targetType" IN (${quoteList(E.REPORT_TARGETS)})`);
  await addCheck('FriendsModActions', 'fma_role_chk', `"actorRole" IN (${quoteList(E.ACTOR_ROLES)})`);
  await addCheck('FriendsSanctions', 'fsn_scope_chk', `"scope" IN (${quoteList(E.SANCTION_SCOPES)})`);
  await addCheck('FriendsContentStates', 'fcs_status_chk', `"status" IN (${quoteList(E.CONTENT_STATES)})`);
  await addCheck('FriendsAppeals', 'fap_status_chk', `"status" IN (${quoteList(E.APPEAL_STATUS)})`);
  await addCheck('FriendsConsents', 'fc_kind_chk', `"kind" IN (${quoteList(E.CONSENT_KINDS)})`);
  await addCheck('FriendsKarma', 'fk_nonneg_chk', '"helpfulAnswers" >= 0 AND "resourcesShared" >= 0 AND "tasksCompleted" >= 0 AND "taskRatingCount" >= 0');
  await addCheck('Conversations', 'conv_reftype_chk', `"refType" IS NULL OR "refType" IN ('task', 'connect')`);

  // ── Per-phase migrations ───────────────────────────────────────────────────
  const helpers = { run, addCheck, addColumn, isPg, dialect, quoteList };
  for (const phase of PHASES) {
    try {
      await require(`./${phase}`).run(sequelize, helpers);
    } catch (err) {
      warn++;
      console.warn(`⚠️ [FRIENDS_MIGRATION_WARN] phase ${phase}: ${err.message}`);
    }
  }

  console.log(`✅ [FRIENDS_MIGRATION] done (${ok} ok, ${warn} warnings).`);
  return { ok, warn };
};

module.exports = { runFriendsMigrations };
