// Stores (restaurants, non-food stores and CampusBites stalls) are Restaurant rows on the backend;
// their products are MenuItem rows. These types mirror GET /api/admin/restaurants and /api/admin/menu-items.

export interface BrandTheme {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontColor?: string;
  logoUrl?: string;
  [key: string]: unknown;
}

export interface OperatingHours {
  start?: string;
  end?: string;
  /** Per-day hours. Only kept once the backend stores it (see admin_restaurant_backend_todo.md). */
  weekly?: Record<string, { open?: boolean; start?: string; end?: string }>;
}

export interface Store {
  _id: string;
  id?: string;
  name: string;
  location: string;
  vendorType?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  isOffline?: boolean;
  isOpenNow?: boolean;
  isOpen?: boolean;
  opensAt?: string | null;
  closedReason?: string | null;
  operatingHours?: OperatingHours | null;
  deliveryTime?: number | null;
  whatsappNumber?: string | null;
  commissionRate?: number;
  commissionType?: 'percentage' | 'flat';
  tags?: string[];
  campus?: string | null;
  zone?: string | null;
  lat?: number | null;
  lon?: number | null;
  rating?: number | null;
  stallDescription?: string | null;
  isFeatured?: boolean;
  featuredUntil?: string | null;
  featuredBadge?: string | null;
  promoOffer?: string | null;
  subscriptionTier?: string | null;
  brandTheme?: BrandTheme | string | null;
  clickCount?: number;
  itemCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  _id: string;
  id?: string;
  restaurantId: string;
  name: string;
  price: number;
  category?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  image?: string | null;
  isAvailable: boolean;
  outOfStockUntil?: string | null;
  isEliteOnly?: boolean;
  isVegetarian?: boolean;
  tags?: string[];
  specs?: Record<string, unknown> | null;
  createdAt?: string;
}

export type VendorGroup = 'Food' | 'Shops' | 'Services' | 'Campus';

/** Canonical store types the backend understands (see backend/utils/vendorTypes.js). */
export const VENDOR_TYPES: { value: string; label: string; group: VendorGroup; hint: string }[] = [
  { value: 'RESTAURANT', label: 'Restaurant', group: 'Food', hint: 'Cooked food. Orders, payment and Zenvy riders.' },
  { value: 'LOCAL_VENDOR', label: 'Local stall (CampusBites)', group: 'Campus', hint: 'Display-only. Customers call or WhatsApp the stall; no Zenvy order.' },
  { value: 'GROCERY', label: 'Grocery / Kirana', group: 'Shops', hint: 'Packaged goods, Mega Basket and late-night mart.' },
  { value: 'PHARMACY', label: 'Pharmacy', group: 'Shops', hint: 'Medicines and health essentials.' },
  { value: 'STATIONERY', label: 'Stationery', group: 'Shops', hint: 'Books, pens, study kits.' },
  { value: 'ELECTRONICS', label: 'Electronics', group: 'Shops', hint: 'Chargers, cables, gadgets.' },
  { value: 'HOME_ESSENTIALS', label: 'Home essentials', group: 'Shops', hint: 'Mattresses, bedding, room needs.' },
  { value: 'TOYS', label: 'Toys', group: 'Shops', hint: 'Toys and games.' },
  { value: 'SEEDS', label: 'Seeds & gardening', group: 'Shops', hint: 'Plants, seeds and kits.' },
  { value: 'RENTALS', label: 'Rentals', group: 'Shops', hint: 'Things students rent.' },
  { value: 'EXTRAS', label: 'Add-ons & extras', group: 'Shops', hint: 'Checkout add-ons (candles, cards…).' },
  { value: 'REPAIRS', label: 'Repairs', group: 'Services', hint: 'Booking only: customers book, never order.' },
  { value: 'PRINT', label: 'Print & xerox', group: 'Services', hint: 'Booking only: priced per page / binding.' },
  { value: 'LAUNDRY', label: 'Laundry', group: 'Services', hint: 'Booking only.' },
  { value: 'TAILORING', label: 'Tailoring', group: 'Services', hint: 'Booking only.' },
];

