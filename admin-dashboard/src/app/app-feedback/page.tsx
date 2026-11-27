"use client";
// App feedback (owner, 27 Nov 2026): what customers said in the box shown after their first delivered order
// (stars + comment; each one earned +30 ZenWe Points once). The Play Store review in that box is separate and
// unrewarded, so it does not appear here. Backend: GET /api/admin/app-feedback (routes/feedbackRoutes.js).
import { useCallback, useEffect, useState } from 'react';
import { adminRequest } from '@/lib/api';
import { useAdminAuth } from '@/utils/useAdminAuth';
import { Button, Card, CardBody, PageHeader, StatTile, IconRefresh } from '@/components/ui';
import { formatDateTime, formatPhone } from '@/lib/format';

interface FeedbackItem {
  id: string;
  rating: number;
  comment: string | null;
  orderId: string | null;
  pointsAwarded: number;
  platform: string | null;
  appVersion: string | null;
  at: string;
  user: { id: string; name: string | null; phone: string | null };
}
interface FeedbackReport { count: number; average: number | null; items: FeedbackItem[] }

const stars = (n: number) => '★★★★★'.slice(0, Math.max(0, Math.min(5, n))) + '☆☆☆☆☆'.slice(0, 5 - Math.max(0, Math.min(5, n)));

export default function AppFeedbackPage() {
  const { isAuthed } = useAdminAuth();
  const [data, setData] = useState<FeedbackReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setData(await adminRequest<FeedbackReport>('/api/admin/app-feedback'));
    } catch (e: any) {
      setError(e?.message || 'Could not load the feedback.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (isAuthed) load(); }, [isAuthed, load]);

  const low = data ? data.items.filter((i) => i.rating <= 2).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="App feedback"
        description="What customers told you after their first delivered order. Each one earned +30 ZenWe Points once; Play Store reviews are separate and never rewarded."
        actions={<Button leftIcon={<IconRefresh size={14} />} loading={loading} onClick={load}>Refresh</Button>}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Feedback received" loading={loading && !data} value={data ? data.count : null} />
        <StatTile label="Average stars" loading={loading && !data} value={data && data.average != null ? `${data.average} / 5` : data ? '—' : null} />
        <StatTile label="1–2 stars" loading={loading && !data} tone={low > 0 ? 'warning' : 'neutral'} value={data ? low : null} hint="in the latest 200" />
      </section>
      {error && <p className="text-sm text-danger-text">{error}</p>}
      {data && data.items.length === 0 && (
        <Card><CardBody><p className="text-sm text-fg-muted">No feedback yet. Customers see the box on Home after their first delivered order.</p></CardBody></Card>
      )}
      <div className="space-y-3">
        {data?.items.map((f) => (
          <Card key={f.id}>
            <CardBody>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-lg tracking-wide text-amber-500" aria-label={`${f.rating} out of 5 stars`}>{stars(f.rating)}</span>
                <span className="text-xs text-fg-muted">{formatDateTime(f.at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{f.comment || <span className="text-fg-muted">No comment, stars only.</span>}</p>
              <p className="mt-2 text-xs text-fg-muted">
                {f.user.name || 'Customer'}{f.user.phone ? ` · ${formatPhone(f.user.phone)}` : ''}
                {f.appVersion ? ` · app ${f.appVersion}` : ''}{f.platform ? ` (${f.platform})` : ''}
                {f.pointsAwarded ? ` · +${f.pointsAwarded} points` : ''}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
