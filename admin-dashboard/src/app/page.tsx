"use client";
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAdminSocket } from '@/components/AdminSocketProvider';
import dynamic from 'next/dynamic';
import { useAdminAuth } from '@/utils/useAdminAuth';
import PaymentVerificationModal from '@/components/PaymentVerificationModal';
import { API_URL } from '@/lib/config';
import { adminRequest as apiRequest } from '@/lib/api';
import Link from 'next/link';
import { useLiveSync, useFreshIds, liveLabel, FRESH_ROW_CLASS } from '@/lib/useLiveSync';

// "Needs attention" counters on the overview, kept live by realtime events.
type InboxKey = 'tickets' | 'verifications' | 'pgBookings' | 'wallPending' | 'serviceRequests';
type Inbox = Record<InboxKey, number | null>;
const INBOX_ITEMS: { key: InboxKey; label: string; href: string; liveType: string }[] = [
  { key: 'tickets', label: 'Open tickets', href: '/tickets', liveType: 'ticket' },
  { key: 'verifications', label: 'Student IDs to review', href: '/student-verification', liveType: 'verification' },
  { key: 'pgBookings', label: 'PG booking requests', href: '/pg', liveType: 'pg_booking' },
  { key: 'wallPending', label: 'Wall photos to moderate', href: '/wall', liveType: 'wall_submission' },
  { key: 'serviceRequests', label: 'New service bookings', href: '/service-bookings', liveType: 'service_booking' },
];
const LIVE_HOME_TYPES = ['order', 'rider', 'store', 'ticket', 'verification', 'pg_booking', 'wall_submission', 'wall', 'service_booking'] as const;

const LiveFleetMap = dynamic(() => import('@/components/LiveFleetMap'), { ssr: false });

// Route reference points drawn on the fleet map (real places on the Mangalagiri → SRM AP route).
const CHECKPOINTS = [
  { name: 'Mangalagiri Jn', lat: 16.4422, lng: 80.5604 },
  { name: 'Neerukonda', lat: 16.4715, lng: 80.5055 },
  { name: 'SRM Main Gate', lat: 16.4673, lng: 80.5002 },
  { name: 'Academic Block', lat: 16.4635, lng: 80.5065 },
  { name: 'Hostel Sector', lat: 16.4618, lng: 80.5068 }
];

const ORDER_FEED_LIMIT = 40;

/** fetch against the one backend; throws an Error carrying the server's friendly `message`. */
const errMsg = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const getImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const toNumber = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ─── Types ───────────────────────────────────────────────────
interface AdminStat {
  label: string;
  value: string;
  hint: string;
}

interface LiveOrder {
  id: string;
  kind: 'order' | 'basket';
  customer: string;
  location: string;
  status: string;
  price: number;
  restaurant: string;
  timestamp: Date;
  paymentMethod: string;
  upiStatus?: string;
  upiUTR?: string;
  upiScreenshot?: string;
  riderAssigned: boolean;
  deliveryPartnerName?: string;
  deliveryPartnerPhoto?: string;
}

interface RiderPosition {
  riderId: string;
  riderName: string;
  photoUrl?: string;
  currentCheckpoint?: string;
  activeOrderCount: number;
  isOnline: boolean;
}

interface OperationalEvent {
  id: string;
  type: 'SOS' | 'ISSUE';
  senderRole: string;
  senderName?: string;
  issueType?: string;
  details: string;
  orderId?: string;
  timestamp: Date;
}

interface InterceptedChat {
  orderId: string;
  sender: string;
  senderRole: string;
  message: string;
  timestamp: Date;
}

const mapOrder = (o: any): LiveOrder => ({
  id: String(o.id || o._id),
  kind: 'order',
  customer: o.user?.name || 'Customer',
  location: o.hostelGateDelivery ? 'Hostel gate' : 'Room delivery',
  status: String(o.status || 'Pending'),
  price: toNumber(o.finalPrice ?? o.totalPrice),
  restaurant: o.restaurant?.name || 'Store',
  timestamp: new Date(o.createdAt || Date.now()),
  paymentMethod: String(o.paymentMethod || 'COD'),
  upiStatus: o.upiStatus ? String(o.upiStatus) : undefined,
  upiUTR: o.upiUTR || undefined,
  upiScreenshot: o.upiScreenshot || undefined,
  riderAssigned: !!(o.deliveryPartnerId || o.deliveryPartner),
  deliveryPartnerName: o.deliveryPartner?.name,
  deliveryPartnerPhoto: o.deliveryPartner?.photoUrl,
});

const mapBasket = (b: any): LiveOrder => ({
  id: String(b.id || b._id),
  kind: 'basket',
  customer: b.user?.name || 'Customer',
  location: b.deliveryAddress || 'Hostel delivery',
  status: String(b.status || 'Pending'),
  price: toNumber(b.actualTotal ?? b.estimatedTotal) + toNumber(b.shoppingFee) + toNumber(b.deliveryFee),
  restaurant: '🛒 Mega Basket',
  timestamp: new Date(b.createdAt || Date.now()),
  paymentMethod: String(b.paymentMethod || 'COD'),
  riderAssigned: !!(b.deliveryPartnerId || b.deliveryPartner),
  deliveryPartnerName: b.deliveryPartner?.name,
  deliveryPartnerPhoto: b.deliveryPartner?.photoUrl,
});

