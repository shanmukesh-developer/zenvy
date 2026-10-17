/**
 * Where a Campus Events push / in-app notification opens (backend modules/campusEvents/services/notify.js:
 * data.type CE_*, data.screen 'campus_event', ids only: eventId, registrationId?, teamId?, ticketId?, slotId?).
 * Shared by the push tap handler (components/GlobalAnnouncement.tsx) and the inbox (app/notifications.tsx).
 * Most specific id wins: ticket > invitation (team, not yet a member) > registration > team > event.
 */
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const campusEventHrefForNotification = (type?: string | null, rawData?: any): string | null => {
  let data: any = rawData;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  const isCe = (typeof type === 'string' && type.startsWith('CE_')) || (data && data.screen === 'campus_event');
  if (!isCe) return null;
  const t = String(type || (data && data.type) || '');
  const id = (k: string) => (data && typeof data[k] === 'string' && ID_RE.test(data[k]) ? data[k] : null);
  const ticketId = id('ticketId');
  const registrationId = id('registrationId');
  const teamId = id('teamId');
  const eventId = id('eventId');
  if (ticketId) return `/campus-events/ticket/${ticketId}`;
  if (t === 'CE_TEAM_INVITATION') return '/campus-events/invitations';
  if (t.startsWith('CE_ORGANIZER')) return '/campus-events/organizer';
  if (t === 'CE_STAFF_GRANTED') return eventId ? `/campus-events/check-in?eventId=${eventId}` : '/campus-events/check-in';
  if (['CE_EVENT_APPROVED', 'CE_EVENT_REJECTED', 'CE_EVENT_CHANGES_REQUESTED', 'CE_EVENT_PUBLISHED', 'CE_CHANGES_APPROVED'].includes(t) && eventId && !registrationId) {
    return `/campus-events/organizer/${eventId}`;
  }
  if (registrationId) return `/campus-events/registration/${registrationId}`;
  if (teamId) return `/campus-events/team/${teamId}`;
  if (eventId) return `/campus-events/${eventId}`;
  return '/campus-events/my';
};
