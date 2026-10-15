import { useSWRJson } from '../../utils/swrCache';
import { useLiveSync } from '../../utils/useLiveSync';

/**
 * How long chats and Pulse posts are kept (admin setting, backend cron/retentionCron.js).
 * Cached-first; falls back to the server defaults (7 / 30 days) until the first response.
 */
export interface RetentionPolicy {
  chatDays: number;
  pulseDays: number;
}

const DEFAULTS: RetentionPolicy = { chatDays: 7, pulseDays: 30 };

const valid = (d: any) => !!d && Number.isFinite(d.chatDays) && Number.isFinite(d.pulseDays) && d.chatDays >= 1 && d.pulseDays >= 1;

export const useRetentionPolicy = (): RetentionPolicy => {
  const { data, refresh } = useSWRJson<RetentionPolicy>('/api/campus/retention', { validate: valid, freshMs: 10 * 60 * 1000 });
  useLiveSync({
    types: ['config'],
    filter: (e) => e.scope === 'retention' || e.id === 'CHAT_RETENTION_DAYS' || e.id === 'PULSE_RETENTION_DAYS',
    onChange: () => { refresh({ silent: true }); },
  });
  return data && valid(data) ? data : DEFAULTS;
};

export const daysLabel = (n: number) => (n === 1 ? '24 hours' : `${n} days`);
