// Display helpers (IST, rupees). No React Native imports.
import { serverNow } from './http';

export const rupees = (n: number | null | undefined) => {
  const v = Number(n) || 0;
  return `₹${Number.isInteger(v) ? v : v.toFixed(2)}`;
};

const IST = 'Asia/Kolkata';
export function timeIst(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST }); } catch { return '—'; }
}
export function dayIst(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST }); } catch { return '—'; }
}
export const dateTimeIst = (iso: string | null | undefined) => (iso ? `${dayIst(iso)}, ${timeIst(iso)}` : '—');

/** "in 12 min" / "5 min ago" from server time. */
export function relative(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - serverNow();
  const min = Math.round(Math.abs(diff) / 60000);
  const txt = min < 1 ? 'now' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
  if (min < 1) return 'now';
  return diff > 0 ? `in ${txt}` : `${txt} ago`;
}

/** mm:ss until `iso` (0 when past). */
export function countdown(iso: string | null | undefined): { text: string; ms: number } {
  if (!iso) return { text: '—', ms: 0 };
  const ms = Math.max(0, new Date(iso).getTime() - serverNow());
  const s = Math.floor(ms / 1000);
  return { text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, ms };
}

export const DOC_LABEL: Record<string, string> = {
  photo: 'Your photo (face clearly visible)',
  licenceFront: 'Driving licence (front)',
  licenceBack: 'Driving licence (back)',
  badge: 'PSV badge',
  policeVerification: 'Police verification certificate',
  rc: 'RC (registration certificate)',
  permit: 'Permit',
  insurance: 'Insurance',
  fitness: 'Fitness certificate',
  puc: 'PUC certificate',
};

export const MISSING_LABEL = (m: string): string => {
  if (m.startsWith('document:')) return DOC_LABEL[m.slice(9)] || m.slice(9);
  return ({ licenceNumber: 'Licence number', licenceExpiresOn: 'Licence expiry date', emergencyContactPhone: 'Emergency contact number', vehicle: 'Your auto (vehicle details)' } as Record<string, string>)[m] || m;
};

/** YYYY-MM-DD typed by hand: null = empty, false = malformed. */
export function ymdInput(v: string): string | null | false {
  const s = v.trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) return false;
  return s;
}
