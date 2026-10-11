// Rider socket: live location for the customer map / admin, plus rider-room events.
// The server auto-joins `rider_<id>`; order rooms need joinOrder (membership-checked server-side).
import { io, Socket } from 'socket.io-client';
import { getApiBase } from './apiClient';
import { socketBaseUrl } from '../constants/api';

export interface RiderSocketHandlers {
  onOrderCancelled?: (p: { orderId: string; reason?: string }) => void;
  onOrderReady?: (p: { orderId: string }) => void;
  onTip?: (p: { amount: number; from?: string; orderId?: string }) => void;
  onTicketUpdated?: (p: { id: string; status: string; adminResponse?: string | null }) => void;
  onConnectionChange?: (connected: boolean) => void;
}

let socket: Socket | null = null;
let joined = new Set<string>();
let handlers: RiderSocketHandlers = {};

export function connectSocket(token: string): void {
  if (socket) return;
  joined = new Set();
  socket = io(socketBaseUrl(getApiBase()), {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
  });
  socket.on('connect', () => {
    handlers.onConnectionChange?.(true);
    // Rooms are per connection: re-join after every reconnect.
    const rooms = [...joined];
    rooms.forEach((id) => socket?.emit('joinOrder', id));
  });
  socket.on('disconnect', () => handlers.onConnectionChange?.(false));
  socket.on('orderCancelled', (p: any) => p?.orderId && handlers.onOrderCancelled?.({ orderId: String(p.orderId), reason: p.reason }));
  socket.on('orderReady', (p: any) => p?.orderId && handlers.onOrderReady?.({ orderId: String(p.orderId) }));
  socket.on('rider_tip_received', (p: any) => {
    const amount = Number(p?.amount);
    if (Number.isFinite(amount) && amount > 0) handlers.onTip?.({ amount, from: p?.from, orderId: p?.orderId });
  });
  socket.on('ticket_updated', (p: any) => p?.id && handlers.onTicketUpdated?.(p));
}

export function setSocketHandlers(h: RiderSocketHandlers): void {
  handlers = h;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  joined = new Set();
}

/** Keep order-room membership equal to the rider's active orders. */
export function syncOrderRooms(orderIds: string[]): void {
  const next = new Set(orderIds);
  next.forEach((id) => {
    if (!joined.has(id) && socket?.connected) socket.emit('joinOrder', id);
  });
  joined = next;
}

export function emitLocation(p: { lat: number; lng: number; heading?: number | null; speed?: number | null; orderId?: string }): void {
  if (!socket?.connected) return;
  socket.emit('rider_location_update', {
    lat: p.lat,
    lng: p.lng,
    heading: p.heading ?? null,
    speed: p.speed ?? null,
    ...(p.orderId ? { orderId: p.orderId } : {}),
  });
}

export function isSocketConnected(): boolean {
  return !!socket?.connected;
}
