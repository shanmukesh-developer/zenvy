"use client";
// App sections control (owner, 24 Nov 2026: "a control section in admin website which we can enable or disable the
// sections we have"). Every app section's on/off switch in one list: food, groceries, bakeries, Mega Basket, Deals &
// spin, the Local tab, PG stays, Co-Ride, shared autos, rentals, campus events, laundry, repairs & other services, and
// the Campus extras (friends, Whispers, After Dark). Backend: GET / PUT /api/admin/app-sections (utils/appSections; each
// entry writes the section's own flag, audited). The customer app follows within about a minute.
import { Badge, Card, CardBody, CardHeader, Notice, Switch, useConfirm } from '@/components/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { adminRequest as apiRequest } from '@/lib/api';

type Section = { key: string; label: string; group: string; description: string; enabled: boolean | null };

// Groups follow the app, top to bottom; a group the server adds later goes after these, in the order it arrives.
const GROUP_ORDER = ['Home', 'Groceries tab', 'Local tab', 'Services tab', 'Campus'];
const groupRank = (g: string) => { const i = GROUP_ORDER.indexOf(g); return i === -1 ? GROUP_ORDER.length : i; };

export default function LaunchSwitchesCard() {
  const confirm = useConfirm();
  const [sections, setSections] = useState<Section[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ sections: Section[] }>('/api/admin/app-sections');
      setSections(res.sections);
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Could not load the app sections.' });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const flip = async (s: Section, next: boolean) => {
    const ok = await confirm({
      title: `Turn ${next ? 'on' : 'off'} ${s.label} for every student?`,
      description: s.description,
      confirmLabel: next ? 'Turn on' : 'Turn off',
      tone: next ? undefined : 'danger',
    });
    if (!ok) return;
    setBusy(s.key);
    setMsg(null);
    try {
      const res = await apiRequest<{ section: Section; sections: Section[] }>(`/api/admin/app-sections/${encodeURIComponent(s.key)}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: next }),
      });
      setSections(res.sections);
      setMsg({ kind: 'ok', text: `${s.label} is now ${res.section.enabled ? 'on' : 'off'}. Students see it the next time they open or refresh the app.` });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Could not change the section.' });
    } finally {
      setBusy(null);
    }
  };

  const groups = sections ? [...new Set(sections.map((s) => s.group))].sort((a, b) => groupRank(a) - groupRank(b)) : [];
  return (
    <Card>
      <CardHeader
        title="App sections"
        description="Turn each part of the customer app on or off. Off hides it in the app and stops new orders and bookings; existing orders and bookings stay visible."
      />
      <CardBody className="space-y-5">
        {!sections && !msg && <p className="text-sm text-fg-muted">Loading…</p>}
        {groups.map((g) => (
          <div key={g} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{g}</p>
            {sections!.filter((s) => s.group === g).map((s) => (
              <div key={s.key} className="flex items-start gap-3">
                <div className="flex-1">
                  <Switch
                    checked={!!s.enabled}
                    disabled={s.enabled === null || busy === s.key}
                    onChange={(next) => void flip(s, next)}
                    label={s.label}
                    description={s.description}
                  />
                </div>
                <Badge tone={s.enabled === null ? 'warning' : s.enabled ? 'success' : 'neutral'}>
                  {s.enabled === null ? 'Unknown' : s.enabled ? 'On' : 'Off'}
                </Badge>
              </div>
            ))}
          </div>
        ))}
        {msg && <Notice tone={msg.kind === 'ok' ? 'success' : 'danger'}>{msg.text}</Notice>}
      </CardBody>
    </Card>
  );
}
