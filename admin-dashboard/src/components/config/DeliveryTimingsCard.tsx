"use client";
// Delivery timings (owner, 14 Nov 2026; backend utils/deliveryGroups): the delivery windows and order cutoffs of each
// timing group. GET /api/admin/delivery-groups, saved through POST /api/admin/config { key: 'DELIVERY_GROUPS' }
// (validated by the server: start < end, cutoff at or before the start, no overlaps, at most 6 windows).
// Which group a product is in: the product's "Delivery timing" (product editor), else the store's (store editor),
// else the store's type.
import { Badge, Button, Card, CardBody, CardHeader, LoadingState, Notice, useConfirm } from '@/components/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { adminRequest as apiRequest } from '@/lib/api';

type GroupId = 'food' | 'grocery' | 'bakery';
interface Window { id?: string; start: string; end: string; cutoff: string }
interface Group { label: string; slots: Window[] }
interface Resp { groups: Record<GroupId, Group>; defaults: Record<GroupId, Group>; enabled: boolean }

const ORDER: GroupId[] = ['food', 'grocery', 'bakery'];
const HELP: Record<GroupId, string> = {
  food: 'Default: lunch 12:30–1 PM (order by 11:30 AM) and the evening 7–7:15, 8–8:15 and 9–9:30 PM.',
  grocery: 'Default: 12–2 PM, order by 7 AM the same day.',
  bakery: 'Default: 4–6 PM, order by 2 PM the same day.',
};

const to12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const strip = (slots: Window[]) => slots.map(({ start, end, cutoff }) => ({ start, end, cutoff }));
const same = (a: Window[], b: Window[]) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));

export default function DeliveryTimingsCard() {
  const confirm = useConfirm();
  const [data, setData] = useState<Resp | null>(null);
  const [form, setForm] = useState<Record<GroupId, Window[]> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<Partial<Record<GroupId, { kind: 'ok' | 'err'; text: string }>>>({});
  const [saving, setSaving] = useState<GroupId | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const d = await apiRequest<Resp>('/api/admin/delivery-groups');
      setData(d);
      setForm({ food: strip(d.groups.food.slots), grocery: strip(d.groups.grocery.slots), bakery: strip(d.groups.bakery.slots) });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the delivery timings.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const edit = (g: GroupId, i: number, field: keyof Window, value: string) => {
    setMsg((m) => ({ ...m, [g]: undefined }));
    setForm((f) => f && ({ ...f, [g]: f[g].map((w, k) => (k === i ? { ...w, [field]: value } : w)) }));
  };
  const add = (g: GroupId) => setForm((f) => {
    if (!f) return f;
    const last = f[g][f[g].length - 1];
    return { ...f, [g]: [...f[g], last ? { start: last.end, end: last.end, cutoff: last.end } : { start: '12:00', end: '13:00', cutoff: '11:00' }] };
  });
  const remove = (g: GroupId, i: number) => setForm((f) => f && ({ ...f, [g]: f[g].filter((_, k) => k !== i) }));

  const save = async (g: GroupId, slots: Window[]) => {
    if (!data) return;
    const ok = await confirm({
      title: `Save ${data.groups[g].label} timings?`,
      description: 'New orders follow the new windows at once. Orders already placed keep their delivery time.',
      confirmLabel: 'Save timings',
    });
    if (!ok) return;
    setSaving(g);
    try {
      const r = await apiRequest<{ groups: Record<GroupId, Group> }>('/api/admin/config', { method: 'POST', body: JSON.stringify({ key: 'DELIVERY_GROUPS', value: { [g]: { slots: strip(slots) } } }) });
      setData((d) => d && ({ ...d, groups: r.groups }));
      setForm((f) => f && ({ ...f, [g]: strip(r.groups[g].slots) }));
      setMsg((m) => ({ ...m, [g]: { kind: 'ok', text: 'Saved. New orders use these windows now.' } }));
    } catch (err) {
      setMsg((m) => ({ ...m, [g]: { kind: 'err', text: err instanceof Error ? err.message : 'Could not save.' } }));
    } finally {
      setSaving(null);
    }
  };

  if (loadError) return <Notice tone="danger">{loadError} <Button size="sm" variant="ghost" onClick={load}>Try again</Button></Notice>;
  if (!data || !form) return <LoadingState label="Loading delivery timings" />;

  return (
    <Card>
      <CardHeader
        title="Delivery timings"
        description="When each kind of product is delivered and until when it can be ordered. After a cutoff, orders go to the next window (tomorrow's when today's are over). Set a product's or store's timing group in its editor in Stores."
      />
      <CardBody className="space-y-6">
        {!data.enabled && <Notice tone="warning">Timing groups are switched off on the server (DELIVERY_GROUPS=off): the old three slots apply.</Notice>}
        {ORDER.map((g) => {
          const rows = form[g];
          const dirty = !same(rows, data.groups[g].slots);
          return (
            <section key={g} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{data.groups[g].label}</h3>
                  <p className="text-xs text-fg-muted">{HELP[g]}</p>
                </div>
                {dirty ? <Badge tone="warning">Not saved</Badge> : <Badge>{rows.length} {rows.length === 1 ? 'window' : 'windows'}</Badge>}
              </div>
              <div className="space-y-2">
                {rows.map((w, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-3">
                    <label className="text-xs text-fg-muted">Order by
                      <input type="time" className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg" value={w.cutoff} onChange={(e) => edit(g, i, 'cutoff', e.target.value)} />
                    </label>
                    <label className="text-xs text-fg-muted">Deliver from
                      <input type="time" className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg" value={w.start} onChange={(e) => edit(g, i, 'start', e.target.value)} />
                    </label>
                    <label className="text-xs text-fg-muted">to
                      <input type="time" className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg" value={w.end} onChange={(e) => edit(g, i, 'end', e.target.value)} />
                    </label>
                    <p className="pb-2 text-xs text-fg-muted">Order before {to12(w.cutoff)} → delivered {to12(w.start)}–{to12(w.end)}</p>
                    {rows.length > 1 && <Button size="sm" variant="ghost" onClick={() => remove(g, i)}>Remove</Button>}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {rows.length < 6 && <Button size="sm" variant="secondary" onClick={() => add(g)}>Add window</Button>}
                <Button size="sm" variant="ghost" disabled={same(rows, data.defaults[g].slots)} onClick={() => setForm((f) => f && ({ ...f, [g]: strip(data.defaults[g].slots) }))}>Back to defaults</Button>
                <Button size="sm" variant="primary" disabled={!dirty} loading={saving === g} onClick={() => save(g, rows)}>Save</Button>
              </div>
              {msg[g] && <p className={`text-sm ${msg[g]!.kind === 'ok' ? 'text-success-text' : 'text-danger-text'}`}>{msg[g]!.text}</p>}
            </section>
          );
        })}
        <p className="text-xs text-fg-muted">Laundry and other services are not in these windows: the student picks their own pickup time when booking.</p>
      </CardBody>
    </Card>
  );
}
