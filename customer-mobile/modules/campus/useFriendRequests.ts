import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSocket } from '../../utils/socket';
import { fetchFriendRequests, FriendRequestItem } from './campusApi';

/**
 * Friend-request inbox for the Campus hub (badge on Me, Requests row in Chats).
 * Live: new / cancelled / answered requests arrive on the main app socket.
 */
export const useFriendRequests = (enabled: boolean) => {
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetchFriendRequests();
      if (!mounted.current) return;
      setIncoming(res.incoming);
      setOutgoing(res.outgoing);
      setError(null);
    } catch (e: any) {
      if (mounted.current) setError(e?.message || "Couldn't load friend requests.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    let socket: ReturnType<typeof connectSocket> | null = null;
    try {
      socket = connectSocket();
    } catch {
      return;
    }
    const refresh = () => reload();
    const events = ['incoming_friend_request', 'friend_request_cancelled', 'friend_request_accepted', 'friend_request_declined'];
    events.forEach((e) => socket!.on(e, refresh));
    return () => {
      events.forEach((e) => socket!.off(e, refresh));
    };
  }, [enabled, reload]);

  return { incoming, outgoing, loading, error, reload, setIncoming, setOutgoing };
};

export type FriendRequestsState = ReturnType<typeof useFriendRequests>;
