/**
 * FriendTree.tsx — the grove renderer built on @shopify/react-native-skia.
 *
 * Procedural tree: dense branches, wind gusts, leaf flutter, cast shadow,
 * and friends as photo-prints pegged to their twigs.
 * Pan / pinch / double-tap to reset. Tap a print or fruit.
 *
 * Adapted from Claude prototype with RN Skia API fixes:
 * - Image/Text components use correct RN Skia names
 * - Paint constructed via imperative API
 * - Surface.Make for offscreen baking
 * - Proper color/alpha handling
 */
import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Canvas,
  Group,
  Path,
  Rect,
  Circle,
  Oval,
  Line,
  Text as SkiaText,
  Image as SkiaImage,
  RoundedRect,
  LinearGradient,
  RadialGradient,
  Blur,
  Paint,
  Skia,
  vec,
  useClock,
  matchFont,
  TileMode,
  BlendMode,
  PaintStyle,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  buildTree,
  enrich,
  HEALTH,
  ripeColor,
  hslHex,
  mix,
  hueOf,
  initials,
  outlinePath,
  BARK,
  BARK_LIT,
  BARK_DARK,
  LIGHT,
  type Friend,
  type Tree,
  type Limb,
  type Pt,
  type EnrichedFriend,
} from './friendTree';
import { bakeLeafSet, bakeBark } from './treeTextures';

/* ------------------------------------------------------------------ *
 *  Constants
 * ------------------------------------------------------------------ */
const TREE_W = 800;
const TREE_H = 1000;

const SKIES = {
  dawn:  { a: '#3a2350', b: '#17133a', c: '#080a1c', body: '#fbbf24' },
  day:   { a: '#1d3b6b', b: '#0d1c3f', c: '#060a18', body: '#fef3c7' },
  dusk:  { a: '#4a2350', b: '#1b1340', c: '#070818', body: '#fb7185' },
  night: { a: '#1a2352', b: '#0a0e26', c: '#04050d', body: '#e2e8f0' },
};
type Tod = keyof typeof SKIES | 'auto';
const resolveTod = (tod: Tod): keyof typeof SKIES => {
  if (tod !== 'auto') return tod;
  const h = new Date().getHours();
  if (h < 6 || h >= 21) return 'night';
  if (h < 9) return 'dawn';
  if (h < 17) return 'day';
  return 'dusk';
};

/* ------------------------------------------------------------------ *
 *  Props
 * ------------------------------------------------------------------ */
type Props = {
  friends: Friend[];
  seedKey: string;
  tod?: Tod;
  filter?: 'all' | 'stories' | 'water';
  onSelectFriend?: (id: string) => void;
  onOpenStory?: (fid: string, sid: string) => void;
  onPost?: () => void;
};

/* ------------------------------------------------------------------ *
 *  Baked limb layer type
 * ------------------------------------------------------------------ */
type BakedLayer = { img: SkImage; x: number; y: number; w: number; h: number } | null;

/* ------------------------------------------------------------------ *
 *  Main component
 * ------------------------------------------------------------------ */
