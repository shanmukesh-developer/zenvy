"use client";
// Home slideshow editor (owner, 24-25 Nov 2026). Three things the admin controls:
//  1. Which dishes the slideshow shows: up to 4 per diet (Non-veg / Veg), in order. Empty = automatic (the app picks
//     the biggest discounts, one per restaurant).
//  2. A dish's own slideshow image (e.g. a transparent PNG): wins over everything.
//  3. The automatic cut-out (the dish photo with its background removed on our server): used when there is no own
//     image, unless "Use round photo" is on; "Redo cut-out" makes it again.
// Every change is saved at once (audited on the server) and reaches the app on its next refresh.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, IconButton, Notice, SearchInput, Spinner, Tabs, useToast,
  IconArrowUp, IconArrowDown, IconX, IconPlus, IconUpload, IconRefresh, IconTrash,
} from '@/components/ui';
import { adminRequest, uploadImage } from '@/lib/api';

type Diet = 'nonveg' | 'veg';
type Dish = {
  id: string; name: string; restaurantId: string; storeName: string | null;
  price: number; originalPrice: number | null; diet: 'veg' | 'nonveg' | 'egg'; isAvailable: boolean;
  imageUrl: string | null; cutoutUrl: string | null; cutoutStatus: 'done' | 'failed' | 'pending' | 'none';
  slideshowImageUrl: string | null; slideshowRoundPhoto: boolean;
  shows: 'custom' | 'cutout' | 'round'; showsUrl: string | null;
};
type Cutouts = { enabled: boolean; total: number; done: number; failed: number; waiting: number; model: string; modelFile?: { isnet: string; lastError: string | null } } | null;
type State = { ids: Record<Diet, string[]>; nonveg: Dish[]; veg: Dish[]; max: number; cutouts: Cutouts };
type TabKey = Diet | 'images';

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const rupees = (v: number) => `₹${Math.round(v)}`;
const offPct = (d: Dish) => (d.originalPrice && d.originalPrice > d.price ? Math.round((100 * (d.originalPrice - d.price)) / d.originalPrice) : 0);

const SHOWS_LABEL: Record<Dish['shows'], string> = { custom: 'Your image', cutout: 'Cut-out', round: 'Round photo' };
const CUTOUT_BADGE: Record<Dish['cutoutStatus'], { tone: 'success' | 'danger' | 'warning' | 'neutral'; label: string }> = {
  done: { tone: 'success', label: 'Cut-out ready' },
  failed: { tone: 'danger', label: 'Cut-out failed' },
  pending: { tone: 'warning', label: 'Cut-out in progress' },
  none: { tone: 'neutral', label: 'No photo' },
};

/** What the app draws for this dish, on the slideshow's red. */
function SlidePreview({ dish, size = 132 }: { dish: Dish; size?: number }) {
  const floating = dish.shows !== 'round' && dish.showsUrl;
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #C8161D 0%, #8E0B12 100%)' }}
      title={SHOWS_LABEL[dish.shows]}
    >
      {dish.showsUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dish.showsUrl}
          alt={dish.name}
          className={floating ? 'absolute inset-1.5 h-[calc(100%-12px)] w-[calc(100%-12px)] object-contain' : 'absolute inset-3 h-[calc(100%-24px)] w-[calc(100%-24px)] rounded-full object-cover'}
          style={floating ? { filter: 'drop-shadow(0 8px 8px rgba(0,0,0,0.35))' } : undefined}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-white/80">No photo</span>
      )}
    </div>
  );
}

