// Delivery colleges become SRM AP and Amrita only, once (GlobalConfig CAMPUS_SRM_AMRITA_V1_DONE). Owner, 24 Nov 2026:
// "remove VITAP from the entire app and add or enable Amrita University instead of VITAP"; SRM hostel blocks are
// Ganga-A, Ganga-B (Bramhaputra), Vedavathi, Teestha, Narmada, Yamuna, Krishna, Godavari, Saraswathi; Amrita
// students get one drop point, "Amrita Main Gate"; "other than these 2 locations we can't deliver".
//   - Campus SRMAP: settings.hostelBlocks set to the list below (other settings kept).
//   - Campus VITAP: isActive = false (row and data kept, so it can come back).
//   - Campus AMRITA: created if missing, isActive = true, no hostel blocks (the app shows the Main Gate).
//   - CAMPUS_SERVICE: amrita = open (utils/campuses no longer lists VIT AP at all).
// Runs once, so later admin edits stay. DISABLE_CAMPUS_SRM_AMRITA_ONCE=true switches it off.
const MARKER = 'CAMPUS_SRM_AMRITA_V1_DONE';
const SRM_BLOCKS = Object.freeze(['Ganga-A', 'Ganga-B (Bramhaputra)', 'Vedavathi', 'Teestha', 'Narmada', 'Yamuna', 'Krishna', 'Godavari', 'Saraswathi']);

const parseSettings = (v) => {
  if (v && typeof v === 'object') return { ...v };
  if (typeof v === 'string') { try { const p = JSON.parse(v); return p && typeof p === 'object' ? p : {}; } catch { return {}; } }
  return {};
};

const runCampusSrmAmritaOnce = async () => {
  if (String(process.env.DISABLE_CAMPUS_SRM_AMRITA_ONCE || '').toLowerCase() === 'true') return { skipped: 'disabled' };
  const { getSequelize } = require('../config/db');
  const sequelize = getSequelize();
  const models = (sequelize && sequelize.models) || {};
  const { GlobalConfig, Campus } = models;
  if (!GlobalConfig || !Campus) return { skipped: 'models not ready' };
  if (await GlobalConfig.findOne({ where: { key: MARKER } })) return { skipped: 'already done' };

  const out = {};
  const srm = await Campus.findOne({ where: { code: 'SRMAP' } });
  if (srm) {
    await srm.update({ settings: { ...parseSettings(srm.settings), hostelBlocks: [...SRM_BLOCKS] }, isActive: true });
    out.srm = 'blocks updated';
  } else {
    await Campus.create({ name: 'SRM University AP', code: 'SRMAP', emailDomains: ['srmap.edu.in'], city: 'Amaravathi', isActive: true, settings: { hostelBlocks: [...SRM_BLOCKS] } });
    out.srm = 'created';
  }
  const vit = await Campus.findOne({ where: { code: 'VITAP' } });
  if (vit && vit.isActive) { await vit.update({ isActive: false }); out.vitap = 'deactivated'; } else out.vitap = vit ? 'was inactive' : 'none';
  const amrita = await Campus.findOne({ where: { code: 'AMRITA' } });
  if (amrita) {
    await amrita.update({ name: 'Amrita University', isActive: true });
    out.amrita = 'activated';
  } else {
    await Campus.create({ name: 'Amrita University', code: 'AMRITA', emailDomains: [], city: 'Amaravathi', isActive: true, settings: { hostelBlocks: [] } });
    out.amrita = 'created';
  }
  const saved = await require('../utils/campuses').setStatus('amrita', 'open');
  if (saved.error) return { error: saved.error, ...out }; // no marker: tried again on the next start
  out.service = 'amrita open';

  await GlobalConfig.create({ key: MARKER, value: JSON.stringify({ at: new Date().toISOString(), ...out }) });
  return out;
};

module.exports = { runCampusSrmAmritaOnce, MARKER, SRM_BLOCKS };
