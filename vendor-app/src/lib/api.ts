// Every backend call the vendor app makes (one backend: /c/hostel-bite/backend on Render).
// Contract: scratchpad vendor_contract.md. Reuses the restaurant routes; local vendors are Restaurant rows
// with vendorType LOCAL_VENDOR and log in with role "restaurant".
import { Platform } from 'react-native';
import { apiFetch, ApiError } from './http';
import { normalizeMenuItem, normalizeOrder, normalizeStore } from './model';
import type { MenuItem, OperatingHours, Order, StoreState } from '../types';

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

/** Indian mobile → 10 digits ("+91 98765-43210" → "9876543210"); null when it is not a phone number. */
export function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  return null;
}

/**
 * POST /api/restaurants/login. A phone number is sent as `phone` (contract §1); anything else (a stall ID
 * given by Zenvy support) goes as `id`, which the server already accepts today.
 */
export function login(identifier: string, password: string): Promise<{ restaurant: any; token: string }> {
  const phone = normalizePhone(identifier);
  const body = phone ? { phone, password, app: 'vendor' } : { id: identifier.trim(), password, app: 'vendor' };
  return apiFetch('/api/restaurants/login', { method: 'POST', body, auth: false, timeoutMs: 45000 });
}

/** Shop profile + live open state (public, no-cache on the server). */
export async function getStore(id: string): Promise<{ store: StoreState; raw: any }> {
  const raw = await apiFetch(`/api/users/restaurants/${enc(id)}`);
  return { store: normalizeStore(raw), raw };
}

/** The stall's latest orders, with the customer's name + phone (owning vendor only, contract §4). */
export async function getOrders(id: string): Promise<Order[]> {
  const rows = await apiFetch<any[]>(`/api/restaurants/${enc(id)}/orders`);
  return (Array.isArray(rows) ? rows : []).map(normalizeOrder).filter((o): o is Order => !!o);
}

export type VendorStatus = 'Accepted' | 'OutForDelivery' | 'Delivered' | 'Cancelled';

/** PUT /api/orders/:id/status (contract §3). Cancelled needs a reason (shown to the customer). */
export function setOrderStatus(orderId: string, status: VendorStatus, reason?: string): Promise<{ status?: string }> {
  const body: Record<string, unknown> = { status };
  if (reason) body.reason = reason.slice(0, 250);
  return apiFetch(`/api/orders/${enc(orderId)}/status`, { method: 'PUT', body });
}

export async function getMenu(id: string): Promise<MenuItem[]> {
  const rows = await apiFetch<any[]>(`/api/restaurants/${enc(id)}/menu`, { auth: false });
  return (Array.isArray(rows) ? rows : []).map(normalizeMenuItem).filter((m): m is MenuItem => !!m);
}

/** 404 = item deleted. */
export function setAvailability(itemId: string, isAvailable: boolean) {
  return apiFetch<{ isAvailable?: boolean }>(
    `/api/restaurants/menu/${enc(itemId)}/toggle`, { method: 'PUT', body: { isAvailable }, no401Logout: true },
  );
}

/** Thrown when the server has no open/close route. */
export class OpenToggleUnsupported extends Error {}

export async function setOpen(id: string, isOpenNow: boolean): Promise<StoreState> {
  try {
    const raw = await apiFetch(`/api/restaurants/${enc(id)}/open`, { method: 'PUT', body: { isOpenNow } });
    return normalizeStore(raw);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404 && !/not found/i.test(e.message)) {
      throw new OpenToggleUnsupported('Shop open/close is not available yet');
    }
    throw e;
  }
}

/** Thrown when the server has no vendor hours route yet (contract §6). */
export class HoursUnsupported extends Error {}

export async function setHours(id: string, hours: OperatingHours): Promise<StoreState> {
  try {
    const raw = await apiFetch(`/api/restaurants/${enc(id)}/hours`, { method: 'PUT', body: { operatingHours: hours } });
    return normalizeStore(raw);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 405 || (e.status === 404 && e.code === 'NOT_FOUND'))) {
      throw new HoursUnsupported('Changing hours is not available yet');
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

/** Thrown when the server has no vendor delete route yet (contract §6). */
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
