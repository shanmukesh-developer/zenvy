// PHASE STUB (Spaces, Phase 5): every space:* event acks { ok:false, code:'FEATURE_OFF' } until the
// Spaces phase replaces this file with the real room state machine (friends_plan.md §4 Spaces).
const EVENTS = [
  'space:join', 'space:leave', 'space:hand', 'space:invite_speaker', 'space:respond_invite', 'space:set_role',
  'space:mute', 'space:self_mute', 'space:remove', 'space:end', 'space:signal', 'space:report',
];

const register = (campusNsp, socket) => {
  for (const ev of EVENTS) {
    socket.on(ev, (data, ack) => {
      if (typeof ack === 'function') ack({ ok: false, code: 'FEATURE_OFF', error: 'Spaces are not available yet.' });
    });
  }
};

module.exports = { register, EVENTS };
