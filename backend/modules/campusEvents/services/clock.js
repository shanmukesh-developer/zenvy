// Injectable clock for Campus Events (tests move time instead of sleeping). Production: the real clock.
let impl = () => Date.now();

const nowMs = () => impl();
const now = () => new Date(impl());
/** Tests: set(() => fixedMs) / set(null) to restore the real clock. */
const set = (fn) => { impl = typeof fn === 'function' ? fn : () => Date.now(); };

module.exports = { now, nowMs, set };
