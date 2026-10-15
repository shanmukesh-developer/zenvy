// Soundbox voice engine: settings (on/off + language), voice detection with Telugu → Hindi → English
// fallback, and ONE announcement queue. Announcements never stack: duplicates (same key queued, being
// spoken, or spoken within the de-dupe window) are dropped, the queue is short, and urgent items go first.
// Each announcement = short chime (vibration; tone on web) + the phrase via expo-speech.
import { AppState, Platform, Vibration } from 'react-native';
import * as Speech from 'expo-speech';
import { STORAGE } from '../config';
import { safeGet, safeRemove, safeSet } from '../lib/storage';
import { nativeOrderAlert, hasKitchenService } from './kitchenService';
import { FALLBACK_CHAIN, LANG_TAG, phrase, VoiceEvent, VoiceLang } from './phrases';

type NativeAlert = { orderNum: string; amount: string; silent?: boolean };

export interface VoiceSettings { enabled: boolean; lang: VoiceLang }

export interface VoiceSnapshot {
  settings: VoiceSettings;
  /** true / false once voices were checked; null = this phone does not report its voices. */
  available: Record<VoiceLang, boolean | null>;
  /** Language actually spoken (after fallback). */
  effectiveLang: VoiceLang;
  loaded: boolean;
}

interface QueueItem {
  key: string;
  event: VoiceEvent;
  urgent: boolean;
  /** For new orders: native heads-up notification when the app is in the background. `silent`: the app ring
   *  already sounded, so the heads-up must not play a second sound. */
  native?: NativeAlert;
}

const MAX_QUEUE = 4;
const DEFAULT_DEDUPE_MS = 10 * 60 * 1000;

let settings: VoiceSettings = { enabled: true, lang: 'te' };
let available: Record<VoiceLang, boolean | null> = { te: null, hi: null, en: null };
let voiceIds: Partial<Record<VoiceLang, string>> = {};
let loaded = false;
let snapshot: VoiceSnapshot = makeSnapshot();
const listeners = new Set<() => void>();

const queue: QueueItem[] = [];
let current: QueueItem | null = null;
let currentDone: (() => void) | null = null;
const recent = new Map<string, number>();

// ── Settings / snapshot ─────────────────────────────────────────────────────
function resolveLang(): VoiceLang {
  const chosen = settings.lang;
  if (available[chosen] !== false) return chosen;
  const start = FALLBACK_CHAIN.indexOf(chosen);
  for (const l of [...FALLBACK_CHAIN.slice(start + 1), ...FALLBACK_CHAIN]) {
    if (available[l] !== false) return l;
  }
  return 'en';
}

function makeSnapshot(): VoiceSnapshot {
  return { settings: { ...settings }, available: { ...available }, effectiveLang: resolveLang(), loaded };
}

function emit() {
  snapshot = makeSnapshot();
  listeners.forEach((l) => { try { l(); } catch { /* ignore */ } });
}

export function subscribeVoice(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export const getVoiceSnapshot = () => snapshot;

const LANG_PREFIX: Record<VoiceLang, RegExp> = { te: /^te([-_]|$)|^tel/i, hi: /^hi([-_]|$)|^hin/i, en: /^en([-_]|$)|^eng/i };

/** Checks which languages have a TTS voice on this phone. Safe to call again (e.g. on app resume). */
export async function detectVoices(): Promise<void> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (!Array.isArray(voices) || voices.length === 0) {
      // Some Android engines do not list voices: try the chosen language and let the engine decide.
      available = { te: null, hi: null, en: null };
      voiceIds = {};
    } else {
      const next: Record<VoiceLang, boolean | null> = { te: false, hi: false, en: false };
      const ids: Partial<Record<VoiceLang, string>> = {};
      (Object.keys(LANG_PREFIX) as VoiceLang[]).forEach((l) => {
        const matches = voices.filter((v) => v && typeof v.language === 'string' && LANG_PREFIX[l].test(v.language));
        if (matches.length) {
          next[l] = true;
          // Prefer an Indian voice (te-IN / hi-IN / en-IN), then an enhanced one.
          const best = matches.find((v) => /IN$/i.test(v.language) && v.quality === Speech.VoiceQuality.Enhanced)
            || matches.find((v) => /IN$/i.test(v.language))
            || matches[0];
          if (best?.identifier) ids[l] = best.identifier;
        }
      });
      available = next;
      voiceIds = ids;
    }
  } catch {
    available = { te: null, hi: null, en: null };
    voiceIds = {};
  }
  emit();
}

