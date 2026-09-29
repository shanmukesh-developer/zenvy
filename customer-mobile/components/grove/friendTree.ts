/**
 * friendTree.ts — turns a friends array into tree geometry.
 * Pure, dependency-free, deterministic: same (friends, seed) => same tree.
 * Shared by the RN app and the web admin so a grove looks identical everywhere.
 */

/* ============================ model ============================ */

export type Story = {
  id: string;
  postedAt: number;          // epoch ms
  seen: boolean;
  caption?: string;
  mediaUrl?: string;
  hue?: number;
};

export type Friend = {
  id: string;
  name: string;
  avatarUrl?: string;
  streak: number;            // consecutive days
  daysSinceContact: number;  // 0 = talked today
  unread?: number;
  mutuals?: string[];        // friend ids you both know — drawn as bonds
  stories?: Story[];
};

export const STORY_LIFETIME_H = 24;
export const storyAgeH  = (s: Story, now = Date.now()) => (now - s.postedAt) / 3.6e6;
export const liveStories   = (f: Friend, now = Date.now()) => (f.stories ?? []).filter(s => storyAgeH(s, now) < STORY_LIFETIME_H);
export const unseenStories = (f: Friend, now = Date.now()) => liveStories(f, now).filter(s => !s.seen);
export const fallenStories = (f: Friend, now = Date.now()) => (f.stories ?? []).filter(s => storyAgeH(s, now) >= STORY_LIFETIME_H && !s.seen);

export type Health = 'thriving' | 'steady' | 'wilting' | 'dormant';
export type EnrichedFriend = Friend & {
  strength: number; health: Health; liveStories: Story[]; unseenCount: number;
};

export function enrich(f: Friend, now = Date.now()): EnrichedFriend {
  const streakScore = Math.min(f.streak / 40, 1);
  const recency = Math.max(0, 1 - f.daysSinceContact / 14);
  const strength = Math.max(0.08, streakScore * 0.62 + recency * 0.38);
  let health: Health = 'steady';
  if (f.daysSinceContact >= 14 || f.streak === 0) health = 'dormant';
  else if (f.daysSinceContact >= 2) health = 'wilting';
  else if (strength > 0.55) health = 'thriving';
  const live = liveStories(f, now);
  return { ...f, strength, health, liveStories: live, unseenCount: live.filter(s => !s.seen).length };
}

export const HEALTH: Record<Health, { tip: string; mid: string; label: (f: EnrichedFriend) => string }> = {
  thriving: { tip: '#4ade80', mid: '#22d3ee', label: f => `Growing fast · ${f.streak} days unbroken` },
  steady:   { tip: '#38bdf8', mid: '#2a6ff0', label: f => `Holding steady · ${f.streak} day streak` },
  wilting:  { tip: '#fb923c', mid: '#b45309', label: f => `Wilting · no word in ${f.daysSinceContact} days` },
  dormant:  { tip: '#475569', mid: '#334155', label: f => `Dormant · last spoke ${f.daysSinceContact} days ago` },
};

/** stories ripen green -> gold -> amber across their 24h life */
export function ripeColor(hoursOld: number): string {
  const t = Math.min(hoursOld / 24, 1);
  const stops = [[134,239,172],[253,224,71],[251,146,60]];
  const i = t < 0.5 ? 0 : 1, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const [a, b] = [stops[i], stops[i + 1]];
  return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * u).toString(16).padStart(2, '0')).join('');
}

/* ============================ geometry ============================ */

export type Pt = { x: number; y: number };
export type Seg = { pts: Pt[]; ws: number[]; depth: number; d: Pt; layer: number; young: boolean };
export type Joint = { x: number; y: number; r: number; layer: number };
export type Leaf = { ax: number; ay: number; x: number; y: number; s: number; rot: number; v: number; layer: number; ph: number; live: boolean };
export type Strip = { pts: Pt[]; ws: number[] };
export type Blossom = { x: number; y: number; r: number; rot: number };

export type Slot = Pt & { bx?: number; by?: number };
export type Limb = {
  friend: EnrichedFriend;
  origin: Pt; tip: Pt;
  segs: Seg[]; joints: Joint[]; leaves: Leaf[];
  slots: Slot[]; blossoms: Blossom[];
  phase: number; freq: number;
  /** where the photo-print hangs — resolved after layout so cards never overlap */
  card: Pt;
  /** the twine length from tip down to the card (varies to avoid collisions) */
  drop: number;
};

/** print size in world units — shared by the layout solver and the renderer */
export const CARD_W = 56;
export const CARD_H = 56;

