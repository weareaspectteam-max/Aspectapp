/**
 * ASPECT RUNNER — Infinite side-scrolling runner game
 * 5 themes · Double jump · 3 lives · Coins · Combo · Shield · Milestones · Scoreboard
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Trophy, Play, Heart, Shield as ShieldIcon, Star } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { UserRole } from './login';

interface AspectRunnerProps {
  userName: string;
  userRole: UserRole;
  accessToken: string;
  onBack: () => void;
}

// ── Canvas dimensions ────────────────────────────────────────────────────────
const CW = 480;
const CH = 420;
const GROUND_Y = 345;
const PLAYER_X = 85;
const PLAYER_W = 26;
const PLAYER_H = 44;
const GRAVITY = 0.58;
const JUMP_FORCE = -13.5;
const DBL_JUMP_FORCE = -11.5;
const THEME_DIST = 2000;

// ── Photography tips ─────────────────────────────────────────────────────────
const PHOTO_TIPS = [
  { title: 'Kural Üçleri', tip: 'Konuyu merkeze koyma! 3×3 çizgi kesişimlerine yerleştir.' },
  { title: 'Altın Saat ✨', tip: 'Gün doğumundan 1 saat sonra en sıcak, yumuşak ışık.' },
  { title: 'ISO Değeri', tip: 'ISO düşük = az gürültü. Gündüz ISO 100-400 ideal.' },
  { title: 'Diyafram (f/)', tip: 'f/1.8 → bulanık arka plan. f/11 → her şey net.' },
  { title: 'Enstantane Hızı', tip: '1/1000s hareketi dondurur, 1/30s akış hissi verir.' },
  { title: 'Beyaz Denge', tip: 'Günışığı 5600K, gölge 7000K, tungsten 3200K.' },
  { title: 'Doğal Çerçeve', tip: 'Dallar, kapılar, pencereler… derinlik ve anlam katar.' },
  { title: 'Işık Yönü', tip: 'Yan ışık dramatik gölge. Arka ışık güzel silüet yaratır.' },
  { title: 'Alan Derinliği', tip: 'Bulanıklık için: geniş diyafram + konuya yaklaş.' },
  { title: 'Histogram', tip: 'Sağa kayık = aşırı pozlama. Sola kayık = az pozlama.' },
  { title: 'Bakış Açısı', tip: 'Çömel, yüksel, yana eğil! Sıradan açıyı değiştir.' },
  { title: 'Kompozisyon', tip: 'Öne yakın element + arkada konu → harika derinlik!' },
];

// ── Character speeches ───────────────────────────────────────────────────────
const CHAR_SPEECHES = [
  'Dur biraz... nefes... 😮‍💨',
  'Ben fotoğrafçıyım, atlet değil!',
  'Bacaklarım grevde artık!',
  'Bu kamera neden bu kadar ağır?!',
  'Bir mola yeter mi?',
  'Aspect beni görse böyle koşturmaz!',
  'Oksijen... oksijen lütfen...',
  'Neden manzara bize gelmez ki?!',
  'Ayakkabı bağım çözüldü! 👟',
  'Kameramı bırakalım mı?! 😤',
  'Fotoğraf mı, maraton mu bu?!',
];

const COACH_SPEECHES = [
  'Hadi bakalım, koş koş!',
  'Dur durma, devam!',
  'Az kaldı az kaldı, çabuk!',
  'Bırakma şimdi, devam et!',
  'Aspect seni izliyor, hadi!',
  'Bu kadar mı?! Koş artık!',
  'Haydi haydi haydi! 🏃',
  'Ses çıkmasın, hız çıksın!',
  'Güzel, devam et öyle!',
  'Coinleri topla, kaçma!',
];

const MILESTONE_MSGS: Record<number, string> = {
  100:  '🎯 100 PUAN!',
  300:  '🔥 ALEV ALEV!',
  500:  '⚡ 500 PUAN!',
  1000: '🏆 BİN PUAN!',
  2000: '🚀 EFSANE!',
  3000: '👑 ASPECT RUNNER!',
  5000: '💎 ULTRA RUNNER!',
};

// ── Themes ───────────────────────────────────────────────────────────────────
const THEMES = [
  {
    name: 'Altın Saat', emoji: '🌅',
    sky1: '#FF6B35', sky2: '#FFB347',
    groundSurface: '#A0522D', groundDeep: '#8B4513',
    obstacleA: '#5C3317', obstacleB: '#3D2010',
    playerBody: '#FF9F1C', playerHead: '#FFCF77',
    accent: '#FFE66D', groundTxt: '#FFD70099',
    neon: false, pixel: false, lightning: false,
    cloudColor: 'rgba(255,255,255,0.3)',
    treeTrunk: '#6B4423', treeLeaf: '#228B22',
    mountainColor: 'rgba(180,100,60,0.35)',
  },
  {
    name: 'Gece Şehri', emoji: '🌃',
    sky1: '#0D0D2B', sky2: '#1A1A4F',
    groundSurface: '#1A1A2E', groundDeep: '#0D0D1A',
    obstacleA: '#0F3460', obstacleB: '#072240',
    playerBody: '#E94560', playerHead: '#F07070',
    accent: '#00F5FF', groundTxt: '#FF00FFAA',
    neon: true, pixel: false, lightning: false,
    cloudColor: 'rgba(0,245,255,0.08)',
    treeTrunk: '#1A3A5C', treeLeaf: '#0F3460',
    mountainColor: 'rgba(15,52,96,0.6)',
  },
  {
    name: 'Retro Piksel', emoji: '🎮',
    sky1: '#2D004B', sky2: '#4A0080',
    groundSurface: '#006400', groundDeep: '#004000',
    obstacleA: '#8B0000', obstacleB: '#600000',
    playerBody: '#FF00FF', playerHead: '#FF88FF',
    accent: '#00FF00', groundTxt: '#00FF0099',
    neon: false, pixel: true, lightning: false,
    cloudColor: 'rgba(0,255,0,0.08)',
    treeTrunk: '#8B4513', treeLeaf: '#00AA00',
    mountainColor: 'rgba(80,0,80,0.5)',
  },
  {
    name: 'Mavi Saat', emoji: '🌊',
    sky1: '#001233', sky2: '#023E8A',
    groundSurface: '#012159', groundDeep: '#001845',
    obstacleA: '#0077B6', obstacleB: '#005A87',
    playerBody: '#48CAE4', playerHead: '#90E0EF',
    accent: '#ADE8F4', groundTxt: '#48CAE488',
    neon: false, pixel: false, lightning: false,
    cloudColor: 'rgba(173,232,244,0.08)',
    treeTrunk: '#023E8A', treeLeaf: '#0077B6',
    mountainColor: 'rgba(0,119,182,0.3)',
  },
  {
    name: 'Fırtına', emoji: '⚡',
    sky1: '#0A0A0A', sky2: '#1C1C1C',
    groundSurface: '#2D2D2D', groundDeep: '#1A1A1A',
    obstacleA: '#555555', obstacleB: '#333333',
    playerBody: '#FFD700', playerHead: '#FFE878',
    accent: '#FFFFFF', groundTxt: '#FFFF0088',
    neon: false, pixel: false, lightning: true,
    cloudColor: 'rgba(255,255,255,0.05)',
    treeTrunk: '#444444', treeLeaf: '#333333',
    mountainColor: 'rgba(80,80,80,0.4)',
  },
];

const BRAND_TEXTS = [
  'ASPECT', 'ASPECT PHOTOGRAPHY', 'ASPECT TEAM', 'ASPECT OPS',
  'ASPECT RUNNER', 'ASPECT STUDIO', 'ASPECT ✦',
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Player {
  x: number; y: number; vy: number;
  jumpsLeft: number; walkFrame: number;
  dead: boolean; deadTimer: number;
}
interface Obstacle {
  x: number; y: number; w: number; h: number;
  type: 'cactus' | 'bird' | 'rock' | 'flash';
  id: number;
  passed: boolean;
}
interface Photo {
  x: number; y: number;
  collected: boolean; collectTimer: number;
  tipIdx: number;
}
interface Coin {
  x: number; y: number; baseY: number;
  collected: boolean; collectTimer: number;
  bobPhase: number;
}
interface ShieldPU {
  x: number; y: number;
  collected: boolean; collectTimer: number;
}
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  color: string; r: number;
}
interface BrandText { x: number; text: string; }
interface BgEl {
  x: number; y: number; speed: number;
  type: 'cloud' | 'building' | 'mountain' | 'tree';
  w: number; h: number; layer: number;
}
interface Speech { text: string; timer: number; }

interface G {
  status: 'playing' | 'dead';
  player: Player;
  obstacles: Obstacle[];
  photos: Photo[];
  coins: Coin[];
  shields: ShieldPU[];
  particles: Particle[];
  brandTexts: BrandText[];
  bgEls: BgEl[];
  score: number;
  distance: number;
  speed: number;
  frame: number;
  themeIdx: number;
  // lives
  lives: number;
  invTimer: number;         // invincibility frames after hit
  // combo
  combo: number;
  comboTimer: number;
  // shield
  shieldActive: boolean;
  shieldTimer: number;
  // speeches
  charSpeech: Speech | null;
  coachSpeech: Speech | null;
  activeTip: { title: string; tip: string; timer: number } | null;
  milestone: { text: string; timer: number } | null;
  lastMilestoneScore: number;
  // spawn countdowns
  lastObstX: number;
  nextObstGap: number;
  lastPhotoX: number;
  nextPhotoGap: number;
  lastCoinX: number;
  nextCoinGap: number;
  lastShieldX: number;
  nextShieldGap: number;
  lastBrandX: number;
  lightningTimer: number;
  lastCharDist: number;
  lastCoachDist: number;
  obstacleIdCounter: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max)); }
function pick<T>(arr: T[]): T { return arr[rndInt(0, arr.length)]; }

function spawnParticles(g: G, x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rnd(-0.3, 0.3);
    const speed = rnd(1.5, 4);
    g.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rnd(1, 3),
      life: 40, maxLife: 40,
      color, r: rnd(2, 5),
    });
  }
}

function initG(): G {
  const bgEls: BgEl[] = [];
  // Layer 1: distant mountains
  for (let i = 0; i < 6; i++) {
    bgEls.push({ x: rnd(0, CW), y: rnd(150, 220), speed: 0.15, type: 'mountain', w: rnd(120, 220), h: rnd(80, 140), layer: 1 });
  }
  // Layer 2: mid clouds/buildings
  for (let i = 0; i < 8; i++) {
    bgEls.push({ x: rnd(0, CW), y: rnd(80, 180), speed: 0.35, type: 'cloud', w: rnd(70, 140), h: rnd(28, 55), layer: 2 });
  }
  // Layer 3: near trees
  for (let i = 0; i < 6; i++) {
    bgEls.push({ x: rnd(0, CW), y: GROUND_Y - rnd(60, 110), speed: 0.6, type: 'tree', w: rnd(18, 30), h: rnd(60, 110), layer: 3 });
  }
  return {
    status: 'playing',
    player: { x: PLAYER_X, y: GROUND_Y - PLAYER_H, vy: 0, jumpsLeft: 2, walkFrame: 0, dead: false, deadTimer: 0 },
    obstacles: [], photos: [], coins: [], shields: [], particles: [],
    brandTexts: [], bgEls,
    score: 0, distance: 0, speed: 5, frame: 0, themeIdx: 0,
    lives: 3, invTimer: 0,
    combo: 0, comboTimer: 0,
    shieldActive: false, shieldTimer: 0,
    charSpeech: null, coachSpeech: null, activeTip: null,
    milestone: null, lastMilestoneScore: 0,
    lastObstX: rnd(350, 500),
    nextObstGap: rnd(300, 450),
    lastPhotoX: rnd(700, 1000),
    nextPhotoGap: rnd(700, 1000),
    lastCoinX: rnd(200, 350),
    nextCoinGap: rnd(180, 280),
    lastShieldX: rnd(2000, 3000),
    nextShieldGap: rnd(2000, 3500),
    lastBrandX: 200,
    lightningTimer: 0,
    lastCharDist: 0,
    lastCoachDist: 500,
    obstacleIdCounter: 0,
  };
}

function update(g: G) {
  if (g.status !== 'playing') return;
  g.frame++;

  const theme = THEMES[g.themeIdx];

  // Speed ramp
  g.speed = 5 + Math.min(8, g.distance / 700);

  // Distance & base score
  g.distance += g.speed;
  const comboMult = g.combo >= 10 ? 3 : g.combo >= 5 ? 2 : g.combo >= 3 ? 1.5 : 1;
  g.score = Math.round(g.distance / 5 * comboMult);

  // Theme switch
  const newTheme = Math.floor(g.distance / THEME_DIST) % THEMES.length;
  if (newTheme !== g.themeIdx) g.themeIdx = newTheme;

  // Milestone check
  const milestones = Object.keys(MILESTONE_MSGS).map(Number);
  for (const m of milestones) {
    if (g.score >= m && g.lastMilestoneScore < m) {
      g.milestone = { text: MILESTONE_MSGS[m], timer: 150 };
      g.lastMilestoneScore = m;
    }
  }
  if (g.milestone) {
    g.milestone.timer--;
    if (g.milestone.timer <= 0) g.milestone = null;
  }

  // Combo timer decay
  if (g.combo > 0) {
    g.comboTimer--;
    if (g.comboTimer <= 0) g.combo = 0;
  }

  // Shield timer
  if (g.shieldActive) {
    g.shieldTimer--;
    if (g.shieldTimer <= 0) g.shieldActive = false;
  }

  // Invincibility frames
  if (g.invTimer > 0) g.invTimer--;

  // BG parallax
  for (const el of g.bgEls) {
    el.x -= el.speed * g.speed * 0.22;
    if (el.x + el.w < 0) {
      el.x = CW + rnd(0, 80);
      el.y = el.type === 'tree' ? GROUND_Y - rnd(60, 110) : el.type === 'mountain' ? rnd(150, 220) : rnd(80, 180);
      el.w = el.type === 'tree' ? rnd(18, 30) : el.type === 'mountain' ? rnd(120, 220) : rnd(70, 140);
      el.h = el.type === 'tree' ? rnd(60, 110) : el.type === 'mountain' ? rnd(80, 140) : rnd(28, 55);
    }
  }

  // Player walk animation
  if (g.frame % 8 === 0) g.player.walkFrame = (g.player.walkFrame + 1) % 4;

  // Player physics
  const p = g.player;
  if (!p.dead) {
    p.vy += GRAVITY;
    p.y += p.vy;
    if (p.y >= GROUND_Y - PLAYER_H) {
      p.y = GROUND_Y - PLAYER_H;
      p.vy = 0;
      p.jumpsLeft = 2;
    }
  } else {
    p.deadTimer++;
    p.vy += GRAVITY * 0.5;
    p.y += p.vy;
    p.x -= 1.5;
    if (p.deadTimer > 80) { g.status = 'dead'; return; }
  }

  // ── Obstacles ──
  const minGap = Math.max(160, 380 - g.speed * 15);
  g.lastObstX -= g.speed;
  if (g.lastObstX <= 0) {
    const types: Obstacle['type'][] = ['cactus', 'cactus', 'rock', 'bird'];
    const type = pick(types);
    let oy: number, ow: number, oh: number;
    if (type === 'bird') { oh = 22; ow = 36; oy = GROUND_Y - PLAYER_H - rnd(40, 100); }
    else if (type === 'rock') { oh = rndInt(22, 36); ow = rndInt(30, 44); oy = GROUND_Y - oh; }
    else { oh = rndInt(36, 56); ow = rndInt(18, 28); oy = GROUND_Y - oh; }
    g.obstacles.push({ x: CW + 30, y: oy, w: ow, h: oh, type, id: g.obstacleIdCounter++, passed: false });
    g.nextObstGap = rnd(minGap, minGap + 220);
    g.lastObstX = g.nextObstGap;
  }
  for (const o of g.obstacles) {
    o.x -= g.speed;
    // Combo: obstacle cleared
    if (!o.passed && o.x + o.w < PLAYER_X - 10) {
      o.passed = true;
      g.combo++;
      g.comboTimer = 120;
    }
  }
  g.obstacles = g.obstacles.filter(o => o.x + o.w > -40);

  // ── Coins ──
  g.lastCoinX -= g.speed;
  if (g.lastCoinX <= 0) {
    const clusterSize = rndInt(1, 4);
    for (let i = 0; i < clusterSize; i++) {
      const baseY = GROUND_Y - rnd(30, 90);
      g.coins.push({
        x: CW + 30 + i * 28,
        y: baseY, baseY,
        collected: false, collectTimer: 0,
        bobPhase: rnd(0, Math.PI * 2),
      });
    }
    g.nextCoinGap = rnd(150, 280);
    g.lastCoinX = g.nextCoinGap;
  }
  for (const c of g.coins) {
    c.x -= g.speed;
    c.y = c.baseY + Math.sin(g.frame * 0.1 + c.bobPhase) * 5;
    if (c.collected) c.collectTimer++;
  }
  g.coins = g.coins.filter(c => c.x > -40 && c.collectTimer < 35);

  // ── Shield power-up ──
  g.lastShieldX -= g.speed;
  if (g.lastShieldX <= 0) {
    g.shields.push({ x: CW + 30, y: GROUND_Y - PLAYER_H - 20, collected: false, collectTimer: 0 });
    g.nextShieldGap = rnd(2000, 3500);
    g.lastShieldX = g.nextShieldGap;
  }
  for (const s of g.shields) {
    s.x -= g.speed;
    if (s.collected) s.collectTimer++;
  }
  g.shields = g.shields.filter(s => s.x > -40 && s.collectTimer < 40);

  // ── Photos ──
  g.lastPhotoX -= g.speed;
  if (g.lastPhotoX <= 0) {
    g.photos.push({ x: CW + 40, y: GROUND_Y - PLAYER_H - rnd(20, 80), collected: false, collectTimer: 0, tipIdx: rndInt(0, PHOTO_TIPS.length) });
    g.nextPhotoGap = rnd(800, 1200);
    g.lastPhotoX = g.nextPhotoGap;
  }
  for (const ph of g.photos) {
    ph.x -= g.speed;
    if (ph.collected) ph.collectTimer++;
  }
  g.photos = g.photos.filter(ph => ph.x > -50 && ph.collectTimer < 40);

  // ── Brand texts ──
  const lastBT = g.brandTexts[g.brandTexts.length - 1];
  if (!lastBT || (lastBT.x < CW - rnd(700, 1200))) {
    g.brandTexts.push({ x: CW + 50, text: pick(BRAND_TEXTS) });
  }
  for (const bt of g.brandTexts) bt.x -= g.speed * 0.85;
  g.brandTexts = g.brandTexts.filter(bt => bt.x > -400);

  // ── Particles ──
  for (const pt of g.particles) {
    pt.x += pt.vx; pt.y += pt.vy;
    pt.vy += 0.18;
    pt.life--;
  }
  g.particles = g.particles.filter(pt => pt.life > 0);

  // ── Collision detection ──
  if (!p.dead && g.invTimer === 0) {
    const px1 = p.x + 4, px2 = p.x + PLAYER_W - 4;
    const py1 = p.y + 4, py2 = p.y + PLAYER_H - 4;

    for (const o of g.obstacles) {
      const ox1 = o.x + 3, ox2 = o.x + o.w - 3;
      const oy1 = o.y + 3, oy2 = o.y + o.h - 3;
      if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
        spawnParticles(g, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, '#f87171', 10);
        if (g.shieldActive) {
          // Shield absorbs hit
          g.shieldActive = false;
          g.shieldTimer = 0;
          g.combo = 0;
          g.invTimer = 90;
          spawnParticles(g, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, '#60a5fa', 14);
          // push obstacle away
          o.x = px2 + 10;
        } else {
          g.lives--;
          g.combo = 0;
          g.invTimer = 120;
          if (g.lives <= 0) {
            p.dead = true;
            p.vy = -8;
          } else {
            p.vy = -6; // small hop on hit
          }
        }
        break;
      }
    }

    // Coin collection
    for (const c of g.coins) {
      if (!c.collected) {
        if (px1 < c.x + 10 && px2 > c.x - 10 && py1 < c.y + 10 && py2 > c.y - 10) {
          c.collected = true;
          g.score += Math.round(10 * comboMult);
          g.combo++;
          g.comboTimer = 120;
          spawnParticles(g, c.x, c.y, '#FFD700', 6);
        }
      }
    }

    // Shield collection
    for (const s of g.shields) {
      if (!s.collected) {
        if (px1 < s.x + 14 && px2 > s.x - 14 && py1 < s.y + 14 && py2 > s.y - 14) {
          s.collected = true;
          g.shieldActive = true;
          g.shieldTimer = 600;
          spawnParticles(g, s.x, s.y, '#60a5fa', 10);
        }
      }
    }

    // Photo collection
    for (const ph of g.photos) {
      if (!ph.collected) {
        if (px1 < ph.x + 16 && px2 > ph.x - 16 && py1 < ph.y + 16 && py2 > ph.y - 16) {
          ph.collected = true;
          g.score += Math.round(50 * comboMult);
          if (!g.activeTip) g.activeTip = { ...PHOTO_TIPS[ph.tipIdx], timer: 220 };
          spawnParticles(g, ph.x, ph.y, '#FFD700', 8);
        }
      }
    }
  }

  // ── Tip timer ──
  if (g.activeTip) { g.activeTip.timer--; if (g.activeTip.timer <= 0) g.activeTip = null; }

  // ── Speeches ──
  if (g.charSpeech) { g.charSpeech.timer--; if (g.charSpeech.timer <= 0) g.charSpeech = null; }
  if (!g.charSpeech && g.distance - g.lastCharDist > rnd(900, 1400) && !p.dead) {
    g.charSpeech = { text: pick(CHAR_SPEECHES), timer: 160 };
    g.lastCharDist = g.distance;
  }
  if (g.coachSpeech) { g.coachSpeech.timer--; if (g.coachSpeech.timer <= 0) g.coachSpeech = null; }
  if (!g.coachSpeech && g.distance - g.lastCoachDist > rnd(1300, 1900) && !p.dead) {
    g.coachSpeech = { text: pick(COACH_SPEECHES), timer: 140 };
    g.lastCoachDist = g.distance;
  }

  // ── Lightning ──
  if (theme.lightning) {
    g.lightningTimer--;
    if (g.lightningTimer <= 0) g.lightningTimer = rndInt(-200, -60);
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function draw(ctx: CanvasRenderingContext2D, g: G) {
  const theme = THEMES[g.themeIdx];
  const p = g.player;

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, theme.sky1);
  skyGrad.addColorStop(1, theme.sky2);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CW, CH);

  // Milestone flash
  if (g.milestone && g.milestone.timer > 130) {
    const alpha = ((g.milestone.timer - 130) / 20) * 0.25;
    ctx.fillStyle = `rgba(255,215,0,${alpha})`;
    ctx.fillRect(0, 0, CW, CH);
  }

  // Lightning
  if (theme.lightning && g.lightningTimer > -5 && g.lightningTimer <= 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = 'rgba(255,255,200,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const lx = rnd(80, 400);
    ctx.moveTo(lx, 0); ctx.lineTo(lx - 20, 80); ctx.lineTo(lx + 15, 100); ctx.lineTo(lx - 30, 180);
    ctx.stroke();
  }

  // BG elements (sorted by layer)
  const sorted = [...g.bgEls].sort((a, b) => a.layer - b.layer);
  drawBgEls(ctx, sorted, theme);

  // Ground brand texts
  ctx.save();
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = theme.groundTxt;
  for (const bt of g.brandTexts) ctx.fillText(bt.text, bt.x, GROUND_Y + 12);
  ctx.restore();

  // Ground
  ctx.fillStyle = theme.groundSurface;
  ctx.fillRect(0, GROUND_Y, CW, 18);
  ctx.fillStyle = theme.groundDeep;
  ctx.fillRect(0, GROUND_Y + 18, CW, CH - GROUND_Y - 18);

  // Ground pixel grid
  if (theme.pixel) {
    ctx.fillStyle = 'rgba(0,255,0,0.15)';
    for (let gx = 0; gx < CW; gx += 16) ctx.fillRect(gx, GROUND_Y, 1, 18);
  }
  // Ground neon line
  if (theme.neon) {
    ctx.fillStyle = `rgba(0,245,255,0.18)`;
    ctx.fillRect(0, GROUND_Y, CW, 2);
  }
  // Ground dashes (all themes)
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let dx = (g.frame * g.speed * 0.5) % 80; dx < CW; dx += 80) {
    ctx.fillRect(dx, GROUND_Y + 8, 40, 2);
  }

  // Obstacles
  for (const o of g.obstacles) drawObstacle(ctx, o, theme);

  // Coins
  for (const c of g.coins) drawCoin(ctx, c, theme);

  // Shields
  for (const s of g.shields) drawShield(ctx, s, g.frame);

  // Photos
  for (const ph of g.photos) drawPhoto(ctx, ph, g.frame);

  // Particles
  for (const pt of g.particles) {
    const alpha = pt.life / pt.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player (blink if invincible)
  const showPlayer = g.invTimer === 0 || Math.floor(g.invTimer / 6) % 2 === 0;
  if (showPlayer) {
    // Shield glow
    if (g.shieldActive) {
      ctx.save();
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(96,165,250,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, PLAYER_W * 0.85, PLAYER_H * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawPlayer(ctx, p, theme, g.frame);
  }

  // HUD
  drawHUD(ctx, g, theme);
}

function drawBgEls(ctx: CanvasRenderingContext2D, els: BgEl[], theme: typeof THEMES[0]) {
  for (const el of els) {
    if (el.type === 'mountain') {
      ctx.fillStyle = theme.mountainColor;
      ctx.beginPath();
      ctx.moveTo(el.x, GROUND_Y - 10);
      ctx.lineTo(el.x + el.w * 0.5, el.y);
      ctx.lineTo(el.x + el.w, GROUND_Y - 10);
      ctx.closePath();
      ctx.fill();
      // Snow cap
      if (!theme.neon) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(el.x + el.w * 0.5, el.y);
        ctx.lineTo(el.x + el.w * 0.38, el.y + 24);
        ctx.lineTo(el.x + el.w * 0.62, el.y + 24);
        ctx.closePath();
        ctx.fill();
      }
    } else if (el.type === 'tree') {
      // Trunk
      ctx.fillStyle = theme.treeTrunk;
      ctx.fillRect(el.x + el.w * 0.35, el.y + el.h * 0.55, el.w * 0.3, el.h * 0.45);
      // Canopy layers
      ctx.fillStyle = theme.treeLeaf;
      ctx.beginPath();
      ctx.moveTo(el.x + el.w / 2, el.y);
      ctx.lineTo(el.x, el.y + el.h * 0.45);
      ctx.lineTo(el.x + el.w, el.y + el.h * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(el.x + el.w / 2, el.y + el.h * 0.2);
      ctx.lineTo(el.x - el.w * 0.1, el.y + el.h * 0.65);
      ctx.lineTo(el.x + el.w * 1.1, el.y + el.h * 0.65);
      ctx.closePath();
      ctx.fill();
      if (theme.neon) {
        ctx.strokeStyle = theme.accent + '44';
        ctx.lineWidth = 1;
        ctx.strokeRect(el.x + el.w * 0.35, el.y + el.h * 0.55, el.w * 0.3, el.h * 0.45);
      }
    } else if (el.type === 'building' || theme.neon) {
      ctx.fillStyle = `rgba(15,52,96,0.9)`;
      ctx.fillRect(el.x, el.y, el.w * 0.5, el.h * 2);
      ctx.fillStyle = `rgba(233,69,96,0.4)`;
      ctx.fillRect(el.x + 5, el.y + 10, 6, 6);
      ctx.fillRect(el.x + 18, el.y + 25, 6, 6);
      ctx.fillRect(el.x + 5, el.y + 40, 6, 6);
    } else {
      // Cloud
      ctx.fillStyle = theme.cloudColor;
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * 0.5, el.y + el.h * 0.5, el.w * 0.5, el.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * 0.28, el.y + el.h * 0.4, el.w * 0.3, el.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * 0.72, el.y + el.h * 0.45, el.w * 0.25, el.h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stars
    if (theme.sky1 === THEMES[1].sky1 || theme.sky1 === THEMES[3].sky1 || theme.sky1 === THEMES[4].sky1) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(el.x % CW, (el.y * 0.4) % 80 + 10, 2, 2);
      ctx.fillRect((el.x + 30) % CW, (el.y * 0.3) % 80 + 5, 1, 1);
      ctx.fillRect((el.x + 60) % CW, (el.y * 0.5) % 70 + 20, 1.5, 1.5);
    }
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, theme: typeof THEMES[0]) {
  ctx.fillStyle = theme.obstacleA;

  if (o.type === 'bird') {
    const wingFlap = Math.sin(Date.now() * 0.01) * 0.4;
    ctx.save();
    ctx.translate(o.x + o.w * 0.5, o.y + o.h * 0.5);
    // Wings
    ctx.fillStyle = theme.obstacleB;
    ctx.beginPath();
    ctx.ellipse(-o.w * 0.35, wingFlap * 8, o.w * 0.3, o.h * 0.3, -0.3 + wingFlap, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(o.w * 0.35, wingFlap * 8, o.w * 0.3, o.h * 0.3, 0.3 - wingFlap, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = theme.obstacleA;
    ctx.beginPath();
    ctx.ellipse(0, 0, o.w * 0.22, o.h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#fff'; ctx.fillRect(3, -o.h * 0.2, 4, 4);
    ctx.fillStyle = '#000'; ctx.fillRect(4, -o.h * 0.18, 2, 2);
    ctx.restore();
    if (theme.neon) {
      ctx.strokeStyle = theme.accent + '60'; ctx.lineWidth = 1;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }
  } else if (o.type === 'cactus') {
    // Trunk
    const grad = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
    grad.addColorStop(0, theme.obstacleB);
    grad.addColorStop(0.5, theme.obstacleA);
    grad.addColorStop(1, theme.obstacleB);
    ctx.fillStyle = grad;
    ctx.fillRect(o.x + o.w * 0.3, o.y, o.w * 0.4, o.h);
    // Arms
    ctx.fillRect(o.x, o.y + o.h * 0.3, o.w * 0.35, o.h * 0.12);
    ctx.fillRect(o.x, o.y + o.h * 0.15, o.w * 0.12, o.h * 0.2);
    ctx.fillRect(o.x + o.w * 0.65, o.y + o.h * 0.45, o.w * 0.35, o.h * 0.12);
    ctx.fillRect(o.x + o.w * 0.88, o.y + o.h * 0.3, o.w * 0.12, o.h * 0.2);
    if (theme.neon) { ctx.fillStyle = `rgba(0,245,255,0.25)`; ctx.fillRect(o.x + o.w * 0.3, o.y, o.w * 0.4, o.h); }
    if (theme.pixel) {
      ctx.fillStyle = theme.accent + '33';
      ctx.fillRect(o.x + o.w * 0.28, o.y - 2, o.w * 0.44, o.h + 4);
    }
  } else if (o.type === 'rock') {
    const grad = ctx.createRadialGradient(o.x + o.w * 0.4, o.y + o.h * 0.4, 2, o.x + o.w * 0.5, o.y + o.h * 0.5, o.w * 0.6);
    grad.addColorStop(0, theme.obstacleA);
    grad.addColorStop(1, theme.obstacleB);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * 0.15, o.y + o.h * 0.85);
    ctx.lineTo(o.x + o.w * 0.0, o.y + o.h * 0.6);
    ctx.lineTo(o.x + o.w * 0.2, o.y + o.h * 0.2);
    ctx.lineTo(o.x + o.w * 0.55, o.y);
    ctx.lineTo(o.x + o.w * 0.85, o.y + o.h * 0.15);
    ctx.lineTo(o.x + o.w, o.y + o.h * 0.55);
    ctx.lineTo(o.x + o.w * 0.8, o.y + o.h);
    ctx.lineTo(o.x + o.w * 0.1, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.3, o.y + o.h * 0.3, o.w * 0.15, o.h * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Flash / camera obstacle
    ctx.fillStyle = theme.accent;
    ctx.fillRect(o.x + o.w * 0.2, o.y + o.h * 0.1, o.w * 0.6, o.h * 0.6);
    ctx.fillStyle = theme.obstacleA;
    ctx.fillRect(o.x, o.y + o.h * 0.4, o.w, o.h * 0.4);
    ctx.strokeStyle = theme.accent; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.5, o.y + o.h * 0.4);
      ctx.lineTo(o.x + o.w * 0.5 + Math.cos(angle) * 18, o.y + o.h * 0.4 + Math.sin(angle) * 18);
      ctx.stroke();
    }
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, c: Coin, theme: typeof THEMES[0]) {
  if (c.collected) {
    const alpha = 1 - c.collectTimer / 35;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('+' + 10, c.x - 8, c.y - c.collectTimer * 1.2);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 10;
  // Coin body
  const grad = ctx.createRadialGradient(c.x - 3, c.y - 3, 1, c.x, c.y, 9);
  grad.addColorStop(0, '#FFF176');
  grad.addColorStop(0.5, '#FFD700');
  grad.addColorStop(1, '#F57F17');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
  ctx.fill();
  // Inner ring
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.stroke();
  // Symbol
  ctx.fillStyle = 'rgba(180,100,0,0.7)';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('✦', c.x, c.y + 3);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawShield(ctx: CanvasRenderingContext2D, s: ShieldPU, frame: number) {
  if (s.collected) return;
  const pulse = 0.9 + Math.sin(frame * 0.12) * 0.1;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = '#60a5fa';
  ctx.shadowBlur = 18;
  // Shield shape
  ctx.fillStyle = 'rgba(96,165,250,0.25)';
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(12, -6);
  ctx.lineTo(12, 4);
  ctx.quadraticCurveTo(12, 14, 0, 18);
  ctx.quadraticCurveTo(-12, 14, -12, 4);
  ctx.lineTo(-12, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🛡', 0, 6);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawPhoto(ctx: CanvasRenderingContext2D, ph: Photo, frame: number) {
  if (ph.collected) {
    const alpha = 1 - ph.collectTimer / 40;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText('+50', ph.x - 15, ph.y - ph.collectTimer * 0.8);
    ctx.font = '22px sans-serif';
    ctx.fillText('📸', ph.x - 11, ph.y - 5 - ph.collectTimer * 0.3);
    ctx.restore(); return;
  }
  const pulse = 0.92 + Math.sin(frame * 0.15) * 0.08;
  ctx.save();
  ctx.translate(ph.x, ph.y); ctx.scale(pulse, pulse);
  ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 12;
  ctx.font = '26px sans-serif'; ctx.fillText('📸', -13, 10);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,215,0,0.85)'; ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('ÇEKÜM!', 0, 28); ctx.textAlign = 'left';
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, theme: typeof THEMES[0], frame: number) {
  const x = p.x, y = p.y, wf = p.walkFrame;
  ctx.save();
  if (p.dead) {
    const angle = Math.min(p.deadTimer * 0.05, Math.PI * 0.5);
    ctx.translate(x + PLAYER_W / 2, y + PLAYER_H / 2);
    ctx.rotate(angle);
    ctx.translate(-PLAYER_W / 2, -PLAYER_H / 2);
  }
  const isAir = p.y < GROUND_Y - PLAYER_H - 2;
  // Legs
  ctx.fillStyle = theme.pixel ? '#8800FF' : '#333';
  const legH = 14, legW = 7;
  if (isAir) {
    ctx.fillRect(x + 4, y + PLAYER_H - legH, legW, legH - 4);
    ctx.fillRect(x + PLAYER_W - legW - 4, y + PLAYER_H - legH, legW, legH - 4);
  } else {
    const lo0 = wf === 0 || wf === 3 ? -4 : 4;
    const lo1 = wf === 0 || wf === 3 ? 4 : -4;
    ctx.fillRect(x + 4 + lo0, y + PLAYER_H - legH, legW, legH);
    ctx.fillRect(x + PLAYER_W - legW - 4 + lo1, y + PLAYER_H - legH, legW, legH);
  }
  // Body
  ctx.fillStyle = theme.playerBody;
  ctx.fillRect(x + 3, y + 16, PLAYER_W - 6, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = 'bold 5px monospace';
  ctx.fillText('ASPECT', x + 4, y + 30);
  // Camera
  ctx.fillStyle = '#222'; ctx.fillRect(x + PLAYER_W - 10, y + 18, 10, 7);
  ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(x + PLAYER_W - 4, y + 22, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + PLAYER_W - 8, y + 18); ctx.lineTo(x + 8, y + 20); ctx.stroke();
  // Head
  ctx.fillStyle = theme.playerHead;
  ctx.fillRect(x + 5, y + 2, PLAYER_W - 10, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x + 9, y + 6, 3, 3); ctx.fillRect(x + PLAYER_W - 12, y + 6, 3, 3);
  ctx.fillRect(x + 9, p.dead ? y + 14 : y + 13, PLAYER_W - 18, 2);
  // Pixel hat
  if (theme.pixel) {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + 5, y, PLAYER_W - 10, 4);
    ctx.fillRect(x + 8, y - 4, PLAYER_W - 16, 5);
  }
  ctx.restore();
}

function drawHUD(ctx: CanvasRenderingContext2D, g: G, theme: typeof THEMES[0]) {
  const comboMult = g.combo >= 10 ? 3 : g.combo >= 5 ? 2 : g.combo >= 3 ? 1.5 : 1;

  // Score
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = theme.accent; ctx.shadowBlur = 10;
  ctx.fillText(`${g.score}`, CW - 94, 30);
  ctx.shadowBlur = 0;
  ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('SKOR', CW - 94, 44);

  // Theme name
  ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = theme.accent;
  ctx.fillText(`${theme.emoji} ${theme.name}`, 14, 26);

  // Speed bar
  const speedPct = (g.speed - 5) / 8;
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(14, 32, 70, 4);
  ctx.fillStyle = theme.accent; ctx.fillRect(14, 32, 70 * speedPct, 4);
  ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('HIZ', 14, 46);

  // Theme dots
  for (let i = 0; i < THEMES.length; i++) {
    ctx.fillStyle = i === g.themeIdx ? theme.accent : 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(CW / 2 - THEMES.length * 8 + i * 16, 14, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Lives (hearts)
  for (let i = 0; i < 3; i++) {
    ctx.font = '14px sans-serif';
    ctx.globalAlpha = i < g.lives ? 1 : 0.2;
    ctx.fillText('❤️', CW - 100 + i * 18, 58);
  }
  ctx.globalAlpha = 1;

  // Shield indicator
  if (g.shieldActive) {
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#60a5fa';
    ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 8;
    ctx.fillText('🛡 KALKAN', 14, 58);
    ctx.shadowBlur = 0;
    // Shield timer bar
    ctx.fillStyle = 'rgba(96,165,250,0.2)'; ctx.fillRect(14, 62, 70, 3);
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(14, 62, 70 * (g.shieldTimer / 600), 3);
  }

  // Combo multiplier
  if (g.combo >= 3) {
    const multLabel = comboMult === 3 ? '×3 🔥🔥🔥' : comboMult === 2 ? '×2 🔥🔥' : '×1.5 🔥';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = comboMult >= 2 ? '#FF4500' : '#FFD700';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
    ctx.textAlign = 'center';
    ctx.fillText(multLabel, CW / 2, 44);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
    // Combo count
    ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(`KOMBO x${g.combo}`, CW / 2, 56);
    ctx.textAlign = 'left';
  }
}

// ── Score API ─────────────────────────────────────────────────────────────────
interface ScoreEntry { sira: number; isim: string; skor: number; tarih: string; }

async function saveScore(score: number, accessToken: string, temaSayisi: number) {
  try {
    await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4da0b637/game/skor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': accessToken },
      body: JSON.stringify({ skor: score, temaSayisi }),
    });
  } catch (e) { console.error('Score save error:', e); }
}

async function fetchScores(tip: 'haftalik' | 'tumzamanlar', accessToken: string): Promise<ScoreEntry[]> {
  try {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637/game/skorlar?tip=${tip}`,
      { headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': accessToken } },
    );
    const data = await res.json();
    return data.skorlar || [];
  } catch (e) { console.error('Score fetch error:', e); return []; }
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AspectRunner({ userName, userRole, accessToken, onBack }: AspectRunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<G | null>(null);
  const rafRef = useRef<number>(0);

  const [uiState, setUiState] = useState<'menu' | 'playing' | 'dead' | 'scoreboard'>('menu');
  const [displayScore, setDisplayScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [shieldActive, setShieldActive] = useState(false);
  const [charSpeech, setCharSpeech] = useState<string | null>(null);
  const [coachSpeech, setCoachSpeech] = useState<string | null>(null);
  const [activeTip, setActiveTip] = useState<{ title: string; tip: string } | null>(null);
  const [milestone, setMilestone] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [scoreTab, setScoreTab] = useState<'haftalik' | 'tumzamanlar'>('haftalik');
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoresSaved, setScoresSaved] = useState(false);
  const [themeEmoji, setThemeEmoji] = useState('🌅');

  // ── Game loop ──────────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    const g = gameRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!g || !canvas || !ctx) return;

    update(g);
    draw(ctx, g);

    setDisplayScore(g.score);
    setLives(g.lives);
    setCombo(g.combo);
    setShieldActive(g.shieldActive);
    if (g.charSpeech?.text !== charSpeech) setCharSpeech(g.charSpeech?.text ?? null);
    if (g.coachSpeech?.text !== coachSpeech) setCoachSpeech(g.coachSpeech?.text ?? null);
    if (g.activeTip) setActiveTip({ title: g.activeTip.title, tip: g.activeTip.tip });
    else setActiveTip(null);
    if (g.milestone) setMilestone(g.milestone.text);
    else setMilestone(null);
    setThemeEmoji(THEMES[g.themeIdx].emoji);

    if (g.status === 'playing') {
      rafRef.current = requestAnimationFrame(loop);
    } else if (g.status === 'dead') {
      setUiState('dead');
      if (!scoresSaved) {
        setScoresSaved(true);
        saveScore(g.score, accessToken, g.themeIdx + 1);
      }
    }
  }, [accessToken, charSpeech, coachSpeech, scoresSaved]);

  // ── Start game ─────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const g = initG();
    gameRef.current = g;
    setScoresSaved(false);
    setUiState('playing');
    setCharSpeech(null); setCoachSpeech(null);
    setActiveTip(null); setMilestone(null);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  // ── Jump ──────────────────────────────────────────────────────────────────
  const handleJump = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    const p = g.player;
    if (p.dead) return;
    if (p.jumpsLeft > 0) {
      p.vy = p.jumpsLeft === 2 ? JUMP_FORCE : DBL_JUMP_FORCE;
      p.jumpsLeft--;
    }
  }, []);

  // ── Keyboard / Touch ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); handleJump(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleJump]);

  useEffect(() => { return () => cancelAnimationFrame(rafRef.current); }, []);

  // ── Scores ─────────────────────────────────────────────────────────────────
  const loadScores = useCallback(async (tab: 'haftalik' | 'tumzamanlar') => {
    setScoreLoading(true);
    const data = await fetchScores(tab, accessToken);
    setScores(data); setScoreLoading(false);
  }, [accessToken]);

  useEffect(() => {
    if (uiState === 'scoreboard' || uiState === 'dead') loadScores(scoreTab);
  }, [uiState, scoreTab, loadScores]);

  // ── Menu preview ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const theme = THEMES[0];
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, theme.sky1); skyGrad.addColorStop(1, theme.sky2);
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, CW, CH);
    // Mountains preview
    ctx.fillStyle = theme.mountainColor;
    ctx.beginPath(); ctx.moveTo(50, GROUND_Y - 10); ctx.lineTo(170, 160); ctx.lineTo(290, GROUND_Y - 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(200, GROUND_Y - 10); ctx.lineTo(310, 140); ctx.lineTo(420, GROUND_Y - 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = theme.groundSurface; ctx.fillRect(0, GROUND_Y, CW, 18);
    ctx.fillStyle = theme.groundDeep; ctx.fillRect(0, GROUND_Y + 18, CW, CH - GROUND_Y - 18);
  }, []);

  const comboMult = combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'relative', width: '100%', background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)', minHeight: '100%' }}
      onTouchStart={uiState === 'playing' ? handleJump : undefined}
    >
      {/* Back button */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
        <button
          onClick={onBack}
          style={{ background: 'rgba(10,5,30,0.85)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '6px 10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          <ChevronLeft size={14} /> Geri
        </button>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef} width={CW} height={CH}
          onClick={uiState === 'playing' ? handleJump : undefined}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
        />

        {/* Playing overlays */}
        {uiState === 'playing' && (
          <>
            {/* Milestone flash */}
            <AnimatePresence>
              {milestone && (
                <motion.div
                  key={milestone}
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.3, y: -20 }}
                  style={{
                    position: 'absolute', top: '35%', left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, rgba(255,215,0,0.95), rgba(255,140,0,0.95))',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderRadius: 20, padding: '10px 24px',
                    pointerEvents: 'none', zIndex: 15,
                    boxShadow: '0 0 40px rgba(255,215,0,0.6)',
                  }}
                >
                  <p style={{ color: '#1a0a3c', fontSize: 18, fontWeight: 900, margin: 0, letterSpacing: '0.05em', textAlign: 'center' }}>
                    {milestone}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Coach speech */}
            <AnimatePresence>
              {coachSpeech && (
                <motion.div
                  key={coachSpeech}
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  style={{
                    position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(124,58,237,0.92)', border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 20, padding: '6px 14px', backdropFilter: 'blur(8px)',
                    pointerEvents: 'none', zIndex: 10,
                  }}
                >
                  <p style={{ color: '#fff', fontSize: 12, fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                    🧑‍💼 Özgür: {coachSpeech}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Character speech */}
            <AnimatePresence>
              {charSpeech && (
                <motion.div
                  key={charSpeech}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{
                    position: 'absolute', bottom: `${CH - GROUND_Y + 60}px`,
                    left: `${(PLAYER_X / CW) * 100}%`, transform: 'translateX(-10px)',
                    background: 'rgba(255,255,255,0.95)', border: '2px solid rgba(168,85,247,0.6)',
                    borderRadius: 12, padding: '5px 10px', maxWidth: 160,
                    pointerEvents: 'none', zIndex: 10,
                  }}
                >
                  <p style={{ color: '#1a0a3c', fontSize: 10, fontWeight: 600, margin: 0 }}>{charSpeech}</p>
                  <div style={{ position: 'absolute', bottom: -8, left: 16, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid rgba(255,255,255,0.95)' }} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Photography tip */}
            <AnimatePresence>
              {activeTip && (
                <motion.div
                  key={activeTip.title}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20 }}
                  style={{
                    position: 'absolute', bottom: 16, left: 12, right: 12,
                    background: 'rgba(10,5,30,0.92)', border: '1px solid rgba(255,215,0,0.4)',
                    borderRadius: 14, padding: '10px 14px', backdropFilter: 'blur(12px)',
                    pointerEvents: 'none', zIndex: 10,
                  }}
                >
                  <p style={{ color: '#FFD700', fontSize: 11, fontWeight: 800, margin: '0 0 3px', letterSpacing: '0.05em' }}>📸 {activeTip.title}</p>
                  <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, margin: 0, lineHeight: 1.5 }}>{activeTip.tip}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hint */}
            <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
              <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, margin: 0, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                DOKUN / SPACE / ↑ → ZIPLA · ÇİFT ZIPLAMA · KOİN & KALKAN TOPLA
              </p>
            </div>
          </>
        )}

        {/* MENU overlay */}
        <AnimatePresence>
          {uiState === 'menu' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, rgba(10,5,30,0.88) 0%, rgba(26,10,60,0.93) 100%)' }}
            >
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ textAlign: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 30, fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.25em', color: '#fff', textShadow: '0 0 30px #a855f7, 0 0 60px #7c3aed' }}>ASPECT</div>
                <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.4em', color: '#a78bfa', marginTop: 2 }}>RUNNER</div>
              </motion.div>

              {/* Theme pills */}
              <div style={{ display: 'flex', gap: 6, margin: '8px 0 10px' }}>
                {THEMES.map((t, i) => (
                  <div key={i} style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${t.sky1}, ${t.sky2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: '1px solid rgba(255,255,255,0.2)' }}>{t.emoji}</div>
                ))}
              </div>

              {/* Feature pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280, marginBottom: 16 }}>
                {['❤️ 3 Can', '🪙 Coin', '🔥 Kombo', '🛡 Kalkan', '🎯 Milestone', '📸 Fotoğraf İpuçları'].map(f => (
                  <span key={f} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '3px 10px', color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600 }}>{f}</span>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.94 }} onClick={startGame} style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 16, padding: '12px 40px', color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 0 30px rgba(168,85,247,0.5)', marginBottom: 10 }}>
                <Play size={16} /> OYNA
              </motion.button>

              <button onClick={() => setUiState('scoreboard')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '8px 22px', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={13} /> Skor Tablosu
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DEAD overlay */}
        <AnimatePresence>
          {uiState === 'dead' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,5,30,0.9)', backdropFilter: 'blur(4px)' }}
            >
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16 }} style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 4 }}>💥</div>
                <p style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 900, fontSize: 18, letterSpacing: '0.1em', margin: 0 }}>OYUN BİTTİ</p>
                <p style={{ color: '#FFD700', fontFamily: 'monospace', fontWeight: 800, fontSize: 32, margin: '6px 0 0' }}>{displayScore}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, margin: '2px 0 8px', letterSpacing: '0.1em' }}>PUAN</p>
                {combo >= 3 && (
                  <div style={{ background: 'rgba(255,69,0,0.15)', border: '1px solid rgba(255,69,0,0.3)', borderRadius: 10, padding: '4px 12px', display: 'inline-block' }}>
                    <span style={{ color: '#FF6B35', fontSize: 11, fontWeight: 700 }}>🔥 En yüksek kombo: x{combo}</span>
                  </div>
                )}
              </motion.div>

              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button whileTap={{ scale: 0.94 }} onClick={startGame} style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', borderRadius: 14, padding: '11px 28px', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 0 20px rgba(168,85,247,0.4)' }}>
                  <Play size={14} /> Tekrar
                </motion.button>
                <button onClick={() => setUiState('scoreboard')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: '11px 20px', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Trophy size={14} /> Skor
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scoreboard */}
      <AnimatePresence>
        {uiState === 'scoreboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)', overflowY: 'auto', padding: '16px 16px 100px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setUiState('menu')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '6px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <ChevronLeft size={14} /> Menü
              </button>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 700 }}>
                <Trophy size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} /> Skor Tablosu
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['haftalik', 'tumzamanlar'] as const).map(tab => (
                <button key={tab} onClick={() => setScoreTab(tab)} style={{ flex: 1, background: scoreTab === tab ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(255,255,255,0.05)', border: `1px solid ${scoreTab === tab ? 'transparent' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '8px', color: scoreTab === tab ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {tab === 'haftalik' ? '🗓 Bu Hafta' : '🏆 Tüm Zamanlar'}
                </button>
              ))}
            </div>

            {scoreLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Star size={24} style={{ color: '#a855f7' }} />
                </motion.div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 10 }}>Yükleniyor...</p>
              </div>
            ) : scores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Henüz skor yok. İlk sen ol! 🚀</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scores.map((s, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: idx === 0 ? 'rgba(255,215,0,0.08)' : idx === 1 ? 'rgba(192,192,192,0.06)' : idx === 2 ? 'rgba(205,127,50,0.06)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${idx === 0 ? 'rgba(255,215,0,0.25)' : idx === 1 ? 'rgba(192,192,192,0.18)' : idx === 2 ? 'rgba(205,127,50,0.18)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 14, padding: '12px 14px',
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: idx === 0 ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.06)', fontSize: idx < 3 ? 16 : 13, fontWeight: 800, color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'rgba(255,255,255,0.4)' }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>{s.isim}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, margin: '2px 0 0' }}>{s.tarih}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: idx === 0 ? '#FFD700' : '#a78bfa', fontSize: 18, fontWeight: 900, margin: 0, fontFamily: 'monospace' }}>{s.skor.toLocaleString()}</p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, margin: 0 }}>PUAN</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
