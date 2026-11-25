// Lucky Spin rule change, once (GlobalConfig SPIN_RULE_5_V1_DONE). Owner, 25 Nov 2026: "every 5 delivered orders =
// 1 free spin" (was every 2). Spins a customer already earned under the old rule are never taken away: each user's
// User.spinBonus gets floor(completedOrders / 2) - floor(completedOrders / 5), the spins the old rule gave them that
// the new rule does not, so spinsAvailable (utils/spinRules) is exactly what it was the moment before the switch.
// From then on every 5 more finished orders add one spin. One UPDATE plus the marker in one transaction, so a crash
// can never apply it twice. DISABLE_SPIN_RULE_5_ONCE=true switches it off.
const MARKER = 'SPIN_RULE_5_V1_DONE';
const { ORDERS_PER_SPIN, LEGACY_ORDERS_PER_SPIN } = require('../utils/spinRules');

const runSpinRule5Once = async () => {
  if (String(process.env.DISABLE_SPIN_RULE_5_ONCE || '').toLowerCase() === 'true') return { skipped: 'disabled' };
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  const GlobalConfig = sequelize && sequelize.models && sequelize.models.GlobalConfig;
  const User = sequelize && sequelize.models && sequelize.models.User;
  if (!GlobalConfig || !User) return { skipped: 'models not ready' };
  if (await GlobalConfig.findOne({ where: { key: MARKER } })) return { skipped: 'already done' };

  const c = 'COALESCE("completedOrders", 0)';
  // Integer columns: "/" is integer division in both Postgres and SQLite.
  const carry = `((${c} / ${Number(LEGACY_ORDERS_PER_SPIN)}) - (${c} / ${Number(ORDERS_PER_SPIN)}))`;
  let usersWithCarry = 0;
  let spinsKept = 0;
  await sequelize.transaction(async (t) => {
    if (await GlobalConfig.findOne({ where: { key: MARKER }, transaction: t })) return;
    const [stats] = await sequelize.query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(${carry}), 0) AS s FROM "Users" WHERE ${carry} > 0`,
      { transaction: t, type: require('sequelize').QueryTypes.SELECT },
    );
    usersWithCarry = Number(stats && stats.n) || 0;
    spinsKept = Number(stats && stats.s) || 0;
    if (usersWithCarry > 0) {
      await sequelize.query(`UPDATE "Users" SET "spinBonus" = COALESCE("spinBonus", 0) + ${carry} WHERE ${carry} > 0`, { transaction: t });
    }
    await GlobalConfig.create({
      key: MARKER,
      value: { at: new Date().toISOString(), ordersPerSpin: ORDERS_PER_SPIN, from: LEGACY_ORDERS_PER_SPIN, usersWithCarry, spinsKept },
      description: 'Once: Lucky Spin every 5 orders, old spins kept (scripts/spin_rule_5_v1.js)',
    }, { transaction: t });
  });
  return { usersWithCarry, spinsKept };
};

module.exports = { runSpinRule5Once, MARKER };