/** max leaves drawn per friend. Each is a live Skia <Path>, so this bounds the
 *  scene's node count: ~ friends * LEAF_CAP. 90 * 9 friends ≈ 810 leaf paths,
 *  which RN Skia handles smoothly. Lower to 60 if you profile hot on old phones. */
export const LEAF_CAP = 90;

export type Tree = {
  W: number; H: number;
  trunkPts: Pt[]; trunkWs: number[];
  knots: { x: number; y: number; r: number; rot: number }[];
  lenticels: { x: number; y: number; w: number }[];
  flares: Strip[]; roots: Strip[]; stubs: Strip[];
  limbs: Limb[];
  crown: Pt; baseX: number; baseY: number;
  level: { name: string; scale: number; rings: number };
};

const V = (x: number, y: number): Pt => ({ x, y });
const add = (a: Pt, b: Pt) => V(a.x + b.x, a.y + b.y);
const mul = (a: Pt, s: number) => V(a.x * s, a.y * s);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dirAt = (deg: number) => { const r = deg * Math.PI / 180; return V(Math.sin(r), -Math.cos(r)); };

export const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const hashSeed = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const hueOf = (n: string) => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
export const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t;
    o.push(V(u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
             u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y)); }
  return o;
}
const wobble = (t: number, amp: number, ph: number) => Math.sin(t*5.7+ph)*amp*0.62 + Math.sin(t*12.9+ph*2.1)*amp*0.38;

function groveLevel(list: EnrichedFriend[]) {
  const total = list.reduce((s, f) => s + f.streak, 0);
  if (total > 120) return { name: 'Ancient', scale: 1.14, rings: 4 };
  if (total > 70)  return { name: 'Rooted',  scale: 1.07, rings: 3 };
  if (total > 30)  return { name: 'Young',   scale: 1.0,  rings: 2 };
  return { name: 'Sapling', scale: 0.92, rings: 1 };
}

type Acc = { segs: Seg[]; joints: Joint[]; leaves: Leaf[] };

function grow(o: Pt, angle: number, len: number, w: number, depth: number, rng: () => number, acc: Acc, health: Health, layer: number): Pt {
  const MAX = health === 'dormant' ? 3 : health === 'wilting' ? 4 : 5;
  const d = dirAt(angle);
  const end = add(o, mul(d, len));
  const c1 = add(add(o, mul(d, len*0.34)), V(0, len*0.12));
  const c2 = add(add(o, mul(d, len*0.72)), V(0, -len*0.17));
  const n = depth < 2 ? 16 : 10;
  let pts = sampleCubic(o, c1, c2, end, n);
  const ph = rng()*6.28, amp = Math.min(11, w*1.1+1.6), nx = -d.y, ny = d.x;
  pts = pts.map((p, i) => { const t = i/(pts.length-1), k = wobble(t, amp, ph)*Math.pow(t, 0.85); return V(p.x+nx*k, p.y+ny*k); });

  const w1 = Math.max(0.55, w*(depth>=3?0.62:0.38)), knotAt = rng(), knotSz = depth<2?0.5+rng()*0.5:0;
  const ws = pts.map((_, i) => { const t = i/(pts.length-1);
    return lerp(w*1.2, w1, Math.pow(t, 0.85))*(1+0.4*Math.pow(1-t,5))
      + Math.sin(t*14+ph)*w*0.06 + knotSz*w*0.45*Math.exp(-Math.pow((t-knotAt)*7,2)); });

  acc.segs.push({ pts, ws, depth, d, layer, young: depth >= 3 });
  if (depth > 0 && depth < 3) acc.joints.push({ x: o.x, y: o.y, r: w*1.1, layer });

  if (depth >= MAX - 1) {                          // leaf only on the outermost twigs
    const count = 3 + Math.round(rng()*3);
    for (let i = 0; i < count; i++) {
      const t = lerp(0.15, 1, (i+rng()*0.6)/count);
      const idx = Math.round(t*(pts.length-1)), p = pts[idx];
      const side = i%2 ? 1 : -1, off = ws[idx]*0.5 + 1.2;
      const a2 = Math.atan2(d.y, d.x) + side*(0.55+rng()*0.7), stem = 2.5+rng()*4;
      acc.leaves.push({
        ax: p.x+nx*side*off, ay: p.y+ny*side*off,
        x: p.x+nx*side*off + Math.cos(a2)*stem, y: p.y+ny*side*off + Math.sin(a2)*stem,
        s: lerp(6.5, 12.5, rng()*rng()+0.15), rot: a2 + (rng()-0.5)*0.8,
        v: rng(), layer, ph: rng()*6.2832, live: false,
      });
    }
  }

  if (depth < MAX) {
    grow(pts[pts.length-1], angle+(rng()-0.5)*13, len*lerp(0.6,0.72,rng()), w*0.76, depth+1, rng, acc, health, layer);
    const laterals = depth < 2 ? 2 : (rng() < 0.8 ? 1 : 2);
    for (let k = 0; k < laterals; k++) {
      const at = lerp(0.4, 0.9, (k+rng()*0.8)/laterals);
      const base = pts[Math.round(at*(pts.length-1))];
      const sgn = (k%2===0?1:-1)*(rng()<0.85?1:-1);
      const child = angle + sgn*lerp(24,52,rng()) + (rng()-0.5)*10;
      const lay = depth===0 ? (k%3) : Math.max(0, Math.min(2, layer + (rng()<0.25 ? (rng()<0.5?-1:1) : 0)));
      grow(base, child, len*lerp(0.42,0.6,rng())*(1-at*0.15), w*lerp(0.42,0.56,rng()), depth+1, rng, acc, health, lay);
    }
  }
  return pts[pts.length-1];
}

