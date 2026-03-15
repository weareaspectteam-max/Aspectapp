/**
 * ASPECT QUEST — 5 Bölümlü Platformer
 * Özgür Drone Boss · ASPECT Branding · Mobile Touch Controls
 * Procedural Audio · Photo Moment Mechanic
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, Volume2, VolumeX, Trophy, RotateCcw } from 'lucide-react';
import type { UserRole } from './login';

// ─────────────────────────── AUDIO ───────────────────────────────────────────
let _actx: AudioContext | null = null;
function getAC(): AudioContext {
  if (!_actx) _actx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _actx;
}
function tone(freq: number, dur: number, vol = 0.18, type: OscillatorType = 'square') {
  try {
    const c = getAC();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  } catch {}
}
const SFX = {
  jump:    () => { tone(280, 0.09); setTimeout(() => tone(480, 0.09), 55); },
  djump:   () => { tone(440, 0.08, 0.18, 'triangle'); setTimeout(() => tone(740, 0.1, 0.18, 'triangle'), 45); },
  collect: () => { tone(660, 0.05); setTimeout(() => tone(990, 0.07), 35); },
  star:    () => { tone(880, 0.05); setTimeout(() => tone(1100, 0.07), 30); setTimeout(() => tone(1320, 0.1), 65); },
  hit:     () => tone(130, 0.35, 0.28, 'sawtooth'),
  photo:   () => { tone(880, 0.04); setTimeout(() => tone(1240, 0.07), 32); setTimeout(() => tone(660, 0.12), 75); },
  lvlWin:  () => [350, 440, 550, 660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.18, 0.22), i * 72)),
  gameOver:() => { tone(320, 0.18, 0.25, 'sawtooth'); setTimeout(() => tone(220, 0.22, 0.25, 'sawtooth'), 200); setTimeout(() => tone(110, 0.4, 0.25, 'sawtooth'), 460); },
};

// ─────────────────────────── TYPES ───────────────────────────────────────────
interface Plat {
  x: number; y: number; w: number; h: number; col: string;
  ox?: number; oy?: number; dvx?: number; dvy?: number; range?: number; spd?: number; t?: number;
}
interface Enemy {
  id: number; x: number; y: number; w: number; h: number;
  type: 'bird' | 'drone' | 'cart' | 'boss';
  vx: number; alive: boolean; minX: number; maxX: number;
  oy: number; amp?: number; freq?: number; ph?: number;
  hitTimer?: number;
}
interface Collectable {
  id: number; x: number; y: number; w: number; h: number;
  type: 'lens' | 'frame' | 'card' | 'battery' | 'star';
  pts: number; got: boolean;
}
interface Shot { id: number; tx: number; wx: number; wy: number; active: boolean; timer: number; done: boolean; }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; maxl: number; col: string; sz: number; }
interface FloatText { x: number; y: number; text: string; life: number; col: string; }

type Screen = 'menu' | 'cut' | 'play' | 'pause' | 'lvlwin' | 'over' | 'victory';

interface GS {
  screen: Screen; lvl: number;
  px: number; py: number; pvx: number; pvy: number;
  ponG: boolean; pjumps: number; pface: number;
  lives: number; score: number; combo: number; comboT: number;
  pinv: number; pcamAnim: number; pdead: boolean; pdeadT: number;
  plats: Plat[]; enemies: Enemy[]; items: Collectable[]; shots: Shot[];
  sparks: Spark[]; floats: FloatText[];
  camX: number; t: number; levelT: number; slowMo: number; flash: number;
  cutLine: number; cutTimer: number; totalScore: number; gotCollect: number;
  levelComplete: boolean;
}

// ─────────────────────────── CONSTANTS ───────────────────────────────────────
const CW = 480, CH = 360;
const GY = 305;
const PW = 22, PH = 34;
const GRAV = 0.52, JV = -12.5, DJV = -10.5, SPD = 3.7, MAXVY = 14;

// ─────────────────────────── PLATFORM HELPERS ────────────────────────────────
const gnd  = (x: number, w: number, col = '#704214'): Plat => ({ x, y: GY, w, h: 60, col });
const plt  = (x: number, y: number, w: number, col: string): Plat => ({ x, y, w, h: 16, col });
const mplX = (ox: number, oy: number, w: number, col: string, range: number, spd = 0.03): Plat =>
  ({ x: ox, y: oy, w, h: 16, col, ox, oy, dvx: 1, dvy: 0, range, spd, t: Math.random() * 6.28 });
const mplY = (ox: number, oy: number, w: number, col: string, range: number, spd = 0.03): Plat =>
  ({ x: ox, y: oy, w, h: 16, col, ox, oy, dvx: 0, dvy: 1, range, spd, t: Math.random() * 6.28 });

// ─────────────────────────── ENEMY HELPERS ───────────────────────────────────
type EnemyDef = Omit<Enemy, 'id' | 'alive' | 'oy' | 'hitTimer'>;
const bird  = (x: number, y: number, mn: number, mx: number): EnemyDef =>
  ({ x, y, w: 28, h: 16, type: 'bird', vx: 1.2, minX: mn, maxX: mx });
const drone = (x: number, y: number, mn: number, mx: number, amp = 22): EnemyDef =>
  ({ x, y, w: 28, h: 24, type: 'drone', vx: 1.4, minX: mn, maxX: mx, amp, freq: 0.035, ph: Math.random() * 6.28 });
const cart  = (x: number, y: number, mn: number, mx: number): EnemyDef =>
  ({ x, y: y - 22, w: 34, h: 22, type: 'cart', vx: 1.3, minX: mn, maxX: mx });
const boss  = (x: number, y: number, mn: number, mx: number): EnemyDef =>
  ({ x, y, w: 72, h: 56, type: 'boss', vx: 1.8, minX: mn, maxX: mx, amp: 85, freq: 0.022, ph: 0 });

// ─────────────────────────── COLLECTIBLE HELPERS ─────────────────────────────
type CollDef = Omit<Collectable, 'id' | 'got'>;
const itm = (x: number, y: number, type: Collectable['type'], pts: number): CollDef =>
  ({ x, y, w: 18, h: 18, type, pts });

// ─────────────────────────── LEVEL DATA ──────────────────────────────────────
const W1 = '#8B6914', M1 = '#1e4a72', S1 = '#4a3a6a', R1 = '#1a5c1a';

interface LevelDef {
  name: string; ww: number; fx: number;
  bg1: string; bg2: string; gc: string; acc: string;
  plats: Plat[];
  enemies: EnemyDef[];
  items: CollDef[];
  shots: { tx: number; wx: number; wy: number }[];
  msg: string[];
  rain?: boolean; neon?: boolean; pixel?: boolean;
}

const LEVELS: LevelDef[] = [
  // ── LEVEL 1: Altın Saat Plajı ────────────────────────────────────────────
  {
    name: 'Altın Saat Plajı', ww: 4300, fx: 4060,
    bg1: '#FF7043', bg2: '#FFB74D', gc: '#C2824A', acc: '#FFE082',
    plats: [
      gnd(0, 490), gnd(560, 360), gnd(1000, 390), gnd(1480, 420), gnd(1990, 480),
      gnd(2580, 320), gnd(3000, 380), gnd(3470, 620),
      plt(160, 268, 85, W1), plt(300, 232, 76, W1), plt(450, 272, 82, W1),
      plt(610, 245, 80, W1), plt(770, 210, 76, W1), plt(920, 265, 82, W1),
      plt(1070, 250, 80, W1), plt(1220, 218, 76, W1), plt(1370, 272, 82, W1),
      plt(1550, 240, 80, W1), plt(1710, 208, 76, W1), plt(1870, 265, 82, W1),
      plt(2060, 250, 80, W1), plt(2230, 215, 76, W1), plt(2420, 265, 80, W1),
      plt(2640, 255, 82, W1), plt(2800, 220, 76, W1), plt(2970, 265, 80, W1),
      plt(3160, 240, 82, W1), plt(3330, 208, 76, W1), plt(3510, 265, 80, W1),
      plt(3690, 240, 80, W1), plt(3860, 215, 80, W1),
    ],
    enemies: [
      bird(250, 248, 160, 390), bird(630, 225, 540, 740), bird(960, 245, 870, 1060),
      bird(1460, 250, 1370, 1620), bird(1960, 244, 1860, 2110),
      bird(2650, 235, 2540, 2800), bird(3170, 220, 3070, 3330),
      bird(3670, 245, 3570, 3810),
    ],
    items: [
      itm(180, 243, 'lens', 50), itm(320, 207, 'frame', 75), itm(470, 247, 'card', 100),
      itm(630, 220, 'battery', 60), itm(790, 185, 'star', 300), itm(940, 240, 'lens', 50),
      itm(1090, 225, 'frame', 75), itm(1240, 193, 'card', 100), itm(1390, 247, 'battery', 60),
      itm(1570, 215, 'lens', 50), itm(1730, 183, 'star', 300), itm(1890, 240, 'frame', 75),
      itm(2080, 225, 'card', 100), itm(2250, 190, 'battery', 60), itm(2440, 240, 'lens', 50),
      itm(2660, 230, 'card', 100), itm(2820, 195, 'star', 300), itm(2990, 240, 'lens', 50),
    ],
    shots: [
      { tx: 600, wx: 730, wy: 228 },
      { tx: 1850, wx: 1980, wy: 213 },
      { tx: 3100, wx: 3230, wy: 223 },
    ],
    msg: ['Hoş geldin, ASPECT şampiyonu! 📸', 'Plajda güzel çekimler seni bekliyor.', 'Hareket et, zıpla, fotoğraf yakala!', 'Hadi başlayalım!'],
  },

  // ── LEVEL 2: Gece Şehri ───────────────────────────────────────────────────
  {
    name: 'Gece Şehri', ww: 4700, fx: 4460,
    bg1: '#0D0D2B', bg2: '#1A1A4F', gc: '#0D0D1A', acc: '#00E5FF',
    neon: true,
    plats: [
      gnd(0, 310, '#0D0D1A'), gnd(400, 190, '#0D0D1A'), gnd(690, 200, '#0D0D1A'),
      gnd(1000, 190, '#0D0D1A'), gnd(1310, 220, '#0D0D1A'), gnd(1650, 200, '#0D0D1A'),
      gnd(1970, 190, '#0D0D1A'), gnd(2280, 200, '#0D0D1A'), gnd(2640, 190, '#0D0D1A'),
      gnd(2980, 220, '#0D0D1A'), gnd(3330, 190, '#0D0D1A'), gnd(3680, 220, '#0D0D1A'),
      gnd(4070, 540, '#0D0D1A'),
      plt(80, 215, 90, M1), plt(215, 175, 82, M1), plt(380, 220, 86, M1),
      plt(530, 180, 80, M1), plt(710, 215, 86, M1), plt(855, 170, 80, M1),
      plt(1020, 215, 90, M1), plt(1165, 165, 80, M1), plt(1335, 215, 82, M1),
      plt(1480, 170, 80, M1), plt(1680, 215, 86, M1), plt(1840, 165, 80, M1),
      plt(2010, 215, 80, M1), plt(2155, 165, 80, M1), plt(2320, 215, 86, M1),
      plt(2490, 170, 80, M1), plt(2680, 215, 80, M1), plt(2820, 165, 80, M1),
      plt(3010, 215, 86, M1), plt(3180, 165, 80, M1), plt(3400, 215, 80, M1),
      plt(3550, 170, 80, M1), plt(3720, 215, 86, M1), plt(3880, 165, 80, M1),
      plt(4110, 215, 80, M1),
      mplX(1590, 250, 76, M1, 100), mplX(2960, 195, 76, M1, 130),
    ],
    enemies: [
      drone(150, 195, 80, 290, 20), drone(490, 180, 380, 620, 25),
      drone(820, 165, 710, 970, 22), cart(1070, GY, 1000, 1300),
      drone(1420, 195, 1310, 1560, 28), drone(1740, 165, 1650, 1960, 25),
      cart(2140, GY, 1970, 2270), drone(2400, 195, 2280, 2630, 20),
      drone(2770, 165, 2640, 2970, 28), drone(3090, 195, 2980, 3320, 22),
      cart(3510, GY, 3330, 3670), drone(3780, 165, 3680, 4060, 25),
    ],
    items: [
      itm(100, 190, 'lens', 50), itm(235, 150, 'star', 300), itm(400, 195, 'card', 100),
      itm(550, 155, 'frame', 75), itm(730, 190, 'battery', 60), itm(875, 145, 'star', 300),
      itm(1040, 190, 'lens', 50), itm(1185, 140, 'card', 100), itm(1355, 190, 'frame', 75),
      itm(1500, 145, 'battery', 60), itm(1700, 190, 'lens', 50), itm(1860, 140, 'star', 300),
      itm(2030, 190, 'card', 100), itm(2175, 140, 'frame', 75), itm(2340, 190, 'lens', 50),
      itm(2510, 145, 'battery', 60), itm(2700, 190, 'star', 300), itm(2840, 140, 'card', 100),
      itm(3030, 190, 'lens', 50), itm(3200, 140, 'frame', 75),
    ],
    shots: [
      { tx: 520, wx: 660, wy: 183 },
      { tx: 1760, wx: 1900, wy: 168 },
      { tx: 3380, wx: 3520, wy: 178 },
    ],
    msg: ['Gece şehri seni bekliyor! 🌃', 'Neon ışıklar aldatıcı olabilir...', 'Çatı atlamalarına dikkat et!', 'Drone\'lar başladı — hazır mısın?'],
  },

  // ── LEVEL 3: Festival Sahnesi ─────────────────────────────────────────────
  {
    name: 'Festival Sahnesi', ww: 4900, fx: 4660,
    bg1: '#1a0033', bg2: '#3d0066', gc: '#220033', acc: '#FF00FF',
    plats: [
      gnd(0, 360, '#220033'), gnd(460, 190, '#220033'), gnd(760, 195, '#220033'),
      gnd(1080, 190, '#220033'), gnd(1400, 200, '#220033'), gnd(1730, 190, '#220033'),
      gnd(2090, 195, '#220033'), gnd(2450, 200, '#220033'), gnd(2820, 190, '#220033'),
      gnd(3210, 200, '#220033'), gnd(3620, 190, '#220033'), gnd(4060, 200, '#220033'),
      gnd(4290, 620, '#220033'),
      plt(80, 270, 90, S1), plt(230, 230, 80, S1), plt(390, 272, 86, S1),
      plt(550, 228, 80, S1), plt(720, 268, 86, S1), plt(880, 218, 80, S1),
      plt(1060, 268, 86, S1), plt(1225, 196, 80, S1), plt(1390, 268, 86, S1),
      plt(1570, 222, 80, S1), plt(1750, 268, 86, S1), plt(1920, 188, 80, S1),
      plt(2110, 265, 86, S1), plt(2310, 222, 80, S1), plt(2520, 268, 86, S1),
      plt(2700, 196, 80, S1), plt(2910, 268, 86, S1), plt(3100, 188, 80, S1),
      plt(3310, 265, 86, S1), plt(3520, 218, 80, S1), plt(3730, 268, 86, S1),
      plt(3950, 196, 80, S1), plt(4150, 268, 80, S1),
      mplX(1680, 278, 72, S1, 120), mplX(2900, 248, 72, S1, 140),
      mplY(3570, 228, 72, S1, 68),
    ],
    enemies: [
      drone(180, 250, 80, 370, 20), drone(560, 228, 450, 690, 25),
      cart(920, GY, 760, 1070), drone(1200, 196, 1080, 1390, 28),
      drone(1560, 222, 1400, 1720, 22), cart(1990, GY, 1730, 2080),
      drone(2280, 222, 2090, 2440, 30), drone(2700, 196, 2450, 2810, 25),
      cart(3110, GY, 2820, 3200), drone(3400, 188, 3210, 3610, 28),
      drone(3810, 218, 3620, 4050), cart(4190, GY, 4060, 4280),
    ],
    items: [
      itm(100, 245, 'battery', 60), itm(250, 205, 'lens', 50), itm(410, 247, 'star', 300),
      itm(570, 203, 'card', 100), itm(740, 243, 'frame', 75), itm(900, 193, 'battery', 60),
      itm(1080, 243, 'lens', 50), itm(1245, 171, 'star', 300), itm(1410, 243, 'card', 100),
      itm(1590, 197, 'frame', 75), itm(1770, 243, 'battery', 60), itm(1940, 163, 'star', 300),
      itm(2130, 240, 'lens', 50), itm(2330, 197, 'card', 100), itm(2540, 243, 'frame', 75),
      itm(2720, 171, 'battery', 60), itm(2930, 243, 'star', 300), itm(3120, 163, 'card', 100),
      itm(3330, 240, 'lens', 50), itm(3540, 193, 'star', 300),
    ],
    shots: [
      { tx: 470, wx: 610, wy: 232 },
      { tx: 1650, wx: 1790, wy: 212 },
      { tx: 3020, wx: 3160, wy: 202 },
      { tx: 4100, wx: 4240, wy: 248 },
    ],
    msg: ['Festival zamanı! 🎵', 'Işıklar seni yanıltmasın...', 'Hareketli platformlar var!', 'Kamera anları daha sık gelecek!'],
  },

  // ── LEVEL 4: Fırtına Limanı ───────────────────────────────────────────────
  {
    name: 'Fırtına Limanı', ww: 5100, fx: 4870,
    bg1: '#0a0a12', bg2: '#1a1a28', gc: '#1a1a2a', acc: '#4FC3F7',
    rain: true,
    plats: [
      gnd(0, 250, '#1a1a2a'), gnd(350, 160, '#1a1a2a'), gnd(630, 158, '#1a1a2a'),
      gnd(920, 162, '#1a1a2a'), gnd(1220, 185, '#1a1a2a'), gnd(1560, 158, '#1a1a2a'),
      gnd(1870, 155, '#1a1a2a'), gnd(2200, 165, '#1a1a2a'), gnd(2570, 158, '#1a1a2a'),
      gnd(2940, 162, '#1a1a2a'), gnd(3310, 158, '#1a1a2a'), gnd(3700, 165, '#1a1a2a'),
      gnd(4090, 158, '#1a1a2a'), gnd(4580, 640, '#1a1a2a'),
      plt(70, 258, 92, M1), plt(215, 212, 82, M1), plt(370, 258, 86, M1),
      plt(530, 210, 82, M1), plt(700, 258, 86, M1), plt(860, 203, 82, M1),
      plt(1040, 258, 92, M1), plt(1210, 186, 82, M1), plt(1400, 258, 86, M1),
      plt(1590, 204, 82, M1), plt(1780, 258, 86, M1), plt(1960, 190, 82, M1),
      plt(2150, 258, 86, M1), plt(2340, 186, 82, M1), plt(2550, 258, 86, M1),
      plt(2730, 202, 82, M1), plt(2940, 258, 86, M1), plt(3140, 186, 82, M1),
      plt(3380, 258, 86, M1), plt(3580, 196, 82, M1), plt(3820, 258, 86, M1),
      plt(4030, 196, 82, M1), plt(4310, 258, 80, M1),
      mplX(1510, 268, 72, M1, 100), mplX(2650, 230, 72, M1, 130),
      mplY(3280, 220, 72, M1, 76), mplX(4170, 228, 72, M1, 150),
    ],
    enemies: [
      drone(190, 212, 70, 330, 22), cart(520, GY, 350, 620),
      drone(720, 203, 630, 910, 25), drone(920, 186, 920, 1210, 28),
      cart(1340, GY, 1220, 1550), drone(1650, 204, 1560, 1860, 22),
      drone(1900, 190, 1870, 2190, 30), cart(2290, GY, 2200, 2560),
      drone(2620, 202, 2570, 2930, 25), drone(3040, 186, 2940, 3300, 28),
      cart(3420, GY, 3310, 3690), drone(3700, 196, 3700, 4080, 22),
      drone(4200, 196, 4090, 4570, 30),
    ],
    items: [
      itm(90, 233, 'battery', 60), itm(235, 187, 'frame', 75), itm(390, 233, 'card', 100),
      itm(550, 185, 'star', 300), itm(720, 233, 'lens', 50), itm(880, 178, 'battery', 60),
      itm(1060, 233, 'card', 100), itm(1230, 161, 'star', 300), itm(1420, 233, 'frame', 75),
      itm(1610, 179, 'lens', 50), itm(1800, 233, 'battery', 60), itm(1980, 165, 'star', 300),
      itm(2170, 233, 'card', 100), itm(2360, 161, 'frame', 75), itm(2570, 233, 'lens', 50),
      itm(2750, 177, 'battery', 60), itm(2960, 233, 'star', 300), itm(3160, 161, 'card', 100),
      itm(3400, 233, 'frame', 75), itm(3600, 171, 'star', 300), itm(3840, 233, 'lens', 50),
    ],
    shots: [
      { tx: 520, wx: 660, wy: 205 },
      { tx: 1690, wx: 1830, wy: 192 },
      { tx: 3100, wx: 3240, wy: 186 },
      { tx: 4380, wx: 4520, wy: 198 },
    ],
    msg: ['Fırtına geliyor... 🌩️', 'Bu bölüm gerçekten zor.', 'Düşen kasalara dikkat et!', '5. bölüme hazır mısın?... Ben de hazırım. 😈'],
  },

  // ── LEVEL 5: Retro ASPECT Dünyası ────────────────────────────────────────
  {
    name: 'Retro ASPECT Dünyası', ww: 5600, fx: 5380,
    bg1: '#000022', bg2: '#000044', gc: '#003300', acc: '#00FF00',
    pixel: true,
    plats: [
      gnd(0, 300, '#003300'), gnd(410, 160, '#003300'), gnd(700, 158, '#003300'),
      gnd(1010, 162, '#003300'), gnd(1350, 155, '#003300'), gnd(1720, 160, '#003300'),
      gnd(2090, 155, '#003300'), gnd(2490, 162, '#003300'), gnd(2890, 155, '#003300'),
      gnd(3330, 162, '#003300'), gnd(3780, 155, '#003300'), gnd(4260, 160, '#003300'),
      gnd(4740, 155, '#003300'), gnd(5200, 600, '#003300'),
      plt(80, 258, 88, R1), plt(225, 212, 78, R1), plt(380, 258, 84, R1),
      plt(540, 205, 78, R1), plt(720, 258, 84, R1), plt(890, 196, 78, R1),
      plt(1080, 258, 84, R1), plt(1260, 176, 78, R1), plt(1480, 258, 84, R1),
      plt(1680, 196, 78, R1), plt(1900, 258, 84, R1), plt(2100, 176, 78, R1),
      plt(2350, 256, 84, R1), plt(2570, 190, 78, R1), plt(2790, 258, 84, R1),
      plt(3010, 176, 78, R1), plt(3250, 256, 84, R1), plt(3490, 188, 78, R1),
      plt(3730, 258, 84, R1), plt(3980, 188, 78, R1), plt(4240, 258, 84, R1),
      plt(4510, 188, 78, R1), plt(4800, 258, 84, R1), plt(5080, 196, 78, R1),
      plt(5280, 258, 80, R1),
      mplX(1030, 238, 72, R1, 120), mplX(2310, 218, 72, R1, 150),
      mplY(3410, 228, 72, R1, 88), mplX(4440, 218, 72, R1, 160),
      mplX(5100, 228, 72, R1, 130),
    ],
    enemies: [
      drone(190, 212, 80, 390, 22), drone(570, 205, 410, 690, 28),
      cart(950, GY, 700, 1000), drone(1130, 176, 1010, 1340, 30),
      drone(1490, 196, 1350, 1710, 25), cart(1930, GY, 1720, 2080),
      drone(2250, 176, 2090, 2480, 32), drone(2700, 190, 2490, 2880, 28),
      cart(3150, GY, 2890, 3320), drone(3450, 188, 3330, 3770, 30),
      drone(3960, 188, 3780, 4250, 25), cart(4580, GY, 4260, 4730),
      drone(4920, 188, 4740, 5190, 32),
      // ÖZGÜR DRONE BOSS 👑
      boss(5100, 155, 4850, 5550),
    ],
    items: [
      itm(100, 233, 'star', 300), itm(245, 187, 'card', 100), itm(400, 233, 'frame', 75),
      itm(560, 180, 'star', 300), itm(740, 233, 'battery', 60), itm(910, 171, 'star', 300),
      itm(1100, 233, 'lens', 50), itm(1280, 151, 'star', 300), itm(1500, 233, 'card', 100),
      itm(1700, 171, 'star', 300), itm(1920, 233, 'frame', 75), itm(2120, 151, 'star', 300),
      itm(2370, 231, 'battery', 60), itm(2590, 165, 'star', 300), itm(2810, 233, 'lens', 50),
      itm(3030, 151, 'star', 300), itm(3270, 231, 'card', 100), itm(3510, 163, 'star', 300),
      itm(3750, 233, 'frame', 75), itm(4000, 163, 'star', 300), itm(4260, 233, 'battery', 60),
      itm(4530, 163, 'star', 300), itm(4820, 233, 'lens', 50), itm(5100, 171, 'star', 300),
      itm(5300, 233, 'card', 100),
    ],
    shots: [
      { tx: 620, wx: 760, wy: 208 },
      { tx: 1600, wx: 1740, wy: 193 },
      { tx: 2860, wx: 3000, wy: 186 },
      { tx: 4300, wx: 4440, wy: 193 },
      { tx: 5100, wx: 5240, wy: 198 },
    ],
    msg: ['Tebrikler... buraya kadar geldin. 🎮', 'Ama bu iş bitmedi.', 'ÖZGÜR DRONE™ seni bekliyor!', 'En iyi kazansın. 😈'],
  },
];

// ─────────────────────────── SAVE / LEADERBOARD ──────────────────────────────
const SAVE_KEY = 'aq-save-v1';
const LB_KEY = 'aq-lb-v1';
interface SaveData { unlocked: number; best: number[]; sound: boolean; }
interface LBEntry { name: string; score: number; level: number; date: string; }

function loadSave(): SaveData {
  try { return { unlocked: 1, best: [0, 0, 0, 0, 0], sound: true, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; }
  catch { return { unlocked: 1, best: [0, 0, 0, 0, 0], sound: true }; }
}
function saveSave(d: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch {} }
function loadLB(): LBEntry[] { try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch { return []; } }
function addLB(name: string, score: number, level: number) {
  const lb = loadLB();
  lb.push({ name, score, level, date: new Date().toLocaleDateString('tr-TR') });
  lb.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0, 10))); } catch {}
}

// ─────────────────────────── RENDER HELPERS ──────────────────────────────────
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─────────────────────────── PROPS ───────────────────────────────────────────
interface AspectQuestProps { userName: string; userRole: UserRole; accessToken: string; onBack: () => void; }

// ─────────────────────────── COMPONENT ───────────────────────────────────────
export function AspectQuest({ userName, userRole, accessToken, onBack }: AspectQuestProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const gsRef      = useRef<GS>(null!);
  const inputRef   = useRef({ left: false, right: false, jump: false, jumpPress: false, cam: false, camPress: false });
  const scaleRef   = useRef(1);
  const soundRef   = useRef(true);
  const touchRef   = useRef({ left: false, right: false, jump: false, cam: false });

  const [screen, setScreen]     = useState<Screen>('menu');
  const [saveData, setSaveData] = useState<SaveData>(() => loadSave());
  const [showLB, setShowLB]     = useState(false);
  const [cutIdx, setCutIdx]     = useState(0);
  const [uiSnap, setUiSnap]     = useState({ score: 0, lives: 3, combo: 0, lvl: 0, t: 0, got: 0, totalItems: 0 });

  // ── Init a level into gsRef ──────────────────────────────────────────────
  const initLevel = useCallback((lvlIdx: number, lives: number, score: number) => {
    const ld = LEVELS[lvlIdx];
    let eid = 0, iid = 0, sid = 0;
    const enemies: Enemy[] = ld.enemies.map(e => ({ ...e, id: eid++, alive: true, oy: e.y }));
    const items: Collectable[] = ld.items.map(it => ({ ...it, id: iid++, got: false }));
    const shots: Shot[] = ld.shots.map(s => ({ ...s, id: sid++, active: false, timer: 0, done: false }));
    const plats = ld.plats.map(p => ({ ...p })); // clone for mutations
    gsRef.current = {
      screen: 'play', lvl: lvlIdx,
      px: 80, py: GY - PH, pvx: 0, pvy: 0,
      ponG: false, pjumps: 2, pface: 1,
      lives, score, combo: 0, comboT: 0,
      pinv: 0, pcamAnim: 0, pdead: false, pdeadT: 0,
      plats, enemies, items, shots, sparks: [], floats: [],
      camX: 0, t: 0, levelT: 0, slowMo: 0, flash: 0,
      cutLine: 0, cutTimer: 0, totalScore: score, gotCollect: 0,
      levelComplete: false,
    };
  }, []);

  // ── Collision ────────────────────────────────────────────────────────────
  function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ── Spawn sparks ─────────────────────────────────────────────────────────
  // wx/wy must be in WORLD space — renderer subtracts camX at draw time
  function spawnSparks(gs: GS, wx: number, wy: number, col: string, n = 10) {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 4 + 1;
      gs.sparks.push({ x: wx, y: wy, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 35, maxl: 35, col, sz: Math.random() * 4 + 1 });
    }
  }

  // ── Main update ──────────────────────────────────────────────────────────
  const update = useCallback(() => {
    const gs = gsRef.current;
    if (!gs || gs.screen !== 'play') return;

    const inp = inputRef.current;
    const tc  = touchRef.current;
    const dt  = gs.slowMo > 0 ? 0.35 : 1;
    gs.t++; gs.levelT++;
    if (gs.slowMo > 0) gs.slowMo--;
    if (gs.flash > 0) gs.flash--;
    if (gs.pinv > 0) gs.pinv--;
    if (gs.pcamAnim > 0) gs.pcamAnim--;
    if (gs.comboT > 0) { gs.comboT -= dt; if (gs.comboT <= 0) gs.combo = 0; }

    // Death handling
    if (gs.pdead) {
      gs.pdeadT++;
      if (gs.pdeadT > 90) {
        gs.lives--;
        if (gs.lives <= 0) {
          gs.screen = 'over';
          setScreen('over');
          if (soundRef.current) SFX.gameOver();
          return;
        }
        gs.px = 80; gs.py = GY - PH; gs.pvx = 0; gs.pvy = 0;
        gs.pjumps = 2; gs.ponG = false; gs.camX = 0;
        gs.pdead = false; gs.pdeadT = 0; gs.pinv = 120;
      }
      // Update sparks/floats even while dead
      gs.sparks = gs.sparks.filter(s => s.life > 0);
      gs.sparks.forEach(s => { s.x += s.vx; s.y += s.vy; s.vy += 0.15; s.life--; });
      return;
    }

    // Level completion
    if (gs.levelComplete) {
      gs.pvy = 0; gs.pvx = 0.5;
      return;
    }

    // Update moving platforms
    gs.plats.forEach(p => {
      if (p.ox !== undefined) {
        p.t = (p.t ?? 0) + 0.03 * dt;
        const s = Math.sin(p.t * ((p.spd ?? 0.03) / 0.03));
        p.x = p.ox + s * (p.range ?? 80) * (p.dvx ?? 0);
        p.y = p.oy! + s * (p.range ?? 80) * (p.dvy ?? 0);
      }
    });

    // Input
    const goLeft  = inp.left  || tc.left;
    const goRight = inp.right || tc.right;
    const doJump  = inp.jumpPress || tc.jump;
    const doCam   = inp.camPress  || tc.cam;
    inp.jumpPress = false; inp.camPress = false;
    tc.jump = false; tc.cam = false;

    if (goLeft)       { gs.pvx = Math.max(gs.pvx - SPD * 0.45, -SPD); gs.pface = -1; }
    else if (goRight) { gs.pvx = Math.min(gs.pvx + SPD * 0.45,  SPD); gs.pface =  1; }
    else              { gs.pvx *= 0.72; if (Math.abs(gs.pvx) < 0.1) gs.pvx = 0; }

    if (doJump && gs.pjumps > 0) {
      const isDouble = gs.pjumps < 2;
      gs.pvy = isDouble ? DJV : JV;
      gs.pjumps--;
      if (soundRef.current) isDouble ? SFX.djump() : SFX.jump();
    }

    if (doCam) {
      gs.pcamAnim = 18;
      const activeShot = gs.shots.find(s => s.active && !s.done);
      if (activeShot) {
        activeShot.done = true; activeShot.active = false;
        gs.combo++; gs.comboT = 180;
        const bonus = 500 + (gs.combo - 1) * 120;
        gs.score += bonus;
        gs.slowMo = 55; gs.flash = 10;
        if (soundRef.current) SFX.photo();
        // World-space coords — spawnSparks & floats now store world space
        spawnSparks(gs, activeShot.wx, activeShot.wy, '#FFD700', 20);
        gs.floats.push({ x: activeShot.wx, y: activeShot.wy - 20, text: `+${bonus} 📸`, life: 80, col: '#FFD700' });
      }
    }

    // Photo moments trigger — gs.px is world space, s.tx is world space
    gs.shots.forEach(s => {
      if (!s.done && !s.active && gs.px > s.tx) { s.active = true; s.timer = 180; }
      if (s.active && !s.done) { s.timer -= dt; if (s.timer <= 0) { s.active = false; s.done = true; } }
    });

    // Gravity
    gs.pvy = Math.min(gs.pvy + GRAV * dt, MAXVY);

    // ── Move X ──
    gs.px += gs.pvx * dt;
    if (gs.px < 0) { gs.px = 0; gs.pvx = 0; }

    // ── Horizontal platform collision ──
    // Only push sideways when player is NOT dropping onto the platform from above.
    // If player feet (py + PH) are still at/above platform top, skip — the vertical
    // pass will land them correctly. This prevents invisible-floor side-pushes.
    gs.plats.forEach(p => {
      if (!aabb(gs.px, gs.py, PW, PH, p.x, p.y, p.w, p.h)) return;
      if (gs.py + PH <= p.y + 3) return; // approaching from above — vertical pass handles this
      const overlapL = (gs.px + PW) - p.x;
      const overlapR = (p.x + p.w) - gs.px;
      if (overlapL < overlapR) { gs.px = p.x - PW; gs.pvx = 0; }
      else                     { gs.px = p.x + p.w; gs.pvx = 0; }
    });

    // ── Move Y ──
    const prevPy = gs.py; // snapshot pre-move Y to detect landing direction
    gs.py += gs.pvy * dt;
    gs.ponG = false;

    // ── Vertical platform collision ──
    gs.plats.forEach(p => {
      if (!aabb(gs.px, gs.py, PW, PH, p.x, p.y, p.w, p.h)) return;
      if (gs.pvy >= 0 && prevPy + PH <= p.y + 5) {
        // Landing from above: feet were at/above platform top before Y move
        gs.py = p.y - PH;
        gs.pvy = 0;
        gs.pjumps = 2;
        gs.ponG = true;
      } else if (gs.pvy < 0 && prevPy >= p.y + p.h - 5) {
        // Hitting head: top was at/below platform bottom before Y move
        gs.py = p.y + p.h;
        gs.pvy = 0;
      }
      // Side entry in Y pass → no-op (horizontal already resolved it)
    });

    // Death by falling — GY is ground, fall below screen bottom triggers death
    if (gs.py > GY + 120) {
      gs.pdead = true; gs.pdeadT = 0;
      if (soundRef.current) SFX.hit();
      // World-space position for sparks
      spawnSparks(gs, gs.px + PW / 2, GY, '#FF4444', 12);
      return;
    }

    // ── Camera — deadzone follow with hard edge clamps ──
    // gs.px is world space. Camera keeps player roughly at 36% from left.
    const maxCam = LEVELS[gs.lvl].ww - CW;
    const screenPx = gs.px - gs.camX;        // where player currently appears on screen
    const targetCam = gs.px - CW * 0.36;
    let newCamX = gs.camX + (targetCam - gs.camX) * 0.16;
    // Hard clamps: player must never go off screen
    if (screenPx < CW * 0.10) newCamX = gs.px - CW * 0.10;
    if (screenPx > CW * 0.88) newCamX = gs.px - CW * 0.88;
    gs.camX = Math.max(0, Math.min(maxCam, newCamX));

    // Enemy update
    gs.enemies.forEach(e => {
      if (!e.alive) return;
      e.x += e.vx * dt;
      if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
      if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }

      if (e.type === 'drone' || e.type === 'boss') {
        e.y = e.oy + Math.sin(gs.t * (e.freq ?? 0.035) + (e.ph ?? 0)) * (e.amp ?? 22);
      }
      if (e.hitTimer !== undefined && e.hitTimer > 0) e.hitTimer--;

      // Player collision — all coords are world space, compare directly
      if (gs.pinv > 0) return;
      if (aabb(gs.px, gs.py, PW, PH, e.x, e.y, e.w, e.h)) {
        gs.pinv = 100;
        gs.lives--;
        gs.combo = 0; gs.comboT = 0;
        if (soundRef.current) SFX.hit();
        spawnSparks(gs, gs.px + PW / 2, gs.py + PH / 2, '#FF4444', 8);
        // Float stored in world space — renderer subtracts camX
        gs.floats.push({ x: gs.px, y: gs.py - 15, text: '-1 💔', life: 60, col: '#FF4444' });
        if (gs.lives <= 0) {
          gs.screen = 'over'; setScreen('over');
          if (soundRef.current) SFX.gameOver();
        }
      }
    });

    // Collectible check — all world space
    gs.items.forEach(it => {
      if (it.got) return;
      if (aabb(gs.px, gs.py, PW, PH, it.x, it.y, it.w, it.h)) {
        it.got = true;
        gs.combo++; gs.comboT = 120;
        const bonus = it.pts * (1 + Math.floor(gs.combo / 3) * 0.5);
        gs.score += Math.floor(bonus);
        gs.gotCollect++;
        if (soundRef.current) it.type === 'star' ? SFX.star() : SFX.collect();
        // World-space coords — spawnSparks & floats store world space
        spawnSparks(gs, it.x, it.y, it.type === 'star' ? '#FFD700' : '#88EEFF', 6);
        gs.floats.push({ x: it.x, y: it.y - 16, text: `+${Math.floor(bonus)}`, life: 50, col: it.type === 'star' ? '#FFD700' : '#88EEFF' });
      }
    });

    // Finish check
    // Finish check — gs.px is world space, ld.fx is world space
    const ld = LEVELS[gs.lvl];
    if (gs.px > ld.fx) {
      if (!gs.levelComplete) {
        gs.levelComplete = true;
        const timeBonus = Math.max(0, 3000 - Math.floor(gs.levelT / 60) * 10);
        gs.score += timeBonus + gs.lives * 200;
        if (soundRef.current) SFX.lvlWin();
        setTimeout(() => { setScreen('lvlwin'); }, 800);
      }
    }

    // Update particles
    gs.sparks = gs.sparks.filter(s => s.life > 0);
    gs.sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.14 * dt; s.life--; });
    gs.floats = gs.floats.filter(f => f.life > 0);
    gs.floats.forEach(f => { f.y -= 0.6 * dt; f.life--; });

    // UI update every 10 frames
    if (gs.t % 10 === 0) {
      setUiSnap({ score: gs.score, lives: gs.lives, combo: gs.combo, lvl: gs.lvl, t: Math.floor(gs.levelT / 60), got: gs.gotCollect, totalItems: gs.items.length });
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gs = gsRef.current;
    if (!gs) return;

    const { camX, t, lvl } = gs;
    const ld = LEVELS[lvl];

    // ── Background ──────────────────────────────────────────────────────────
    const grd = ctx.createLinearGradient(0, 0, 0, CH);
    grd.addColorStop(0, ld.bg1);
    grd.addColorStop(1, ld.bg2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CW, CH);

    // Rain effect for Level 4
    if (ld.rain) {
      ctx.strokeStyle = 'rgba(100,180,255,0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const rx = ((i * 137 + t * 3) % (CW + 60)) - 30;
        const ry = (i * 71 + t * 4) % (CH + 20);
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 14); ctx.stroke();
      }
    }

    // Mountains / skyline (parallax 0.3x)
    const mx = -camX * 0.3;
    if (lvl === 1) {
      // Neon city skyline
      ctx.fillStyle = 'rgba(15,52,96,0.55)';
      for (let i = 0; i < 18; i++) {
        const bx = ((i * 220 + mx) % (CW + 200)) - 100;
        const bh = 60 + (i * 43 % 80);
        ctx.fillRect(bx, CH - 50 - bh, 45 + (i % 3) * 20, bh);
      }
    } else if (lvl === 2) {
      // Festival stage bg
      for (let i = 0; i < 6; i++) {
        const hue = (i * 60 + t) % 360;
        ctx.fillStyle = `hsla(${hue},80%,40%,0.12)`;
        ctx.fillRect(0, 0, CW, CH);
      }
    } else if (lvl === 3) {
      // Storm clouds
      ctx.fillStyle = 'rgba(30,30,50,0.5)';
      for (let i = 0; i < 6; i++) {
        const cx2 = ((i * 180 + mx) % (CW + 150)) - 60;
        ctx.beginPath(); ctx.arc(cx2, 40 + (i % 3) * 18, 55, 0, Math.PI * 2); ctx.fill();
      }
      if (Math.random() < 0.02) {
        ctx.strokeStyle = 'rgba(200,220,255,0.7)'; ctx.lineWidth = 2;
        const lx = Math.random() * CW;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx + 10, 60); ctx.stroke();
      }
    } else {
      // Generic mountains
      ctx.fillStyle = ld.acc + '22';
      for (let i = 0; i < 5; i++) {
        const bx = ((i * 250 + mx) % (CW + 300)) - 100;
        ctx.beginPath(); ctx.moveTo(bx, CH - 50); ctx.lineTo(bx + 150, CH - 160); ctx.lineTo(bx + 300, CH - 50); ctx.closePath(); ctx.fill();
      }
    }

    // ASPECT background watermarks (parallax 0.15x)
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = ld.acc;
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 6; i++) {
      const wx2 = ((i * 800 - camX * 0.15) % (CW + 800)) - 200;
      ctx.fillText('ASPECT', wx2, CH / 2 + 20);
    }
    ctx.restore();

    // Neon signs / billboards (parallax 0.7x)
    const signs = ['ASPECT', 'ASPECT PHOTOGRAPHY', 'ASPECT OPS', 'ASPECT TEAM', 'CAPTURE THE MOMENT', 'ASPECT STUDIO', 'ASPECT PRO', 'ASPECT ✦'];
    for (let i = 0; i < 8; i++) {
      const sx2 = ((i * 700 - camX * 0.7) % (CW + 600)) - 200;
      const sy2 = 40 + (i % 3) * 30;
      ctx.save();
      ctx.globalAlpha = 0.75;
      // Sign board
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      drawRoundRect(ctx, sx2 - 4, sy2 - 18, 190, 28, 4);
      ctx.fill();
      ctx.strokeStyle = ld.acc;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.9;
      drawRoundRect(ctx, sx2 - 4, sy2 - 18, 190, 28, 4);
      ctx.stroke();
      ctx.fillStyle = ld.acc;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(signs[i % signs.length], sx2, sy2);
      ctx.restore();
    }

    // Pixel grid for retro level
    if (ld.pixel) {
      ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 0.5;
      for (let gx = 0; gx < CW; gx += 16) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke(); }
      for (let gy = 0; gy < CH; gy += 16) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke(); }
      ctx.restore();
    }

    // Ground decoration text
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = ld.acc;
    ctx.font = '500 11px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < 10; i++) {
      const gx2 = ((i * 480 - camX * 1.0) % (CW + 400)) - 100;
      ctx.fillText('▸ ASPECT ◂', gx2, GY + 18);
    }
    ctx.restore();

    // ── Platforms ────────────────────────────────────────────────────────────
    gs.plats.forEach(p => {
      const sx3 = p.x - camX;
      if (sx3 + p.w < 0 || sx3 > CW) return;

      if (p.y >= GY) {
        // Ground segment
        ctx.fillStyle = ld.gc;
        ctx.fillRect(sx3, p.y, p.w, p.h);
        // Ground surface strip
        ctx.fillStyle = p.col;
        ctx.fillRect(sx3, p.y, p.w, 8);
        // Ground texture
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let gi = 0; gi < p.w; gi += 20) ctx.fillRect(sx3 + gi, p.y, 10, 8);
      } else {
        // Elevated platform
        ctx.fillStyle = p.col;
        ctx.fillRect(sx3, p.y, p.w, p.h);
        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(sx3, p.y, p.w, 3);
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(sx3, p.y + p.h - 3, p.w, 3);
        // Moving platform glow
        if (p.ox !== undefined) {
          ctx.save();
          ctx.shadowColor = ld.acc; ctx.shadowBlur = 8;
          ctx.strokeStyle = ld.acc; ctx.lineWidth = 1;
          ctx.strokeRect(sx3, p.y, p.w, p.h);
          ctx.restore();
        }
      }
    });

    // ── Finish portal ─────────────────────────────────────────────────────────
    const fsx = ld.fx - camX;
    if (fsx > -60 && fsx < CW + 60) {
      const pulse = 0.8 + 0.2 * Math.sin(t * 0.08);
      ctx.save();
      ctx.shadowColor = ld.acc; ctx.shadowBlur = 20 * pulse;
      // Portal frame
      ctx.strokeStyle = ld.acc; ctx.lineWidth = 3;
      ctx.strokeRect(fsx - 20, GY - 70, 40, 70);
      // Inner glow
      const pg = ctx.createLinearGradient(fsx - 20, GY - 70, fsx + 20, GY);
      pg.addColorStop(0, ld.acc + '44');
      pg.addColorStop(0.5, ld.acc + '88');
      pg.addColorStop(1, ld.acc + '44');
      ctx.fillStyle = pg;
      ctx.fillRect(fsx - 20, GY - 70, 40, 70);
      // Stars
      for (let i = 0; i < 4; i++) {
        const starX = fsx - 15 + (i % 2) * 30;
        const starY = GY - 60 + Math.floor(i / 2) * 30 + Math.sin(t * 0.1 + i) * 4;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(starX - 3, starY - 3, 6, 6);
      }
      ctx.restore();
      // Text
      ctx.save();
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = ld.acc;
      ctx.textAlign = 'center';
      ctx.shadowColor = ld.acc; ctx.shadowBlur = 8;
      ctx.fillText('ASPECT', fsx, GY - 78);
      ctx.fillText('FINISH', fsx, GY - 67);
      ctx.restore();
    }

    // ── Collectibles ─────────────────────────────────────────────────────────
    gs.items.forEach(it => {
      if (it.got) return;
      const sx4 = it.x - camX;
      if (sx4 < -20 || sx4 > CW + 20) return;
      const bob = Math.sin(t * 0.08 + it.id) * 3;
      const colors: Record<string, string> = { lens: '#64B5F6', frame: '#FFD54F', card: '#81C784', battery: '#FF8A65', star: '#FFD700' };
      const col2 = colors[it.type] || '#FFFFFF';

      ctx.save();
      ctx.shadowColor = col2; ctx.shadowBlur = 8;
      if (it.type === 'star') {
        ctx.fillStyle = col2;
        const cy2 = it.y + bob + it.h / 2;
        const r1 = it.w / 2, r2 = r1 * 0.45;
        ctx.beginPath();
        for (let si = 0; si < 10; si++) {
          const angle = (si * Math.PI) / 5 - Math.PI / 2;
          const r3 = si % 2 === 0 ? r1 : r2;
          if (si === 0) ctx.moveTo(sx4 + it.w / 2 + Math.cos(angle) * r3, cy2 + Math.sin(angle) * r3);
          else ctx.lineTo(sx4 + it.w / 2 + Math.cos(angle) * r3, cy2 + Math.sin(angle) * r3);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#FFA000'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (it.type === 'lens') {
        ctx.strokeStyle = col2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx4 + it.w / 2, it.y + bob + it.h / 2, it.w / 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx4 + it.w / 2, it.y + bob + it.h / 2, it.w / 4, 0, Math.PI * 2); ctx.fillStyle = col2 + '88'; ctx.fill();
      } else if (it.type === 'frame') {
        ctx.strokeStyle = col2; ctx.lineWidth = 2;
        ctx.strokeRect(sx4 + 2, it.y + bob + 2, it.w - 4, it.h - 4);
        ctx.strokeRect(sx4 + 5, it.y + bob + 5, it.w - 10, it.h - 10);
      } else if (it.type === 'card') {
        ctx.fillStyle = col2; ctx.fillRect(sx4 + 2, it.y + bob + 3, it.w - 4, it.h - 6);
        ctx.fillStyle = '#FFFFFF88';
        ctx.font = '7px monospace'; ctx.textAlign = 'center';
        ctx.fillText('SD', sx4 + it.w / 2, it.y + bob + it.h / 2 + 2);
      } else if (it.type === 'battery') {
        ctx.fillStyle = col2 + 'CC';
        ctx.fillRect(sx4 + 3, it.y + bob + 4, it.w - 6, it.h - 8);
        ctx.fillStyle = '#00FF0088';
        ctx.fillRect(sx4 + 4, it.y + bob + 5, (it.w - 8) * 0.7, it.h - 10);
        ctx.fillStyle = col2; ctx.fillRect(sx4 + it.w / 2 - 2, it.y + bob, 4, 4);
      }
      ctx.restore();
    });

    // ── Photo moments ─────────────────────────────────────────────────────────
    gs.shots.forEach(s => {
      if (!s.active || s.done) return;
      const sx5 = s.wx - camX;
      const progress = s.timer / 180;
      const pulse2 = 0.7 + 0.3 * Math.sin(t * 0.25);
      ctx.save();
      ctx.globalAlpha = progress * pulse2;
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 16;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.fillText('📷', sx5, s.wy);
      // Timer ring
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx5, s.wy + 4, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#FFD700';
      ctx.fillText('FLASH!', sx5, s.wy + 28);
      ctx.restore();
    });

    // ── Enemies ───────────────────────────────────────────────────────────────
    gs.enemies.forEach(e => {
      if (!e.alive) return;
      const ex2 = e.x - camX;
      if (ex2 + e.w < -10 || ex2 > CW + 10) return;

      ctx.save();
      if (e.type === 'bird') {
        // Seagull
        const flap = Math.sin(t * 0.2 + e.id) > 0 ? 3 : -3;
        ctx.fillStyle = '#E8E8E8';
        ctx.beginPath(); ctx.arc(ex2 + 14, e.y + 8, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFA500';
        ctx.beginPath(); ctx.moveTo(ex2 + 19, e.y + 9); ctx.lineTo(ex2 + 24, e.y + 8); ctx.lineTo(ex2 + 20, e.y + 11); ctx.closePath(); ctx.fill();
        // Wings
        ctx.fillStyle = '#D0D0D0';
        ctx.beginPath(); ctx.moveTo(ex2 + 4, e.y + 7); ctx.lineTo(ex2 - 4, e.y + 7 + flap); ctx.lineTo(ex2 + 8, e.y + 12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ex2 + 24, e.y + 7); ctx.lineTo(ex2 + 32, e.y + 7 + flap); ctx.lineTo(ex2 + 18, e.y + 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(ex2 + 16, e.y + 6, 1.5, 0, Math.PI * 2); ctx.fill();

      } else if (e.type === 'drone') {
        // Drone / quad-rotor
        const bladeRot = (t * 0.25 + e.id) % (Math.PI * 2);
        ctx.fillStyle = '#1a1a2e'; ctx.strokeStyle = ld.acc; ctx.lineWidth = 1.5;
        // Body
        ctx.shadowColor = ld.acc; ctx.shadowBlur = 8;
        drawRoundRect(ctx, ex2 + 5, e.y + 6, e.w - 10, e.h - 10, 3);
        ctx.fill(); ctx.stroke();
        // Arms
        ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex2, e.y + e.h / 2); ctx.lineTo(ex2 + e.w, e.y + e.h / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex2 + e.w / 2, e.y); ctx.lineTo(ex2 + e.w / 2, e.y + e.h); ctx.stroke();
        // Rotors
        const rotors = [[0, 0], [e.w, 0], [0, e.h], [e.w, e.h]];
        rotors.forEach(([rx2, ry2]) => {
          ctx.save();
          ctx.translate(ex2 + rx2, e.y + ry2);
          ctx.rotate(bladeRot * (((rx2 + ry2) % 2 === 0) ? 1 : -1));
          ctx.strokeStyle = ld.acc; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
          ctx.restore();
        });
        // Eye / camera
        ctx.fillStyle = '#FF0000'; ctx.beginPath(); ctx.arc(ex2 + e.w / 2, e.y + e.h / 2, 3, 0, Math.PI * 2); ctx.fill();

      } else if (e.type === 'cart') {
        // Equipment cart
        ctx.fillStyle = '#444';
        ctx.fillRect(ex2, e.y, e.w, e.h - 5);
        ctx.fillStyle = '#666';
        ctx.fillRect(ex2 + 2, e.y + 2, e.w - 4, e.h - 9);
        // Wheels
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(ex2 + 8, e.y + e.h - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2 + e.w - 8, e.y + e.h - 4, 4, 0, Math.PI * 2); ctx.fill();
        // ASPECT label
        ctx.fillStyle = ld.acc; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
        ctx.fillText('ASPECT', ex2 + e.w / 2, e.y + e.h - 8);

      } else if (e.type === 'boss') {
        // ÖZGÜR DRONE BOSS 👑
        ctx.shadowColor = '#FF6600'; ctx.shadowBlur = 20;
        // Main body — large drone
        ctx.fillStyle = '#1a0033'; ctx.strokeStyle = '#FF6600'; ctx.lineWidth = 2;
        drawRoundRect(ctx, ex2 + 8, e.y + 12, e.w - 16, e.h - 18, 6);
        ctx.fill(); ctx.stroke();
        // Arms
        ctx.strokeStyle = '#FF6600'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ex2, e.y + e.h / 2 - 5); ctx.lineTo(ex2 + e.w, e.y + e.h / 2 - 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex2 + e.w / 2, e.y + 4); ctx.lineTo(ex2 + e.w / 2, e.y + e.h - 4); ctx.stroke();
        // Rotors (big)
        const corners2 = [[0, 0], [e.w, 0], [0, e.h], [e.w, e.h]];
        corners2.forEach(([rx2, ry2]) => {
          ctx.save();
          ctx.translate(ex2 + rx2, e.y + ry2);
          ctx.rotate((t * 0.35 * ((rx2 + ry2) % 2 === 0 ? 1 : -1)));
          ctx.strokeStyle = '#FF9900'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
          ctx.restore();
        });
        // ÖZGÜR text on body
        ctx.fillStyle = '#FFD700'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText('ÖZGÜR', ex2 + e.w / 2, e.y + e.h / 2 - 1);
        ctx.fillText('DRONE™', ex2 + e.w / 2, e.y + e.h / 2 + 11);
        // Crown
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(ex2 + e.w / 2 - 12, e.y + 8);
        ctx.lineTo(ex2 + e.w / 2 - 12, e.y);
        ctx.lineTo(ex2 + e.w / 2 - 4, e.y + 5);
        ctx.lineTo(ex2 + e.w / 2, e.y);
        ctx.lineTo(ex2 + e.w / 2 + 4, e.y + 5);
        ctx.lineTo(ex2 + e.w / 2 + 12, e.y);
        ctx.lineTo(ex2 + e.w / 2 + 12, e.y + 8);
        ctx.closePath(); ctx.fill();
        // Camera gun
        ctx.fillStyle = '#444'; ctx.fillRect(ex2 + e.w / 2 - 14, e.y + e.h - 10, 28, 8);
        ctx.fillStyle = '#FF0000'; ctx.beginPath(); ctx.arc(ex2 + e.w / 2, e.y + e.h - 6, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    // ── Player ────────────────────────────────────────────────────────────────
    if (!gs.pdead || gs.pdeadT % 6 < 3) {
      // gs.px is WORLD space — subtract camX to get screen position
      const px6 = gs.px - camX;
      const py6 = gs.py;
      const flipped = gs.pface < 0;
      const isInv = gs.pinv > 0 && (gs.t % 6 < 3);
      if (!isInv) {
        ctx.save();
        if (flipped) { ctx.translate(px6 + PW, 0); ctx.scale(-1, 1); }

        const bx6 = flipped ? 0 : px6;

        // Body
        ctx.fillStyle = gs.pdead ? '#FF4444' : '#6C63FF';
        ctx.fillRect(bx6 + 3, py6 + 12, PW - 6, PH - 12);
        // ASPECT on shirt
        ctx.fillStyle = '#FFFFFF66'; ctx.font = '5px monospace'; ctx.textAlign = 'center';
        ctx.fillText('ASPECT', bx6 + PW / 2, py6 + 22);

        // Head
        ctx.fillStyle = '#FDBCB4';
        ctx.fillRect(bx6 + 4, py6 + 2, PW - 8, 12);
        // Hair
        ctx.fillStyle = '#4A3728';
        ctx.fillRect(bx6 + 4, py6 + 2, PW - 8, 5);
        ctx.fillRect(bx6 + 4, py6 + 4, 3, 6);
        // Eye
        ctx.fillStyle = '#333';
        ctx.fillRect(bx6 + PW - 10, py6 + 6, 3, 3);
        // Legs
        const legOff = gs.ponG ? Math.sin(gs.t * 0.35) * 3 : 0;
        ctx.fillStyle = '#4A3728';
        ctx.fillRect(bx6 + 4, py6 + PH - 10, 7, 10 + legOff);
        ctx.fillRect(bx6 + PW - 11, py6 + PH - 10, 7, 10 - legOff);
        // Shoes
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(bx6 + 3, py6 + PH - 2, 9, 3);
        ctx.fillRect(bx6 + PW - 12, py6 + PH - 2, 9, 3);

        // Camera
        const camShake = gs.pcamAnim > 0 ? Math.sin(gs.pcamAnim * 1.5) * 2 : 0;
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(bx6 + PW - 4, py6 + 14 + camShake, 10, 8);
        ctx.fillStyle = '#444';
        ctx.fillRect(bx6 + PW - 3, py6 + 15 + camShake, 8, 6);
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath(); ctx.arc(bx6 + PW + 1, py6 + 18 + camShake, 2.5, 0, Math.PI * 2); ctx.fill();
        // Flash effect
        if (gs.pcamAnim > 12) {
          ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.arc(bx6 + PW + 3, py6 + 13 + camShake, 5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    }

    // ── Sparks — stored world space, subtract camX to render ─────────────────
    gs.sparks.forEach(s => {
      ctx.globalAlpha = s.life / s.maxl;
      ctx.fillStyle = s.col;
      ctx.fillRect(s.x - camX - s.sz / 2, s.y - s.sz / 2, s.sz, s.sz);
    });
    ctx.globalAlpha = 1;

    // ── Float texts — stored world space, subtract camX to render ─────────────
    gs.floats.forEach(f => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life / 30);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = f.col;
      ctx.textAlign = 'center';
      ctx.shadowColor = f.col; ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x - camX + PW / 2, f.y);
      ctx.restore();
    });

    // ── Screen flash ─────────────────────────────────────────────────────────
    if (gs.flash > 0) {
      ctx.fillStyle = `rgba(255,255,200,${gs.flash / 12 * 0.5})`;
      ctx.fillRect(0, 0, CW, CH);
    }

    // ── HUD ───────────────────────────────────────────────────────────────────
    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CW, 30);
    ctx.strokeStyle = ld.acc + '44'; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, CW, 30);

    // Score
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#FFD700'; ctx.textAlign = 'left';
    ctx.fillText(`★ ${gs.score.toLocaleString()}`, 8, 18);

    // Level name
    ctx.fillStyle = ld.acc; ctx.textAlign = 'center';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`LVL ${gs.lvl + 1} · ${ld.name}`, CW / 2, 11);

    // Timer
    ctx.fillStyle = '#FFFFFF88'; ctx.font = '9px monospace';
    ctx.fillText(`${Math.floor(gs.levelT / 60)}s`, CW / 2, 22);

    // Lives (hearts)
    ctx.font = '13px monospace'; ctx.textAlign = 'right';
    let livesStr = '';
    for (let li = 0; li < gs.lives; li++) livesStr += '♥';
    ctx.fillStyle = '#FF5555'; ctx.fillText(livesStr, CW - 8, 18);

    // Combo
    if (gs.combo >= 2) {
      ctx.save();
      const cAlpha = Math.min(1, gs.comboT / 60);
      ctx.globalAlpha = cAlpha;
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#FF9900'; ctx.textAlign = 'left';
      ctx.fillText(`×${gs.combo} COMBO!`, 8, CH - 8);
      ctx.restore();
    }

    // Progress bar — gs.px is world space, ld.fx is world space
    const progress2 = Math.min(1, gs.px / ld.fx);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(8, 26, CW - 16, 4);
    ctx.fillStyle = ld.acc;
    ctx.fillRect(8, 26, (CW - 16) * progress2, 4);
    // Player marker
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(8 + (CW - 16) * progress2 - 2, 24, 4, 8);

  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    update();
    render();
    rafRef.current = requestAnimationFrame(loop);
  }, [update, render]);

  // ── Canvas resize ────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const maxW = Math.min(wrap.clientWidth, 520);
      const scale = maxW / CW;
      scaleRef.current = scale;
      canvas.style.width  = `${CW * scale}px`;
      canvas.style.height = `${CH * scale}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Start/stop loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'play') {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
      // Still render one frame for paused state
      if (screen === 'pause' || screen === 'lvlwin') render();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, loop, render]);

  // ── Keyboard input ───────────────────────────────────────────────────────
  useEffect(() => {
    const inp = inputRef.current;
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') inp.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inp.right = true;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { inp.jump = true; inp.jumpPress = true; }
      if (e.key === 'Shift' || e.key === 'e' || e.key === 'E') { inp.cam = true; inp.camPress = true; }
      if (e.key === 'Escape') {
        const gs = gsRef.current;
        if (gs?.screen === 'play')  { gs.screen = 'pause'; setScreen('pause'); }
        else if (gs?.screen === 'pause') { gs.screen = 'play'; setScreen('play'); }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') inp.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inp.right = false;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') inp.jump = false;
      if (e.key === 'Shift' || e.key === 'e' || e.key === 'E') inp.cam = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── Screen transitions ───────────────────────────────────────────────────
  const handleStartGame = (lvlIdx: number) => {
    initLevel(lvlIdx, 3, 0);
    setCutIdx(0);
    setScreen('cut');
  };

  const handleCutNext = () => {
    const gs = gsRef.current;
    const msgs = LEVELS[gs.lvl].msg;
    const next = cutIdx + 1;
    if (next >= msgs.length) {
      gs.screen = 'play';
      setScreen('play');
    } else {
      setCutIdx(next);
    }
  };

  const handleNextLevel = () => {
    const gs = gsRef.current;
    const nextLvl = gs.lvl + 1;
    // Save data
    const sd = loadSave();
    if (gs.score > sd.best[gs.lvl]) { sd.best[gs.lvl] = gs.score; }
    if (nextLvl > sd.unlocked) sd.unlocked = nextLvl;
    saveSave(sd);
    setSaveData({ ...sd });

    if (nextLvl >= LEVELS.length) {
      addLB(userName || 'Anonim', gs.score, gs.lvl + 1);
      gs.screen = 'victory';
      setScreen('victory');
    } else {
      initLevel(nextLvl, gs.lives, gs.score);
      setCutIdx(0);
      setScreen('cut');
    }
  };

  const handleRetry = () => {
    const gs = gsRef.current;
    initLevel(gs.lvl, 3, 0);
    setCutIdx(0);
    setScreen('cut');
  };

  // ── Touch control handlers ───────────────────────────────────────────────
  const mkTouch = (key: keyof typeof touchRef.current, isPress = false) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      touchRef.current[key] = true;
      if (isPress) touchRef.current[key] = true;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      if (!isPress) touchRef.current[key] = false;
    },
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault();
      touchRef.current[key] = true;
    },
    onMouseUp: (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isPress) touchRef.current[key] = false;
    },
  });

  const gs = gsRef.current;
  const currentLevel = gs?.lvl ?? 0;
  const ld = LEVELS[currentLevel];
  const lb = loadLB();

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: 'linear-gradient(135deg,#0a0015,#1a0035,#0a001f)', minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <ChevronLeft size={18} className="text-white/70" />
        </button>
        <div className="flex-1">
          <div className="font-bold text-white text-sm tracking-widest" style={{ textShadow: '0 0 12px #a855f7' }}>ASPECT QUEST</div>
          <div className="text-white/40 text-xs">5 Bölümlü Platformer</div>
        </div>
        <button onClick={() => { soundRef.current = !soundRef.current; setSaveData(d => ({ ...d, sound: soundRef.current })); }} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          {soundRef.current ? <Volume2 size={16} className="text-purple-400" /> : <VolumeX size={16} className="text-white/30" />}
        </button>
        <button onClick={() => setShowLB(p => !p)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <Trophy size={16} className="text-yellow-400" />
        </button>
      </div>

      {/* Canvas area */}
      <div ref={wrapRef} className="flex-1 flex flex-col items-center justify-center relative overflow-hidden" style={{ padding: '8px 4px 0' }}>

        {/* Canvas */}
        <div className="relative" style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 0 40px rgba(168,85,247,0.3), 0 0 80px rgba(168,85,247,0.1)' }}>
          <canvas ref={canvasRef} width={CW} height={CH} style={{ display: 'block', imageRendering: 'pixelated' }} />

          {/* ── MENU SCREEN ── */}
          {screen === 'menu' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(5,0,20,0.92)', backdropFilter: 'blur(4px)' }}>
              <div className="text-center mb-6">
                <div className="font-black text-4xl tracking-[0.15em] mb-1" style={{ color: '#a855f7', textShadow: '0 0 30px #a855f750, 0 0 60px #a855f730' }}>ASPECT</div>
                <div className="font-black text-2xl tracking-[0.5em] mb-3" style={{ color: '#ffffff', textShadow: '0 0 20px #fff4' }}>QUEST</div>
                <div className="text-white/40 text-xs tracking-widest">5 BÖLÜMLÜ PLATFORMER</div>
              </div>

              {/* Level buttons */}
              <div className="flex flex-col gap-2 w-full px-6 mb-4">
                {LEVELS.map((lv, i) => (
                  <button
                    key={i}
                    onClick={() => handleStartGame(i)}
                    disabled={i > 0 && i >= saveData.unlocked}
                    className="relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: i === 0 ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${i === 0 ? '#a855f7' : 'rgba(255,255,255,0.1)'}` }}
                  >
                    <span className="text-lg">{['🌅','🌃','🎵','🌩️','🎮'][i]}</span>
                    <div className="flex-1 text-left">
                      <div className="text-white text-xs font-semibold">Bölüm {i + 1}: {lv.name}</div>
                      {saveData.best[i] > 0 && <div className="text-yellow-400/60 text-[10px]">En iyi: {saveData.best[i].toLocaleString()}</div>}
                    </div>
                    {i < saveData.unlocked
                      ? <span className="text-green-400 text-xs">▶</span>
                      : <span className="text-white/30 text-xs">🔒</span>
                    }
                  </button>
                ))}
              </div>

              <div className="text-white/30 text-[10px] tracking-widest">© ASPECT PHOTOGRAPHY</div>
            </div>
          )}

          {/* ── CUTSCENE (Özgür messages) ── */}
          {screen === 'cut' && gs && (
            <div className="absolute inset-0 flex flex-col items-end justify-end" style={{ background: 'rgba(5,0,20,0.88)' }}>
              {/* Level title */}
              <div className="absolute top-4 left-0 right-0 text-center">
                <div className="text-white/40 text-[10px] tracking-widest">BÖLÜM {currentLevel + 1}</div>
                <div className="text-white font-bold text-base tracking-wide" style={{ textShadow: `0 0 12px ${ld.acc}` }}>{ld.name}</div>
              </div>

              {/* Özgür portrait */}
              <div className="absolute left-4 bottom-20 flex flex-col items-center gap-1">
                <div className="text-[10px] text-white/50 tracking-widest">ÖZGÜR</div>
                {/* Simple pixel portrait */}
                <div className="relative" style={{ width: 56, height: 72 }}>
                  {/* Suit */}
                  <div style={{ position: 'absolute', left: 8, top: 28, width: 40, height: 44, background: '#1a1a2e', borderRadius: '4px 4px 0 0', border: '2px solid #a855f7' }} />
                  {/* Tie */}
                  <div style={{ position: 'absolute', left: 24, top: 32, width: 8, height: 24, background: '#a855f7', borderRadius: 2 }} />
                  {/* Head */}
                  <div style={{ position: 'absolute', left: 12, top: 8, width: 32, height: 28, background: '#FDBCB4', borderRadius: '50% 50% 40% 40%', border: '2px solid #C8956C' }}>
                    {/* Hair */}
                    <div style={{ position: 'absolute', top: -4, left: -2, width: 36, height: 16, background: '#3a2a1a', borderRadius: '50% 50% 20% 20%' }} />
                    {/* Eyes */}
                    <div style={{ position: 'absolute', top: 10, left: 6, width: 4, height: 4, background: '#1a1a1a', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', top: 10, right: 6, width: 4, height: 4, background: '#1a1a1a', borderRadius: '50%' }} />
                    {/* Smile */}
                    <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 14, height: 6, borderRadius: '0 0 8px 8px', border: '2px solid #C8956C', borderTop: 'none' }} />
                  </div>
                  {/* Camera */}
                  <div style={{ position: 'absolute', right: 0, top: 32, width: 16, height: 12, background: '#2a2a2a', borderRadius: 2, border: '1px solid #666' }}>
                    <div style={{ position: 'absolute', top: 2, left: 2, width: 8, height: 8, borderRadius: '50%', background: '#87CEEB', border: '1px solid #555' }} />
                  </div>
                  {/* Crown on level 5 message about boss */}
                  {currentLevel === 4 && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', fontSize: 16 }}>👑</div>}
                </div>
              </div>

              {/* Speech bubble */}
              <div className="mb-20 mx-4 ml-20 flex-1 flex items-end">
                <div className="relative rounded-2xl px-4 py-3" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', backdropFilter: 'blur(8px)', maxWidth: 260 }}>
                  {/* Tail */}
                  <div style={{ position: 'absolute', bottom: -8, left: 20, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid rgba(168,85,247,0.4)' }} />
                  <div className="text-white text-sm leading-relaxed">{ld.msg[cutIdx]}</div>
                  <div className="text-white/40 text-[10px] mt-1 text-right">{cutIdx + 1}/{ld.msg.length}</div>
                </div>
              </div>

              {/* Continue button */}
              <button
                onClick={handleCutNext}
                className="absolute bottom-4 right-4 px-6 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
                style={{ background: 'rgba(168,85,247,0.9)', boxShadow: '0 0 20px rgba(168,85,247,0.5)' }}
              >
                {cutIdx < ld.msg.length - 1 ? 'Devam →' : 'Oyna! ▶'}
              </button>

              {/* Skip */}
              <button onClick={() => { if (gs) { gs.screen = 'play'; setScreen('play'); } }} className="absolute bottom-4 left-4 text-white/30 text-xs">
                Atla
              </button>
            </div>
          )}

          {/* ── PAUSE ── */}
          {screen === 'pause' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(5,0,20,0.85)', backdropFilter: 'blur(6px)' }}>
              <div className="text-white font-black text-2xl tracking-widest mb-2">⏸ PAUSE</div>
              <button onClick={() => { if (gs) { gs.screen = 'play'; setScreen('play'); } }} className="px-8 py-2.5 rounded-full font-bold text-sm" style={{ background: 'rgba(168,85,247,0.8)', boxShadow: '0 0 16px rgba(168,85,247,0.4)' }}>
                Devam Et ▶
              </button>
              <button onClick={handleRetry} className="px-8 py-2.5 rounded-full font-bold text-sm" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <span className="flex items-center gap-2 text-white"><RotateCcw size={14} /> Yeniden Başla</span>
              </button>
              <button onClick={() => setScreen('menu')} className="text-white/40 text-sm mt-2">Ana Menü</button>
            </div>
          )}

          {/* ── LEVEL COMPLETE ── */}
          {screen === 'lvlwin' && gs && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(5,0,20,0.90)', backdropFilter: 'blur(6px)' }}>
              <div className="text-5xl mb-1">🏆</div>
              <div className="font-black text-xl text-white tracking-widest">BÖLÜM TAMAMLANDI!</div>
              <div className="text-sm" style={{ color: ld.acc }}>Bölüm {currentLevel + 1}: {ld.name}</div>
              <div className="flex gap-6 my-2">
                <div className="text-center">
                  <div className="text-yellow-400 font-bold text-xl">{gs.score.toLocaleString()}</div>
                  <div className="text-white/40 text-[10px]">PUAN</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-bold text-xl">{'♥'.repeat(gs.lives)}</div>
                  <div className="text-white/40 text-[10px]">HAYAT</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-400 font-bold text-xl">{gs.gotCollect}/{gs.items.length}</div>
                  <div className="text-white/40 text-[10px]">KOLEKSIYON</div>
                </div>
              </div>
              <button onClick={handleNextLevel} className="mt-1 px-10 py-3 rounded-full font-bold text-sm" style={{ background: ld.acc, color: '#000', boxShadow: `0 0 20px ${ld.acc}66` }}>
                {currentLevel + 1 >= LEVELS.length ? '🏆 Finale Git' : `Bölüm ${currentLevel + 2} →`}
              </button>
            </div>
          )}

          {/* ── GAME OVER ── */}
          {screen === 'over' && gs && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(15,0,0,0.92)', backdropFilter: 'blur(6px)' }}>
              <div className="text-5xl">💀</div>
              <div className="font-black text-xl text-red-400 tracking-widest">GAME OVER</div>
              <div className="text-white/50 text-sm">Bölüm {currentLevel + 1} · {gs.score.toLocaleString()} puan</div>
              <button onClick={handleRetry} className="mt-2 px-10 py-3 rounded-full font-bold text-sm" style={{ background: 'rgba(168,85,247,0.8)', boxShadow: '0 0 16px rgba(168,85,247,0.4)' }}>
                <span className="flex items-center gap-2"><RotateCcw size={14} /> Tekrar Dene</span>
              </button>
              <button onClick={() => setScreen('menu')} className="text-white/40 text-sm">Ana Menü</button>
            </div>
          )}

          {/* ── VICTORY ── */}
          {screen === 'victory' && gs && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.3) 0%, rgba(5,0,20,0.95) 70%)' }}>
              {/* Confetti-like decorations */}
              {[...Array(16)].map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: `${(i * 67 + 10) % 95}%`, top: `${(i * 43 + 5) % 90}%`, width: 6, height: 6, borderRadius: '50%', background: ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7'][i % 6], opacity: 0.6, animation: 'none' }} />
              ))}
              <div className="text-5xl">👑</div>
              <div className="font-black text-2xl tracking-widest" style={{ color: '#FFD700', textShadow: '0 0 30px #FFD70088' }}>TÜM BÖLÜMLER</div>
              <div className="font-black text-2xl tracking-widest" style={{ color: '#FFD700', textShadow: '0 0 30px #FFD70088' }}>TAMAMLANDI!</div>
              <div className="text-white/70 text-sm">Tebrikler, ASPECT Şampiyonu!</div>
              <div className="flex gap-6 my-2">
                <div className="text-center">
                  <div className="text-yellow-400 font-black text-2xl">{gs.score.toLocaleString()}</div>
                  <div className="text-white/40 text-[10px]">TOPLAM PUAN</div>
                </div>
              </div>
              {/* Unlocked character notification */}
              <div className="px-4 py-2 rounded-xl text-center text-xs" style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', maxWidth: 260 }}>
                🔓 <span className="text-yellow-400 font-bold">Patron Modu Özgür</span> karakteri açıldı!<br/>
                <span className="text-white/40">Tüm bölümleri tamamladın!</span>
              </div>
              <button onClick={() => setScreen('menu')} className="mt-2 px-10 py-3 rounded-full font-bold text-sm" style={{ background: 'rgba(255,215,0,0.8)', color: '#000', boxShadow: '0 0 24px rgba(255,215,0,0.4)' }}>
                Ana Menüye Dön
              </button>
            </div>
          )}
        </div>

        {/* ── Mobile Touch Controls ── */}
        {(screen === 'play' || screen === 'pause') && (
          <div className="flex justify-between items-end w-full px-2 pt-2 pb-1 flex-shrink-0" style={{ maxWidth: 520 }}>
            {/* Left: movement */}
            <div className="flex gap-2">
              <button
                {...mkTouch('left')}
                className="w-16 h-14 rounded-2xl flex items-center justify-center select-none active:scale-95 transition-transform"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', touchAction: 'none', userSelect: 'none' }}
              >
                <span className="text-white/80 text-2xl">◀</span>
              </button>
              <button
                {...mkTouch('right')}
                className="w-16 h-14 rounded-2xl flex items-center justify-center select-none active:scale-95 transition-transform"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', touchAction: 'none', userSelect: 'none' }}
              >
                <span className="text-white/80 text-2xl">▶</span>
              </button>
            </div>

            {/* Center: pause */}
            <button
              onClick={() => {
                const g2 = gsRef.current;
                if (g2?.screen === 'play')  { g2.screen = 'pause'; setScreen('pause'); }
                else if (g2?.screen === 'pause') { g2.screen = 'play'; setScreen('play'); }
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <span className="text-white/50 text-sm">{screen === 'pause' ? '▶' : '⏸'}</span>
            </button>

            {/* Right: camera + jump */}
            <div className="flex gap-2">
              <button
                onTouchStart={(e) => { e.preventDefault(); touchRef.current.cam = true; inputRef.current.camPress = true; }}
                onTouchEnd={(e) => { e.preventDefault(); touchRef.current.cam = false; }}
                onMouseDown={(e) => { e.preventDefault(); touchRef.current.cam = true; inputRef.current.camPress = true; }}
                onMouseUp={() => touchRef.current.cam = false}
                className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center select-none active:scale-95 transition-transform"
                style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.35)', touchAction: 'none', userSelect: 'none' }}
              >
                <span className="text-xl">📷</span>
                <span className="text-yellow-400/60 text-[8px] font-bold">FLASH</span>
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); touchRef.current.jump = true; inputRef.current.jumpPress = true; }}
                onTouchEnd={(e) => { e.preventDefault(); touchRef.current.jump = false; }}
                onMouseDown={(e) => { e.preventDefault(); touchRef.current.jump = true; inputRef.current.jumpPress = true; }}
                onMouseUp={() => touchRef.current.jump = false}
                className="w-16 h-14 rounded-2xl flex flex-col items-center justify-center select-none active:scale-95 transition-transform"
                style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.5)', touchAction: 'none', userSelect: 'none' }}
              >
                <span className="text-white/80 text-2xl">↑</span>
                <span className="text-purple-300/60 text-[8px] font-bold">JUMP</span>
              </button>
            </div>
          </div>
        )}

        {/* Controls hint */}
        {screen === 'menu' && (
          <div className="text-center mt-2 pb-2">
            <div className="text-white/30 text-[10px]">⌨️ A/D veya ← → hareket · Boşluk/↑ zıpla · E/Shift kamera</div>
            <div className="text-white/20 text-[10px]">📱 Mobil: ekranda butonları kullan</div>
          </div>
        )}
      </div>

      {/* Leaderboard panel */}
      {showLB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setShowLB(false)}>
          <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(20,0,40,0.97),rgba(10,0,25,0.97))', border: '1px solid rgba(168,85,247,0.3)', backdropFilter: 'blur(20px)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Trophy size={16} className="text-yellow-400" />
              <span className="text-white font-bold text-sm">SKOR TABLOSU</span>
              <button onClick={() => setShowLB(false)} className="ml-auto text-white/40 text-lg leading-none">×</button>
            </div>
            <div className="p-3 flex flex-col gap-1.5">
              {lb.length === 0 && <div className="text-white/30 text-sm text-center py-4">Henüz skor yok</div>}
              {lb.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
                  <span className="text-base w-5 text-center">{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-semibold truncate">{e.name}</div>
                    <div className="text-white/30 text-[10px]">Bölüm {e.level} · {e.date}</div>
                  </div>
                  <div className="text-yellow-400 font-bold text-xs">{e.score.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
