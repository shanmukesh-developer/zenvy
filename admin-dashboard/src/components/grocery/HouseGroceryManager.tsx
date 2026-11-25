"use client";
// ZenWe Grocery manager (owner, 26 Nov 2026: "ZenWe's own Grocery store ... products only the admin adds, like
// Blinkit / BigBasket"). Two tabs:
//  - Products: search + category filter, add / edit / delete, in-stock switch per product, bulk in stock / sold out.
//  - Categories: add, rename, reorder, delete (only when empty), each with an optional tile image for the app.
// Every change saves at once on the server (validated, audited) and reaches the app within about 30 seconds.
// Backend: /api/admin/house-grocery/* (backend/controllers/houseGroceryController).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Badge, Button, Card, CardBody, Checkbox, EmptyState, ErrorState, Field, IconButton, Input, LoadingState, Modal, Notice,
  SearchInput, Select, Switch, Tabs, Textarea, useConfirm, usePrompt, useToast,
  IconArrowUp, IconArrowDown, IconEdit, IconImage, IconPlus, IconTrash, IconUpload, IconX,
} from '@/components/ui';
import { adminRequest, uploadImage } from '@/lib/api';

type Category = { id: string; name: string; imageUrl: string | null; order: number; itemCount: number };
type Store = { id: string; name: string; isActive: boolean; location: string; operatingHours?: { start?: string; end?: string } | null };
type Overview = { store: Store | null; categories: Category[]; productCount: number; uncategorised: number };
type Diet = 'veg' | 'nonveg' | 'egg';
type Product = {
  id: string; name: string; imageUrl: string | null; price: number; originalPrice: number | null; packSize: string | null;
  dietType: Diet; isAvailable: boolean; description: string | null; category: string | null;
};
type Form = {
  id: string | null; name: string; imageUrl: string | null; price: string; originalPrice: string; packSize: string;
  dietType: Diet; isAvailable: boolean; description: string; category: string;
};

const BASE = '/api/admin/house-grocery';
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const rupees = (v: number) => `₹${Number.isInteger(v) ? v : v.toFixed(2)}`;
const DIET_LABEL: Record<Diet, string> = { veg: 'Veg', nonveg: 'Non-veg', egg: 'Egg' };
const PACK_HINTS = ['1 kg', '500 g', '1 L', '500 ml', '6 pcs', '1 pack'];

const emptyForm = (category = ''): Form => ({ id: null, name: '', imageUrl: null, price: '', originalPrice: '', packSize: '', dietType: 'veg', isAvailable: true, description: '', category });
const formOf = (p: Product): Form => ({
  id: p.id, name: p.name, imageUrl: p.imageUrl, price: String(p.price), originalPrice: p.originalPrice ? String(p.originalPrice) : '',
  packSize: p.packSize || '', dietType: p.dietType, isAvailable: p.isAvailable, description: p.description || '', category: p.category || '',
});

function Thumb({ url, alt, size = 48 }: { url: string | null; alt: string; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <IconImage size={Math.round(size / 2.6)} className="text-fg-subtle" />
      )}
    </div>
  );
}

/** Upload button that hands back the uploaded image URL. */
function UploadButton({ label, onUploaded, disabled, size = 'sm' }: { label: string; onUploaded: (url: string) => Promise<void> | void; disabled?: boolean; size?: 'sm' | 'md' }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await onUploaded(await uploadImage(file));
    } catch (e) {
      toast.error(errText(e, 'Could not upload the photo.'));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      <Button size={size} leftIcon={<IconUpload size={14} />} loading={busy} disabled={disabled || busy} onClick={() => ref.current?.click()}>{label}</Button>
    </>
  );
}

