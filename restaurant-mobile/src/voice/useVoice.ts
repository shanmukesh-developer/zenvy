import { useSyncExternalStore } from 'react';
import { getVoiceSnapshot, subscribeVoice, VoiceSnapshot } from './voice';

/** Live voice settings + availability for screens. */
export function useVoice(): VoiceSnapshot {
  return useSyncExternalStore(subscribeVoice, getVoiceSnapshot, getVoiceSnapshot);
}