/** Store types whose products are services the customer BOOKS (POST /api/services/book), never orders. */
export const BOOKING_ONLY_VENDOR_TYPES = ['REPAIRS', 'PRINT', 'LAUNDRY', 'TAILORING'];
export const isBookingOnlyStore = (type?: string | null) => BOOKING_ONLY_VENDOR_TYPES.includes(String(type || '').toUpperCase());
/** CampusBites stalls are display-only listings (mirror of backend LOCAL_VENDOR_TYPES). */
export const isLocalVendorType = (type?: string | null) => ['LOCAL_VENDOR', 'LOCAL', 'STALL'].includes(String(type || '').toUpperCase());

const LEGACY_LABELS: Record<string, string> = {
  STATIONARY: 'Stationery (old spelling)',
  RENTAL: 'Rentals (old spelling)',
};

export const vendorLabel = (type?: string | null) => {
  const value = (type || 'RESTAURANT').toUpperCase();
  return VENDOR_TYPES.find(v => v.value === value)?.label.replace(/ \(.*\)$/, '')
    || LEGACY_LABELS[value]
    || value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};

export const storeId = (s: { _id?: string; id?: string }) => s._id || s.id || '';

/** "919876543210" -> "98765 43210" for display. */
export const formatWhatsapp = (value?: string | null) => {
  const ten = tenDigits(value);
  return ten.length === 10 ? `${ten.slice(0, 5)} ${ten.slice(5)}` : ten;
};

/** Any Indian mobile input ("+91 98765-43210", "919876543210") -> "9876543210" (or the raw digits). */
export const tenDigits = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
};

export const isValidIndianMobile = (value?: string | null) => /^[6-9]\d{9}$/.test(tenDigits(value));

export const formatTime = (hhmm?: string | null) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return hhmm || '';
  const h = Number(m[1]) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};

export const readSpecs = (specs: unknown): Record<string, unknown> => {
  if (typeof specs === 'string') {
    try { return readSpecs(JSON.parse(specs)); } catch { return {}; }
  }
  return specs && typeof specs === 'object' && !Array.isArray(specs) ? (specs as Record<string, unknown>) : {};
};

export const readBrandTheme = (value: unknown): BrandTheme | null => {
  const obj = readSpecs(value);
  return Object.keys(obj).length ? (obj as BrandTheme) : null;
};

export const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export type StoreStatus = 'live' | 'closed' | 'draft' | 'inactive';

/**
 * Live = active and open now. Closed now = active but outside hours / paused by the store.
 * Draft = inactive and has no products yet (setup not finished). Inactive = switched off with a catalogue.
 * The backend has no explicit draft flag yet (see admin_restaurant_backend_todo.md).
 */
export const storeStatus = (s: Store): StoreStatus => {
  if (!s.isActive) return (s.itemCount ?? 0) === 0 ? 'draft' : 'inactive';
  return s.isOpen === false ? 'closed' : 'live';
};

export const STATUS_META: Record<StoreStatus, { label: string; tone: 'green' | 'amber' | 'slate' | 'red'; help: string }> = {
  live: { label: 'Live', tone: 'green', help: 'Visible in the app and open right now.' },
  closed: { label: 'Closed now', tone: 'amber', help: 'Visible in the app, but outside its hours or paused by the store.' },
  draft: { label: 'Draft', tone: 'slate', help: 'Hidden from customers and has no products yet. Finish setup, then publish.' },
  inactive: { label: 'Inactive', tone: 'red', help: 'Switched off: hidden from customers and not taking orders.' },
};

/** Customer-app route for a store (also used as the Home banner redirect). */
export const storeAppPath = (id: string) => `/restaurant/${id}`;

// Shared request helpers live in src/lib/api.ts.
export { adminRequest, uploadImage } from '@/lib/api';