const stripFrom = (pts: Pt[], w0: number, w1: number, ease = 1) =>
  ({ pts, ws: pts.map((_, k) => lerp(w0, w1, Math.pow(k/(pts.length-1), ease))) });

export function buildTree(friends: Friend[], seedKey: string | number, W = 800, H = 1000, now = Date.now()): Tree {
  const seed = typeof seedKey === 'number' ? seedKey : hashSeed(seedKey);
  const rng = mulberry32(seed);
  const list = friends.map(f => enrich(f, now));
  const level = groveLevel(list);
  const baseX = W/2, baseY = H-70, topY = H*(0.39 - (level.scale-1)*0.28);

  const trunkPts = sampleCubic(V(baseX, baseY+54), V(baseX-20, baseY-230), V(baseX+16, topY+180), V(baseX, topY), 52);
  const tph = rng()*6.28;
  const trunkW = (t: number) => lerp(84,26,Math.pow(t,0.78))*level.scale*(1+0.66*Math.pow(1-t,3.2)) + Math.sin(t*9+tph)*4.5 + Math.sin(t*21+tph*1.7)*2.2;
  const trunkWs = trunkPts.map((_, i) => trunkW(i/(trunkPts.length-1)));
  const ptAt = (t: number) => trunkPts[Math.round(t*(trunkPts.length-1))];

  const knots = [];
  for (let i = 0; i < 6; i++) { const t = 0.06+rng()*0.55, p = ptAt(t), w = trunkW(t);
    knots.push({ x: p.x+(rng()-0.5)*w*0.45, y: p.y, r: 5+rng()*6, rot: rng()*Math.PI }); }
  const lenticels = [];
  for (let i = 0; i < 46; i++) { const t = rng(), p = ptAt(t), w = trunkW(t);
    lenticels.push({ x: p.x+(rng()-0.5)*w*0.8, y: p.y+(rng()-0.5)*30, w: 3+rng()*9 }); }

  const flares: Strip[] = [], roots: Strip[] = [], stubs: Strip[] = [];
  for (let i = 0; i < 7; i++) { const a = lerp(-78,78,i/6)+(rng()-0.5)*12, d = dirAt(180-a);
    const o = V(baseX+(rng()-0.5)*14, baseY-56), tp = add(o, mul(d, lerp(30,62,rng())));
    flares.push(stripFrom(sampleCubic(o, add(o,mul(d,18)), V(tp.x,baseY-16), V(tp.x,baseY+16), 14), 26, 16)); }
  for (let i = 0; i < 9; i++) { const a = lerp(-94,94,i/8)+(rng()-0.5)*10, d = dirAt(180-a);
    const o = V(baseX+(rng()-0.5)*30, baseY-4), tp = add(o, mul(d, lerp(95,200,rng())));
    roots.push(stripFrom(sampleCubic(o, add(o,mul(d,52)), add(tp,V(0,-22)), tp, 14), 18, 1.6, 0.8)); }
  for (let i = 0; i < 5; i++) { const t = 0.1+rng()*0.28, p = ptAt(t), sgn = i%2?1:-1;
    const d = dirAt(sgn*(74+rng()*16)), len = 12+rng()*22, e = add(p, mul(d, len));
    stubs.push(stripFrom(sampleCubic(p, add(p,mul(d,len*0.45)), add(e,V(0,-len*0.08)), e, 8), 11+rng()*6, 2.4)); }

  const sorted = [...list].sort((a, b) => b.strength - a.strength), n = sorted.length;
  const limbs: Limb[] = sorted.map((f, i) => {
    const rank = n < 2 ? 0 : i/(n-1);
    const origin = ptAt(0.93 - rank*0.66);
    const side = i%2===0 ? -1 : 1;
    const angle = side*(lerp(23,60,rank) + (rng()-0.5)*9);
    const length = lerp(82,142,f.strength)*lerp(1.04,0.86,rank)*level.scale;
    const width = 6.5 + f.strength*12;

    const acc: Acc = { segs: [], joints: [], leaves: [] };
    const tip = grow(origin, angle, length, width, 0, rng, acc, f.health, 1);

    if (f.health === 'dormant') acc.leaves.length = 0;
    else if (f.health === 'wilting') acc.leaves = acc.leaves.filter(() => rng() < 0.22);
    else if (f.strength < 0.5) acc.leaves = acc.leaves.filter(() => rng() < 0.78);

    // Hard cap: every leaf is a live <Path> now (no bitmap baking), so keep the
    // per-limb count phone-safe. LEAF_CAP total ≈ friends * cap draw nodes.
    if (acc.leaves.length > LEAF_CAP) {
      for (let i = acc.leaves.length - 1; i > 0; i--) { const j = (rng()*(i+1))|0; [acc.leaves[i],acc.leaves[j]]=[acc.leaves[j],acc.leaves[i]]; }
      acc.leaves.length = LEAF_CAP;
    }

    const front = acc.leaves.filter(l => l.layer === 2);
    for (let k = 0; k < Math.min(24, front.length); k++) front[Math.floor(rng()*front.length)].live = true;

    const outer = acc.segs.filter(s => s.depth >= 3), slots: Pt[] = [];
    for (let k = 0; k < 4; k++) { const s = outer[Math.floor(rng()*outer.length)] || acc.segs[0];
      const p = s.pts[Math.round(lerp(0.5,0.95,rng())*(s.pts.length-1))];
      slots.push(V(p.x+(rng()-0.5)*12, p.y+11+rng()*8)); }
    const blossoms: Blossom[] = [];
    for (let b = 0; b < Math.min(Math.floor(f.streak/7), 5); b++) { const s = outer[Math.floor(rng()*outer.length)] || acc.segs[0];
      const p = s.pts[s.pts.length-1];
      blossoms.push({ x: p.x+(rng()-0.5)*16, y: p.y+(rng()-0.5)*16, r: lerp(5,7.5,rng()), rot: rng()*1.25 }); }

    const drop0 = 30;
    return { friend: f, origin, tip, segs: acc.segs, joints: acc.joints, leaves: acc.leaves, slots, blossoms,
      phase: rng()*6.2832, freq: 0.34+rng()*0.2, drop: drop0, card: V(tip.x, tip.y + drop0) };
  });

  layoutCards(limbs, V(baseX, topY - 34), W, H);

  return { W, H, trunkPts, trunkWs, knots, lenticels, flares, roots, stubs, limbs, crown: V(baseX, topY), baseX, baseY, level };
}

