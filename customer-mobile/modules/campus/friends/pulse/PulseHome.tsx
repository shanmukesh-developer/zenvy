import React from 'react';
import { LegacyPulse, LegacyPulseProps } from './LegacyPulse';

export interface PulseHomeProps extends LegacyPulseProps {
  /** Pulse feature flag from /friends/eligibility (on only after Phase 2 ships). */
  enabled: boolean;
  /** Post / thread id from a deep link (Phase 2). */
  focusId?: string | null;
}

/**
 * Friends > Pulse entry. Phase 0: the existing campus feed (posts, The Wall, 9 PM, Branch Wars)
 * so nothing is lost. Phase 2 replaces this body with the Pulse feed (Campus / Following, composer,
 * Campus Moments strip that keeps the legacy cards) when `enabled` is true.
 */
export const PulseHome: React.FC<PulseHomeProps> = ({ enabled: _enabled, focusId: _focusId, ...legacy }) => <LegacyPulse {...legacy} />;
