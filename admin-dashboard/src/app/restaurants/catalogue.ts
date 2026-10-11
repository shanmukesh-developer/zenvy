
// Stores (restaurants, non-food stores and CampusBites stalls) are Restaurant rows on the backend;
// their products are MenuItem rows. These types mirror GET /api/admin/restaurants and /api/admin/menu-items.

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
  operatingHours?: { start?: string; end?: string } | null;
  deliveryTime?: number | null;
  whatsappNumber?: string | null;
  commissionRate?: number;
  commissionType?: 'percentage' | 'flat';
  tags?: string[];
  campus?: string | null;
  stallDescription?: string | null;
  isFeatured?: boolean;
  featuredBadge?: string | null;
  promoOffer?: string | null;
  itemCount?: number;
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
  isEliteOnly?: boolean;
  isVegetarian?: boolean;
  tags?: string[];
  specs?: Record<string, unknown> | null;
}

/** Canonical store types the backend understands (see backend/utils/vendorTypes.js). */
export const VENDOR_TYPES: { value: string; label: string }[] = [
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'LOCAL_VENDOR', label: 'Local vendor (CampusBites stall)' },
  { value: 'GROCERY', label: 'Grocery / Kirana' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'HOME_ESSENTIALS', label: 'Home essentials / bedding' },
  { value: 'STATIONERY', label: 'Stationery' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'TOYS', label: 'Toys' },
  { value: 'SEEDS', label: 'Seeds & gardening' },
  { value: 'RENTALS', label: 'Rentals' },
  { value: 'EXTRAS', label: 'Add-ons & extras' },
  { value: 'REPAIRS', label: 'Repairs (booking only)' },
  { value: 'PRINT', label: 'Print & xerox (booking only)' },
  { value: 'LAUNDRY', label: 'Laundry (booking only)' },
  { value: 'TAILORING', label: 'Tailoring (booking only)' },
];

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
  const digits = String(value || '').replace(/\D/g, '');
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return ten.length === 10 ? `${ten.slice(0, 5)} ${ten.slice(5)}` : ten;
};

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

// Shared request helpers live in src/lib/api.ts.
export { adminRequest, uploadImage } from '@/lib/api';
