"use client";
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  AdminUser,
  AuthStatus,
  getAuthState,
  getServerAuthState,
  subscribe,
  verifySession,
} from '@/lib/session';

export interface AdminAuth {
  status: AuthStatus;
  user: AdminUser | null;
  message: string | null;
  /** Convenience flag: status === 'authed'. */
  isAuthed: boolean;
  /** Re-run the server check (used by the error state's Retry button). */
  retry: () => void;
}

/**
 * Server-verified admin session.
 *
 * The first consumer triggers GET /api/admin/me; everyone shares the result.
 * NexusLayoutClient already gates every dashboard page on this, so pages only
 * need `const { isAuthed, user } = useAdminAuth()` when they want the user.
 */
export function useAdminAuth(): AdminAuth {
  const state = useSyncExternalStore(subscribe, getAuthState, getServerAuthState);

  useEffect(() => {
    if (getAuthState().status === 'checking') verifySession();
  }, []);

  return useMemo(
    () => ({
      status: state.status,
      user: state.user,
      message: state.message,
      isAuthed: state.status === 'authed',
      retry: () => {
        verifySession();
      },
    }),
    [state]
  );
}
