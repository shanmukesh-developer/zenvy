import { useEffect, useState } from 'react';
import { getVoiceState, subscribeVoice, type VoiceState } from './announcer';

/** Live voice settings + availability for the settings screen and header icon. */
export function useVoice(): VoiceState {
  const [s, setS] = useState<VoiceState>(getVoiceState());
  useEffect(() => subscribeVoice(setS), []);
  return s;
}