export async function initVoice(): Promise<void> {
  if (!loaded) {
    const raw = await safeGet(STORAGE.voice);
    if (raw) {
      try {
        const v = JSON.parse(raw);
        settings = {
          enabled: v?.enabled !== false,
          lang: v?.lang === 'hi' || v?.lang === 'en' || v?.lang === 'te' ? v.lang : 'te',
        };
      } catch { /* keep defaults */ }
    } else {
      // Migrate the old "Order sound" switch.
      const old = await safeGet(STORAGE.soundOnV1);
      if (old === '0') settings = { ...settings, enabled: false };
      await safeRemove([STORAGE.soundOnV1]);
    }
    loaded = true;
    emit();
  }
  await detectVoices();
}

export function updateVoiceSettings(patch: Partial<VoiceSettings>) {
  settings = { ...settings, ...patch };
  safeSet(STORAGE.voice, JSON.stringify(settings));
  if (!settings.enabled) stopVoice();
  emit();
}

export const voiceEnabled = () => settings.enabled;

// ── Chime ───────────────────────────────────────────────────────────────────
function playWebChime() {
  if (typeof window === 'undefined') return;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const tone = (freq: number, start: number, end: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(vol, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + end);
    };
    tone(1046, 0, 0.16, 0.3);
    tone(1318, 0.14, 0.45, 0.35);
    setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 800);
  } catch { /* no audio */ }
}

/** `ringing`: the new-order ring already vibrates; a second vibrate() would cut its pattern short. */
function chime(ringing: boolean) {
  if (Platform.OS === 'web') playWebChime();
  else if (!ringing) Vibration.vibrate([0, 90, 70, 140]);
}

// ── Queue ───────────────────────────────────────────────────────────────────
function pruneRecent(now: number) {
  if (recent.size < 200) return;
  for (const [k, t] of recent) if (now - t > DEFAULT_DEDUPE_MS) recent.delete(k);
}

/**
 * Queues an announcement. `key` identifies the event (e.g. "cancel:<orderId>"); a key that is queued,
 * being spoken, or was spoken within `dedupeMs` is dropped. Returns true if queued.
 */
export function announce(
  key: string,
  event: VoiceEvent,
  opts: { urgent?: boolean; dedupeMs?: number; force?: boolean; native?: NativeAlert } = {},
): boolean {
  if (!settings.enabled && !opts.force) return false;
  const now = Date.now();
  const dedupeWindow = opts.dedupeMs ?? DEFAULT_DEDUPE_MS;
  if (current?.key === key || queue.some((q) => q.key === key)) return false;
  const last = recent.get(key);
  if (last && now - last < dedupeWindow) return false;
  recent.set(key, now);
  pruneRecent(now);

  const item: QueueItem = { key, event, urgent: !!opts.urgent, native: opts.native };
  if (item.urgent) {
    const firstNormal = queue.findIndex((q) => !q.urgent);
    if (firstNormal === -1) queue.push(item); else queue.splice(firstNormal, 0, item);
  } else {
    queue.push(item);
  }
  // Keep the queue short: drop the oldest normal item first, then the oldest urgent one.
  while (queue.length > MAX_QUEUE) {
    const idx = queue.findIndex((q) => !q.urgent);
    queue.splice(idx === -1 ? 0 : idx, 1);
  }
  pump();
  return true;
}

/** Drops queued announcements whose key starts with `prefix` and stops it if it is being spoken. */
export function cancelAnnouncements(prefix: string) {
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].key.startsWith(prefix)) queue.splice(i, 1);
  if (current && current.key.startsWith(prefix)) {
    try { Speech.stop(); } catch { /* ignore */ }
    finishCurrent();
  }
}

