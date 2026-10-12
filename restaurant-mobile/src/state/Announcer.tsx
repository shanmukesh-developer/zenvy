// Soundbox brain (renders nothing). Watches the orders list and the connection and speaks:
//  - new order: rings (vibration + chime + voice) at once, then every RING_REPEAT_MS until accepted /
//    rejected / silenced. Oldest waiting order first.
//  - status changes seen from the server: rider arrived, picked up, delivered, cancelled / timed out.
//  - connection lost (after OFFLINE_AFTER_MS) / back.
// Announcements are keyed per order + event, so a refetch or a duplicate socket event never repeats them.
import { useEffect, useRef } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { RING_REPEAT_MS } from '../config';
import { TIMED_OUT_REASON } from '../lib/model';
import { nativeOrderAlert } from '../voice/kitchenService';
import { announce, cancelAnnouncements, forgetAnnouncement, voiceEnabled } from '../voice/voice';
import { useStore } from './StoreProvider';
import type { Order } from '../types';

const RING_PATTERN = [0, 600, 250, 600, 250, 600];
const PRE_PICKUP = ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup'];
const BEFORE_HANDOVER = ['Pending', 'Accepted', 'Preparing', 'ReadyForPickup', 'Picking'];

function ring(o: Order) {
  if (Platform.OS !== 'web') Vibration.vibrate(RING_PATTERN);
  const amount = String(Math.round(o.totalPrice || 0));
  if (voiceEnabled()) {
    forgetAnnouncement(`new:${o.id}`);
    announce(
      `new:${o.id}`,
      { kind: 'newOrder', campus: o.campus, items: o.itemCount, total: o.totalPrice },
      { urgent: true, dedupeMs: 0, native: { orderNum: o.shortId, amount } },
    );
  } else if (AppState.currentState !== 'active') {
    // Voice off: still wake the phone with the native heads-up notification (no speech).
    nativeOrderAlert('', o.shortId, amount);
  }
}

export function Announcer() {
  const { alertOrders, orders, ordersLoaded, conn } = useStore();

  // ── New-order ringing ──
  const alertRef = useRef(alertOrders);
  alertRef.current = alertOrders;
  const rung = useRef<Set<string>>(new Set());
  const alertKey = alertOrders.map((o) => `${o.id}:${o.partial ? 'p' : 'f'}`).join(',');
  const hasAlerts = alertOrders.length > 0;

  useEffect(() => {
    const current = new Set(alertRef.current.map((o) => o.id));
    // Orders that left the alert list: stop their pending announcements.
    for (const id of rung.current) {
      if (!current.has(id)) {
        cancelAnnouncements(`new:${id}`);
        rung.current.delete(id);
      }
    }
    // Brand-new orders ring right away (newest first, each once).
    const fresh = alertRef.current.filter((o) => !rung.current.has(o.id));
    for (const o of fresh.slice().reverse()) {
      rung.current.add(o.id);
      ring(o);
    }
  }, [alertKey]);

  useEffect(() => {
    if (!hasAlerts) {
      if (Platform.OS !== 'web') Vibration.cancel();
      return;
    }
    const t = setInterval(() => {
      const oldest = alertRef.current[0];
      if (oldest) ring(oldest);
    }, RING_REPEAT_MS);
    return () => clearInterval(t);
  }, [hasAlerts]);

  // ── Status changes ──
  const prev = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!ordersLoaded) return;
    const before = prev.current;
    const next = new Map<string, string>();
    for (const o of orders) next.set(o.id, o.status);
    prev.current = next;
    if (!before) return; // first load: just remember, never announce history

    for (const o of orders) {
      const was = before.get(o.id);
      if (!was || was === o.status) continue;
      if (o.status === 'Picking' && PRE_PICKUP.includes(was)) {
        announce(`rider:${o.id}`, { kind: 'riderArrived', packed: !!o.readyAt || was === 'ReadyForPickup' }, { urgent: true });
      } else if ((o.status === 'PickedUp' || o.status === 'ArrivedAtGate') && BEFORE_HANDOVER.includes(was)) {
        announce(`picked:${o.id}`, { kind: 'pickedUp' });
      } else if (o.status === 'Delivered' && was !== 'Cancelled') {
        announce(`delivered:${o.id}`, { kind: 'delivered', amount: o.totalPrice });
      } else if (o.status === 'Cancelled' && was !== 'Delivered') {
        cancelAnnouncements(`new:${o.id}`);
        const timedOut = TIMED_OUT_REASON.test(o.cancellationReason || '');
        announce(`cancel:${o.id}`, { kind: timedOut ? 'timedOut' : 'cancelled' }, { urgent: true });
      }
    }
  }, [orders, ordersLoaded]);

  // ── Connection ──
  const wasOffline = useRef(false);
  useEffect(() => {
    if (conn === 'offline') {
      wasOffline.current = true;
      if (Platform.OS !== 'web') Vibration.vibrate([0, 300, 150, 300]);
      announce('conn:offline', { kind: 'offline' }, { dedupeMs: 5 * 60 * 1000 });
    } else if (conn === 'online' && wasOffline.current) {
      wasOffline.current = false;
      cancelAnnouncements('conn:offline');
      forgetAnnouncement('conn:offline');
      forgetAnnouncement('conn:online');
      announce('conn:online', { kind: 'online' }, { dedupeMs: 0 });
    }
  }, [conn]);

  useEffect(() => () => { if (Platform.OS !== 'web') Vibration.cancel(); }, []);

  return null;
}
