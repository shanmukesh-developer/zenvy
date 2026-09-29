/**
 * treeTextures.ts — offscreen images baked once per grove.
 * Bakes leaf sprites (15 variants/health) and bark texture.
 * 
 * Adapted for @shopify/react-native-skia actual API:
 * - Uses Skia.Surface.Make() (software surface) instead of MakeOffscreen
 * - Uses proper color construction via Skia.Color()
 * - Stroke style set via PaintStyle enum
 */
import {
  Skia,
  TileMode,
  PaintStyle,
  BlendMode,
  StrokeCap,
  type SkImage,
} from '@shopify/react-native-skia';
import { mix, mulberry32, BARK_DARK } from './friendTree';

/** Create a simple fill paint with a hex color */
const makePaint = (hex: string, alpha = 1) => {
  const p = Skia.Paint();
  p.setColor(Skia.Color(hex));
  if (alpha < 1) p.setAlphaf(alpha);
  p.setAntiAlias(true);
  return p;
};

/** Bake one leaf: gradient body, midrib, side veins, nibble holes */
function bakeLeaf(color: string, seed: number): SkImage {
  const S = 48, H = S * 1.6;
  const sur = Skia.Surface.Make(Math.ceil(S), Math.ceil(H))!;
  const c = sur.getCanvas();
  const rng = mulberry32(seed);

  // Leaf body path
  const body = Skia.Path.Make();
  body.moveTo(S / 2, H * 0.02);
  body.cubicTo(S * 0.98, H * 0.3, S * 0.9, H * 0.76, S / 2, H * 0.99);
  body.cubicTo(S * 0.1, H * 0.76, S * 0.02, H * 0.3, S / 2, H * 0.02);
  body.close();

  // Gradient fill
  const grad = Skia.Paint();
  grad.setAntiAlias(true);
  grad.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: S * 0.2, y: 0 },
      { x: S * 0.85, y: H },
      [
        Skia.Color(mix(color, '#ffffff', 0.32)),
        Skia.Color(color),
        Skia.Color(mix(color, '#000000', 0.5)),
      ],
      [0, 0.55, 1],
      TileMode.Clamp,
    ),
  );
  c.drawPath(body, grad);

  // Midrib
  const vein = Skia.Paint();
  vein.setAntiAlias(true);
  vein.setStyle(PaintStyle.Stroke);
  vein.setColor(Skia.Color('#000000'));
  vein.setAlphaf(0.3);
  vein.setStrokeWidth(S * 0.035);
  const mid = Skia.Path.Make();
  mid.moveTo(S / 2, H * 0.08);
  mid.lineTo(S / 2, H * 0.94);
  c.drawPath(mid, vein);

  // Side veins
  vein.setAlphaf(0.17);
  vein.setStrokeWidth(S * 0.022);
  for (let i = 1; i <= 4; i++) {
    const y = H * (0.18 + i * 0.16);
    const v = Skia.Path.Make();
    v.moveTo(S / 2, y);
    v.lineTo(S * 0.85, y + H * 0.075);
    v.moveTo(S / 2, y);
    v.lineTo(S * 0.15, y + H * 0.075);
    c.drawPath(v, vein);
  }

  // Nibble holes (erase mode)
  const erase = Skia.Paint();
  erase.setBlendMode(BlendMode.Clear);
  erase.setAntiAlias(true);
  for (let i = 0; i < 4; i++) {
    c.drawCircle(rng() * S, H * (0.15 + rng() * 0.75), S * (0.03 + rng() * 0.06), erase);
  }

  return sur.makeImageSnapshot();
}

/**
 * 15 leaf variants per health colour: 5 values x 3 hue shifts.
 * Uniform colour is the visual tell of a fake tree — the variety prevents that.
 */
export function bakeLeafSet(base: string): SkImage[] {
  const shifts = ['#c8e66a', '#1d8f6a', '#3f7d3a'];
  const set: SkImage[] = [];
  for (let v = 0; v < 5; v++) {
    for (let h = 0; h < 3; h++) {
      const t = (v - 2) / 2;
      let col =
        t > 0 ? mix(base, '#eafff4', t * 0.5) : mix(base, BARK_DARK, -t * 0.6);
      col = mix(col, shifts[h], 0.16);
      set.push(bakeLeaf(col, 31 + v * 7 + h * 53));
    }
  }
  return set;
}

/**
 * Vertical bark texture: dark grooves with lit ridges, plus grain.
 * Tiled onto the trunk via an overlay blend.
 */
export function bakeBark(seed: number): SkImage {
  const w = 256, h = 1024;
  const sur = Skia.Surface.Make(w, h)!;
  const c = sur.getCanvas();
  const rng = mulberry32(seed);

  // Base grey
  c.drawColor(Skia.Color('#808080'));

  // Groove strokes
  const stroke = Skia.Paint();
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeCap(StrokeCap.Round);
  stroke.setAntiAlias(true);

  for (let i = 0; i < 240; i++) {
    const x = rng() * w;
    const len = 120 + rng() * 700;
    const y0 = rng() * h;
    const amp = 3 + rng() * 9;
    const ph = rng() * 6.28;
    const wdt = 0.8 + rng() * 3.4;

    const pairs: [number, string, number, number][] = [
      [wdt * 1.5, '#ffffff', 0.06 + rng() * 0.17, wdt * 0.7],
      [0, '#000000', 0.18 + rng() * 0.42, wdt],
    ];

    for (const [off, hex, alpha, ww] of pairs) {
      const path = Skia.Path.Make();
      for (let k = 0; k <= 18; k++) {
        const t = k / 18;
        const yy = y0 + t * len;
        const xx =
          x +
          off +
          Math.sin(t * 7 + ph) * amp +
          Math.sin(t * 19 + ph * 2) * amp * 0.35;
        k ? path.lineTo(xx, yy) : path.moveTo(xx, yy);
      }
      stroke.setColor(Skia.Color(hex));
      stroke.setAlphaf(alpha);
      stroke.setStrokeWidth(ww);
      c.drawPath(path, stroke);
    }
  }

  // Grain dots
  const grain = Skia.Paint();
  for (let i = 0; i < 6000; i++) {
    const v = (rng() * 255) | 0;
    grain.setColor(Skia.Color(`rgb(${v},${v},${v})`));
    grain.setAlphaf(0.05);
    c.drawRect(
      Skia.XYWHRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 3),
      grain,
    );
  }

  return sur.makeImageSnapshot();
}

export { makePaint };