export default function FriendTree({
  friends,
  seedKey,
  tod = 'auto',
  filter = 'all',
  onSelectFriend,
  onOpenStory,
  onPost,
}: Props) {
  const { width } = useWindowDimensions();
  const scale = width / TREE_W;
  const clock = useClock();
  const sky = SKIES[resolveTod(tod)];

  // Build tree geometry (pure, deterministic)
  const tree = useMemo<Tree>(
    () => buildTree(friends, seedKey, TREE_W, TREE_H),
    [friends, seedKey],
  );

  // Fonts
  const font = useMemo(
    () => matchFont({ fontFamily: 'System', fontSize: 15, fontWeight: '600' as any }),
    [],
  );
  const fontSm = useMemo(
    () => matchFont({ fontFamily: 'System', fontSize: 10.5, fontWeight: '600' as any }),
    [],
  );
  const fontXs = useMemo(
    () => matchFont({ fontFamily: 'System', fontSize: 8.5, fontWeight: '600' as any }),
    [],
  );

  // Bark texture, baked once per user
  const bark = useMemo(() => bakeBark(hueOf(seedKey)), [seedKey]);

  // Leaf sets and baked limb bitmaps — rebuilt when tree/sky changes
  const { baked, leafSets } = useMemo(() => bakeTreeLayers(tree, sky), [tree, sky]);

  // Wind gust — shared value updated on the UI thread
  const gust = useDerivedValue(() => {
    const t = clock.value / 1000;
    return (
      (0.5 + 0.5 * Math.sin(t * 0.21)) *
        (0.55 + 0.45 * Math.sin(t * 0.07 * 1.7)) +
      0.12 * Math.sin(t * 1.9 * 3.1)
    );
  });

  // Camera — pan / pinch / double-tap reset
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const camZ = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startZ = useSharedValue(1);

  const transform = useDerivedValue(() => [
    { translateX: TREE_W / 2 },
    { translateY: TREE_H * 0.55 },
    { scale: camZ.value },
    { translateX: -TREE_W / 2 + camX.value / camZ.value },
    { translateY: -TREE_H * 0.55 + camY.value / camZ.value },
  ]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = camX.value;
      startY.value = camY.value;
    })
    .onUpdate(e => {
      const lim = 260 * camZ.value;
      camX.value = Math.max(-lim, Math.min(lim, startX.value + e.translationX / scale));
      camY.value = Math.max(-lim, Math.min(lim, startY.value + e.translationY / scale));
    })
    .onEnd(e => {
      camX.value = withDecay({
        velocity: e.velocityX / scale,
        clamp: [-260 * camZ.value, 260 * camZ.value],
      });
      camY.value = withDecay({
        velocity: e.velocityY / scale,
        clamp: [-260 * camZ.value, 260 * camZ.value],
      });
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startZ.value = camZ.value;
    })
    .onUpdate(e => {
      camZ.value = Math.max(1, Math.min(3, startZ.value * e.scale));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      camX.value = 0;
      camY.value = 0;
      camZ.value = 1;
    });

  // Tap hit-testing
  const hits = useMemo(() => buildHitTargets(tree), [tree]);

  const tap = Gesture.Tap()
    .maxDistance(12)
    .onEnd(e => {
      'worklet';
      // Convert tap to world coordinates (undo camera)
      const wx =
        (e.x / scale - TREE_W / 2) / camZ.value + TREE_W / 2 - camX.value / camZ.value;
      const wy =
        (e.y / scale - TREE_H * 0.55) / camZ.value +
        TREE_H * 0.55 -
        camY.value / camZ.value;

      let best: any = null;
      let bd = 1e9;
      for (const h of hits) {
        const d = Math.hypot(h.x - wx, h.y - wy);
        if (d < h.r && d < bd) {
          bd = d;
          best = h;
        }
      }
      if (!best) return;
      if (best.type === 'fruit') onOpenStory?.(best.fid, best.sid);
      else if (best.type === 'node') onSelectFriend?.(best.fid);
      else if (best.type === 'post') onPost?.();
    });

  const gesture = Gesture.Race(tap, doubleTap, Gesture.Simultaneous(pan, pinch));

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ width, height: width * TREE_H / TREE_W }}>
        {/* Sky gradient */}
        <Rect x={0} y={0} width={TREE_W} height={TREE_H}>
          <RadialGradient
            c={vec(TREE_W / 2, TREE_H * 0.84)}
            r={TREE_H * 0.9}
            colors={[sky.a, sky.b, sky.c]}
            positions={[0, 0.52, 1]}
          />
        </Rect>

        {/* Sun / Moon */}
        <SkyBody sky={sky} />

        <Group transform={transform}>
          {/* Ground */}
          <GroundPlane tree={tree} />

          {/* Trunk */}
          <TrunkRenderer tree={tree} bark={bark} />

          {/* Limbs: baked layers + live leaves + fruit */}
          {tree.limbs.map((L, i) => (
            <LimbRenderer
              key={L.friend.id}
              limb={L}
              index={i}
              baked={baked[i]}
              leaves={leafSets[L.friend.health]}
              gust={gust}
              clock={clock}
              filter={filter}
            />
          ))}

          {/* Photo prints for each friend */}
          {tree.limbs.map((L, i) => (
            <PhotoPrintRenderer
              key={'p' + L.friend.id}
              limb={L}
              index={i}
              gust={gust}
              clock={clock}
              filter={filter}
              font={font}
              fontSm={fontSm}
              fontXs={fontXs}
            />
          ))}

          {/* Crown "You" print */}
          <CrownPrint tree={tree} gust={gust} clock={clock} font={font} fontSm={fontSm} />
        </Group>

        {/* Vignette */}
        <Rect x={0} y={0} width={TREE_W} height={TREE_H}>
          <RadialGradient
            c={vec(TREE_W / 2, TREE_H * 0.46)}
            r={TREE_H * 0.78}
            colors={['#00000000', '#00000073']}
            positions={[0.38, 1]}
          />
        </Rect>
      </Canvas>
    </GestureDetector>
  );
}

