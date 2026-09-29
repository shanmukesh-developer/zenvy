/**
 * GroveTreeCanvas.tsx (FriendTree.tsx) — the grove screen, rendered with Skia.
 *
 * v2 of the RN renderer: NO offscreen baking (Skia.Surface.MakeOffscreen was
 * silently failing on device and collapsing the canopy to flat blobs). Every
 * branch and leaf is now a declarative <Path>, so it either renders or throws
 * loudly. Leaves are real leaf-shaped paths with per-leaf gradient + shading,
 * grouped by depth for atmospheric perspective, plus moon glow and wind.
 *
 * deps: @shopify/react-native-skia react-native-gesture-handler react-native-reanimated
 *
 *   <FriendTree friends={friends} seedKey={user.id}
 *               onSelectFriend={id=>...} onOpenStory={(fid,sid)=>...} onPost={()=>...} />
 */
import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Canvas, Group, Path, Rect, Circle, Oval, Line, RoundedRect, Text as SkText,
  Skia, useClock, matchFont, LinearGradient, RadialGradient, vec, Blur, Paint,
  Image as SkImage, useImage,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withDecay, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  buildTree, HEALTH, ripeColor, hslHex, mix, hueOf, initials, outlinePath, combinedOutline,
  CARD_W, CARD_H, BARK, BARK_LIT, BARK_DARK, LIGHT,
  type Friend, type Tree, type Limb, type Leaf, type Seg,
} from './friendTree';

const W = 800, H = 1000;

export const SKIES = {
  dawn:  { a: '#3a2350', b: '#17133a', c: '#080a1c', body: '#fbbf24' },
  day:   { a: '#1d3b6b', b: '#0d1c3f', c: '#060a18', body: '#fef3c7' },
  dusk:  { a: '#4a2350', b: '#1b1340', c: '#070818', body: '#fb7185' },
  night: { a: '#1a2352', b: '#0a0e26', c: '#04050d', body: '#e2e8f0' },
};
export type Tod = keyof typeof SKIES | 'auto';
export const resolveTod = (tod: Tod): keyof typeof SKIES => {
  if (tod !== 'auto') return tod;
  const h = new Date().getHours();
  if (h < 6 || h >= 21) return 'night';
  if (h < 9) return 'dawn';
  if (h < 17) return 'day';
  return 'dusk';
};

/* a single leaf outline, unit-sized, reused for every leaf via transform */
const LEAF_PATH = (() => {
  const p = Skia.Path.Make();
  p.moveTo(0, -0.5);
  p.cubicTo(0.48, -0.2, 0.4, 0.26, 0, 0.5);
  p.cubicTo(-0.4, 0.26, -0.48, -0.2, 0, -0.5);
  p.close();
  return p;
})();

export type Props = {
  friends: Friend[];
  seedKey: string;
  tod?: Tod;
  filter?: 'all' | 'stories' | 'water';
  showBonds?: boolean;
  onSelectFriend?: (id: string) => void;
  onOpenStory?: (fid: string, sid: string) => void;
  onPost?: () => void;
};

