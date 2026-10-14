import { createContext, useContext } from 'react';
import type { PulsePost } from '../api/pulseApi';

/** Screens inside Friends > Pulse (an in-tab stack so the sub-tab bar stays visible). */
export type PulseRoute =
  | { name: 'thread'; id: string; post?: PulsePost | null }
  | { name: 'hashtag'; tag: string }
  | { name: 'trends' }
  | { name: 'library'; tab: 'saved' | 'mine' }
  | { name: 'user'; userId: string; displayName?: string | null };

export interface PulseComposerRequest {
  /** Reply to this post (inherits the thread's reply policy on the server). */
  replyTo?: PulsePost | null;
  /** Edit my post (text only). */
  edit?: PulsePost | null;
  /** Prefill, e.g. "#tag " from a hashtag page. */
  prefill?: string;
}

export interface PulseNav {
  push: (r: PulseRoute) => void;
  back: () => void;
  openComposer: (req: PulseComposerRequest) => void;
  /** Profile sheet (follow, mute, report, block, see posts). Named authors only. */
  openUser: (userId: string) => void;
  /** Switch Friends to the Spaces sub-tab with this Space open. */
  openSpace: (spaceId: string) => void;
  /** Refetch Friends eligibility when a call says the gate changed (flag, guidelines, sanction). */
  onGateError: (e: any) => void;
  /** After a successful block: drop that person's named content everywhere. */
  onBlocked: (userId: string) => void;
  me: string | null;
  /** Entities (clubs / official accounts) the student follows, for menu state. */
  followedEntities: Set<string>;
  setEntityFollowed: (entityId: string, on: boolean) => void;
}

const noop = () => {};
export const PulseNavContext = createContext<PulseNav>({
  push: noop,
  back: noop,
  openComposer: noop,
  openUser: noop,
  openSpace: noop,
  onGateError: noop,
  onBlocked: noop,
  me: null,
  followedEntities: new Set(),
  setEntityFollowed: noop,
});

export const usePulseNav = () => useContext(PulseNavContext);