/* ------------------------------------------------------------------ *
 *  Baking: each limb -> 3 bitmaps (back / mid / front)
 * ------------------------------------------------------------------ */
function bakeTreeLayers(tree: Tree, sky: typeof SKIES['night']) {
  const leafSets: Record<string, SkImage[]> = {};
  for (const k of ['thriving', 'steady', 'wilting', 'dormant'] as const) {
    leafSets[k] = bakeLeafSet(mix(HEALTH[k].tip, '#14452f', 0.32));
  }

  const baked: BakedLayer[][] = tree.limbs.map(L => {
    const h = HEALTH[L.friend.health];
    const sprites = leafSets[L.friend.health];
    return [0, 1, 2].map(layer => bakeLimbLayer(L, layer, h, sky, sprites));
  });

  return { baked, leafSets };
}

function bakeLimbLayer(
  L: Limb,
  layer: number,
  h: { tip: string; mid: string },
  sky: any,
  sprites: SkImage[],
): BakedLayer {
  const segs = L.segs.filter(s => s.layer === layer);
  const leaves = L.leaves.filter(l => l.layer === layer && !l.live);
  if (!segs.length && !leaves.length) return null;

  // Compute bounding box
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of segs) {
    for (let i = 0; i < s.pts.length; i++) {
      const w = s.ws[i] + 3;
      x0 = Math.min(x0, s.pts[i].x - w);
      x1 = Math.max(x1, s.pts[i].x + w);
      y0 = Math.min(y0, s.pts[i].y - w);
      y1 = Math.max(y1, s.pts[i].y + w);
    }
  }
  for (const l of leaves) {
    x0 = Math.min(x0, l.x - l.s);
    x1 = Math.max(x1, l.x + l.s);
    y0 = Math.min(y0, l.y - l.s);
    y1 = Math.max(y1, l.y + l.s);
  }
  const pad = 8;
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);

  const sur = Skia.Surface.Make(Math.ceil(bw), Math.ceil(bh))!;
  if (!sur) return null;
  const c = sur.getCanvas();
  c.translate(-x0, -y0);

  // Draw branch segments
  for (const s of segs) {
    const svgPath = outlinePath(s.pts, s.ws);
    const p = Skia.Path.MakeFromSVGString(svgPath);
    if (!p) continue;

    const d = Math.min(1, s.depth / 4);
    let base = s.young
      ? mix(BARK, mix('#7a6b45', h.tip, 0.18), 0.62)
      : mix(BARK, mix(h.mid, h.tip, 0.3), d * 0.3);
    let rim =
      L.friend.health === 'dormant'
        ? mix(BARK_DARK, h.mid, 0.28)
        : mix(h.tip, BARK_DARK, 0.2);
    if (layer === 0) {
      base = mix(base, sky.b, 0.45);
      rim = mix(rim, sky.b, 0.42);
    }

    const m = s.pts[s.pts.length >> 1];
    let nx = -s.d.y, ny = s.d.x;
    if (nx * LIGHT.x + ny * LIGHT.y < 0) { nx = -nx; ny = -ny; }
    const wdt = Math.max(2.2, (s.ws[0] + s.ws[s.ws.length - 1]) * 0.55);

    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: m.x + nx * wdt, y: m.y + ny * wdt },
        { x: m.x - nx * wdt, y: m.y - ny * wdt },
        [
          mix(base, BARK_LIT, 0.58),
          mix(base, BARK_LIT, 0.2),
          base,
          mix(base, BARK_DARK, 0.68),
          rim,
        ].map(Skia.Color),
        [0, 0.22, 0.58, 0.88, 1],
        TileMode.Clamp,
      ),
    );
    c.drawPath(p, paint);
  }

  // Draw static leaves
  const petiole = Skia.Paint();
  petiole.setStyle(PaintStyle.Stroke);
  petiole.setStrokeWidth(0.8);
  petiole.setColor(Skia.Color('#283c28'));
  petiole.setAlphaf(0.55);
  petiole.setAntiAlias(true);

  for (const l of leaves) {
    // Petiole (stem)
    const st = Skia.Path.Make();
    st.moveTo(l.ax, l.ay);
    st.lineTo(l.x, l.y);
    c.drawPath(st, petiole);

    // Leaf sprite
    const lit = (l.x - L.origin.x) * LIGHT.x + (l.y - L.origin.y) * LIGHT.y;
    const idx = Math.min(
      14,
      Math.max(0, Math.round(l.v * 2 + (lit > 0 ? 2 : 0.6))) * 3 + ((l.v * 100) | 0) % 3,
    );
    const sp = sprites[idx];
    if (!sp) continue;

    c.save();
    c.translate(l.x, l.y);
    c.rotate((l.rot * 180) / Math.PI);
    c.drawImageRect(
      sp,
      Skia.XYWHRect(0, 0, sp.width(), sp.height()),
      Skia.XYWHRect(-l.s * 0.3, -l.s * 0.5, l.s * 0.6, l.s),
      Skia.Paint(),
    );
    c.restore();
  }

  return { img: sur.makeImageSnapshot(), x: x0, y: y0, w: bw, h: bh };
}