export default function FriendTree({
  friends, seedKey, tod = 'auto', filter = 'all', onSelectFriend, onOpenStory, onPost,
}: Props) {
  const { width } = useWindowDimensions();
  const scale = width / W;
  const clock = useClock();
  const sky = SKIES[resolveTod(tod)];

  const tree = useMemo<Tree>(() => buildTree(friends, seedKey, W, H), [friends, seedKey]);
  const font   = useMemo(() => safeFont(15), []);
  const fontSm = useMemo(() => safeFont(10.5), []);
  const fontXs = useMemo(() => safeFont(8.5), []);

  const gust = useDerivedValue(() => {
    const t = clock.value / 1000;
    return (0.5+0.5*Math.sin(t*0.21))*(0.55+0.45*Math.sin(t*0.119))+0.12*Math.sin(t*5.89);
  });

  /* camera */
  const camX = useSharedValue(0), camY = useSharedValue(0), camZ = useSharedValue(1);
  const startX = useSharedValue(0), startY = useSharedValue(0);
  const startZ = useSharedValue(1);
  const transform = useDerivedValue(() => [
    { translateX: W/2 }, { translateY: H*0.55 }, { scale: camZ.value },
    { translateX: -W/2 + camX.value/camZ.value }, { translateY: -H*0.55 + camY.value/camZ.value },
  ]);

  const hits = useMemo(() => buildHits(tree), [tree]);
  const hitTest = (wx: number, wy: number) => {
    let best: any = null, bd = 1e9;
    for (const h of hits) { const d = Math.hypot(h.x - wx, h.y - wy); if (d < h.r && d < bd) { bd = d; best = h; } }
    if (!best) return;
    if (best.type === 'fruit') onOpenStory?.(best.fid, best.sid);
    else if (best.type === 'node') onSelectFriend?.(best.fid);
    else if (best.type === 'post') onPost?.();
  };

  const pan = Gesture.Pan()
    .onBegin(() => { startX.value = camX.value; startY.value = camY.value; })
    .onUpdate(e => {
      const lim = 260*camZ.value;
      camX.value = Math.max(-lim, Math.min(lim, startX.value + e.translationX/scale));
      camY.value = Math.max(-lim, Math.min(lim, startY.value + e.translationY/scale));
    })
    .onEnd(e => {
      camX.value = withDecay({ velocity: e.velocityX/scale, clamp: [-260*camZ.value, 260*camZ.value] });
      camY.value = withDecay({ velocity: e.velocityY/scale, clamp: [-260*camZ.value, 260*camZ.value] });
    });
  const pinch = Gesture.Pinch().onBegin(() => { startZ.value = camZ.value; })
    .onUpdate(e => { camZ.value = Math.max(1, Math.min(3, startZ.value*e.scale)); });
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => { camX.value = 0; camY.value = 0; camZ.value = 1; });
  const tap = Gesture.Tap().maxDistance(12).onEnd(e => {
    'worklet';
    const wx = (e.x/scale - W/2)/camZ.value + W/2 - camX.value/camZ.value;
    const wy = (e.y/scale - H*0.55)/camZ.value + H*0.55 - camY.value/camZ.value;
    runOnJS(hitTest)(wx, wy);
  });
  const gesture = Gesture.Race(tap, doubleTap, Gesture.Simultaneous(pan, pinch));

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ width, height: width*H/W }}>
        <Rect x={0} y={0} width={W} height={H}>
          <RadialGradient c={vec(W/2, H*0.84)} r={H*0.9} colors={[sky.a, sky.b, sky.c]} positions={[0, 0.52, 1]} />
        </Rect>
        <Sky sky={sky} />

        <Group transform={transform}>
          <Ground tree={tree} />
          <Trunk tree={tree} />

          {[0, 1, 2].map(layer => (
            <Group key={layer} layer={layer === 0 ? <Paint opacity={0.9}><Blur blur={2.2} /></Paint> : undefined}>
              {tree.limbs.map(L => (
                <LimbLayer key={L.friend.id} limb={L} layer={layer} gust={gust} clock={clock} filter={filter} />
              ))}
            </Group>
          ))}

          {tree.limbs.map((L, i) => (
            <PhotoPrint key={'p'+L.friend.id} limb={L} index={i}
              gust={gust} clock={clock} filter={filter} font={font} fontSm={fontSm} fontXs={fontXs} />
          ))}
          <CrownPrint tree={tree} gust={gust} clock={clock} font={font} fontSm={fontSm} />
        </Group>

        <Rect x={0} y={0} width={W} height={H}>
          <RadialGradient c={vec(W/2, H*0.46)} r={H*0.78} colors={['#00000000', '#00000073']} positions={[0.38, 1]} />
        </Rect>
      </Canvas>
    </GestureDetector>
  );
}

/* returns a usable font or null; never throws if the family is missing */
function safeFont(size: number) {
  try {
    const f = matchFont({ fontFamily: 'Familjen Grotesk', fontSize: size, fontWeight: '600' } as any);
    if (f && f.getSize && f.getSize()) return f;
  } catch {}
  try { return matchFont({ fontFamily: 'sans-serif', fontSize: size, fontWeight: '600' } as any); } catch {}
  return null;
}

/* ------------------------------------------------------------------ */
function Sky({ sky }: { sky: typeof SKIES['night'] }) {
  const arc = Math.max(0, Math.min(1, ((new Date().getHours()+18)%24)/24));
  const cx = 90+arc*620, cy = 180-Math.sin(arc*Math.PI)*110;
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={120}><RadialGradient c={vec(cx,cy)} r={120} colors={[sky.body+'66', sky.body+'00']} /></Circle>
      <Circle cx={cx} cy={cy} r={19} color={sky.body} />
    </Group>
  );
}

