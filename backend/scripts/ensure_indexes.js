// A4: hot-path indexes, built in the background after the server is ready (never delays startup or
// /readyz). Every index below matches a real, frequent query (see `why`); indexes that models or the
// boot migrations already declare are not repeated here.
//
//  - Postgres: CREATE INDEX CONCURRENTLY IF NOT EXISTS, one statement at a time, outside any
//    transaction (CONCURRENTLY never blocks reads or writes on the table), on a dedicated short-lived
//    connection (not from the app pool) whose startup options set its own timeouts:
//      statement_timeout = ENSURE_INDEXES_STATEMENT_TIMEOUT_MS (default 10 min per index)
//      lock_timeout      = ENSURE_INDEXES_LOCK_TIMEOUT_MS      (default 10 s)
//    The app pool's 30 s statement_timeout therefore never kills a build, and no session SET is ever
//    issued on a pooled connection. A failed CONCURRENTLY build leaves an INVALID index behind: it is
//    dropped (DROP INDEX CONCURRENTLY IF EXISTS) right away when possible, and any INVALID index with one
//    of these names found at the start of a run is dropped and built again (one attempt per boot).
//  - Exactly one process runs it (utils/jobs.runExclusive advisory lock, name 'db.ensureIndexes').
//  - An index is "existed" when a valid index of that name exists, or a valid index on the same table
//    with exactly the same columns (any name, e.g. one Sequelize created) - nothing is duplicated.
//  - A table or column that does not exist (feature/module not deployed) is skipped, never an error.
//  - SQLite (local dev / tests): plain CREATE INDEX IF NOT EXISTS on the app connection.
//  - ENSURE_INDEXES=false disables it. Never throws: every outcome is logged in one summary line
//    "[ENSURE_INDEXES] created=N existed=N skipped=N failed=N".
//
// Table / column names come from the Sequelize models (getTableName(), rawAttributes[x].field), so
// custom tableName settings are honoured (no model in this repo is `underscored`).
const DEFAULT_DELAY_MS = 5000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_LOCK_TIMEOUT_MS = 10 * 1000;
const JOB_NAME = 'db.ensureIndexes';
const JOB_TIMEOUT_MS = 60 * 60 * 1000;

// { name, model, columns: [attribute names], where?: (q) => SQL using q(attr) for quoted columns, why }
const INDEXES = [
  {
    name: 'orders_delivery_partner_id_status', model: 'Order', columns: ['deliveryPartnerId', 'status'],
    why: 'rider active orders (claim cap, dispatch ranking, admin assign: deliveryPartnerId = ? AND status NOT IN (...)), rider history / earnings / completed counts (deliveryPartnerId = ? AND status = \'Delivered\')',
  },
  {
    name: 'orders_status_created_at', model: 'Order', columns: ['status', 'createdAt'],
    why: 'rider available list (status IN claimable AND deliveryPartnerId IS NULL ORDER BY createdAt DESC LIMIT 100), auto-cancel job (status = \'Pending\' AND createdAt < cutoff), stuck-stall job, admin order list / finance pages (status = ? ORDER BY createdAt DESC)',
  },
  {
    name: 'messages_conversation_id_created_at', model: 'Message', columns: ['conversationId', 'createdAt'],
    why: 'chat history pagination (conversationId = ? [AND createdAt < cursor] ORDER BY createdAt DESC), chat list last message + unread count per chat, read receipts',
  },
  {
    name: 'messages_created_at', model: 'Message', columns: ['createdAt'],
    why: 'chat retention purge (createdAt < cutoff ORDER BY createdAt LIMIT batch), ephemeral purge (createdAt < 30 days)',
  },
  {
    name: 'messages_expires_at', model: 'Message', columns: ['expiresAt'], where: (q) => `${q('expiresAt')} IS NOT NULL`,
    why: 'ephemeral purge (expiresAt < now), partial: most messages never expire',
  },
  {
    name: 'proximity_messages_room_id_created_at', model: 'ProximityMessage', columns: ['roomId', 'createdAt'],
    why: 'campus spot room feed (roomId = ? AND createdAt >= since ORDER BY createdAt DESC)',
  },
  {
    name: 'proximity_messages_created_at', model: 'ProximityMessage', columns: ['createdAt'],
    why: 'spot message retention purge (createdAt < cutoff ORDER BY createdAt LIMIT batch)',
  },
  {
    name: 'proximity_messages_expires_at', model: 'ProximityMessage', columns: ['expiresAt'],
    why: 'spot message retention purge (OR expiresAt < now)',
  },
  {
    name: 'community_posts_parent_id_created_at', model: 'CommunityPost', columns: ['parentId', 'createdAt'],
    why: 'community feed (parentId IS NULL ORDER BY createdAt DESC LIMIT 50), replies (parentId IN (...) ORDER BY createdAt)',
  },
  {
    name: 'coupons_user_id_is_used', model: 'Coupon', columns: ['userId', 'isUsed'],
    why: 'my coupons / checkout coupon list (userId = ? AND isUsed = false)',
  },
  {
    name: 'room_participants_user_id', model: 'RoomParticipant', columns: ['userId'],
    why: 'my rooms (userId = ? AND kickedAt IS NULL); the (roomId, userId) unique index does not serve userId alone',
  },
  {
    name: 'pool_requests_passenger_id', model: 'PoolRequest', columns: ['passengerId'],
    why: 'my ride requests (passengerId = ?); the (poolId, passengerId) unique index does not serve passengerId alone',
  },
  {
    name: 'campus_verifications_user_id_type', model: 'CampusVerification', columns: ['userId', 'type'],
    why: 'college email OTP / ID card verification lookups and the per-user OTP rate limit (userId = ? AND type = ?)',
  },
  {
    name: 'campus_verifications_college_email_type', model: 'CampusVerification', columns: ['collegeEmail', 'type'],
    why: 'per-email OTP rate limit (collegeEmail = ? AND type = \'email_otp\' AND createdAt > dayAgo)',
  },
  {
    name: 'users_role', model: 'User', columns: ['role'],
    why: 'admin alert fan-out (role = \'admin\' AND isActive) on rider SOS, stuck stall orders, PG requests',
  },
];

