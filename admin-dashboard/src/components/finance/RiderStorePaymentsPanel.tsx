"use client";
// Riders > Paid to restaurants (owner, 24 Nov 2026): what riders paid pay-before-pickup restaurants out of the hand
// cash ZenWe gave them, recorded in the rider app (Home > Paid amount) with the amount and a photo of the bill.
// Read only. These payments never change a rider's COD cash or earnings: settle the hand cash with the rider
// separately. Data: GET /api/admin/rider-store-payments?from=&to=&riderId=
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminRequest } from '@/lib/api';
import {
  Button, DataTable, Modal, SectionTitle, SegmentedControl, Select, StatTile, Toolbar, type Column, IconRefresh,
} from '@/components/ui';
import { formatDateTime, formatINR, formatPhone, orderCode } from '@/lib/format';

interface StorePayment {
  orderId: string;
  orderNumber?: number | null;
  orderCode?: string | null;
  restaurant: string | null;
  orderStatus: string | null;
  foodTotal: number;
  amount: number | null;
  billUrl: string | null;
  paidAt: string | null;
  rider: { id: string; name: string | null; phone: string | null } | null;
}
interface ListResp { total: number; count: number; payments: StorePayment[] }

type Range = 'today' | '7d' | '30d' | 'all';
const IST_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** UTC instant of IST midnight `daysBack` days ago (the campus runs on IST). */
const istMidnight = (daysBack: number) => {
  const now = Date.now();
  return new Date(Math.floor((now + IST_MS) / DAY_MS) * DAY_MS - IST_MS - daysBack * DAY_MS);
};
const fromFor = (r: Range): Date | null => (r === 'today' ? istMidnight(0) : r === '7d' ? istMidnight(6) : r === '30d' ? istMidnight(29) : null);

export default function RiderStorePaymentsPanel() {
  const [range, setRange] = useState<Range>('today');
  const [riderId, setRiderId] = useState('');
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<StorePayment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      const from = fromFor(range);
      if (from) q.set('from', from.toISOString());
      if (riderId) q.set('riderId', riderId);
      setData(await adminRequest<ListResp>(`/api/admin/rider-store-payments${q.toString() ? `?${q}` : ''}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load rider payments.');
    } finally {
      setLoading(false);
    }
  }, [range, riderId]);
  useEffect(() => { load(); }, [load]);

  // Rider filter options from what was loaded for the whole range (kept while one rider is selected).
  const [riderOptions, setRiderOptions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (riderId || !data) return;
    const seen = new Map<string, string>();
    for (const p of data.payments) if (p.rider && !seen.has(p.rider.id)) seen.set(p.rider.id, p.rider.name || formatPhone(p.rider.phone) || 'Rider');
    setRiderOptions([...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
  }, [data, riderId]);

  const riders = useMemo(() => new Set((data?.payments || []).map((p) => p.rider?.id).filter(Boolean)).size, [data]);

  const columns: Column<StorePayment>[] = [
    { key: 'paidAt', header: 'Paid at', cell: (p) => (p.paidAt ? formatDateTime(p.paidAt) : '–'), sortValue: (p) => (p.paidAt ? new Date(p.paidAt) : null), width: '170px' },
    {
      key: 'rider', header: 'Rider',
      cell: (p) => (
        <div>
          <div className="font-medium text-fg">{p.rider?.name || 'Rider'}</div>
          {p.rider?.phone ? <div className="text-xs text-fg-muted">{formatPhone(p.rider.phone)}</div> : null}
        </div>
      ),
      sortValue: (p) => p.rider?.name || '',
    },
    { key: 'restaurant', header: 'Restaurant', cell: (p) => p.restaurant || '–', sortValue: (p) => p.restaurant || '' },
    { key: 'order', header: 'Order', cell: (p) => orderCode({ orderCode: p.orderCode }, p.orderId), hideBelow: 'md' },
    { key: 'food', header: 'Food total', align: 'right', cell: (p) => formatINR(p.foodTotal), sortValue: (p) => p.foodTotal, hideBelow: 'lg' },
    { key: 'amount', header: 'Paid', align: 'right', cell: (p) => <span className="font-semibold text-fg">{formatINR(p.amount ?? 0)}</span>, sortValue: (p) => p.amount ?? 0 },
    {
      key: 'bill', header: <span className="sr-only">Bill</span>, align: 'right',
      cell: (p) => (p.billUrl
        ? <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setBill(p); }}>View bill</Button>
        : <span className="text-fg-subtle">No photo</span>),
    },
  ];

  return (
    <section>
      <SectionTitle
        title="Paid to restaurants"
        description="What riders paid pay-before-pickup restaurants from ZenWe's hand cash, with the bill photo. This does not change a rider's cash or earnings: settle the hand cash with the rider separately."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile label="Total paid to restaurants" value={data ? formatINR(data.total) : null} loading={loading && !data} />
        <StatTile label="Bills recorded" value={data ? String(data.count) : null} loading={loading && !data} />
        <StatTile label="Riders" value={data ? String(riders) : null} loading={loading && !data} />
      </div>
      <Toolbar end={<Button leftIcon={<IconRefresh size={14} />} loading={loading} onClick={load}>Refresh</Button>}>
        <SegmentedControl
          ariaLabel="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Today' },
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Select aria-label="Rider" value={riderId} onChange={(e) => setRiderId(e.target.value)}>
          <option value="">All riders</option>
          {riderOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Toolbar>
      <DataTable
        caption="Rider payments to restaurants"
        columns={columns}
        rows={data?.payments || []}
        rowKey={(p) => p.orderId}
        loading={loading}
        error={error}
        onRetry={load}
        onRowClick={(p) => (p.billUrl ? setBill(p) : undefined)}
        noun="payments"
        empty={{ title: 'No payments recorded', description: 'Riders record these in the rider app: Home > Paid amount.' }}
      />

      <Modal
        open={!!bill}
        onClose={() => setBill(null)}
        title={bill ? `${bill.restaurant || 'Restaurant'} · ${formatINR(bill.amount ?? 0)}` : 'Bill'}
        description={bill ? `${bill.rider?.name || 'Rider'} · ${orderCode({ orderCode: bill.orderCode }, bill.orderId)}${bill.paidAt ? ` · ${formatDateTime(bill.paidAt)}` : ''}` : undefined}
        size="lg"
      >
        {bill?.billUrl ? <BillPhoto url={bill.billUrl} alt={`Bill from ${bill.restaurant || 'the restaurant'}`} /> : null}
      </Modal>
    </section>
  );
}

// The bill is a private, signed media link on the API host. It is fetched and shown as a blob: image, which the page's
// Content-Security-Policy always allows (img-src permits https: only, so a plain-http local backend would be blocked).
function BillPhoto({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;
    setSrc(null);
    setFailed(false);
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => { if (!alive) return; objectUrl = URL.createObjectURL(b); setSrc(objectUrl); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  if (failed) {
    return (
      <p className="text-sm text-fg-muted">
        Could not load the bill photo. <a className="text-accent underline" href={url} target="_blank" rel="noreferrer">Open it in a new tab</a>.
      </p>
    );
  }
  if (!src) return <p className="text-sm text-fg-muted" role="status">Loading the bill…</p>;
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-h-[70vh] w-full rounded-md bg-surface-2 object-contain" />
      <a className="text-sm text-accent underline" href={url} target="_blank" rel="noreferrer">Open full size</a>
    </div>
  );
}