function Ground({ tree }: { tree: Tree }) {
  const soil = useMemo(() => { const p = Skia.Path.Make();
    p.moveTo(0, H); p.quadTo(210, tree.baseY-8, 400, tree.baseY-4); p.quadTo(590, tree.baseY-8, W, H); p.close(); return p; }, [tree]);
  return (
    <Group>
      <Oval x={tree.baseX-330} y={tree.baseY-50} width={660} height={120} color="#00000080" opacity={0.45} />
      <Path path={soil}><LinearGradient start={vec(0,tree.baseY-20)} end={vec(0,H)} colors={['#2b3152','#080c1a']} /></Path>
    </Group>
  );
}

function Trunk({ tree }: { tree: Tree }) {
  const trunk = useMemo(() => Skia.Path.MakeFromSVGString(outlinePath(tree.trunkPts, tree.trunkWs)) ?? Skia.Path.Make(), [tree]);
  const roots = useMemo(() => tree.roots.map(r => outlinePath(r.pts, r.ws)), [tree]);
  const flares = useMemo(() => tree.flares.map(r => outlinePath(r.pts, r.ws)), [tree]);
  const stubs = useMemo(() => tree.stubs.map(r => outlinePath(r.pts, r.ws)), [tree]);
  return (
    <Group>
      {roots.map((d,i) => <Path key={'r'+i} path={d} color="#141830" opacity={0.75} />)}
      {flares.map((d,i) => <Path key={'f'+i} path={d} color={mix(BARK,BARK_DARK,0.22)} />)}
      <Path path={trunk}>
        <LinearGradient start={vec(tree.baseX-58,0)} end={vec(tree.baseX+58,0)}
          colors={[mix(BARK,BARK_LIT,0.5), mix(BARK,BARK_LIT,0.16), BARK, mix(BARK,BARK_DARK,0.7), '#2b4f7a']}
          positions={[0,0.18,0.56,0.88,1]} />
      </Path>
      <Group clip={trunk}>
        {tree.lenticels.map((l,i) => (
          <Line key={'l'+i} p1={vec(l.x,l.y)} p2={vec(l.x+l.w,l.y)} color="rgba(230,226,255,0.13)" strokeWidth={1.4} />
        ))}
        {tree.knots.map((k,i) => (
          <Group key={'k'+i} origin={vec(k.x,k.y)} transform={[{ rotate: k.rot }]}>
            <Oval x={k.x-k.r} y={k.y-k.r*0.66} width={k.r*2} height={k.r*1.32} color={mix(BARK,BARK_LIT,0.16)} />
            <Oval x={k.x-k.r*0.62} y={k.y-k.r*0.4} width={k.r*1.24} height={k.r*0.8} color={mix(BARK,BARK_DARK,0.3)} />
            <Oval x={k.x-k.r*0.24} y={k.y-k.r*0.16} width={k.r*0.48} height={k.r*0.32} color={mix(BARK,BARK_DARK,0.5)} />
          </Group>
        ))}
      </Group>
      {stubs.map((d,i) => <Path key={'s'+i} path={d} color={mix(BARK,BARK_DARK,0.25)} />)}
    </Group>
  );
}

function LimbLayer({ limb, layer, gust, clock, filter }: {
  limb: Limb; layer: number; gust: any; clock: any; filter: string;
}) {
  const f = limb.friend, h = HEALTH[f.health];
  const dim = f.health === 'dormant' ? 0.62 : 1;
  const hidden = (filter === 'stories' && !f.unseenCount) || (filter === 'water' && f.health !== 'wilting' && f.health !== 'dormant');
  const alpha = (hidden ? 0.14 : 1) * dim * (layer === 0 ? 0.86 : 1);

  // merge segments by colour bucket so each is ONE draw node, not dozens
  const segGroups = useMemo(() => {
    const inLayer = limb.segs.filter(s => s.layer === layer);
    const buckets = new Map<string, { pts: any; ws: any }[]>();
    for (const s of inLayer) {
      const col = segBase(s, h, layer);
      (buckets.get(col) ?? buckets.set(col, []).get(col)!).push(s);
    }
    return [...buckets.entries()].map(([col, strips]) => ({ col, d: combinedOutline(strips) }));
  }, [limb, layer]);
  const leaves = useMemo(() => limb.leaves.filter(l => l.layer === layer), [limb, layer]);
  if (!segGroups.length && !leaves.length) return null;

  const parallax = layer === 0 ? 0.82 : layer === 2 ? 1.12 : 1;
  const rot = useDerivedValue(() => {
    const t = clock.value/1000;
    const sway = (Math.sin(t*limb.freq+limb.phase)*0.012 + Math.sin(t*limb.freq*2.3+limb.phase)*0.004) * (0.45 + gust.value*1.35);
    return [{ rotate: sway * parallax }];
  });

  return (
    <Group origin={vec(limb.origin.x, limb.origin.y)} transform={rot} opacity={alpha}>
      {segGroups.map((g, i) => (g.d ? <Path key={i} path={g.d} color={g.col} /> : null))}
      {leaves.map((l, i) => (
        <LeafShape key={i} leaf={l} h={h} origin={limb.origin} gust={gust} clock={clock} animate={layer === 2 && l.live} />
      ))}
    </Group>
  );
}

