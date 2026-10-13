import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { FT } from '../friendsTheme';

const toDate = (v: string | number | Date | null | undefined): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "now", "5m", "3h", "2d", then a short local date ("12 Oct", or "12 Oct 2025" for another year). */
export const formatRelative = (v: string | number | Date | null | undefined, now = Date.now()): string => {
  const d = toDate(v);
  if (!d) return '';
  const diff = Math.round((now - d.getTime()) / 1000);
  if (diff < 0) {
    // Future (scheduled Spaces, reminders): show the local date and time.
    return formatLocal(d);
  }
  if (diff < 45) return 'now';
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Full local date + time, in the device's time zone. */
export const formatLocal = (v: string | number | Date | null | undefined): string => {
  const d = toDate(v);
  if (!d) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** Self-updating relative time (refreshes every minute). Screen readers get the full local time. */
export const RelativeTime: React.FC<{ value: string | number | Date | null | undefined; style?: StyleProp<TextStyle>; prefix?: string }> = ({
  value,
  style,
  prefix,
}) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const label = formatRelative(value, now);
  if (!label) return null;
  return (
    <Text style={[FT.small, style]} accessibilityLabel={`${prefix ? `${prefix} ` : ''}${formatLocal(value)}`} numberOfLines={1}>
      {prefix ? `${prefix} ` : ''}
      {label}
    </Text>
  );
};
