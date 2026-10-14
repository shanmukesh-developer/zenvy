/**
 * Structured-review safety (Forum). Runs on top of contentPolicy for every review and right-of-reply.
 *  - block (422 CONTENT_BLOCKED): threats, telling someone to hurt themselves, doxxing (phone, email,
 *    room / house numbers), abusive slurs and insults aimed at a person, bad links.
 *  - flag (saved as pending_review, reviewed by a human, never auto-removed): allegations of crimes,
 *    sexual misconduct, bribery, etc. on faculty / staff reviews (possible defamation), home-address
 *    hints, admin flag keywords.
 *  - A low rating on its own is NEVER blocked or flagged.
 */
const contentPolicy = require('./contentPolicy');

// Abuse aimed at a person (English + common Indian transliterations). Whole-word, leetspeak-normalised.
const ABUSE = [
  'bastard', 'bitch', 'whore', 'slut', 'retard', 'moron', 'idiot', 'imbecile', 'dumbass', 'asshole',
  'chutiya', 'chutia', 'madarchod', 'bhenchod', 'behenchod', 'gandu', 'harami', 'kamina', 'saala kutta',
  'lanja', 'dengey', 'puka', 'randi',
];
const ADDRESS_HINTS = ['lives at', 'his house', 'her house', 'house no', 'home address', 'stays at', 'residence is'];

const hasWord = (norm, word) => {
  const w = contentPolicy.normalise(word).trim();
  if (w.includes(' ')) return norm.includes(w);
  return new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(norm);
};

const PERSON_KINDS = ['professor'];

/**
 * @param {string} text   all free text of the review (title + body + pros + cons)
 * @param {object} ctx    { targetKind, cfg }
 * @returns {{ decision: 'allow'|'flag'|'block', reasons: string[] }}
 */
const check = (text, ctx = {}) => {
  const facultyReview = PERSON_KINDS.includes(ctx.targetKind);
  const base = contentPolicy.check(text, { kind: 'review', facultyReview, cfg: ctx.cfg });
  const block = new Set(base.decision === 'block' ? base.reasons : []);
  const flag = new Set(base.decision === 'flag' ? base.reasons : []);
  const norm = contentPolicy.normalise(text);
  if (ABUSE.some((w) => hasWord(norm, w))) block.add('ABUSE');
  if (facultyReview && ADDRESS_HINTS.some((w) => norm.includes(w))) flag.add('PERSONAL_DETAILS');
  if (block.size) return { decision: 'block', reasons: [...block] };
  if (flag.size) return { decision: 'flag', reasons: [...flag] };
  return { decision: 'allow', reasons: [] };
};

const REASON_TEXT = {
  ...contentPolicy.REASON_TEXT,
  ABUSE: 'Insults and slurs are not allowed. Review the teaching or the place, not the person.',
};

/** Throws 422 CONTENT_BLOCKED when blocked; returns the result otherwise (caller handles 'flag'). */
const enforce = (text, ctx = {}) => {
  const r = check(text, ctx);
  if (r.decision === 'block') {
    const { fail } = require('./http');
    throw fail(422, 'CONTENT_BLOCKED', REASON_TEXT[r.reasons[0]] || 'This content is not allowed.', {
      reasons: r.reasons,
      details: r.reasons.map((x) => REASON_TEXT[x]).filter(Boolean),
    });
  }
  return r;
};

module.exports = { check, enforce, ABUSE, PERSON_KINDS, REASON_TEXT };
