import {
  buildTree,
  enrich,
  HEALTH,
  ripeColor,
  hueOf,
  initials,
  outlinePath,
  mix,
  BARK,
  BARK_LIT,
  BARK_DARK,
  type Friend,
  type Tree,
  type Limb,
  type Pt,
  type EnrichedFriend,
} from './friendTree';

export type Props = {
  friends: Friend[];
  seedKey: string;
  tod?: 'night' | 'day' | 'dawn' | 'dusk' | 'auto';
  filter?: 'all' | 'stories' | 'water' | 'bonds';
  showBonds?: boolean;
  isRaining?: boolean;
  onSelectFriend?: (id: string) => void;
  onOpenStory?: (fid: string, sid: string) => void;
  onPost?: () => void;
  useLite?: boolean;
};

const TREE_W = 800;
const TREE_H = 1000;

const GROVE_CSS = `
  @keyframes sporeFloat {
    0%   { transform: translateY(0) translateX(0); opacity: 0.4; }
    30%  { transform: translateY(-12px) translateX(6px); opacity: 0.85; }
    60%  { transform: translateY(-24px) translateX(-4px); opacity: 0.95; }
    80%  { transform: translateY(-15px) translateX(3px); opacity: 0.7; }
    100% { transform: translateY(0) translateX(0); opacity: 0.4; }
  }
  @keyframes driftPetal {
    0%   { transform: translateY(0px) translateX(0px) rotate(0deg); opacity: 0; }
    15%  { opacity: 0.85; }
    85%  { opacity: 0.8; }
    100% { transform: translateY(460px) translateX(75px) rotate(380deg); opacity: 0; }
  }
  @keyframes rainFall {
    0%   { transform: translateY(-50px); opacity: 0; }
    20%  { opacity: 0.8; }
    90%  { opacity: 0.7; }
    100% { transform: translateY(920px); opacity: 0; }
  }
  @keyframes shootingStar {
    0%   { transform: translateX(0) translateY(0); opacity: 0; }
    10%  { opacity: 0.9; }
    40%  { transform: translateX(280px) translateY(180px); opacity: 0; }
    100% { transform: translateX(280px) translateY(180px); opacity: 0; }
  }
  @keyframes fruitPulse {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(251,191,36,0.3)); }
    50%      { filter: drop-shadow(0 0 16px rgba(251,191,36,0.85)) drop-shadow(0 0 24px rgba(245,158,11,0.5)); }
  }
  @keyframes gentleSway {
    0%, 100% { transform: rotate(0deg); }
    50%      { transform: rotate(0.8deg); }
  }
  @keyframes moonGlow {
    0%, 100% { opacity: 0.45; }
    50%      { opacity: 0.65; }
  }
  @keyframes petalBreath {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.06); }
  }
  @keyframes pollenFloat {
    0%   { transform: translateY(0) translateX(0); opacity: 0.9; }
    33%  { transform: translateY(-8px) translateX(4px); opacity: 0.6; }
    66%  { transform: translateY(-14px) translateX(-3px); opacity: 0.3; }
    100% { transform: translateY(-20px) translateX(1px); opacity: 0; }
  }
  @keyframes lotusGlow {
    0%, 100% { filter: drop-shadow(0 0 8px rgba(250,204,21,0.4)); }
    50%      { filter: drop-shadow(0 0 18px rgba(250,204,21,0.8)) drop-shadow(0 0 28px rgba(245,158,11,0.4)); }
  }

  * {
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #04050d;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .grove-flower {
    cursor: pointer;
    transition: filter 0.2s ease, opacity 0.3s ease;
  }
  .grove-flower:active {
    filter: drop-shadow(0 0 16px rgba(56,189,248,0.7)) drop-shadow(0 0 8px rgba(34,211,238,0.5));
  }
  .flower-thriving {
    animation: petalBreath 3.5s ease-in-out infinite;
  }
  .golden-lotus {
    cursor: pointer;
    animation: lotusGlow 4s ease-in-out infinite;
    transition: filter 0.2s ease;
  }
  .golden-lotus:active {
    filter: drop-shadow(0 0 20px rgba(250,204,21,0.9));
  }

  .fruit-orb {
    cursor: pointer;
    transition: filter 0.2s ease;
  }
  .fruit-orb:active {
    filter: drop-shadow(0 0 14px rgba(245,158,11,0.9));
  }
  .fruit-fresh {
    animation: fruitPulse 3s ease-in-out infinite;
  }
`;