/** Forget that a key was spoken, so it can be announced again right away (e.g. a ring repeat). */
export function forgetAnnouncement(key: string) {
  recent.delete(key);
}

export function stopVoice() {
  queue.length = 0;
  try { Speech.stop(); } catch { /* ignore */ }
  finishCurrent();
}

let doneTimer: ReturnType<typeof setTimeout> | null = null;

function finishCurrent() {
  if (doneTimer) clearTimeout(doneTimer);
  doneTimer = null;
  const done = currentDone;
  currentDone = null;
  current = null;
  if (done) done();
}

function pump() {
  if (current || queue.length === 0) return;
  const item = queue.shift() as QueueItem;
  current = item;
  let finished = false;
  currentDone = () => {
    if (finished) return;
    finished = true;
    // Small gap between announcements so they never run together.
    setTimeout(pump, 400);
  };
  speakItem(item).catch(() => { if (current === item) finishCurrent(); });
}

async function speakItem(item: QueueItem) {
  const lang = resolveLang();
  const text = phrase(item.event, lang);
  const estMs = Math.min(20000, Math.max(3000, text.length * 110)) + 1500;
  const background = AppState.currentState !== 'active';

  // In the background the native service wakes the screen + posts a heads-up notification. It speaks
  // itself only in Telugu (its TTS is fixed to te-IN); for other languages expo-speech speaks below.
  if (item.native && background && hasKitchenService()) {
    const nativeSpeaks = lang === 'te' && settings.enabled;
    const ok = await nativeOrderAlert(nativeSpeaks ? text : '', item.native.orderNum, item.native.amount, settings.lang, !!item.native.silent);
    // Accepted / rejected / silenced while the native call ran: never arm a timer that would end a
    // different (later) announcement.
    if (current !== item) return;
    if (ok && nativeSpeaks) {
      doneTimer = setTimeout(finishCurrent, estMs);
      return;
    }
  }

  chime(item.event.kind === 'newOrder');
  await new Promise((r) => setTimeout(r, Platform.OS === 'web' ? 450 : 350));
  if (current !== item) return; // cancelled during the chime

  // The chosen language can fail even when the phone reports it (missing voice data, engine hiccup): then
  // speak the same announcement once more in the next fallback language instead of staying silent.
  const speakIn = (l: VoiceLang, retried: boolean) => {
    if (current !== item) return;
    const t = l === lang ? text : phrase(item.event, l);
    const fail = () => {
      if (current !== item) return;
      const next = retried ? null : nextLang(l);
      if (next) speakIn(next, true);
      else finishCurrent();
    };
    if (doneTimer) clearTimeout(doneTimer);
    doneTimer = setTimeout(finishCurrent, estMs); // safety net: some engines never call back
    try {
      Speech.speak(t, {
        language: LANG_TAG[l],
        voice: voiceIds[l],
        rate: Platform.OS === 'android' ? 0.92 : 0.95,
        pitch: 1.0,
        volume: 1.0, // full volume: the voice may be the only sound (ring blocked)
        onDone: () => { if (current === item) finishCurrent(); },
        onStopped: () => { if (current === item) finishCurrent(); },
        onError: fail,
      });
    } catch {
      fail();
    }
  };
  speakIn(lang, false);
}

/** Next language to try after `l` failed to speak; null when English (the last resort) failed. */
function nextLang(l: VoiceLang): VoiceLang | null {
  if (l === 'en') return null;
  const start = FALLBACK_CHAIN.indexOf(l);
  for (const c of FALLBACK_CHAIN.slice(start + 1)) if (available[c] !== false) return c;
  return 'en';
}

/** Settings → Test voice: plays even when the voice is switched off. */
export function testVoice() {
  forgetAnnouncement('test');
  cancelAnnouncements('test');
  announce('test', { kind: 'test' }, { force: true, urgent: true, dedupeMs: 0 });
}
