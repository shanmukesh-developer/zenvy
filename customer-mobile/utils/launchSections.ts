/**
 * Laundry-only launch (owner, 24 Nov 2026): "Currently we are not launching PG Stays, Rentals, Campus Events, and
 * Tech & Services except Laundry (Dry Wash) ... remove them from the display - we will add them in later versions.
 * Instead of Tech & Services rename it to Laundry Services." Co-Ride stays as it was (owner, 24 Nov 2026: "Do not
 * remove Co-ride services, keep it as it is"): it is a core section below (on by default; the admin can still pause it).
 *
 * Nothing is deleted: each section shows again as soon as the admins switch it on. The server reports the switches
 * in GET /api/config/sections (backend routes/appConfigRoutes.js, scripts/services_laundry_only_v1.js):
 *   pg.on, coride.on, rentals.on, events.on, services.techServices
 * A section shows ONLY when its switch is reported true: no answer yet, offline or an older server keeps it hidden.
 *
 * App sections control (owner, 24 Nov 2026; backend utils/appSections): the core sections below are the opposite.
 * They show unless the server says on === false (an older server, no answer or offline never hides them):
 *   food, grocery, bakery, local, laundry, megaBasket, deals, coride
 */
import { useMemo } from 'react';
import { useSWRJson } from './swrCache';

/** The pausable parts of the Services tab (keys of app/(tabs)/others.tsx TABS, plus techServices). */
export type LaunchSection = 'pg' | 'coride' | 'rentals' | 'events' | 'techServices' | CoreSection;
/** Core sections the admins can pause: shown unless the server says on === false. */
export type CoreSection = 'food' | 'grocery' | 'bakery' | 'local' | 'laundry' | 'megaBasket' | 'deals';
const CORE_SECTIONS: readonly string[] = ['food', 'grocery', 'bakery', 'local', 'laundry', 'megaBasket', 'deals', 'coride'];

type SectionsAnswer = { sections?: Record<string, { live?: boolean; on?: boolean; techServices?: boolean } | undefined> };

/** Launch sections: true only when the server says the switch is on. Core sections: true unless it says off. */
export const launchSectionOn = (data: SectionsAnswer | undefined, key: LaunchSection): boolean => {
  const sec = data?.sections;
  if (CORE_SECTIONS.includes(key)) return sec?.[key]?.on !== false;
  if (!sec) return false;
  if (key === 'techServices') return sec.services?.techServices === true;
  return sec[key]?.on === true;
};

/** Same request (and cache entry) as Home and the Services tab, so it costs no extra call. */
export function useLaunchSections() {
  const swr = useSWRJson<SectionsAnswer>('/api/config/sections', { freshMs: 0 });
  return useMemo(() => {
    const on = (key: LaunchSection) => launchSectionOn(swr.data, key);
    return {
      on,
      /** Laundry only: repairs, tailoring, print and the store shelves (room essentials, gadgets) are hidden. */
      laundryOnly: !on('techServices'),
      /** Laundry and every other service are paused: the Services section says services are paused. */
      servicesPaused: !on('techServices') && !on('laundry'),
      /** Whether the server has answered (or a cached answer exists). */
      known: !!swr.data?.sections,
      /** An answer (or cached answer) is in, or the request has finished without one (offline, older server). */
      settled: !!swr.data?.sections || !swr.loading,
    };
  }, [swr.data, swr.loading]);
}

/** Services section name: "Laundry Services" while only laundry is open, the old name once the rest is back. */
export const servicesTitle = (laundryOnly: boolean) => (laundryOnly ? 'Laundry Services' : 'Tech & repairs');

/**
 * Screens of a paused section reached by a link (push notification, old link, typed URL): the section each path
 * prefix belongs to. A student's own history (bookings, tickets, my rides) stays reachable.
 */
const PAUSED_ROUTES: { prefix: string; key: LaunchSection }[] = [
  { prefix: '/pg', key: 'pg' },
  { prefix: '/rentals', key: 'rentals' },
  { prefix: '/campus-events', key: 'events' },
  // Co-Ride (and its shared autos) follow the Co-Ride switch in App sections; a student's own rides stay open.
  { prefix: '/coride', key: 'coride' },
  { prefix: '/auto-ride', key: 'coride' },
  // App sections control (24 Nov 2026): Local tab (In-Campus Booking), Deals & spin and the rewards links.
  { prefix: '/campus-booking', key: 'local' },
  { prefix: '/local', key: 'local' },
  { prefix: '/deals', key: 'deals' },
  { prefix: '/rewards', key: 'deals' },
];
const OWN_HISTORY = new Set([
  '/pg/bookings', '/rentals/bookings', '/rentals/my-rentals', '/rentals/my-listings', '/coride/my-rides',
  '/campus-events/my', '/campus-events/tickets', '/campus-booking/bookings', '/deals/coupons',
]);
const OWN_HISTORY_PREFIXES = ['/campus-events/ticket/', '/auto-ride/booking/', '/rentals/booking/', '/campus-booking/order/', '/campus-booking/pay/', '/deals/coupon/'];

/** Where a link into a paused section goes instead: Home for Local / Deals & spin, else the Services tab. */
export const pausedSectionHome = (key: LaunchSection): string =>
  (key === 'local' || key === 'deals' ? '/(tabs)' : '/(tabs)/services?tab=services');

/** The paused section a path belongs to, or null when the path is open. */
export const pausedSectionOf = (pathname: string | null | undefined): LaunchSection | null => {
  const p = String(pathname || '');
  if (!p || OWN_HISTORY.has(p) || OWN_HISTORY_PREFIXES.some((x) => p.startsWith(x))) return null;
  for (const r of PAUSED_ROUTES) if (p === r.prefix || p.startsWith(`${r.prefix}/`)) return r.key;
  return null;
};

/** Service shelves of the Services section that are not laundry (hidden while laundryOnly). */
export const NON_LAUNDRY_SHELVES = ['repairs', 'tailoring', 'mattresses', 'electronics'] as const;