/* ------------------------------------------------------------------ *
 *  Sub-components
 * ------------------------------------------------------------------ */

function SkyBody({ sky }: { sky: any }) {
  const arc = Math.max(0, Math.min(1, ((new Date().getHours() + 18) % 24) / 24));
  const cx = 90 + arc * 620;
  const cy = 180 - Math.sin(arc * Math.PI) * 110;
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={120}>
        <RadialGradient c={vec(cx, cy)} r={120} colors={[sky.body + '66', sky.body + '00']} />
      </Circle>
      <Circle cx={cx} cy={cy} r={19} color={sky.body} />
    </Group>
  );
}

function GroundPlane({ tree }: { tree: Tree }) {
  const soil = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(0, TREE_H);
    p.quadTo(210, tree.baseY - 8, 400, tree.baseY - 4);
    p.quadTo(590, tree.baseY - 8, TREE_W, TREE_H);
    p.close();
    return p;
  }, [tree]);

  return (
    <Group>
      <Oval
        x={tree.baseX - 330}
        y={tree.baseY - 50}
        width={660}
        height={120}
        color="#00000080"
        opacity={0.5}
      >
        <Blur blur={9} />
      </Oval>
      <Path path={soil}>
        <LinearGradient
          start={vec(0, tree.baseY - 20)}
          end={vec(0, TREE_H)}
          colors={['#2b3152', '#080c1a']}
        />
      </Path>
    </Group>
  );
}

