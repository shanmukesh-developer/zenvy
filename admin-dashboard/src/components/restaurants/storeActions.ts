import { Product, Store, adminRequest, dietOf, mrpOf, readSpecs, storeAppPath, storeId, vendorLabel } from '@/app/restaurants/catalogue';

type Banner = Record<string, unknown>;

export async function patchStore(id: string, patch: Record<string, unknown>): Promise<Store> {
  return adminRequest<Store>(`/api/admin/restaurants/${id}`, { method: 'POST', body: JSON.stringify(patch) });
}

async function readBanners(): Promise<Banner[]> {
  const cfg = await adminRequest<{ config?: { banners?: Banner[] } }>('/api/config');
  return Array.isArray(cfg?.config?.banners) ? cfg.config!.banners! : [];
}

export async function hasStoreBanner(id: string): Promise<boolean> {
  const banners = await readBanners();
  return banners.some(b => b.redirectUrl === storeAppPath(id));
}

/**
 * Removes the Home banner that links to this store, so ending a promotion or deactivating/deleting the store
 * never leaves a dead banner in /api/config. Returns an error message, or null.
 */
export async function removeStoreBanner(id: string): Promise<string | null> {
  try {
    const banners = await readBanners();
    const next = banners.filter(b => b.redirectUrl !== storeAppPath(id));
    if (next.length === banners.length) return null;
    await adminRequest('/api/config', { method: 'PUT', body: JSON.stringify({ banners: next }) });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'unknown error';
  }
}

/** Adds (or updates) a Home hero banner that opens this store. */
export async function upsertStoreBanner(store: Store, badge: string, offer: string): Promise<void> {
  if (!store.imageUrl) throw new Error('Add a cover photo before adding a Home banner.');
  const banners = await readBanners();
  const redirectUrl = storeAppPath(storeId(store));
  const banner = {
    imageUrl: store.imageUrl,
    tagline: badge || 'Featured',
    title1: store.name.toUpperCase(),
    title2: offer || vendorLabel(store.vendorType),
    description: `Order from ${store.name} on Zenvy.`,
    buttonText: 'ORDER NOW',
    redirectUrl,
    isActive: true,
  };
  const index = banners.findIndex(b => b.redirectUrl === redirectUrl);
  const next = index >= 0 ? banners.map((b, i) => (i === index ? { ...b, ...banner } : b)) : [banner, ...banners];
  await adminRequest('/api/config', { method: 'PUT', body: JSON.stringify({ banners: next }) });
}

/**
 * POST /api/admin/restaurants/:id/duplicate. The copy is a draft (hidden) without password, login phone,
 * push devices, rating or promotion. Store names must be unique (409 with a friendly message).
 */
export async function duplicateStore(id: string, name: string, copyMenu: boolean): Promise<Store> {
  return adminRequest<Store>(`/api/admin/restaurants/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ name, copyMenu }) });
}

/** POST /api/admin/restaurants/bulk-update (max 300 ids). */
export async function bulkUpdateStores(ids: string[], patch: { isActive?: boolean; isOpenNow?: boolean; isFeatured?: boolean }) {
  return adminRequest<{ count: number; notFound: number; message?: string }>('/api/admin/restaurants/bulk-update', { method: 'POST', body: JSON.stringify({ ids, patch }) });
}

/** POST /api/admin/menu-items/bulk-update (max 300 ids). */
export async function bulkUpdateItems(ids: string[], patch: Record<string, unknown>) {
  return adminRequest<{ count: number; notFound: number; message?: string }>('/api/admin/menu-items/bulk-update', { method: 'POST', body: JSON.stringify({ ids, patch }) });
}

/** Item fields for "Duplicate item" (same store). */
export function duplicateItemPayload(p: Product, restaurantId: string): Record<string, unknown> {
  return {
    restaurantId,
    name: p.name,
    price: p.price,
    category: p.category || null,
    description: p.description || null,
    imageUrl: p.imageUrl || p.image || null,
    isAvailable: p.isAvailable,
    dietType: dietOf(p),
    isEliteOnly: !!p.isEliteOnly,
    tags: p.tags || [],
    specs: readSpecs(p.specs),
    originalPrice: mrpOf(p),
  };
}
