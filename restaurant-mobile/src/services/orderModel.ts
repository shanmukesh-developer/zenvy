// Turns server order / menu rows into the shapes the UI renders, plus IST time helpers.
import type { MenuItem, Order, OrderItem, OrderStage, StoreState } from '../types';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function stageOf(status: string): OrderStage {
  switch (status) {
    case 'Pending': return 'new';
    case 'Accepted':
    case 'Preparing': return 'preparing';
    case 'ReadyForPickup':
    case 'Picking': return 'ready';
    case 'PickedUp':
    case 'ArrivedAtGate': return 'pickedUp';
    default: return 'past'; // Delivered, Cancelled (and anything unknown)
  }
}

export const isActiveStage = (s: OrderStage) => s === 'preparing' || s === 'ready' || s === 'pickedUp';

/** Same short id as the customer app: last 6 of the UUID, upper-case. */
export function shortId(id: string): string {
  const clean = String(id || '').replace(/-/g, '');
  return clean ? clean.slice(-6).toUpperCase() : '';
}

export function firstName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const f = name.trim().split(/\s+/)[0];
  return f || null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const titleCase = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const valueText = (v: any): string => {
  if (v === null || v === undefined || v === false) return '';
  if (v === true) return 'Yes';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (Array.isArray(v)) return v.map(valueText).filter(Boolean).join(', ');
  if (typeof v === 'object') return valueText(v.name ?? v.label ?? v.value ?? '');
  return '';
};

