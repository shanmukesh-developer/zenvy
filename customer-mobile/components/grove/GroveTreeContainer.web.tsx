import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
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

type Props = {
  friends: Friend[];
  seedKey: string;
  tod?: 'night' | 'day' | 'dawn' | 'dusk' | 'auto';
  filter?: 'all' | 'stories' | 'water' | 'bonds';
  showBonds?: boolean;
  isRaining?: boolean;
  onSelectFriend?: (id: string) => void;
  onOpenStory?: (fid: string, sid: string) => void;
  onPost?: () => void;
};

const TREE_W = 800;
const TREE_H = 1000;

export default function GroveTreeContainer({
  friends,
  seedKey,
  tod = 'night',
  filter = 'all',
  showBonds = false,
  isRaining = false,
  onSelectFriend,
  onOpenStory,
  onPost,
}: Props) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [containerDim, setContainerDim] = useState({
    width: winWidth || 500,
    height: winHeight || 700,
  });

  const onLayoutRoot = useCallback((e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 20 && height > 20) {
      setContainerDim({ width, height });
    }
  }, []);

  const { viewBox, viewW, viewH, vx, vy, vw, vh } = useMemo(() => {
    const w = containerDim.width;
    const h = containerDim.height;
    const aspect = Math.max(0.35, Math.min(3.0, w / h));

    // The tree spans roughly x: 80 to 720 (width 640), and y: 130 to 980 (height 850).
    // Tree center is at x = 400. Ground baseline is at y = 980.
    let vw: number;
    let vh: number;
    let vx: number;
    let vy: number;

    const baseTreeH = 860; // from y=120 to y=980
    const minTreeW = 750;  // to fit entire canopy comfortably with zero edge clipping

    if (baseTreeH * aspect < minTreeW) {
      // Narrow portrait screen (like phone)
      vw = minTreeW;
      vh = vw / aspect;
      vx = 400 - vw / 2;
      vy = 985 - vh; // Ground anchored at 985
    } else {
      // Wider screen (tablet, desktop web view, etc.)
      vh = baseTreeH;
      vw = vh * aspect;
      vx = 400 - vw / 2;
      vy = 120;
    }

    return {
      viewBox: `${Math.round(vx)} ${Math.round(vy)} ${Math.round(vw)} ${Math.round(vh)}`,
      viewW: vw,
      viewH: vh,
      vx,
      vy,
      vw,
      vh,
    };
  }, [containerDim]);

  const tree = useMemo<Tree>(
    () => buildTree(friends, seedKey, TREE_W, TREE_H),
    [friends, seedKey]
  );

  const [activeRain, setActiveRain] = useState(isRaining);

  useEffect(() => {
    setActiveRain(isRaining);
  }, [isRaining]);

  // Starfield for night & dusk - generated across wide span to cover all screen widths
  const stars = useMemo(() => {
    const list: { x: number; y: number; r: number; opacity: number }[] = [];
    let s = 31415;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < 110; i++) {
      list.push({
        x: Math.round(-800 + rnd() * 2400),
        y: Math.round(-600 + rnd() * 1400),
        r: rnd() > 0.85 ? 1.8 : rnd() > 0.4 ? 1.2 : 0.7,
        opacity: 0.25 + rnd() * 0.7,
      });
    }
    return list;
  }, []);

  // Bioluminescent floating motes
  const fireflies = useMemo(() => {
    const list: { x: number; y: number; r: number; color: string; dur: number }[] = [];
    let s = 87654;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    const colors = ['#86efac', '#7dd3fc', '#fef08a', '#e879f9', '#6ee7b7'];
    for (let i = 0; i < 24; i++) {
      list.push({
        x: 80 + rnd() * 640,
        y: 180 + rnd() * 660,
        r: 1.8 + rnd() * 1.6,
        color: colors[Math.floor(rnd() * colors.length)],
        dur: 3.2 + rnd() * 4,
      });
    }
    return list;
  }, []);

  // Falling blossom petals
  const driftingPetals = useMemo(() => {
    const list: { x: number; startY: number; scale: number; rot: number; delay: number; dur: number }[] = [];
    let s = 45912;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < 14; i++) {
      list.push({
        x: 120 + rnd() * 560,
        startY: 150 + rnd() * 400,
        scale: 0.6 + rnd() * 0.7,
        rot: rnd() * 360,
        delay: rnd() * 5,
        dur: 6 + rnd() * 6,
      });
    }
    return list;
  }, []);

  // Raindrops for nourish mode
  const rainDrops = useMemo(() => {
    const list: { x: number; y: number; len: number; dur: number; delay: number }[] = [];
    let s = 77123;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < 55; i++) {
      list.push({
        x: Math.round(-500 + rnd() * 1800),
        y: Math.round(-300 + rnd() * 600),
        len: 20 + rnd() * 25,
        dur: 0.8 + rnd() * 0.6,
        delay: rnd() * 1.2,
      });
    }
    return list;
  }, []);

  const isNight = tod === 'night' || tod === 'auto';
  const isDay = tod === 'day';
  const isDawn = tod === 'dawn';
  const isDusk = tod === 'dusk';

  return (
    <View style={s.root} onLayout={onLayoutRoot}>
      <svg
        viewBox={viewBox}
        style={{ width: '100%', height: '100%', display: 'block' }}
        preserveAspectRatio="none"
      >
        <defs>
          {/* Edge Blending Vignette Gradients */}
          <linearGradient id="edgeFadeTopWeb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04050d" stopOpacity="1" />
            <stop offset="35%" stopColor="#04050d" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#04050d" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#04050d" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="edgeFadeBottomWeb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04050d" stopOpacity="0" />
            <stop offset="40%" stopColor="#04050d" stopOpacity="0.35" />
            <stop offset="75%" stopColor="#04050d" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#04050d" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="edgeFadeLeftWeb" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#04050d" stopOpacity="1" />
            <stop offset="45%" stopColor="#04050d" stopOpacity="0.6" />
            <stop offset="80%" stopColor="#04050d" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#04050d" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="edgeFadeRightWeb" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#04050d" stopOpacity="0" />
            <stop offset="20%" stopColor="#04050d" stopOpacity="0.15" />
            <stop offset="55%" stopColor="#04050d" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#04050d" stopOpacity="1" />
          </linearGradient>

          {/* Dynamic Sky Gradients */}
          {/* 1. Night Sky */}
          <radialGradient id="skyGradNight" cx="50%" cy="32%" r="80%">
            <stop offset="0%" stopColor="#1a1849" />
            <stop offset="38%" stopColor="#0d102b" />
            <stop offset="75%" stopColor="#060817" />
            <stop offset="100%" stopColor="#02030a" />
          </radialGradient>

          {/* 2. Day Sky */}
          <linearGradient id="skyGradDay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="35%" stopColor="#3b82f6" />
            <stop offset="70%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#bfdbfe" />
          </linearGradient>

          {/* 3. Dawn Sky */}
          <linearGradient id="skyGradDawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#31103f" />
            <stop offset="40%" stopColor="#581c87" />
            <stop offset="75%" stopColor="#c026d3" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>

          {/* 4. Dusk Sky */}
          <linearGradient id="skyGradDusk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="45%" stopColor="#431407" />
            <stop offset="75%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>

          {/* Sun / Moon Radiance */}
          <radialGradient id="sunGrad" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#fef08a" />
            <stop offset="70%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>

          <radialGradient id="sunAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.6" />
            <stop offset="40%" stopColor="#facc15" stopOpacity="0.25" />
            <stop offset="80%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="moonAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#e2e8f0" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="moonBody" cx="36%" cy="36%" r="64%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f1f5f9" />
            <stop offset="85%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>

          {/* Petal Gradients by Health */}
          <radialGradient id="petalThriving" cx="40%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="40%" stopColor="#ec4899" />
            <stop offset="75%" stopColor="#db2777" />
            <stop offset="100%" stopColor="#4ade80" />
          </radialGradient>
          <radialGradient id="petalSteady" cx="40%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="45%" stopColor="#0284c7" />
            <stop offset="80%" stopColor="#0369a1" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>
          <radialGradient id="petalWilting" cx="40%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </radialGradient>
          <radialGradient id="petalDormant" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>

          {/* Center Pistil Gradient */}
          <radialGradient id="pistilGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#facc15" />
            <stop offset="75%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </radialGradient>

          {/* Organic Stem Gradient */}
          <linearGradient id="stemGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="40%" stopColor="#22c55e" />
            <stop offset="80%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#3b2f52" />
          </linearGradient>

          {/* Pollen Glow & Soft Flower Shadow */}
          <filter id="pollenGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="flowerShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.5" />
          </filter>

          {/* Golden Lotus Crown Gradient */}
          <radialGradient id="lotusGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="25%" stopColor="#fde047" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="85%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </radialGradient>

          {/* Fruit Glow Filter */}
          <filter id="fruitGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Botanical Fruit Shadow */}
          <filter id="fruitShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.55" />
          </filter>

          {/* Fruit Gradients */}
          <radialGradient id="appleGrad" cx="35%" cy="25%" r="75%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="28%" stopColor="#ef4444" />
            <stop offset="65%" stopColor="#b91c1c" />
            <stop offset="100%" stopColor="#450a0a" />
          </radialGradient>
          <linearGradient id="appleBlush" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="peachGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#fb923c" />
            <stop offset="70%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#9f1239" />
          </radialGradient>
          <radialGradient id="peachBlush" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#be123c" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="cherryGrad" cx="35%" cy="25%" r="75%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="30%" stopColor="#e11d48" />
            <stop offset="70%" stopColor="#881337" />
            <stop offset="100%" stopColor="#4c0519" />
          </radialGradient>

          <radialGradient id="orangeGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="35%" stopColor="#f97316" />
            <stop offset="75%" stopColor="#c2410c" />
            <stop offset="100%" stopColor="#7c2d12" />
          </radialGradient>

          <radialGradient id="plumGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#d8b4fe" />
            <stop offset="35%" stopColor="#a855f7" />
            <stop offset="70%" stopColor="#6b21a8" />
            <stop offset="100%" stopColor="#3b0764" />
          </radialGradient>

          {/* Canopy Depth Soft Shadow */}
          <filter id="canopyShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.55 0"/>
            <feBlend in="SourceGraphic" in2="blur" mode="normal"/>
          </filter>

          {/* Realistic Bark Gradient */}
          <linearGradient id="barkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isDay ? '#5a4970' : '#554773'} />
            <stop offset="14%" stopColor={isDay ? '#423359' : '#3b2f52'} />
            <stop offset="48%" stopColor={isDay ? '#2e2242' : '#251c37'} />
            <stop offset="78%" stopColor={isDay ? '#201633' : '#191325'} />
            <stop offset="92%" stopColor={isDay ? '#33244d' : '#2c223e'} />
            <stop offset="100%" stopColor={isDay ? '#170f26' : '#100b1a'} />
          </linearGradient>

          {/* Foliage Shading Gradients */}
          <radialGradient id="foliageThriving" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="35%" stopColor="#22c55e" />
            <stop offset="75%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#052e16" />
          </radialGradient>

          <radialGradient id="foliageSteady" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="35%" stopColor="#0ea5e9" />
            <stop offset="75%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>

          <radialGradient id="foliageWilting" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="40%" stopColor="#f97316" />
            <stop offset="80%" stopColor="#c2410c" />
            <stop offset="100%" stopColor="#431407" />
          </radialGradient>

          <radialGradient id="foliageDormant" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>

          {/* Leaf Fill Gradients */}
          <linearGradient id="leafGradThriving" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bbf7d0" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
          <linearGradient id="leafGradSteady" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="leafGradWilting" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>

          {/* Ground Soil Gradient */}
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDay ? '#14532d' : '#1f253d'} />
            <stop offset="40%" stopColor={isDay ? '#052e16' : '#101424'} />
            <stop offset="100%" stopColor="#04060d" />
          </linearGradient>

          <style>{`
            @keyframes sporeFloat {
              0%, 100% { transform: translateY(0) translateX(0); opacity: 0.35; }
              50% { transform: translateY(-16px) translateX(7px); opacity: 0.85; }
            }
            @keyframes driftPetal {
              0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
              15% { opacity: 0.85; }
              85% { opacity: 0.85; }
              100% { transform: translateY(400px) translateX(60px) rotate(360deg); opacity: 0; }
            }
            @keyframes rainFall {
              0% { transform: translateY(-40px); opacity: 0; }
              20% { opacity: 0.8; }
              90% { opacity: 0.8; }
              100% { transform: translateY(800px); opacity: 0; }
            }
            @keyframes shootingStar {
              0% { transform: translateX(0) translateY(0) scale(0); opacity: 0; }
              10% { opacity: 1; transform: translateX(20px) translateY(12px) scale(1); }
              30% { transform: translateX(260px) translateY(160px) scale(1.4); opacity: 0; }
              100% { opacity: 0; }
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
            @keyframes fruitPulse {
              0%, 100% { filter: drop-shadow(0 0 6px rgba(251,191,36,0.3)); }
              50%      { filter: drop-shadow(0 0 16px rgba(251,191,36,0.85)) drop-shadow(0 0 24px rgba(245,158,11,0.5)); }
            }

            .grove-flower {
              cursor: pointer;
              transition: filter 0.2s ease, opacity 0.3s ease;
            }
            .grove-flower:hover {
              filter: drop-shadow(0 0 14px rgba(56,189,248,0.7)) drop-shadow(0 0 6px rgba(34,211,238,0.5));
            }
            .grove-flower:active {
              filter: drop-shadow(0 0 18px rgba(56,189,248,0.9));
            }
            .flower-thriving {
              animation: petalBreath 3.5s ease-in-out infinite;
              transform-origin: center;
              transform-box: fill-box;
            }
            .golden-lotus {
              cursor: pointer;
              animation: lotusGlow 4s ease-in-out infinite;
              transition: filter 0.2s ease;
            }
            .golden-lotus:hover {
              filter: drop-shadow(0 0 16px rgba(250,204,21,0.85));
            }
            .golden-lotus:active {
              filter: drop-shadow(0 0 22px rgba(250,204,21,1));
            }

            .fruit-orb {
              cursor: pointer;
              transition: filter 0.2s ease;
            }
            .fruit-orb:hover {
              filter: drop-shadow(0 0 14px rgba(251,191,36,0.95)) drop-shadow(0 0 20px rgba(245,158,11,0.6));
            }
            .fruit-orb:active {
              filter: drop-shadow(0 0 18px rgba(245,158,11,1));
            }
            .fruit-fresh {
              animation: fruitPulse 3s ease-in-out infinite;
            }
          `}</style>
        </defs>

        {/* 1. Dynamic Celestial Sky */}
        <rect
          x={-3000}
          y={-3000}
          width={6000}
          height={6000}
          fill={
            isDay
              ? 'url(#skyGradDay)'
              : isDawn
              ? 'url(#skyGradDawn)'
              : isDusk
              ? 'url(#skyGradDusk)'
              : 'url(#skyGradNight)'
          }
        />

        {/* 2. Ambient Atmosphere & Clouds */}
        {!isDay && (
          <>
            <ellipse cx={tree.baseX - 140} cy={200} rx={420} ry={160} fill="#431407" opacity={0.14} filter="blur(50px)" />
            <ellipse cx={tree.baseX + 160} cy={320} rx={400} ry={180} fill="#1e1b4b" opacity={0.35} filter="blur(45px)" />
          </>
        )}

        {/* 3. Twinkling Stars (visible in night, dusk, dawn) */}
        {!isDay &&
          stars.map((star, i) => (
            <circle
              key={'star-' + i}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#ffffff"
              opacity={isDusk || isDawn ? star.opacity * 0.45 : star.opacity}
            />
          ))}

        {/* 4. Celestial Body (Sun vs Moon) */}
        {isDay ? (
          /* Golden Sun with Luminous God Rays */
          <g transform="translate(540, 175)">
            {/* Sun Rays / Godrays */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
              <line
                key={'ray-' + deg}
                x1={0}
                y1={0}
                x2={Math.cos((deg * Math.PI) / 180) * 110}
                y2={Math.sin((deg * Math.PI) / 180) * 110}
                stroke="#fef08a"
                strokeWidth="2.5"
                opacity={0.35}
              />
            ))}
            <circle cx={0} cy={0} r={115} fill="url(#sunAura)" />
            <circle cx={0} cy={0} r={34} fill="url(#sunGrad)" />
          </g>
        ) : (
          /* Mystical Moon with Craters */
          <g transform="translate(510, 185)">
            <circle cx={0} cy={0} r={95} fill="url(#moonAura)" />
            <circle cx={0} cy={0} r={48} fill="#ffffff" opacity={0.14} />
            <circle cx={0} cy={0} r={28} fill="url(#moonBody)" />
            <circle cx={-7} cy={-6} r={6.5} fill="#94a3b8" opacity={0.25} />
            <circle cx={7} cy={7} r={5} fill="#94a3b8" opacity={0.2} />
            <circle cx={10} cy={-4} r={3.5} fill="#94a3b8" opacity={0.18} />
          </g>
        )}

        {/* 5. Cosmic Shooting Star (Night mode) */}
        {isNight && (
          <g style={{ animation: 'shootingStar 7s ease-in-out infinite', animationDelay: '2s' }}>
            <line x1={150} y1={90} x2={220} y2={135} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity={0.9} />
            <circle cx={220} cy={135} r={3} fill="#ffffff" />
          </g>
        )}

        {/* 6. Fireflies / Bioluminescent Forest Motes */}
        {!isDay &&
          fireflies.map((spore, i) => (
            <g key={'spore-' + i} style={{ animation: `sporeFloat ${spore.dur}s ease-in-out infinite` }}>
              <circle cx={spore.x} cy={spore.y} r={spore.r * 2.8} fill={spore.color} opacity={0.18} />
              <circle cx={spore.x} cy={spore.y} r={spore.r} fill={spore.color} opacity={0.85} />
            </g>
          ))}

        {/* 7. Falling Cherry Blossom Petals */}
        {driftingPetals.map((petal, i) => (
          <g
            key={'petal-fall-' + i}
            style={{
              animation: `driftPetal ${petal.dur}s ease-in-out infinite`,
              animationDelay: `${petal.delay}s`,
            }}
          >
            <path
              d={`M ${petal.x},${petal.startY} q 4,-6 8,0 q -2,8 -8,6 q -6,-2 0,-6`}
              fill="#f472b6"
              opacity={0.8}
              transform={`scale(${petal.scale}) rotate(${petal.rot} ${petal.x} ${petal.startY})`}
            />
          </g>
        ))}

        {/* 8. Rain / Nourishing Dew Shower */}
        {activeRain &&
          rainDrops.map((drop, i) => (
            <line
              key={'rain-' + i}
              x1={drop.x}
              y1={drop.y}
              x2={drop.x - 4}
              y2={drop.y + drop.len}
              stroke="#67e8f9"
              strokeWidth="1.8"
              opacity={0.75}
              style={{
                animation: `rainFall ${drop.dur}s linear infinite`,
                animationDelay: `${drop.delay}s`,
              }}
            />
          ))}

        {/* 9. Rolling Mossy Soil Hill & Grass */}
        <ellipse cx={tree.baseX} cy={tree.baseY + 45} rx={Math.max(500, viewW * 0.75)} ry={90} fill="#020409" opacity={0.8} />
        <path
          d={`M -3000,${TREE_H + 2000} L -3000,${tree.baseY - 10} Q ${tree.baseX},${tree.baseY - 24} 3000,${tree.baseY - 10} L 3000,${TREE_H + 2000} Z`}
          fill="url(#groundGrad)"
        />
        {/* Grass Blades */}
        {[-480, -400, -320, -250, -190, -130, -70, -10, 45, 110, 175, 240, 310, 380, 460, 530].map((dx, i) => (
          <path
            key={'grass-' + i}
            d={`M ${tree.baseX + dx},${tree.baseY + 4} q -5,-20 -11,-26 q 13,8 11,26 q 5,-15 7,-22 q 2,13 0,22`}
            fill={isDay ? '#22c55e' : '#166534'}
            opacity={0.7}
          />
        ))}

        {/* 10. Subterranean Root System */}
        {tree.roots.map((r, i) => (
          <path
            key={'root-' + i}
            d={outlinePath(r.pts, r.ws)}
            fill="#110d1f"
            opacity={0.92}
          />
        ))}
        {tree.flares.map((f, i) => (
          <path
            key={'flare-' + i}
            d={outlinePath(f.pts, f.ws)}
            fill="#271d3d"
            opacity={0.95}
          />
        ))}

        {/* 11. Main Ancient Tree Trunk */}
        <g>
          <path
            d={outlinePath(tree.trunkPts, tree.trunkWs)}
            fill="url(#barkGradient)"
            filter="url(#canopyShadow)"
          />

          {/* Organic Bark Ridges */}
          {tree.trunkPts.slice(2, -3).map((pt, i) => {
            if (i % 2 !== 0) return null;
            const w = tree.trunkWs[i] || 32;
            const x1 = pt.x - w * 0.32;
            const x2 = pt.x + w * 0.28;
            return (
              <g key={'bark-ridge-' + i}>
                <line
                  x1={x1}
                  y1={pt.y}
                  x2={x1 + 3}
                  y2={pt.y + 24}
                  stroke="#090611"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  opacity={0.4}
                />
                <line
                  x1={x2}
                  y1={pt.y - 2}
                  x2={x2 - 3}
                  y2={pt.y + 20}
                  stroke="#786899"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  opacity={0.45}
                />
              </g>
            );
          })}

          {/* Lenticels */}
          {tree.lenticels.map((l, i) => (
            <line
              key={'lenticel-' + i}
              x1={l.x}
              y1={l.y}
              x2={l.x + l.w}
              y2={l.y}
              stroke="#9d8eb8"
              strokeWidth={1.6}
              strokeLinecap="round"
              opacity={0.3}
            />
          ))}

          {/* Knots */}
          {tree.knots.map((k, i) => (
            <g key={'knot-' + i} transform={`rotate(${k.rot} ${k.x} ${k.y})`}>
              <ellipse cx={k.x} cy={k.y} rx={k.r} ry={k.r * 0.65} fill="#4b3f69" opacity={0.9} />
              <ellipse cx={k.x} cy={k.y} rx={k.r * 0.68} ry={k.r * 0.42} fill="#1a1428" />
              <ellipse cx={k.x - 1} cy={k.y - 1} rx={k.r * 0.34} ry={k.r * 0.22} fill="#0b0814" />
            </g>
          ))}

          {/* Stubs */}
          {tree.stubs.map((s, i) => (
            <path key={'stub-' + i} d={outlinePath(s.pts, s.ws)} fill="#201830" />
          ))}
        </g>

        {/* 12. Mutual Friend Bonds (Constellation Sap Bridges) */}
        {showBonds &&
          tree.limbs.map((limbA) => {
            const mutuals = limbA.friend.mutuals || [];
            return mutuals.map((targetId) => {
              const limbB = tree.limbs.find(l => l.friend.id === targetId);
              if (!limbB || limbA.friend.id >= targetId) return null;
              const mx = (limbA.tip.x + limbB.tip.x) / 2;
              const my = Math.min(limbA.tip.y, limbB.tip.y) - 45;
              return (
                <path
                  key={`bond-${limbA.friend.id}-${targetId}`}
                  d={`M ${limbA.tip.x},${limbA.tip.y} Q ${mx},${my} ${limbB.tip.x},${limbB.tip.y}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.6"
                  strokeDasharray="6 6"
                  opacity={0.85}
                  filter="url(#fruitGlow)"
                />
              );
            });
          })}

        {/* 13. Limbs & Volumetric Foliage Canopy Layers */}
        {tree.limbs.map((limb, li) => {
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

          return (
            <g key={'limb-' + li} opacity={opacity}>
              {/* Back Layer: Volumetric Soft Canopy Foliage Masses */}
              {!isDormant && (
                <g filter="url(#canopyShadow)" opacity={0.65}>
                  {canopyNodes.map((pt, ci) => (
                    <ellipse
                      key={`canopy-${li}-${ci}`}
                      cx={pt.x}
                      cy={pt.y - 12}
                      rx={36 + (ci % 3) * 10}
                      ry={26 + (ci % 2) * 8}
                      fill={foliageFill}
                      opacity={0.48}
                    />
                  ))}
                </g>
              )}

              {/* Branch Wooden Core */}
              {limb.segs.map((seg, si) => (
                <path
                  key={`seg-${li}-${si}`}
                  d={outlinePath(seg.pts, seg.ws)}
                  fill={isDormant ? '#28233b' : isWilting ? '#463628' : '#302644'}
                />
              ))}

              {/* Branch Joints */}
              {limb.joints.map((j, ji) => (
                <circle
                  key={`joint-${li}-${ji}`}
                  cx={j.x}
                  cy={j.y}
                  r={j.r * 0.9}
                  fill="#1f182f"
                />
              ))}

              {/* Mid Layer: Inner Foliage Puffs */}
              {!isDormant && (
                <g opacity={0.8}>
                  {canopyNodes.map((pt, ci) => (
                    <ellipse
                      key={`mid-canopy-${li}-${ci}`}
                      cx={pt.x + (ci % 2 === 0 ? 8 : -8)}
                      cy={pt.y - 16}
                      rx={24 + (ci % 2) * 8}
                      ry={16 + (ci % 2) * 6}
                      fill={foliageFill}
                      opacity={0.65}
                    />
                  ))}
                </g>
              )}

              {/* Foreground Botanical Leaves with Pointed Tips and Veins */}
              {limb.leaves.map((leaf, lei) => {
                const deg = (leaf.rot * 180) / Math.PI;
                const scale = leaf.s / 8.5;
                return (
                  <g
                    key={`leaf-${li}-${lei}`}
                    transform={`translate(${leaf.x}, ${leaf.y}) rotate(${deg}) scale(${scale})`}
                  >
                    <line x1={0} y1={-1} x2={0} y2={4} stroke="#111827" strokeWidth="0.8" />
                    {/* Botanical Almond Leaf Contour */}
                    <path
                      d="M 0,-12 C 5.5,-6 4.5,6 0,11 C -4.5,6 -5.5,-6 0,-12 Z"
                      fill={leafFill}
                      stroke="#052e16"
                      strokeWidth="0.35"
                    />
                    {/* Central Leaf Vein */}
                    <line x1={0} y1={-9} x2={0} y2={8} stroke="#ffffff" strokeWidth="0.6" opacity={0.4} />
                  </g>
                );
              })}

              {/* Blossoms */}
              {limb.blossoms.map((blossom, bi) => (
                <g key={`blossom-${li}-${bi}`} transform={`translate(${blossom.x}, ${blossom.y}) rotate(${blossom.rot * 30})`}>
                  {[0, 72, 144, 216, 288].map(deg => (
                    <circle
                      key={'petal-' + deg}
                      cx={Math.cos((deg * Math.PI) / 180) * 3.5}
                      cy={Math.sin((deg * Math.PI) / 180) * 3.5}
                      r={3.2}
                      fill="#f472b6"
                      opacity={0.94}
                    />
                  ))}
                  <circle cx={0} cy={0} r={1.8} fill="#fef08a" />
                </g>
              ))}

              {/* Story Fruit Berries */}
              {/* Orchard Fruits: Realistic apples, peaches, cherries, oranges, and plums */}
              {limb.slots.map((slot, si) => {
                const story = f.liveStories[si];
                if (!story && si > 1) return null;
                const isFresh = story && !story.seen;
                const fruitType = (li + si) % 5;
                const scale = isFresh ? 1.15 : 1.0;

                return (
                  <g
                    key={`fruit-${li}-${si}`}
                    className={`fruit-orb ${isFresh ? 'fruit-fresh' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (story) onOpenStory?.(f.id, story.id);
                      else onSelectFriend?.(f.id);
                    }}
                  >
                    {/* Golden Luminous Aura for Fresh Stories */}
                    {isFresh && (
                      <circle
                        cx={slot.x}
                        cy={slot.y + 4}
                        r={24}
                        fill="#fbbf24"
                        opacity={0.38}
                        filter="url(#fruitGlow)"
                      />
                    )}
                    {/* Natural woody branch twig connecting the fruit to the tree branch */}
                    <path
                      d={`M ${slot.bx ?? slot.x},${slot.by ?? (slot.y - 24)} Q ${((slot.bx ?? slot.x) + slot.x) / 2 + (slot.x >= (slot.bx ?? slot.x) ? 3 : -3)},${((slot.by ?? (slot.y - 24)) + slot.y) / 2 - 2} ${slot.x},${slot.y - (fruitType === 2 ? 14 : 9)}`}
                      fill="none"
                      stroke="#2e2242"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                    />
                    {/* Tiny twig sprouting leaf */}
                    <ellipse
                      cx={((slot.bx ?? slot.x) + slot.x) / 2 + (slot.x >= (slot.bx ?? slot.x) ? 3 : -3)}
                      cy={((slot.by ?? (slot.y - 24)) + slot.y) / 2 - 2}
                      rx={4.5}
                      ry={2.2}
                      transform={`rotate(${slot.x >= (slot.bx ?? slot.x) ? 30 : -30} ${((slot.bx ?? slot.x) + slot.x) / 2 + (slot.x >= (slot.bx ?? slot.x) ? 3 : -3)} ${((slot.by ?? (slot.y - 24)) + slot.y) / 2 - 2})`}
                      fill="#22c55e"
                      stroke="#15803d"
                      strokeWidth={0.5}
                      opacity={0.9}
                    />

                    {fruitType === 0 ? (
                      /* 1. Crisp Red Apple */
                      <g transform={`translate(${slot.x}, ${slot.y + 4}) scale(${scale})`}>
                        <path d="M 0,-11 C 1,-16 4,-18 7,-19" fill="none" stroke="#5c3818" strokeWidth={2} strokeLinecap="round" />
                        <path d="M 1,-13 C 6,-18 12,-16 14,-12 C 11,-10 6,-11 1,-13 Z" fill="#22c55e" stroke="#15803d" strokeWidth={0.5} />
                        <path d="M 0,-10 C 4.5,-12 13,-8 13,0 C 13,8 8,14 3.5,15 C 1.2,15.5 0.8,14 0,14 C -0.8,14 -1.2,15.5 -3.5,15 C -8,14 -13,8 -13,0 C -13,-8 -4.5,-12 0,-10 Z" fill="url(#appleGrad)" filter="url(#fruitShadow)" />
                        <ellipse cx={-3.5} cy={-2} rx={6} ry={8} fill="url(#appleBlush)" opacity={0.6} />
                        <path d="M -7,-5 C -5,-8 -2,-9 1,-8 C -1,-7 -3.5,-5.5 -4.5,-3 C -5.5,-0.5 -6,2 -7.5,1 C -8,-1 -7.8,-3.5 -7,-5 Z" fill="#ffffff" opacity={0.85} />
                        <circle cx={4} cy={5} r={1.4} fill="#ffffff" opacity={0.9} />
                        <ellipse cx={0} cy={-10} rx={2.8} ry={1.2} fill="#450a0a" opacity={0.8} />
                      </g>
                    ) : fruitType === 1 ? (
                      /* 2. Velvety Peach */
                      <g transform={`translate(${slot.x}, ${slot.y + 4}) scale(${scale})`}>
                        <path d="M 0,-10 C -1,-14 -3,-16 -6,-17" fill="none" stroke="#78350f" strokeWidth={2} strokeLinecap="round" />
                        <path d="M -1,-12 C -6,-16 -12,-14 -13,-10 C -10,-9 -5,-10 -1,-12 Z" fill="#4ade80" stroke="#16a34a" strokeWidth={0.5} />
                        <path d="M 0,-10 C 6,-12.5 13,-5 12,4 C 11,12 5,15 0,16 C -5,15 -11,12 -12,4 C -13,-5 -6,-12.5 0,-10 Z" fill="url(#peachGrad)" filter="url(#fruitShadow)" />
                        <path d="M 0,-9 C 1.8,-4 2.2,4 0,14" fill="none" stroke="#be123c" strokeWidth={1} opacity={0.5} />
                        <ellipse cx={4} cy={0} rx={5.5} ry={7} fill="url(#peachBlush)" opacity={0.7} />
                        <ellipse cx={-4.5} cy={-4} rx={2.5} ry={4} transform="rotate(-20 -4.5 -4)" fill="#ffffff" opacity={0.7} />
                      </g>
                    ) : fruitType === 2 ? (
                      /* 3. Glossy Twin Cherries */
                      <g transform={`translate(${slot.x}, ${slot.y + 4}) scale(${scale})`}>
                        <path d="M 0,-17 C -3,-12 -6,-6 -6,1" fill="none" stroke="#65a30d" strokeWidth={1.6} />
                        <path d="M 0,-17 C 3,-12 6,-5 6,4" fill="none" stroke="#4d7c0f" strokeWidth={1.6} />
                        <circle cx={0} cy={-17} r={1.8} fill="#84cc16" />
                        <path d="M 0,-17 C 5,-21 11,-19 12,-15 C 9,-14 4,-15 0,-17 Z" fill="#22c55e" stroke="#15803d" strokeWidth={0.5} />
                        <g transform="translate(-6, 1)">
                          <path d="M 0,-6 C 3,-7.2 6,-4 6,1 C 6,6 3.5,8 0,8.5 C -3.5,8 -6,6 -6,1 C -6,-4 -3,-7.2 0,-6 Z" fill="url(#cherryGrad)" filter="url(#fruitShadow)" />
                          <ellipse cx={-2} cy={-2} rx={1.8} ry={2.6} transform="rotate(-25 -2 -2)" fill="#ffffff" opacity={0.85} />
                          <ellipse cx={0} cy={-6} rx={1.6} ry={0.8} fill="#450a0a" opacity={0.7} />
                        </g>
                        <g transform="translate(6, 4)">
                          <path d="M 0,-6 C 3,-7.2 6,-4 6,1 C 6,6 3.5,8 0,8.5 C -3.5,8 -6,6 -6,1 C -6,-4 -3,-7.2 0,-6 Z" fill="url(#cherryGrad)" filter="url(#fruitShadow)" />
                          <ellipse cx={-2} cy={-2} rx={1.8} ry={2.6} transform="rotate(-25 -2 -2)" fill="#ffffff" opacity={0.85} />
                          <ellipse cx={0} cy={-6} rx={1.6} ry={0.8} fill="#450a0a" opacity={0.7} />
                        </g>
                      </g>
                    ) : fruitType === 3 ? (
                      /* 4. Sunlit Orange */
                      <g transform={`translate(${slot.x}, ${slot.y + 4}) scale(${scale})`}>
                        <path d="M 0,-10 L 0,-15" stroke="#78350f" strokeWidth={1.8} strokeLinecap="round" />
                        <polygon points="0,-11 1.8,-8.5 4.5,-10 2.8,-7.5 4.5,-5 1.8,-6.5 0,-4 -1.8,-6.5 -4.5,-5 -2.8,-7.5 -4.5,-10 -1.8,-8.5" fill="#15803d" />
                        <path d="M 0,-13 C 5,-17 10,-14 11,-10 C 8,-9 4,-11 0,-13 Z" fill="#22c55e" stroke="#16a34a" strokeWidth={0.5} />
                        <ellipse cx={0} cy={0} rx={11.5} ry={11} fill="url(#orangeGrad)" filter="url(#fruitShadow)" />
                        <ellipse cx={-3.5} cy={-3.5} rx={5} ry={3.5} fill="#fef08a" opacity={0.45} />
                        <circle cx={-3.8} cy={-4} r={1.8} fill="#ffffff" opacity={0.85} />
                      </g>
                    ) : (
                      /* 5. Sweet Purple Plum */
                      <g transform={`translate(${slot.x}, ${slot.y + 4}) scale(${scale})`}>
                        <path d="M 0,-10 C 1,-14 3,-16 5,-17" fill="none" stroke="#581c87" strokeWidth={1.8} strokeLinecap="round" />
                        <path d="M 1,-12 C 4,-16 9,-14 10,-11 C 7,-10 4,-11 1,-12 Z" fill="#4ade80" stroke="#15803d" strokeWidth={0.5} />
                        <path d="M 0,-10 C 5,-11.5 11,-4 10.5,4 C 10,12 3.5,15 0,15.5 C -3.5,15 -10,12 -10.5,4 C -11,-4 -5,-11.5 0,-10 Z" fill="url(#plumGrad)" filter="url(#fruitShadow)" />
                        <ellipse cx={-3} cy={-1.5} rx={4.5} ry={6} fill="#c084fc" opacity={0.35} />
                        <ellipse cx={-3.5} cy={-4.5} rx={2} ry={3} transform="rotate(-15 -3.5 -4.5)" fill="#ffffff" opacity={0.75} />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 14. FOREGROUND PASS: Botanical Friend Flowers (organic nature elements) */}
        {tree.limbs.map((limb, li) => {
          const f = limb.friend;
          const isWilting = f.health === 'wilting';
          const isDormant = f.health === 'dormant';
          const isThriving = f.health === 'thriving';
          const dim = isDormant ? 0.6 : 1;
          const hidden =
            (filter === 'stories' && !f.unseenCount) ||
            (filter === 'water' && !isWilting && !isDormant);
          const opacity = (hidden ? 0.18 : 1) * dim;

          const cx = limb.card.x;
          const cy = limb.card.y;

          const petalCount = isDormant ? 0 : f.streak >= 14 ? 12 : f.streak >= 7 ? 8 : 5;
          const petalFill = isThriving ? 'url(#petalThriving)' : f.health === 'steady' ? 'url(#petalSteady)' : 'url(#petalWilting)';
          const pistilR = isDormant ? 8 : 12;

          const stemMidX = (limb.tip.x + cx) / 2 + (li % 2 === 0 ? 4 : -4);
          const stemMidY = (limb.tip.y + cy) / 2 - 6;

          const petals = [];
          for (let p = 0; p < petalCount; p++) {
            const angle = (360 / petalCount) * p;
            const droopExtra = isWilting ? 25 : 0;
            const finalAngle = angle + droopExtra;
            const rotY = cy - (isDormant ? 0 : isThriving ? 14 : 12);
            petals.push(
              <ellipse
                key={'petal-' + p}
                cx={cx}
                cy={rotY}
                rx={isThriving ? 7.5 : 6.5}
                ry={isThriving ? 15 : 13}
                transform={`rotate(${finalAngle} ${cx} ${cy})`}
                fill={petalFill}
                opacity={isWilting ? 0.72 : 0.88}
                stroke={isThriving ? '#f472b6' : isWilting ? '#d97706' : '#38bdf8'}
                strokeWidth={0.5}
              />
            );
          }

          const stamens = [];
          if (isThriving) {
            for (let st = 0; st < 5; st++) {
              const stAngle = (360 / 5) * st + 36;
              const rad = (stAngle * Math.PI) / 180;
              const sx2 = cx + Math.cos(rad) * (pistilR + 5);
              const sy2 = cy + Math.sin(rad) * (pistilR + 5);
              stamens.push(
                <g key={'stamen-' + st}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={sx2}
                    y2={sy2}
                    stroke="#fde047"
                    strokeWidth={0.9}
                    opacity={0.8}
                  />
                  <circle
                    cx={sx2}
                    cy={sy2}
                    r={1.6}
                    fill="#fef08a"
                    filter="url(#pollenGlow)"
                  />
                </g>
              );
            }
          }

          const stemAngle = Math.atan2(cy - limb.tip.y, cx - limb.tip.x);
          const leaf1X = limb.tip.x + Math.cos(stemAngle) * 10;
          const leaf1Y = limb.tip.y + Math.sin(stemAngle) * 10;
          const leaf2X = limb.tip.x + Math.cos(stemAngle) * 20;
          const leaf2Y = limb.tip.y + Math.sin(stemAngle) * 20;

          const pollenCount = Math.min(f.unread ?? 0, 5);

          return (
            <g
              key={'flower-' + li}
              opacity={opacity}
              className={`grove-flower ${isThriving ? 'flower-thriving' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectFriend?.(f.id)}
            >
              {/* Organic Curved Stem */}
              <path
                d={`M ${limb.tip.x},${limb.tip.y} Q ${stemMidX},${stemMidY} ${cx},${cy}`}
                fill="none"
                stroke="url(#stemGrad)"
                strokeWidth={2.2}
                strokeLinecap="round"
              />

              {/* Stem leaves: 2 tiny leaves along the stem */}
              <ellipse
                cx={leaf1X}
                cy={leaf1Y}
                rx={4.5}
                ry={2.2}
                transform={`rotate(${(stemAngle * 180) / Math.PI + 35} ${leaf1X} ${leaf1Y})`}
                fill="#22c55e"
                opacity={0.85}
              />
              <ellipse
                cx={leaf2X}
                cy={leaf2Y}
                rx={3.8}
                ry={1.8}
                transform={`rotate(${(stemAngle * 180) / Math.PI - 40} ${leaf2X} ${leaf2Y})`}
                fill="#16a34a"
                opacity={0.85}
              />

              {/* Petals */}
              <g filter="url(#flowerShadow)">
                {petals}
              </g>

              {/* Glowing Stamens (thriving only) */}
              {stamens}

              {/* Center Pistil with Initials */}
              <circle
                cx={cx}
                cy={cy}
                r={pistilR}
                fill={isDormant ? 'url(#petalDormant)' : 'url(#pistilGrad)'}
                stroke={isDormant ? '#475569' : '#a16207'}
                strokeWidth={isDormant ? 1 : 0.8}
              />
              <circle
                cx={cx}
                cy={cy}
                r={isDormant ? 6 : pistilR - 2}
                fill={isDormant ? '#1e293b' : '#fef9c3'}
                opacity={isDormant ? 0.6 : 0.45}
              />
              <text
                x={cx}
                y={cy + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isDormant ? '#94a3b8' : '#78350f'}
                fontSize={isDormant ? 8 : 10.5}
                fontWeight="900"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                letterSpacing={0.5}
              >
                {isDormant ? '·' : initials(f.name)}
              </text>

              {/* Friend Name Tag: Pointed organic leaf label below flower */}
              <g transform={`translate(${cx}, ${cy + (isDormant ? 16 : pistilR + 14)})`}>
                <path
                  d="M -22,0 C -18,-7 -6,-9 0,-9 C 6,-9 18,-7 22,0 C 18,7 6,9 0,9 C -6,9 -18,7 -22,0 Z"
                  fill="#052e16"
                  opacity={0.82}
                />
                <text
                  x={0}
                  y={0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#bbf7d0"
                  fontSize={8.5}
                  fontWeight="700"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                >
                  {f.name.split(' ')[0]}
                </text>
              </g>

              {/* Unread Pollen Particles */}
              {pollenCount > 0 && Array.from({ length: pollenCount }, (_, pi) => {
                const pAngle = (360 / pollenCount) * pi;
                const pRad = (pAngle * Math.PI) / 180;
                const pDist = (isDormant ? 14 : pistilR + 8) + pi * 3;
                const px = cx + Math.cos(pRad) * pDist;
                const py = cy + Math.sin(pRad) * pDist;
                return (
                  <g
                    key={'pollen-' + pi}
                    style={{
                      animation: `pollenFloat ${2.2 + pi * 0.4}s ease-in-out infinite`,
                      animationDelay: `${pi * 0.5}s`,
                    }}
                    filter="url(#pollenGlow)"
                  >
                    <circle cx={px} cy={py} r={3} fill="#fef08a" opacity={0.85} />
                    <circle cx={px} cy={py} r={1.4} fill="#ffffff" opacity={0.95} />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 15. Crown Golden Lotus ("You"): organic replacement for crown card */}
        <g
          transform={`translate(${tree.crown.x}, ${tree.crown.y})`}
          className="golden-lotus"
          style={{ cursor: 'pointer' }}
          onClick={() => onPost?.()}
        >
          {/* Outer glow aura */}
          <circle cx={0} cy={0} r={36} fill="#fef08a" opacity={0.12} />
          <circle cx={0} cy={0} r={28} fill="#f59e0b" opacity={0.08} />

          {/* Lotus petals: 8 golden petals in two layers */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const px = Math.cos(rad) * 10;
            const py = Math.sin(rad) * 10;
            return (
              <ellipse
                key={'lotus-out-' + deg}
                cx={px}
                cy={py}
                rx={9}
                ry={17}
                transform={`rotate(${deg} ${px} ${py})`}
                fill="url(#lotusGrad)"
                opacity={0.75}
                stroke="#d97706"
                strokeWidth={0.4}
              />
            );
          })}

          {/* Inner layer (smaller, brighter, offset 22.5°) */}
          {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const px = Math.cos(rad) * 6;
            const py = Math.sin(rad) * 6;
            return (
              <ellipse
                key={'lotus-in-' + deg}
                cx={px}
                cy={py}
                rx={7}
                ry={13}
                transform={`rotate(${deg} ${px} ${py})`}
                fill="url(#lotusGrad)"
                opacity={0.9}
                stroke="#b45309"
                strokeWidth={0.3}
              />
            );
          })}

          {/* Lotus center */}
          <circle cx={0} cy={0} r={13} fill="url(#pistilGrad)" stroke="#a16207" strokeWidth={0.8} />
          <circle cx={0} cy={0} r={10} fill="#fef9c3" opacity={0.45} />
          <text
            x={0}
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#78350f"
            fontSize={13}
            fontWeight="900"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            You
          </text>

          {/* "+ Post" glowing text below */}
          <text
            x={0}
            y={30}
            textAnchor="middle"
            fill="#fde047"
            fontSize={10}
            fontWeight="800"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            filter="url(#pollenGlow)"
          >
            + Post
          </text>
        </g>

        {/* Edge Blending Vignette Overlays (Softens all boundaries seamlessly into surrounding canvas) */}
        {/* Top Edge Blend (seamlessly merges with header) */}
        <rect
          x={vx - 300}
          y={vy - 10}
          width={vw + 600}
          height={Math.max(135, vh * 0.18)}
          fill="url(#edgeFadeTopWeb)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Bottom Edge Blend (softens roots and ground border) */}
        <rect
          x={vx - 300}
          y={vy + vh - Math.max(90, vh * 0.14)}
          width={vw + 600}
          height={Math.max(90, vh * 0.14) + 20}
          fill="url(#edgeFadeBottomWeb)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Left Edge Blend */}
        <rect
          x={vx - 10}
          y={vy - 100}
          width={Math.max(65, vw * 0.11)}
          height={vh + 200}
          fill="url(#edgeFadeLeftWeb)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Right Edge Blend */}
        <rect
          x={vx + vw - Math.max(65, vw * 0.11)}
          y={vy - 100}
          width={Math.max(65, vw * 0.11) + 20}
          height={vh + 200}
          fill="url(#edgeFadeRightWeb)"
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: '#04050d',
  },
});
