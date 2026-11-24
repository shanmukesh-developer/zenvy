// Food lunch window 12:30–1:00 PM removed, once (GlobalConfig FOOD_LUNCH_SLOT_OFF_V1_DONE). Owner, 24 Nov 2026:
// "Currently remove the timing 12:30-1:00PM". The built-in food windows (utils/deliveryGroups) no longer have it;
// this drops it from the admins' saved food windows (GlobalConfig DELIVERY_GROUPS) too, when they were saved with
// it. Other windows and groups are kept as saved. Runs once, so an admin can add a lunch window back later.
// DISABLE_FOOD_LUNCH_SLOT_OFF_ONCE=true switches it off.
const MARKER = 'FOOD_LUNCH_SLOT_OFF_V1_DONE';

const runFoodLunchSlotOffOnce = async () => {
  if (String(process.env.DISABLE_FOOD_LUNCH_SLOT_OFF_ONCE || '').toLowerCase() === 'true') return { skipped: 'disabled' };
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  const GlobalConfig = sequelize && sequelize.models && sequelize.models.GlobalConfig;
  if (!GlobalConfig) return { skipped: 'models not ready' };
  if (await GlobalConfig.findOne({ where: { key: MARKER } })) return { skipped: 'already done' };

  let out = { saved: 'none (built-in windows apply)' };
  const row = await GlobalConfig.findOne({ where: { key: 'DELIVERY_GROUPS' } });
  if (row) {
    let v = row.value;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
    const food = v && typeof v === 'object' && v.food && Array.isArray(v.food.slots) ? v.food.slots : null;
    if (food) {
      const kept = food.filter((s) => !(s && String(s.start).trim().padStart(5, '0') === '12:30' && String(s.end).trim().padStart(5, '0') === '13:00'));
      if (kept.length === food.length) out = { saved: 'no lunch window' };
      else if (!kept.length) out = { saved: 'lunch was the only food window: left as is' };
      else {
        await row.update({ value: { ...v, food: { ...v.food, slots: kept } } });
        try { await require('../utils/deliverySlots').loadConfig({ fresh: true }); } catch { /* cache expires in 30 s */ }
        out = { saved: 'lunch window removed', foodWindows: kept.length };
      }
    }
  }
  await GlobalConfig.create({ key: MARKER, value: JSON.stringify({ at: new Date().toISOString(), ...out }) });
  return out;
};

module.exports = { runFoodLunchSlotOffOnce, MARKER };
