/**
 * ASPECT RUNNER — v2 Refactored
 * Better physics · Asymmetric gravity · Coyote time · Jump buffer
 * 2 themes · 3 obstacle types · Photo moments · ASPECT branding
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Trophy, Play, RotateCcw, Star } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { UserRole } from './login';

// ─────────────────────────── PROPS ───────────────────────────────────────────
interface AspectRunnerProps {
  userName: string;
  userRole: UserRole;
  accessToken: string;
  onBack: () => void;
}

// ─────────────────────────── CONSTANTS ───────────────────────────────────────
const CW = 480;
const CH = 370;
const GY = 302;        // top of ground strip
const PX = 80;         // player fixed x
const PW = 24;
const PH = 40;

// Physics — asymmetric gravity for snappy feel
const GRAV_UP      = 0.52;
const GRAV_DOWN    = 0.84;
const J1_TAP       = -6.5;   // quick-tap first jump
const J1_BOOST     = -1.15;  // per-frame boost while held
const J1_HOLD_MAX  = 8;      // max hold frames (tap=low, full hold=high)
const J2_TAP       = -5.5;   // quick-tap double jump
const J2_BOOST     = -0.90;
const J2_HOLD_MAX  = 6;
const JUMP_CUT     = -4.0;   // releasing early caps upward speed
const FALL_MAX     = 16;
const COYOTE_T  = 7;
const JBUF_T    = 10;

// Game speed
const SPD_INIT  = 4.0;
const SPD_MAX   = 9.0;
const SPD_DIST  = 2200;   // distance ramp

// Spawn gaps (in speed-distance units)
const OBS_GAP_BASE  = 195;
const OBS_GAP_RAND  = 230;
const PHOTO_GAP     = 950;
const PHOTO_RAND    = 700;
const SIGN_GAP      = 500;
const SIGN_RAND     = 450;
const SPEECH_GAP    = 2000;
const SPEECH_RAND   = 1400;
const POWERUP_GAP   = 2200;
const POWERUP_RAND  = 1800;

// Theme switch distance
const THEME_DIST = 8000;

// ─────────────────────────── THEMES ──────────────────────────────────────────
const THEMES = [
  {
    id: 'golden' as const,
    name: 'Altın Saat', emoji: '🌅',
    sky1: '#E8521A', sky2: '#F5A623',
    gnd1: '#9B6522', gnd2: '#7A4E1A',
    obs1: '#5C3317', obs2: '#3D2010',
    accent: '#FFE066',
    bgAlpha: 'rgba(255,210,60,0.065)',
    gndTxt: 'rgba(255,195,40,0.20)',
    mtCol: 'rgba(165,85,45,0.30)',
    cloudCol: 'rgba(255,255,255,0.20)',
    treeCol: '#2E7D32',
    trunkCol: '#6D4C41',
    neon: false,
  },
  {
    id: 'night' as const,
    name: 'Gece Şehri', emoji: '🌃',
    sky1: '#06061A', sky2: '#0F0F38',
    gnd1: '#13132A', gnd2: '#08081A',
    obs1: '#1a3a6a', obs2: '#0d2248',
    accent: '#00E5FF',
    bgAlpha: 'rgba(0,229,255,0.048)',
    gndTxt: 'rgba(0,229,255,0.22)',
    mtCol: 'rgba(8,25,75,0.72)',
    cloudCol: 'rgba(0,200,255,0.05)',
    treeCol: '#0F3460',
    trunkCol: '#1A3A5C',
    neon: true,
  },
] as const;

type Theme = typeof THEMES[number];

// ─────────────────────────── CONTENT ─────────────────────────────────────────
const SIGN_LINES = [
  ['ASPECT', 'PHOTOGRAPHY'],
  ['ASPECT', 'OPS'],
  ['ASPECT', 'TEAM'],
  ['CAPTURE', 'THE MOMENT'],
  ['ASPECT', 'STUDIO'],
  ['ASPECT', 'PRO'],
  ['ASPECT', 'RUNNER'],
  ['ASPECT', 'ALL RIGHTS'],
  ['ASPECT', 'WORLD'],
  ['STAY', 'IN FRAME'],
];

const SPEECHES: { who: 'char' | 'coach'; text: string }[] = [
  { who: 'char',  text: 'Dur biraz... nefes... 😮‍💨' },
  { who: 'char',  text: 'Ben fotoğrafçıyım, atlet değil!' },
  { who: 'char',  text: 'Bu kamera neden bu kadar ağır?!' },
  { who: 'char',  text: 'Ayakkabı bağım çözüldü! 👟' },
  { who: 'char',  text: 'Aspect beni görse böyle koşturmaz!' },
  { who: 'coach', text: 'Hadi bakalım, koş koş!' },
  { who: 'coach', text: 'Aspect seni izliyor, hadi!' },
  { who: 'coach', text: 'Güzel, devam et öyle!' },
  { who: 'coach', text: 'Az kaldı az kaldı, çabuk!' },
];

const MILESTONES: [number, string][] = [
  [100,  '📸 FLASH ANINDA!'],
  [300,  '🔥 ALEV ALEV!'],
  [600,  '⚡ 600 PUAN!'],
  [1000, '🏆 BİN PUAN!'],
  [2000, '🚀 EFSANE!'],
  [3500, '👑 ASPECT RUNNER!'],
  [5500, '💎 ULTRA RUNNER!'],
];

// ─────────────────────────── TYPES ───────────────────────────────────────────
interface Player {
  y: number; vy: number;
  jumpsLeft: number;
  coyoteT: number;
  jbufT: number;
  onGround: boolean;
  squashT: number;
  walkFrame: number;
  dead: boolean;
  deadTimer: number;
  deadAngle: number;
  jumpHoldFrames: number;  // boost frames applied
  jumpIsDouble: boolean;   // true = boosting a double jump
}

type ObsType = 'box' | 'bird' | 'rock';
type PowerupType = 'shield' | 'heart';

interface Powerup {
  id: number;
  x: number; y: number;
  type: PowerupType;
  collected: boolean;
  collectT: number;
}

interface Obstacle {
  id: number;
  x: number; y: number; w: number; h: number;
  type: ObsType;
  passed: boolean;
}

interface PhotoMoment {
  id: number;
  x: number; y: number;
  collected: boolean;
  collectT: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; r: number;
}

interface Sign { x: number; lineIdx: number; h: number; }

interface BgEl {
  x: number; y: number; w: number; h: number;
  type: 'mountain' | 'cloud' | 'tree';
  spd: number;
}

interface Speech { who: 'char' | 'coach'; text: string; timer: number; }

interface G {
  status: 'playing' | 'dead';
  player: Player;
  obstacles: Obstacle[];
  photos: PhotoMoment[];
  powerups: Powerup[];
  particles: Particle[];
  signs: Sign[];
  bgEls: BgEl[];
  speech: Speech | null;
  milestone: { text: string; timer: number } | null;
  score: number;
  distance: number;
  speed: number;
  frame: number;
  themeIdx: number;
  lives: number;
  invTimer: number;
  shieldTimer: number;
  combo: number;
  comboT: number;
  nextObsIn: number;
  nextPhotoIn: number;
  nextSignIn: number;
  nextSpeechIn: number;
  nextPowerupIn: number;
  lastMilestone: number;
  obsIdCtr: number;
  photoIdCtr: number;
  powerupIdCtr: number;
  // brand watermark positions (slow parallax)
  wm1x: number;
  wm2x: number;
}

// ─────────────────────────── HELPERS ─────────────────────────────────────────
const rnd  = (a: number, b: number) => Math.random() * (b - a) + a;
const rndI = (a: number, b: number) => Math.floor(rnd(a, b));
const pick = <T,>(arr: readonly T[]): T => arr[rndI(0, arr.length)];

function spawnParticles(g: G, x: number, y: number, color: string, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    const s = rnd(1.5, 4.5);
    g.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - rnd(0.5, 2.5),
      life: 38, maxLife: 38,
      color, r: rnd(2, 4.5),
    });
  }
}

// ─────────────────────────── INIT ─────────────────────────────────────────────
function mkBgEls(): BgEl[] {
  const els: BgEl[] = [];
  for (let i = 0; i < 5; i++)
    els.push({ x: rnd(0, CW), y: rnd(135, 215), w: rnd(130, 240), h: rnd(80, 145), type: 'mountain', spd: 0.11 });
  for (let i = 0; i < 7; i++)
    els.push({ x: rnd(0, CW), y: rnd(55, 165), w: rnd(80, 155), h: rnd(28, 60), type: 'cloud', spd: 0.27 });
  for (let i = 0; i < 5; i++)
    els.push({ x: rnd(0, CW), y: GY - rnd(48, 100), w: rnd(17, 28), h: rnd(48, 100), type: 'tree', spd: 0.54 });
  return els;
}

function initG(): G {
  return {
    status: 'playing',
    player: {
      y: GY - PH, vy: 0,
      jumpsLeft: 2, coyoteT: 0, jbufT: 0,
      onGround: true, squashT: 0,
      walkFrame: 0,
      dead: false, deadTimer: 0, deadAngle: 0,
      jumpHoldFrames: 0, jumpIsDouble: false,
    },
    obstacles: [], photos: [], powerups: [], particles: [], signs: [],
    bgEls: mkBgEls(),
    speech: null, milestone: null,
    score: 0, distance: 0, speed: SPD_INIT, frame: 0, themeIdx: 0,
    lives: 3, invTimer: 0, shieldTimer: 0, combo: 0, comboT: 0,
    nextObsIn: rnd(280, 460),
    nextPhotoIn: rnd(800, 1400),
    nextSignIn: rnd(400, 720),
    nextSpeechIn: rnd(SPEECH_GAP, SPEECH_GAP + SPEECH_RAND),
    nextPowerupIn: rnd(POWERUP_GAP, POWERUP_GAP + POWERUP_RAND),
    lastMilestone: 0, obsIdCtr: 0, photoIdCtr: 0, powerupIdCtr: 0,
    wm1x: CW * 0.25,
    wm2x: CW * 1.05,
  };
}

// ─────────────────────────── JUMP ─────────────────────────────────────────────
function doJump(p: Player) {
  if (p.dead) return;
  if (p.coyoteT > 0 || p.jumpsLeft === 2) {
    p.vy = J1_TAP;
    p.jumpsLeft = p.jumpsLeft === 2 ? 1 : p.jumpsLeft;
    p.coyoteT = 0;
    p.jbufT = 0;
    p.jumpHoldFrames = 0;
    p.jumpIsDouble = false;
  } else if (p.jumpsLeft === 1) {
    p.vy = J2_TAP;
    p.jumpsLeft = 0;
    p.jbufT = 0;
    p.jumpHoldFrames = 0;
    p.jumpIsDouble = true;
  } else {
    p.jbufT = JBUF_T;
  }
}

// ─────────────────────────── UPDATE ──────────────────────────────────────────
function update(g: G, jumpHeld: boolean) {
  if (g.status !== 'playing') return;
  g.frame++;

  const p = g.player;

  // Speed ramp (smooth, capped)
  g.speed = SPD_INIT + (SPD_MAX - SPD_INIT) * Math.min(1, g.distance / SPD_DIST);
  g.distance += g.speed;

  // Score
  const cm = g.combo >= 10 ? 3 : g.combo >= 5 ? 2 : g.combo >= 3 ? 1.5 : 1;
  g.score = Math.round(g.distance / 5 * cm);

  // Theme
  g.themeIdx = Math.floor(g.distance / THEME_DIST) % THEMES.length;

  // Milestones
  for (const [thr, msg] of MILESTONES) {
    if (g.score >= thr && g.lastMilestone < thr) {
      g.milestone = { text: msg, timer: 165 };
      g.lastMilestone = thr;
    }
  }
  if (g.milestone) { g.milestone.timer--; if (g.milestone.timer <= 0) g.milestone = null; }

  // Timers
  if (g.comboT > 0) { g.comboT--; if (g.comboT === 0) g.combo = 0; }
  if (g.invTimer > 0) g.invTimer--;

  // ── BG parallax ──
  for (const el of g.bgEls) {
    el.x -= el.spd * g.speed * 0.24;
    if (el.x + el.w < 0) {
      el.x = CW + rnd(0, 60);
      if (el.type === 'mountain') { el.y = rnd(135, 215); el.w = rnd(130, 240); el.h = rnd(80, 145); }
      else if (el.type === 'cloud') { el.y = rnd(55, 165); el.w = rnd(80, 155); el.h = rnd(28, 60); }
      else { el.y = GY - rnd(48, 100); el.w = rnd(17, 28); el.h = rnd(48, 100); }
    }
  }

  // ── Brand watermarks (very slow) ──
  g.wm1x -= g.speed * 0.075;
  g.wm2x -= g.speed * 0.075;
  if (g.wm1x < -220) g.wm1x = CW + 55;
  if (g.wm2x < -220) g.wm2x = CW + 55;

  // ── Player physics ──
  if (!p.dead) {
    // Asymmetric gravity
    p.vy += p.vy <= 0 ? GRAV_UP : GRAV_DOWN;
    // Hold-to-jump-higher boost
    if (!p.onGround && p.vy < 0 && jumpHeld) {
      const maxF  = p.jumpIsDouble ? J2_HOLD_MAX : J1_HOLD_MAX;
      const boost = p.jumpIsDouble ? J2_BOOST    : J1_BOOST;
      if (p.jumpHoldFrames < maxF) {
        p.vy += boost;
        p.jumpHoldFrames++;
      }
    }
    p.vy = Math.min(p.vy, FALL_MAX);
    p.y  += p.vy;

    const wasOnGround = p.onGround;
    p.onGround = false;

    if (p.y >= GY - PH) {
      p.y = GY - PH;
      p.vy = 0;
      p.jumpsLeft = 2;
      p.onGround = true;
      p.coyoteT = COYOTE_T;
      if (!wasOnGround) {
        p.squashT = 9; // landing squash
        if (p.jbufT > 0) { // buffered jump fires on landing
          p.jbufT = 0;
          p.vy = J1_TAP;
          p.jumpsLeft = 1;
          p.jumpHoldFrames = 0;
          p.jumpIsDouble = false;
          p.onGround = false;
        }
      }
    } else {
      p.coyoteT = Math.max(0, p.coyoteT - 1);
      if (p.jbufT > 0) p.jbufT--;
    }

    if (p.squashT > 0) p.squashT--;
    if (p.onGround && g.frame % 7 === 0) p.walkFrame = (p.walkFrame + 1) % 4;
  } else {
    p.deadTimer++;
    p.deadAngle += 0.09;
    p.vy += 0.55;
    p.y  += p.vy;
    if (p.deadTimer > 82) { g.status = 'dead'; return; }
  }

  // ── Obstacle spawn ──
  g.nextObsIn -= g.speed;
  if (g.nextObsIn <= 0) {
    const types: ObsType[] = ['box', 'box', 'bird', 'rock'];
    const type = pick(types);
    let oy: number, ow: number, oh: number;
    if (type === 'box') {
      oh = rndI(32, 54); ow = rndI(25, 38); oy = GY - oh;
    } else if (type === 'bird') {
      oh = 22; ow = 38;
      oy = GY - PH - rndI(25, 78);
    } else {
      oh = rndI(20, 34); ow = rndI(32, 48); oy = GY - oh;
    }
    g.obstacles.push({ id: g.obsIdCtr++, x: CW + 30, y: oy, w: ow, h: oh, type, passed: false });
    const minGap = Math.max(OBS_GAP_BASE, OBS_GAP_BASE + 130 - g.speed * 7);
    g.nextObsIn = rnd(minGap, minGap + OBS_GAP_RAND);
  }
  for (const o of g.obstacles) {
    o.x -= g.speed;
    if (!o.passed && o.x + o.w < PX - 8) {
      o.passed = true;
      g.combo++;
      g.comboT = 115;
    }
  }
  g.obstacles = g.obstacles.filter(o => o.x + o.w > -40);

  // ── Photo moment spawn ──
  g.nextPhotoIn -= g.speed;
  if (g.nextPhotoIn <= 0) {
    g.photos.push({
      id: g.photoIdCtr++,
      x: CW + 40,
      y: GY - PH - rnd(8, 72),
      collected: false,
      collectT: 0,
    });
    g.nextPhotoIn = rnd(PHOTO_GAP, PHOTO_GAP + PHOTO_RAND);
  }
  for (const ph of g.photos) {
    ph.x -= g.speed;
    if (ph.collected) ph.collectT++;
  }
  g.photos = g.photos.filter(ph => ph.x > -60 && ph.collectT < 40);

  // ── Powerup spawn ──
  g.nextPowerupIn -= g.speed;
  if (g.nextPowerupIn <= 0) {
    const type: PowerupType = Math.random() < 0.58 ? 'shield' : 'heart';
    g.powerups.push({
      id: g.powerupIdCtr++,
      x: CW + 40,
      y: GY - PH - rnd(12, 78),
      type, collected: false, collectT: 0,
    });
    g.nextPowerupIn = rnd(POWERUP_GAP, POWERUP_GAP + POWERUP_RAND);
  }
  for (const pu of g.powerups) {
    pu.x -= g.speed;
    if (pu.collected) pu.collectT++;
  }
  g.powerups = g.powerups.filter(pu => pu.x > -60 && pu.collectT < 42);

  // ── Shield timer ──
  if (g.shieldTimer > 0) g.shieldTimer--;

  // ── Sign spawn ──
  g.nextSignIn -= g.speed;
  if (g.nextSignIn <= 0) {
    g.signs.push({ x: CW + 40, lineIdx: rndI(0, SIGN_LINES.length), h: rndI(62, 118) });
    g.nextSignIn = rnd(SIGN_GAP, SIGN_GAP + SIGN_RAND);
  }
  for (const sg of g.signs) sg.x -= g.speed * 0.86;
  g.signs = g.signs.filter(sg => sg.x > -165);

  // ── Particles ──
  for (const pt of g.particles) {
    pt.x += pt.vx; pt.y += pt.vy;
    pt.vy += 0.22;
    pt.life--;
  }
  g.particles = g.particles.filter(pt => pt.life > 0);

  // ── Speech (rare) ──
  if (g.speech) { g.speech.timer--; if (g.speech.timer <= 0) g.speech = null; }
  g.nextSpeechIn -= g.speed;
  if (g.nextSpeechIn <= 0 && !g.speech && !p.dead) {
    const sp = pick(SPEECHES);
    g.speech = { who: sp.who, text: sp.text, timer: 175 };
    g.nextSpeechIn = rnd(SPEECH_GAP, SPEECH_GAP + SPEECH_RAND);
  }

  // ── Collision (fair hitboxes) ──
  if (!p.dead && g.invTimer === 0 && g.shieldTimer === 0) {
    const px1 = PX + 6,    px2 = PX + PW - 6;
    const py1 = p.y + 5,   py2 = p.y + PH - 3;

    for (const o of g.obstacles) {
      const ox1 = o.x + 5,     ox2 = o.x + o.w - 5;
      const oy1 = o.y + 4,     oy2 = o.y + o.h - 4;
      if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
        spawnParticles(g, PX + PW / 2, p.y + PH / 2, '#f87171', 10);
        g.lives--;
        g.combo = 0; g.comboT = 0;
        g.invTimer = 115;
        if (g.lives <= 0) {
          p.dead = true; p.vy = -9;
        } else {
          p.vy = -5.5; // small bounce-back
        }
        break;
      }
    }

    // Photo collection (generous hitbox)
    for (const ph of g.photos) {
      if (!ph.collected) {
        if (PX + PW > ph.x - 14 && PX < ph.x + 14 && p.y + PH > ph.y - 14 && p.y < ph.y + 14) {
          ph.collected = true;
          const bonus = 30 + g.combo * 6;
          g.score += bonus;
          g.combo += 2;
          g.comboT = 145;
          spawnParticles(g, ph.x, ph.y, '#FFD700', 14);
          spawnParticles(g, ph.x, ph.y, '#ffffff', 5);
        }
      }
    }
  }

  // ── Powerup collection (always collectible) ──
  if (!p.dead) {
    for (const pu of g.powerups) {
      if (!pu.collected) {
        if (PX + PW > pu.x - 16 && PX < pu.x + 16 && p.y + PH > pu.y - 16 && p.y < pu.y + 16) {
          pu.collected = true;
          if (pu.type === 'shield') {
            g.shieldTimer = 540; // ~9 seconds
            spawnParticles(g, pu.x, pu.y, '#22d3ee', 16);
            spawnParticles(g, pu.x, pu.y, '#ffffff', 5);
          } else {
            g.lives = Math.min(5, g.lives + 1);
            spawnParticles(g, pu.x, pu.y, '#f43f5e', 14);
            spawnParticles(g, pu.x, pu.y, '#ffffff', 6);
          }
        }
      }
    }
  }
}

// ─────────────────────────── DRAW ────────────────────────────────────────────
function draw(ctx: CanvasRenderingContext2D, g: G) {
  const th = THEMES[g.themeIdx];
  const p  = g.player;
  const f  = g.frame;

  // ── Sky ──
  const sky = ctx.createLinearGradient(0, 0, 0, GY);
  sky.addColorStop(0, th.sky1);
  sky.addColorStop(1, th.sky2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  // ── Stars (night only) ──
  if (th.neon) {
    const STARS = [
      [0.07,0.04],[0.19,0.11],[0.31,0.03],[0.44,0.07],[0.59,0.02],
      [0.71,0.10],[0.83,0.05],[0.92,0.14],[0.14,0.19],[0.54,0.17],
      [0.77,0.21],[0.37,0.24],[0.63,0.27],[0.24,0.29],[0.89,0.29],
      [0.48,0.32],[0.68,0.13],[0.05,0.22],[0.96,0.08],[0.40,0.06],
    ];
    for (const [sx, sy] of STARS) {
      const blink = 0.3 + 0.6 * Math.max(0, Math.sin(f * 0.05 + sx * 22 + sy * 15));
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx * CW, sy * GY, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  // ── ASPECT watermark (huge, very faint) ──
  ctx.save();
  ctx.globalAlpha = 0.052;
  ctx.fillStyle = th.neon ? '#00E5FF' : '#FFE066';
  ctx.font = 'bold 92px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ASPECT', g.wm1x, 185);
  ctx.fillText('ASPECT', g.wm2x, 185);
  ctx.restore();

  // ── BG elements (sorted by speed = depth) ──
  const sorted = [...g.bgEls].sort((a, b) => a.spd - b.spd);
  for (const el of sorted) drawBgEl(ctx, el, th, f);

  // ── Ground brand text (scrolling) ──
  ctx.save();
  ctx.fillStyle = th.gndTxt;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  const gtOff = (g.frame * g.speed * 0.5) % 330;
  for (let i = -1; i < 3; i++) {
    ctx.fillText('▸ ASPECT PHOTOGRAPHY ◂', i * 330 - gtOff, GY + 10);
  }
  ctx.restore();

  // ── Ground ──
  ctx.fillStyle = th.gnd1;
  ctx.fillRect(0, GY, CW, 13);
  ctx.fillStyle = th.gnd2;
  ctx.fillRect(0, GY + 13, CW, CH - GY - 13);

  // Neon ground accent
  if (th.neon) {
    ctx.fillStyle = 'rgba(0,229,255,0.22)';
    ctx.fillRect(0, GY, CW, 2);
    ctx.fillStyle = 'rgba(0,229,255,0.06)';
    ctx.fillRect(0, GY + 2, CW, 4);
  }

  // ── Signs (behind obstacles) ──
  for (const sg of g.signs) drawSign(ctx, sg, th, f);

  // ── Obstacles ──
  for (const o of g.obstacles) drawObstacle(ctx, o, th, f);

  // ── Photos ──
  for (const ph of g.photos) drawPhoto(ctx, ph, f);

  // ── Powerups ──
  for (const pu of g.powerups) drawPowerup(ctx, pu, f);

  // ── Particles ──
  for (const pt of g.particles) {
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.fillStyle   = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Player ──
  const showPlayer = g.invTimer === 0 || Math.floor(g.invTimer / 5) % 2 === 0;
  if (showPlayer) drawPlayer(ctx, p, th, f, g.shieldTimer > 0);

  // ── HUD ──
  drawHUD(ctx, g, th);
}

// ─────────────────────────── BG ELEMENTS ─────────────────────────────────────
function drawBgEl(ctx: CanvasRenderingContext2D, el: BgEl, th: Theme, f: number) {
  if (el.type === 'mountain') {
    ctx.fillStyle = th.mtCol;
    ctx.beginPath();
    ctx.moveTo(el.x,            GY - 6);
    ctx.lineTo(el.x + el.w * .5, el.y);
    ctx.lineTo(el.x + el.w,     GY - 6);
    ctx.closePath();
    ctx.fill();
    if (!th.neon) {
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.beginPath();
      ctx.moveTo(el.x + el.w * .50, el.y);
      ctx.lineTo(el.x + el.w * .38, el.y + 20);
      ctx.lineTo(el.x + el.w * .62, el.y + 20);
      ctx.closePath();
      ctx.fill();
    }

  } else if (el.type === 'cloud') {
    if (th.neon) {
      // City building
      const bh = el.h * 1.9;
      ctx.fillStyle = 'rgba(8,18,55,0.88)';
      ctx.fillRect(el.x, GY - bh, el.w * 0.65, bh);
      // Windows
      for (let wy = 10; wy < bh - 6; wy += 14) {
        for (let wx = 5; wx < el.w * 0.65 - 6; wx += 12) {
          if (Math.sin(el.x * 0.7 + wy * 0.6) > -0.1) {
            ctx.fillStyle = `rgba(0,229,255,${0.15 + Math.abs(Math.sin(el.x + wy + f * 0.03)) * 0.18})`;
            ctx.fillRect(el.x + wx, GY - bh + wy, 6, 7);
          }
        }
      }
      // ASPECT on tall buildings
      if (el.w > 105 && bh > 80) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ASPECT', el.x + el.w * 0.325, GY - bh + 18);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = th.cloudCol;
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * .5,  el.y + el.h * .5,  el.w * .5,  el.h * .4,  0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * .28, el.y + el.h * .4,  el.w * .3,  el.h * .3,  0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * .72, el.y + el.h * .45, el.w * .24, el.h * .28, 0, 0, Math.PI * 2); ctx.fill();
    }

  } else { // tree
    if (th.neon) {
      // Lamppost
      ctx.fillStyle = '#2a3a55';
      ctx.fillRect(el.x + el.w * .4, el.y, el.w * .2, el.h);
      ctx.fillRect(el.x + el.w * .1, el.y, el.w * .7, el.h * .08);
      const glow = 0.55 + Math.sin(f * 0.06 + el.x) * 0.2;
      ctx.fillStyle = `rgba(0,229,255,${glow})`;
      ctx.beginPath(); ctx.arc(el.x + el.w * .5, el.y + el.h * .04, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,229,255,0.08)';
      ctx.beginPath(); ctx.arc(el.x + el.w * .5, el.y + el.h * .04, 18, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = th.trunkCol;
      ctx.fillRect(el.x + el.w * .35, el.y + el.h * .55, el.w * .3, el.h * .45);
      ctx.fillStyle = th.treeCol;
      ctx.beginPath();
      ctx.moveTo(el.x + el.w / 2, el.y);
      ctx.lineTo(el.x,            el.y + el.h * .52);
      ctx.lineTo(el.x + el.w,     el.y + el.h * .52);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(el.x + el.w / 2, el.y + el.h * .18);
      ctx.lineTo(el.x - el.w * .12, el.y + el.h * .7);
      ctx.lineTo(el.x + el.w * 1.12, el.y + el.h * .7);
      ctx.closePath(); ctx.fill();
    }
  }
}

// ─────────────────────────── SIGNS ───────────────────────────────────────────
function drawSign(ctx: CanvasRenderingContext2D, sg: Sign, th: Theme, f: number) {
  const lines   = SIGN_LINES[sg.lineIdx];
  const poleX   = sg.x + 6;
  const poleTop = GY - sg.h;
  const bw = 92, bh = 46;
  const bx = sg.x - 14, by = poleTop - bh - 2;

  // Pole
  ctx.fillStyle = 'rgba(95,100,120,0.75)';
  ctx.fillRect(poleX, poleTop, 4, sg.h);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(bx + 3, by + 3, bw, bh);

  // Board body
  const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
  bg.addColorStop(0, '#130828');
  bg.addColorStop(1, '#080318');
  ctx.fillStyle = bg;
  ctx.fillRect(bx, by, bw, bh);

  // Glowing border
  const pulse = 0.6 + Math.sin(f * 0.065 + sg.x * 0.012) * 0.32;
  ctx.strokeStyle = th.accent;
  ctx.lineWidth   = 1.5;
  ctx.globalAlpha = pulse;
  ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  ctx.globalAlpha = 1;

  // Inner border
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(bx + 3, by + 3, bw - 6, bh - 6);

  // Text
  ctx.textAlign = 'center';
  ctx.font      = 'bold 12px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = th.accent; ctx.shadowBlur = 5;
  ctx.fillText(lines[0], bx + bw / 2, by + 18);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = th.accent + '55';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(bx + 8,      by + 24);
  ctx.lineTo(bx + bw - 8, by + 24);
  ctx.stroke();

  ctx.font      = 'bold 9px monospace';
  ctx.fillStyle = th.accent;
  ctx.fillText(lines[1], bx + bw / 2, by + 37);

  // Corner bolts
  ctx.fillStyle = 'rgba(175,180,200,0.5)';
  for (const [bx2, by2] of [[bx+4,by+4],[bx+bw-4,by+4],[bx+4,by+bh-4],[bx+bw-4,by+bh-4]]) {
    ctx.beginPath(); ctx.arc(bx2, by2, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.textAlign = 'left';
}

// ─────────────────────────── OBSTACLES ───────────────────────────────────────
function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, th: Theme, f: number) {
  if (o.type === 'box') {
    // Equipment case with ASPECT label
    const gr = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
    gr.addColorStop(0, th.obs1);
    gr.addColorStop(1, th.obs2);
    ctx.fillStyle = gr;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    // Lid highlight
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(o.x, o.y, o.w, 5);
    // Edge strips
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(o.x, o.y, 3, o.h);
    ctx.fillRect(o.x + o.w - 3, o.y, 3, o.h);
    // Clasp
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(o.x + o.w / 2 - 4, o.y + o.h * .42, 8, 5);
    // ASPECT brand on case
    ctx.fillStyle = th.accent + 'bb';
    ctx.font      = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ASPECT', o.x + o.w / 2, o.y + o.h - 5);
    ctx.textAlign = 'left';
    if (th.neon) {
      ctx.strokeStyle = th.accent + '50'; ctx.lineWidth = 1;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }

  } else if (o.type === 'bird') {
    const flap = Math.sin(f * 0.23) * 0.55;
    ctx.save();
    ctx.translate(o.x + o.w * .5, o.y + o.h * .5);
    // Wings
    ctx.fillStyle = th.obs1;
    ctx.beginPath();
    ctx.ellipse(-o.w * .30, flap * 9, o.w * .27, o.h * .36, -0.3 + flap * .4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(o.w * .30, flap * 9, o.w * .27, o.h * .36, 0.3 - flap * .4, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = th.obs2;
    ctx.beginPath();
    ctx.ellipse(0, 0, o.w * .19, o.h * .40, 0, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = '#FF9800';
    ctx.beginPath();
    ctx.moveTo(o.w * .18, -2);
    ctx.lineTo(o.w * .34,  0);
    ctx.lineTo(o.w * .18,  3);
    ctx.closePath(); ctx.fill();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(4, -o.h * .24, 4, 4);
    ctx.fillStyle = '#111';
    ctx.fillRect(5, -o.h * .22, 2, 2);
    if (th.neon) {
      ctx.strokeStyle = th.accent + '55'; ctx.lineWidth = 1;
      ctx.strokeRect(-o.w/2, -o.h/2, o.w, o.h);
    }
    ctx.restore();

  } else {
    // Rock / stone
    const gr = ctx.createRadialGradient(
      o.x + o.w * .38, o.y + o.h * .35, 2,
      o.x + o.w * .5,  o.y + o.h * .5,  o.w * .58,
    );
    gr.addColorStop(0, th.obs1);
    gr.addColorStop(1, th.obs2);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * .12, o.y + o.h * .88);
    ctx.lineTo(o.x,              o.y + o.h * .55);
    ctx.lineTo(o.x + o.w * .18, o.y + o.h * .18);
    ctx.lineTo(o.x + o.w * .52, o.y);
    ctx.lineTo(o.x + o.w * .85, o.y + o.h * .14);
    ctx.lineTo(o.x + o.w,       o.y + o.h * .52);
    ctx.lineTo(o.x + o.w * .82, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.11)';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * .3, o.y + o.h * .3, o.w * .13, o.h * .09, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─────────────────────────── PHOTO ───────────────────────────────────────────
function drawPhoto(ctx: CanvasRenderingContext2D, ph: PhotoMoment, f: number) {
  if (ph.collected) {
    ctx.save();
    ctx.globalAlpha = 1 - ph.collectT / 40;
    ctx.fillStyle   = '#FFD700';
    ctx.font        = 'bold 13px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('+FLASH!', ph.x, ph.y - ph.collectT * 0.95);
    ctx.font = '19px sans-serif';
    ctx.fillText('📸', ph.x, ph.y - 14 - ph.collectT * 0.42);
    ctx.textAlign = 'left';
    ctx.restore();
    return;
  }
  const pulse = 0.88 + Math.sin(f * 0.19) * 0.12;
  ctx.save();
  ctx.translate(ph.x, ph.y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 14;
  ctx.font = '23px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('📸', 0, 10);
  ctx.shadowBlur = 0;
  ctx.fillStyle  = 'rgba(255,215,0,0.9)';
  ctx.font       = 'bold 8px monospace';
  ctx.fillText('FLASH!', 0, 26);
  ctx.textAlign = 'left';
  ctx.restore();
}

// ─────────────────────────── POWERUP ─────────────────────────────────────────
function drawPowerup(ctx: CanvasRenderingContext2D, pu: Powerup, f: number) {
  if (pu.collected) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - pu.collectT / 40);
    ctx.fillStyle = pu.type === 'shield' ? '#22d3ee' : '#f43f5e';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pu.type === 'shield' ? '+KALKAN!' : '+CAN!', pu.x, pu.y - pu.collectT * 0.9);
    ctx.textAlign = 'left';
    ctx.restore();
    return;
  }
  const bob   = Math.sin(f * 0.09 + pu.x * 0.02) * 4;
  const pulse = 0.88 + Math.sin(f * 0.15) * 0.12;
  ctx.save();
  ctx.translate(pu.x, pu.y + bob);
  ctx.scale(pulse, pulse);

  if (pu.type === 'shield') {
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16;
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🛡️', 0, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(34,211,238,0.90)';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('KALKAN', 0, 22);
  } else {
    ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 16;
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('❤️', 0, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(244,63,94,0.90)';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('+CAN', 0, 22);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

// ─────────────────────────── PLAYER ──────────────────────────────────────────
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, th: Theme, f: number, shielded: boolean) {
  const x = PX, y = p.y;
  ctx.save();

  if (p.dead) {
    ctx.translate(x + PW / 2, y + PH / 2);
    ctx.rotate(p.deadAngle);
    ctx.translate(-PW / 2, -PH / 2);
  }

  // Squash / stretch
  let scaleX = 1, scaleY = 1;
  if (p.squashT > 0) {
    const sq = p.squashT / 9;
    scaleY = 1 - sq * 0.26;
    scaleX = 1 + sq * 0.18;
  }
  if (p.vy < -5) { scaleY = 1.10; scaleX = 0.91; }

  // Apply transform around bottom-center
  if (!p.dead) {
    ctx.translate(x + PW / 2, y + PH);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-(x + PW / 2), -(y + PH));
  }

  // Ground shadow
  if (!p.dead) {
    const dist     = GY - (p.y + PH);
    const shadowA  = p.onGround ? 0.22 : Math.max(0.04, 0.22 - dist * 0.0015);
    const shadowW  = p.onGround ? PW * 0.58 : PW * 0.45;
    ctx.fillStyle  = `rgba(0,0,0,${shadowA})`;
    ctx.beginPath();
    ctx.ellipse(x + PW / 2, GY + 3, shadowW, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shield aura
  if (shielded && !p.dead) {
    const auraR = 26 + Math.sin(f * 0.18) * 3;
    const a = 0.30 + Math.sin(f * 0.22) * 0.15;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth   = 3;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(x + PW / 2, y + PH / 2, auraR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a * 0.25;
    ctx.fillStyle   = '#22d3ee';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // Legs
  ctx.fillStyle = p.dead ? '#444' : '#2a1a08';
  const legH = 13, legW = 6;
  if (!p.onGround) {
    // Airborne pose
    ctx.fillRect(x + 3,        y + PH - legH + 4, legW, legH - 5);
    ctx.fillRect(x + PW - 9,   y + PH - legH - 1, legW, legH - 3);
  } else {
    const lo = (p.walkFrame === 0 || p.walkFrame === 3) ? -4 : 4;
    ctx.fillRect(x + 3 + lo,   y + PH - legH, legW, legH);
    ctx.fillRect(x + PW - 9 - lo, y + PH - legH, legW, legH);
  }
  // Shoes
  ctx.fillStyle = '#1a1a1a';
  if (!p.onGround) {
    ctx.fillRect(x + 2,      y + PH - 3, legW + 2, 3);
    ctx.fillRect(x + PW - 9, y + PH - 7, legW + 2, 3);
  } else {
    const lo = (p.walkFrame === 0 || p.walkFrame === 3) ? -4 : 4;
    ctx.fillRect(x + 2 + lo,       y + PH - 3, legW + 3, 3);
    ctx.fillRect(x + PW - 10 - lo, y + PH - 3, legW + 3, 3);
  }

  // Body (shirt)
  const shirtCol = p.dead ? '#555' : (th.id === 'golden' ? '#C0392B' : '#922B21');
  ctx.fillStyle  = shirtCol;
  ctx.fillRect(x + 2, y + 14, PW - 4, 21);
  // ASPECT on shirt
  ctx.fillStyle  = 'rgba(255,255,255,0.32)';
  ctx.font       = 'bold 5px monospace';
  ctx.textAlign  = 'center';
  ctx.fillText('ASPECT', x + PW / 2, y + 26);
  ctx.textAlign  = 'left';

  // Camera body (strapped to side)
  ctx.fillStyle = '#111';
  ctx.fillRect(x + PW - 7, y + 16, 7, 6);
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(x + PW - 3, y + 19, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Strap
  ctx.strokeStyle = 'rgba(180,140,100,0.6)';
  ctx.lineWidth   = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + PW - 7, y + 16);
  ctx.lineTo(x + 8,       y + 18);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#FDBCB4';
  ctx.fillRect(x + 4, y + 2, PW - 8, 14);
  // Hair
  ctx.fillStyle = '#3a2510';
  ctx.fillRect(x + 4, y + 2, PW - 8, 5);
  ctx.fillRect(x + 4, y + 4, 3, 5);
  // Eyes
  ctx.fillStyle = '#111';
  ctx.fillRect(x + 8,       y + 8, 3, 3);
  ctx.fillRect(x + PW - 11, y + 8, 3, 3);
  // Mouth
  if (p.dead) {
    ctx.fillStyle = '#7a2a2a';
    ctx.fillRect(x + 9, y + 13, PW - 18, 1);
  }

  // Double-jump particle trail
  if (!p.onGround && p.jumpsLeft === 0) {
    ctx.fillStyle = th.accent + '70';
    const trail = 5 + Math.sin(f * 0.35) * 2.5;
    ctx.beginPath();
    ctx.arc(x + PW / 2, y + PH + 3, trail, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ─────────────────────────── HUD ─────────────────────────────────────────────
function drawHUD(ctx: CanvasRenderingContext2D, g: G, th: Theme) {
  // Semi-transparent top strip
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.fillRect(0, 0, CW, 32);

  // ── Left: theme name + speed bar ──
  ctx.font      = 'bold 9px monospace';
  ctx.fillStyle = th.accent;
  ctx.textAlign = 'left';
  ctx.fillText(`${th.emoji} ${th.name.toUpperCase()}`, 9, 13);

  const spPct = (g.speed - SPD_INIT) / (SPD_MAX - SPD_INIT);
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.fillRect(9, 18, 62, 3);
  ctx.fillStyle = th.accent;
  ctx.fillRect(9, 18, 62 * spPct, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font      = '7px monospace';
  ctx.fillText('HIZ', 9, 29);

  // ── Center: combo (only when active) ──
  if (g.combo >= 3) {
    const cm  = g.combo >= 10 ? 3 : g.combo >= 5 ? 2 : 1.5;
    const col = cm >= 2 ? '#FF4500' : '#FFD700';
    ctx.textAlign   = 'center';
    ctx.font        = 'bold 11px monospace';
    ctx.fillStyle   = col;
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.fillText(`×${cm.toFixed(1)} KOMBO`, CW / 2, 14);
    ctx.shadowBlur = 0;
    ctx.font      = '7px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillText(`x${g.combo} engel`, CW / 2, 25);
  }

  // ── Right: score + lives ──
  ctx.textAlign   = 'right';
  ctx.font        = 'bold 22px monospace';
  ctx.fillStyle   = '#ffffff';
  ctx.shadowColor = th.accent; ctx.shadowBlur = 8;
  ctx.fillText(`${g.score}`, CW - 9, 21);
  ctx.shadowBlur  = 0;
  ctx.font        = '7px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.32)';
  ctx.fillText('PUAN', CW - 9, 30);

  // Lives (hearts — up to 5)
  const maxShow = Math.max(3, g.lives);
  for (let i = 0; i < maxShow; i++) {
    ctx.globalAlpha = i < g.lives ? 1 : 0.18;
    ctx.font        = '12px sans-serif';
    ctx.fillText('❤', CW - 9 - i * 16, 48);
  }
  ctx.globalAlpha = 1;

  // Shield bar (when active)
  if (g.shieldTimer > 0) {
    const pct = g.shieldTimer / 540;
    ctx.fillStyle = 'rgba(34,211,238,0.12)';
    ctx.fillRect(CW - 74, 53, 66, 5);
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(CW - 74, 53, 66 * pct, 5);
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#22d3ee';
    ctx.textAlign = 'right';
    ctx.fillText('🛡️ KALKAN', CW - 9, 68);
  }
  ctx.textAlign = 'left';
}

// ─────────────────────────── API ──────────────────────────────────────────────
interface ScoreEntry { sira: number; isim: string; skor: number; tarih: string; }

async function saveScore(score: number, accessToken: string, themeCount: number) {
  try {
    await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4da0b637/game/skor`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Access-Token': accessToken,
      },
      body: JSON.stringify({ skor: score, temaSayisi: themeCount }),
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
  } catch { return []; }
}

// ─────────────────────────── COMPONENT ───────────────────────────────────────
export function AspectRunner({ userName, userRole, accessToken, onBack }: AspectRunnerProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const gameRef      = useRef<G | null>(null);
  const rafRef       = useRef<number>(0);
  const scoreSaved   = useRef(false);
  const jumpHeld     = useRef(false); // prevent held-spacebar spam

  // UI state — kept minimal to avoid per-frame re-renders
  const [uiState,    setUiState]    = useState<'menu' | 'playing' | 'dead' | 'scores'>('menu');
  const [score,      setScore]      = useState(0);
  const [combo,      setCombo]      = useState(0);
  const [speech,     setSpeech]     = useState<{ who: 'char' | 'coach'; text: string } | null>(null);
  const [milestone,  setMilestone]  = useState<string | null>(null);
  const [scores,     setScores]     = useState<ScoreEntry[]>([]);
  const [scoresTab,  setScoresTab]  = useState<'haftalik' | 'tumzamanlar'>('haftalik');
  const [scoresLoad, setScoresLoad] = useState(false);

  // Refs for avoiding stale closures in loop
  const speechRef    = useRef<string | null>(null);
  const milestoneRef = useRef<string | null>(null);

  // ── Loop ────────────────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    const g   = gameRef.current;
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!g || !cvs || !ctx) return;

    update(g, jumpHeld.current);
    draw(ctx, g);

    // Minimal state sync — only on change
    if (g.frame % 8 === 0) {
      setScore(g.score);
      setCombo(g.combo);
    }
    const sText = g.speech?.text ?? null;
    if (sText !== speechRef.current) {
      speechRef.current = sText;
      setSpeech(g.speech ? { who: g.speech.who, text: g.speech.text } : null);
    }
    const mText = g.milestone?.text ?? null;
    if (mText !== milestoneRef.current) {
      milestoneRef.current = mText;
      setMilestone(mText);
    }

    if (g.status === 'playing') {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      setUiState('dead');
      if (!scoreSaved.current) {
        scoreSaved.current = true;
        saveScore(g.score, accessToken, g.themeIdx + 1);
      }
    }
  }, [accessToken]); // stable — accessToken never changes mid-session

  // ── Start ────────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    scoreSaved.current = false;
    speechRef.current = null;
    milestoneRef.current = null;
    gameRef.current = initG();
    setSpeech(null);
    setMilestone(null);
    setUiState('playing');
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  // ── Jump ─────────────────────────────────────────────────────────────────
  const handleJumpStart = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    if (!jumpHeld.current) {
      jumpHeld.current = true;
      doJump(g.player);
    }
  }, []);

  const handleJumpEnd = useCallback(() => {
    jumpHeld.current = false;
    const g = gameRef.current;
    if (g && g.status === 'playing' && g.player.vy < 0) {
      g.player.vy = Math.max(g.player.vy, JUMP_CUT);
    }
  }, []);

  // keep handleJump for canvas onClick (mouse click = tap)
  const handleJump = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;
    doJump(g.player);
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJumpStart();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') handleJumpEnd();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [handleJumpStart, handleJumpEnd]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // ── Load scores ───────────────────────────────────────────────────────────
  const loadScores = useCallback(async (tab: 'haftalik' | 'tumzamanlar') => {
    setScoresLoad(true);
    setScores(await fetchScores(tab, accessToken));
    setScoresLoad(false);
  }, [accessToken]);

  useEffect(() => {
    if (uiState === 'scores' || uiState === 'dead') loadScores(scoresTab);
  }, [uiState, scoresTab, loadScores]);

  // ── Menu canvas preview ───────────────────────────────────────────────────
  useEffect(() => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;
    const th = THEMES[0];
    const sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, th.sky1); sky.addColorStop(1, th.sky2);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = th.mtCol;
    ctx.beginPath(); ctx.moveTo(55,  GY-8); ctx.lineTo(180, 150); ctx.lineTo(305, GY-8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(205, GY-8); ctx.lineTo(315, 132); ctx.lineTo(425, GY-8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = th.gnd1; ctx.fillRect(0, GY, CW, 13);
    ctx.fillStyle = th.gnd2; ctx.fillRect(0, GY + 13, CW, CH - GY - 13);
    ctx.globalAlpha = 0.058;
    ctx.fillStyle = '#FFE066';
    ctx.font = 'bold 92px monospace'; ctx.textAlign = 'center';
    ctx.fillText('ASPECT', CW / 2, 200);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'relative', width: '100%', background: 'linear-gradient(135deg,#08041c 0%,#160836 50%,#0b0620 100%)', minHeight: '100%' }}
      onTouchStart={uiState === 'playing' ? handleJumpStart : undefined}
      onTouchEnd={uiState === 'playing' ? handleJumpEnd : undefined}
    >
      {/* Back */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
        <button
          onClick={onBack}
          style={{ background: 'rgba(8,4,28,0.88)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '6px 10px', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          <ChevronLeft size={14} /> Geri
        </button>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={CW} height={CH}
          onClick={uiState === 'playing' ? handleJump : undefined}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
        />

        {/* Milestone popup */}
        {uiState === 'playing' && (
          <AnimatePresence>
            {milestone && (
              <motion.div
                key={milestone}
                initial={{ opacity: 0, scale: 0.62, y: 10 }}
                animate={{ opacity: 1, scale: 1,    y: 0 }}
                exit={{ opacity: 0,   scale: 1.18,  y: -14 }}
                style={{
                  position: 'absolute', top: '28%', left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg,rgba(255,215,0,0.97),rgba(255,140,0,0.97))',
                  border: '2px solid rgba(255,255,255,0.35)', borderRadius: 18,
                  padding: '8px 24px', pointerEvents: 'none', zIndex: 15,
                  boxShadow: '0 0 38px rgba(255,215,0,0.58)',
                }}
              >
                <p style={{ color: '#1a0a3c', fontSize: 16, fontWeight: 900, margin: 0, letterSpacing: '0.05em', textAlign: 'center', fontFamily: 'monospace' }}>
                  {milestone}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── MENU ── */}
        <AnimatePresence>
          {uiState === 'menu' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,rgba(6,3,20,0.90) 0%,rgba(18,7,46,0.95) 100%)' }}
            >
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ textAlign: 'center', marginBottom: 12 }}
              >
                <div style={{ fontSize: 33, fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.28em', color: '#fff', textShadow: '0 0 32px #a855f7, 0 0 64px #7c3aed50' }}>
                  ASPECT
                </div>
                <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.55em', color: '#a78bfa', marginTop: 3 }}>
                  RUNNER
                </div>
              </motion.div>

              {/* Theme pills */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {THEMES.map((t, i) => (
                  <div key={i} style={{ padding: '5px 16px', borderRadius: 20, background: `linear-gradient(135deg,${t.sky1},${t.sky2})`, fontSize: 12, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {t.emoji} {t.name}
                  </div>
                ))}
              </div>

              {/* Feature pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 300, marginBottom: 18 }}>
                {['❤️ Can & 🛡️ Kalkan', '📸 Flash Anlar', '🔥 Kombo', '🌅→🌃 Tema Geçişi'].map(feat => (
                  <span key={feat} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)', borderRadius: 20, padding: '3px 11px', color: 'rgba(255,255,255,0.52)', fontSize: 10, fontWeight: 600 }}>
                    {feat}
                  </span>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={startGame}
                style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 16, padding: '13px 46px', color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 0 30px rgba(168,85,247,0.52)', marginBottom: 10 }}
              >
                <Play size={16} /> OYNA
              </motion.button>

              <button
                onClick={() => setUiState('scores')}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 12, padding: '7px 22px', color: 'rgba(255,255,255,0.42)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trophy size={12} /> Skor Tablosu
              </button>

              <div style={{ marginTop: 18, color: 'rgba(255,255,255,0.18)', fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                BASILI TUT → YÜKSEK ZIPLA &nbsp;·&nbsp; BIRAK → ALÇAK ZIPLA
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── DEAD ── */}
        <AnimatePresence>
          {uiState === 'dead' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,3,18,0.92)', backdropFilter: 'blur(4px)' }}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14 }}
                style={{ textAlign: 'center', marginBottom: 22 }}
              >
                <div style={{ fontSize: 42, marginBottom: 8 }}>📷</div>
                <p style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 900, fontSize: 16, letterSpacing: '0.12em', margin: 0 }}>
                  OYUN BİTTİ
                </p>
                <p style={{ color: '#FFD700', fontFamily: 'monospace', fontWeight: 900, fontSize: 36, margin: '8px 0 2px' }}>
                  {score.toLocaleString()}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 9, margin: 0, letterSpacing: '0.14em' }}>PUAN</p>
                {combo >= 3 && (
                  <div style={{ marginTop: 10, background: 'rgba(255,69,0,0.11)', border: '1px solid rgba(255,69,0,0.26)', borderRadius: 10, padding: '4px 14px', display: 'inline-block' }}>
                    <span style={{ color: '#FF6B35', fontSize: 11, fontWeight: 700 }}>🔥 En yüksek kombo: x{combo}</span>
                  </div>
                )}
              </motion.div>

              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={startGame}
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 14, padding: '11px 28px', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 0 22px rgba(168,85,247,0.42)' }}
                >
                  <RotateCcw size={14} /> Tekrar
                </motion.button>
                <button
                  onClick={() => setUiState('scores')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 14, padding: '11px 20px', color: 'rgba(255,255,255,0.62)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trophy size={14} /> Skor
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Chat ticker ── */}
      {uiState === 'playing' && (
        <div style={{ width: '100%', maxWidth: CW, minHeight: 32, background: 'rgba(6,3,18,0.74)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(168,85,247,0.16)', borderRadius: '0 0 16px 16px', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {speech ? (
              <motion.div
                key={speech.text}
                initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.26 }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ fontSize: 13 }}>{speech.who === 'char' ? '🏃' : '🧑‍💼'}</span>
                <span style={{ color: speech.who === 'coach' ? '#a78bfa' : 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', flexShrink: 0 }}>
                  {speech.who === 'char' ? 'KARAKTER' : 'ÖZGÜR'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: 11, fontWeight: 600 }}>{speech.text}</span>
              </motion.div>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, letterSpacing: '0.12em', fontFamily: 'monospace' }}
              >
                BASILI TUT → YÜKSEK ZIPLA &nbsp;·&nbsp; BIRAK → ALÇAK &nbsp;·&nbsp; 🛡️ ❤️ POWERUP TOPLA
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Scoreboard ── */}
      <AnimatePresence>
        {uiState === 'scores' && (
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#08041c,#160836,#0b0620)', overflowY: 'auto', padding: '16px 16px 80px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => setUiState('menu')}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '6px 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
              >
                <ChevronLeft size={14} /> Menü
              </button>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={14} style={{ display: 'inline' }} /> Skor Tablosu
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['haftalik', 'tumzamanlar'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setScoresTab(tab)}
                  style={{ flex: 1, background: scoresTab === tab ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(255,255,255,0.05)', border: `1px solid ${scoresTab === tab ? 'transparent' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '8px', color: scoresTab === tab ? '#fff' : 'rgba(255,255,255,0.42)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {tab === 'haftalik' ? '🗓 Bu Hafta' : '🏆 Tüm Zamanlar'}
                </button>
              ))}
            </div>

            {scoresLoad ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Star size={24} style={{ color: '#a855f7' }} />
                </motion.div>
                <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 12, marginTop: 10 }}>Yükleniyor...</p>
              </div>
            ) : scores.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontSize: 13, padding: 40 }}>
                Henüz skor yok. İlk sen ol! 🚀
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {scores.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: i === 0 ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.22)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 14, padding: '12px 14px',
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i === 0 ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.05)', fontSize: i < 3 ? 16 : 12, fontWeight: 800, color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.32)' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>{s.isim}</p>
                      <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, margin: '2px 0 0' }}>{s.tarih}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: i === 0 ? '#FFD700' : '#a78bfa', fontSize: 18, fontWeight: 900, margin: 0, fontFamily: 'monospace' }}>
                        {s.skor.toLocaleString()}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, margin: 0 }}>PUAN</p>
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
