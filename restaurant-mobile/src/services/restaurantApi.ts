// Every backend call the partner app makes (one backend: /c/hostel-bite/backend on Render).
import { apiFetch, ApiError } from './apiClient';
import { normalizeMenuItem, normalizeOrder, normalizeStore } from './orderModel';
import type { MenuItem, Order, StoreState } from '../types';

const enc = encodeURIComponent;

export async function health(): Promise<boolean> {
  try {
    await apiFetch('/api/health', { auth: false, timeoutMs: 8000 });
    return true;
  } catch (e) {
    return e instanceof ApiError && e.status < 500; // server answered
  }
}

export function login(id: string, password: string): Promise<{ restaurant: any; token: string }> {
  return apiFetch('/api/restaurants/login', { method: 'POST', body: { id, password }, auth: false, timeoutMs: 45000 });
}

/** Store profile + live open state (public, not cached on the server). */
export async function getStore(id: string): Promise<{ store: StoreState; raw: any }> {
  const raw = await apiFetch(`/api/users/restaurants/${enc(id)}`);
  return { store: normalizeStore(raw), raw };
}

export async function getOrders(id: string): Promise<Order[]> {
  const rows = await apiFetch<any[]>(`/api/restaurants/${enc(id)}/orders`);
  return (Array.isArray(rows) ? rows : []).map(normalizeOrder).filter((o): o is Order => !!o);
}

export function acceptOrder(orderId: string, estDuration: number) {
  return apiFetch(`/api/orders/${enc(orderId)}/status`, { method: 'PUT', body: { status: 'Accepted', estDuration } });
}

export function rejectOrder(orderId: string, reason: string): Promise<{ status: string; refundedToWallet?: number }> {
  return apiFetch(`/api/orders/${enc(orderId)}/status`, { method: 'PUT', body: { status: 'Rejected', reason: reason.slice(0, 250) } });
}

export function markReady(orderId: string): Promise<{ status?: string }> {
  return apiFetch(`/api/orders/${enc(orderId)}/status`, { method: 'PUT', body: { status: 'ReadyForPickup' } });
}

export async function getMenu(id: string): Promise<MenuItem[]> {
  const rows = await apiFetch<any[]>(`/api/restaurants/${enc(id)}/menu`, { auth: false });
  return (Array.isArray(rows) ? rows : []).map(normalizeMenuItem).filter((m): m is MenuItem => !!m);
}

/** Always an explicit value: { isAvailable } or { outOfStockUntil: ISO }. */
export function setAvailability(itemId: string, body: { isAvailable: boolean } | { outOfStockUntil: string }) {
  // Older servers answer 401 "session stale" for a missing item: never treat that as a logout here.
  return apiFetch<{ isAvailable: boolean; outOfStockUntil?: string | null }>(
    `/api/restaurants/menu/${enc(itemId)}/toggle`, { method: 'PUT', body, no401Logout: true },
  );
}

export function setPrice(itemId: string, price: number) {
  return apiFetch(`/api/restaurants/menu/${enc(itemId)}`, { method: 'PUT', body: { price } });
}

/** Thrown when the server has no open/close route yet. */
export class OpenToggleUnsupported extends Error {}

export async function setOpen(id: string, isOpenNow: boolean): Promise<StoreState> {
  try {
    const raw = await apiFetch(`/api/restaurants/${enc(id)}/open`, { method: 'PUT', body: { isOpenNow } });
    return normalizeStore(raw);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404 && !/restaurant not found/i.test(e.message)) {
      throw new OpenToggleUnsupported('Store open/close is not available yet');
    }
    throw e;
  }
}