function TrunkRenderer({ tree, bark }: { tree: Tree; bark: SkImage }) {
  const trunk = useMemo(
    () => Skia.Path.MakeFromSVGString(outlinePath(tree.trunkPts, tree.trunkWs))!,
    [tree],
  );
  const rootPaths = useMemo(
    () => tree.roots.map(r => outlinePath(r.pts, r.ws)),
    [tree],
  );
  const flarePaths = useMemo(
    () => tree.flares.map(r => outlinePath(r.pts, r.ws)),
    [tree],
  );
  const stubPaths = useMemo(
    () => tree.stubs.map(r => outlinePath(r.pts, r.ws)),
    [tree],
  );

  return (
    <Group>
      {rootPaths.map((d, i) => (
        <Path key={'r' + i} path={d} color="#141830" opacity={0.75} />
      ))}
      {flarePaths.map((d, i) => (
        <Path key={'f' + i} path={d} color={mix(BARK, BARK_DARK, 0.22)} />
      ))}
      <Path path={trunk}>
        <LinearGradient
          start={vec(tree.baseX - 58, 0)}
          end={vec(tree.baseX + 58, 0)}
          colors={[
            mix(BARK, BARK_LIT, 0.5),
            mix(BARK, BARK_LIT, 0.16),
            BARK,
            mix(BARK, BARK_DARK, 0.7),
            '#2b4f7a',
          ]}
          positions={[0, 0.18, 0.56, 0.88, 1]}
        />
      </Path>
      {/* Bark overlay */}
      <Group clip={trunk}>
        <Group blendMode="overlay" opacity={0.62}>
          <SkiaImage
            image={bark}
            x={tree.baseX - 110}
            y={tree.crown.y - 40}
            width={220}
            height={TREE_H - tree.crown.y + 90}
          />
        </Group>
      </Group>
      {/* Knots */}
      {tree.knots.map((k, i) => (
        <Group key={'k' + i} origin={vec(k.x, k.y)} transform={[{ rotate: k.rot }]}>
          <Oval x={k.x - k.r} y={k.y - k.r * 0.66} width={k.r * 2} height={k.r * 1.32} color={mix(BARK, BARK_LIT, 0.16)} />
          <Oval x={k.x - k.r * 0.66} y={k.y - k.r * 0.44} width={k.r * 1.32} height={k.r * 0.88} color={mix(BARK, BARK_DARK, 0.3)} />
          <Oval x={k.x - k.r * 0.3} y={k.y - k.r * 0.2} width={k.r * 0.6} height={k.r * 0.4} color={mix(BARK, BARK_DARK, 0.5)} />
        </Group>
      ))}
      {stubPaths.map((d, i) => (
        <Path key={'s' + i} path={d} color={mix(BARK, BARK_DARK, 0.25)} />
      ))}
    </Group>
  );
}

function LimbRenderer({
  limb,
  index,
  baked,
  leaves,
  gust,
  clock,
  filter,
}: {
  limb: Limb;
  index: number;
  baked: BakedLayer[];
  leaves: SkImage[];
  gust: any;
  clock: any;
  filter: string;
}) {
  const f = limb.friend;
  const dim = f.health === 'dormant' ? 0.62 : 1;
  const hidden =
    (filter === 'stories' && !f.unseenCount) ||
    (filter === 'water' && f.health !== 'wilting' && f.health !== 'dormant');
  const baseAlpha = (hidden ? 0.2 : 1) * dim;

  const sway = useDerivedValue(() => {
    const t = clock.value / 1000;
    return (
      (Math.sin(t * limb.freq + limb.phase) * 0.012 +
        Math.sin(t * limb.freq * 2.3 + limb.phase) * 0.004) *
      (0.45 + gust.value * 1.35)
    );
  });

  // Fruit data for this limb
  const fruitData = useMemo(() => {
    const now = Date.now();
    return limb.friend.liveStories.slice(0, 4).map((s, k) => {
      const hrs = (now - s.postedAt) / 3.6e6;
      const p = limb.slots[k];
      const r = s.seen ? 7.5 : 11;
      const droop = (hrs / 24) * 3;
      const col = ripeColor(hrs);
      return { p, s, hrs, r, droop, col };
    });
  }, [limb]);

  return (
    <>
      {[0, 1, 2].map(layer => {
        const b = baked[layer];
        if (!b) return null;
        const parallax = layer === 0 ? 0.82 : layer === 2 ? 1.12 : 1;
        return (
          <SwayGroup
            key={layer}
            originX={limb.origin.x}
            originY={limb.origin.y}
            sway={sway}
            parallax={parallax}
            opacity={baseAlpha * (layer === 0 ? 0.86 : 1)}
          >
            <SkiaImage image={b.img} x={b.x} y={b.y} width={b.w} height={b.h} />
            {layer === 2 &&
              limb.leaves
                .filter(l => l.live)
                .map((l, i) => (
                  <LiveLeaf key={i} leaf={l} sprites={leaves} gust={gust} clock={clock} />
                ))}
          </SwayGroup>
        );
      })}
      {/* Fruit */}
      <FruitGroup limb={limb} sway={sway} fruitData={fruitData} />
    </>
  );
}

/** Wrapper that applies wind sway rotation around the limb origin */
function SwayGroup({
  originX,
  originY,
  sway,
  parallax,
  opacity,
  children,
}: {
  originX: number;
  originY: number;
  sway: any;
  parallax: number;
  opacity: number;
  children: React.ReactNode;
}) {
  const t = useDerivedValue(() => [{ rotate: sway.value * parallax }]);
  return (
    <Group origin={vec(originX, originY)} transform={t} opacity={opacity}>
      {children}
    </Group>
  );
}