/** `{ size: 'Large', crustType: 'Cheese Burst' }` → "Size: Large · Crust Type: Cheese Burst" */
export function formatCustomizations(c: unknown): string | null {
  let obj: any = c;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return obj.trim() || null; }
  }
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) return valueText(obj) || null;
  const parts = Object.keys(obj)
    .map((k) => {
      const v = valueText(obj[k]);
      return v ? `${titleCase(k)}: ${v}` : '';
    })
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function parseItems(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

function normalizeItem(it: any, i: number): OrderItem {
  const quantity = Math.max(1, num(it?.quantity) ?? num(it?.qty) ?? 1);
  const unitPrice = num(it?.unitPrice) ?? num(it?.price) ?? num(it?.priceAtOrder);
  const lineTotal = num(it?.lineTotal) ?? (unitPrice !== null ? Math.round(unitPrice * quantity * 100) / 100 : null);
  return {
    key: `${it?.menuItemId || it?.id || 'item'}-${i}`,
    name: typeof it?.name === 'string' && it.name.trim() ? it.name.trim() : 'Item',
    quantity,
    unitPrice,
    lineTotal,
    customizations: formatCustomizations(it?.customizations),
    isAddOn: it?.isAddOn === true,
  };
}

/** Pulls "Note: …" parts out of the address string (older apps put instructions there). */
export function splitAddress(addr: unknown): { address: string; notes: string[] } {
  const s = typeof addr === 'string' ? addr : '';
  const notes: string[] = [];
  const parts = s.split(/\s*[·|]\s*/).filter(Boolean);
  const keep: string[] = [];
  for (const p of parts) {
    const m = /^note\s*:\s*(.+)$/i.exec(p);
    if (m) notes.push(m[1].trim());
    else keep.push(p);
  }
  return { address: keep.join(' · '), notes };
}

export function normalizeOrder(raw: any): Order | null {
  const id = raw?.id || raw?._id;
  if (!id || typeof id !== 'string') return null;
  const status = typeof raw.status === 'string' ? raw.status : 'Pending';
  const items = parseItems(raw.items).map(normalizeItem);
  const { address, notes } = splitAddress(raw.deliveryAddress ?? raw.address);
  const instr = Array.isArray(raw.deliveryInstructions)
    ? raw.deliveryInstructions.filter((x: unknown) => typeof x === 'string' && x.trim()).map((x: string) => x.trim())
    : [];
  const instructions = [...instr];
  for (const n of notes) if (!instructions.some((x) => x.toLowerCase() === n.toLowerCase())) instructions.push(n);
  const pm = String(raw.paymentMethod || '').toUpperCase();
  return {
    id,
    shortId: shortId(id),
    status,
    stage: stageOf(status),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    acceptedAt: raw.acceptedAt || null,
    readyAt: raw.readyAt || null,
    deliveredAt: raw.deliveredAt || null,
    items,
    itemCount: items.reduce((s, it) => s + it.quantity, 0),
    totalPrice: num(raw.totalPrice) ?? 0,
    finalPrice: num(raw.finalPrice) ?? num(raw.totalPrice) ?? 0,
    deliveryFee: num(raw.deliveryFee) ?? 0,
    paymentMethod: pm === 'WALLET' ? 'Wallet' : pm === 'COD' ? 'COD' : (raw.paymentMethod || ''),
    paymentStatus: raw.paymentStatus || null,
    isCOD: pm === 'COD',
    deliveryAddress: address,
    instructions,
    estDuration: num(raw.estDuration),
    cancellationReason: raw.cancellationReason || null,
    deliveryPartnerId: raw.deliveryPartnerId || null,
    customerName: firstName(raw.user?.name),
    customerPhone: typeof raw.user?.phone === 'string' ? raw.user.phone : null,
    riderName: typeof raw.deliveryPartner?.name === 'string' ? raw.deliveryPartner.name : null,
    riderPhone: typeof raw.deliveryPartner?.phone === 'string' ? raw.deliveryPartner.phone : null,
    partial: !!raw.__partial,
  };
}

export function normalizeMenuItem(raw: any): MenuItem | null {
  const id = raw?.id || raw?._id;
  if (!id) return null;
  return {
    id: String(id),
    name: typeof raw.name === 'string' ? raw.name : 'Item',
    price: num(raw.price) ?? 0,
    description: raw.description || null,
    imageUrl: raw.imageUrl || null,
    category: typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : 'Other',
    isVegetarian: typeof raw.isVegetarian === 'boolean' ? raw.isVegetarian : null,
    isAvailable: raw.isAvailable !== false,
    outOfStockUntil: raw.outOfStockUntil || null,
  };
}

export function normalizeStore(raw: any): StoreState {
  let hours = raw?.operatingHours ?? null;
  if (typeof hours === 'string') {
    try { hours = JSON.parse(hours); } catch { hours = null; }
  }
  const isOpenNow = raw?.isOpenNow !== false;
  return {
    name: raw?.name,
    location: raw?.location,
    isOpenNow,
    isOpen: typeof raw?.isOpen === 'boolean' ? raw.isOpen : isOpenNow,
    opensAt: raw?.opensAt || null,
    closedReason: raw?.closedReason || null,
    isOffline: raw?.isOffline === true,
    isActive: raw?.isActive !== false,
    operatingHours: hours && typeof hours === 'object' ? hours : null,
    deliveryTime: num(raw?.deliveryTime),
  };
}

// ── Time (IST) ──────────────────────────────────────────────────────────────
const toIST = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS);

export function istDayKey(d: Date | string | number): string {
  const dt = toIST(new Date(d));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
export const todayIST = () => istDayKey(Date.now());
export function isTodayIST(d: string | null | undefined): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  return Number.isFinite(t) && istDayKey(t) === todayIST();
}

/** "9:05 PM" (IST) from a timestamp. */
export function clockIST(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined) return '';
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return '';
  const dt = toIST(new Date(t));
  const h = dt.getUTCHours();
  const m = dt.getUTCMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "21:00" → "9:00 PM". */
export function formatHHMM(hhmm: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return hhmm ? String(hhmm) : '';
  const h = Number(m[1]) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Epoch ms of the next IST occurrence of HH:MM after `now`. */
export function nextISTTime(hhmm: string, now = Date.now()): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const ist = toIST(new Date(now));
  const targetUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), Number(m[1]) % 24, Number(m[2])) - IST_OFFSET_MS;
  return targetUtc > now ? targetUtc : targetUtc + 24 * 60 * 60 * 1000;
}

export function minutesSince(d: string | null | undefined, now: number): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : 0;
}

export function agoText(d: string | null | undefined, now: number): string {
  const m = minutesSince(d, now);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export const rupees = (n: number | null | undefined) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return `₹${Number.isInteger(v) ? v : v.toFixed(2)}`;
};

export const TIMED_OUT_REASON = /did not accept the order in time/i;