export default function HouseGroceryManager() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [settingUp, setSettingUp] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await adminRequest<Overview>(BASE));
      setLoadError(null);
    } catch (e) {
      setLoadError(errText(e, 'Could not load the Grocery store.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setup = async () => {
    setSettingUp(true);
    try {
      await adminRequest(`${BASE}/setup`, { method: 'POST', body: '{}' });
      toast.success('ZenWe Grocery is set up.');
      await load();
    } catch (e) {
      toast.error(errText(e, 'Could not set up the store.'));
    } finally {
      setSettingUp(false);
    }
  };

  if (loadError && !data) return <ErrorState title="Could not load the Grocery store" message={loadError} onRetry={() => void load()} />;
  if (!data) return <LoadingState />;
  if (!data.store) {
    return (
      <Card><CardBody>
        <EmptyState
          title="ZenWe Grocery is not set up"
          description="It is created automatically when the server starts. Set it up now to add categories and products."
          action={<Button variant="primary" loading={settingUp} onClick={() => void setup()}>Set up ZenWe Grocery</Button>}
        />
      </CardBody></Card>
    );
  }
  const store = data.store;
  const hours = store.operatingHours && store.operatingHours.start ? `${store.operatingHours.start}–${store.operatingHours.end}` : null;

  return (
    <div className="space-y-4">
      <Card><CardBody className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{store.name}</p>
          <p className="text-xs text-fg-muted">
            {store.location}{hours ? ` · open ${hours}` : ''} · {data.productCount} product{data.productCount === 1 ? '' : 's'} in {data.categories.length} categor{data.categories.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <Badge tone={store.isActive ? 'success' : 'warning'}>{store.isActive ? 'Live in the app' : 'Switched off'}</Badge>
        <Link href="/restaurants" className="text-sm font-medium text-accent-text underline-offset-2 hover:underline">Hours, photo and switch: Stores</Link>
      </CardBody></Card>
      {!store.isActive && <Notice tone="warning" title="ZenWe Grocery is switched off">Students see no products in the Grocery store until it is switched on again in Stores.</Notice>}
      {data.uncategorised > 0 && <Notice tone="warning">{data.uncategorised} product{data.uncategorised === 1 ? ' has' : 's have'} a category that is not in the list. Edit them and pick a category.</Notice>}
      <Tabs
        tabs={[{ id: 'products', label: 'Products', count: data.productCount }, { id: 'categories', label: 'Categories', count: data.categories.length }]}
        value={tab}
        onChange={setTab}
        ariaLabel="Grocery store"
      />
      {tab === 'products'
        ? <ProductsPanel categories={data.categories} onChanged={load} onAddCategory={() => setTab('categories')} />
        : <CategoriesPanel categories={data.categories} onChanged={load} />}
    </div>
  );
}

// ── Products ──────────────────────────────────────────────────────────────────
function ProductsPanel({ categories, onChanged, onAddCategory }: { categories: Category[]; onChanged: () => Promise<void>; onAddCategory: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<Form | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminRequest<{ products: Product[] }>(`${BASE}/products`);
      setProducts(res.products);
      setError(null);
    } catch (e) {
      setError(errText(e, 'Could not load the products.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (products || []).filter(p => (!category || p.category === category) && (!needle || p.name.toLowerCase().includes(needle) || (p.packSize || '').toLowerCase().includes(needle)));
  }, [products, q, category]);
  const allShownSelected = shown.length > 0 && shown.every(p => selected.has(p.id));

  const refresh = async () => { await Promise.all([load(), onChanged()]); };

  const setStock = async (p: Product, isAvailable: boolean) => {
    setBusyId(p.id);
    try {
      const res = await adminRequest<{ product: Product }>(`${BASE}/products/${encodeURIComponent(p.id)}`, { method: 'PUT', body: JSON.stringify({ isAvailable }) });
      setProducts(list => (list || []).map(x => (x.id === p.id ? res.product : x)));
    } catch (e) {
      toast.error(errText(e, 'Could not change the stock.'));
    } finally {
      setBusyId(null);
    }
  };
  const bulkStock = async (isAvailable: boolean) => {
    setBulkBusy(true);
    try {
      const res = await adminRequest<{ updated: number }>(`${BASE}/products/stock`, { method: 'POST', body: JSON.stringify({ ids: [...selected], isAvailable }) });
      toast.success(`${res.updated} product${res.updated === 1 ? '' : 's'} marked ${isAvailable ? 'in stock' : 'sold out'}.`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(errText(e, 'Could not change the stock.'));
    } finally {
      setBulkBusy(false);
    }
  };
  const remove = async (p: Product) => {
    const ok = await confirm({ title: `Delete ${p.name}?`, description: 'It disappears from the app at once. This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await adminRequest(`${BASE}/products/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      toast.success(`${p.name} deleted.`);
      setSelected(s => { const n = new Set(s); n.delete(p.id); return n; });
      await refresh();
    } catch (e) {
      toast.error(errText(e, 'Could not delete the product.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!categories.length) {
    return (
      <Card><CardBody>
        <EmptyState title="Add a category first" description="Every product belongs to a category (the tiles in the app). Add categories such as Staples, Dairy or Snacks, then add products." action={<Button variant="primary" leftIcon={<IconPlus size={14} />} onClick={onAddCategory}>Add categories</Button>} />
      </CardBody></Card>
    );
  }
  if (error && !products) return <ErrorState title="Could not load the products" message={error} onRetry={() => void load()} />;
  if (!products) return <LoadingState />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search products" className="min-w-[200px] flex-1" ariaLabel="Search products" />
        <Select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category" className="w-auto min-w-[180px]">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name} ({c.itemCount})</option>)}
        </Select>
        <Button variant="primary" leftIcon={<IconPlus size={14} />} onClick={() => setForm(emptyForm(category || categories[0]?.name || ''))}>Add product</Button>
      </div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" loading={bulkBusy} onClick={() => void bulkStock(true)}>Mark in stock</Button>
          <Button size="sm" loading={bulkBusy} onClick={() => void bulkStock(false)}>Mark sold out</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      {shown.length === 0 ? (
        <Card><CardBody>
          <EmptyState title={products.length ? 'No products match' : 'No products yet'} description={products.length ? 'Try another search or category.' : 'Add the first product of ZenWe Grocery.'} />
        </CardBody></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-3 py-2 text-xs text-fg-muted">
            <Checkbox
              checked={allShownSelected}
              aria-label="Select all shown products"
              onChange={() => setSelected(s => { const n = new Set(s); if (allShownSelected) shown.forEach(p => n.delete(p.id)); else shown.forEach(p => n.add(p.id)); return n; })}
            />
            <span className="flex-1">{shown.length} product{shown.length === 1 ? '' : 's'}</span>
            <span className="hidden w-24 sm:block">In stock</span>
            <span className="w-[72px]" />
          </div>
          <ul className="divide-y divide-line">
            {shown.map(p => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox
                  checked={selected.has(p.id)}
                  aria-label={`Select ${p.name}`}
                  onChange={() => setSelected(s => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                />
                <Thumb url={p.imageUrl} alt={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}{p.packSize ? <span className="font-normal text-fg-muted"> · {p.packSize}</span> : null}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {rupees(p.price)}{p.originalPrice && p.originalPrice > p.price ? <> <s>{rupees(p.originalPrice)}</s> ({Math.round((100 * (p.originalPrice - p.price)) / p.originalPrice)}% off)</> : null}
                    {' · '}{p.category || 'No category'}
                  </p>
                </div>
                <Badge tone={p.dietType === 'veg' ? 'success' : 'danger'}>{DIET_LABEL[p.dietType]}</Badge>
                <div className="w-24">
                  <Switch checked={p.isAvailable} disabled={busyId === p.id} onChange={v => void setStock(p, v)} label={<span className="text-xs">{p.isAvailable ? 'In stock' : 'Sold out'}</span>} size="sm" />
                </div>
                <IconButton label={`Edit ${p.name}`} size="sm" onClick={() => setForm(formOf(p))}><IconEdit size={14} /></IconButton>
                <IconButton label={`Delete ${p.name}`} size="sm" disabled={busyId === p.id} onClick={() => void remove(p)}><IconTrash size={14} /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {form && <ProductModal form={form} categories={categories} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await refresh(); }} />}
    </div>
  );
}

function ProductModal({ form: initial, categories, onClose, onSaved }: { form: Form; categories: Category[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [f, setF] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const set = (patch: Partial<Form>) => setF(x => ({ ...x, ...patch }));

  const validate = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!f.name.trim()) e.name = 'Enter the product name.';
    const price = Number(f.price);
    if (!f.price.trim() || !Number.isFinite(price) || price <= 0) e.price = 'Enter a price above ₹0.';
    if (f.originalPrice.trim()) {
      const mrp = Number(f.originalPrice);
      if (!Number.isFinite(mrp) || mrp <= 0) e.originalPrice = 'Enter a valid MRP, or leave it empty.';
      else if (Number.isFinite(price) && mrp < price) e.originalPrice = 'MRP cannot be lower than the price.';
    }
    if (!f.category) e.category = 'Pick a category.';
    if (f.packSize.length > 40) e.packSize = 'At most 40 characters.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const body = {
      name: f.name.trim(), imageUrl: f.imageUrl, price: Number(f.price), originalPrice: f.originalPrice.trim() ? Number(f.originalPrice) : null,
      packSize: f.packSize.trim(), dietType: f.dietType, isAvailable: f.isAvailable, description: f.description.trim(), category: f.category,
    };
    try {
      if (f.id) await adminRequest(`${BASE}/products/${encodeURIComponent(f.id)}`, { method: 'PUT', body: JSON.stringify(body) });
      else await adminRequest(`${BASE}/products`, { method: 'POST', body: JSON.stringify(body) });
      toast.success(f.id ? `${body.name} saved.` : `${body.name} added.`);
      await onSaved();
    } catch (e) {
      toast.error(errText(e, 'Could not save the product.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!saving}
      size="lg"
      title={f.id ? `Edit ${initial.name}` : 'Add product'}
      description="Shown in the app's Groceries tab > Grocery store with the pack size and the MRP struck through."
      footer={<>
        <Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={() => void save()}>{f.id ? 'Save' : 'Add product'}</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Thumb url={f.imageUrl} alt={f.name || 'Product photo'} size={72} />
          <div className="flex flex-wrap gap-2">
            <UploadButton label={f.imageUrl ? 'Replace photo' : 'Upload photo'} disabled={saving} onUploaded={url => set({ imageUrl: url })} />
            {f.imageUrl && <Button size="sm" variant="ghost" leftIcon={<IconX size={14} />} disabled={saving} onClick={() => set({ imageUrl: null })}>Remove photo</Button>}
          </div>
        </div>
        <Field label="Product name" required error={errors.name}>
          <Input value={f.name} maxLength={120} onChange={e => set({ name: e.target.value })} placeholder="e.g. Aashirvaad Atta" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Price (₹)" required error={errors.price}>
            <Input inputMode="decimal" value={f.price} onChange={e => set({ price: e.target.value })} placeholder="65" />
          </Field>
          <Field label="MRP (₹)" optional error={errors.originalPrice} hint="Struck through when above the price.">
            <Input inputMode="decimal" value={f.originalPrice} onChange={e => set({ originalPrice: e.target.value })} placeholder="72" />
          </Field>
          <Field label="Pack size" optional error={errors.packSize} hint={`e.g. ${PACK_HINTS.slice(0, 3).join(', ')}`}>
            <Input value={f.packSize} maxLength={40} list="hg-pack-hints" onChange={e => set({ packSize: e.target.value })} placeholder="1 kg" />
          </Field>
        </div>
        <datalist id="hg-pack-hints">{PACK_HINTS.map(h => <option key={h} value={h} />)}</datalist>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" required error={errors.category}>
            <Select value={f.category} onChange={e => set({ category: e.target.value })}>
              <option value="" disabled>Pick a category</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Veg / non-veg">
            <Select value={f.dietType} onChange={e => set({ dietType: e.target.value as Diet })}>
              <option value="veg">Veg</option>
              <option value="nonveg">Non-veg</option>
              <option value="egg">Egg</option>
            </Select>
          </Field>
        </div>
        <Field label="Short description" optional>
          <Textarea rows={2} maxLength={500} value={f.description} onChange={e => set({ description: e.target.value })} placeholder="One line about the product" />
        </Field>
        <Switch checked={f.isAvailable} onChange={v => set({ isAvailable: v })} label="In stock" description="Sold out products stay listed but cannot be added to the basket." />
      </div>
    </Modal>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
function CategoriesPanel({ categories, onChanged }: { categories: Category[]; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, done: string, fallback: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      await onChanged();
    } catch (e) {
      toast.error(errText(e, fallback));
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    const n = name.trim();
    if (!n) { toast.error('Enter the category name.'); return; }
    await run('add', () => adminRequest(`${BASE}/categories`, { method: 'POST', body: JSON.stringify({ name: n, imageUrl }) }), `${n} added.`, 'Could not add the category.');
    setName('');
    setImageUrl(null);
  };
  const update = (c: Category, body: Record<string, unknown>, done: string) =>
    run(c.id, () => adminRequest(`${BASE}/categories/${encodeURIComponent(c.id)}`, { method: 'PUT', body: JSON.stringify(body) }), done, 'Could not save the category.');
  const rename = async (c: Category) => {
    const next = await prompt({ title: `Rename ${c.name}`, label: 'Category name', defaultValue: c.name, maxLength: 60, minLength: 1, confirmLabel: 'Rename', description: c.itemCount ? `Its ${c.itemCount} product${c.itemCount === 1 ? '' : 's'} move to the new name.` : undefined });
    if (next === null || next.trim() === c.name) return;
    await update(c, { name: next.trim() }, 'Category renamed.');
  };
  const move = async (index: number, dir: -1 | 1) => {
    const ids = categories.map(c => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await run('order', () => adminRequest(`${BASE}/categories/order`, { method: 'PUT', body: JSON.stringify({ ids }) }), 'Order saved.', 'Could not save the order.');
  };
  const remove = async (c: Category) => {
    const ok = await confirm({ title: `Delete ${c.name}?`, description: 'The tile disappears from the app.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    await run(c.id, () => adminRequest(`${BASE}/categories/${encodeURIComponent(c.id)}`, { method: 'DELETE' }), `${c.name} deleted.`, 'Could not delete the category.');
  };

  return (
    <div className="space-y-3">
      <Card><CardBody className="space-y-3">
        <p className="text-sm font-medium">Add a category</p>
        <div className="flex flex-wrap items-end gap-3">
          <Thumb url={imageUrl} alt="Tile image" size={48} />
          <Field label="Name" className="min-w-[200px] flex-1">
            <Input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="e.g. Fruits & vegetables" onKeyDown={e => { if (e.key === 'Enter') void add(); }} />
          </Field>
          <UploadButton label={imageUrl ? 'Replace tile image' : 'Tile image'} size="md" disabled={busy === 'add'} onUploaded={url => setImageUrl(url)} />
          <Button variant="primary" leftIcon={<IconPlus size={14} />} loading={busy === 'add'} onClick={() => void add()}>Add</Button>
        </div>
        <p className="text-xs text-fg-muted">The order here is the order of the tiles in the app. The image is optional (a square photo of a few products works best).</p>
      </CardBody></Card>
      {categories.length === 0 ? (
        <Card><CardBody><EmptyState title="No categories yet" description="Add categories such as Staples, Dairy, Snacks & drinks or Fruits & vegetables." /></CardBody></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {categories.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="flex shrink-0 flex-col">
                  <IconButton label={`Move ${c.name} up`} size="sm" disabled={!!busy || i === 0} onClick={() => void move(i, -1)}><IconArrowUp size={14} /></IconButton>
                  <IconButton label={`Move ${c.name} down`} size="sm" disabled={!!busy || i === categories.length - 1} onClick={() => void move(i, 1)}><IconArrowDown size={14} /></IconButton>
                </div>
                <Thumb url={c.imageUrl} alt={c.name} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-fg-muted">{c.itemCount} product{c.itemCount === 1 ? '' : 's'}{c.itemCount === 0 ? ' · hidden in the app until it has one' : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <UploadButton label={c.imageUrl ? 'Replace image' : 'Add image'} disabled={!!busy} onUploaded={url => update(c, { imageUrl: url }, 'Image saved.')} />
                  {c.imageUrl && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void update(c, { imageUrl: null }, 'Image removed.')}>Remove image</Button>}
                  <IconButton label={`Rename ${c.name}`} size="sm" disabled={!!busy} onClick={() => void rename(c)}><IconEdit size={14} /></IconButton>
                  <IconButton
                    label={c.itemCount ? `${c.name} has products: move or delete them first` : `Delete ${c.name}`}
                    size="sm"
                    disabled={!!busy || c.itemCount > 0}
                    onClick={() => void remove(c)}
                  ><IconTrash size={14} /></IconButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