function segBase(s: Seg, h: { tip: string; mid: string }, layer: number) {
  const d = Math.min(1, s.depth/4);
  let base = s.young ? mix(BARK, mix('#7a6b45', h.tip, 0.18), 0.62) : mix(BARK, mix(h.mid, h.tip, 0.3), d*0.35);
  if (layer === 0) base = mix(base, '#0a0e26', 0.4);
  return base;
}

function LeafShape({ leaf, h, origin, gust, clock, animate }: {
  leaf: Leaf; h: { tip: string; mid: string }; origin: { x: number; y: number };
  gust: any; clock: any; animate: boolean;
}) {
  const lit = (leaf.x-origin.x)*LIGHT.x + (leaf.y-origin.y)*LIGHT.y;
  const tone = lit > 0 ? mix(h.tip, '#eafff4', 0.35) : mix(h.tip, BARK_DARK, 0.45);
  const shift = ['#c8e66a', '#1d8f6a', '#3f7d3a'][(leaf.v*100|0)%3];
  const top = mix(mix(tone, shift, 0.16), '#ffffff', 0.28);
  const bot = mix(mix(tone, shift, 0.16), '#000000', 0.42);

  const transform = useDerivedValue(() => {
    if (!animate) return [
      { translateX: leaf.x }, { translateY: leaf.y }, { rotate: leaf.rot }, { scale: leaf.s },
    ];
    const t = clock.value/1000, g = gust.value;
    const fl = Math.sin(t*2.1+leaf.ph)*0.2*(0.5+g);
    const turn = Math.cos(t*(2.4+leaf.ph*0.2)+leaf.ph)*g*0.9;
    const sx = Math.max(0.18, Math.abs(1-Math.abs(turn)*0.85));
    return [
      { translateX: leaf.x + Math.sin(t*1.7+leaf.ph)*(1+g) }, { translateY: leaf.y },
      { rotate: leaf.rot + fl }, { scaleX: leaf.s*sx }, { scaleY: leaf.s },
    ];
  });

  return (
    <Group>
      <Line p1={vec(leaf.ax, leaf.ay)} p2={vec(leaf.x, leaf.y)} color="rgba(40,60,40,0.5)" strokeWidth={0.8} />
      <Group transform={transform}>
        <Path path={LEAF_PATH}>
          <LinearGradient start={vec(-0.4,-0.5)} end={vec(0.4,0.5)} colors={[top, bot]} />
        </Path>
      </Group>
    </Group>
  );
}

function Fruit({ limb }: { limb: Limb }) {
  const stories = limb.friend.liveStories.slice(0, 4);
  if (!stories.length) return null;
  return (
    <Group>
      {stories.map((s, k) => {
        const p = limb.slots[k]; if (!p) return null;
        const hrs = (Date.now() - s.postedAt)/3.6e6, r = s.seen ? 7.5 : 11, droop = hrs/24*3, col = ripeColor(hrs);
        return (
          <Group key={k}>
            <Oval x={p.x+1.5-r*0.85} y={p.y+droop+r*0.6} width={r*1.7} height={r*0.6} color="#00000066" />
            <Circle cx={p.x} cy={p.y+droop} r={r}>
              <RadialGradient c={vec(p.x-r*0.35, p.y+droop-r*0.4)} r={r*1.15}
                colors={[mix(col,'#ffffff',0.55), col, mix(col,'#1a0d05',0.65)]} positions={[0,0.45,1]} />
            </Circle>
            <Circle cx={p.x} cy={p.y+droop} r={r} style="stroke"
              color={s.seen ? '#475569e6' : '#ffffff'} strokeWidth={s.seen ? 1.2 : 1.6} />
          </Group>
        );
      })}
    </Group>
  );
}