function LiveLeaf({
  leaf,
  sprites,
  gust,
  clock,
}: {
  leaf: any;
  sprites: SkImage[];
  gust: any;
  clock: any;
}) {
  const idx = Math.min(
    14,
    Math.round(leaf.v * 2 + 2) * 3 + (((leaf.v * 100) | 0) % 3),
  );
  const sp = sprites[idx];
  if (!sp) return null;

  const leafTransform = useDerivedValue(() => {
    const t = clock.value / 1000;
    const g = gust.value;
    const fl = Math.sin(t * 2.1 + leaf.ph) * 0.2 * (0.5 + g);
    const turn = Math.cos(t * (2.4 + leaf.ph * 0.2) + leaf.ph) * g * 0.9;
    const sx = Math.max(0.18, Math.abs(1 - Math.abs(turn) * 0.85));
    return [
      { translateX: leaf.x + Math.sin(t * 1.7 + leaf.ph) * (1 + g) },
      { translateY: leaf.y },
      { rotate: leaf.rot + fl },
      { scaleX: sx },
      { scaleY: 1 },
    ];
  });

  return (
    <Group transform={leafTransform}>
      <SkiaImage
        image={sp}
        x={-leaf.s * 0.3}
        y={-leaf.s * 0.5}
        width={leaf.s * 0.6}
        height={leaf.s}
      />
    </Group>
  );
}

function FruitGroup({
  limb,
  sway,
  fruitData,
}: {
  limb: Limb;
  sway: any;
  fruitData: any[];
}) {
  const fruitTransform = useDerivedValue(() => [{ rotate: sway.value }]);

  return (
    <Group origin={vec(limb.origin.x, limb.origin.y)} transform={fruitTransform}>
      {fruitData.map(({ p, s, r, droop, col }, k) => (
        <Group key={k}>
          {/* Shadow */}
          <Oval
            x={p.x + 1.5 - r * 0.85}
            y={p.y + droop + r * 0.6}
            width={r * 1.7}
            height={r * 0.6}
            color="#00000066"
          />
          {/* Fruit body */}
          <Circle cx={p.x} cy={p.y + droop} r={r}>
            <RadialGradient
              c={vec(p.x - r * 0.35, p.y + droop - r * 0.4)}
              r={r * 1.15}
              colors={[mix(col, '#ffffff', 0.55), col, mix(col, '#1a0d05', 0.65)]}
              positions={[0, 0.45, 1]}
            />
          </Circle>
          {/* Seen/unseen ring */}
          <Circle
            cx={p.x}
            cy={p.y + droop}
            r={r}
            style="stroke"
            color={s.seen ? '#475569e6' : '#ffffff'}
            strokeWidth={s.seen ? 1.2 : 1.6}
          />
        </Group>
      ))}
    </Group>
  );
}

