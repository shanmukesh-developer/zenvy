// India Standard Time helpers (UTC+05:30, no DST). Server clocks run in UTC, so "today" / "this
// month" for campus users must be computed in IST or the day flips at 05:30 local time.
const IST_OFFSET_MS = 330 * 60 * 1000;

const istShift = (d = new Date()) => new Date(new Date(d).getTime() + IST_OFFSET_MS);
// 'YYYY-MM-DD' of the IST calendar day containing d.
const istYmd = (d = new Date()) => istShift(d).toISOString().slice(0, 10);
// 'YYYY-MM' of the IST month containing d.
const istMonthKey = (d = new Date()) => istShift(d).toISOString().slice(0, 7);
// UTC instant of IST midnight that starts the day containing d.
const istStartOfDay = (d = new Date()) => {
  const s = istShift(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) - IST_OFFSET_MS);
};
// UTC instant of IST midnight starting the IST calendar date 'YYYY-MM-DD'.
const istDayStartOf = (ymd) => new Date(`${ymd}T00:00:00+05:30`);

module.exports = { IST_OFFSET_MS, istShift, istYmd, istMonthKey, istStartOfDay, istDayStartOf };
