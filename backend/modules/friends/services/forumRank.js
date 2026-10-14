/**
 * Forum ranking. Hot = log10 of the net score (signed) + age term, so a post needs ~10x the score to
 * stay level with one 12.5 h newer, plus a small bonus for discussion. Stored in hotRank (DOUBLE) and
 * recomputed on every vote / comment, so Hot is an indexed ORDER BY hotRank DESC, id DESC.
 * Top = score DESC, id DESC (optionally inside a time window). New = createdAt DESC, id DESC.
 */
const EPOCH_SEC = 1735689600; // 2025-01-01T00:00:00Z
const HALF_DAY_SEC = 45000;

const hotRank = (score, createdAt, commentCount = 0) => {
  const s = Number(score) || 0;
  const order = Math.log10(Math.max(Math.abs(s), 1));
  const sign = s > 0 ? 1 : s < 0 ? -1 : 0;
  const t = new Date(createdAt || Date.now()).getTime() / 1000 - EPOCH_SEC;
  const talk = 0.25 * Math.log10(1 + Math.max(0, Number(commentCount) || 0));
  return Math.round((sign * order + talk + t / HALF_DAY_SEC) * 1e7) / 1e7;
};

const SORTS = ['hot', 'new', 'top'];
const TOP_WINDOWS = { day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3, all: null };

/** { field, kind } of the cursor column for a sort. */
const sortSpec = (sort) => {
  if (sort === 'top') return { field: 'score', kind: 'number' };
  if (sort === 'hot') return { field: 'hotRank', kind: 'number' };
  return { field: 'createdAt', kind: 'date' };
};

module.exports = { hotRank, sortSpec, SORTS, TOP_WINDOWS };
