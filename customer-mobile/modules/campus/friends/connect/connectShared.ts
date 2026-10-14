import { Heart, Users, BookOpen, PartyPopper, LucideIcon } from 'lucide-react-native';
import { errorCode } from '../api/core';
import { resolveMediaUrl } from '../../../../utils/imageUpload';
import type { ConnectLookingFor, ConnectMatch, ConnectStatus } from '../api/connectApi';

export const LOOKING_FOR_META: Record<ConnectLookingFor, { label: string; icon: LucideIcon }> = {
  dating: { label: 'Dating', icon: Heart },
  friends: { label: 'Friends', icon: Users },
  study: { label: 'Study buddy', icon: BookOpen },
  event: { label: 'Event buddy', icon: PartyPopper },
};

export const lookingForLabel = (k: ConnectLookingFor, status?: ConnectStatus | null) =>
  status?.lookingForOptions?.find((o) => o.key === k)?.label || LOOKING_FOR_META[k]?.label || k;

export const YEARS = [1, 2, 3, 4, 5, 6];
export const yearLabel = (y: number) => (y === 1 ? '1st year' : y === 2 ? '2nd year' : y === 3 ? '3rd year' : `${y}th year`);

/**
 * Image source for a private Connect photo. Signed links change on every fetch, so the cache key is
 * the photo id; photos stay in memory only (never written to the disk cache).
 */
export const photoSource = (photo: { id: string; url: string | null } | null | undefined) => {
  const uri = resolveMediaUrl(photo?.url || null);
  return uri && photo ? { uri, cacheKey: `connect-photo-${photo.id}` } : null;
};

/** One friendly sentence for a Connect error (the server's own message is already friendly). */
export const connectErrorMessage = (e: any, fallback = 'Please try again.'): string => {
  const code = errorCode(e);
  switch (code) {
    case 'RATE_LIMITED':
      return "You're going a little fast. Take a short break and try again.";
    case 'NETWORK':
      return "You're offline. Check your internet and try again.";
    case 'CONTENT_BLOCKED':
      return 'Some of that text is not allowed in Connect. Remove phone numbers, emails, links or explicit words and try again.';
    case 'PROFILE_NOT_FOUND':
      return 'This person is no longer available.';
    case 'MATCH_NOT_FOUND':
      return 'This match has ended.';
    default:
      return e && typeof e.message === 'string' && e.message ? e.message : fallback;
  }
};

/** Codes that mean "our status is stale: reload the Connect gate". */
export const isConnectGateError = (e: any) =>
  [
    'DOB_REQUIRED',
    'NOT_ADULT',
    'CONSENT_REQUIRED',
    'AGE_DECLARATION_REQUIRED',
    'LIVENESS_REQUIRED',
    'LIVENESS_NOT_CONFIGURED',
    'PROFILE_REMOVED',
    'PROFILE_NOT_ACTIVE',
    'PAUSED',
    'CONSENT_VERSION_MISMATCH',
  ].includes(errorCode(e));

/** Initial for a photo-less card (never a real surname: displayName is the Connect first name). */
export const initialOf = (name?: string | null) => (String(name || '').trim().charAt(0) || '?').toUpperCase();

export const matchName = (m: ConnectMatch) => m.profile?.displayName || 'Your match';

/** Tiny pub/sub so Discover, Matches and match screens stay in step (new match, ended match). */
type Listener = (e: { type: 'match' | 'ended' | 'status'; matchId?: string }) => void;
const listeners = new Set<Listener>();
export const connectBus = {
  on(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  emit(e: Parameters<Listener>[0]) {
    listeners.forEach((fn) => {
      try {
        fn(e);
      } catch {
        // a listener's error must not break the others
      }
    });
  },
};

/** "dd/mm/yyyy" parts → ISO date, or null when not a real date. */
export const toIsoDate = (d: string, m: string, y: string): string | null => {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (date.getTime() > Date.now()) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const ageOn = (iso: string, now = new Date()) => {
  const d = new Date(`${iso}T00:00:00Z`);
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const mo = now.getUTCMonth() - d.getUTCMonth();
  if (mo < 0 || (mo === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
};