function PhotoPrint({ limb, index, gust, clock, filter, font, fontSm, fontXs }: any) {
  const f = limb.friend, h = (HEALTH as Record<string, any>)[f.health];
  const hidden = (filter === 'stories' && !f.unseenCount) || (filter === 'water' && f.health !== 'wilting' && f.health !== 'dormant');
  const worn = f.health === 'wilting', gone = f.health === 'dormant';
  const hue = hueOf(f.name);
  const pw = CARD_W, ph = CARD_H, border = 4, iw = pw-border*2, ih = ph-border-16;
  const photo = useImage(f.avatarUrl ?? null);

  const pos = useDerivedValue(() => {
    const t = clock.value/1000, g = gust.value;
    const swing = Math.sin(t*(1.2+index*0.06)+limb.phase)*(0.045+g*0.09) + Math.sin(t*limb.freq+limb.phase)*0.025;
    return { cx: limb.card.x + Math.sin(swing)*4, cy: limb.card.y, swing };
  });
  const groupT = useDerivedValue(() => {
    const tilt = (index%2?1:-1)*0.045;
    return [{ translateX: pos.value.cx }, { translateY: pos.value.cy }, { rotate: pos.value.swing*0.85 + tilt }];
  });
  const twine = useDerivedValue(() => { const p = Skia.Path.Make(); p.moveTo(limb.tip.x, limb.tip.y); p.lineTo(pos.value.cx, pos.value.cy-ph/2-10); return p; });

  const paperTop = gone ? '#6f6d78' : worn ? '#ded2b4' : '#f6f1e4';
  const paperBot = gone ? '#3c3b47' : worn ? '#a2937a' : '#c9c0ad';
  const imgTop = gone ? hslHex(hue,8,30) : worn ? hslHex(hue,30,44) : hslHex(hue,62,56);
  const imgBot = gone ? hslHex(hue,5,14) : worn ? hslHex(hue,22,22) : hslHex(hue,52,26);
  const glow = worn ? '#fb923c' : h.tip;
  const nm = f.name.split(' ')[0];

  return (
    <Group opacity={hidden ? 0.12 : 1}>
      <Fruit limb={limb} />
      <Path path={twine} color="rgba(120,112,140,0.85)" style="stroke" strokeWidth={1.4} />
      <Group transform={groupT}>
        {!gone && <Circle cx={0} cy={0} r={64}><RadialGradient c={vec(0,0)} r={64} colors={[glow+(worn?'33':'55'), glow+'00']} /></Circle>}
        <RoundedRect x={-pw/2+3} y={-ph/2+5} width={pw} height={ph} r={2} color="#00000080" />
        <RoundedRect x={-pw/2} y={-ph/2} width={pw} height={ph} r={2}>
          <LinearGradient start={vec(-pw/2,-ph/2)} end={vec(pw/2,ph/2)} colors={[paperTop, paperBot]} />
        </RoundedRect>
        {photo
          ? <SkImage image={photo} x={-iw/2} y={-ph/2+border} width={iw} height={ih} fit="cover" opacity={gone ? 0.5 : 1} />
          : <Rect x={-iw/2} y={-ph/2+border} width={iw} height={ih}>
              <LinearGradient start={vec(-iw/2,-ph/2+border)} end={vec(-iw/2,-ph/2+border+ih)} colors={[imgTop, imgBot]} />
            </Rect>}
        {!photo && font && <SkText x={-font.measureText(initials(f.name)).width/2} y={-ph/2+border+ih*0.62}
          text={initials(f.name)} font={font} color={gone ? '#9aa0b4' : '#ffffff'} opacity={gone ? 0.5 : 0.92} />}
        {fontSm && <SkText x={-fontSm.measureText(nm).width/2} y={ph/2-4.5} text={nm} font={fontSm} color={gone ? '#2f2e38' : '#4a4330'} />}
        {f.streak > 0 && (
          <Group>
            <RoundedRect x={iw/2-25} y={-ph/2+border+ih-12} width={25} height={11} r={2} color="#00000073" />
            {fontXs && <SkText x={iw/2-24} y={-ph/2+border+ih-4} text={'▲ '+f.streak} font={fontXs}
              color={gone ? '#7d8399' : worn ? '#f0b070' : '#ffd9a0'} />}
          </Group>
        )}
        <Group transform={[{ translateY: -ph/2-1 }]}>
          <RoundedRect x={-9} y={-10} width={7} height={15} r={1.6} color="#8a6a44" />
          <RoundedRect x={2}  y={-10} width={7} height={15} r={1.6} color="#a17f52" />
          <Line p1={vec(-6,-4)} p2={vec(6,-4)} color="#c9cbd6" strokeWidth={1.4} />
        </Group>
      </Group>
      {!!f.unseenCount && !hidden && <Badge pos={pos} dx={pw/2-2} dy={-ph/2+2} n={f.unseenCount} fill="#ffe9a8" text="#3a2a08" font={fontXs} />}
      {!!f.unread && !hidden && <Badge pos={pos} dx={-pw/2+2} dy={-ph/2+2} n={f.unread} fill="#bbf7d0" text="#04120a" font={fontXs} />}
    </Group>
  );
}