const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;
const tableNameOf = (model) => {
  const t = model.getTableName();
  return typeof t === 'string' ? t : (t && t.tableName) || String(t);
};

const isDisabled = (env = process.env) => /^(false|0|off|no)$/i.test(String(env.ENSURE_INDEXES || '').trim());
const intEnv = (env, key, def) => {
  const n = Number(env[key]);
  return env[key] !== undefined && String(env[key]).trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
};

/** Resolve a definition against the app's models: { table, fields, whereSql } or { skip }. */
const resolveDef = (sequelize, def) => {
  const model = sequelize && sequelize.models ? sequelize.models[def.model] : null;
  if (!model) return { skip: `model ${def.model} not loaded` };
  const fieldOf = (attr) => {
    const a = model.rawAttributes[attr];
    return a ? a.field || attr : null;
  };
  const fields = [];
  for (const attr of def.columns) {
    const f = fieldOf(attr);
    if (!f) return { skip: `${def.model}.${attr} not in model` };
    fields.push(f);
  }
  let whereSql = null;
  const whereFields = [];
  if (def.where) {
    let missing = null;
    whereSql = def.where((attr) => {
      const f = fieldOf(attr);
      if (!f) missing = attr;
      whereFields.push(f || attr);
      return quoteIdent(f || attr);
    });
    if (missing) return { skip: `${def.model}.${missing} not in model` };
  }
  return { table: tableNameOf(model), fields, whereSql, whereFields };
};

/** The CREATE INDEX statement for a resolved definition. */
const createSql = (dialect, def, r) => {
  const cols = r.fields.map(quoteIdent).join(', ');
  const conc = dialect === 'postgres' ? 'CONCURRENTLY ' : '';
  return `CREATE INDEX ${conc}IF NOT EXISTS ${quoteIdent(def.name)} ON ${quoteIdent(r.table)} (${cols})${r.whereSql ? ` WHERE ${r.whereSql}` : ''}`;
};
const dropInvalidSql = (name) => `DROP INDEX CONCURRENTLY IF EXISTS ${quoteIdent(name)}`;

// ── Postgres adapter (dedicated connection) ─────────────────────────────────────────────────────────
const PG_COLUMNS_SQL = `SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`;
// Every index on the tables: name, validity, partial / expression flags and its plain column list.
const PG_TABLE_INDEXES_SQL = `SELECT t.relname AS table_name, c.relname AS index_name, i.indisvalid AS valid,
    (i.indpred IS NOT NULL) AS partial, (i.indexprs IS NOT NULL) AS expr,
    ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum ORDER BY k.ord)::text[] AS cols
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = current_schema() AND t.relname = ANY($1::text[])`;
// Our names anywhere in the schema (an index name is unique per schema, whatever its table).
const PG_NAMED_SQL = `SELECT c.relname AS index_name, i.indisvalid AS valid, t.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_index i ON i.indexrelid = c.oid
  JOIN pg_class t ON t.oid = i.indrelid
  WHERE n.nspname = current_schema() AND c.relname = ANY($1::text[])`;

