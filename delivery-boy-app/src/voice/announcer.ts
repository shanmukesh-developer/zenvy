// Soundbox-style announcer: chime first, then a short spoken phrase.
// - One queue: announcements never talk over each other.
// - De-duplicated per order/event (persisted, so an app restart does not repeat "₹30 credited").
// - Stale items (older than STALE_MS when their turn comes) are dropped instead of read late.
// - Telugu by default; falls back to Hindi, then English when the phone has no Telugu voice.
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from '../config';
import { playChime, type ChimeKind } from '../services/notifications';
import { LANG_CODE, phrase, type PhraseArgs, type PhraseKey, type VoiceLang } from './phrases';

export interface VoiceSettings {
  enabled: boolean;
  lang: VoiceLang;
}

export interface VoiceState extends VoiceSettings {
  /** Language actually used for speech after the fallback check. */
  effectiveLang: VoiceLang;
  /** 'checking' until the voice list is read; 'unknown' when the phone does not report voices. */
  check: 'checking' | 'ok' | 'fallback' | 'unknown';
  available: Record<VoiceLang, boolean | null>;
}

const DEFAULTS: VoiceSettings = { enabled: true, lang: 'te' };
const STALE_MS = 45_000;
const MAX_QUEUE = 5;
const CHIME_GAP_MS = 750;
const DEFAULT_DEDUPE_MS = 6 * 60 * 60 * 1000;

const FALLBACK: Record<VoiceLang, VoiceLang[]> = { te: ['te', 'hi', 'en'], hi: ['hi', 'en'], en: ['en'] };

let state: VoiceState = {
  ...DEFAULTS,
  effectiveLang: DEFAULTS.lang,
  check: 'checking',
  available: { te: null, hi: null, en: null },
};
let voiceIds: Record<VoiceLang, string | null> = { te: null, hi: null, en: null };
const listeners = new Set<(s: VoiceState) => void>();

function setState(patch: Partial<VoiceState>) {
  state = { ...state, ...patch };
  state.effectiveLang = pickLang(state.lang, state.available);
  if (state.check !== 'checking' && state.check !== 'unknown') {
    state.check = state.effectiveLang === state.lang ? 'ok' : 'fallback';
  }
  listeners.forEach((l) => {
    try {
      l(state);
    } catch {
      // ignore listener errors
    }
  });
}

function pickLang(lang: VoiceLang, available: Record<VoiceLang, boolean | null>): VoiceLang {
  // Unknown availability (null) counts as usable: we cannot prove it is missing.
  for (const l of FALLBACK[lang]) if (available[l] !== false) return l;
  return 'en';
}

export function getVoiceState(): VoiceState {
  return state;
}

export function subscribeVoice(l: (s: VoiceState) => void): () => void {
  listeners.add(l);
  l(state);
  return () => {
    listeners.delete(l);
  };
}

// ── Settings ────────────────────────────────────────────────────────────────

let initPromise: Promise<void> | null = null;
let readyPromise: Promise<void> | null = null;

/** Load saved settings, the de-dupe ledger and check which voices the phone has. Safe to call often. */
export function initVoice(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await settingsReady();
      await checkVoices();
    })();
  }
  return initPromise;
}

/** Saved settings + spoken ledger only (fast). The voice list check can take seconds and is not awaited here. */
function settingsReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEYS.voice);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && typeof saved === 'object') {
          setState({
            enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULTS.enabled,
            lang: saved.lang === 'te' || saved.lang === 'hi' || saved.lang === 'en' ? saved.lang : DEFAULTS.lang,
          });
        }
      } catch {
        // defaults
      }
      await loadLedger();
    })();
  }
  return readyPromise;
}