function Badge({ pos, dx, dy, n, fill, text, font }: any) {
  const c = useDerivedValue(() => vec(pos.value.cx+dx, pos.value.cy+dy));
  const tx = useDerivedValue(() => (font ? pos.value.cx+dx - font.measureText(String(n)).width/2 : 0));
  const ty = useDerivedValue(() => pos.value.cy+dy+3.5);
  return (
    <>
      <Circle c={c} r={7.5} color={fill} />
      {font && <SkText x={tx} y={ty} text={String(n)} font={font} color={text} />}
    </>
  );
}

function CrownPrint({ tree, gust, clock, font, fontSm }: any) {
  const c = tree.crown, W2 = 58, H2 = 70, b2 = 5;
  const pos = useDerivedValue(() => {
    const t = clock.value/1000, g = gust.value, ys = Math.sin(t*1.02)*(0.035+g*0.06);
    return { cx: c.x + Math.sin(ys)*30, cy: c.y-16 + Math.cos(ys)*30, ys };
  });
  const groupT = useDerivedValue(() => [{ translateX: pos.value.cx }, { translateY: pos.value.cy }, { rotate: pos.value.ys*0.85+0.03 }]);
  const twine = useDerivedValue(() => { const p = Skia.Path.Make(); p.moveTo(c.x,c.y-58); p.lineTo(pos.value.cx, pos.value.cy-44); return p; });
  return (
    <Group>
      <Path path={twine} color="rgba(150,120,170,0.9)" style="stroke" strokeWidth={1.6} />
      <Group transform={groupT}>
        <Circle cx={0} cy={0} r={86}><RadialGradient c={vec(0,0)} r={86} colors={['#e879f955','#e879f900']} /></Circle>
        <RoundedRect x={-W2/2+3} y={-H2/2+5} width={W2} height={H2} r={2} color="#00000080" />
        <RoundedRect x={-W2/2} y={-H2/2} width={W2} height={H2} r={2}>
          <LinearGradient start={vec(-W2/2,-H2/2)} end={vec(W2/2,H2/2)} colors={['#f8f2e6','#cdc3b0']} />
        </RoundedRect>
        <Rect x={-W2/2+b2} y={-H2/2+b2} width={W2-b2*2} height={H2-b2-18}>
          <LinearGradient start={vec(0,-H2/2+b2)} end={vec(0,-H2/2+b2+H2-b2-18)} colors={['#5b2a6b','#2a1240']} />
        </Rect>
        {font && <SkText x={-font.measureText('You').width/2} y={-H2/2+b2+(H2-b2-18)*0.62} text="You" font={font} color="#f8dcff" />}
        {fontSm && <SkText x={-fontSm.measureText('+ post').width/2} y={H2/2-5} text="+ post" font={fontSm} color="#4a4330" />}
        <Group transform={[{ translateY: -H2/2-1 }]}>
          <RoundedRect x={-10} y={-11} width={8} height={16} r={1.8} color="#e879f9" />
          <RoundedRect x={2}  y={-11} width={8} height={16} r={1.8} color="#f0abfc" />
          <Line p1={vec(-7,-4)} p2={vec(7,-4)} color="#c9cbd6" strokeWidth={1.5} />
        </Group>
      </Group>
    </Group>
  );
}

function buildHits(tree: Tree) {
  const hits: any[] = [];
  for (const L of tree.limbs) {
    L.friend.liveStories.slice(0, 4).forEach((s, k) => {
      const p = L.slots[k]; if (!p) return;
      const hrs = (Date.now() - s.postedAt)/3.6e6, r = s.seen ? 7.5 : 11, droop = hrs/24*3;
      hits.push({ x: p.x, y: p.y+droop, r: r+8, type: 'fruit', fid: L.friend.id, sid: s.id });
    });
    hits.push({ x: L.card.x, y: L.card.y, r: 34, type: 'node', fid: L.friend.id });
  }
  hits.push({ x: tree.crown.x, y: tree.crown.y+10, r: 34, type: 'post' });
  return hits;
}
