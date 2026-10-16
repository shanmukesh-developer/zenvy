"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminRequest } from '@/lib/api';

/**
 * C2: campus surfaces outside the Friends tab (Google Play UGC policy).
 *  - Kill switches: Campus Whispers and Zenvy After Dark (GET/PUT /api/campus/mod/switches,
 *    GlobalConfig CAMPUS_WHISPERS_ENABLED / AFTER_DARK_ENABLED). Off = the API answers FEATURE_OFF and
 *    the app hides the entry point. Every change is audited (config_update).
 *  - Whisper board: recent anonymous whispers with their moderation state and open reporters, and a
 *    direct Remove / Hide / Restore (POST /api/campus/mod/content/whisper/:id). The author is never
 *    listed here: open the report in the moderation queue and use "Reveal author" (audited) if needed.
 */

type Switches = { whispers: boolean; afterDark: boolean };
interface WhisperRow {
  id: string;
  alias: string;
  topic: string;
  text: string;
  hearts: number;
  createdAt: string;
  status: 'visible' | 'pending_review' | 'hidden' | 'removed';
  openReporters: number;
}

const btn = 'rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 transition-colors';
const card = 'glass-card p-6 space-y-4';
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const SWITCH_INFO: Record<keyof Switches, { label: string; blurb: string }> = {
  whispers: { label: 'Campus Whispers', blurb: 'Anonymous campus board (Pulse > Campus Whispers). Off: list, post and react answer "paused"; the card disappears from the app.' },
  afterDark: { label: 'Zenvy After Dark', blurb: 'Legacy late-night lounge chats and rooms (/api/chat, /api/rooms, after-dark sockets).' },
};

const STATUS_TONE: Record<string, string> = {
  visible: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  pending_review: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  hidden: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
  removed: 'text-red-300 border-red-500/30 bg-red-500/10',
};

export default function CampusSafetyPanel() {
  const [switches, setSwitches] = useState<Switches | null>(null);
  const [rows, setRows] = useState<WhisperRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [sw, list] = await Promise.all([
        adminRequest<{ switches: Switches }>('/api/campus/mod/switches'),
        adminRequest<{ items: WhisperRow[] }>(`/api/campus/mod/whispers?limit=50${filter === 'all' ? '' : `&status=${filter}`}`),
      ]);
      setSwitches(sw.switches);
      setRows(Array.isArray(list.items) ? list.items : []);
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e, 'Could not load campus safety settings.') });
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const flip = async (name: keyof Switches) => {
    if (!switches) return;
    const next = !switches[name];
    if (!next && !window.confirm(`Turn OFF ${SWITCH_INFO[name].label} for every student?`)) return;
    setBusy(`sw:${name}`);
    try {
      const res = await adminRequest<{ switches: Switches }>('/api/campus/mod/switches', { method: 'PUT', body: JSON.stringify({ [name]: next }) });
      setSwitches(res.switches);
      setNotice({ kind: 'ok', text: `${SWITCH_INFO[name].label} is now ${next ? 'ON' : 'OFF'}. Every server picks it up within about 30 seconds.` });
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e, 'Could not change the switch.') });
    } finally {
      setBusy(null);
    }
  };

  const act = async (row: WhisperRow, action: 'remove' | 'hide' | 'restore') => {
    if (action !== 'restore' && !window.confirm(`${action === 'remove' ? 'Remove' : 'Hide'} this whisper for everyone?`)) return;
    setBusy(`w:${row.id}`);
    try {
      const res = await adminRequest<{ status: WhisperRow['status'] }>(`/api/campus/mod/content/whisper/${row.id}`, {
        method: 'POST',
        body: JSON.stringify({ action, reason: 'Admin whisper board' }),
      });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: res.status } : r)));
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e, 'Could not update the whisper.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Campus safety (outside Friends)</h2>
          <p className="text-[11px] text-gray-500">
            Whispers, community posts, lost &amp; found, campus spots, groups, polls and chat are reported into the same{' '}
            <Link href="/moderation" className="text-blue-400 underline">moderation queue</Link> (sub-tab &quot;campus&quot;; chat messages under &quot;chat&quot;).
            They are hidden pending review after 3 distinct reports (UGC_AUTO_HIDE_REPORTS); dismissing the reports brings them back.
          </p>
        </div>
        <button onClick={load} className={`${btn} bg-blue-500/10 text-blue-400 border border-blue-500/20`}>↻ Reload</button>
      </div>

      {notice && (
        <div role="status" className={`rounded-2xl border px-4 py-3 text-xs font-bold flex items-center justify-between gap-4 ${notice.kind === 'ok' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-[10px] font-black uppercase opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <div className="divide-y divide-white/[0.04] border-t border-white/5">
        {(Object.keys(SWITCH_INFO) as (keyof Switches)[]).map((k) => (
          <div key={k} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wide">
                {SWITCH_INFO[k].label}
                {switches ? (
                  <span className={`ml-2 text-[9px] px-2 py-0.5 rounded-md border ${switches[k] ? STATUS_TONE.visible : STATUS_TONE.removed}`}>{switches[k] ? 'On' : 'Off'}</span>
                ) : null}
              </p>
              <p className="text-[11px] text-gray-500">{SWITCH_INFO[k].blurb}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!switches?.[k]}
              aria-label={`${SWITCH_INFO[k].label} switch`}
              disabled={!switches || busy === `sw:${k}`}
              onClick={() => flip(k)}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${switches?.[k] ? 'bg-emerald-500/70 border-emerald-400/60' : 'bg-white/10 border-white/15'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${switches?.[k] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-white">Recent whispers</h3>
        <div className="flex gap-2">
          {(['all', 'visible', 'hidden'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`${btn} border ${filter === f ? 'border-blue-500/40 text-blue-300 bg-blue-500/10' : 'border-white/10 text-gray-400 bg-white/5'}`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <p className="text-[11px] text-gray-500">No whispers to show.</p>
        ) : rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-500 uppercase font-bold">
                <span className="text-violet-300">{r.alias}</span> · {r.topic} · {new Date(r.createdAt).toLocaleString()} · ♥ {r.hearts}
                <span className={`ml-2 px-2 py-0.5 rounded-md border ${STATUS_TONE[r.status] || ''}`}>{r.status.replace('_', ' ')}</span>
                {r.openReporters > 0 && <span className="ml-2 text-amber-300">{r.openReporters} open report{r.openReporters === 1 ? '' : 's'}</span>}
              </p>
              <p className="text-sm text-gray-100 whitespace-pre-wrap break-words mt-1">{r.text}</p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {r.status === 'visible' ? (
                <>
                  <button disabled={busy === `w:${r.id}`} onClick={() => act(r, 'hide')} className={`${btn} border border-orange-500/30 text-orange-300 bg-orange-500/10`}>Hide</button>
                  <button disabled={busy === `w:${r.id}`} onClick={() => act(r, 'remove')} className={`${btn} border border-red-500/30 text-red-300 bg-red-500/10`}>Delete</button>
                </>
              ) : (
                <button disabled={busy === `w:${r.id}`} onClick={() => act(r, 'restore')} className={`${btn} border border-emerald-500/30 text-emerald-300 bg-emerald-500/10`}>Restore</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