export async function updateVoiceSettings(patch: Partial<VoiceSettings>): Promise<void> {
  setState(patch);
  if (patch.enabled === false) stopSpeaking();
  try {
    await AsyncStorage.setItem(KEYS.voice, JSON.stringify({ enabled: state.enabled, lang: state.lang }));
  } catch {
    // memory only
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Reads the phone's voice list (Android may need a moment to start its speech engine). */
export async function checkVoices(): Promise<void> {
  setState({ check: 'checking' });
  let voices: Speech.Voice[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      voices = await Speech.getAvailableVoicesAsync();
    } catch {
      voices = [];
    }
    if (voices.length) break;
    await sleep(1500);
  }
  if (!voices.length) {
    voiceIds = { te: null, hi: null, en: null };
    setState({ check: 'unknown', available: { te: null, hi: null, en: null } });
    return;
  }
  const find = (lang: VoiceLang): string | null => {
    const want = LANG_CODE[lang].toLowerCase();
    const norm = (v: Speech.Voice) => String(v.language || '').replace('_', '-').toLowerCase();
    const usable = voices.filter((v) => norm(v).startsWith(lang));
    if (!usable.length) return null;
    const exact = usable.filter((v) => norm(v) === want);
    const pool = exact.length ? exact : usable;
    const enhanced = pool.find((v) => String(v.quality) === String(Speech.VoiceQuality.Enhanced));
    return (enhanced ?? pool[0]).identifier || LANG_CODE[lang];
  };
  voiceIds = { te: find('te'), hi: find('hi'), en: find('en') };
  setState({
    check: 'ok',
    available: { te: !!voiceIds.te, hi: !!voiceIds.hi, en: !!voiceIds.en },
  });
}

// ── De-dupe ledger ──────────────────────────────────────────────────────────

let ledger: Record<string, number> = {}; // key -> expiresAt
let ledgerTimer: ReturnType<typeof setTimeout> | null = null;

async function loadLedger() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.spoken);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      const now = Date.now();
      const saved = Object.fromEntries(
        Object.entries(parsed as Record<string, number>).filter(([, exp]) => typeof exp === 'number' && exp > now),
      );
      ledger = { ...saved, ...ledger }; // keep keys claimed before the load finished
    }
  } catch {
    // keep the in-memory ledger
  }
}

function saveLedgerSoon() {
  if (ledgerTimer) return;
  ledgerTimer = setTimeout(() => {
    ledgerTimer = null;
    const now = Date.now();
    ledger = Object.fromEntries(Object.entries(ledger).filter(([, exp]) => exp > now));
    AsyncStorage.setItem(KEYS.spoken, JSON.stringify(ledger)).catch(() => {});
  }, 1000);
}

/** true the first time a key is seen inside its window. */
function claim(key: string, ttlMs: number): boolean {
  const now = Date.now();
  if ((ledger[key] ?? 0) > now) return false;
  ledger[key] = now + ttlMs;
  saveLedgerSoon();
  return true;
}

// ── Queue ───────────────────────────────────────────────────────────────────

interface Item {
  key: PhraseKey;
  args: PhraseArgs;
  chime: ChimeKind | null;
  at: number;
  force: boolean;
  dedupeKey?: string;
  ttlMs: number;
}

let queue: Item[] = [];
let running = false;
let current: Item | null = null; // the item being chimed / spoken right now
let generation = 0; // bumps on stop so an in-flight item is abandoned

export interface AnnounceOptions {
  /** Unique per order/event, e.g. `delivered:<orderId>`. Repeats inside `ttlMs` are dropped. */
  dedupeKey?: string;
  ttlMs?: number;
  chime?: ChimeKind | null;
}

const DUTY_KEYS: PhraseKey[] = ['online', 'offline'];

/**
 * Queue a phrase. Returns false when it was a duplicate. Never throws.
 * The de-dupe key is claimed when the item is about to play (after the saved ledger has loaded),
 * so an app restart cannot repeat an announcement that was already made.
 */
