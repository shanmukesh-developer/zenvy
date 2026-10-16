// Seed scripts (scripts/unified_seed.js, scripts/seed_full.js, scripts/seed_local_vendors.js) create
// demo accounts with published passwords and wipe catalogue tables. They must never run against
// production. Production = NODE_ENV=production, RENDER set, or a Postgres DATABASE_URL.
// ALLOW_SEED_IN_PROD=1 overrides (deliberate, one-off use only).
const isPostgresUrl = (url) => /^postgres(ql)?:\/\//i.test(String(url || '').trim());

const seedRefusalReason = (env = process.env) => {
  if (String(env.ALLOW_SEED_IN_PROD || '') === '1') return null;
  if (env.NODE_ENV === 'production') return 'NODE_ENV=production';
  if (env.RENDER !== undefined && String(env.RENDER) !== '') return 'RENDER is set';
  if (isPostgresUrl(env.DATABASE_URL)) return 'DATABASE_URL points at Postgres';
  return null;
};

/** true when the seed may run; otherwise logs why and returns false. */
const seedAllowed = (scriptName, env = process.env) => {
  const reason = seedRefusalReason(env);
  if (!reason) return true;
  console.error(`🛑 [SEED_GUARD] ${scriptName} refused: this looks like production (${reason}). Seed scripts create demo accounts with published passwords. Set ALLOW_SEED_IN_PROD=1 only if you really mean it.`);
  return false;
};

module.exports = { seedAllowed, seedRefusalReason, isPostgresUrl };