/**
 * Keep photo-prints from overlapping each other, the "You" crown card, or the
 * frame edges. Each card starts hanging straight below its branch tip; we then
 * relax positions apart a few passes (a tiny force-directed settle). The twine
 * `drop` is recomputed so the card visibly hangs to wherever it ends up.
 */
function layoutCards(limbs: Limb[], crownCard: Pt, W: number, H: number) {
  const gapX = CARD_W + 8, gapY = CARD_H + 8;
  const minX = CARD_W/2 + 6, maxX = W - CARD_W/2 - 6;

  // fixed obstacles the cards must also avoid: the crown "You" card
  const fixed = [{ x: crownCard.x, y: crownCard.y, w: 58, h: 70 }];

  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < limbs.length; i++) {
      const a = limbs[i].card;
      // push off every other card
      for (let j = 0; j < limbs.length; j++) {
        if (i === j) continue;
        const b = limbs[j].card;
        const dx = a.x - b.x, dy = a.y - b.y;
        const ox = gapX - Math.abs(dx), oy = gapY - Math.abs(dy);
        if (ox > 0 && oy > 0) {                          // boxes overlap
          if (ox < oy) { const s = (dx >= 0 ? 1 : -1) * ox / 2; a.x += s; b.x -= s; }
          else         { const s = (dy >= 0 ? 1 : -1) * oy / 2; a.y += s; b.y -= s; }
          moved = true;
        }
      }
      // push off the fixed crown card
      for (const o of fixed) {
        const dx = a.x - o.x, dy = a.y - o.y;
        const ox = (CARD_W + o.w)/2 + 8 - Math.abs(dx), oy = (CARD_H + o.h)/2 + 8 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) a.x += (dx >= 0 ? 1 : -1) * ox; else a.y += (dy >= 0 ? 1 : -1) * oy;
          moved = true;
        }
      }
      // clamp inside the frame
      a.x = Math.max(minX, Math.min(maxX, a.x));
    }
    if (!moved) break;
  }

  // recompute twine length; a card that ended up above its tip gets a short stub
  for (const L of limbs) L.drop = Math.max(14, L.card.y - L.tip.y);

  // Optimize fruit slots so they hang naturally from actual branches with zero collisions
  const obstacles = [
    ...limbs.map(l => ({ x: l.card.x, y: l.card.y, r: 54 })),
    { x: crownCard.x, y: crownCard.y, r: 56 },
  ];

  for (const limb of limbs) {
    const candidates = limb.segs.filter(s => s.depth >= 2);
    if (!candidates.length) candidates.push(limb.segs[0]);
    const chosenSlots: Slot[] = [];

    for (let k = 0; k < 4; k++) {
      let bestSlot: Slot | null = null;
      let maxMinDist = -1e9;

      for (let trial = 0; trial < 16; trial++) {
        const seg = candidates[(trial * 3 + k) % candidates.length];
        if (!seg || !seg.pts || !seg.pts.length) continue;
        const t = 0.3 + 0.65 * (((trial * 7 + k * 11) % 17) / 17);
        const idx = Math.min(seg.pts.length - 1, Math.max(0, Math.floor(t * (seg.pts.length - 1))));
        const bp = seg.pts[idx];
        const hang = 22 + ((trial * 5) % 12);
        const sway = ((trial % 2 === 0 ? 1 : -1) * (4 + (trial % 4)));

        const cand: Slot = {
          x: Math.max(45, Math.min(W - 45, bp.x + sway)),
          y: bp.y + hang,
          bx: bp.x,
          by: bp.y,
        };

        // Measure clearance to all obstacles (flowers + crown)
        let clearance = 1e9;
        for (const obs of obstacles) {
          const d = Math.hypot(cand.x - obs.x, cand.y - obs.y) - obs.r;
          if (d < clearance) clearance = d;
        }

        // Measure clearance to already chosen slots
        for (const cs of chosenSlots) {
          const d = Math.hypot(cand.x - cs.x, cand.y - cs.y) - 36;
          if (d < clearance) clearance = d;
        }

        if (clearance > maxMinDist) {
          maxMinDist = clearance;
          bestSlot = cand;
        }
      }

      if (bestSlot) {
        chosenSlots.push(bestSlot);
        obstacles.push({ x: bestSlot.x, y: bestSlot.y, r: 26 });
      }
    }
    limb.slots = chosenSlots;
  }
}

