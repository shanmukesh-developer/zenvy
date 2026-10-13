/**
 * Automated content checks for every Friends text field: check(text, ctx) -> { decision, reasons }.
 *   decision 'block' -> the route answers 422 CONTENT_BLOCKED { reasons }
 *   decision 'flag'  -> the content is saved as pending_review and a system report is filed
 *   decision 'allow'
 * ctx: { kind: 'post'|'reply'|'forum_post'|'comment'|'review'|'task'|'bio'|'chat'|..., facultyReview?: bool, cfg? }
 *
 * Matching runs on a normalised copy (lower case, common leetspeak undone, separators dropped) so
 * "k i l l   y o u" and "k1ll y0u" are caught. Keyword lists come from admin config (keywords.block / flag);
 * the built-in rules below cover threats, self-harm, doxxing, bad links and spam floods.
 */
const flags = require('./featureFlags');

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };

const normalise = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFKD').replace(/\p{M}+/gu, '')
  .replace(/[0134578@$!|]/g, (c) => LEET[c] || c);

/** Letters only (spacing / punctuation removed), for obfuscation-resistant phrase matching. */
const squash = (text) => normalise(text).replace(/[^a-z]+/g, '');

const THREAT_PHRASES = [
  'iwillkillyou', 'illkillyou', 'gonnakillyou', 'goingtokillyou', 'iwillmurder', 'iwillbeatyou', 'iwillstabyou',
  'iwillshootyou', 'watchyourback', 'iknowwhereyoulive', 'iwillfindyou', 'acidattack', 'iwillrapeyou',
];
const SELF_HARM_TARGETING = ['killyourself', 'kys', 'godieplease', 'gokillyourself', 'hangyourself'];
const SELF_HARM_FIRST_PERSON = ['iwanttodie', 'iwanttokillmyself', 'endmylife', 'suicidal', 'killmyself', 'nowilltolive'];

// Allegations that need a human before they go live on faculty / staff reviews.
const ALLEGATION_TERMS = [
  'bribe', 'bribery', 'corrupt', 'harass', 'molest', 'assault', 'rape', 'sexual', 'abuse', 'fraud', 'scam',
  'criminal', 'arrested', 'police case', 'fir ', 'drunk', 'affair', 'casteist', 'racist', 'extort', 'blackmail',
];

const PHONE_RE = /(?<!\d)(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})(?!\d)/;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const ROOM_RE = /\b(?:room|rm|flat)\s*(?:no\.?|number|#)?\s*[a-z]?-?\d{2,4}\b/i;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const SHORTENERS = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'tiny.cc', 'ow.ly'];

const hostOf = (raw) => {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
};

/** Single link check for structured link fields: http(s) only, no IP literals, not denylisted. */
const checkLink = (url, cfg = flags.peekConfig()) => {
  if (typeof url !== 'string' || url.length > 2048) return { ok: false, reason: 'BAD_LINK' };
  let u;
  try { u = new URL(url.trim()); } catch { return { ok: false, reason: 'BAD_LINK' }; }
  if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, reason: 'BAD_LINK' };
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || host === 'localhost') return { ok: false, reason: 'BAD_LINK' };
  const deny = [...(cfg.linkDenylist || [])];
  if (deny.some((d) => host === d || host.endsWith(`.${d}`))) return { ok: false, reason: 'LINK_DENYLISTED' };
  if (SHORTENERS.includes(host)) return { ok: true, flag: 'LINK_SHORTENER', host };
  return { ok: true, host };
};

const hasWord = (norm, sq, word) => {
  const w = normalise(word).trim();
  if (!w) return false;
  if (w.includes(' ')) return norm.includes(w) || sq.includes(w.replace(/\s+/g, ''));
  // Whole-word match on the normalised text, or squashed match for words of 5+ letters.
  const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
  return re.test(norm) || (w.length >= 5 && sq.includes(w.replace(/[^a-z]/g, '')));
};

/**
 * @returns {{ decision: 'allow'|'flag'|'block', reasons: string[], selfHarm?: boolean }}
 */
const check = (text, ctx = {}) => {
  const cfg = ctx.cfg || flags.peekConfig();
  const raw = String(text || '');
  if (!raw.trim()) return { decision: 'allow', reasons: [] };
  const norm = normalise(raw);
  const sq = squash(raw);
  const block = new Set();
  const flag = new Set();

  if (THREAT_PHRASES.some((p) => sq.includes(p))) block.add('THREAT');
  if (SELF_HARM_TARGETING.some((p) => sq.includes(p) || new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(norm))) block.add('HARASSMENT');
  const selfHarm = SELF_HARM_FIRST_PERSON.some((p) => sq.includes(p));
  if (selfHarm) flag.add('SELF_HARM');

  // Doxxing: personal contact details in public content. Chat (private) is exempt.
  if (ctx.kind !== 'chat') {
    const phone = raw.match(PHONE_RE);
    if (phone && phone[1].replace(/\D/g, '').length === 10) block.add('DOXXING_PHONE');
    if (EMAIL_RE.test(raw) && !ctx.allowEmail) block.add('DOXXING_EMAIL');
    if (ROOM_RE.test(raw) && (ctx.facultyReview || ctx.kind === 'review' || ctx.kind === 'post' || ctx.kind === 'reply')) block.add('DOXXING_ROOM');
  }

  // Links inside free text.
  const urls = raw.match(URL_RE) || [];
  if (urls.length > 3) flag.add('SPAM_LINKS');
  for (const u of urls) {
    const r = checkLink(/^https?:\/\//i.test(u) ? u : `https://${u}`, cfg);
    if (!r.ok) block.add(r.reason);
    else if (r.flag) flag.add(r.flag);
  }
  if (/\b(?:javascript|data|vbscript):/i.test(raw)) block.add('BAD_LINK');

  // Admin keyword lists.
  for (const w of cfg.keywords.block || []) if (hasWord(norm, sq, w)) { block.add('BLOCKED_TERM'); break; }
  for (const w of cfg.keywords.flag || []) if (hasWord(norm, sq, w)) { flag.add('FLAGGED_TERM'); break; }

  // Faculty / staff reviews: allegations go to a human first (never auto-removed for being negative).
  if (ctx.facultyReview) {
    if (ALLEGATION_TERMS.some((t) => norm.includes(t))) flag.add('ALLEGATION');
  }

  // Spam floods: one character repeated, or shouting.
  if (/(.)\1{14,}/.test(raw)) flag.add('SPAM_PATTERN');
  const letters = raw.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 40 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.9) flag.add('SPAM_PATTERN');

  if (block.size) return { decision: 'block', reasons: [...block], selfHarm };
  if (flag.size) return { decision: 'flag', reasons: [...flag], selfHarm };
  return { decision: 'allow', reasons: [] };
};

const REASON_TEXT = {
  THREAT: 'Threats of violence are not allowed.',
  HARASSMENT: 'Telling someone to hurt themselves is not allowed.',
  DOXXING_PHONE: 'Remove the phone number. Personal contact details cannot be posted.',
  DOXXING_EMAIL: 'Remove the email address. Personal contact details cannot be posted.',
  DOXXING_ROOM: 'Remove the room number. Personal details cannot be posted.',
  BAD_LINK: 'That link is not allowed. Use a normal http(s) link.',
  LINK_DENYLISTED: 'Links to that site are not allowed.',
  BLOCKED_TERM: 'Your text contains words that are not allowed in Friends.',
};

/** Throws 422 CONTENT_BLOCKED when blocked; otherwise returns the result (caller handles 'flag'). */
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

module.exports = { check, enforce, checkLink, normalise, squash, hostOf, REASON_TEXT };