export function generateGroveHtml(props: {
  friends: Friend[];
  seedKey: string;
  tod?: 'night' | 'day' | 'dawn' | 'dusk' | 'auto';
  filter?: 'all' | 'stories' | 'water' | 'bonds';
  showBonds?: boolean;
  isRaining?: boolean;
}): string {
  const {
    friends = [],
    seedKey = 'grove-seed',
    tod = 'night',
    filter = 'all',
    showBonds = false,
    isRaining = false,
  } = props;

  const tree = buildTree(friends, seedKey, TREE_W, TREE_H);

  // Stars
  const stars: { x: number; y: number; r: number; opacity: number }[] = [];
  let sStar = 31415;
  const rndStar = () => {
    sStar = (sStar * 16807) % 2147483647;
    return (sStar - 1) / 2147483646;
  };
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.round(rndStar() * TREE_W),
      y: Math.round(rndStar() * 660),
      r: rndStar() > 0.85 ? 1.9 : rndStar() > 0.4 ? 1.2 : 0.75,
      opacity: 0.3 + rndStar() * 0.7,
    });
  }

  // Constellation lines connecting a few prominent stars for realistic magic
  const constellationLines: { x1: number; y1: number; x2: number; y2: number }[] = [
    { x1: 120, y1: 160, x2: 180, y2: 130 },
    { x1: 180, y1: 130, x2: 240, y2: 170 },
    { x1: 240, y1: 170, x2: 290, y2: 140 },
    { x1: 640, y1: 190, x2: 700, y2: 160 },
    { x1: 700, y1: 160, x2: 730, y2: 220 },
  ];

  // Fireflies
  const fireflies: { x: number; y: number; r: number; color: string; dur: number }[] = [];
  let sFire = 87654;
  const rndFire = () => {
    sFire = (sFire * 16807) % 2147483647;
    return (sFire - 1) / 2147483646;
  };
  const colors = ['#86efac', '#7dd3fc', '#fef08a', '#e879f9', '#6ee7b7', '#f472b6'];
  for (let i = 0; i < 28; i++) {
    fireflies.push({
      x: 70 + rndFire() * 660,
      y: 160 + rndFire() * 680,
      r: 1.8 + rndFire() * 1.8,
      color: colors[Math.floor(rndFire() * colors.length)],
      dur: 3.2 + rndFire() * 4,
    });
  }

  // Petals
  const driftingPetals: { x: number; startY: number; scale: number; rot: number; delay: number; dur: number }[] = [];
  let sPetal = 45912;
  const rndPetal = () => {
    sPetal = (sPetal * 16807) % 2147483647;
    return (sPetal - 1) / 2147483646;
  };
  for (let i = 0; i < 16; i++) {
    driftingPetals.push({
      x: 100 + rndPetal() * 600,
      startY: 140 + rndPetal() * 380,
      scale: 0.65 + rndPetal() * 0.7,
      rot: rndPetal() * 360,
      delay: rndPetal() * 5,
      dur: 6 + rndPetal() * 6,
    });
  }

  // Raindrops
  const rainDrops: { x: number; y: number; len: number; dur: number; delay: number }[] = [];
  let sRain = 77123;
  const rndRain = () => {
    sRain = (sRain * 16807) % 2147483647;
    return (sRain - 1) / 2147483646;
  };
  for (let i = 0; i < 50; i++) {
    rainDrops.push({
      x: Math.round(rndRain() * TREE_W),
      y: Math.round(rndRain() * 260),
      len: 22 + rndRain() * 28,
      dur: 0.75 + rndRain() * 0.5,
      delay: rndRain() * 1.2,
    });
  }

  const isNight = tod === 'night' || tod === 'auto';
  const isDay = tod === 'day';
  const isDawn = tod === 'dawn';
  const isDusk = tod === 'dusk';

  const skyFillUrl = isDay
    ? 'url(#skyGradDay)'
    : isDawn
    ? 'url(#skyGradDawn)'
    : isDusk
    ? 'url(#skyGradDusk)'
    : 'url(#skyGradNight)';

  // Safe, centered crown position
  const safeCrownX = Math.max(120, Math.min(680, (tree.crown?.x || 400))) - 33;
  const safeCrownY = Math.max(190, Math.min(520, (tree.crown?.y || 350))) - 50;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${GROVE_CSS}</style>
  <script>
    function emitGroveEvent(type, payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
      }
    }
  </script>