/** Photo print pegged to a twig */
function PhotoPrintRenderer({
  limb,
  index,
  gust,
  clock,
  filter,
  font,
  fontSm,
  fontXs,
}: any) {
  const f = limb.friend as EnrichedFriend;
  const h = HEALTH[f.health];
  const hidden =
    (filter === 'stories' && !f.unseenCount) ||
    (filter === 'water' && f.health !== 'wilting' && f.health !== 'dormant');
  const worn = f.health === 'wilting';
  const gone = f.health === 'dormant';
  const hue = hueOf(f.name);
  const pw = 52, ph = 60, border = 4, iw = pw - border * 2, ih = ph - border - 16;

  const pos = useDerivedValue(() => {
    const t = clock.value / 1000;
    const g = gust.value;
    const swing =
      Math.sin(t * (1.2 + index * 0.06) + limb.phase) * (0.05 + g * 0.1) +
      Math.sin(t * limb.freq + limb.phase) * 0.03;
    const drop = 30;
    return {
      cx: limb.tip.x + Math.sin(swing) * drop,
      cy: limb.tip.y + Math.cos(swing) * drop,
      swing,
    };
  });

  const groupT = useDerivedValue(() => {
    const tilt = (index % 2 ? 1 : -1) * 0.045;
    return [
      { translateX: pos.value.cx },
      { translateY: pos.value.cy },
      { rotate: pos.value.swing * 0.85 + tilt },
    ];
  });

  const paperTop = gone ? '#6f6d78' : worn ? '#ded2b4' : '#f6f1e4';
  const paperBot = gone ? '#3c3b47' : worn ? '#a2937a' : '#c9c0ad';
  const imgTop = gone ? hslHex(hue, 8, 30) : worn ? hslHex(hue, 30, 44) : hslHex(hue, 62, 56);
  const imgBot = gone ? hslHex(hue, 5, 14) : worn ? hslHex(hue, 22, 22) : hslHex(hue, 52, 26);
  const glow = worn ? '#fb923c' : h.tip;

  // Pre-measure text
  const ini = initials(f.name);
  const firstName = f.name.split(' ')[0];
  const streakStr = '▲ ' + f.streak;

  return (
    <Group opacity={hidden ? 0.1 : 1}>
      {/* Twine */}
      <TwineLine tipX={limb.tip.x} tipY={limb.tip.y} pos={pos} />

      <Group transform={groupT}>
        {/* Glow */}
        {!gone && (
          <Circle cx={0} cy={0} r={64}>
            <RadialGradient
              c={vec(0, 0)}
              r={64}
              colors={[glow + (worn ? '33' : '55'), glow + '00']}
            />
          </Circle>
        )}

        {/* Shadow */}
        <RoundedRect x={-pw / 2 + 3} y={-ph / 2 + 5} width={pw} height={ph} r={2} color="#00000080" />

        {/* Paper */}
        <RoundedRect x={-pw / 2} y={-ph / 2} width={pw} height={ph} r={2}>
          <LinearGradient
            start={vec(-pw / 2, -ph / 2)}
            end={vec(pw / 2, ph / 2)}
            colors={[paperTop, paperBot]}
          />
        </RoundedRect>

        {/* Image area (avatar placeholder — hue fill) */}
        <Rect x={-iw / 2} y={-ph / 2 + border} width={iw} height={ih}>
          <LinearGradient
            start={vec(-iw / 2, -ph / 2 + border)}
            end={vec(-iw / 2, -ph / 2 + border + ih)}
            colors={[imgTop, imgBot]}
          />
        </Rect>

        {/* Initials */}
        <SkiaText
          x={-font.measureText(ini).width / 2}
          y={-ph / 2 + border + ih * 0.62}
          text={ini}
          font={font}
          color={gone ? '#9aa0b4' : '#ffffff'}
          opacity={gone ? 0.5 : 0.92}
        />

        {/* Name */}
        <SkiaText
          x={-fontSm.measureText(firstName).width / 2}
          y={ph / 2 - 4.5}
          text={firstName}
          font={fontSm}
          color={gone ? '#2f2e38' : '#4a4330'}
        />

        {/* Streak badge */}
        {f.streak > 0 && (
          <Group>
            <RoundedRect
              x={iw / 2 - 25}
              y={-ph / 2 + border + ih - 12}
              width={25}
              height={11}
              r={2}
              color="#00000073"
            />
            <SkiaText
              x={iw / 2 - 24}
              y={-ph / 2 + border + ih - 4}
              text={streakStr}
              font={fontXs}
              color={gone ? '#7d8399' : worn ? '#f0b070' : '#ffd9a0'}
            />
          </Group>
        )}

        {/* Clothes peg */}
        <Group transform={[{ translateX: 0 }, { translateY: -ph / 2 - 1 }]}>
          <RoundedRect x={-9} y={-10} width={7} height={15} r={1.6} color="#8a6a44" />
          <RoundedRect x={2} y={-10} width={7} height={15} r={1.6} color="#a17f52" />
          <Line p1={vec(-6, -4)} p2={vec(6, -4)} color="#c9cbd6" strokeWidth={1.4} />
        </Group>
      </Group>
    </Group>
  );
}

/** Animated twine line from branch tip to print */
function TwineLine({ tipX, tipY, pos }: { tipX: number; tipY: number; pos: any }) {
  const p2 = useDerivedValue(() => vec(pos.value.cx, pos.value.cy - 30 - 10));
  return (
    <Line
      p1={vec(tipX, tipY)}
      p2={p2}
      color="rgba(120,112,140,0.85)"
      strokeWidth={1.4}
    />
  );
}

