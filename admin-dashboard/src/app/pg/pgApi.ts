
export interface MealMenu { breakfast: string; lunch: string; dinner: string }

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Day = typeof DAYS[number];

export interface PGHostel {
  id: string;
  name: string;
  address: string;
  distanceFromCollege: number;
  genderType: string;
  baseRent: number;
  securityDeposit?: number;
  isActive: boolean;
  amenities?: string[];
  images?: string[];
  description?: string | null;
  contactInfo?: Record<string, unknown> | null;
  rules?: string[];
  foodTimetable?: Record<string, unknown> | null;
  messMenu?: Record<string, Partial<MealMenu>> | null;
}

export interface PGRoom {
  id: string;
  hostelId: string;
  roomNumber: string;
  sharingType: number;
  pricePerBed: number;
  totalBeds: number;
  availableBeds: number;
  floorNumber: number;
  hasAttachedBathroom: boolean;
  hasAC: boolean;
  hasBalcony: boolean;
  furnishing: string;
  isActive: boolean;
}

export interface PGBooking {
  id: string;
  status: 'Pending' | 'Confirmed' | 'Cancelled' | string;
  checkInDate: string;
  createdAt: string;
  user?: { id: string; name?: string | null; phone?: string | null; email?: string | null } | null;
  hostel?: { id: string; name: string } | null;
  room?: { id: string; roomNumber: string; sharingType: number; availableBeds: number } | null;
}

export const FIELD = 'w-full rounded-lg border border-white/10 bg-[#111318] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50 disabled:opacity-50';
export const LABEL = 'block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400';

/** The customer app expects 'Boys' | 'Girls' | 'Co-ed'. Older rows used 'Co-Ed'. */
export const normalizeGender = (value?: string | null) => {
  const v = String(value || '').toLowerCase();
  if (v.startsWith('boy')) return 'Boys';
  if (v.startsWith('girl')) return 'Girls';
  return 'Co-ed';
};

export const formatDate = (value?: string | null, withTime = false) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return withTime
    ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

// Shared request helpers live in src/lib/api.ts.
export { adminRequest as pgRequest, uploadImage } from '@/lib/api';