// Legacy UPI orders (before COD + Wallet only) can still be waiting for a manual check.
const needsUpiCheck = (o: LiveOrder) => o.kind === 'order' && o.paymentMethod === 'UPI' && o.upiStatus === 'Pending';

const shortId = (id?: string) => (id ? `#${String(id).slice(-6).toUpperCase()}` : '');

// ─── Memoized Components for Performance ───────────────────
const OrderItem = memo(({ order, onVerify, fresh }: { order: LiveOrder, onVerify: (o: LiveOrder) => void, fresh?: boolean }) => {
  const upi = needsUpiCheck(order);
  return (
    <div
      onClick={() => { if (upi) onVerify(order); }}
      className={`group p-4 rounded-3xl bg-white/[0.015] border border-white/5 hover:border-white/10 transition-all duration-300 ${upi ? 'cursor-pointer hover:bg-amber-500/5' : ''} ${fresh ? FRESH_ROW_CLASS : ''}`}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mb-0.5 truncate">{order.restaurant}</p>
          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
            <span className="truncate">{order.customer}</span>
            <span className="text-[9px] text-gray-600 font-black opacity-50 font-mono tracking-tighter">{shortId(order.id)}</span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0 items-start">
          {upi && (
            <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-500 text-black rounded" title="Legacy UPI order: click to verify">VERIFY UPI</span>
          )}
          <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${
            order.status === 'Cancelled' ? 'bg-red-500/10 text-red-500' :
            order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500' :
            'bg-blue-500/10 text-blue-500'
          }`}>
            {order.status}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.03] gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {order.deliveryPartnerName ? (
            <>
              <div className="w-5 h-5 rounded-full overflow-hidden border border-white/10 bg-slate-800 flex items-center justify-center text-[10px]">
                {order.deliveryPartnerPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getImageUrl(order.deliveryPartnerPhoto)} width={20} height={20} alt="" className="object-cover w-5 h-5" />
                ) : '👤'}
              </div>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest truncate max-w-[100px]">
                {order.deliveryPartnerName}
              </span>
            </>
          ) : order.riderAssigned ? (
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Rider assigned</span>
          ) : ['Delivered', 'Cancelled'].includes(order.status) ? (
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{order.paymentMethod}</span>
          ) : (
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Awaiting rider</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-[11px] text-gray-500 font-bold block truncate max-w-[140px]">{order.location}</span>
          <span className="text-xs text-white font-black tracking-tighter">₹{order.price.toFixed(0)} · {order.paymentMethod}</span>
        </div>
      </div>
    </div>
  );
});
OrderItem.displayName = 'OrderItem';

const RiderStatusItem = memo(({ rider }: { rider: RiderPosition }) => (
  <div className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
    <div className={`w-2 h-2 rounded-full ${rider.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`} />
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-black text-white uppercase tracking-tight truncate">{rider.riderName}</p>
      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
        {rider.isOnline ? (rider.currentCheckpoint ? `Near ${rider.currentCheckpoint}` : 'Online') : 'Offline'}
      </p>
    </div>
    <div className="text-right">
      <span className="text-[9px] font-black text-blue-500">{rider.activeOrderCount || 0} active</span>
    </div>
  </div>
));
RiderStatusItem.displayName = 'RiderStatusItem';

const EventItem = memo(({ event, onResolve }: { event: OperationalEvent, onResolve: (id: string) => void }) => (
  <div className={`p-4 rounded-3xl flex items-center gap-4 ${event.type === 'SOS' ? 'bg-red-600/20 border border-red-600 animate-pulse' : 'bg-amber-600/20 border border-amber-600'}`}>
    <div className="text-2xl">{event.type === 'SOS' ? '🚨' : '⚠️'}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[12px] font-black uppercase text-white tracking-widest">
        {event.type === 'SOS' ? 'SOS' : 'Issue'} · {event.senderRole}{event.senderName ? ` (${event.senderName})` : ''}
      </p>
      <p className="text-xs font-black text-white break-words">{event.issueType || event.details}</p>
      {event.issueType && event.details && <p className="text-[11px] text-white/70 break-words">{event.details}</p>}
      {event.orderId && <p className="text-[10px] text-white/50 font-black uppercase mt-1 tracking-tighter">Order <span className="text-[var(--zenvy-gold)]">{shortId(event.orderId)}</span></p>}
    </div>
    <div className="flex flex-col items-end gap-2">
      <span className="text-[10px] font-black text-white opacity-40">
        {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <button
        onClick={() => onResolve(event.id)}
        className="text-[8px] font-black text-white/60 uppercase tracking-widest hover:text-white border border-white/10 px-2 py-1 rounded bg-white/5"
        title="Hide from this screen"
      >
        Dismiss
      </button>
    </div>
  </div>
));
EventItem.displayName = 'EventItem';


export default function AdminHome() {
  const { isAuthed } = useAdminAuth();
  const { socket, isConnected, notifyLive } = useAdminSocket();
  const { mark: markFresh, isFresh } = useFreshIds();
  const [inbox, setInbox] = useState<Inbox>({ tickets: null, verifications: null, pgBookings: null, wallPending: null, serviceRequests: null });
  const [freshInbox, setFreshInbox] = useState<Partial<Record<InboxKey, boolean>>>({});

  const [stats, setStats] = useState<AdminStat[] | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [riders, setRiders] = useState<Record<string, RiderPosition>>({});
  const [operationalEvents, setOperationalEvents] = useState<OperationalEvent[]>([]);
  const [interceptedChats, setInterceptedChats] = useState<InterceptedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [megaMsg, setMegaMsg] = useState('');
  const [megaType, setMegaType] = useState<'info' | 'warning' | 'promo' | 'emergency'>('info');
  const [broadcasting, setBroadcasting] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [selectedUPIOrder, setSelectedUPIOrder] = useState<LiveOrder | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiRequest<any>('/api/admin/stats');
      setStats([
        { label: 'Delivered Revenue', value: data?.revenue || '₹0', hint: 'All delivered orders' },
        { label: 'Active Pipeline', value: data?.activeRevenue || '₹0', hint: `${data?.activeOrders || 0} open orders` },
        { label: 'Approved Riders', value: data?.activeFleet || '0', hint: 'Fleet size' },
        { label: 'Commission', value: data?.commission || '₹0', hint: 'Estimate at 10%' },
        { label: 'Local Vendors', value: data?.localVendorCount || '0', hint: 'Active CampusBites stalls' },
      ]);
      setStatsError(null);
    } catch (err) {
      setStatsError(errMsg(err, 'Could not load dashboard numbers.'));
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const [ordersData, basketsData] = await Promise.all([
        apiRequest<{ orders?: any[] }>(`/api/orders?limit=${ORDER_FEED_LIMIT}`),
        apiRequest<any[]>('/api/mega-basket/admin/all').catch(() => [] as any[]),
      ]);
      const orders = (Array.isArray(ordersData?.orders) ? ordersData.orders : []).map(mapOrder);
      const baskets = (Array.isArray(basketsData) ? basketsData : []).map(mapBasket);
      const merged = [...orders, ...baskets]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, ORDER_FEED_LIMIT);
      setLiveOrders(merged);
      setOrdersError(null);
    } catch (err) {
      setOrdersError(errMsg(err, 'Could not load recent orders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Seed the rider list from the database; sockets keep it live afterwards.
  const fetchRiders = useCallback(async () => {
    try {
      // Page through every rider (100 per page, capped) so riders beyond the newest 100 are on the map too.
      const list: any[] = [];
      for (let page = 1; page <= 20; page++) {
        const data = await apiRequest<{ riders?: any[]; pages?: number }>(`/api/admin/riders?limit=100&page=${page}`);
        const chunk = Array.isArray(data?.riders) ? data.riders : [];
        list.push(...chunk);
        const pages = Number(data?.pages) || 1;
        if (chunk.length < 100 || page >= pages) break;
      }
      setRiders(prev => {
        const next: Record<string, RiderPosition> = { ...prev };
        list.filter(r => r.isApproved).forEach(r => {
          const id = String(r.id || r._id);
          const existing: RiderPosition | undefined = prev[id];
          next[id] = {
            ...existing,
            activeOrderCount: existing?.activeOrderCount ?? 0,
            riderId: id,
            riderName: r.name || 'Rider',
            photoUrl: r.photoUrl || undefined,
            isOnline: existing?.isOnline ?? !!r.isOnline,
          };
        });
        return next;
      });
    } catch {
      // Non-critical: the live socket events still populate riders.
    }
  }, []);

  // Counts for the "Needs attention" strip. Each one fails independently (shown as "–").
  const fetchInbox = useCallback(async (only?: InboxKey[]) => {
    const want = (k: InboxKey) => !only || only.includes(k);
    const count = (v: unknown) => (Array.isArray(v) ? v.length : null);
    const jobs: Partial<Record<InboxKey, Promise<number | null>>> = {};
    if (want('tickets')) jobs.tickets = apiRequest<any[]>('/api/tickets/admin')
      .then(list => (Array.isArray(list) ? list.filter(t => t?.status === 'Open' || t?.status === 'In Progress').length : null));
    if (want('verifications')) jobs.verifications = apiRequest<{ requests?: unknown[] }>('/api/campus/verify/requests?status=pending')
      .then(d => count(d?.requests));
    if (want('pgBookings')) jobs.pgBookings = apiRequest<unknown[]>('/api/pg/admin/bookings?status=Pending').then(count);
    if (want('wallPending')) jobs.wallPending = apiRequest<unknown[]>('/api/wall/admin/pending').then(count);
    if (want('serviceRequests')) jobs.serviceRequests = apiRequest<{ bookings?: unknown[] }>('/api/services/admin/all?status=REQUESTED')
      .then(d => count(d?.bookings));
    const keys = Object.keys(jobs) as InboxKey[];
    const results = await Promise.allSettled(keys.map(k => jobs[k]!));
    setInbox(prev => {
      const next = { ...prev };
      keys.forEach((k, i) => {
        const r = results[i];
        // Keep the last known number if a background refresh fails.
        if (r.status === 'fulfilled') next[k] = r.value;
        else if (prev[k] === null) next[k] = null;
      });
      return next;
    });
  }, []);

  const inboxFreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (inboxFreshTimer.current) clearTimeout(inboxFreshTimer.current); }, []);

  const lastStatsUpdate = useRef(0);
  const throttledFetchStats = useCallback(() => {
    const now = Date.now();
    if (now - lastStatsUpdate.current > 10000) {
      fetchStats();
      lastStatsUpdate.current = now;
    }
  }, [fetchStats]);

  // Called by PaymentVerificationModal; returns an error message (modal stays open) or null.
  const handleVerifyUPI = async (orderId: string, isVerified: boolean): Promise<string | null> => {
    setActionError(null);
    setActionNotice(null);
    try {
      const res = await apiRequest<{ message?: string }>(`/api/orders/${orderId}/verify-upi`, {
        method: 'PUT',
        body: JSON.stringify({ isVerified }),
      });
      setActionNotice(res?.message || (isVerified ? 'Payment verified.' : 'Payment rejected and order cancelled.'));
      fetchOrders();
      fetchStats();
      return null;
    } catch (err) {
      return errMsg(err, 'Could not update the payment.');
    }
  };

  const handleVerifyRequest = useCallback((o: LiveOrder) => setSelectedUPIOrder(o), []);

  const handleAcceptAllPending = async () => {
    if (batchRunning) return;
    if (!confirm('Accept every pending Zenvy-delivered order on behalf of its store and send it to riders?\n\nSkipped (handle them one by one on the Orders page):\n• Stall orders: the stall must confirm first, it delivers them itself.\n• Legacy UPI orders whose payment is not verified yet.\n\nUse this only when stores cannot accept in their app. It cannot be undone.')) return;
    setBatchRunning(true);
    setActionError(null);
    setActionNotice(null);
    try {
      // Accepted one by one through the normal accept endpoint (same checks, rider pool and pushes as
      // a single accept) instead of the bulk status flip, so nothing unpaid or stall-owned slips through.
      const data = await apiRequest<{ orders?: any[] }>('/api/orders?status=Pending&fulfilment=ZENVY&limit=200');
      const pending = (Array.isArray(data?.orders) ? data.orders : []).filter(o => o?.status === 'Pending');
      const eligible = pending.filter(o => o.fulfilment !== 'VENDOR' && !(o.paymentMethod === 'UPI' && o.upiStatus !== 'Verified' && o.paymentStatus !== 'Completed'));
      const skippedUpi = pending.length - eligible.length;
      let accepted = 0;
      let failed = 0;
      for (const o of eligible) {
        try {
          await apiRequest(`/api/orders/${encodeURIComponent(String(o.id || o._id))}/restaurant-accept`, { method: 'PUT', body: JSON.stringify({}) });
          accepted++;
        } catch {
          failed++;
        }
      }
      const parts = [`${accepted} pending order${accepted === 1 ? '' : 's'} accepted.`];
      if (skippedUpi) parts.push(`${skippedUpi} skipped (UPI payment not verified).`);
      if (failed) parts.push(`${failed} could not be accepted (already changed or refused); check the Orders page.`);
      parts.push('Stall orders were not touched.');
      if (failed) setActionError(parts.join(' ')); else setActionNotice(parts.join(' '));
      fetchOrders();
      fetchStats();
    } catch (err) {
      setActionError(errMsg(err, 'Could not accept the pending orders.'));
    } finally {
      setBatchRunning(false);
    }
  };

  const handleBroadcast = () => {
    const message = megaMsg.trim();
    if (!message || broadcasting) return;
    if (!socket || !isConnected) {
      setActionError('Live connection is offline, so the in-app banner cannot be sent right now. Use Push Notifications instead.');
      return;
    }
    if (!confirm('Show this banner in the app to everyone who is online right now?')) return;
    setBroadcasting(true);
    setActionError(null);
    const payload = { message: message.slice(0, 300), type: megaType };
    // Success is shown only when the server acknowledges it. The server drops a broadcast from a
    // socket that is not signed in as admin (e.g. an expired session) without relaying it.
    socket.timeout(8000).emit('admin_broadcast', payload, (err: unknown, ack?: { ok?: boolean; message?: string }) => {
      setBroadcasting(false);
      if (err) {
        setActionError('The server did not confirm the banner, so it may not have been shown. Refresh the page (sign in again if asked) and try once more.');
        return;
      }
      if (!ack || ack.ok !== true) {
        setActionError(ack?.message || 'The server refused the banner. Sign in again and retry.');
        return;
      }
      setActionNotice('Banner sent to everyone currently online. Students who are offline will not see it.');
      setMegaMsg('');
    });
  };

  const handleResolveEvent = useCallback((eventId: string) => {
    setOperationalEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    fetchStats();
    fetchOrders();
    fetchRiders();

    // Polling fallback so the feed never desyncs if a socket event is missed.
    const pollInterval = setInterval(() => {
      fetchOrders();
      throttledFetchStats();
    }, 15000);

    if (!socket) {
      return () => clearInterval(pollInterval);
    }

    const prependOrder = (entry: LiveOrder) => {
      setLiveOrders(prev => (prev.some(o => o.id === entry.id) ? prev : [entry, ...prev].slice(0, ORDER_FEED_LIMIT)));
    };

    // admin_newOrder: { id, restaurant, customer, drop, totalPrice, finalPrice, paymentMethod, paymentStatus, createdAt }
    const handleIncomingOrder = (order: any) => {
      throttledFetchStats();
      const orderId = order?.id || order?._id;
      if (!orderId) return;
      prependOrder({
        id: String(orderId),
        kind: 'order',
        customer: order.customer || order.user?.name || 'Customer',
        location: order.hostelGateDelivery ? 'Hostel gate' : (order.drop || 'Room delivery'),
        status: order.status || 'Pending',
        price: toNumber(order.finalPrice ?? order.totalPrice),
        restaurant: (typeof order.restaurant === 'string' ? order.restaurant : order.restaurant?.name) || 'Store',
        timestamp: new Date(order.createdAt || Date.now()),
        paymentMethod: order.paymentMethod || 'COD',
        riderAssigned: false,
      });
    };

    // admin_newMegaBasket: { id, customer, address, estimatedTotal, paymentMethod, status }
    const handleIncomingMegaBasket = (basket: any) => {
      throttledFetchStats();
      const basketId = basket?.id || basket?._id;
      if (!basketId) return;
      prependOrder({
        id: String(basketId),
        kind: 'basket',
        customer: basket.customer || basket.user?.name || 'Customer',
        location: basket.address || 'Hostel delivery',
        status: basket.status || 'Pending',
        price: toNumber(basket.estimatedTotal),
        restaurant: '🛒 Mega Basket',
        timestamp: new Date(),
        paymentMethod: basket.paymentMethod || 'COD',
        riderAssigned: false,
      });
    };

    const handleStatusUpdated = (data: any) => {
      throttledFetchStats();
      const targetId = String(data?.id || data?.orderId || '');
      if (!targetId || !data?.status) return;
      setLiveOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: String(data.status) } : o));
    };

    const handleOrderCancelled = (data: any) => {
      const targetId = String(data?.orderId || '');
      if (!targetId) return;
      setLiveOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: 'Cancelled' } : o));
    };

    let pendingRidersUpdate: Record<string, RiderPosition> = {};
    let riderUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleRiderLocation = (data: any) => {
      if (!data?.riderId) return;
      const id = String(data.riderId);
      pendingRidersUpdate[id] = {
        riderId: id,
        riderName: data.riderName || 'Rider',
        currentCheckpoint: data.currentCheckpoint,
        activeOrderCount: toNumber(data.activeOrderCount),
        isOnline: data.isOnline !== false,
      };
      if (!riderUpdateTimeout) {
        riderUpdateTimeout = setTimeout(() => {
          const batch = pendingRidersUpdate;
          pendingRidersUpdate = {};
          riderUpdateTimeout = null;
          setRiders(prev => {
            const next = { ...prev };
            Object.values(batch).forEach(r => { next[r.riderId] = { ...(prev[r.riderId] || {}), ...r, photoUrl: prev[r.riderId]?.photoUrl }; });
            return next;
          });
        }, 1500); // throttle map/list re-renders
      }
    };

    const upsertRider = (riderId: string, patch: Partial<RiderPosition>) => {
      setRiders(prev => ({
        ...prev,
        [riderId]: {
          activeOrderCount: prev[riderId]?.activeOrderCount ?? 0,
          riderName: prev[riderId]?.riderName ?? 'Rider',
          isOnline: prev[riderId]?.isOnline ?? false,
          currentCheckpoint: prev[riderId]?.currentCheckpoint,
          photoUrl: prev[riderId]?.photoUrl,
          ...patch,
          riderId,
        },
      }));
    };

    const handleRiderOnline = (data: any) => {
      if (!data?.riderId) return;
      upsertRider(String(data.riderId), { isOnline: true, ...(data.name ? { riderName: data.name } : {}) });
    };

    const handleRiderOffline = (data: any) => {
      if (!data?.riderId) return;
      upsertRider(String(data.riderId), { isOnline: false });
    };

    const handleRiderStatus = (data: any) => {
      if (!data?.riderId) return;
      upsertRider(String(data.riderId), { isOnline: !!data.isOnline, ...(data.name ? { riderName: data.name } : {}) });
    };

    const handleOrderAccepted = (data: any) => {
      const targetId = String(data?.orderId || '');
      if (!targetId) return;
      setLiveOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: 'Accepted', riderAssigned: true, deliveryPartnerName: data.riderName || o.deliveryPartnerName } : o));
    };

    const handleDeliveryComplete = (data: any) => {
      throttledFetchStats();
      const targetId = String(data?.orderId || '');
      if (!targetId) return;
      setLiveOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: 'Delivered' } : o));
    };

    const handleOrderUnassigned = (data: any) => {
      const targetId = String(data?.orderId || '');
      if (!targetId) return;
      setLiveOrders(prev => prev.map(o => o.id === targetId ? { ...o, status: 'Pending', riderAssigned: false, deliveryPartnerName: undefined, deliveryPartnerPhoto: undefined } : o));
    };

    const handleRiderProfileUpdated = (data: any) => {
      const riderId = String(data?.riderId || '');
      if (!riderId) return;
      setRiders(prev => (prev[riderId]
        ? { ...prev, [riderId]: { ...prev[riderId], riderName: data.name || prev[riderId].riderName, photoUrl: data.photoUrl || prev[riderId].photoUrl } }
        : prev));
    };

    const handleSosReceived = (data: any) => {
      setOperationalEvents(prev => [{
        id: `sos-${data?.riderId || 'rider'}-${Date.now()}`,
        type: 'SOS' as const,
        senderRole: 'Rider',
        senderName: data?.riderName ? String(data.riderName) : undefined,
        details: 'Emergency SOS triggered. Call the rider now.',
        orderId: data?.orderId ? String(data.orderId) : undefined,
        timestamp: new Date(),
      }, ...prev].slice(0, 10));
    };

    const handleIssueReported = (data: any) => {
      setOperationalEvents(prev => [{
        id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'ISSUE' as const,
        senderRole: String(data?.senderRole || 'User'),
        senderName: data?.senderName ? String(data.senderName) : undefined,
        issueType: data?.issueType ? String(data.issueType) : undefined,
        details: String(data?.details || ''),
        orderId: data?.orderId ? String(data.orderId) : undefined,
        timestamp: new Date(),
      }, ...prev].slice(0, 10));
    };

    const handleInterceptChat = (data: any) => {
      if (!data?.message) return;
      const ts = new Date(data.timestamp || Date.now());
      setInterceptedChats(prev => [{
        orderId: String(data.orderId || ''),
        sender: String(data.sender || 'Unknown'),
        senderRole: String(data.senderRole || ''),
        message: String(data.message),
        timestamp: Number.isNaN(ts.getTime()) ? new Date() : ts,
      }, ...prev].slice(0, 30));
    };

    socket.on('admin_newOrder', handleIncomingOrder);
    socket.on('admin_newMegaBasket', handleIncomingMegaBasket);
    socket.on('statusUpdated', handleStatusUpdated);
    socket.on('orderCancelled', handleOrderCancelled);
    socket.on('admin_rider_location', handleRiderLocation);
    socket.on('admin_rider_online', handleRiderOnline);
    socket.on('admin_rider_offline', handleRiderOffline);
    socket.on('admin_rider_status', handleRiderStatus);
    socket.on('admin_order_accepted', handleOrderAccepted);
    socket.on('admin_delivery_complete', handleDeliveryComplete);
    socket.on('order_unassigned', handleOrderUnassigned);
    socket.on('rider_profile_updated', handleRiderProfileUpdated);
    socket.on('sos_received', handleSosReceived);
    socket.on('admin_issue_reported', handleIssueReported);
    socket.on('admin_intercept_chat', handleInterceptChat);

    return () => {
      clearInterval(pollInterval);
      socket.off('admin_newOrder', handleIncomingOrder);
      socket.off('admin_newMegaBasket', handleIncomingMegaBasket);
      socket.off('statusUpdated', handleStatusUpdated);
      socket.off('orderCancelled', handleOrderCancelled);
      socket.off('admin_rider_location', handleRiderLocation);
      socket.off('admin_rider_online', handleRiderOnline);
      socket.off('admin_rider_offline', handleRiderOffline);
      socket.off('admin_rider_status', handleRiderStatus);
      socket.off('admin_order_accepted', handleOrderAccepted);
      socket.off('admin_delivery_complete', handleDeliveryComplete);
      socket.off('order_unassigned', handleOrderUnassigned);
      socket.off('rider_profile_updated', handleRiderProfileUpdated);
      socket.off('sos_received', handleSosReceived);
      socket.off('admin_issue_reported', handleIssueReported);
      socket.off('admin_intercept_chat', handleInterceptChat);
      if (riderUpdateTimeout) clearTimeout(riderUpdateTimeout);
    };
  }, [isAuthed, socket, fetchStats, fetchOrders, fetchRiders, throttledFetchStats]);

  useEffect(() => {
    if (isAuthed) fetchInbox();
  }, [isAuthed, fetchInbox]);

  // Realtime sync (`admin:changed` / `data:changed`, ids only): refetch just the widgets that changed.
  useLiveSync(LIVE_HOME_TYPES, (events, { reconnect }) => {
    const has = (t: string) => reconnect || events.some(e => e.type === t);
    if (has('order')) {
      fetchOrders();
      // Stats are heavier; refresh them at most every 10 s.
      throttledFetchStats();
      if (!reconnect) markFresh(events.filter(e => e.type === 'order').map(e => e.id));
    }
    if (has('rider')) { fetchRiders(); throttledFetchStats(); }
    if (has('store') && !has('order')) throttledFetchStats();
    const inboxKeys = INBOX_ITEMS
      .filter(i => has(i.liveType) || (i.key === 'wallPending' && events.some(e => e.type === 'wall' && e.scope === 'submissions')))
      .map(i => i.key);
    if (inboxKeys.length) {
      fetchInbox(inboxKeys);
      if (!reconnect) {
        setFreshInbox(prev => ({ ...prev, ...Object.fromEntries(inboxKeys.map(k => [k, true])) }));
        if (inboxFreshTimer.current) clearTimeout(inboxFreshTimer.current);
        inboxFreshTimer.current = setTimeout(() => setFreshInbox({}), 6000);
      }
    }
    if (reconnect) return;
    const newOrders = events.filter(e => e.type === 'order' && e.action === 'created');
    const label = liveLabel(newOrders, 'order');
    if (label) notifyLive(label);
    for (const [type, noun] of [['ticket', 'support ticket'], ['verification', 'verification request'], ['pg_booking', 'PG booking request'], ['wall_submission', 'wall photo'], ['service_booking', 'service booking']] as const) {
      const l = liveLabel(events.filter(e => e.type === type && e.action === 'created'), noun);
      if (l) notifyLive(l);
    }
  }, { enabled: isAuthed });

  if (!isAuthed) return null; // NexusLayoutClient shows the auth loader / redirect

  const riderList = Object.values(riders);
  const onlineCount = riderList.filter(r => r.isOnline).length;
  const upiPendingCount = liveOrders.filter(needsUpiCheck).length;

  return (
    <div className="space-y-12 animate-fade-in relative pb-20">
      <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-white italic tracking-tighter">COMMAND<span className="text-blue-500">CENTER</span></h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-1">Live operations · SRM AP</p>
        </div>
        <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isConnected ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {isConnected ? 'Live updates on' : 'Live updates offline · polling every 15s'}
        </span>
      </header>

      {(actionError || actionNotice) && (
        <div className={`p-4 rounded-xl border text-sm font-bold flex justify-between gap-4 ${actionError ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
          <span>{actionError || actionNotice}</span>
          <button onClick={() => { setActionError(null); setActionNotice(null); }} className="text-[10px] font-black uppercase tracking-wider opacity-70 hover:opacity-100">Close</button>
        </div>
      )}

      {/* ─── Hero Metrics ─── */}
      {statsError && !stats ? (
        <div className="glass-card p-6 flex justify-between items-center gap-4">
          <p className="text-sm font-bold text-red-400">{statsError}</p>
          <button onClick={fetchStats} className="text-[10px] font-black uppercase tracking-wider text-gray-300 underline">Retry</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {(stats || Array.from({ length: 5 }, (_, i) => ({ label: '', value: '', hint: String(i) }))).map((stat, i) => (
            <div key={i} className="glass-card p-8 group overflow-hidden relative">
              {stats ? (
                <>
                  <p className="stat-label tracking-[0.2em]">{stat.label}</p>
                  <h4 className="text-3xl font-black text-white mt-2">{stat.value}</h4>
                  <p className="text-[11px] font-bold text-gray-500 mt-1">{stat.hint}</p>
                </>
              ) : (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 w-24 bg-white/10 rounded" />
                  <div className="h-8 w-20 bg-white/10 rounded" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Needs attention (live) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Needs attention">
        {INBOX_ITEMS.map(item => {
          const value = inbox[item.key];
          return (
            <Link key={item.key} href={item.href} className={`glass-card p-5 flex items-center justify-between gap-3 border border-white/5 hover:border-white/15 transition-colors ${freshInbox[item.key] ? FRESH_ROW_CLASS : ''}`}>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{item.label}</span>
              <span className={`text-2xl font-black ${value ? 'text-amber-300' : 'text-white'}`}>{value === null ? '–' : value}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
        {/* ─── Fleet map ─── */}
        <div className="col-span-1 lg:col-span-2">
          <div className="glass-card p-2 border-white/5 relative overflow-hidden bg-slate-900/50 h-[550px]">
            <LiveFleetMap riders={riders} checkpoints={CHECKPOINTS} />
          </div>
          <p className="text-[11px] text-gray-600 mt-2">Riders appear on the map at the last route checkpoint their app reported.</p>
        </div>

        {/* ─── Ops stream ─── */}
        <div className="space-y-6">
          <h3 className="text-xl font-black tracking-tighter uppercase text-white">Ops <span className="text-[var(--zenvy-gold)]">Stream</span></h3>
          <div className="glass-card h-[450px] overflow-y-auto p-6 space-y-4 scrollbar-hide border-white/10">

            {operationalEvents.map(event => (
              <EventItem key={event.id} event={event} onResolve={handleResolveEvent} />
            ))}
            {operationalEvents.length > 0 && <div className="h-px bg-white/5 my-4" />}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Riders</h4>
                <span className="text-[9px] font-black text-emerald-500 uppercase px-2 py-0.5 bg-emerald-500/10 rounded-md">
                  {onlineCount} online
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {riderList.length === 0 ? (
                  <p className="text-[11px] text-gray-600 italic text-center py-6">No approved riders yet.</p>
                ) : riderList.sort((a, b) => Number(b.isOnline) - Number(a.isOnline)).map(rider => (
                  <RiderStatusItem key={rider.riderId} rider={rider} />
                ))}
              </div>
            </div>

            <div className="h-px bg-white/5 my-4" />

            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Recent orders</h4>
              {upiPendingCount > 0 && (
                <span className="text-[9px] font-black text-amber-400 uppercase px-2 py-0.5 bg-amber-500/10 rounded-md">{upiPendingCount} legacy UPI to verify</span>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4 text-gray-500">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-[12px] uppercase font-black tracking-widest">Loading orders...</p>
              </div>
            ) : ordersError && liveOrders.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-xs font-bold text-red-400">{ordersError}</p>
                <button onClick={fetchOrders} className="text-[10px] font-black uppercase tracking-wider text-gray-300 underline">Retry</button>
              </div>
            ) : liveOrders.length === 0 ? (
              <p className="text-center py-10 text-gray-600 text-xs italic tracking-wide">No orders yet.</p>
            ) : (
              liveOrders.map((order) => (
                <OrderItem key={`${order.kind}-${order.id}`} order={order} onVerify={handleVerifyRequest} fresh={order.kind === 'order' && isFresh(order.id)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Bulk action ─── */}
      <div className="glass-card p-10 flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1 space-y-2">
          <h3 className="text-2xl font-black text-white tracking-tight">Stuck orders</h3>
          <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
            Pending orders that nobody picks up are cancelled and refunded automatically after the server timeout (15 minutes by default).
            If stores are reachable by phone but cannot use their app, you can accept all pending orders at once.
          </p>
        </div>
        <div className="flex gap-4 print:hidden">
          <button
            onClick={handleAcceptAllPending}
            disabled={batchRunning}
            className="px-8 py-4 bg-[var(--zenvy-gold)] disabled:opacity-50 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-black hover:brightness-110 transition-all"
          >
            {batchRunning ? 'Working...' : 'Accept all pending'}
          </button>
        </div>
      </div>

      {/* ─── Communication ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <div className="glass-card p-8 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">📢</span>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest">In-app Banner</h3>
                <p className="text-[11px] text-gray-500">Shown live to everyone who has the app open. For phones that are closed, use Push Notifications.</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {(['info', 'warning', 'promo', 'emergency'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setMegaType(t)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                      megaType === t
                        ? t === 'emergency' ? 'bg-red-600 border-red-400 text-white' :
                          t === 'warning'   ? 'bg-amber-500 border-amber-400 text-black' :
                          t === 'promo'     ? 'bg-emerald-600 border-emerald-400 text-white' :
                                              'bg-blue-600 border-blue-400 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {t === 'emergency' ? '🚨' : t === 'warning' ? '⚠️' : t === 'promo' ? '🎉' : '📢'} {t}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                maxLength={280}
                value={megaMsg}
                onChange={e => setMegaMsg(e.target.value)}
                placeholder="Type your message. {{username}} is replaced with each student's name."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/40 resize-none transition-all"
              />
            </div>
          </div>
          <button
            disabled={!megaMsg.trim() || broadcasting}
            onClick={handleBroadcast}
            className="w-full mt-6 py-4 rounded-xl text-[13px] font-black uppercase tracking-widest bg-[var(--zenvy-gold)] text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {broadcasting ? 'Sending...' : 'Send Banner'}
          </button>
        </div>

        <div className="glass-card p-8 border border-blue-500/20 bg-black/60 relative overflow-hidden flex flex-col h-[400px]">
          <div className="absolute top-0 right-0 p-4">
            <span className={`flex items-center gap-2 px-2 py-1 rounded text-[9px] font-black uppercase border ${isConnected ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} /> {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📡</span>
            <div>
              <h3 className="text-xl font-black uppercase tracking-widest text-blue-400">Order Chat Feed</h3>
              <p className="text-[11px] text-gray-500 font-mono tracking-tight">Customer and rider messages since this page opened</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {interceptedChats.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs font-mono text-gray-600">No order chat messages yet.</p>
              </div>
            ) : interceptedChats.map((chat, idx) => (
              <div key={`${chat.orderId}-${chat.timestamp.getTime()}-${idx}`} className="bg-white/5 border border-white/5 p-3 rounded-lg flex flex-col gap-1">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 truncate">
                    {chat.senderRole} <span className="text-white normal-case">{chat.sender}</span>
                  </span>
                  <span className="text-[8px] font-mono text-gray-600 shrink-0">{chat.timestamp.toLocaleTimeString()}</span>
                </div>
                <p className="text-sm font-mono text-blue-300 break-words">{chat.message}</p>
                {chat.orderId && <span className="text-[8px] font-black text-yellow-600/50 uppercase">Order {shortId(chat.orderId)}</span>}
              </div>
            ))}
          </div>
        </div>

      </div>

      <PaymentVerificationModal
        isOpen={!!selectedUPIOrder}
        order={selectedUPIOrder}
        onClose={() => setSelectedUPIOrder(null)}
        onVerify={handleVerifyUPI}
      />
    </div>
  );
}