const pgClientConfig = (sequelize, env, { withLockTimeout = true } = {}) => {
  const c = sequelize.config || {};
  const dOpts = c.dialectOptions || (sequelize.options && sequelize.options.dialectOptions) || {};
  const st = intEnv(env, 'ENSURE_INDEXES_STATEMENT_TIMEOUT_MS', DEFAULT_STATEMENT_TIMEOUT_MS);
  const lt = intEnv(env, 'ENSURE_INDEXES_LOCK_TIMEOUT_MS', DEFAULT_LOCK_TIMEOUT_MS);
  const cfg = {
    host: c.host,
    port: c.port ? Number(c.port) : undefined,
    user: c.username,
    password: c.password,
    database: c.database,
    application_name: 'zenvy-ensure-indexes',
    connectionTimeoutMillis: 15000,
  };
  if (dOpts.ssl) cfg.ssl = dOpts.ssl;
  if (st > 0) {
    cfg.statement_timeout = st;
    cfg.query_timeout = st + 30000; // client-side backstop if a pooler ignored the startup option
  }
  if (withLockTimeout && lt > 0) cfg.lock_timeout = lt;
  return cfg;
};

const openPgClient = async (sequelize, env, createClient) => {
  const make = createClient || ((cfg) => new (require('pg').Client)(cfg));
  let lastErr = null;
  // A pooler that rejects an unknown startup option (lock_timeout) gets a second try without it:
  // statement_timeout is the same option the app pool already connects with.
  for (const withLockTimeout of [true, false]) {
    const client = make(pgClientConfig(sequelize, env, { withLockTimeout }));
    try {
      client.on && client.on('error', () => {}); // a dropped connection must never crash the process
      await client.connect();
      return { client, withLockTimeout };
    } catch (err) {
      lastErr = err;
      try { await client.end(); } catch { /* already closed */ }
    }
  }
  throw lastErr || new Error('could not connect');
};

const pgAdapter = (client) => {
  const q = async (sql, params) => {
    const r = await client.query(sql, params);
    return (r && r.rows) || [];
  };
  return {
    dialect: 'postgres',
    async columns(tables) {
      const rows = await q(PG_COLUMNS_SQL, [tables]);
      const map = new Map();
      for (const r of rows) {
        if (!map.has(r.table_name)) map.set(r.table_name, new Set());
        map.get(r.table_name).add(r.column_name);
      }
      return map;
    },
    async tableIndexes(tables) {
      return (await q(PG_TABLE_INDEXES_SQL, [tables])).map((r) => ({
        table: r.table_name, name: r.index_name, valid: r.valid === true || r.valid === 't',
        partial: r.partial === true || r.partial === 't', expr: r.expr === true || r.expr === 't',
        cols: Array.isArray(r.cols) ? r.cols : [],
      }));
    },
    async named(names) {
      return (await q(PG_NAMED_SQL, [names])).map((r) => ({ name: r.index_name, table: r.table_name, valid: r.valid === true || r.valid === 't' }));
    },
    async isInvalid(name) {
      const rows = await q(PG_NAMED_SQL, [[name]]);
      return rows.some((r) => !(r.valid === true || r.valid === 't'));
    },
    run: (sql) => q(sql),
    dropInvalid: (name) => q(dropInvalidSql(name)),
  };
};

