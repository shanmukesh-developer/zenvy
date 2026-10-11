import React from 'react';
import { Banner } from '../ui/Basics';

export function OfflineBanner({
  connected,
  serverReachable,
  queueCount,
  onRetry,
}: {
  connected: boolean;
  serverReachable: boolean;
  queueCount: number;
  onRetry: () => void;
}) {
  if (!connected) {
    const queued = queueCount ? ` ${queueCount} update${queueCount === 1 ? '' : 's'} waiting.` : '';
    return <Banner tone="danger" icon="wifi-off" text={`No internet. Updates will sync when you're back online.${queued}`} />;
  }
  if (queueCount > 0) {
    return <Banner tone="warning" icon="sync" text={`Syncing ${queueCount} update${queueCount === 1 ? '' : 's'}…`} actionLabel="Retry" onAction={onRetry} />;
  }
  if (!serverReachable) {
    return <Banner tone="warning" icon="cloud-off-outline" text="Can't reach Zenvy. Retrying…" />;
  }
  return null;
}
