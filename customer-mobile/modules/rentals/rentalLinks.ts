/**
 * Where a Rentals push / in-app notification opens (backend modules/rentals: data.type RENTAL_*,
 * data.bookingId, data.listingId, data.screen). Shared by the push tap handler and the inbox.
 */
const ID_RE = /^[0-9a-f-]{36}$/i;

export const rentalHrefForNotification = (type?: string | null, rawData?: any): string | null => {
  if (typeof type !== 'string' || !type.startsWith('RENTAL_')) return null;
  let data: any = rawData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  const bookingId = data && typeof data.bookingId === 'string' && ID_RE.test(data.bookingId) ? data.bookingId : null;
  if (bookingId) return `/rentals/booking/${bookingId}`;
  if (type.startsWith('RENTAL_LICENCE')) return '/rentals/licence';
  if (type.startsWith('RENTAL_LISTING')) return '/rentals/my-listings';
  return '/rentals/bookings';
};