// ── SQLite adapter (app connection) ─────────────────────────────────────────────────────────────────
const sqliteAdapter = (sequelize) => {
  const rows = async (sql) => {
    const [r] = await sequelize.query(sql);
    return r || [];
  };
  const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
  return {
    dialect: 'sqlite',
    async columns(tables) {
      const map = new Map();
      for (const t of tables) {
        const cols = await rows(`PRAGMA table_info(${lit(t)})`);
        if (cols.length) map.set(t, new Set(cols.map((c) => c.name)));
      }
      return map;
    },
    async tableIndexes(tables) {
      const out = [];
      for (const t of tables) {
        for (const ix of await rows(`PRAGMA index_list(${lit(t)})`)) {
          const info = await rows(`PRAGMA index_info(${lit(ix.name)})`);
          const cols = info.sort((a, b) => a.seqno - b.seqno).map((c) => c.name);
          out.push({ table: t, name: ix.name, valid: true, partial: Number(ix.partial) === 1, expr: cols.some((c) => c === null), cols });
        }
      }
      return out;
    },
    async named(names) {
      const r = await rows(`SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name IN (${names.map(lit).join(', ') || "''"})`);
      return r.map((x) => ({ name: x.name, table: x.tbl_name, valid: true }));
    },
    isInvalid: async () => false,
    run: (sql) => sequelize.query(sql),
    dropInvalid: async () => {},
  };
};

const sameCols = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Build the missing indexes once. Resolves (never rejects) to
 *   { dialect, created, existed, skipped, failed, ms, details: [{ name, outcome, reason? }] }.
 * opts: { sequelize, defs, env, createClient (tests: fake pg client factory), shouldStop, log, warn }
 */
const ensureIndexes = async (opts = {}) => {
  const started = Date.now();
  const env = opts.env || process.env;
  const log = opts.log || ((m) => console.log(m));
  const warn = opts.warn || ((m) => console.warn(m));
  const shouldStop = opts.shouldStop || (() => false);
  const defs = opts.defs || INDEXES;
  const summary = { dialect: null, created: 0, existed: 0, skipped: 0, failed: 0, ms: 0, details: [] };
  const note = (name, outcome, reason) => {
    summary[outcome]++;
    summary.details.push(reason ? { name, outcome, reason } : { name, outcome });
  };
  const finish = () => {
    summary.ms = Date.now() - started;
    const extra = summary.details.filter((d) => d.outcome !== 'existed').map((d) => `${d.name}:${d.outcome}${d.reason ? `(${String(d.reason).slice(0, 120)})` : ''}`);
    log(`[ENSURE_INDEXES] ${summary.dialect || '?'} created=${summary.created} existed=${summary.existed} skipped=${summary.skipped} failed=${summary.failed} (${summary.ms} ms)${extra.length ? ` ${extra.join(' ')}` : ''}`);
    return summary;
  };

  let sequelize = opts.sequelize;
  if (sequelize === undefined) {
    try { sequelize = require('../config/db').getSequelize(); } catch { sequelize = null; }
  }
  if (!sequelize || typeof sequelize.getDialect !== 'function') {
    for (const d of defs) note(d.name, 'skipped', 'no database');
    return finish();
  }
  const dialect = sequelize.getDialect();
  summary.dialect = dialect;
  if (dialect !== 'postgres' && dialect !== 'sqlite') {
    for (const d of defs) note(d.name, 'skipped', `dialect ${dialect}`);
    return finish();
  }

  let client = null;
  try {
    let A;
    if (dialect === 'postgres') {
      let opened;
      try {
        opened = await openPgClient(sequelize, env, opts.createClient);
      } catch (err) {
        for (const d of defs) note(d.name, 'failed', `connect: ${err.message}`);
        return finish();
      }
      client = opened.client;
      if (!opened.withLockTimeout) warn('[ENSURE_INDEXES] lock_timeout startup option refused by the server/pooler; building without it (statement_timeout still set)');
      A = pgAdapter(client);
    } else {
      A = sqliteAdapter(sequelize);
    }

    const resolved = defs.map((d) => ({ def: d, r: resolveDef(sequelize, d) }));
    const tables = [...new Set(resolved.filter((x) => x.r.table).map((x) => x.r.table))];
    const columns = await A.columns(tables);
    const tableIdx = await A.tableIndexes(tables);
    const named = new Map((await A.named(defs.map((d) => d.name))).map((x) => [x.name, x]));

    for (const { def, r } of resolved) {
      if (r.skip) { note(def.name, 'skipped', r.skip); continue; }
      const have = columns.get(r.table);
      if (!have) { note(def.name, 'skipped', `table ${r.table} missing`); continue; }
      const missing = [...r.fields, ...(r.whereFields || [])].find((f) => !have.has(f));
      if (missing) { note(def.name, 'skipped', `column ${r.table}.${missing} missing`); continue; }

      const byName = named.get(def.name);
      if (byName && byName.table !== r.table) { note(def.name, 'skipped', `name already used by an index on ${byName.table}`); continue; }
      if (byName && byName.valid) { note(def.name, 'existed'); continue; }
      if (!byName) {
        // Same columns already indexed under another name (a full index also serves a partial one).
        const twin = tableIdx.find((ix) => ix.table === r.table && ix.valid && !ix.expr && !ix.partial && sameCols(ix.cols, r.fields));
        if (twin) { note(def.name, 'existed'); continue; }
      }
      if (shouldStop()) { note(def.name, 'skipped', 'shutting down'); continue; }

      if (byName && !byName.valid) {
        // Left behind by an interrupted / failed CONCURRENTLY build: drop it and build again (once).
        try {
          await A.dropInvalid(def.name);
          warn(`[ENSURE_INDEXES] dropped INVALID index ${def.name} (earlier build did not finish); rebuilding`);
        } catch (err) {
          note(def.name, 'failed', `drop invalid: ${err.message}`);
          continue;
        }
      }

      try {
        await A.run(createSql(dialect, def, r));
        // IF NOT EXISTS can return without building when the name exists as INVALID (raced another
        // builder): only a valid index counts as created.
        if (dialect === 'postgres' && await A.isInvalid(def.name)) throw new Error('index is INVALID after build');
        note(def.name, 'created');
      } catch (err) {
        note(def.name, 'failed', err.message);
        if (dialect === 'postgres') {
          try {
            if (await A.isInvalid(def.name)) await A.dropInvalid(def.name);
          } catch (dropErr) {
            warn(`[ENSURE_INDEXES] ${def.name}: could not drop the INVALID index (${dropErr.message}); it is dropped and rebuilt next boot`);
          }
        }
      }
    }
  } catch (err) {
    // Metadata queries failed (e.g. the connection dropped): count what is left as failed.
    const done = new Set(summary.details.map((d) => d.name));
    for (const d of defs) if (!done.has(d.name)) note(d.name, 'failed', err.message);
  } finally {
    if (client) { try { await client.end(); } catch { /* closed */ } }
  }
  return finish();
};

