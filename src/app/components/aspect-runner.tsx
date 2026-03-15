/**
 * ASPECT RUNNER — Infinite side-scrolling runner game
 * 5 themes · Double jump · Scoreboard · Photography tips · Özgür coach mode
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Trophy, Camera, Play } from 'lucide-react';
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
const GROUND_Y = 345;      // ground surface y
const PLAYER_X = 85;
const PLAYER_W = 26;
const PLAYER_H = 44;
const GRAVITY = 0.58;
const JUMP_FORCE = -13.5;
const DBL_JUMP_FORCE = -11.5;
const THEME_DIST = 2000;   // distance per theme

// ── Photography tips ─────────────────────────────────────────────────────────
const PHOTO_TIPS = [
  { title: 'Kural Üçleri', tip: 'Konuyu merkeze koyma! Görüntüyü 3×3\'e bölen çizgilerin kesişimlerine yerleştir.' },
  { title: 'Altın Saat ✨', tip: 'Gün doğumundan 1 saat sonra ve batımından 1 saat önce en sıcak, yumuşak ışık.' },
  { title: 'ISO Değeri', tip: 'ISO düşük = az gürültü. Gündüz ISO 100-400 ideal. Gece yükseltmek kaçınılmaz.' },
  { title: 'Diyafram (f/)', tip: 'f/1.8 → bulanık arka plan. f/11 → her şey net. Portre için f/2 civarı mükemmel.' },
  { title: 'Enstantane Hızı', tip: '1/1000s hareketi dondurur, 1/30s akış hissi verir. Min 1/500s hareket için.' },
  { title: 'Beyaz Denge', tip: 'Günışığı 5600K, gölge 7000K, tungsten 3200K. Yanlış ayar renkleri mahveder!' },
  { title: 'Doğal Çerçeve', tip: 'Dallar, kapılar, pencereler… Bunlar fotoğrafa derinlik ve anlam katar.' },
  { title: 'Işık Yönü', tip: 'Yan ışık dramatik gölge verir. Arka ışık güzel silüet yaratır.' },
  { title: 'Alan Derinliği', tip: 'Odak dışı bulanıklık için: geniş diyafram + kamerayı konuya yaklaştır.' },
  { title: 'Histogram', tip: 'Sağa kayık = aşırı pozlama (yanmış). Sola kayık = az pozlama (karanlık).' },
  { title: 'Bakış Açısı', tip: 'Çömel, yüksel, yana eğil! Sıradan bakış açısını değiştirmek fotoğrafı canlandırır.' },
  { title: 'Kompozisyon', tip: 'Öne yakın element koy, arkada konuyu yerleştir → harika derinlik!' },
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

// ── Coach (Özgür) speeches ────────────────────────────────────────────────────
const COACH_SPEECHES = [
  'Hadi bakalım, koş koş!',
  'Dur durma, devam!',
  'Az kaldı az kaldı, çabuk!',
  'Bırakma şimdi, devam et!',
  'Aspect seni izliyor, hadi!',
  'Bu kadar mı?! Koş artık!',
  'Haydi haydi haydi! 🏃',
  'Koş koç, dur durma!',
  'Ses çıkmasın, hız çıksın!',
  'Güzel, devam et öyle!',
];

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
  },
];

// ── Ground brand texts ────────────────────────────────────────────────────────
const BRAND_TEXTS = [
  'ASPECT', 'ASPECT PHOTOGRAPHY', 'ASPECT TEAM', 'ASPECT OPS',
  'ASPECT RUNNER', 'ASPECT STUDIO', 'ASPECT ✦',
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Player {
  x: number; y: number; vy: number;
  jumpsLeft: number;
  walkFrame: number;
  dead: boolean; deadTimer: number;
}
interface Obstacle {
  x: number; y: number; w: number; h: number;
  type: 'cactus' | 'bird' | 'rock' | 'flash';
}
interface Photo {
  x: number; y: number;
  collected: boolean; collectTimer: number;
  tipIdx: number;
}
interface BrandText {
  x: number; text: string;
}
interface BgEl {
  x: number; y: number; speed: number;
  type: 'cloud' | 'star' | 'building' | 'mountain' | 'pixel_hill';
  w: number; h: number;
}
interface Speech { text: string; timer: number; }
interface G {
  status: 'menu' | 'playing' | 'dead';
  player: Player;
  obstacles: Obstacle[];
  photos: Photo[];
  brandTexts: BrandText[];
  bgEls: BgEl[];
  score: number;
  distance: number;
  speed: number;
  frame: number;
  themeIdx: number;
  charSpeech: Speech | null;
  coachSpeech: Speech | null;
  activeTip: { title: string; tip: string; timer: number } | null;
  lastObstX: number;
  nextObstGap: number;
  lastPhotoX: number;
  nextPhotoGap: number;
  lastBrandX: number;
  lightningTimer: number;
  lastCharDist: number;
  lastCoachDist: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rnd(min: number, max: number) { return Math.random() * (max - min) + min; }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max)); }
function pick<T>(arr: T[]): T { return arr[rndInt(0, arr.length)]; }

function initG(): G {
  const bgEls: BgEl[] = [];
  for (let i = 0; i < 12; i++) {
    bgEls.push({
      x: rnd(0, CW), y: rnd(40, 200),
      speed: rnd(0.3, 0.8),
      type: 'cloud',
      w: rnd(60, 130), h: rnd(25, 50),
    });
  }
  return {
    status: 'playing',
    player: { x: PLAYER_X, y: GROUND_Y - PLAYER_H, vy: 0, jumpsLeft: 2, walkFrame: 0, dead: false, deadTimer: 0 },
    obstacles: [],
    photos: [],
    brandTexts: [],
    bgEls,
    score: 0,
    distance: 0,
    speed: 5,
    frame: 0,
    themeIdx: 0,
    charSpeech: null,
    coachSpeech: null,
    activeTip: null,
    lastObstX: rnd(350, 550),      // countdown: spawn when ≤ 0
    nextObstGap: rnd(300, 480),
    lastPhotoX: rnd(650, 950),     // countdown: spawn when ≤ 0
    nextPhotoGap: rnd(600, 900),
    lastBrandX: 200,
    lightningTimer: 0,
    lastCharDist: 0,
    lastCoachDist: 500,
  };
}

function update(g: G) {
  if (g.status !== 'playing') return;
  g.frame++;

  const theme = THEMES[g.themeIdx];

  // Speed ramp
  g.speed = 5 + Math.min(7, g.distance / 800);

  // Distance
  g.distance += g.speed;
  g.score = Math.round(g.distance / 5);

  // Theme switch
  const newTheme = Math.floor(g.distance / THEME_DIST) % THEMES.length;
  if (newTheme !== g.themeIdx) g.themeIdx = newTheme;

  // BG parallax
  for (const el of g.bgEls) {
    el.x -= el.speed * g.speed * 0.18;
    if (el.x + el.w < 0) {
      el.x = CW + rnd(0, 100);
      el.y = rnd(40, 200);
      el.w = rnd(60, 140);
      el.h = rnd(20, 55);
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
  const minGap = Math.max(180, 400 - g.speed * 16);
  g.lastObstX -= g.speed;           // count down toward zero
  if (g.lastObstX <= 0) {
    const types: Obstacle['type'][] = ['cactus', 'cactus', 'rock', 'bird'];
    const type = pick(types);
    let ox = CW + 30, oy: number, ow: number, oh: number;
    if (type === 'bird') {
      oh = 22; ow = 36;
      oy = GROUND_Y - PLAYER_H - rnd(40, 100);
    } else if (type === 'rock') {
      oh = rndInt(22, 36); ow = rndInt(30, 44);
      oy = GROUND_Y - oh;
    } else {
      oh = rndInt(36, 56); ow = rndInt(18, 28);
      oy = GROUND_Y - oh;
    }
    g.obstacles.push({ x: ox, y: oy, w: ow, h: oh, type });
    g.nextObstGap = rnd(minGap, minGap + 250);
    g.lastObstX = g.nextObstGap;    // reset countdown
  }
  for (const o of g.obstacles) o.x -= g.speed;
  g.obstacles = g.obstacles.filter(o => o.x + o.w > -30);

  // ── Photo moments ──
  g.lastPhotoX -= g.speed;           // count down toward zero
  if (g.lastPhotoX <= 0) {
    g.photos.push({
      x: CW + 40,
      y: GROUND_Y - PLAYER_H - rnd(20, 80),
      collected: false, collectTimer: 0,
      tipIdx: rndInt(0, PHOTO_TIPS.length),
    });
    g.nextPhotoGap = rnd(700, 1100);
    g.lastPhotoX = g.nextPhotoGap;   // reset countdown
  }
  for (const ph of g.photos) {
    ph.x -= g.speed;
    if (ph.collected) ph.collectTimer++;
  }
  g.photos = g.photos.filter(ph => ph.x > -50 && ph.collectTimer < 40);

  // ── Brand texts ──
  if (g.lastBrandX - g.speed * 60 < 0 || g.brandTexts.length === 0) {
    const gap = rnd(800, 1400);
    const lastX = g.brandTexts.length > 0 ? g.brandTexts[g.brandTexts.length - 1].x : CW;
    if (CW - lastX > gap || g.brandTexts.length === 0) {
      g.brandTexts.push({ x: CW + rnd(50, 200), text: pick(BRAND_TEXTS) });
    }
    g.lastBrandX = CW;
  }
  for (const bt of g.brandTexts) bt.x -= g.speed * 0.9;
  g.brandTexts = g.brandTexts.filter(bt => bt.x > -400);

  // ── Collision detection ──
  if (!p.dead) {
    const px1 = p.x + 4, px2 = p.x + PLAYER_W - 4;
    const py1 = p.y + 4, py2 = p.y + PLAYER_H - 4;

    for (const o of g.obstacles) {
      const ox1 = o.x + 3, ox2 = o.x + o.w - 3;
      const oy1 = o.y + 3, oy2 = o.y + o.h - 3;
      if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
        p.dead = true;
        p.vy = -8;
        break;
      }
    }

    // Photo collection
    for (const ph of g.photos) {
      if (!ph.collected) {
        const phx1 = ph.x - 16, phx2 = ph.x + 16;
        const phy1 = ph.y - 16, phy2 = ph.y + 16;
        if (px1 < phx2 && px2 > phx1 && py1 < phy2 && py2 > phy1) {
          ph.collected = true;
          g.score += 50;
          if (!g.activeTip) {
            g.activeTip = { ...PHOTO_TIPS[ph.tipIdx], timer: 220 };
          }
        }
      }
    }
  }

  // ── Tip timer ──
  if (g.activeTip) {
    g.activeTip.timer--;
    if (g.activeTip.timer <= 0) g.activeTip = null;
  }

  // ── Character speeches ──
  if (g.charSpeech) {
    g.charSpeech.timer--;
    if (g.charSpeech.timer <= 0) g.charSpeech = null;
  }
  if (!g.charSpeech && g.distance - g.lastCharDist > rnd(900, 1400) && !p.dead) {
    g.charSpeech = { text: pick(CHAR_SPEECHES), timer: 160 };
    g.lastCharDist = g.distance;
  }

  // ── Coach (Özgür) speeches ──
  if (g.coachSpeech) {
    g.coachSpeech.timer--;
    if (g.coachSpeech.timer <= 0) g.coachSpeech = null;
  }
  if (!g.coachSpeech && g.distance - g.lastCoachDist > rnd(1300, 1900) && !p.dead) {
    g.coachSpeech = { text: pick(COACH_SPEECHES), timer: 140 };
    g.lastCoachDist = g.distance;
  }

  // ── Lightning timer ──
  if (theme.lightning) {
    g.lightningTimer--;
    if (g.lightningTimer <= 0) g.lightningTimer = rndInt(-200, -60);
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function draw(ctx: CanvasRenderingContext2D, g: G) {
  const theme = THEMES[g.themeIdx];
  const p = g.player;

  // ── Sky ──
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, theme.sky1);
  skyGrad.addColorStop(1, theme.sky2);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CW, CH);

  // ── Lightning flash ──
  if (theme.lightning && g.lightningTimer > -5 && g.lightningTimer <= 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, CW, CH);
    // Lightning bolt
    ctx.strokeStyle = 'rgba(255,255,200,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const lx = rnd(80, 400);
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx - 20, 80);
    ctx.lineTo(lx + 15, 100);
    ctx.lineTo(lx - 30, 180);
    ctx.stroke();
  }

  // ── Background elements (clouds, stars, buildings) ──
  drawBgEls(ctx, g.bgEls, theme);

  // ── Ground brand texts ──
  ctx.save();
  ctx.font = `bold 13px monospace`;
  ctx.fillStyle = theme.groundTxt;
  for (const bt of g.brandTexts) {
    ctx.fillText(bt.text, bt.x, GROUND_Y + 12);
  }
  ctx.restore();

  // ── Ground ──
  // surface
  ctx.fillStyle = theme.groundSurface;
  ctx.fillRect(0, GROUND_Y, CW, 18);
  // stripe
  ctx.fillStyle = theme.groundDeep;
  ctx.fillRect(0, GROUND_Y + 18, CW, CH - GROUND_Y - 18);

  // Ground grid lines (pixel art theme)
  if (theme.pixel) {
    ctx.fillStyle = 'rgba(0,255,0,0.15)';
    for (let gx = 0; gx < CW; gx += 16) {
      ctx.fillRect(gx, GROUND_Y, 1, 18);
    }
  }

  // Neon ground glow
  if (theme.neon) {
    ctx.fillStyle = `rgba(0,245,255,0.12)`;
    ctx.fillRect(0, GROUND_Y, CW, 3);
  }

  // ── Obstacles ──
  for (const o of g.obstacles) {
    drawObstacle(ctx, o, theme);
  }

  // ── Photo moments ──
  for (const ph of g.photos) {
    drawPhoto(ctx, ph, g.frame);
  }

  // ── Player ──
  drawPlayer(ctx, p, theme, g.frame);

  // ── HUD ──
  drawHUD(ctx, g, theme);
}

function drawBgEls(ctx: CanvasRenderingContext2D, els: BgEl[], theme: typeof THEMES[0]) {
  for (const el of els) {
    if (theme.neon) {
      // Buildings
      ctx.fillStyle = `rgba(15,52,96,0.9)`;
      ctx.fillRect(el.x, el.y, el.w * 0.5, el.h * 2);
      ctx.fillStyle = `rgba(233,69,96,0.4)`;
      ctx.fillRect(el.x + 5, el.y + 10, 6, 6);
      ctx.fillRect(el.x + 18, el.y + 20, 6, 6);
    } else if (theme.pixel) {
      // Pixel mountains
      ctx.fillStyle = `rgba(80,0,80,0.6)`;
      const hw = el.w * 0.4;
      ctx.fillRect(el.x, el.y + el.h * 0.4, el.w * 0.4, el.h * 0.6);
      ctx.fillRect(el.x + hw * 0.3, el.y, el.w * 0.4, el.h);
    } else {
      // Clouds
      ctx.fillStyle = theme.cloudColor;
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * 0.5, el.y + el.h * 0.5, el.w * 0.5, el.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * 0.3, el.y + el.h * 0.4, el.w * 0.3, el.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stars for night/mavi themes
    if (theme.sky1 === THEMES[1].sky1 || theme.sky1 === THEMES[3].sky1) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(el.x % CW, (el.y * 0.4) % 80 + 10, 2, 2);
      ctx.fillRect((el.x + 30) % CW, (el.y * 0.3) % 80 + 5, 1, 1);
    }
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, theme: typeof THEMES[0]) {
  ctx.fillStyle = theme.obstacleA;

  if (o.type === 'bird') {
    // Wings
    ctx.fillStyle = theme.obstacleB;
    ctx.fillRect(o.x, o.y + o.h * 0.3, o.w * 0.4, o.h * 0.5);
    ctx.fillRect(o.x + o.w * 0.6, o.y + o.h * 0.3, o.w * 0.4, o.h * 0.5);
    // Body
    ctx.fillStyle = theme.obstacleA;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.5, o.y + o.h * 0.5, o.w * 0.25, o.h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(o.x + o.w * 0.55, o.y + o.h * 0.25, 5, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(o.x + o.w * 0.57, o.y + o.h * 0.27, 3, 3);

  } else if (o.type === 'cactus') {
    // Trunk
    ctx.fillRect(o.x + o.w * 0.3, o.y, o.w * 0.4, o.h);
    // Arms
    ctx.fillRect(o.x, o.y + o.h * 0.3, o.w * 0.35, o.h * 0.12);
    ctx.fillRect(o.x, o.y + o.h * 0.15, o.w * 0.12, o.h * 0.2);
    ctx.fillRect(o.x + o.w * 0.65, o.y + o.h * 0.45, o.w * 0.35, o.h * 0.12);
    ctx.fillRect(o.x + o.w * 0.88, o.y + o.h * 0.3, o.w * 0.12, o.h * 0.2);
    if (theme.neon) {
      ctx.fillStyle = `rgba(0,245,255,0.3)`;
      ctx.fillRect(o.x + o.w * 0.3, o.y, o.w * 0.4, o.h);
    }

  } else if (o.type === 'rock') {
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.5, o.y + o.h * 0.6, o.w * 0.5, o.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.obstacleB;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.35, o.y + o.h * 0.5, o.w * 0.15, o.h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // flash / camera flash obstacle
    ctx.fillStyle = theme.accent;
    ctx.fillRect(o.x + o.w * 0.2, o.y + o.h * 0.1, o.w * 0.6, o.h * 0.6);
    ctx.fillStyle = theme.obstacleA;
    ctx.fillRect(o.x, o.y + o.h * 0.4, o.w, o.h * 0.4);
    // rays
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.5, o.y + o.h * 0.4);
      ctx.lineTo(
        o.x + o.w * 0.5 + Math.cos(angle) * 18,
        o.y + o.h * 0.4 + Math.sin(angle) * 18,
      );
      ctx.stroke();
    }
  }
}

function drawPhoto(ctx: CanvasRenderingContext2D, ph: Photo, frame: number) {
  if (ph.collected) {
    // Burst effect
    const alpha = 1 - ph.collectTimer / 40;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('+50', ph.x - 15, ph.y - ph.collectTimer * 0.8);
    ctx.font = '22px sans-serif';
    ctx.fillText('📸', ph.x - 11, ph.y - 5 - ph.collectTimer * 0.3);
    ctx.restore();
    return;
  }

  // Pulsing camera icon
  const pulse = 0.92 + Math.sin(frame * 0.15) * 0.08;
  ctx.save();
  ctx.translate(ph.x, ph.y);
  ctx.scale(pulse, pulse);

  // Glow
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 12;
  ctx.font = '26px sans-serif';
  ctx.fillText('📸', -13, 10);

  // Indicator
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,215,0,0.85)';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ÇEKÜM!', 0, 28);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, theme: typeof THEMES[0], frame: number) {
  const x = p.x;
  const y = p.y;
  const wf = p.walkFrame;

  ctx.save();

  if (p.dead) {
    // Rotate when dead
    const angle = Math.min(p.deadTimer * 0.05, Math.PI * 0.5);
    ctx.translate(x + PLAYER_W / 2, y + PLAYER_H / 2);
    ctx.rotate(angle);
    ctx.translate(-PLAYER_W / 2, -PLAYER_H / 2);
  }

  const isAir = p.y < GROUND_Y - PLAYER_H - 2;

  // ── Legs (animated) ──
  ctx.fillStyle = theme.pixel ? '#8800FF' : '#333';
  const legH = 14;
  const legW = 7;
  const legOffsets = [
    [wf === 0 || wf === 3 ? -4 : 4, 0],   // left leg
    [wf === 0 || wf === 3 ? 4 : -4, 0],   // right leg
  ];
  if (isAir) {
    // Tucked in the air
    ctx.fillRect(x + 4, y + PLAYER_H - legH, legW, legH - 4);
    ctx.fillRect(x + PLAYER_W - legW - 4, y + PLAYER_H - legH, legW, legH - 4);
  } else {
    ctx.fillRect(x + 4 + legOffsets[0][0], y + PLAYER_H - legH, legW, legH);
    ctx.fillRect(x + PLAYER_W - legW - 4 + legOffsets[1][0], y + PLAYER_H - legH, legW, legH);
  }

  // ── Body ──
  ctx.fillStyle = theme.playerBody;
  ctx.fillRect(x + 3, y + 16, PLAYER_W - 6, 22);

  // "ASPECT" on shirt
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.font = `bold 5px monospace`;
  ctx.fillText('ASPECT', x + 4, y + 30);

  // ── Camera body ──
  ctx.fillStyle = '#222';
  ctx.fillRect(x + PLAYER_W - 10, y + 18, 10, 7);
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.arc(x + PLAYER_W - 4, y + 22, 3, 0, Math.PI * 2);
  ctx.fill();
  // Camera strap
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + PLAYER_W - 8, y + 18);
  ctx.lineTo(x + 8, y + 20);
  ctx.stroke();

  // ── Head ──
  ctx.fillStyle = theme.playerHead;
  ctx.fillRect(x + 5, y + 2, PLAYER_W - 10, 16);

  // Face
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  // Eyes
  ctx.fillRect(x + 9, y + 6, 3, 3);
  ctx.fillRect(x + PLAYER_W - 12, y + 6, 3, 3);
  // Mouth
  const mouthY = p.dead ? y + 14 : y + 13;
  ctx.fillRect(x + 9, mouthY, PLAYER_W - 18, 2);

  // Pixel hat (retro theme)
  if (theme.pixel) {
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + 5, y, PLAYER_W - 10, 4);
    ctx.fillRect(x + 8, y - 4, PLAYER_W - 16, 5);
  }

  ctx.restore();
}

function drawHUD(ctx: CanvasRenderingContext2D, g: G, theme: typeof THEMES[0]) {
  // Score
  ctx.font = `bold 18px monospace`;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = theme.accent;
  ctx.shadowBlur = 8;
  ctx.fillText(`${g.score}`, CW - 90, 30);
  ctx.shadowBlur = 0;

  ctx.font = `10px monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('SKOR', CW - 90, 44);

  // Theme name + emoji
  ctx.font = `bold 11px sans-serif`;
  ctx.fillStyle = theme.accent;
  ctx.fillText(`${theme.emoji} ${theme.name}`, 14, 26);

  // Speed indicator
  const speedPct = (g.speed - 5) / 7;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(14, 32, 70, 5);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(14, 32, 70 * speedPct, 5);
  ctx.font = '8px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('HIZ', 14, 47);

  // Theme progress dots
  for (let i = 0; i < THEMES.length; i++) {
    ctx.fillStyle = i === g.themeIdx ? theme.accent : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(CW / 2 - THEMES.length * 8 + i * 16, 16, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
interface ScoreEntry { sira: number; isim: string; skor: number; tarih: string; }

async function saveScore(score: number, accessToken: string, temaSayisi: number) {
  try {
    await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637/game/skor`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': accessToken,
        },
        body: JSON.stringify({ skor: score, temaSayisi }),
      }
    );
  } catch (e) {
    console.error('Score save error:', e);
  }
}

async function fetchScores(tip: 'haftalik' | 'tumzamanlar', accessToken: string): Promise<ScoreEntry[]> {
  try {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637/game/skorlar?tip=${tip}`,
      {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': accessToken,
        },
      }
    );
    const data = await res.json();
    return data.skorlar || [];
  } catch (e) {
    console.error('Score fetch error:', e);
    return [];
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AspectRunner({ userName, userRole, accessToken, onBack }: AspectRunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<G | null>(null);
  const rafRef = useRef<number>(0);
  const [uiState, setUiState] = useState<'menu' | 'playing' | 'dead' | 'scoreboard'>('menu');
  const [displayScore, setDisplayScore] = useState(0);
  const [charSpeech, setCharSpeech] = useState<string | null>(null);
  const [coachSpeech, setCoachSpeech] = useState<string | null>(null);
  const [activeTip, setActiveTip] = useState<{ title: string; tip: string } | null>(null);
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

    // Sync React UI
    setDisplayScore(g.score);
    if (g.charSpeech?.text !== charSpeech) setCharSpeech(g.charSpeech?.text ?? null);
    if (g.coachSpeech?.text !== coachSpeech) setCoachSpeech(g.coachSpeech?.text ?? null);
    if (g.activeTip) setActiveTip({ title: g.activeTip.title, tip: g.activeTip.tip });
    else setActiveTip(null);
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
    setCharSpeech(null);
    setCoachSpeech(null);
    setActiveTip(null);
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
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleJump]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Load scores ───────────────────────────────────────────────────────────
  const loadScores = useCallback(async (tab: 'haftalik' | 'tumzamanlar') => {
    setScoreLoading(true);
    const data = await fetchScores(tab, accessToken);
    setScores(data);
    setScoreLoading(false);
  }, [accessToken]);

  useEffect(() => {
    if (uiState === 'scoreboard' || uiState === 'dead') {
      loadScores(scoreTab);
    }
  }, [uiState, scoreTab, loadScores]);

  // ── Canvas draw on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Draw a preview background
    const theme = THEMES[0];
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, theme.sky1);
    skyGrad.addColorStop(1, theme.sky2);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = theme.groundSurface;
    ctx.fillRect(0, GROUND_Y, CW, 18);
    ctx.fillStyle = theme.groundDeep;
    ctx.fillRect(0, GROUND_Y + 18, CW, CH - GROUND_Y - 18);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)',
    minHeight: '100%',
  };

  return (
    <div style={containerStyle} onTouchStart={uiState === 'playing' ? handleJump : undefined}>

      {/* ── Canvas (always rendered for preview) ── */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          onClick={uiState === 'playing' ? handleJump : undefined}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
        />

        {/* ── Playing overlays ── */}
        {uiState === 'playing' && (
          <>
            {/* Coach speech (top overlay) */}
            <AnimatePresence>
              {coachSpeech && (
                <motion.div
                  key={coachSpeech}
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  style={{
                    position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(168,85,247,0.92)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 20,
                    padding: '6px 14px',
                    backdropFilter: 'blur(8px)',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <p style={{ color: '#fff', fontSize: 12, fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                    🧑‍💼 Özgür: {coachSpeech}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Character speech bubble (above player) */}
            <AnimatePresence>
              {charSpeech && (
                <motion.div
                  key={charSpeech}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{
                    position: 'absolute',
                    bottom: `${CH - GROUND_Y + 60}px`,
                    left: `${(PLAYER_X / CW) * 100}%`,
                    transform: 'translateX(-10px)',
                    background: 'rgba(255,255,255,0.95)',
                    border: '2px solid rgba(168,85,247,0.6)',
                    borderRadius: 12,
                    padding: '5px 10px',
                    maxWidth: 160,
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <p style={{ color: '#1a0a3c', fontSize: 10, fontWeight: 600, margin: 0 }}>
                    {charSpeech}
                  </p>
                  {/* Tail */}
                  <div style={{
                    position: 'absolute', bottom: -8, left: 16,
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '8px solid rgba(255,255,255,0.95)',
                  }} />
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
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 12,
                    right: 12,
                    background: 'rgba(10,5,30,0.92)',
                    border: '1px solid rgba(255,215,0,0.4)',
                    borderRadius: 14,
                    padding: '10px 14px',
                    backdropFilter: 'blur(12px)',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                >
                  <p style={{ color: '#FFD700', fontSize: 11, fontWeight: 800, margin: '0 0 3px', letterSpacing: '0.05em' }}>
                    📸 {activeTip.title}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                    {activeTip.tip}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Touch hint */}
            <div style={{
              position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9, margin: 0, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                DOKUNUN VEYA SPACE / ↑ → ZIPLA · ÇİFT ZIPLAMA AKTİF
              </p>
            </div>
          </>
        )}

        {/* ── MENU overlay ── */}
        <AnimatePresence>
          {uiState === 'menu' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(10,5,30,0.85) 0%, rgba(26,10,60,0.9) 100%)',
              }}
            >
              {/* Logo */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{ textAlign: 'center', marginBottom: 8 }}
              >
                <div style={{
                  fontSize: 28,
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  letterSpacing: '0.25em',
                  color: '#fff',
                  textShadow: '0 0 30px #a855f7, 0 0 60px #7c3aed',
                  lineHeight: 1,
                }}>
                  ASPECT
                </div>
                <div style={{
                  fontSize: 14,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.4em',
                  color: '#a78bfa',
                  marginTop: 2,
                }}>
                  RUNNER
                </div>
              </motion.div>

              {/* Themes preview */}
              <div style={{ display: 'flex', gap: 8, margin: '10px 0 16px' }}>
                {THEMES.map((t, i) => (
                  <div key={i} style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `linear-gradient(135deg, ${t.sky1}, ${t.sky2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, border: '1px solid rgba(255,255,255,0.2)',
                  }}>
                    {t.emoji}
                  </div>
                ))}
              </div>

              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center', marginBottom: 20, maxWidth: 220 }}>
                5 bölüm · Sonsuz koşu · Fotoğrafçılık ipuçları
              </p>

              {/* Play button */}
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={startGame}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 16,
                  padding: '12px 36px',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 0 30px rgba(168,85,247,0.4)',
                }}
              >
                <Play size={16} /> OYNA
              </motion.button>

              {/* Scoreboard button */}
              <button
                onClick={() => { setUiState('scoreboard'); }}
                style={{
                  marginTop: 10,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  padding: '8px 22px',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Trophy size={13} /> Skor Tablosu
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── DEAD overlay ── */}
        <AnimatePresence>
          {uiState === 'dead' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(10,5,30,0.88)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 16 }}
                style={{ textAlign: 'center', marginBottom: 16 }}
              >
                <div style={{ fontSize: 40, marginBottom: 4 }}>💥</div>
                <p style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 900, fontSize: 18, letterSpacing: '0.1em', margin: 0 }}>
                  OYUN BİTTİ
                </p>
                <p style={{ color: '#FFD700', fontFamily: 'monospace', fontWeight: 800, fontSize: 28, margin: '6px 0 0' }}>
                  {displayScore}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: '2px 0 0', letterSpacing: '0.1em' }}>
                  PUAN
                </p>
              </motion.div>

              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={startGame}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    border: 'none',
                    borderRadius: 14,
                    padding: '11px 28px',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 0 20px rgba(168,85,247,0.4)',
                  }}
                >
                  <Play size={14} /> Tekrar
                </motion.button>
                <button
                  onClick={() => setUiState('scoreboard')}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 14,
                    padding: '11px 20px',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Trophy size={14} /> Skor
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ── Scoreboard (below canvas when active) ── */}
      <AnimatePresence>
        {(uiState === 'scoreboard' || uiState === 'dead') && uiState === 'scoreboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)',
              overflowY: 'auto',
              padding: '16px 16px 100px',
            }}
          >
            {/* Back */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => setUiState('menu')}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '6px 10px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12,
                }}
              >
                <ChevronLeft size={14} /> Menü
              </button>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700 }}>
                <Trophy size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                Skor Tablosu
              </span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['haftalik', 'tumzamanlar'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setScoreTab(tab)}
                  style={{
                    flex: 1,
                    background: scoreTab === tab ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${scoreTab === tab ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10,
                    padding: '8px',
                    color: scoreTab === tab ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {tab === 'haftalik' ? '🗓 Bu Hafta' : '🏆 Tüm Zamanlar'}
                </button>
              ))}
            </div>

            {/* Scores */}
            {scoreLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Yükleniyor...</div>
              </div>
            ) : scores.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 32,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <Camera size={28} color="rgba(255,255,255,0.2)" style={{ marginBottom: 8 }} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Henüz skor yok!</p>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>İlk koşuyu sen yap 🏃</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scores.map((s, idx) => {
                  const isMe = s.isim === userName;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <motion.div
                      key={`${s.isim}-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: isMe
                          ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.15))'
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isMe ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 12,
                        padding: '10px 14px',
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: idx < 3 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: idx < 3 ? 16 : 12,
                        color: idx < 3 ? '#FFD700' : 'rgba(255,255,255,0.3)',
                        fontWeight: 700,
                      }}>
                        {idx < 3 ? medals[idx] : `${s.sira}`}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          color: isMe ? '#c084fc' : '#fff',
                          fontSize: 13, fontWeight: isMe ? 800 : 600,
                          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {s.isim} {isMe && '(Sen)'}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: 0 }}>
                          {new Date(s.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div style={{
                        fontFamily: 'monospace', fontWeight: 900, fontSize: 18,
                        color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#fff',
                      }}>
                        {s.skor.toLocaleString()}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Play again button */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={startGame}
              style={{
                width: '100%', marginTop: 20,
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                border: 'none', borderRadius: 14,
                padding: '14px',
                color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 0 30px rgba(168,85,247,0.3)',
              }}
            >
              <Play size={16} /> Oynamaya Başla
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
