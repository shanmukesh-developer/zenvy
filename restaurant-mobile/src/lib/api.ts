// Every backend call the partner app makes (one backend: /c/hostel-bite/backend on Render).
import { Platform } from 'react-native';
import { apiFetch, ApiError } from './http';
import { normalizeMenuItem, normalizeOrder, normalizeStore } from './model';
import type { MenuItem, Order, StoreState } from '../types';

const enc = encodeURIComponent;

/** true when the server answered at all (it sleeps on Render's free tier). */
export async function health(): Promise<boolean> {
  try {
    await apiFetch('/api/health', { auth: false, timeoutMs: 8000 });
    return true;
  } catch (e) {
    return e instanceof ApiError && e.status < 500;
  }
}

export function login(id: string, password: string): Promise<{ restaurant: any; token: string }> {
  return apiFetch('/api/restaurants/login', { method: 'POST', body: { id, password }, auth: false, timeoutMs: 45000 });
}

/** Store profile + live open state (public, no-cache on the server). */
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

export function rejectOrder(orderId: string, reason: string): Promise<{ status?: string; refundedToWallet?: number }> {
  return apiFetch(`/api/orders/${enc(orderId)}/status`, { method: 'PUT', body: { status: 'Rejected', reason: reason.slice(0, 250) } });
}

/** 200 `{ status: 'Picking' }` when the rider is already at the counter (status stays Picking). */
export function markReady(orderId: string): Promise<{ status?: string }> {
  return apiFetch(`/api/orders/${enc(orderId)}/status`, { method: 'PUT', body: { status: 'ReadyForPickup' } });
}

export async function getMenu(id: string): Promise<MenuItem[]> {
  const rows = await apiFetch<any[]>(`/api/restaurants/${enc(id)}/menu`, { auth: false });
  return (Array.isArray(rows) ? rows : []).map(normalizeMenuItem).filter((m): m is MenuItem => !!m);
}

/** Always an explicit value: { isAvailable } or { outOfStockUntil: ISO }. 404 = item deleted. */
export function setAvailability(itemId: string, body: { isAvailable: boolean } | { outOfStockUntil: string }) {
  return apiFetch<{ isAvailable?: boolean; outOfStockUntil?: string | null }>(
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

// ── Menu items (add / edit / delete) ────────────────────────────────────────
/** Fields the vendor menu routes accept (POST /api/restaurants/menu, PUT /api/restaurants/menu/:id). */
export interface MenuItemBody {
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  isVegetarian: boolean;
}

export async function createMenuItem(body: MenuItemBody): Promise<MenuItem> {
  const raw = await apiFetch('/api/restaurants/menu', { method: 'POST', body, no401Logout: true, timeoutMs: 30000 });
  const item = normalizeMenuItem(raw);
  if (!item) throw new ApiError(500, 'The item was saved but the reply was empty. Pull down to refresh your menu.', raw);
  return item;
}

export async function updateMenuItem(itemId: string, body: Partial<MenuItemBody>): Promise<MenuItem | null> {
  const raw = await apiFetch(`/api/restaurants/menu/${enc(itemId)}`, { method: 'PUT', body, no401Logout: true, timeoutMs: 30000 });
  return normalizeMenuItem(raw);
}

/** Replaces the item's tags (used for the "egg" mark). */
export function setMenuTags(itemId: string, tags: string[]) {
  return apiFetch(`/api/restaurants/menu/${enc(itemId)}/tags`, { method: 'PUT', body: { tags }, no401Logout: true });
}

/** Thrown when the server has no vendor delete route yet. */
export class DeleteUnsupported extends Error {}

export async function deleteMenuItem(itemId: string): Promise<void> {
  try {
    await apiFetch(`/api/restaurants/menu/${enc(itemId)}`, { method: 'DELETE', no401Logout: true });
  } catch (e) {
    // Unknown route → the API's catch-all { code: 'NOT_FOUND' }. A real "item not found" has no such code.
    if (e instanceof ApiError && (e.status === 405 || (e.status === 404 && e.code === 'NOT_FOUND'))) {
      throw new DeleteUnsupported('Deleting items is not available yet');
    }
    throw e;
  }
}

/** POST /api/upload (multipart field "image", JPEG/PNG/WEBP, max 2 MB). Returns the URL to save on the item. */
export async function uploadPhoto(uri: string, mimeType = 'image/jpeg'): Promise<string> {
  const form = new FormData();
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('image', blob, `item.${ext}`);
  } else {
    // React Native's FormData file shape.
    form.append('image', { uri, name: `item.${ext}`, type: mimeType } as any);
  }
  const res = await apiFetch<{ imageUrl?: string }>('/api/upload', { method: 'POST', form, no401Logout: true, timeoutMs: 60000 });
  if (!res?.imageUrl) throw new ApiError(500, "The photo didn't upload. Please try again.", res);
  return res.imageUrl;
}
