import { createContext, useContext } from 'react';
import type { CampusRole } from '../../../../types/campus';
import type { ForumCommunity, ForumPost, ForumPostType, ReviewTarget } from '../api/forumApi';

/** Screens inside Friends > Forum (an in-tab stack so the sub-tab bar stays visible). */
export type ForumRoute =
  | { name: 'community'; id: string; community?: ForumCommunity | null }
  | { name: 'post'; id: string; post?: ForumPost | null; focusCommentId?: string | null }
  | { name: 'target'; id: string; target?: ReviewTarget | null }
  | { name: 'reviews' }
  | { name: 'search'; communityId?: string | null; communityName?: string | null }
  | { name: 'library'; tab: 'mine' | 'saved' }
  | { name: 'modqueue'; communityId?: string | null };

export interface ComposerRequest {
  community?: ForumCommunity | null;
  type?: ForumPostType;
  reviewTarget?: ReviewTarget | null;
  freshersGuide?: boolean;
  /** Edit an existing post (author only). */
  edit?: ForumPost | null;
}

export interface ForumNav {
  push: (r: ForumRoute) => void;
  back: () => void;
  openComposer: (req: ComposerRequest) => void;
  openUser: (userId: string) => void;
  /** Refetch Friends eligibility (guidelines / flag / sanction changed under us). */
  onGateError: (e: any) => void;
  /** Called after a successful block so lists can drop that author's named content. */
  onBlocked: (userId: string) => void;
  me: string | null;
  roles: CampusRole[];
  /** Communities as last loaded (composer picker, names). */
  communities: ForumCommunity[];
  /** Bumped after anything that can change karma (refreshes the standing card). */
  bumpStanding: () => void;
}

const noop = () => {};
export const ForumNavContext = createContext<ForumNav>({
  push: noop,
  back: noop,
  openComposer: noop,
  openUser: noop,
  onGateError: noop,
  onBlocked: noop,
  me: null,
  roles: [],
  communities: [],
  bumpStanding: noop,
});

export const useForumNav = () => useContext(ForumNavContext);