export function announce(key: PhraseKey, args: PhraseArgs = {}, opts: AnnounceOptions = {}): boolean {
  const dedupeKey = opts.dedupeKey;
  if (dedupeKey) {
    if ((ledger[dedupeKey] ?? 0) > Date.now()) return false;
    if (queue.some((q) => q.dedupeKey === dedupeKey)) return false;
  }
  // Same phrase already waiting: keep only the newest. Duty on/off: only the latest state matters.
  queue = queue.filter(
    (q) =>
      !(q.key === key && JSON.stringify(q.args) === JSON.stringify(args)) &&
      !(DUTY_KEYS.includes(key) && DUTY_KEYS.includes(q.key)),
  );
  queue.push({
    key,
    args,
    chime: opts.chime === undefined ? 'info' : opts.chime,
    at: Date.now(),
    force: false,
    dedupeKey,
    ttlMs: opts.ttlMs ?? DEFAULT_DEDUPE_MS,
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  pump();
  return true;
}

/** Settings "Test voice": always speaks, even when the voice is switched off. */
export function announceTest(): void {
  stopSpeaking();
  queue.push({ key: 'test', args: {}, chime: 'money', at: Date.now(), force: true, ttlMs: 0 });
  pump();
}

/**
 * Drop one announcement (e.g. `new:<orderId>` once the rider accepted / skipped it or it left the pool):
 * removed from the queue, and cut off if it is being spoken right now. Never throws.
 */
export function cancelAnnouncement(dedupeKey: string): void {
  queue = queue.filter((q) => q.dedupeKey !== dedupeKey);
  if (current && current.dedupeKey === dedupeKey) {
    current = null;
    Speech.stop().catch(() => {}); // onStopped ends speakOnce; the queue moves on
  }
}

export function stopSpeaking(): void {
  generation++;
  queue = [];
  current = null;
  running = false;
  Speech.stop().catch(() => {});
}

/** English text of a phrase (used for the chime notification body, never spoken private data). */
function displayText(item: Item): string {
  return phrase('en', item.key, item.args);
}

/** Resolves false when the speech engine reported an error (e.g. no voice for that language). */
function speakOnce(text: string, lang: VoiceLang): Promise<boolean> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      resolve(ok);
    };
    const done = () => finish(true);
    const failed = () => finish(false);
    // Some engines never call back: never let the queue hang.
    const guard = setTimeout(done, Math.min(15000, 4000 + text.length * 90));
    try {
      Speech.speak(text, {
        language: LANG_CODE[lang],
        ...(voiceIds[lang] ? { voice: voiceIds[lang] as string } : {}),
        rate: lang === 'en' ? 0.95 : 0.9,
        pitch: 1.0,
        onDone: done,
        onStopped: done,
        onError: failed,
      });
    } catch {
      failed();
    }
  });
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  const myGen = generation;
  try {
    // Saved settings (voice off / language) and the spoken ledger must be loaded before anything plays.
    await settingsReady().catch(() => {});
    while (queue.length && myGen === generation) {
      const item = queue.shift() as Item;
      if (!item.force && Date.now() - item.at > STALE_MS) continue;
      if (item.dedupeKey && !claim(item.dedupeKey, item.ttlMs)) continue;
      current = item;
      const speak = item.force || state.enabled;
      // Voice off: keep the important cues (new order, money, alerts), skip the small "info" ones.
      if (item.chime && (speak || item.chime !== 'info')) {
        await playChime(item.chime, displayText(item));
        if (speak) await sleep(CHIME_GAP_MS);
      }
      if (!speak || myGen !== generation || current !== item) continue;
      let lang = state.effectiveLang;
      let ok = await speakOnce(phrase(lang, item.key, item.args), lang);
      // This language failed (no voice / engine error): fall back along te -> hi -> en instead of staying
      // silent. When the phone did not list its voices, remember the failure so later items skip it.
      const chain = FALLBACK[state.lang];
      while (!ok && myGen === generation && current === item) {
        if (state.check === 'unknown') setState({ available: { ...state.available, [lang]: false } });
        const next = chain.slice(chain.indexOf(lang) + 1).find((l) => state.available[l] !== false) ?? (lang !== 'en' ? 'en' : null);
        if (!next || next === lang) break;
        lang = next;
        ok = await speakOnce(phrase(lang, item.key, item.args), lang);
      }
      current = null;
      await sleep(250);
    }
  } finally {
    if (myGen === generation) running = false;
  }
}