/** "You" print at the crown */
function CrownPrint({ tree, gust, clock, font, fontSm }: any) {
  const cx = tree.crown.x;
  const cy = tree.crown.y;
  const W2 = 58, H2 = 70, b2 = 5;

  const pos = useDerivedValue(() => {
    const t = clock.value / 1000;
    const g = gust.value;
    const ys = Math.sin(t * 1.02) * (0.035 + g * 0.06);
    return {
      cx: cx + Math.sin(ys) * 30,
      cy: cy - 16 + Math.cos(ys) * 30,
      ys,
    };
  });

  const groupT = useDerivedValue(() => [
    { translateX: pos.value.cx },
    { translateY: pos.value.cy },
    { rotate: pos.value.ys * 0.85 + 0.03 },
  ]);

  return (
    <Group>
      {/* Twine */}
      <TwineLine tipX={cx} tipY={cy - 58} pos={pos} />

      <Group transform={groupT}>
        {/* Glow */}
        <Circle cx={0} cy={0} r={86}>
          <RadialGradient c={vec(0, 0)} r={86} colors={['#e879f955', '#e879f900']} />
        </Circle>

        {/* Shadow + paper */}
        <RoundedRect x={-W2 / 2 + 3} y={-H2 / 2 + 5} width={W2} height={H2} r={2} color="#00000080" />
        <RoundedRect x={-W2 / 2} y={-H2 / 2} width={W2} height={H2} r={2}>
          <LinearGradient
            start={vec(-W2 / 2, -H2 / 2)}
            end={vec(W2 / 2, H2 / 2)}
            colors={['#f8f2e6', '#cdc3b0']}
          />
        </RoundedRect>

        {/* Image area */}
        <Rect x={-W2 / 2 + b2} y={-H2 / 2 + b2} width={W2 - b2 * 2} height={H2 - b2 - 18}>
          <LinearGradient
            start={vec(0, -H2 / 2 + b2)}
            end={vec(0, -H2 / 2 + b2 + H2 - b2 - 18)}
            colors={['#5b2a6b', '#2a1240']}
          />
        </Rect>

        <SkiaText
          x={-font.measureText('You').width / 2}
          y={-H2 / 2 + b2 + (H2 - b2 - 18) * 0.62}
          text="You"
          font={font}
          color="#f8dcff"
        />
        <SkiaText
          x={-fontSm.measureText('+ post').width / 2}
          y={H2 / 2 - 5}
          text="+ post"
          font={fontSm}
          color="#4a4330"
        />

        {/* Peg */}
        <Group transform={[{ translateY: -H2 / 2 - 1 }]}>
          <RoundedRect x={-10} y={-11} width={8} height={16} r={1.8} color="#e879f9" />
          <RoundedRect x={2} y={-11} width={8} height={16} r={1.8} color="#f0abfc" />
          <Line p1={vec(-7, -4)} p2={vec(7, -4)} color="#c9cbd6" strokeWidth={1.5} />
        </Group>
      </Group>
    </Group>
  );
}

/* ------------------------------------------------------------------ *
 *  Hit targets
 * ------------------------------------------------------------------ */
function buildHitTargets(tree: Tree) {
  const hits: { x: number; y: number; r: number; type: string; fid?: string; sid?: string }[] = [];
  const now = Date.now();

  for (const L of tree.limbs) {
    // Fruit hit zones
    const stories = L.friend.liveStories.slice(0, 4);
    stories.forEach((s, k) => {
      const hrs = (now - s.postedAt) / 3.6e6;
      const p = L.slots[k];
      const r = s.seen ? 7.5 : 11;
      const droop = (hrs / 24) * 3;
      hits.push({ x: p.x, y: p.y + droop, r: r + 8, type: 'fruit', fid: L.friend.id, sid: s.id });
    });

    // Print hit zone (~30px below branch tip)
    hits.push({ x: L.tip.x, y: L.tip.y + 30, r: 34, type: 'node', fid: L.friend.id });
  }

  // Crown "post" button
  hits.push({ x: tree.crown.x, y: tree.crown.y + 10, r: 34, type: 'post' });

  return hits;
}