</head>
<body>
  <!-- Optimized viewBox: tightly frames the rich canopy and roots with 0 wasted space -->
  <svg viewBox="50 110 700 850" preserveAspectRatio="xMidYMid meet">
    <defs>
      <!-- Night Sky -->
      <radialGradient id="skyGradNight" cx="50%" cy="30%" r="85%">
        <stop offset="0%" stop-color="#1c1952" />
        <stop offset="35%" stop-color="#0e1133" />
        <stop offset="70%" stop-color="#07091c" />
        <stop offset="100%" stop-color="#02030a" />
      </radialGradient>

      <!-- Day Sky -->
      <linearGradient id="skyGradDay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1d4ed8" />
        <stop offset="35%" stop-color="#3b82f6" />
        <stop offset="70%" stop-color="#60a5fa" />
        <stop offset="100%" stop-color="#bfdbfe" />
      </linearGradient>

      <!-- Dawn Sky -->
      <linearGradient id="skyGradDawn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#31103f" />
        <stop offset="40%" stop-color="#581c87" />
        <stop offset="75%" stop-color="#c026d3" />
        <stop offset="100%" stop-color="#f472b6" />
      </linearGradient>

      <!-- Dusk Sky -->
      <linearGradient id="skyGradDusk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e1b4b" />
        <stop offset="45%" stop-color="#431407" />
        <stop offset="75%" stop-color="#ea580c" />
        <stop offset="100%" stop-color="#f59e0b" />
      </linearGradient>

      <!-- Sun / Moon Radiance -->
      <radialGradient id="sunGrad" cx="45%" cy="45%" r="55%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="30%" stop-color="#fef08a" />
        <stop offset="70%" stop-color="#facc15" />
        <stop offset="100%" stop-color="#f59e0b" />
      </radialGradient>

      <radialGradient id="sunAura" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fef08a" stop-opacity="0.65" />
        <stop offset="40%" stop-color="#facc15" stop-opacity="0.3" />
        <stop offset="80%" stop-color="#f59e0b" stop-opacity="0.08" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="moonAura" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55" />
        <stop offset="35%" stop-color="#e2e8f0" stop-opacity="0.25" />
        <stop offset="70%" stop-color="#38bdf8" stop-opacity="0.08" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="moonBody" cx="36%" cy="36%" r="64%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="55%" stop-color="#f1f5f9" />
        <stop offset="85%" stop-color="#cbd5e1" />
        <stop offset="100%" stop-color="#94a3b8" />
      </radialGradient>

      <!-- Botanical Flower Shadow -->
      <filter id="flowerShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.5" />
      </filter>

      <!-- Pollen Glow Filter -->
      <filter id="pollenGlow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <!-- Petal Gradients per Health -->
      <radialGradient id="petalThriving" cx="30%" cy="25%" r="80%">
        <stop offset="0%" stop-color="#fbcfe8" />
        <stop offset="30%" stop-color="#f472b6" />
        <stop offset="65%" stop-color="#ec4899" />
        <stop offset="100%" stop-color="#9d174d" />
      </radialGradient>
      <radialGradient id="petalSteady" cx="30%" cy="25%" r="80%">
        <stop offset="0%" stop-color="#a5f3fc" />
        <stop offset="30%" stop-color="#22d3ee" />
        <stop offset="65%" stop-color="#0891b2" />
        <stop offset="100%" stop-color="#164e63" />
      </radialGradient>
      <radialGradient id="petalWilting" cx="30%" cy="25%" r="80%">
        <stop offset="0%" stop-color="#fef3c7" />
        <stop offset="30%" stop-color="#fbbf24" />
        <stop offset="65%" stop-color="#d97706" />
        <stop offset="100%" stop-color="#78350f" />
      </radialGradient>

      <!-- Pistil (Flower Center) Gradient -->
      <radialGradient id="pistilGrad" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#fef9c3" />
        <stop offset="40%" stop-color="#fde047" />
        <stop offset="80%" stop-color="#eab308" />
        <stop offset="100%" stop-color="#a16207" />
      </radialGradient>

      <!-- Stem Gradient -->
      <linearGradient id="stemGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#166534" />
        <stop offset="50%" stop-color="#15803d" />
        <stop offset="100%" stop-color="#302644" />
      </linearGradient>

      <!-- Golden Lotus Petal Gradient -->
      <radialGradient id="lotusGrad" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#fef9c3" />
        <stop offset="25%" stop-color="#fde047" />
        <stop offset="55%" stop-color="#f59e0b" />
        <stop offset="85%" stop-color="#d97706" />
        <stop offset="100%" stop-color="#92400e" />
      </radialGradient>

      <!-- Fruit Glow Filter -->
      <filter id="fruitGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <!-- Botanical Fruit Shadow -->
      <filter id="fruitShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.55" />
      </filter>

      <!-- Fruit Gradients -->
      <radialGradient id="appleGrad" cx="35%" cy="25%" r="75%">
        <stop offset="0%" stop-color="#f87171" />
        <stop offset="28%" stop-color="#ef4444" />
        <stop offset="65%" stop-color="#b91c1c" />
        <stop offset="100%" stop-color="#450a0a" />
      </radialGradient>
      <linearGradient id="appleBlush" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef08a" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#ef4444" stop-opacity="0" />
      </linearGradient>

      <radialGradient id="peachGrad" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="35%" stop-color="#fb923c" />
        <stop offset="70%" stop-color="#f43f5e" />
        <stop offset="100%" stop-color="#9f1239" />
      </radialGradient>
      <radialGradient id="peachBlush" cx="40%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#fb7185" />
        <stop offset="100%" stop-color="#be123c" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="cherryGrad" cx="35%" cy="25%" r="75%">
        <stop offset="0%" stop-color="#fb7185" />
        <stop offset="30%" stop-color="#e11d48" />
        <stop offset="70%" stop-color="#881337" />
        <stop offset="100%" stop-color="#4c0519" />
      </radialGradient>

      <radialGradient id="orangeGrad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="35%" stop-color="#f97316" />
        <stop offset="75%" stop-color="#c2410c" />
        <stop offset="100%" stop-color="#7c2d12" />
      </radialGradient>

      <radialGradient id="plumGrad" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#d8b4fe" />
        <stop offset="35%" stop-color="#a855f7" />
        <stop offset="70%" stop-color="#6b21a8" />
        <stop offset="100%" stop-color="#3b0764" />
      </radialGradient>

      <!-- Canopy Soft Shadow -->
      <filter id="canopyShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="7" result="blur" />
        <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.55 0"/>
        <feBlend in="SourceGraphic" in2="blur" mode="normal"/>
      </filter>

      <!-- Bark Gradient -->
      <linearGradient id="barkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${isDay ? '#5a4970' : '#554773'}" />
        <stop offset="14%" stop-color="${isDay ? '#423359' : '#3b2f52'}" />
        <stop offset="48%" stop-color="${isDay ? '#2e2242' : '#251c37'}" />
        <stop offset="78%" stop-color="${isDay ? '#201633' : '#191325'}" />
        <stop offset="92%" stop-color="${isDay ? '#33244d' : '#2c223e'}" />
        <stop offset="100%" stop-color="${isDay ? '#170f26' : '#100b1a'}" />
      </linearGradient>

      <!-- Foliage Shading Gradients -->
      <radialGradient id="foliageThriving" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#4ade80" />
        <stop offset="35%" stop-color="#22c55e" />
        <stop offset="75%" stop-color="#15803d" />
        <stop offset="100%" stop-color="#052e16" />
      </radialGradient>

      <radialGradient id="foliageSteady" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="35%" stop-color="#0ea5e9" />
        <stop offset="75%" stop-color="#0284c7" />
        <stop offset="100%" stop-color="#082f49" />
      </radialGradient>

      <radialGradient id="foliageWilting" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#fde047" />
        <stop offset="40%" stop-color="#f97316" />
        <stop offset="80%" stop-color="#c2410c" />
        <stop offset="100%" stop-color="#431407" />
      </radialGradient>

      <radialGradient id="foliageDormant" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#94a3b8" />
        <stop offset="50%" stop-color="#64748b" />
        <stop offset="100%" stop-color="#1e293b" />
      </radialGradient>

      <!-- Leaf Fill Gradients -->
      <linearGradient id="leafGradThriving" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#bbf7d0" />
        <stop offset="50%" stop-color="#22c55e" />
        <stop offset="100%" stop-color="#14532d" />
      </linearGradient>
      <linearGradient id="leafGradSteady" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#bae6fd" />
        <stop offset="50%" stop-color="#0284c7" />
        <stop offset="100%" stop-color="#0369a1" />
      </linearGradient>
      <linearGradient id="leafGradWilting" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="50%" stop-color="#ea580c" />
        <stop offset="100%" stop-color="#7c2d12" />
      </linearGradient>

      <!-- Ground Soil Gradient -->
      <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${isDay ? '#14532d' : '#1f253d'}" />
        <stop offset="40%" stop-color="${isDay ? '#052e16' : '#101424'}" />
        <stop offset="100%" stop-color="#04060d" />
      </linearGradient>

      <!-- Edge Blending Vignette Gradients -->
      <linearGradient id="edgeFadeTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#04050d" stop-opacity="1" />
        <stop offset="40%" stop-color="#04050d" stop-opacity="0.6" />
        <stop offset="100%" stop-color="#04050d" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="edgeFadeBottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#04050d" stop-opacity="0" />
        <stop offset="55%" stop-color="#04050d" stop-opacity="0.45" />
        <stop offset="100%" stop-color="#04050d" stop-opacity="1" />
      </linearGradient>
      <linearGradient id="edgeFadeLeft" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#04050d" stop-opacity="1" />
        <stop offset="50%" stop-color="#04050d" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#04050d" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="edgeFadeRight" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#04050d" stop-opacity="0" />
        <stop offset="50%" stop-color="#04050d" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#04050d" stop-opacity="1" />
      </linearGradient>
    </defs>

    <!-- 1. Celestial Sky Base -->
    <rect x="-2000" y="-2000" width="5000" height="5000" fill="${skyFillUrl}" />

    <!-- 2. Ambient Atmosphere Clouds -->
    ${!isDay ? `
      <ellipse cx="260" cy="200" rx="280" ry="140" fill="#431407" opacity="0.14" filter="blur(50px)" />
      <ellipse cx="560" cy="320" rx="260" ry="160" fill="#1e1b4b" opacity="0.38" filter="blur(45px)" />
    ` : ''}

    <!-- 3. Twinkling Stars & Constellations -->
    ${!isDay ? `
      <!-- Constellation lines -->
      ${constellationLines.map(cl => `
        <line x1="${cl.x1}" y1="${cl.y1}" x2="${cl.x2}" y2="${cl.y2}" stroke="#38bdf8" stroke-width="0.75" stroke-dasharray="2 3" opacity="0.25" />
      `).join('')}
      <!-- Star points -->
      ${stars.map((star, i) => `
        <circle
          cx="${star.x}"
          cy="${star.y}"
          r="${star.r}"
          fill="#ffffff"
          opacity="${isDusk || isDawn ? star.opacity * 0.45 : star.opacity}"
        />
      `).join('')}
    ` : ''}

    <!-- 4. Celestial Sun vs Moon -->
    ${isDay ? `
      <g transform="translate(560, 130)">
        ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => `
          <line
            x1="0" y1="0"
            x2="${Math.cos((deg * Math.PI) / 180) * 110}"
            y2="${Math.sin((deg * Math.PI) / 180) * 110}"
            stroke="#fef08a" stroke-width="2.5" opacity="0.35"
          />
        `).join('')}
        <circle cx="0" cy="0" r="115" fill="url(#sunAura)" />
        <circle cx="0" cy="0" r="34" fill="url(#sunGrad)" />
      </g>
    ` : `
      <g transform="translate(520, 155)">
        <circle cx="0" cy="0" r="95" fill="url(#moonAura)" style="animation: moonGlow 5s ease-in-out infinite;" />
        <circle cx="0" cy="0" r="48" fill="#ffffff" opacity="0.14" />
        <circle cx="0" cy="0" r="28" fill="url(#moonBody)" />
        <circle cx="-7" cy="-6" r="6.5" fill="#94a3b8" opacity="0.25" />
        <circle cx="7" cy="7" r="5" fill="#94a3b8" opacity="0.2" />
        <circle cx="10" cy="-4" r="3.5" fill="#94a3b8" opacity="0.18" />
      </g>
    `}

    <!-- 5. Cosmic Shooting Star -->
    ${isNight ? `
      <g style="animation: shootingStar 11s linear infinite; animation-delay: 3s;" opacity="0.75">
        <line x1="140" y1="80" x2="220" y2="135" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
        <circle cx="220" cy="135" r="2.5" fill="#ffffff" />
      </g>
    ` : ''}

    <!-- 6. Fireflies / Spores -->
    ${!isDay ? fireflies.map((spore, i) => `
      <g style="animation: sporeFloat ${spore.dur}s ease-in-out infinite; animation-delay: ${(i * 0.7) % spore.dur}s;">
        <circle cx="${spore.x}" cy="${spore.y}" r="${spore.r * 2.8}" fill="${spore.color}" opacity="0.15" />
        <circle cx="${spore.x}" cy="${spore.y}" r="${spore.r}" fill="${spore.color}" opacity="0.75" />
      </g>
    `).join('') : ''}

    <!-- 7. Cherry Blossom Falling Petals -->
    ${driftingPetals.map((petal, i) => `
      <g style="animation: driftPetal ${petal.dur}s linear infinite; animation-delay: ${petal.delay}s;">
        <path
          d="M ${petal.x},${petal.startY} q 4,-6 8,0 q -2,8 -8,6 q -6,-2 0,-6"
          fill="#f472b6"
          opacity="0.8"
          transform="scale(${petal.scale}) rotate(${petal.rot} ${petal.x} ${petal.startY})"
        />
      </g>
    `).join('')}

    <!-- 8. Rain for Nourish -->
    ${isRaining ? rainDrops.map((drop, i) => `
      <line
        x1="${drop.x}" y1="${drop.y}"
        x2="${drop.x - 4}" y2="${drop.y + drop.len}"
        stroke="#67e8f9" stroke-width="1.8" opacity="0.7"
        style="animation: rainFall ${drop.dur}s linear infinite; animation-delay: ${drop.delay}s;"
      />
    `).join('') : ''}

    <!-- 9. Rolling Hill & Grass -->
    <ellipse cx="${tree.baseX}" cy="${tree.baseY + 45}" rx="500" ry="85" fill="#020409" opacity="0.8" />
    <path
      d="M -2000,${TREE_H + 1000} L -2000,${tree.baseY - 10} Q ${tree.baseX},${tree.baseY - 24} 3000,${tree.baseY - 10} L 3000,${TREE_H + 1000} Z"
      fill="url(#groundGrad)"
    />
    ${[-240, -180, -110, -50, 30, 95, 160, 230, 290].map((dx, i) => `
      <path
        d="M ${tree.baseX + dx},${tree.baseY + 4} q -5,-20 -11,-26 q 13,8 11,26 q 5,-15 7,-22 q 2,13 0,22"
        fill="${isDay ? '#22c55e' : '#166534'}"
        opacity="0.7"
      />
    `).join('')}

    <!-- 10. Roots & Flares -->
    ${tree.roots.map((r) => `
      <path d="${outlinePath(r.pts, r.ws)}" fill="#110d1f" opacity="0.92" />
    `).join('')}
    ${tree.flares.map((f) => `
      <path d="${outlinePath(f.pts, f.ws)}" fill="#271d3d" opacity="0.95" />
    `).join('')}

    <!-- 11. Main Trunk -->
    <g>
      <path d="${outlinePath(tree.trunkPts, tree.trunkWs)}" fill="url(#barkGradient)" filter="url(#canopyShadow)" />
      ${tree.trunkPts.slice(2, -3).map((pt, i) => {
        if (i % 2 !== 0) return '';
        const w = tree.trunkWs[i] || 32;
        const x1 = pt.x - w * 0.32;
        const x2 = pt.x + w * 0.28;
        return `
          <g>
            <line x1="${x1}" y1="${pt.y}" x2="${x1 + 3}" y2="${pt.y + 24}" stroke="#090611" stroke-width="2.4" stroke-linecap="round" opacity="0.4" />
            <line x1="${x2}" y1="${pt.y - 2}" x2="${x2 - 3}" y2="${pt.y + 20}" stroke="#786899" stroke-width="1.5" stroke-linecap="round" opacity="0.45" />
          </g>
        `;
      }).join('')}
      ${tree.lenticels.map((l) => `
        <line x1="${l.x}" y1="${l.y}" x2="${l.x + l.w}" y2="${l.y}" stroke="#9d8eb8" stroke-width="1.6" stroke-linecap="round" opacity="0.3" />
      `).join('')}
      ${tree.knots.map((k) => `
        <g transform="rotate(${k.rot} ${k.x} ${k.y})">
          <ellipse cx="${k.x}" cy="${k.y}" rx="${k.r}" ry="${k.r * 0.65}" fill="#4b3f69" opacity="0.9" />
          <ellipse cx="${k.x}" cy="${k.y}" rx="${k.r * 0.68}" ry="${k.r * 0.42}" fill="#1a1428" />
          <ellipse cx="${k.x - 1}" cy="${k.y - 1}" rx="${k.r * 0.34}" ry="${k.r * 0.22}" fill="#0b0814" />
        </g>
      `).join('')}
      ${tree.stubs.map((s) => `
        <path d="${outlinePath(s.pts, s.ws)}" fill="#201830" />
      `).join('')}
    </g>

    <!-- 12. Mutual Bonds -->
    ${showBonds ? tree.limbs.map((limbA) => {
      const mutuals = limbA.friend.mutuals || [];
      return mutuals.map((targetId) => {
        const limbB = tree.limbs.find(l => l.friend.id === targetId);
        if (!limbB || limbA.friend.id >= targetId) return '';
        const mx = (limbA.tip.x + limbB.tip.x) / 2;
        const my = Math.min(limbA.tip.y, limbB.tip.y) - 45;
        return `
          <path
            d="M ${limbA.tip.x},${limbA.tip.y} Q ${mx},${my} ${limbB.tip.x},${limbB.tip.y}"
            fill="none" stroke="#38bdf8" stroke-width="2.6" stroke-dasharray="6 6" opacity="0.85" filter="url(#fruitGlow)"
          />
        `;
      }).join('');
    }).join('') : ''}

    <!-- 13. Limbs & Volumetric Foliage Masses -->
    ${tree.limbs.map((limb, li) => {
      const f = limb.friend;
      const isWilting = f.health === 'wilting';
      const isDormant = f.health === 'dormant';
      const dim = isDormant ? 0.5 : isWilting ? 0.8 : 1;

      const hidden =
        (filter === 'stories' && !f.unseenCount) ||
        (filter === 'water' && !isWilting && !isDormant);
      const opacity = (hidden ? 0.18 : 1) * dim;

      const foliageFill =
        f.health === 'thriving'
          ? 'url(#foliageThriving)'
          : f.health === 'steady'
          ? 'url(#foliageSteady)'
          : f.health === 'wilting'
          ? 'url(#foliageWilting)'
          : 'url(#foliageDormant)';

      const leafFill =
        f.health === 'thriving'
          ? 'url(#leafGradThriving)'
          : f.health === 'steady'
          ? 'url(#leafGradSteady)'
          : f.health === 'wilting'
          ? 'url(#leafGradWilting)'
          : '#64748b';

      const canopyNodes = limb.segs
        .filter(s => s.depth >= 2)
        .map(s => s.pts[s.pts.length - 1]);

      return `
        <g opacity="${opacity}">
          <!-- Back Layer: Volumetric Soft Canopy Foliage Masses -->
          ${!isDormant ? `
            <g filter="url(#canopyShadow)" opacity="0.68">
              ${canopyNodes.map((pt, ci) => `
                <ellipse
                  cx="${pt.x}" cy="${pt.y - 12}"
                  rx="${38 + (ci % 3) * 10}" ry="${28 + (ci % 2) * 8}"
                  fill="${foliageFill}" opacity="0.52"
                />
              `).join('')}
            </g>
          ` : ''}

          <!-- Branch Wooden Core -->
          ${limb.segs.map((seg) => `
            <path d="${outlinePath(seg.pts, seg.ws)}" fill="${isDormant ? '#28233b' : isWilting ? '#463628' : '#302644'}" />
          `).join('')}

          <!-- Branch Joints -->
          ${limb.joints.map((j) => `
            <circle cx="${j.x}" cy="${j.y}" r="${j.r * 0.9}" fill="#1f182f" />
          `).join('')}

          <!-- Mid Layer: Inner Foliage Puffs -->
          ${!isDormant ? `
            <g opacity="0.82">
              ${canopyNodes.map((pt, ci) => `
                <ellipse
                  cx="${pt.x + (ci % 2 === 0 ? 8 : -8)}" cy="${pt.y - 16}"
                  rx="${26 + (ci % 2) * 8}" ry="${18 + (ci % 2) * 6}"
                  fill="${foliageFill}" opacity="0.7"
                />
              `).join('')}
            </g>
          ` : ''}

          <!-- Foreground Leaves -->
          ${limb.leaves.map((leaf) => {
            const deg = (leaf.rot * 180) / Math.PI;
            const scale = leaf.s / 8.5;
            return `
              <g transform="translate(${leaf.x}, ${leaf.y}) rotate(${deg}) scale(${scale})">
                <line x1="0" y1="-1" x2="0" y2="4" stroke="#111827" stroke-width="0.8" />
                <path d="M 0,-12 C 5.5,-6 4.5,6 0,11 C -4.5,6 -5.5,-6 0,-12 Z" fill="${leafFill}" stroke="#052e16" stroke-width="0.35" />
                <line x1="0" y1="-9" x2="0" y2="8" stroke="#ffffff" stroke-width="0.6" opacity="0.4" />
              </g>
            `;
          }).join('')}

          <!-- Blossoms -->
          ${limb.blossoms.map((blossom) => `
            <g transform="translate(${blossom.x}, ${blossom.y}) rotate(${blossom.rot * 30})">
              ${[0, 72, 144, 216, 288].map(deg => `
                <circle cx="${Math.cos((deg * Math.PI) / 180) * 3.5}" cy="${Math.sin((deg * Math.PI) / 180) * 3.5}" r="3.2" fill="#f472b6" opacity="0.94" />
              `).join('')}
              <circle cx="0" cy="0" r="1.8" fill="#fef08a" />
            </g>
          `).join('')}

          <!-- Orchard Fruits with Juicy Highlights -->
          ${limb.slots.map((slot, si) => {
            const story = f.liveStories[si];
            if (!story && si > 1) return '';
            const isFresh = story && !story.seen;
            const fruitType = (li + si) % 5;
            const clickAction = story
              ? `emitGroveEvent('openStory', { friendId: '${f.id}', storyId: '${story.id}' })`
              : `emitGroveEvent('selectFriend', { id: '${f.id}' })`;

            let fruitContent = '';
            if (fruitType === 0) {
              fruitContent = `
                <g transform="translate(${slot.x}, ${slot.y + 4}) scale(${isFresh ? 1.12 : 1.0})">
                  <path d="M 0,-11 C 1,-16 4,-18 7,-19" fill="none" stroke="#5c3818" stroke-width="2" stroke-linecap="round" />
                  <path d="M 1,-13 C 6,-18 12,-16 14,-12 C 11,-10 6,-11 1,-13 Z" fill="#22c55e" stroke="#15803d" stroke-width="0.5" />
                  <path d="M 0,-10 C 4.5,-12 13,-8 13,0 C 13,8 8,14 3.5,15 C 1.2,15.5 0.8,14 0,14 C -0.8,14 -1.2,15.5 -3.5,15 C -8,14 -13,8 -13,0 C -13,-8 -4.5,-12 0,-10 Z" fill="url(#appleGrad)" filter="url(#fruitShadow)" />
                  <ellipse cx="-3.5" cy="-2" rx="6" ry="8" fill="url(#appleBlush)" opacity="0.6" />
                  <path d="M -7,-5 C -5,-8 -2,-9 1,-8 C -1,-7 -3.5,-5.5 -4.5,-3 C -5.5,-0.5 -6,2 -7.5,1 C -8,-1 -7.8,-3.5 -7,-5 Z" fill="#ffffff" opacity="0.85" />
                  <!-- Dew drop highlight -->
                  <circle cx="4" cy="5" r="1.4" fill="#ffffff" opacity="0.9" />
                  <ellipse cx="0" cy="-10" rx="2.8" ry="1.2" fill="#450a0a" opacity="0.8" />
                </g>
              `;
            } else if (fruitType === 1) {
              fruitContent = `
                <g transform="translate(${slot.x}, ${slot.y + 4}) scale(${isFresh ? 1.12 : 1.0})">
                  <path d="M 0,-10 C -1,-14 -3,-16 -6,-17" fill="none" stroke="#78350f" stroke-width="2" stroke-linecap="round" />
                  <path d="M -1,-12 C -6,-16 -12,-14 -13,-10 C -10,-9 -5,-10 -1,-12 Z" fill="#4ade80" stroke="#16a34a" stroke-width="0.5" />
                  <path d="M 0,-10 C 6,-12.5 13,-5 12,4 C 11,12 5,15 0,16 C -5,15 -11,12 -12,4 C -13,-5 -6,-12.5 0,-10 Z" fill="url(#peachGrad)" filter="url(#fruitShadow)" />
                  <path d="M 0,-9 C 1.8,-4 2.2,4 0,14" fill="none" stroke="#be123c" stroke-width="1" opacity="0.5" />
                  <ellipse cx="4" cy="0" rx="5.5" ry="7" fill="url(#peachBlush)" opacity="0.7" />
                  <ellipse cx="-4.5" cy="-4" rx="2.5" ry="4" transform="rotate(-20 -4.5 -4)" fill="#ffffff" opacity="0.7" />
                </g>
              `;
            } else if (fruitType === 2) {
              fruitContent = `
                <g transform="translate(${slot.x}, ${slot.y + 4}) scale(${isFresh ? 1.12 : 1.0})">
                  <path d="M 0,-17 C -3,-12 -6,-6 -6,1" fill="none" stroke="#65a30d" stroke-width="1.6" />
                  <path d="M 0,-17 C 3,-12 6,-5 6,4" fill="none" stroke="#4d7c0f" stroke-width="1.6" />
                  <circle cx="0" cy="-17" r="1.8" fill="#84cc16" />
                  <path d="M 0,-17 C 5,-21 11,-19 12,-15 C 9,-14 4,-15 0,-17 Z" fill="#22c55e" stroke="#15803d" stroke-width="0.5" />
                  <g transform="translate(-6, 1)">
                    <path d="M 0,-6 C 3,-7.2 6,-4 6,1 C 6,6 3.5,8 0,8.5 C -3.5,8 -6,6 -6,1 C -6,-4 -3,-7.2 0,-6 Z" fill="url(#cherryGrad)" filter="url(#fruitShadow)" />
                    <ellipse cx="-2" cy="-2" rx="1.8" ry="2.6" transform="rotate(-25 -2 -2)" fill="#ffffff" opacity="0.85" />
                    <ellipse cx="0" cy="-6" rx="1.6" ry="0.8" fill="#450a0a" opacity="0.7" />
                  </g>
                  <g transform="translate(6, 4)">
                    <path d="M 0,-6 C 3,-7.2 6,-4 6,1 C 6,6 3.5,8 0,8.5 C -3.5,8 -6,6 -6,1 C -6,-4 -3,-7.2 0,-6 Z" fill="url(#cherryGrad)" filter="url(#fruitShadow)" />
                    <ellipse cx="-2" cy="-2" rx="1.8" ry="2.6" transform="rotate(-25 -2 -2)" fill="#ffffff" opacity="0.85" />
                    <ellipse cx="0" cy="-6" rx="1.6" ry="0.8" fill="#450a0a" opacity="0.7" />
                  </g>
                </g>
              `;
            } else if (fruitType === 3) {
              fruitContent = `
                <g transform="translate(${slot.x}, ${slot.y + 4}) scale(${isFresh ? 1.12 : 1.0})">
                  <path d="M 0,-10 L 0,-15" stroke="#78350f" stroke-width="1.8" stroke-linecap="round" />
                  <polygon points="0,-11 1.8,-8.5 4.5,-10 2.8,-7.5 4.5,-5 1.8,-6.5 0,-4 -1.8,-6.5 -4.5,-5 -2.8,-7.5 -4.5,-10 -1.8,-8.5" fill="#15803d" />
                  <path d="M 0,-13 C 5,-17 10,-14 11,-10 C 8,-9 4,-11 0,-13 Z" fill="#22c55e" stroke="#16a34a" stroke-width="0.5" />
                  <ellipse cx="0" cy="0" rx="11.5" ry="11" fill="url(#orangeGrad)" filter="url(#fruitShadow)" />
                  <ellipse cx="-3.5" cy="-3.5" rx="5" ry="3.5" fill="#fef08a" opacity="0.45" />
                  <circle cx="-3.8" cy="-4" r="1.8" fill="#ffffff" opacity="0.85" />
                </g>
              `;
            } else {
              fruitContent = `
                <g transform="translate(${slot.x}, ${slot.y + 4}) scale(${isFresh ? 1.12 : 1.0})">
                  <path d="M 0,-10 C 1,-14 3,-16 5,-17" fill="none" stroke="#581c87" stroke-width="1.8" stroke-linecap="round" />
                  <path d="M 1,-12 C 4,-16 9,-14 10,-11 C 7,-10 4,-11 1,-12 Z" fill="#4ade80" stroke="#15803d" stroke-width="0.5" />
                  <path d="M 0,-10 C 5,-11.5 11,-4 10.5,4 C 10,12 3.5,15 0,15.5 C -3.5,15 -10,12 -10.5,4 C -11,-4 -5,-11.5 0,-10 Z" fill="url(#plumGrad)" filter="url(#fruitShadow)" />
                  <ellipse cx="-3" cy="-1.5" rx="4.5" ry="6" fill="#c084fc" opacity="0.35" />
                  <ellipse cx="-3.5" cy="-4.5" rx="2" ry="3" transform="rotate(-15 -3.5 -4.5)" fill="#ffffff" opacity="0.75" />
                </g>
              `;
            }

            return `
              <g
                class="fruit-orb ${isFresh ? 'fruit-fresh' : ''}"
                onclick="${clickAction}"
              >
                ${isFresh ? `
                  <circle cx="${slot.x}" cy="${slot.y + 4}" r="24" fill="#fbbf24" opacity="0.4" filter="url(#fruitGlow)" />
                ` : ''}
                <!-- Natural woody branch twig connecting fruit to tree branch -->
                <path
                  d="M ${slot.bx ?? slot.x},${slot.by ?? (slot.y - 24)} Q ${((slot.bx ?? slot.x) + slot.x) / 2 + (slot.x >= (slot.bx ?? slot.x) ? 3 : -3)},${((slot.by ?? (slot.y - 24)) + slot.y) / 2 - 2} ${slot.x},${slot.y - (fruitType === 2 ? 14 : 9)}"
                  fill="none"
                  stroke="#2e2242"
                  stroke-width="2.2"
                  stroke-linecap="round"
                />
                <ellipse
                  cx="${((slot.bx ?? slot.x) + slot.x) / 2 + (slot.x >= (slot.bx ?? slot.x) ? 3 : -3)}"
                  cy="${((slot.by ?? (slot.y - 24)) + slot.y) / 2 - 2}"
                  rx="4.5"
                  ry="2.2"
                  transform="rotate(${slot.x >= (slot.bx ?? slot.x) ? 30 : -30} ${((slot.bx ?? slot.x) + slot.x) / 2 + (slot.x >= (slot.bx ?? slot.x) ? 3 : -3)} ${((slot.by ?? (slot.y - 24)) + slot.y) / 2 - 2})"
                  fill="#22c55e"
                  stroke="#15803d"
                  stroke-width="0.5"
                  opacity="0.9"
                />
                ${fruitContent}
              </g>
            `;
          }).join('')}
        </g>
      `;
    }).join('')}

    <!-- 14. Botanical Friend Flowers (organic nature elements growing from branches) -->
    ${tree.limbs.map((limb, li) => {
      const f = limb.friend;
      const isWilting = f.health === 'wilting';
      const isDormant = f.health === 'dormant';
      const isThriving = f.health === 'thriving';
      const dim = isDormant ? 0.6 : 1;
      const hidden =
        (filter === 'stories' && !f.unseenCount) ||
        (filter === 'water' && !isWilting && !isDormant);
      const opacity = (hidden ? 0.18 : 1) * dim;

      // Flower center is at limb.card (collision-avoidance already resolved)
      const cx = limb.card.x;
      const cy = limb.card.y;

      // Petal count driven by streak
      const petalCount = isDormant ? 0 : f.streak >= 14 ? 12 : f.streak >= 7 ? 8 : 5;
      const petalFill = isThriving ? 'url(#petalThriving)' : f.health === 'steady' ? 'url(#petalSteady)' : 'url(#petalWilting)';
      const pistilR = isDormant ? 8 : 12;

      // Stem: organic curved path from branch tip to flower center
      const stemMidX = (limb.tip.x + cx) / 2 + (li % 2 === 0 ? 4 : -4);
      const stemMidY = (limb.tip.y + cy) / 2 - 6;

      // Generate petals as ellipses rotated evenly around center
      const petals = [];
      for (let p = 0; p < petalCount; p++) {
        const angle = (360 / petalCount) * p;
        // Wilting: droop petals downward by 25°
        const droopExtra = isWilting ? 25 : 0;
        const petalLen = isThriving ? 18 : f.health === 'steady' ? 14 : 12;
        const petalWidth = isThriving ? 8.5 : f.health === 'steady' ? 7 : 6;
        // Steady buds: petals closer together (half-open)
        const spreadFactor = f.health === 'steady' ? 0.65 : 1;
        petals.push({ angle: angle + droopExtra, len: petalLen * spreadFactor, w: petalWidth });
      }

      // Stem leaves: 2 tiny leaves along the stem
      const stemAngle = Math.atan2(cy - limb.tip.y, cx - limb.tip.x);
      const stemLeaves = isDormant ? [] : [0.3, 0.6].map((t, k) => ({
        x: limb.tip.x + (cx - limb.tip.x) * t,
        y: limb.tip.y + (cy - limb.tip.y) * t,
        side: k % 2 === 0 ? 1 : -1,
      }));

      // Unread pollen particles
      const pollenCount = f.unread && !hidden ? Math.min(f.unread, 5) : 0;

      return `
        <g opacity="${opacity}">
          <!-- Organic Stem from branch tip to flower -->
          <path
            d="M ${limb.tip.x},${limb.tip.y} Q ${stemMidX},${stemMidY} ${cx},${cy}"
            fill="none" stroke="url(#stemGrad)" stroke-width="${isDormant ? '2' : '2.8'}" stroke-linecap="round"
          />

          <!-- Stem Leaves -->
          ${stemLeaves.map(sl => `
            <g transform="translate(${sl.x}, ${sl.y}) rotate(${sl.side * 35 + (stemAngle * 180 / Math.PI)}) scale(0.5)">
              <path d="M 0,-10 C 4.5,-5 3.5,5 0,9 C -3.5,5 -4.5,-5 0,-10 Z" fill="${isThriving ? '#4ade80' : f.health === 'steady' ? '#2dd4bf' : '#d97706'}" opacity="0.85" />
              <line x1="0" y1="-7" x2="0" y2="7" stroke="#ffffff" stroke-width="0.5" opacity="0.35" />
            </g>
          `).join('')}

          <!-- Flower Group -->
          <g
            class="grove-flower ${isThriving ? 'flower-thriving' : ''}"
            onclick="emitGroveEvent('selectFriend', { id: '${f.id}' })"
            filter="url(#flowerShadow)"
            style="transform-origin: ${cx}px ${cy}px;"
          >
            ${isDormant ? `
              <!-- Dormant: bare stem with seed pod -->
              <circle cx="${cx}" cy="${cy}" r="10" fill="#475569" opacity="0.7" />
              <circle cx="${cx}" cy="${cy}" r="7" fill="#334155" stroke="#64748b" stroke-width="0.8" />
              <text
                x="${cx}" y="${cy + 0.5}"
                text-anchor="middle" dominant-baseline="central"
                fill="#94a3b8" font-size="8" font-weight="800" letter-spacing="0.5"
                font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              >
                ${initials(f.name)}
              </text>
            ` : `
              <!-- Petals -->
              ${petals.map(p => {
                const rad = (p.angle * Math.PI) / 180;
                const px = cx + Math.cos(rad) * p.len * 0.45;
                const py = cy + Math.sin(rad) * p.len * 0.45;
                return `
                  <ellipse
                    cx="${px}" cy="${py}"
                    rx="${p.w}" ry="${p.len * 0.65}"
                    transform="rotate(${p.angle} ${px} ${py})"
                    fill="${petalFill}" opacity="0.92"
                    stroke="${isThriving ? '#be185d' : f.health === 'steady' ? '#0e7490' : '#92400e'}" stroke-width="0.5"
                  />
                `;
              }).join('')}

              ${isThriving ? `
                <!-- Stamens (thriving only) -->
                ${[0, 72, 144, 216, 288].map(deg => {
                  const rad = (deg * Math.PI) / 180;
                  const sx = cx + Math.cos(rad) * 6;
                  const sy = cy + Math.sin(rad) * 6;
                  const ex = cx + Math.cos(rad) * 16;
                  const ey = cy + Math.sin(rad) * 16;
                  return `
                    <line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#fde047" stroke-width="1" opacity="0.7" />
                    <circle cx="${ex}" cy="${ey}" r="1.8" fill="#fef08a" opacity="0.9" />
                  `;
                }).join('')}
              ` : ''}

              <!-- Pistil (center) with initials -->
              <circle cx="${cx}" cy="${cy}" r="${pistilR + 1}" fill="${HEALTH[f.health].tip}" opacity="0.25" />
              <circle cx="${cx}" cy="${cy}" r="${pistilR}" fill="url(#pistilGrad)" stroke="#a16207" stroke-width="0.6" />
              <text
                x="${cx}" y="${cy + 0.5}"
                text-anchor="middle" dominant-baseline="central"
                fill="#78350f" font-size="11" font-weight="900" letter-spacing="0.8"
                font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              >
                ${initials(f.name)}
              </text>
            `}

            <!-- Name Leaf Tag -->
            <g transform="translate(${cx}, ${cy + (isDormant ? 16 : pistilR + 14)})">
              <path
                d="M -22,0 C -18,-7 -6,-9 0,-9 C 6,-9 18,-7 22,0 C 18,7 6,9 0,9 C -6,9 -18,7 -22,0 Z"
                fill="#052e16" opacity="0.78"
              />
              <text
                x="0" y="0.5"
                text-anchor="middle" dominant-baseline="central"
                fill="#bbf7d0" font-size="8.5" font-weight="700"
                font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              >
                ${f.name.split(' ')[0]}
              </text>
            </g>
          </g>

          <!-- Unread Pollen Particles -->
          ${pollenCount > 0 ? Array.from({ length: pollenCount }, (_, pi) => {
            const pAngle = (360 / pollenCount) * pi;
            const pRad = (pAngle * Math.PI) / 180;
            const pDist = (isDormant ? 14 : pistilR + 8) + pi * 3;
            const px = cx + Math.cos(pRad) * pDist;
            const py = cy + Math.sin(pRad) * pDist;
            return `
              <g style="animation: pollenFloat ${2.2 + pi * 0.4}s ease-in-out infinite; animation-delay: ${pi * 0.5}s;" filter="url(#pollenGlow)">
                <circle cx="${px}" cy="${py}" r="3" fill="#fef08a" opacity="0.85" />
                <circle cx="${px}" cy="${py}" r="1.4" fill="#ffffff" opacity="0.95" />
              </g>
            `;
          }).join('') : ''}
        </g>
      `;
    }).join('')}

    <!-- 15. Crown Golden Lotus ("You"): organic replacement for crown card -->
    <g transform="translate(${safeCrownX + 33}, ${safeCrownY + 40})">
      <g
        class="golden-lotus"
        onclick="emitGroveEvent('post')"
      >
        <!-- Outer glow aura -->
        <circle cx="0" cy="0" r="36" fill="#fef08a" opacity="0.12" />
        <circle cx="0" cy="0" r="28" fill="#f59e0b" opacity="0.08" />

        <!-- Lotus petals: 8 golden petals in two layers -->
        <!-- Outer layer (larger, slightly transparent) -->
        ${[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
          const rad = (deg * Math.PI) / 180;
          const px = Math.cos(rad) * 10;
          const py = Math.sin(rad) * 10;
          return `
            <ellipse
              cx="${px}" cy="${py}"
              rx="9" ry="17"
              transform="rotate(${deg} ${px} ${py})"
              fill="url(#lotusGrad)" opacity="0.75"
              stroke="#d97706" stroke-width="0.4"
            />
          `;
        }).join('')}

        <!-- Inner layer (smaller, brighter, offset 22.5°) -->
        ${[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(deg => {
          const rad = (deg * Math.PI) / 180;
          const px = Math.cos(rad) * 6;
          const py = Math.sin(rad) * 6;
          return `
            <ellipse
              cx="${px}" cy="${py}"
              rx="7" ry="13"
              transform="rotate(${deg} ${px} ${py})"
              fill="url(#lotusGrad)" opacity="0.9"
              stroke="#b45309" stroke-width="0.3"
            />
          `;
        }).join('')}

        <!-- Lotus center -->
        <circle cx="0" cy="0" r="13" fill="url(#pistilGrad)" stroke="#a16207" stroke-width="0.8" />
        <circle cx="0" cy="0" r="10" fill="#fef9c3" opacity="0.45" />
        <text
          x="0" y="0.5"
          text-anchor="middle" dominant-baseline="central"
          fill="#78350f" font-size="13" font-weight="900"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >
          You
        </text>

        <!-- "+ Post" glowing text below -->
        <text
          x="0" y="30"
          text-anchor="middle"
          fill="#fde047" font-size="10" font-weight="800"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          filter="url(#pollenGlow)"
        >
          + Post
        </text>
      </g>
    </g>

    <!-- Edge Blending Vignette Overlays (Softens all 4 boundaries seamlessly into background) -->
    <!-- Top Edge Blend -->
    <rect x="-100" y="100" width="1000" height="150" fill="url(#edgeFadeTop)" pointer-events="none" />

    <!-- Bottom Edge Blend -->
    <rect x="-100" y="820" width="1000" height="150" fill="url(#edgeFadeBottom)" pointer-events="none" />

    <!-- Left Edge Blend -->
    <rect x="40" y="100" width="80" height="870" fill="url(#edgeFadeLeft)" pointer-events="none" />

    <!-- Right Edge Blend -->
    <rect x="670" y="100" width="90" height="870" fill="url(#edgeFadeRight)" pointer-events="none" />
  </svg>
</body>
</html>`;
}