/* ============================ shared helpers ============================ */

export const rgbOf = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
export const hexOf = (c: number[]) => '#' + c.map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
export const mix = (a: string, b: string, t: number) => { const A = rgbOf(a), B = rgbOf(b); return hexOf(A.map((v,i) => v+(B[i]-v)*t)); };
export const hslHex = (h: number, s: number, l: number) => {
  h = ((h%360)+360)%360; s/=100; l/=100;
  const k = (n: number) => (n+h/30)%12, a = s*Math.min(l,1-l);
  const f = (n: number) => l - a*Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
  return hexOf([f(0)*255, f(8)*255, f(4)*255]);
};

/** merge many strip outlines into ONE path string (one draw node instead of N) */
export function combinedOutline(strips: { pts: Pt[]; ws: number[] }[]): string {
  let out = '';
  for (const s of strips) out += outlinePath(s.pts, s.ws);
  return out;
}

/** offset the outline of a centre-line strip, so Skia can fill it as one path */
export function outlinePath(pts: Pt[], ws: number[]): string {
  const L: Pt[] = [], R: Pt[] = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const w = Math.max(0.3, ws[i]) / 2;
    const a = pts[Math.max(0,i-1)], b = pts[Math.min(n-1,i+1)];
    let dx = b.x-a.x, dy = b.y-a.y; const len = Math.hypot(dx,dy)||1; dx/=len; dy/=len;
    L.push(V(pts[i].x-dy*w, pts[i].y+dx*w));
    R.push(V(pts[i].x+dy*w, pts[i].y-dx*w));
  }
  const all = L.concat(R.reverse());
  return 'M' + all.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L') + 'Z';
}

export const LIGHT = V(-0.55, -0.83);
export const BARK = '#342c4c', BARK_LIT = '#a6a4e0', BARK_DARK = '#090813';