/** One dish with its image controls (and reorder / remove when it is in a slideshow list). */
function DishCard({ dish, onChanged, order }: {
  dish: Dish;
  onChanged: (d: Dish) => void;
  order?: { index: number; count: number; move: (dir: -1 | 1) => void; remove: () => void; busy: boolean };
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const change = async (what: string, body: Record<string, unknown>, done: string) => {
    setBusy(what);
    try {
      const res = await adminRequest<{ dish: Dish }>(`/api/admin/menu-items/${encodeURIComponent(dish.id)}/slideshow`, { method: 'PUT', body: JSON.stringify(body) });
      onChanged(res.dish);
      toast.success(done);
    } catch (e) {
      toast.error(errText(e, 'Could not change the dish.'));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    try {
      const url = await uploadImage(file, { keepAlpha: true });
      await change('upload', { slideshowImage: url }, 'Your image is set for this dish.');
    } catch (e) {
      toast.error(errText(e, 'Could not upload the image.'));
      setBusy(null);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const cb = CUTOUT_BADGE[dish.cutoutStatus];
  const off = offPct(dish);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row">
      <SlidePreview dish={dish} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{order ? `${order.index + 1}. ` : ''}{dish.name}</p>
            <p className="truncate text-xs text-fg-muted">
              {dish.storeName || 'Unknown store'} · {rupees(dish.price)}
              {dish.originalPrice && dish.originalPrice > dish.price ? <> <s>{rupees(dish.originalPrice)}</s> ({off}% off)</> : null}
            </p>
          </div>
          {order && (
            <div className="flex shrink-0 items-center">
              <IconButton label="Move up" size="sm" disabled={order.busy || order.index === 0} onClick={() => order.move(-1)}><IconArrowUp size={14} /></IconButton>
              <IconButton label="Move down" size="sm" disabled={order.busy || order.index === order.count - 1} onClick={() => order.move(1)}><IconArrowDown size={14} /></IconButton>
              <IconButton label="Remove from the slideshow" size="sm" disabled={order.busy} onClick={order.remove}><IconX size={14} /></IconButton>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="info">Shows: {SHOWS_LABEL[dish.shows]}</Badge>
          <Badge tone={dish.diet === 'veg' ? 'success' : 'danger'}>{dish.diet === 'veg' ? 'Veg' : dish.diet === 'egg' ? 'Egg' : 'Non-veg'}</Badge>
          <Badge tone={cb.tone}>{cb.label}</Badge>
          {!dish.isAvailable && <Badge tone="warning">Unavailable (skipped in the app)</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button size="sm" leftIcon={<IconUpload size={14} />} loading={busy === 'upload'} disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {dish.slideshowImageUrl ? 'Replace your image' : 'Upload your image'}
          </Button>
          {dish.slideshowImageUrl && (
            <Button size="sm" leftIcon={<IconTrash size={14} />} loading={busy === 'clear'} disabled={!!busy} onClick={() => void change('clear', { clearSlideshowImage: true }, 'Your image is removed.')}>
              Remove your image
            </Button>
          )}
          <Button
            size="sm"
            variant={dish.slideshowRoundPhoto ? 'primary' : 'secondary'}
            loading={busy === 'round'}
            disabled={!!busy}
            onClick={() => void change('round', { roundPhoto: !dish.slideshowRoundPhoto }, dish.slideshowRoundPhoto ? 'The cut-out is used again.' : 'The round photo is used instead of the cut-out.')}
            title="For a cut-out that looks wrong: show the dish's round photo instead"
          >
            {dish.slideshowRoundPhoto ? 'Using round photo (turn off)' : 'Use round photo'}
          </Button>
          <Button size="sm" leftIcon={<IconRefresh size={14} />} loading={busy === 'redo'} disabled={!!busy || !dish.imageUrl} onClick={() => void change('redo', { redoCutout: true }, 'The cut-out will be made again in a minute or two.')}>
            Redo cut-out
          </Button>
        </div>
        {dish.slideshowImageUrl && <p className="text-xs text-fg-muted">Your image wins over the cut-out and the round photo.</p>}
      </div>
    </div>
  );
}

/** Search box + results; `onAdd` turns it into the add-a-dish picker, otherwise each result is a full DishCard. */
function DishSearch({ diet, onAdd, addDisabled, picked, onChanged }: {
  diet?: Diet;
  onAdd?: (d: Dish) => void;
  addDisabled?: boolean;
  picked?: Set<string>;
  onChanged?: (d: Dish) => void;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Dish[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: q.trim(), limit: '30', ...(diet ? { diet } : {}) });
        const res = await adminRequest<{ dishes: Dish[] }>(`/api/admin/home-slideshow/dishes?${params}`);
        if (my === seq.current) { setRows(res.dishes); setError(null); }
      } catch (e) {
        if (my === seq.current) setError(errText(e, 'Could not search the dishes.'));
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, diet]);

  const update = (d: Dish) => {
    setRows((cur) => (cur ? cur.map((x) => (x.id === d.id ? d : x)) : cur));
    onChanged?.(d);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search a dish or store" className="sm:w-80" ariaLabel="Search dishes" />
        {loading && <Spinner size={14} />}
      </div>
      {!q.trim() && <p className="text-xs text-fg-muted">Showing dishes on discount. Type to search every dish with a photo.</p>}
      {error && <Notice tone="danger">{error}</Notice>}
      {rows && rows.length === 0 && <p className="text-sm text-fg-muted">No dishes found.</p>}
      <div className="space-y-2">
        {rows?.map((d) => (onAdd ? (
          <div key={d.id} className="flex items-center gap-3 rounded-lg border border-line p-2">
            <SlidePreview dish={d} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{d.name}</p>
              <p className="truncate text-xs text-fg-muted">{d.storeName || 'Unknown store'} · {rupees(d.price)}{offPct(d) ? ` · ${offPct(d)}% off` : ''}{!d.isAvailable ? ' · unavailable' : ''}</p>
            </div>
            <Button size="sm" leftIcon={<IconPlus size={14} />} disabled={addDisabled || picked?.has(d.id)} onClick={() => onAdd(d)}>
              {picked?.has(d.id) ? 'Added' : 'Add'}
            </Button>
          </div>
        ) : (
          <DishCard key={d.id} dish={d} onChanged={update} />
        )))}
      </div>
    </div>
  );
}

export default function HomeSlideshowEditor() {
  const toast = useToast();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('nonveg');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await adminRequest<State>('/api/admin/home-slideshow'));
      setError(null);
    } catch (e) {
      setError(errText(e, 'Could not load the slideshow.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (diet: Diet, ids: string[], done: string) => {
    setSaving(true);
    try {
      const res = await adminRequest<State>('/api/admin/home-slideshow', { method: 'PUT', body: JSON.stringify({ [diet]: ids }) });
      setState(res);
      toast.success(done);
    } catch (e) {
      toast.error(errText(e, 'Could not save the slideshow.'));
    } finally {
      setSaving(false);
    }
  };

  const replaceDish = (d: Dish) => setState((s) => (s ? { ...s, nonveg: s.nonveg.map((x) => (x.id === d.id ? d : x)), veg: s.veg.map((x) => (x.id === d.id ? d : x)) } : s));

  if (error && !state) return <Notice tone="danger" action={<Button size="sm" onClick={() => void load()}>Try again</Button>}>{error}</Notice>;
  if (!state) return <div className="flex justify-center py-10"><Spinner /></div>;

  const c = state.cutouts;
  const tabs = [
    { id: 'nonveg' as const, label: 'Non-veg', count: state.ids.nonveg.length },
    { id: 'veg' as const, label: 'Veg', count: state.ids.veg.length },
    { id: 'images' as const, label: 'Dish images' },
  ];

  return (
    <div className="space-y-4">
      {c && (
        <Notice tone={c.enabled ? 'info' : 'warning'} title={c.enabled ? 'Automatic cut-outs' : 'Automatic cut-outs are off (CUTOUTS=off)'}>
          {c.done} of {c.total} dish photos have a cut-out{c.waiting ? `, ${c.waiting} waiting` : ''}{c.failed ? `, ${c.failed} failed` : ''}.
          {' '}Model: {c.model === 'isnet' ? 'ISNet' : 'small fallback (u2netp)'}
          {c.modelFile && c.modelFile.isnet === 'downloading' ? ' (ISNet is downloading)' : ''}
          {c.modelFile?.lastError ? ` (ISNet download failed: ${c.modelFile.lastError})` : ''}.
        </Notice>
      )}
      <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Slideshow lists" />
      {tab === 'images' ? (
        <Card>
          <CardHeader title="Dish images" description="Any dish's slideshow image: upload your own (a transparent PNG floats best), use the round photo for a bad cut-out, or redo the cut-out." />
          <CardBody><DishSearch onChanged={replaceDish} /></CardBody>
        </Card>
      ) : (
        <DietList key={tab} diet={tab} state={state} saving={saving} save={save} onChanged={replaceDish} />
      )}
    </div>
  );
}

function DietList({ diet, state, saving, save, onChanged }: {
  diet: Diet;
  state: State;
  saving: boolean;
  save: (diet: Diet, ids: string[], done: string) => Promise<void>;
  onChanged: (d: Dish) => void;
}) {
  const ids = state.ids[diet];
  const dishes = state[diet];
  const label = diet === 'veg' ? 'Veg' : 'Non-veg';
  const full = ids.length >= state.max;
  const move = (i: number, dir: -1 | 1) => {
    const next = [...ids];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void save(diet, next, 'Order saved.');
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
      <Card>
        <CardHeader
          title={`${label} slideshow`}
          description={`Shown in this order when a student has ${label} selected on Home. Up to ${state.max} dishes.`}
          actions={ids.length ? <Button size="sm" variant="ghost" disabled={saving} onClick={() => void save(diet, [], 'Back to automatic.')}>Clear (automatic)</Button> : undefined}
        />
        <CardBody className="space-y-3">
          {!dishes.length ? (
            <EmptyState title="Automatic (biggest discounts)" description="No dishes picked: the app shows the dishes with the biggest discounts, one per restaurant. Add dishes to choose them yourself." />
          ) : dishes.map((d, i) => (
            <DishCard
              key={d.id}
              dish={d}
              onChanged={onChanged}
              order={{ index: i, count: dishes.length, busy: saving, move: (dir) => move(i, dir), remove: () => void save(diet, ids.filter((x) => x !== d.id), `${d.name} removed.`) }}
            />
          ))}
          {dishes.length > 0 && dishes.length < ids.length && <Notice tone="warning">Some picked dishes no longer exist; save the list again to drop them.</Notice>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Add a dish" description={full ? `The list is full (${state.max}). Remove one to add another.` : `${label} dishes with a photo.`} />
        <CardBody>
          <DishSearch diet={diet} picked={new Set(ids)} addDisabled={full || saving} onAdd={(d) => void save(diet, [...ids, d.id], `${d.name} added.`)} />
        </CardBody>
      </Card>
    </div>
  );
}
