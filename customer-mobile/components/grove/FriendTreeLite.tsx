/**
 * FriendTreeLite.tsx — DIAGNOSTIC renderer.
 *
 * Same generator, but draws every branch/leaf/print DIRECTLY to the live canvas.
 * No Skia.Surface.MakeOffscreen (no baking), no matchFont (no custom font),
 * no gestures. If THIS shows a tree, the problem is the baking/font layer in
 * FriendTree.tsx, not Skia itself.
 *
 * Usage: temporarily render <FriendTreeLite friends={...} seedKey={user.id} />
 * in place of <FriendTree>. Delete once the real one works.
 *
 * deps: @shopify/react-native-skia only.
 */
import React, { useMemo } from 'react';
import { useWindowDimensions, Text as RNText, View } from 'react-native';
import {
  Canvas, Group, Path, Rect, Circle, Oval, RoundedRect, Text as SkText,
  LinearGradient, RadialGradient, vec, useFont, Skia,
} from '@shopify/react-native-skia';
import {
  buildTree, HEALTH, ripeColor, hslHex, mix, hueOf, initials, outlinePath,
  BARK, BARK_LIT, BARK_DARK, LIGHT, type Friend, type Tree, type Limb,
} from './friendTree';

const W = 800, H = 1000;
const SKY = { a: '#1a2352', b: '#0a0e26', c: '#04050d', body: '#e2e8f0' };

export default function FriendTreeLite({ friends, seedKey }: { friends: Friend[]; seedKey: string }) {
  const { width } = useWindowDimensions();
  const tree = useMemo<Tree>(() => buildTree(friends, seedKey, W, H), [friends, seedKey]);

  // Built-in / safe remote font — returns null until loaded without throwing.
  const font = useFont(
    'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf',
    15,
  );

  // If Skia itself is broken, this whole component throws and you'll see it in logs.
  return (
    <View style={{ flex: 1, backgroundColor: '#04050d' }}>
      <Canvas style={{ width, height: width * H / W }}>
        <Rect x={0} y={0} width={W} height={H}>
          <RadialGradient c={vec(W / 2, H * 0.84)} r={H * 0.9} colors={[SKY.a, SKY.b, SKY.c]} positions={[0, 0.52, 1]} />
        </Rect>

        {/* ground */}
        <GroundLite tree={tree} />

        {/* trunk */}
        <Path path={outlinePath(tree.trunkPts, tree.trunkWs)}>
          <LinearGradient
            start={vec(tree.baseX - 58, 0)}
            end={vec(tree.baseX + 58, 0)}
            colors={[mix(BARK, BARK_LIT, 0.5), BARK, mix(BARK, BARK_DARK, 0.7), '#2b4f7a']}
            positions={[0, 0.5, 0.88, 1]}
          />
        </Path>

        {/* every branch segment drawn live, no baking */}
        {tree.limbs.map(L => (
          <LimbLite key={L.friend.id} limb={L} />
        ))}

        {/* every leaf as a tiny oval — proves geometry without sprites */}
        {tree.limbs.map(L => (
          <Group key={'lf' + L.friend.id}>
            {L.leaves.map((l, i) => {
              const h = HEALTH[L.friend.health];
              const lit = (l.x - L.origin.x) * LIGHT.x + (l.y - L.origin.y) * LIGHT.y;
              const col = lit > 0 ? mix(h.tip, '#eafff4', 0.3) : mix(h.tip, BARK_DARK, 0.4);
              return <Oval key={i} x={l.x - l.s * 0.28} y={l.y - l.s * 0.5} width={l.s * 0.56} height={l.s} color={col} />;
            })}
          </Group>
        ))}

        {/* photo prints, static (no wind) */}
        {tree.limbs.map((L, i) => (
          <PrintLite key={'p' + L.friend.id} limb={L} index={i} font={font} />
        ))}

        {/* crown */}
        <RoundedRect x={tree.crown.x - 29} y={tree.crown.y - 51} width={58} height={70} r={2}>
          <LinearGradient
            start={vec(tree.crown.x - 29, tree.crown.y - 51)}
            end={vec(tree.crown.x + 29, tree.crown.y + 19)}
            colors={['#f8f2e6', '#cdc3b0']}
          />
        </RoundedRect>
        <Rect x={tree.crown.x - 24} y={tree.crown.y - 46} width={48} height={47} color="#3a1c48" />
        {font && (
          <SkText
            x={tree.crown.x - font.measureText('You').width / 2}
            y={tree.crown.y - 16}
            text="You"
            font={font}
            color="#f8dcff"
          />
        )}
      </Canvas>

      {/* if the canvas is blank you'll still see this — proves the component mounted */}
      <RNText style={{ position: 'absolute', top: 6, left: 8, color: '#94a3b8', fontSize: 10 }}>
        lite · {tree.limbs.length} limbs · {tree.limbs.reduce((n, L) => n + L.leaves.length, 0)} leaves · font {font ? 'ok' : 'loading'}
      </RNText>
    </View>
  );
}

function GroundLite({ tree }: { tree: Tree }) {
  const soil = Skia.Path.Make();
  soil.moveTo(0, H);
  soil.quadTo(210, tree.baseY - 8, 400, tree.baseY - 4);
  soil.quadTo(590, tree.baseY - 8, W, H);
  soil.close();
  return (
    <Path path={soil}>
      <LinearGradient start={vec(0, tree.baseY - 20)} end={vec(0, H)} colors={['#2b3152', '#080c1a']} />
    </Path>
  );
}

function LimbLite({ limb }: { limb: Limb }) {
  const h = HEALTH[limb.friend.health];
  return (
    <Group>
      {limb.segs.map((s, i) => {
        const d = Math.min(1, s.depth / 4);
        const base = s.young
          ? mix(BARK, mix('#7a6b45', h.tip, 0.18), 0.62)
          : mix(BARK, mix(h.mid, h.tip, 0.3), d * 0.3);
        return <Path key={i} path={outlinePath(s.pts, s.ws)} color={base} />;
      })}
    </Group>
  );
}

function PrintLite({ limb, index, font }: { limb: Limb; index: number; font: any }) {
  const f = limb.friend,
    hue = hueOf(f.name);
  const gone = f.health === 'dormant',
    worn = f.health === 'wilting';
  const cx = limb.tip.x,
    cy = limb.tip.y + 30,
    pw = 52,
    ph = 60,
    b = 4,
    iw = pw - b * 2,
    ih = ph - b - 16;
  const paperTop = gone ? '#6f6d78' : worn ? '#ded2b4' : '#f6f1e4';
  const imgTop = gone ? hslHex(hue, 8, 30) : hslHex(hue, 62, 56);
  const imgBot = gone ? hslHex(hue, 5, 14) : hslHex(hue, 52, 26);
  return (
    <Group>
      <RoundedRect x={cx - pw / 2} y={cy - ph / 2} width={pw} height={ph} r={2} color={paperTop} />
      <Rect x={cx - iw / 2} y={cy - ph / 2 + b} width={iw} height={ih}>
        <LinearGradient
          start={vec(cx - iw / 2, cy - ph / 2 + b)}
          end={vec(cx - iw / 2, cy - ph / 2 + b + ih)}
          colors={[imgTop, imgBot]}
        />
      </Rect>
      {font && (
        <SkText
          x={cx - font.measureText(initials(f.name)).width / 2}
          y={cy - ph / 2 + b + ih * 0.6}
          text={initials(f.name)}
          font={font}
          color={gone ? '#9aa0b4' : '#ffffff'}
        />
      )}
    </Group>
  );
}