let lastResult = null;
let scheduled = null;

/**
 * Schedule one background run, ENSURE_INDEXES_DELAY_MS (default 5 s) after the call (call it once the
 * server is ready). Single runner across processes via runExclusive. Returns false when disabled.
 * opts: { delayMs, shouldStop, env, sequelize, runExclusive, createClient } (the last three: tests)
 */
const scheduleEnsureIndexes = (opts = {}) => {
  const env = opts.env || process.env;
  if (isDisabled(env)) {
    console.log('[ENSURE_INDEXES] disabled (ENSURE_INDEXES=false)');
    lastResult = { disabled: true };
    return false;
  }
  if (scheduled) return true;
  const delayMs = opts.delayMs !== undefined ? opts.delayMs : intEnv(env, 'ENSURE_INDEXES_DELAY_MS', DEFAULT_DELAY_MS);
  const shouldStop = opts.shouldStop || (() => false);
  const runExclusive = opts.runExclusive || require('../utils/jobs').runExclusive;
  scheduled = new Promise((resolve) => {
    const t = setTimeout(async () => {
      if (shouldStop()) { lastResult = { skipped: 'shutting down' }; return resolve(lastResult); }
      let summary = null;
      const out = await runExclusive(JOB_NAME, async () => {
        summary = await ensureIndexes({ env, shouldStop, sequelize: opts.sequelize, createClient: opts.createClient });
        return undefined; // the summary line above is the log; keep the [JOB] line at debug level
      }, { timeoutMs: JOB_TIMEOUT_MS, quietWhenIdle: true, sequelize: opts.sequelize });
      if (!out.ran && out.skipped === 'locked') console.log('[ENSURE_INDEXES] skipped: another process is checking the indexes');
      lastResult = summary || { skipped: out.skipped || 'not run', error: out.error };
      resolve(lastResult);
    }, Math.max(0, delayMs));
    if (t.unref) t.unref();
  });
  return true;
};

const getLastResult = () => lastResult;
const whenDone = () => scheduled || Promise.resolve(lastResult);

module.exports = {
  INDEXES, JOB_NAME, ensureIndexes, scheduleEnsureIndexes, getLastResult, whenDone,
  // exported for tests
  resolveDef, createSql, dropInvalidSql, pgClientConfig, isDisabled, PG_TABLE_INDEXES_SQL, PG_NAMED_SQL, PG_COLUMNS_SQL,
};
