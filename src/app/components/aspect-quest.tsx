/**
 * ASPECT QUEST — 8 Bölümlü Platformer
 * Türkiye · Fethiye · ASPECT Operations
 * Bosses: Celil & Selçuk, Zuhal, Büşra, Tanrıverdi, Kayhan, Aman Aman, Özgür
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, Volume2, VolumeX, Trophy, RotateCcw, Heart } from 'lucide-react';
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
  boss:    () => { tone(80, 0.5, 0.3, 'sawtooth'); setTimeout(() => tone(60, 0.5, 0.3, 'sawtooth'), 300); },
  bossHit: () => { tone(200, 0.12, 0.25, 'sawtooth'); },
  bossWin: () => [550, 660, 770, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.2, 0.3, 'triangle'), i * 60)),
};

// ─────────────────────────── TYPES ───────────────────────────────────────────
interface Plat {
  x: number; y: number; w: number; h: number; col: string;
  ox?: number; oy?: number; dvx?: number; dvy?: number; range?: number; spd?: number; t?: number;
  slippery?: boolean;
}
interface Enemy {
  id: number; x: number; y: number; w: number; h: number;
  type: 'minion' | 'zabita' | 'girl' | 'boss_celil' | 'boss_selcuk' | 'boss_zuhal' | 'boss_busra' | 'boss_tanriverdi' | 'boss_kayhan' | 'boss_amanaman' | 'boss_ozgur';
  vx: number; alive: boolean; minX: number; maxX: number;
  oy: number; hp?: number; maxHp?: number; attackTimer?: number; phase?: number;
  hitTimer?: number; stunTimer?: number; isStomped?: boolean;
}
interface Projectile {
  id: number; x: number; y: number; vx: number; vy: number;
  type: 'plate' | 'ice' | 'net' | 'surfboard' | 'album' | 'shockwave';
  w: number; h: number; active: boolean; timer: number;
  netActive?: boolean; // net caught player
}
interface SpawnedGirl {
  id: number; x: number; y: number; vx: number; alive: boolean; vy: number; onGround: boolean;
}
interface Collectable {
  id: number; x: number; y: number; w: number; h: number;
  type: 'lens' | 'frame' | 'card' | 'battery' | 'star';
  pts: number; got: boolean;
}
interface Spark { x: number; y: number; vx: number; vy: number; life: number; maxl: number; col: string; sz: number; }
interface FloatText { x: number; y: number; text: string; life: number; col: string; }
interface Dialog { speaker: string; text: string; portrait: string; }

type Screen = 'menu' | 'dialog' | 'play' | 'boss_fight' | 'boss_dead' | 'lvlwin' | 'over' | 'victory';

interface GS {
  screen: Screen; lvl: number;
  px: number; py: number; pvx: number; pvy: number;
  ponG: boolean; pjumps: number; pface: number;
  lives: number; score: number;
  pinv: number; pcamAnim: number; pdead: boolean; pdeadT: number;
  netTimer: number; // slowed by Büşra net
  plats: Plat[]; enemies: Enemy[]; items: Collectable[];
  projectiles: Projectile[]; spawnedGirls: SpawnedGirl[];
  sparks: Spark[]; floats: FloatText[];
  camX: number; t: number; levelT: number; flash: number;
  waterLevel: number; waterRising: boolean;
  shockwaveTimer: number; shockwaveX: number;
  bossDefeated: boolean;
  zabitas: { x: number; y: number; vx: number }[];
  dialogIdx: number; dialogs: Dialog[];
  bossSpawned: boolean;
  projId: number; girlId: number;
  levelComplete: boolean;
}

// ─────────────────────────── CONSTANTS ───────────────────────────────────────
const CW = 480, CH = 360;
const GY = 305;
const PW = 22, PH = 34;
const GRAV = 0.52, JV = -12.5, DJV = -10.5, SPD = 3.7, MAXVY = 14;

// ─────────────────────────── HELPERS ─────────────────────────────────────────
const gnd  = (x: number, w: number, col = '#704214', slip = false): Plat => ({ x, y: GY, w, h: 60, col, slippery: slip });
const plt  = (x: number, y: number, w: number, col: string): Plat => ({ x, y, w, h: 16, col });
const mplX = (ox: number, oy: number, w: number, col: string, range: number): Plat =>
  ({ x: ox, y: oy, w, h: 16, col, ox, oy, dvx: 1, dvy: 0, range, spd: 0.03, t: Math.random() * 6.28 });

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ─────────────────────────── LEVEL DIALOGS ───────────────────────────────────
type DialogKey = 'intro' | 'boss_intro' | 'boss_win' | 'npc_necati' | 'npc_ezgi' | 'npc_zeliha' | 'npc_ayse';

interface LevelDialogSet {
  intro: Dialog[];
  boss_intro?: Dialog[];
  boss_win?: Dialog[];
  mid?: Dialog[];
}

const LEVEL_DIALOGS: LevelDialogSet[] = [
  // Level 0: Zoka Restaurant
  {
    intro: [
      { speaker: 'Özgür', text: 'Zoka\'dan başlıyoruz. İlk durak, ilk fotoğraf. Ama kolay olduğunu sanma.', portrait: 'ozgur' },
      { speaker: 'Celil', text: 'Buyur kardeşim, güzel geldin. Bu mekanı sen yönetemezsin ama misafir olabilirsin.', portrait: 'celil' },
      { speaker: 'Selçuk', text: 'Celil\'in dediği gibi... Yani... Saygı çerçevesinde tabii. Hoş geldin.', portrait: 'selcuk' },
      { speaker: 'Özgür', text: 'Tamam tamam. Önce içeri girelim. Fotoğrafları yakala!', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Celil', text: 'Dur bir dakika! Burası fotoğraf stüdyosu değil. Biraz fazla ileri gittin sanırım.', portrait: 'celil' },
      { speaker: 'Selçuk', text: 'Celil... yani... haklı. Ama şiddet istemem ha. Centilmence halledelim.', portrait: 'selcuk' },
      { speaker: 'Celil', text: 'Tabakları hazırla Selçuk. Zarif bir şekilde.', portrait: 'celil' },
    ],
    boss_win: [
      { speaker: 'Celil', text: 'Tamam tamam, hakkını vereyim. İyi fotoğrafçısın. Zoka\'dan bir kare kazandın.', portrait: 'celil' },
      { speaker: 'Selçuk', text: 'Ben zaten tabak atmak istemiyordum... 😅', portrait: 'selcuk' },
    ],
  },
  // Level 1: Fethiye Sokakları (escape - no boss)
  {
    intro: [
      { speaker: 'Özgür', text: 'Fethiye sokaklarında çekim yaparken dikkatli ol. Belediye zabıtası bugün aktif.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'İzin belgesi... evet var ama... bulmak biraz zaman alıyor. Şimdilik koş!', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Sokağın sonuna ulaş, bir şey olursa ararım seni. KOŞ!', portrait: 'ozgur' },
    ],
    boss_win: [
      { speaker: 'Özgür', text: 'Bravo! Zabıtaları atlattın. Hız konusunda sorun yok. 😄', portrait: 'ozgur' },
    ],
  },
  // Level 2: Balık Hali
  {
    intro: [
      { speaker: 'Necati Abi', text: 'Hoş geldin evladım. Balık Hali\'ne. Burası bizim topraklarımız.', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Ama dikkat et — Zuhal bugün sinirli. Sabahtan beri tartışıyor. Ona yaklaşma.', portrait: 'necati' },
      { speaker: 'Özgür', text: 'Necati Abi\'ye teşekkürler. Fotoğrafları çek, Zuhal\'dan kaç. Basit!', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Zuhal', text: 'Dur orada! Kim verdi sana burada fotoğraf çekme izni?', portrait: 'zuhal' },
      { speaker: 'Zuhal', text: 'Ezgi! Zeliha! Ayşe! Gelin buraya bakayım!', portrait: 'zuhal' },
      { speaker: 'Ezgi', text: 'Tamam geliyor... Ne var yine?', portrait: 'ezgi' },
      { speaker: 'Zeliha', text: 'Ben saldırmam bu adama. Yani... Niye saldırıyoruz ki?', portrait: 'zeliha' },
      { speaker: 'Ayşe', text: 'Ben de istemiyorum ama... Zuhal Hanım kızar...', portrait: 'ayse' },
      { speaker: 'Zuhal', text: 'SALDIRIN DEDİM! Buz küreklerini alın!', portrait: 'zuhal' },
      { speaker: 'Zeliha', text: '...Tamam yani... 😒', portrait: 'zeliha' },
    ],
    boss_win: [
      { speaker: 'Zuhal', text: 'Hmm. Fena değil. Ama bir daha görürsem...', portrait: 'zuhal' },
      { speaker: 'Necati Abi', text: 'Aferin evladım. Gel şunu al. Müjgan\'a git, ama Büşra orada bugün...', portrait: 'necati' },
      { speaker: 'Zeliha', text: 'Ben zaten saldırmak istemiyordum zaten. 😤', portrait: 'zeliha' },
    ],
  },
  // Level 3: Müjgan Restaurant (rising water, Büşra boss)
  {
    intro: [
      { speaker: 'Özgür', text: 'Müjgan Restaurant. Güzel mekan. Bir de... borular bu sabah patladı mı nedir?', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Su yükseliyor. Platformlara atla, yukarıda kal. Ve Büşra\'ya dikkat.', portrait: 'ozgur' },
      { speaker: 'Büşra', text: 'Özgür! Bu ne saçmalık? Burada ne arıyorsun sen?!', portrait: 'busra' },
      { speaker: 'Özgür', text: 'Merhaba ortağım... kamera... fotoğraf... iş gereği...', portrait: 'ozgur' },
      { speaker: 'Büşra', text: 'İş gereği?! Su bastı mekanı, sen fotoğraf çekiyorsun!', portrait: 'busra' },
    ],
    boss_intro: [
      { speaker: 'Büşra', text: 'Yeter! Dur bir saniye!', portrait: 'busra' },
      { speaker: 'Büşra', text: 'Ağı al! Bir ASPECT fotoğrafçısını bir balık gibi yakalamanın vakti geldi!', portrait: 'busra' },
      { speaker: 'Özgür', text: 'Büşra dur dur dur — iş birliği yapalım, beraber çözelim...', portrait: 'ozgur' },
    ],
    boss_win: [
      { speaker: 'Büşra', text: 'Tamam tamam. Hakkını vereyim. İyi kaçtın.', portrait: 'busra' },
      { speaker: 'Büşra', text: 'Ama bir daha burayı su basarsa seni çağırıyorum. Sen de geleceksin!', portrait: 'busra' },
      { speaker: 'Özgür', text: '...Tabii ki gelirim ortağım. 😅', portrait: 'ozgur' },
    ],
  },
  // Level 4: Çalış Plajı (Tanrıverdi boss)
  {
    intro: [
      { speaker: 'Özgür', text: 'Çalış Plajı. Güneş, kum, turkuaz su. Mükemmel fotoğraf mekanı.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Bir de Tanrıverdi var tabii. Uzun boylu, sakallı. Kendini çok beğenmiş biri.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Sörf tahtasını fırlatır, dikkat et. Kum üzerinde biraz yavaş kalırsın.', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Tanrıverdi', text: 'Eyyy! Bu plajda çekim mi yapıyorsun sen?', portrait: 'tanriverdi' },
      { speaker: 'Tanrıverdi', text: 'Burası benim alanım. Ben burada oluşmadan fotoğraf çekilmez.', portrait: 'tanriverdi' },
      { speaker: 'Özgür', text: 'Anlıyorum ama... turistik fotoğrafçılık, iznim var...', portrait: 'ozgur' },
      { speaker: 'Tanrıverdi', text: 'Şu sörf tahtasını al bakalım!', portrait: 'tanriverdi' },
    ],
    boss_win: [
      { speaker: 'Tanrıverdi', text: 'Tamam... fena değilsin. Devam et.', portrait: 'tanriverdi' },
      { speaker: 'Özgür', text: 'Sağ ol Tanrıverdi. Bir gün seninle fotoğraf çekeceğiz!', portrait: 'ozgur' },
    ],
  },
  // Level 5: İki Duble (Kayhan boss)
  {
    intro: [
      { speaker: 'Özgür', text: 'İki Duble. Karanlık, müzik yüksek. Ama kare burada da var.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Kayhan burada takılıyor her gece. Kısa boylu, siyah giyimli, beyaz ayakkabı.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Telefona sarılırsa dur! Telefonda kızları çağırıyor, etraf dolup taşıyor.', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Kayhan', text: 'Dur bakalım. Fotoğrafçı mı bu? İyi, iyi...', portrait: 'kayhan' },
      { speaker: 'Kayhan', text: 'Ama bu mekanda öyle öyle dolaşılmaz. *telefona bakıyor*', portrait: 'kayhan' },
      { speaker: 'Kayhan', text: 'Alo? Siz gelin bakayım buraya. Evet. Şimdi.', portrait: 'kayhan' },
    ],
    boss_win: [
      { speaker: 'Kayhan', text: 'Vay be. Çevik adamsın. Tamam, bu kareyi hak ettin.', portrait: 'kayhan' },
      { speaker: 'Özgür', text: 'Teşekkürler Kayhan. Mios\'a geçiyorum.', portrait: 'ozgur' },
    ],
  },
  // Level 6: Mios Restaurant (Aman Aman boss)
  {
    intro: [
      { speaker: 'Özgür', text: 'Mios. Güvenli liman gibi görünür. Ama Aman Aman bugün moodu bozuk.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Sol kolu dövmeli, uzun boylu, sakallı. Bağırınca her şey sallanıyor.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Şok dalgasından kaç. Kafan dumanlıysa bir an dur, nefes al.', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Aman Aman', text: 'Aman aman... Ne bu karışıklık? Kim bu adam?', portrait: 'amanaman' },
      { speaker: 'Aman Aman', text: 'BURASI ÖZEL ALAN!', portrait: 'amanaman' },
      { speaker: 'Özgür', text: 'Aman aman...', portrait: 'ozgur' },
      { speaker: 'Aman Aman', text: 'AMAN AMAN DEMEYECEKSİN BENİM ADIMI!', portrait: 'amanaman' },
    ],
    boss_win: [
      { speaker: 'Aman Aman', text: '...Tamam, tamam. İyi adamsın. Git.', portrait: 'amanaman' },
      { speaker: 'Özgür', text: 'Son durak ASPECT HQ. Kendi ofisime gidiyorum. Ama orada da çile var...', portrait: 'ozgur' },
    ],
  },
  // Level 7: ASPECT HQ (Özgür Final Boss)
  {
    intro: [
      { speaker: 'Özgür', text: 'ASPECT HQ. Kendi ofisim. Kendi dünyam.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Ama bugün personel değerlendirmesi var. Ve ben... patronum.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Son fotoğrafı çekersen... seni gerçek ASPECT fotoğrafçısı ilan ederim.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Ama önce benden geçeceksin. 😈', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Özgür', text: 'Haha! Buraya kadar geldin! İyi.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Ama bu albümleri gördün mü? 10 yıllık arşiv. Fırlatmaya başladım mı...', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Toplantı zamanı! Personel çağırıyorum!', portrait: 'ozgur' },
    ],
    boss_win: [
      { speaker: 'Özgür', text: '...Kazandın. Gerçek bir ASPECT fotoğrafçısısın.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Tüm mekanları gezdik, tüm fotoğrafları çektik. Mükemmeldi.', portrait: 'ozgur' },
      { speaker: 'Özgür', text: 'Hoş geldin ASPECT ailesine! 📸✨', portrait: 'ozgur' },
    ],
  },
];

// ─────────────────────────── LEVEL DATA ──────────────────────────────────────
interface LevelDef {
  name: string; ww: number; fx: number;
  bg1: string; bg2: string; gc: string; acc: string;
  plats: Plat[];
  items: { x: number; y: number; type: Collectable['type']; pts: number }[];
  hasBoss: boolean;
  bossType: Enemy['type'];
  bossX: number;
  isEscape?: boolean;
  waterRises?: boolean;
  sandLevel?: boolean;
  darkBar?: boolean;
}

const W1 = '#8B6914', M1 = '#1e4a72', S1 = '#4a3a6a', R1 = '#1a5c1a';
const B1 = '#2a4a2a', P1 = '#6a2a6a';

function makePlatItems(xs: number[], y: number, types: Collectable['type'][]): { x: number; y: number; type: Collectable['type']; pts: number }[] {
  return xs.map((x, i) => ({ x, y: y - 20, type: types[i % types.length], pts: types[i % types.length] === 'star' ? 300 : types[i % types.length] === 'card' ? 100 : 75 }));
}

const LEVELS: LevelDef[] = [
  // ── LEVEL 0: Zoka Restaurant
  {
    name: 'Zoka Restaurant 🍽️', ww: 3800, fx: 3620,
    bg1: '#1a0033', bg2: '#3d0066', gc: '#220033', acc: '#FF00FF',
    hasBoss: true, bossType: 'boss_celil', bossX: 3400,
    plats: [
      gnd(0, 380), gnd(480, 280), gnd(870, 260), gnd(1250, 300), gnd(1700, 280),
      gnd(2100, 260), gnd(2550, 280), gnd(2950, 260), gnd(3200, 600),
      plt(120, 255, 90, S1), plt(280, 215, 80, S1), plt(450, 255, 85, S1),
      plt(620, 210, 80, S1), plt(790, 255, 85, S1), plt(970, 200, 80, S1),
      plt(1140, 255, 85, S1), plt(1320, 190, 80, S1), plt(1490, 255, 85, S1),
      plt(1670, 205, 80, S1), plt(1840, 255, 85, S1), plt(2020, 188, 80, S1),
      plt(2200, 255, 85, S1), plt(2390, 200, 80, S1), plt(2580, 255, 85, S1),
      plt(2760, 195, 80, S1), plt(2940, 255, 85, S1), plt(3120, 188, 80, S1),
      mplX(1580, 265, 72, S1, 120), mplX(2800, 240, 72, S1, 140),
    ],
    items: [
      ...makePlatItems([140, 300, 470, 640, 810, 990, 1160, 1340, 1510, 1690, 1860, 2040, 2220, 2410, 2600, 2780, 2960, 3140], 255, ['lens', 'frame', 'card', 'battery', 'star', 'lens', 'frame', 'card', 'battery', 'star', 'lens', 'frame', 'card', 'battery', 'star', 'lens', 'frame', 'card']),
    ],
  },
  // ── LEVEL 1: Fethiye Sokakları (escape)
  {
    name: 'Fethiye Sokakları 🏃', ww: 3400, fx: 3200,
    bg1: '#1a2a0a', bg2: '#2a4a1a', gc: '#1a3a0a', acc: '#88FF44',
    hasBoss: false, bossType: 'minion', bossX: 0,
    isEscape: true,
    plats: [
      gnd(0, 340), gnd(440, 280), gnd(790, 260), gnd(1150, 300), gnd(1560, 280),
      gnd(1940, 260), gnd(2360, 280), gnd(2730, 600),
      plt(90, 255, 85, B1), plt(250, 212, 78, B1), plt(410, 255, 83, B1),
      plt(570, 206, 78, B1), plt(740, 255, 83, B1), plt(910, 196, 78, B1),
      plt(1080, 255, 83, B1), plt(1260, 178, 78, B1), plt(1440, 255, 83, B1),
      plt(1630, 196, 78, B1), plt(1820, 255, 83, B1), plt(2010, 178, 78, B1),
      plt(2200, 255, 83, B1), plt(2400, 196, 78, B1), plt(2590, 255, 80, B1),
      mplX(1480, 265, 70, B1, 100), mplX(2650, 235, 70, B1, 120),
    ],
    items: [
      ...makePlatItems([110, 270, 430, 590, 760, 930, 1100, 1280, 1460, 1650, 1840, 2030, 2220, 2420, 2610], 255, ['lens', 'star', 'card', 'battery', 'frame', 'lens', 'star', 'card', 'battery', 'frame', 'lens', 'star', 'card', 'battery', 'frame']),
    ],
  },
  // ── LEVEL 2: Balık Hali
  {
    name: 'Balık Hali 🐟', ww: 3900, fx: 3720,
    bg1: '#FF7043', bg2: '#FFB74D', gc: '#C2824A', acc: '#FFE082',
    hasBoss: true, bossType: 'boss_zuhal', bossX: 3500,
    plats: [
      gnd(0, 420), gnd(530, 300), gnd(940, 280), gnd(1380, 320), gnd(1840, 300),
      gnd(2280, 280), gnd(2720, 300), gnd(3060, 280), gnd(3300, 600),
      plt(130, 265, 88, W1), plt(300, 228, 80, W1), plt(480, 265, 85, W1),
      plt(650, 222, 80, W1), plt(820, 265, 85, W1), plt(1000, 210, 80, W1),
      plt(1170, 265, 85, W1), plt(1360, 196, 80, W1), plt(1540, 265, 85, W1),
      plt(1720, 206, 80, W1), plt(1900, 265, 85, W1), plt(2090, 192, 80, W1),
      plt(2270, 265, 85, W1), plt(2460, 202, 80, W1), plt(2640, 265, 85, W1),
      plt(2830, 196, 80, W1), plt(3020, 265, 85, W1), plt(3180, 192, 80, W1),
      mplX(1600, 272, 72, W1, 110), mplX(2850, 245, 72, W1, 130),
    ],
    items: [
      ...makePlatItems([150, 320, 500, 670, 840, 1020, 1190, 1380, 1560, 1740, 1920, 2110, 2290, 2480, 2660, 2850, 3040, 3200], 265, ['lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'card']),
    ],
  },
  // ── LEVEL 3: Müjgan Restaurant (rising water)
  {
    name: 'Müjgan Restaurant 💧', ww: 3600, fx: 3420,
    bg1: '#003366', bg2: '#006699', gc: '#004488', acc: '#00CCFF',
    hasBoss: true, bossType: 'boss_busra', bossX: 3200,
    waterRises: true,
    plats: [
      gnd(0, 350), gnd(450, 280), gnd(850, 260), gnd(1250, 300), gnd(1680, 280),
      gnd(2080, 260), gnd(2500, 280), gnd(2900, 260), gnd(3100, 600),
      plt(100, 248, 88, M1), plt(270, 208, 80, M1), plt(440, 248, 85, M1),
      plt(610, 202, 80, M1), plt(780, 248, 85, M1), plt(960, 192, 80, M1),
      plt(1130, 248, 85, M1), plt(1310, 178, 80, M1), plt(1490, 248, 85, M1),
      plt(1670, 198, 80, M1), plt(1850, 248, 85, M1), plt(2030, 178, 80, M1),
      plt(2210, 248, 85, M1), plt(2400, 192, 80, M1), plt(2580, 248, 85, M1),
      plt(2760, 185, 80, M1), plt(2940, 248, 85, M1), plt(3100, 182, 80, M1),
      mplX(1560, 258, 72, M1, 110), mplX(2760, 238, 72, M1, 130),
    ],
    items: [
      ...makePlatItems([120, 290, 460, 630, 800, 980, 1150, 1330, 1510, 1690, 1870, 2050, 2230, 2420, 2600, 2780, 2960, 3120], 248, ['lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'card']),
    ],
  },
  // ── LEVEL 4: Çalış Plajı
  {
    name: 'Çalış Plajı 🏖️', ww: 3800, fx: 3620,
    bg1: '#0066AA', bg2: '#00AADD', gc: '#F0C060', acc: '#FFDD44',
    hasBoss: true, bossType: 'boss_tanriverdi', bossX: 3400,
    sandLevel: true,
    plats: [
      gnd(0, 400, '#D2A55A', true), gnd(500, 300, '#D2A55A', true), gnd(900, 280, '#D2A55A', true),
      gnd(1300, 310, '#D2A55A', true), gnd(1740, 290, '#D2A55A', true),
      gnd(2160, 275, '#D2A55A', true), gnd(2580, 290, '#D2A55A', true),
      gnd(2990, 275, '#D2A55A', true), gnd(3240, 600, '#D2A55A', true),
      plt(110, 258, 86, '#D2A55A'), plt(280, 218, 78, '#C8944A'),
      plt(450, 258, 83, '#D2A55A'), plt(620, 208, 78, '#C8944A'),
      plt(790, 258, 83, '#D2A55A'), plt(970, 196, 78, '#C8944A'),
      plt(1140, 258, 83, '#D2A55A'), plt(1320, 180, 78, '#C8944A'),
      plt(1500, 258, 83, '#D2A55A'), plt(1680, 198, 78, '#C8944A'),
      plt(1860, 258, 83, '#D2A55A'), plt(2040, 180, 78, '#C8944A'),
      plt(2220, 258, 83, '#D2A55A'), plt(2410, 195, 78, '#C8944A'),
      plt(2590, 258, 83, '#D2A55A'), plt(2770, 188, 78, '#C8944A'),
      plt(2960, 258, 83, '#D2A55A'), plt(3130, 185, 78, '#C8944A'),
      mplX(1590, 268, 70, '#C8944A', 100), mplX(2800, 248, 70, '#C8944A', 120),
    ],
    items: [
      ...makePlatItems([130, 300, 470, 640, 810, 990, 1160, 1340, 1520, 1700, 1880, 2060, 2240, 2430, 2610, 2790, 2980, 3150], 258, ['lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'card']),
    ],
  },
  // ── LEVEL 5: İki Duble
  {
    name: 'İki Duble 🥃', ww: 3700, fx: 3520,
    bg1: '#0a0a12', bg2: '#1a1a28', gc: '#1a1a2a', acc: '#4FC3F7',
    hasBoss: true, bossType: 'boss_kayhan', bossX: 3300,
    darkBar: true,
    plats: [
      gnd(0, 280, '#1a1a2a'), gnd(380, 200, '#1a1a2a'), gnd(690, 190, '#1a1a2a'),
      gnd(1010, 210, '#1a1a2a'), gnd(1370, 195, '#1a1a2a'), gnd(1740, 190, '#1a1a2a'),
      gnd(2110, 210, '#1a1a2a'), gnd(2490, 190, '#1a1a2a'), gnd(2860, 210, '#1a1a2a'),
      gnd(3060, 600, '#1a1a2a'),
      plt(80, 258, 90, M1), plt(240, 215, 82, M1), plt(400, 258, 86, M1),
      plt(560, 208, 82, M1), plt(730, 258, 86, M1), plt(900, 198, 82, M1),
      plt(1080, 258, 86, M1), plt(1260, 182, 82, M1), plt(1440, 258, 86, M1),
      plt(1620, 200, 82, M1), plt(1800, 258, 86, M1), plt(1980, 182, 82, M1),
      plt(2160, 258, 86, M1), plt(2350, 198, 82, M1), plt(2540, 258, 86, M1),
      plt(2720, 192, 82, M1), plt(2900, 258, 86, M1), plt(3070, 188, 82, M1),
      mplX(1540, 268, 72, M1, 100), mplX(2750, 248, 72, M1, 120),
    ],
    items: [
      ...makePlatItems([100, 260, 420, 580, 750, 920, 1100, 1280, 1460, 1640, 1820, 2000, 2180, 2370, 2560, 2740, 2920, 3090], 258, ['lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'card']),
    ],
  },
  // ── LEVEL 6: Mios
  {
    name: 'Mios ⚓', ww: 3900, fx: 3720,
    bg1: '#0D0D2B', bg2: '#1A1A4F', gc: '#0D0D1A', acc: '#00E5FF',
    hasBoss: true, bossType: 'boss_amanaman', bossX: 3500,
    plats: [
      gnd(0, 340, '#0D0D1A'), gnd(440, 230, '#0D0D1A'), gnd(800, 215, '#0D0D1A'),
      gnd(1170, 230, '#0D0D1A'), gnd(1560, 215, '#0D0D1A'), gnd(1940, 230, '#0D0D1A'),
      gnd(2320, 215, '#0D0D1A'), gnd(2710, 230, '#0D0D1A'), gnd(3090, 215, '#0D0D1A'),
      gnd(3320, 600, '#0D0D1A'),
      plt(90, 258, 88, M1), plt(260, 215, 80, M1), plt(430, 258, 85, M1),
      plt(600, 208, 80, M1), plt(770, 258, 85, M1), plt(950, 196, 80, M1),
      plt(1120, 258, 85, M1), plt(1300, 180, 80, M1), plt(1480, 258, 85, M1),
      plt(1660, 200, 80, M1), plt(1840, 258, 85, M1), plt(2020, 180, 80, M1),
      plt(2200, 258, 85, M1), plt(2390, 196, 80, M1), plt(2570, 258, 85, M1),
      plt(2750, 190, 80, M1), plt(2930, 258, 85, M1), plt(3100, 186, 80, M1),
      mplX(1570, 268, 72, M1, 110), mplX(2760, 248, 72, M1, 130),
    ],
    items: [
      ...makePlatItems([110, 280, 450, 620, 790, 970, 1140, 1320, 1500, 1680, 1860, 2040, 2220, 2410, 2590, 2770, 2950, 3120], 258, ['lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'star', 'card', 'battery', 'lens', 'frame', 'card']),
    ],
  },
  // ── LEVEL 7: ASPECT HQ (Final Boss Özgür)
  {
    name: 'ASPECT HQ 👑', ww: 4200, fx: 4020,
    bg1: '#000022', bg2: '#000044', gc: '#003300', acc: '#00FF00',
    hasBoss: true, bossType: 'boss_ozgur', bossX: 3800,
    plats: [
      gnd(0, 330, '#003300'), gnd(430, 220, '#003300'), gnd(800, 205, '#003300'),
      gnd(1180, 225, '#003300'), gnd(1580, 210, '#003300'), gnd(1970, 225, '#003300'),
      gnd(2370, 210, '#003300'), gnd(2780, 225, '#003300'), gnd(3180, 210, '#003300'),
      gnd(3580, 225, '#003300'), gnd(3840, 600, '#003300'),
      plt(90, 258, 88, R1), plt(265, 215, 80, R1), plt(445, 258, 85, R1),
      plt(620, 208, 80, R1), plt(800, 258, 85, R1), plt(990, 196, 80, R1),
      plt(1170, 258, 85, R1), plt(1360, 178, 80, R1), plt(1550, 258, 85, R1),
      plt(1740, 200, 80, R1), plt(1930, 258, 85, R1), plt(2120, 178, 80, R1),
      plt(2310, 258, 85, R1), plt(2510, 195, 80, R1), plt(2700, 258, 85, R1),
      plt(2900, 188, 80, R1), plt(3090, 258, 85, R1), plt(3290, 185, 80, R1),
      plt(3490, 258, 85, R1), plt(3680, 185, 80, R1),
      mplX(1530, 268, 72, R1, 120), mplX(2750, 248, 72, R1, 150),
      mplX(3430, 238, 72, R1, 130),
    ],
    items: [
      ...makePlatItems([110, 285, 465, 640, 820, 1010, 1190, 1380, 1570, 1760, 1950, 2140, 2330, 2530, 2720, 2920, 3110, 3310, 3510, 3700], 258, ['star', 'frame', 'star', 'card', 'star', 'lens', 'star', 'card', 'star', 'battery', 'star', 'frame', 'star', 'card', 'star', 'lens', 'star', 'card', 'star', 'battery']),
    ],
  },
];

// ─────────────────────────── SAVE / LEADERBOARD ──────────────────────────────
const SAVE_KEY = 'aq2-save-v1';
const LB_KEY = 'aq2-lb-v1';
interface SaveData { unlocked: number; best: number[]; sound: boolean; }
interface LBEntry { name: string; score: number; level: number; date: string; }

function loadSave(): SaveData {
  try { return { unlocked: 0, best: new Array(8).fill(0), sound: true, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; }
  catch { return { unlocked: 0, best: new Array(8).fill(0), sound: true }; }
}
function saveSave(d: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch {} }
function loadLB(): LBEntry[] { try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch { return []; } }
function addLB(name: string, score: number, level: number) {
  const lb = loadLB();
  lb.push({ name, score, level, date: new Date().toLocaleDateString('tr-TR') });
  lb.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0, 10))); } catch {}
}

// ─────────────────────────── DRAW CHARACTERS ─────────────────────────────────
function drawCharacterPortrait(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number) {
  const cx = x + size / 2, cy = y + size * 0.45;
  const r = size * 0.38;
  ctx.save();
  // Head
  ctx.fillStyle = name === 'busra' || name === 'zuhal' ? '#FDBCB4' : '#FDBCB4';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#C8956C'; ctx.lineWidth = 1; ctx.stroke();

  // Hair
  const hairColors: Record<string, string> = {
    ozgur: '#1a1a1a', celil: '#111', selcuk: '#444', zuhal: '#2a1a0a',
    necati: '#888', busra: '#5C3D1A', tanriverdi: '#2a1a0a',
    kayhan: '#111', amanaman: '#1a1a1a', ezgi: '#C87941',
    zeliha: '#1a1a1a', ayse: '#8B4513',
  };
  ctx.fillStyle = hairColors[name] ?? '#333';

  if (name === 'zuhal') {
    // Short hair
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.4);
  } else if (name === 'busra') {
    // Koyu kahve saç omuzlara kadar
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.5);
    ctx.fillRect(cx - r, cy, r * 0.4, r * 0.8);
    ctx.fillRect(cx + r * 0.6, cy, r * 0.4, r * 0.8);
  } else if (name === 'necati') {
    // Bald top with side hair
    ctx.fillRect(cx - r * 0.6, cy - r, r * 1.2, r * 0.3);
    ctx.fillRect(cx - r, cy - r + 2, r * 0.5, r * 0.5);
    ctx.fillRect(cx + r * 0.5, cy - r + 2, r * 0.5, r * 0.5);
  } else if (name === 'tanriverdi') {
    // Yakışıklı saç
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.55);
    // Beard
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.55, r * 0.7, 0, Math.PI); ctx.fill();
  } else if (name === 'amanaman') {
    // Sakallı, dövmeli
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.5);
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.5, r * 0.75, 0, Math.PI); ctx.fill();
    // Sol kol dövme göstergesi
    ctx.fillStyle = '#1a3a8a';
    ctx.fillRect(x, cy + r * 0.2, size * 0.12, r);
    ctx.fillStyle = '#4a6aCA';
    ctx.fillRect(x + 2, cy + r * 0.35, size * 0.08, r * 0.5);
  } else if (name === 'kayhan') {
    // Kısa boylu, simsiyah saç
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.45);
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.5);
  }

  // Eyes
  ctx.fillStyle = '#333';
  ctx.fillRect(cx - r * 0.45, cy - r * 0.12, r * 0.25, r * 0.2);
  ctx.fillRect(cx + r * 0.2, cy - r * 0.12, r * 0.25, r * 0.2);

  // Body / clothing color
  const clothColors: Record<string, string> = {
    ozgur: '#1a3a6a', celil: '#111111', selcuk: '#3a5a8a',
    zuhal: '#DDAA00', necati: '#f0f0f0', busra: '#111111',
    tanriverdi: '#2255aa', kayhan: '#111111', amanaman: '#1a1a1a',
    ezgi: '#E87040', zeliha: '#5566BB', ayse: '#CC4477',
  };
  ctx.fillStyle = clothColors[name] ?? '#444';
  ctx.fillRect(cx - r * 0.9, cy + r, r * 1.8, r * 0.9);

  // Special: Celil - gold sunglasses
  if (name === 'celil') {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(cx - r * 0.5, cy - r * 0.12, r * 0.35, r * 0.18);
    ctx.fillRect(cx + r * 0.15, cy - r * 0.12, r * 0.35, r * 0.18);
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - r * 0.15, cy - r * 0.04); ctx.lineTo(cx + r * 0.15, cy - r * 0.04); ctx.stroke();
  }
  // Necati: beyaz önlük
  if (name === 'necati') {
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(cx - r * 0.7, cy + r * 0.2, r * 1.4, r * 0.7);
  }
  // Zuhal: sarı yelek
  if (name === 'zuhal') {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(cx - r * 0.9, cy + r, r * 1.8, r * 0.9);
    ctx.fillStyle = '#FF8800';
    ctx.fillRect(cx - r * 0.9, cy + r + r * 0.4, r * 1.8, r * 0.5);
  }
  // Özgür: takım elbise
  if (name === 'ozgur') {
    ctx.fillStyle = '#1a3a6a';
    ctx.fillRect(cx - r * 0.9, cy + r, r * 1.8, r * 0.9);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - r * 0.12, cy + r * 0.1, r * 0.24, r * 0.8);
    ctx.fillStyle = '#CC2222';
    ctx.fillRect(cx - r * 0.08, cy + r * 0.2, r * 0.16, r * 0.5);
  }

  ctx.restore();
}

// ─────────────────────────── DRAW BOSSES IN GAME ─────────────────────────────
function drawBoss(ctx: CanvasRenderingContext2D, e: Enemy, sx: number, t: number, ld: LevelDef) {
  ctx.save();
  const cx = sx + e.w / 2, cy = e.y;
  const bob = Math.sin(t * 0.08 + e.id * 0.7) * 4;

  // Hit flash
  if (e.hitTimer && e.hitTimer > 0 && Math.floor(t / 3) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  switch (e.type) {
    case 'boss_celil':
    case 'boss_selcuk': {
      const isCelil = e.type === 'boss_celil';
      // Body
      ctx.fillStyle = isCelil ? '#111' : '#3a5a8a';
      ctx.fillRect(sx + 4, cy + 30 + bob, e.w - 8, e.h - 40);
      // Head
      ctx.fillStyle = '#FDBCB4';
      ctx.beginPath(); ctx.arc(cx, cy + 18 + bob, 14, 0, Math.PI * 2); ctx.fill();
      // Hair
      ctx.fillStyle = isCelil ? '#111' : '#444';
      ctx.beginPath(); ctx.arc(cx, cy + 18 + bob, 14, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 14, cy + 4 + bob, 28, 7);
      // Celil: gold sunglasses
      if (isCelil) {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 10, cy + 16 + bob, 7, 4);
        ctx.fillRect(cx + 3, cy + 16 + bob, 7, 4);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - 3, cy + 18 + bob); ctx.lineTo(cx + 3, cy + 18 + bob); ctx.stroke();
      }
      break;
    }
    case 'boss_zuhal': {
      // Body - sarı yelek turuncu alt
      ctx.fillStyle = '#FF8800';
      ctx.fillRect(sx + 5, cy + 32 + bob, e.w - 10, e.h - 42);
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(sx + 3, cy + 28 + bob, e.w - 6, 18);
      // Head
      ctx.fillStyle = '#FDBCB4';
      ctx.beginPath(); ctx.arc(cx, cy + 16 + bob, 13, 0, Math.PI * 2); ctx.fill();
      // Short hair
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath(); ctx.arc(cx, cy + 16 + bob, 13, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 13, cy + 3 + bob, 26, 6);
      break;
    }
    case 'boss_busra': {
      // Siyah ceket siyah pantolon, koyu kahve saç
      ctx.fillStyle = '#111';
      ctx.fillRect(sx + 4, cy + 28 + bob, e.w - 8, e.h - 36);
      ctx.fillStyle = '#FDBCB4';
      ctx.beginPath(); ctx.arc(cx, cy + 16 + bob, 14, 0, Math.PI * 2); ctx.fill();
      // Koyu kahve saç omuzlara
      ctx.fillStyle = '#5C3D1A';
      ctx.beginPath(); ctx.arc(cx, cy + 16 + bob, 14, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 14, cy + 2 + bob, 28, 8);
      ctx.fillRect(cx - 16, cy + 16 + bob, 6, 14); // sol saç
      ctx.fillRect(cx + 10, cy + 16 + bob, 6, 14); // sağ saç
      break;
    }
    case 'boss_tanriverdi': {
      // Uzun boylu, yakışıklı, sakallı
      ctx.fillStyle = '#2255aa';
      ctx.fillRect(sx + 3, cy + 26 + bob, e.w - 6, e.h - 34);
      ctx.fillStyle = '#FDBCB4';
      ctx.beginPath(); ctx.arc(cx, cy + 14 + bob, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath(); ctx.arc(cx, cy + 14 + bob, 14, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 14, cy + bob, 28, 7);
      // Beard
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath(); ctx.arc(cx, cy + 24 + bob, 10, 0, Math.PI); ctx.fill();
      break;
    }
    case 'boss_kayhan': {
      // Kısa boylu, simsiyah, beyaz ayakkabı
      ctx.fillStyle = '#111';
      ctx.fillRect(sx + 5, cy + 28 + bob, e.w - 10, e.h - 38);
      // Beyaz ayakkabı
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + 3, cy + e.h - 12 + bob, e.w - 6, 8);
      ctx.fillStyle = '#FDBCB4';
      ctx.beginPath(); ctx.arc(cx, cy + 16 + bob, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx, cy + 16 + bob, 12, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 12, cy + 4 + bob, 24, 6);
      // Phone
      ctx.fillStyle = '#222';
      ctx.fillRect(cx + 8, cy + 22 + bob, 8, 12);
      ctx.fillStyle = '#44aaff';
      ctx.fillRect(cx + 9, cy + 23 + bob, 6, 8);
      break;
    }
    case 'boss_amanaman': {
      // Uzun boylu, sakallı, dövmeli sol kol
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(sx + 3, cy + 26 + bob, e.w - 6, e.h - 34);
      // Sol kol dövme
      ctx.fillStyle = '#1a3a8a';
      ctx.fillRect(sx + 2, cy + 30 + bob, 10, 22);
      ctx.fillStyle = '#5577DD';
      ctx.fillRect(sx + 3, cy + 34 + bob, 8, 10);
      ctx.fillStyle = '#FDBCB4';
      ctx.beginPath(); ctx.arc(cx, cy + 13 + bob, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(cx, cy + 13 + bob, 14, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 14, cy - 1 + bob, 28, 7);
      // Beard
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(cx, cy + 24 + bob, 10, 0, Math.PI); ctx.fill();
      break;
    }
    case 'boss_ozgur': {
      // Takım elbise
      ctx.fillStyle = '#1a3a6a';
      ctx.fillRect(sx + 4, cy + 28 + bob, e.w - 8, e.h - 36);
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 3, cy + 30 + bob, 6, e.h - 44);
      ctx.fillStyle = '#CC2222';
      ctx.fillRect(cx - 2, cy + 34 + bob, 4, e.h - 54);
      ctx.fillStyle = '#FDBCB4';
      ctx.beginPath(); ctx.arc(cx, cy + 15 + bob, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(cx, cy + 15 + bob, 14, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 14, cy + 1 + bob, 28, 7);
      break;
    }
  }
  ctx.restore();
}

function drawMinion(ctx: CanvasRenderingContext2D, e: Enemy, sx: number, t: number, lvl: number) {
  ctx.save();
  if (e.hitTimer && e.hitTimer > 0 && Math.floor(t / 3) % 2 === 0) ctx.globalAlpha = 0.4;
  const cx = sx + e.w / 2;
  const bob = Math.sin(t * 0.18 + e.id) * 2;

  // Body
  const bodyColors: Record<number, string> = {
    1: '#3a6a3a', // zabita green
    5: '#CC44AA', // girl
  };
  ctx.fillStyle = e.type === 'zabita' ? '#2a5a2a' : e.type === 'girl' ? '#CC44AA' : '#cc4444';
  ctx.fillRect(sx + 3, e.y + 18 + bob, e.w - 6, e.h - 26);

  // Head
  ctx.fillStyle = '#FDBCB4';
  ctx.beginPath(); ctx.arc(cx, e.y + 11 + bob, 10, 0, Math.PI * 2); ctx.fill();

  // Hair
  ctx.fillStyle = e.type === 'zabita' ? '#111' : e.type === 'girl' ? '#8B4513' : '#333';
  ctx.beginPath(); ctx.arc(cx, e.y + 11 + bob, 10, Math.PI, 0); ctx.fill();
  ctx.fillRect(cx - 10, e.y + 1 + bob, 20, 5);

  // zabita hat
  if (e.type === 'zabita') {
    ctx.fillStyle = '#1a4a1a';
    ctx.fillRect(cx - 12, e.y + 1 + bob, 24, 5);
    ctx.fillRect(cx - 8, e.y - 5 + bob, 16, 6);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(cx - 5, e.y + 2 + bob, 10, 2);
  }

  ctx.restore();
}

function drawSpawnedGirl(ctx: CanvasRenderingContext2D, g: SpawnedGirl, camX: number, t: number) {
  const sx = g.x - camX;
  if (sx < -20 || sx > CW + 20) return;
  ctx.save();
  const bob = Math.sin(t * 0.15 + g.id) * 2;
  const cx = sx + 12;
  ctx.fillStyle = ['#CC44AA', '#AA44CC', '#FF6699'][g.id % 3];
  ctx.fillRect(sx + 2, g.y + 16 + bob, 20, 18);
  ctx.fillStyle = '#FDBCB4';
  ctx.beginPath(); ctx.arc(cx, g.y + 10 + bob, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ['#8B4513', '#FFD700', '#1a1a1a'][g.id % 3];
  ctx.beginPath(); ctx.arc(cx, g.y + 10 + bob, 9, Math.PI, 0); ctx.fill();
  ctx.fillRect(cx - 9, g.y + 1 + bob, 18, 4);
  ctx.restore();
}

// ─────────────────────────── PROPS ───────────────────────────────────────────
interface AspectQuestProps { userName: string; userRole: UserRole; accessToken: string; onBack: () => void; }

// ─────────────────────────── COMPONENT ───────────────────────────────────────
export function AspectQuest({ userName, userRole, accessToken, onBack }: AspectQuestProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const gsRef      = useRef<GS>(null!);
  const inputRef   = useRef({ left: false, right: false, jump: false, jumpPress: false });
  const scaleRef   = useRef(1);
  const soundRef   = useRef(true);
  const touchRef   = useRef({ left: false, right: false, jump: false });

  const [screen, setScreen]     = useState<Screen>('menu');
  const [saveData, setSaveData] = useState<SaveData>(() => loadSave());
  const [showLB, setShowLB]     = useState(false);
  const [currentDialog, setCurrentDialog] = useState<Dialog | null>(null);
  const [dialogIdx, setDialogIdx] = useState(0);
  const [dialogQueue, setDialogQueue] = useState<Dialog[]>([]);
  const [uiSnap, setUiSnap]     = useState({ score: 0, lives: 3, lvl: 0, bossHp: 0, bossMaxHp: 0, waterY: CH });
  const [bossFightPhase, setBossFightPhase] = useState<'approaching' | 'fighting'>('approaching');

  // ── Init a level ──────────────────────────────────────────────────────────
  const initLevel = useCallback((lvlIdx: number, lives: number, score: number) => {
    const ld = LEVELS[lvlIdx];
    let eid = 0, iid = 0, pid = 0, gid = 0;

    // Spawn regular minions for escape level
    const enemies: Enemy[] = [];
    if (ld.isEscape) {
      // Zabıtalar — spawned during gameplay from off-screen right (handled in update)
    }
    // Spawn boss
    if (ld.hasBoss) {
      enemies.push({
        id: eid++, x: ld.bossX, y: GY - 60, w: 50, h: 60,
        type: ld.bossType, vx: 1.5, alive: true, minX: ld.bossX - 80, maxX: ld.bossX + 80,
        oy: GY - 60, hp: 6, maxHp: 6, attackTimer: 120, phase: 0, hitTimer: 0, stunTimer: 0,
      });
    }

    const items: Collectable[] = ld.items.map(it => ({
      id: iid++, x: it.x, y: it.y, w: 18, h: 18, type: it.type, pts: it.pts, got: false,
    }));

    const plats = ld.plats.map(p => ({ ...p }));

    gsRef.current = {
      screen: 'dialog', lvl: lvlIdx,
      px: 80, py: GY - PH, pvx: 0, pvy: 0,
      ponG: false, pjumps: 2, pface: 1,
      lives, score,
      pinv: 0, pcamAnim: 0, pdead: false, pdeadT: 0,
      netTimer: 0,
      plats, enemies, items,
      projectiles: [], spawnedGirls: [],
      sparks: [], floats: [],
      camX: 0, t: 0, levelT: 0, flash: 0,
      waterLevel: CH + 50, waterRising: ld.waterRises ?? false,
      shockwaveTimer: 0, shockwaveX: 0,
      bossDefeated: false,
      zabitas: ld.isEscape ? [] : [],
      dialogIdx: 0, dialogs: LEVEL_DIALOGS[lvlIdx]?.intro ?? [],
      bossSpawned: true,
      projId: 0, girlId: 0,
      levelComplete: false,
    };
  }, []);

  // ── Show dialog queue ────────────────────────────────────────────────────
  const showDialogs = useCallback((dialogs: Dialog[], onComplete: () => void) => {
    if (!dialogs.length) { onComplete(); return; }
    setDialogQueue(dialogs);
    setDialogIdx(0);
    setCurrentDialog(dialogs[0]);
    setScreen('dialog');
    (gsRef as any)._dialogComplete = onComplete;
  }, []);

  const advanceDialog = useCallback(() => {
    const gs = gsRef.current;
    setDialogIdx(prev => {
      const next = prev + 1;
      if (next >= dialogQueue.length) {
        setCurrentDialog(null);
        const cb = (gsRef as any)._dialogComplete;
        if (cb) { cb(); (gsRef as any)._dialogComplete = null; }
        return 0;
      }
      setCurrentDialog(dialogQueue[next]);
      return next;
    });
  }, [dialogQueue]);

  // ── Start level flow ─────────────────────────────────────────────────────
  const startLevel = useCallback((lvlIdx: number, lives = 3, score = 0) => {
    initLevel(lvlIdx, lives, score);
    const intros = LEVEL_DIALOGS[lvlIdx]?.intro ?? [];
    showDialogs(intros, () => {
      if (gsRef.current) gsRef.current.screen = 'play';
      setScreen('play');
    });
  }, [initLevel, showDialogs]);

  // ── Collision helper ─────────────────────────────────────────────────────
  function spawnSparks(gs: GS, wx: number, wy: number, col: string, n = 8) {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 4 + 1;
      gs.sparks.push({ x: wx, y: wy, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, life: 30, maxl: 30, col, sz: Math.random() * 3 + 1 });
    }
  }

  // ── Main update ──────────────────────────────────────────────────────────
  const update = useCallback(() => {
    const gs = gsRef.current;
    if (!gs || gs.screen !== 'play') return;

    const inp = inputRef.current;
    const tc  = touchRef.current;
    gs.t++; gs.levelT++;
    if (gs.flash > 0) gs.flash--;
    if (gs.pinv > 0) gs.pinv--;
    if (gs.pcamAnim > 0) gs.pcamAnim--;
    if (gs.netTimer > 0) gs.netTimer--;

    // Death handling
    if (gs.pdead) {
      gs.pdeadT++;
      if (gs.pdeadT > 90) {
        gs.lives--;
        if (gs.lives <= 0) {
          gs.screen = 'over'; setScreen('over');
          if (soundRef.current) SFX.gameOver(); return;
        }
        gs.px = 80; gs.py = GY - PH; gs.pvx = 0; gs.pvy = 0;
        gs.pjumps = 2; gs.ponG = false; gs.camX = 0;
        gs.pdead = false; gs.pdeadT = 0; gs.pinv = 120;
        gs.waterLevel = CH + 50; // reset water
      }
      gs.sparks = gs.sparks.filter(s => s.life > 0);
      gs.sparks.forEach(s => { s.x += s.vx; s.y += s.vy; s.vy += 0.15; s.life--; });
      return;
    }
    if (gs.levelComplete) return;

    // Moving platforms
    gs.plats.forEach(p => {
      if (p.ox !== undefined) {
        p.t = (p.t ?? 0) + 0.03;
        const s = Math.sin(p.t * (p.spd ?? 0.03) / 0.03);
        p.x = p.ox + s * (p.range ?? 80) * (p.dvx ?? 0);
        p.y = p.oy! + s * (p.range ?? 80) * (p.dvy ?? 0);
      }
    });

    // Input
    const goLeft  = inp.left  || tc.left;
    const goRight = inp.right || tc.right;
    const doJump  = inp.jumpPress || tc.jump;
    inp.jumpPress = false;
    tc.jump = false;

    const netSlow = gs.netTimer > 0 ? 0.45 : 1;
    const ld = LEVELS[gs.lvl];

    if (goLeft)       { gs.pvx = Math.max(gs.pvx - SPD * 0.45 * netSlow, -SPD * netSlow); gs.pface = -1; }
    else if (goRight) { gs.pvx = Math.min(gs.pvx + SPD * 0.45 * netSlow,  SPD * netSlow); gs.pface =  1; }
    else              { gs.pvx *= 0.72; if (Math.abs(gs.pvx) < 0.1) gs.pvx = 0; }

    if (doJump && gs.pjumps > 0) {
      const isDouble = gs.pjumps < 2;
      gs.pvy = isDouble ? DJV : JV;
      gs.pjumps--;
      if (soundRef.current) isDouble ? SFX.djump() : SFX.jump();
    }

    // Gravity
    gs.pvy = Math.min(gs.pvy + GRAV, MAXVY);

    // Move X
    gs.px += gs.pvx;
    if (gs.px < 0) { gs.px = 0; gs.pvx = 0; }

    // Horizontal platform collision
    gs.plats.forEach(p => {
      if (!aabb(gs.px, gs.py, PW, PH, p.x, p.y, p.w, p.h)) return;
      if (gs.py + PH <= p.y + 3) return;
      const overlapL = (gs.px + PW) - p.x;
      const overlapR = (p.x + p.w) - gs.px;
      if (overlapL < overlapR) { gs.px = p.x - PW; gs.pvx = 0; }
      else                     { gs.px = p.x + p.w; gs.pvx = 0; }
    });

    // Move Y
    const prevPy = gs.py;
    gs.py += gs.pvy;
    gs.ponG = false;

    // Vertical platform collision
    gs.plats.forEach(p => {
      if (!aabb(gs.px, gs.py, PW, PH, p.x, p.y, p.w, p.h)) return;
      if (gs.pvy >= 0 && prevPy + PH <= p.y + 5) {
        gs.py = p.y - PH;
        gs.pvy = 0;
        gs.pjumps = 2;
        gs.ponG = true;
        // Slippery sand
        if (p.slippery && Math.abs(gs.pvx) > 0.1) gs.pvx *= 0.95;
      } else if (gs.pvy < 0 && prevPy >= p.y + p.h - 5) {
        gs.py = p.y + p.h;
        gs.pvy = 0;
      }
    });

    // Fall death
    if (gs.py > GY + 120) {
      gs.pdead = true; gs.pdeadT = 0;
      if (soundRef.current) SFX.hit();
      spawnSparks(gs, gs.px + PW / 2, GY, '#FF4444', 10);
      return;
    }

    // Water death
    if (gs.waterRising) {
      // Water rises slowly
      gs.waterLevel -= 0.18;
      if (gs.waterLevel < CH - 50) gs.waterLevel = CH - 50; // cap
      // Check if player hit water
      if (gs.py + PH > gs.waterLevel) {
        gs.pdead = true; gs.pdeadT = 0;
        gs.waterLevel = CH + 50;
        if (soundRef.current) SFX.hit();
        spawnSparks(gs, gs.px + PW / 2, gs.py, '#0088FF', 10);
        return;
      }
    }

    // Camera
    const maxCam = ld.ww - CW;
    const screenPx = gs.px - gs.camX;
    const targetCam = gs.px - CW * 0.36;
    let newCamX = gs.camX + (targetCam - gs.camX) * 0.16;
    if (screenPx < CW * 0.10) newCamX = gs.px - CW * 0.10;
    if (screenPx > CW * 0.88) newCamX = gs.px - CW * 0.88;
    gs.camX = Math.max(0, Math.min(maxCam, newCamX));

    // ── Zabıta (escape level) ──────────────────────────────────────────────
    if (ld.isEscape) {
      // Spawn zabıta every 6 seconds
      if (gs.t % 360 === 0 || (gs.t === 60)) {
        gs.zabitas.push({ x: gs.camX + CW + 40, y: GY - 30, vx: -3.5 });
      }
      gs.zabitas.forEach(z => { z.x += z.vx; });
      gs.zabitas = gs.zabitas.filter(z => z.x > gs.camX - 100);
      // Check zabıta collision
      if (gs.pinv === 0) {
        for (const z of gs.zabitas) {
          if (aabb(gs.px, gs.py, PW, PH, z.x, z.y, 24, 30)) {
            gs.pinv = 100; gs.lives--;
            spawnSparks(gs, gs.px, gs.py, '#FF4444', 8);
            gs.floats.push({ x: gs.px, y: gs.py - 15, text: '-1 💔', life: 60, col: '#FF4444' });
            if (soundRef.current) SFX.hit();
            if (gs.lives <= 0) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
          }
        }
      }
    }

    // ── Enemies (boss) ────────────────────────────────────────────────────
    gs.enemies.forEach(e => {
      if (!e.alive) return;
      if (e.hitTimer !== undefined && e.hitTimer > 0) e.hitTimer--;
      if (e.stunTimer !== undefined && e.stunTimer > 0) { e.stunTimer--; return; }

      // Boss movement
      e.x += e.vx;
      if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
      if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }

      // Boss attacks
      if (e.attackTimer !== undefined) {
        e.attackTimer--;
        if (e.attackTimer <= 0) {
          const attackInterval = (e.hp! < e.maxHp! / 2) ? 80 : 130;
          e.attackTimer = attackInterval;
          const pid = gs.projId++;
          const bx = e.x + e.w / 2, by = e.y + 20;
          const dx = gs.px - bx, dy = gs.py - by;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const spd = 4;

          let ptype: Projectile['type'] = 'plate';
          if (e.type === 'boss_zuhal') ptype = 'ice';
          else if (e.type === 'boss_busra') ptype = 'net';
          else if (e.type === 'boss_tanriverdi') ptype = 'surfboard';
          else if (e.type === 'boss_amanaman') ptype = 'shockwave';
          else if (e.type === 'boss_ozgur') ptype = 'album';

          if (ptype === 'shockwave') {
            gs.shockwaveTimer = 60;
            gs.shockwaveX = e.x + e.w / 2; // world space — renderer subtracts camX
          } else {
            gs.projectiles.push({
              id: pid, x: bx, y: by,
              vx: (dx / dist) * spd,
              vy: (dy / dist) * spd,
              type: ptype,
              w: ptype === 'surfboard' ? 60 : ptype === 'album' ? 28 : 20,
              h: ptype === 'surfboard' ? 14 : 20,
              active: true, timer: 200,
            });
          }

          // Kayhan spawns girls every attack
          if (e.type === 'boss_kayhan') {
            for (let gi = 0; gi < 2; gi++) {
              gs.spawnedGirls.push({
                id: gs.girlId++, x: e.x + e.w / 2 + (gi === 0 ? -40 : 40),
                y: e.y, vx: gi === 0 ? -2 : 2, alive: true, vy: 0, onGround: false,
              });
            }
          }

          // Özgür spawns personel (minions)
          if (e.type === 'boss_ozgur' && e.hp! < e.maxHp! * 0.5) {
            gs.spawnedGirls.push({
              id: gs.girlId++, x: e.x + e.w / 2,
              y: e.y, vx: gs.px < e.x ? -2.5 : 2.5, alive: true, vy: 0, onGround: false,
            });
          }
        }
      }

      // Stomp check — player jumps on boss
      if (gs.pinv === 0) {
        const bossHit = aabb(gs.px, gs.py, PW, PH, e.x, e.y, e.w, e.h);
        if (bossHit) {
          const stompingFromAbove = gs.pvy > 0 && prevPy + PH <= e.y + 8;
          if (stompingFromAbove) {
            e.hp = (e.hp ?? 1) - 1;
            e.hitTimer = 20;
            gs.pvy = JV * 0.7; // bounce
            gs.score += 200;
            spawnSparks(gs, e.x + e.w / 2, e.y, '#FFDD00', 12);
            gs.floats.push({ x: e.x, y: e.y - 10, text: '-HP! 💥', life: 60, col: '#FFD700' });
            if (soundRef.current) SFX.bossHit();
            if (e.hp! <= 0) {
              e.alive = false;
              gs.bossDefeated = true;
              gs.score += 1000;
              spawnSparks(gs, e.x + e.w / 2, e.y + e.h / 2, '#FFD700', 30);
              if (soundRef.current) SFX.bossWin();
              // Show win dialog
              const winDialogs = LEVEL_DIALOGS[gs.lvl]?.boss_win ?? [];
              setTimeout(() => {
                showDialogs(winDialogs, () => {
                  if (gsRef.current) gsRef.current.levelComplete = true;
                  setTimeout(() => { setScreen('lvlwin'); }, 500);
                });
              }, 400);
            }
          } else {
            // Boss touches player
            gs.pinv = 100; gs.lives--;
            spawnSparks(gs, gs.px + PW / 2, gs.py + PH / 2, '#FF4444', 8);
            gs.floats.push({ x: gs.px, y: gs.py - 15, text: '-1 💔', life: 60, col: '#FF4444' });
            if (soundRef.current) SFX.hit();
            if (gs.lives <= 0) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
          }
        }
      }
    });

    // ── Projectiles ───────────────────────────────────────────────────────
    gs.projectiles.forEach(p => {
      if (!p.active) return;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity on projectiles
      p.timer--;
      if (p.timer <= 0 || p.y > GY + 50) { p.active = false; return; }
      // Player hit
      if (gs.pinv === 0 && aabb(gs.px, gs.py, PW, PH, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
        p.active = false;
        if (p.type === 'net') {
          gs.netTimer = 180; // slowed for 3 seconds
          gs.floats.push({ x: gs.px, y: gs.py - 15, text: 'AĞA TAKILDIK! 🕸️', life: 80, col: '#88FF88' });
        } else {
          gs.pinv = 80; gs.lives--;
          spawnSparks(gs, gs.px, gs.py, '#FF4444', 8);
          gs.floats.push({ x: gs.px, y: gs.py - 15, text: '-1 💔', life: 60, col: '#FF4444' });
          if (soundRef.current) SFX.hit();
          if (gs.lives <= 0) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
        }
      }
    });
    gs.projectiles = gs.projectiles.filter(p => p.active);

    // ── Shockwave ─────────────────────────────────────────────────────────
    if (gs.shockwaveTimer > 0) {
      gs.shockwaveTimer--;
      if (gs.pinv === 0) {
        // shockwave hits if player is on ground
        if (gs.ponG) {
          gs.pinv = 80; gs.lives--;
          spawnSparks(gs, gs.px, gs.py, '#FF4444', 8);
          gs.floats.push({ x: gs.px, y: gs.py - 15, text: 'SHOCKWAVE! 💥', life: 60, col: '#FF8800' });
          if (soundRef.current) SFX.hit();
          if (gs.lives <= 0) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
        }
      }
    }

    // ── Spawned girls / personel ──────────────────────────────────────────
    gs.spawnedGirls.forEach(g => {
      if (!g.alive) return;
      g.vy += GRAV;
      g.x += g.vx;
      g.y += g.vy;
      // Simple ground landing
      if (g.y + 34 > GY) { g.y = GY - 34; g.vy = 0; g.onGround = true; }
      // Chase player
      if (g.onGround) {
        const dx2 = gs.px - g.x;
        g.vx = dx2 > 0 ? 2.2 : -2.2;
      }
      if (gs.pinv === 0 && aabb(gs.px, gs.py, PW, PH, g.x, g.y, 24, 34)) {
        g.alive = false;
        gs.pinv = 80; gs.lives--;
        spawnSparks(gs, gs.px, gs.py, '#FF4444', 8);
        gs.floats.push({ x: gs.px, y: gs.py - 15, text: '-1 💔', life: 60, col: '#FF4444' });
        if (soundRef.current) SFX.hit();
        if (gs.lives <= 0) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
      }
    });
    gs.spawnedGirls = gs.spawnedGirls.filter(g => g.alive && g.x > gs.camX - 200 && g.x < gs.camX + CW + 200);

    // ── Collectibles ──────────────────────────────────────────────────────
    gs.items.forEach(it => {
      if (it.got) return;
      if (aabb(gs.px, gs.py, PW, PH, it.x, it.y, it.w, it.h)) {
        it.got = true;
        gs.score += it.pts;
        if (soundRef.current) it.type === 'star' ? SFX.star() : SFX.collect();
        spawnSparks(gs, it.x, it.y, it.type === 'star' ? '#FFD700' : '#88EEFF', 6);
        gs.floats.push({ x: it.x, y: it.y - 16, text: `+${it.pts}`, life: 50, col: it.type === 'star' ? '#FFD700' : '#88EEFF' });
      }
    });

    // ── Finish check ──────────────────────────────────────────────────────
    if (gs.px > ld.fx) {
      if (!gs.levelComplete) {
        gs.levelComplete = true;
        const timeBonus = Math.max(0, 3000 - Math.floor(gs.levelT / 60) * 10);
        gs.score += timeBonus + gs.lives * 200;
        if (soundRef.current) SFX.lvlWin();
        if (ld.isEscape) {
          const winD = LEVEL_DIALOGS[gs.lvl]?.boss_win ?? [];
          setTimeout(() => {
            showDialogs(winD, () => { setScreen('lvlwin'); });
          }, 200);
        } else if (!ld.hasBoss) {
          setTimeout(() => { setScreen('lvlwin'); }, 600);
        }
      }
    }

    // ── Boss intro dialog ─────────────────────────────────────────────────
    // Trigger boss intro when player gets close enough to boss
    const boss = gs.enemies.find(e => e.type === gs.enemies[0]?.type && e.alive);
    if (boss && !gs.bossDefeated && gs.px > boss.x - 250 && !(gsRef as any)._bossIntroShown) {
      (gsRef as any)._bossIntroShown = true;
      const bossIntroD = LEVEL_DIALOGS[gs.lvl]?.boss_intro;
      if (bossIntroD?.length) {
        gs.screen = 'dialog';
        showDialogs(bossIntroD, () => {
          if (gsRef.current) gsRef.current.screen = 'play';
          setScreen('play');
        });
      }
    }

    // Particles
    gs.sparks = gs.sparks.filter(s => s.life > 0);
    gs.sparks.forEach(s => { s.x += s.vx; s.y += s.vy; s.vy += 0.14; s.life--; });
    gs.floats = gs.floats.filter(f => f.life > 0);
    gs.floats.forEach(f => { f.y -= 0.6; f.life--; });

    // UI every 8 frames
    if (gs.t % 8 === 0) {
      const boss2 = gs.enemies.find(e => e.alive);
      setUiSnap({
        score: gs.score, lives: gs.lives, lvl: gs.lvl,
        bossHp: boss2?.hp ?? 0, bossMaxHp: boss2?.maxHp ?? 0,
        waterY: gs.waterLevel,
      });
    }
  }, [showDialogs]);

  // ── Render ───────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gs = gsRef.current;
    if (!gs) return;
    if (gs.screen !== 'play') return;

    const { camX, t, lvl } = gs;
    const ld = LEVELS[lvl];

    // Background
    const grd = ctx.createLinearGradient(0, 0, 0, CH);
    grd.addColorStop(0, ld.bg1);
    grd.addColorStop(1, ld.bg2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CW, CH);

    // Beach sky
    if (ld.sandLevel) {
      // Sun
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(CW * 0.8, 60, 30, 0, Math.PI * 2); ctx.fill();
      // Waves bg
      ctx.fillStyle = 'rgba(0,150,200,0.25)';
      for (let wi = 0; wi < CW; wi += 40) {
        const wy = 120 + Math.sin((wi + t * 0.5) * 0.08) * 8;
        ctx.beginPath(); ctx.arc(wi, wy, 22, 0, Math.PI); ctx.fill();
      }
    }

    // Dark bar neon
    if (ld.darkBar) {
      for (let ni = 0; ni < 8; ni++) {
        const nx = ((ni * 600 - camX * 0.6) % (CW + 500)) - 100;
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 0.05 + ni);
        ctx.fillStyle = ['#ff00aa', '#00ffff', '#ff6600', '#aa00ff'][ni % 4];
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(['İKİ DUBLE', 'KAYHAN\'S', '🥃 BAR', 'TONIGHT'][ni % 4], nx, 60 + (ni % 3) * 25);
        ctx.restore();
      }
    }

    // ASPECT watermarks
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = ld.acc;
    ctx.font = 'bold 60px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      const wx2 = ((i * 900 - camX * 0.12) % (CW + 800)) - 200;
      ctx.fillText('ASPECT', wx2, CH / 2 + 20);
    }
    ctx.restore();

    // Background tables (parallax)
    const tblMx = -camX * 0.45;
    const clothCols = ['rgba(125,0,175,0.35)', 'rgba(30,180,30,0.3)', 'rgba(255,120,0,0.3)',
      'rgba(0,100,200,0.35)', 'rgba(200,180,50,0.3)', 'rgba(8,8,18,0.5)', 'rgba(0,50,100,0.35)', 'rgba(0,70,0,0.3)'];
    for (let i = 0; i < 7; i++) {
      const tbx = ((i * 500 + tblMx) % (CW + 420)) - 110;
      const tby = GY - 55;
      ctx.fillStyle = 'rgba(100,70,30,0.3)'; ctx.fillRect(tbx, tby, 90, 11);
      ctx.fillStyle = clothCols[lvl] ?? 'rgba(80,60,20,0.3)'; ctx.fillRect(tbx, tby, 90, 11);
      ctx.fillStyle = 'rgba(60,35,10,0.28)';
      ctx.fillRect(tbx + 8, tby + 11, 8, 28); ctx.fillRect(tbx + 74, tby + 11, 8, 28);
    }

    // Platforms
    gs.plats.forEach(p => {
      const sx3 = p.x - camX;
      if (sx3 + p.w < 0 || sx3 > CW) return;
      if (p.y >= GY) {
        ctx.fillStyle = ld.gc; ctx.fillRect(sx3, p.y, p.w, p.h);
        ctx.fillStyle = p.col; ctx.fillRect(sx3, p.y, p.w, 8);
        if (p.slippery) {
          ctx.fillStyle = 'rgba(255,220,150,0.3)';
          for (let gi = 0; gi < p.w; gi += 15) ctx.fillRect(sx3 + gi, p.y, 8, 8);
        }
      } else {
        ctx.fillStyle = p.col; ctx.fillRect(sx3, p.y, p.w, p.h);
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(sx3, p.y, p.w, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(sx3, p.y + p.h - 3, p.w, 3);
        if (p.ox !== undefined) {
          ctx.save(); ctx.shadowColor = ld.acc; ctx.shadowBlur = 8;
          ctx.strokeStyle = ld.acc; ctx.lineWidth = 1;
          ctx.strokeRect(sx3, p.y, p.w, p.h);
          ctx.restore();
        }
      }
    });

    // Finish portal
    const fsx = ld.fx - camX;
    if (fsx > -60 && fsx < CW + 60) {
      const pulse = 0.8 + 0.2 * Math.sin(t * 0.08);
      ctx.save();
      ctx.shadowColor = ld.acc; ctx.shadowBlur = 20 * pulse;
      ctx.strokeStyle = ld.acc; ctx.lineWidth = 3;
      ctx.strokeRect(fsx - 20, GY - 70, 40, 70);
      const pg = ctx.createLinearGradient(fsx - 20, GY - 70, fsx + 20, GY);
      pg.addColorStop(0, ld.acc + '44'); pg.addColorStop(1, ld.acc + '88');
      ctx.fillStyle = pg; ctx.fillRect(fsx - 20, GY - 70, 40, 70);
      ctx.font = 'bold 9px monospace'; ctx.fillStyle = ld.acc; ctx.textAlign = 'center';
      ctx.fillText('FINISH', fsx, GY - 74);
      ctx.restore();
    }

    // Collectibles
    gs.items.forEach(it => {
      if (it.got) return;
      const sx4 = it.x - camX;
      if (sx4 < -20 || sx4 > CW + 20) return;
      const bob = Math.sin(t * 0.08 + it.id) * 3;
      const colors: Record<string, string> = { lens: '#64B5F6', frame: '#FFD54F', card: '#81C784', battery: '#FF8A65', star: '#FFD700' };
      const col2 = colors[it.type] || '#FFF';
      ctx.save();
      ctx.shadowColor = col2; ctx.shadowBlur = 8;
      ctx.fillStyle = col2;
      if (it.type === 'star') {
        const cy2 = it.y + bob + it.h / 2;
        const r1 = it.w / 2, r2 = r1 * 0.45;
        ctx.beginPath();
        for (let si = 0; si < 10; si++) {
          const angle = (si * Math.PI) / 5 - Math.PI / 2;
          const rr = si % 2 === 0 ? r1 : r2;
          si === 0 ? ctx.moveTo(sx4 + it.w / 2 + Math.cos(angle) * rr, cy2 + Math.sin(angle) * rr)
                   : ctx.lineTo(sx4 + it.w / 2 + Math.cos(angle) * rr, cy2 + Math.sin(angle) * rr);
        }
        ctx.closePath(); ctx.fill();
      } else if (it.type === 'lens') {
        ctx.strokeStyle = col2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx4 + 9, it.y + bob + 9, 8, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillRect(sx4 + 2, it.y + bob + 2, it.w - 4, it.h - 4);
      }
      ctx.restore();
    });

    // Enemies (bosses)
    gs.enemies.forEach(e => {
      if (!e.alive) return;
      const ex2 = e.x - camX;
      if (ex2 + e.w < -20 || ex2 > CW + 20) return;
      drawBoss(ctx, e, ex2, t, ld);
      // HP bar above boss
      if (e.maxHp && e.maxHp > 0) {
        const barW = 60, barH = 6;
        const bx = ex2 + e.w / 2 - barW / 2;
        const by = e.y - 16;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#FF4444'; ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = '#44FF44'; ctx.fillRect(bx, by, barW * (e.hp! / e.maxHp!), barH);
      }
    });

    // Spawned girls/personel
    gs.spawnedGirls.forEach(g => drawSpawnedGirl(ctx, g, camX, t));

    // Zabıtalar
    gs.zabitas.forEach(z => {
      const zx = z.x - camX;
      if (zx < -40 || zx > CW + 40) return;
      ctx.save();
      ctx.fillStyle = '#2a5a2a'; ctx.fillRect(zx, z.y, 24, 30);
      ctx.fillStyle = '#FDBCB4'; ctx.beginPath(); ctx.arc(zx + 12, z.y + 8, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a4a1a'; ctx.fillRect(zx, z.y - 5, 24, 6);
      ctx.restore();
    });

    // Projectiles
    gs.projectiles.forEach(p => {
      if (!p.active) return;
      const px2 = p.x - camX;
      if (px2 < -60 || px2 > CW + 60) return;
      ctx.save();
      const rot = p.type === 'surfboard' ? Math.atan2(p.vy, p.vx) : (t * 0.15);
      ctx.translate(px2, p.y);
      ctx.rotate(rot);
      if (p.type === 'plate') {
        ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#AAAAAA'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, p.w / 2, p.h / 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (p.type === 'ice') {
        ctx.fillStyle = '#88EEFF'; ctx.globalAlpha = 0.9;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1; ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else if (p.type === 'net') {
        ctx.strokeStyle = '#88FF88'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85;
        for (let ni = -2; ni <= 2; ni++) { ctx.beginPath(); ctx.moveTo(-p.w / 2 + ni * 5, -p.h / 2); ctx.lineTo(-p.w / 2 + ni * 5, p.h / 2); ctx.stroke(); }
        for (let ni = -2; ni <= 2; ni++) { ctx.beginPath(); ctx.moveTo(-p.w / 2, -p.h / 2 + ni * 5); ctx.lineTo(p.w / 2, -p.h / 2 + ni * 5); ctx.stroke(); }
      } else if (p.type === 'surfboard') {
        ctx.fillStyle = '#FF8822'; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fillStyle = '#FFCC44'; ctx.fillRect(-p.w / 2 + 4, -p.h / 4, p.w - 8, p.h / 2);
      } else if (p.type === 'album') {
        ctx.fillStyle = '#8B4513'; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.fillStyle = '#FDBCB4'; ctx.fillRect(-p.w / 2 + 3, -p.h / 2 + 3, p.w - 6, p.h - 6);
        ctx.fillStyle = '#444'; ctx.font = '5px monospace'; ctx.textAlign = 'center';
        ctx.fillText('PHOTO', 0, 3);
      }
      ctx.restore();
    });

    // Shockwave
    if (gs.shockwaveTimer > 0) {
      const sw = gs.shockwaveTimer;
      const shx = gs.shockwaveX - camX;
      ctx.save();
      ctx.strokeStyle = '#FF8800';
      ctx.lineWidth = 4;
      ctx.globalAlpha = sw / 60;
      const radius = (60 - sw) * 5;
      ctx.beginPath(); ctx.arc(shx, GY - 10, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(shx, GY - 10, radius * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Water (Müjgan Restaurant)
    if (gs.waterRising && gs.waterLevel < CH + 50) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      const waterGrd = ctx.createLinearGradient(0, gs.waterLevel, 0, CH);
      waterGrd.addColorStop(0, '#0088FF');
      waterGrd.addColorStop(1, '#004488');
      ctx.fillStyle = waterGrd;
      ctx.fillRect(0, gs.waterLevel, CW, CH - gs.waterLevel);
      // Wave surface
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#00AAFF';
      for (let wi = 0; wi < CW; wi += 30) {
        const wy = gs.waterLevel + Math.sin((wi + t * 2) * 0.15) * 4;
        ctx.fillRect(wi, wy, 15, 3);
      }
      ctx.restore();
    }

    // Player
    const psx = gs.px - camX;
    ctx.save();
    if (gs.pinv > 0 && Math.floor(t / 4) % 2 === 0) ctx.globalAlpha = 0.3;
    if (gs.pdead) ctx.globalAlpha = 0.2;

    // Player body — ASPECT fotoğrafçısı
    const pcy = gs.py;
    ctx.fillStyle = '#2244AA'; // mavi jacket
    ctx.fillRect(psx, pcy + 12, PW, PH - 12);
    ctx.fillStyle = '#FDBCB4'; // yüz
    ctx.beginPath(); ctx.arc(psx + PW / 2, pcy + 7, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; // saç
    ctx.beginPath(); ctx.arc(psx + PW / 2, pcy + 7, 9, Math.PI, 0); ctx.fill();
    ctx.fillRect(psx + PW / 2 - 9, pcy - 2, 18, 5);
    // Kamera
    ctx.fillStyle = '#222';
    ctx.fillRect(psx + PW - 8 + (gs.pface > 0 ? 4 : -10), pcy + 8, 10, 7);
    ctx.fillStyle = '#444';
    ctx.fillRect(psx + PW - 6 + (gs.pface > 0 ? 4 : -10), pcy + 10, 6, 5);
    ctx.fillStyle = '#88CCFF';
    ctx.beginPath();
    ctx.arc(psx + PW - 3 + (gs.pface > 0 ? 4 : -10), pcy + 13, 2, 0, Math.PI * 2);
    ctx.fill();
    // Net effect overlay
    if (gs.netTimer > 0 && Math.floor(t / 4) % 2 === 0) {
      ctx.strokeStyle = '#88FF88'; ctx.lineWidth = 1;
      ctx.strokeRect(psx - 2, pcy - 2, PW + 4, PH + 4);
    }
    ctx.restore();

    // Camera flash effect
    if (gs.pcamAnim > 0) {
      ctx.save();
      ctx.globalAlpha = gs.pcamAnim / 18 * 0.5;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

    // Sparks
    gs.sparks.forEach(s => {
      const sx6 = s.x - camX;
      if (sx6 < 0 || sx6 > CW) return;
      ctx.globalAlpha = s.life / s.maxl;
      ctx.fillStyle = s.col;
      ctx.fillRect(sx6 - s.sz / 2, s.y - s.sz / 2, s.sz, s.sz);
    });
    ctx.globalAlpha = 1;

    // Float texts
    gs.floats.forEach(f => {
      const fx6 = f.x - camX;
      if (fx6 < 0 || fx6 > CW) return;
      ctx.globalAlpha = f.life / 60;
      ctx.fillStyle = f.col;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, fx6 + PW / 2, f.y);
    });
    ctx.globalAlpha = 1;

    // Net timer indicator
    if (gs.netTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#88FF88';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`🕸️ AĞ: ${Math.ceil(gs.netTimer / 60)}s`, CW / 2, 30);
      ctx.restore();
    }
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    update();
    render();
    rafRef.current = requestAnimationFrame(loop);
  }, [update, render]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  // ── Canvas scale ──────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const sw = wrap.clientWidth / CW;
      const sh = wrap.clientHeight / CH;
      const scale = Math.min(sw, sh, 2);
      scaleRef.current = scale;
      canvas.style.transform = `scale(${scale})`;
      canvas.style.transformOrigin = 'top left';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Keyboard input ────────────────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft'  || e.key === 'a') inputRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current.right = true;
      if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !e.repeat) inputRef.current.jumpPress = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft'  || e.key === 'a') inputRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current.right = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const ld = LEVELS[uiSnap.lvl] || LEVELS[0];

  // ── RENDER: Menu ─────────────────────────────────────────────────────────
  if (screen === 'menu') {
    const lb = loadLB();
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: 'linear-gradient(135deg,#120024,#220044,#001a3a)' }}>
        <div className="flex items-center gap-3 p-4">
          <button onClick={onBack} className="text-white/70 hover:text-white"><ChevronLeft size={22} /></button>
          <span className="text-white/60 text-sm">Aspect Quest</span>
          <button onClick={() => { soundRef.current = !soundRef.current; setSaveData(d => ({ ...d, sound: soundRef.current })); }}
            className="ml-auto text-white/60 hover:text-white">
            {soundRef.current ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button onClick={() => setShowLB(v => !v)} className="text-white/60 hover:text-white"><Trophy size={18} /></button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-center mb-2">
            <div className="text-4xl font-black text-white mb-1" style={{ textShadow: '0 0 24px #aa44ff' }}>ASPECT QUEST</div>
            <div className="text-white/50 text-xs">8 Bölüm • Fethiye Maceraları</div>
          </div>

          {showLB ? (
            <div className="w-full max-w-xs rounded-xl overflow-hidden border border-white/15" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="px-4 py-2 text-white/80 font-bold text-sm border-b border-white/10">🏆 Skor Tablosu</div>
              {lb.length === 0 && <div className="px-4 py-6 text-white/40 text-xs text-center">Henüz kayıt yok</div>}
              {lb.slice(0, 6).map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-white/5">
                  <span className="text-white/40 text-xs w-4">{i + 1}</span>
                  <span className="text-white text-xs flex-1">{e.name}</span>
                  <span className="text-yellow-400 text-xs">{e.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-2">
              {LEVELS.map((lv, i) => (
                <button key={i}
                  onClick={() => { if (i <= saveData.unlocked) startLevel(i, 3, 0); }}
                  disabled={i > saveData.unlocked}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: i <= saveData.unlocked ? `linear-gradient(90deg,${lv.acc}22,${lv.acc}11)` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${i <= saveData.unlocked ? lv.acc + '44' : 'rgba(255,255,255,0.08)'}`,
                    color: i <= saveData.unlocked ? '#fff' : '#ffffff44',
                  }}>
                  <span className="text-lg">{i <= saveData.unlocked ? '▶' : '🔒'}</span>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-bold">{lv.name}</div>
                    {saveData.best[i] > 0 && <div className="text-xs opacity-60">Best: {saveData.best[i].toLocaleString()}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── RENDER: Dialog ────────────────────────────────────────────────────────
  if (screen === 'dialog' && currentDialog) {
    const d = currentDialog;
    const portraitColors: Record<string, string> = {
      ozgur: '#1a3a6a', celil: '#111', selcuk: '#3a5a8a', zuhal: '#AA7700',
      necati: '#885522', busra: '#111', tanriverdi: '#2255aa', kayhan: '#111',
      amanaman: '#1a1a1a', ezgi: '#CC6622', zeliha: '#4455AA', ayse: '#AA3366',
    };
    const accent = ld?.acc ?? '#aa44ff';
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: `linear-gradient(135deg,${ld?.bg1 ?? '#120024'},${ld?.bg2 ?? '#220044'})` }}>
        <div className="flex items-center gap-3 p-4">
          <button onClick={onBack} className="text-white/70 hover:text-white"><ChevronLeft size={22} /></button>
          <span className="text-white/50 text-xs">{ld?.name}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
          {/* Portrait */}
          <div className="relative">
            <canvas
              width={120} height={130}
              ref={el => {
                if (!el) return;
                const c = el.getContext('2d')!;
                c.clearRect(0, 0, 120, 130);
                drawCharacterPortrait(c, d.portrait, 0, 0, 120);
              }}
              className="rounded-2xl"
              style={{ border: `2px solid ${accent}55`, background: `${portraitColors[d.portrait] ?? '#222'}` }}
            />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}>
              {d.speaker}
            </div>
          </div>
          {/* Dialog box */}
          <div className="w-full max-w-sm rounded-2xl p-5 cursor-pointer select-none"
            style={{ background: 'rgba(0,0,0,0.75)', border: `1px solid ${accent}44`, backdropFilter: 'blur(12px)' }}
            onClick={advanceDialog}>
            <p className="text-white text-sm leading-relaxed mb-4">{d.text}</p>
            <div className="flex items-center justify-between">
              <span className="text-white/30 text-xs">{dialogIdx + 1} / {dialogQueue.length}</span>
              <span className="text-white/50 text-xs animate-pulse">Devam → Dokun</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Playing ───────────────────────────────────────────────────────
  if (screen === 'play') {
    const accent = ld.acc;
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: '#000' }}>
        {/* HUD */}
        <div className="flex items-center gap-2 px-3 py-2 z-10 relative" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <button onClick={onBack} className="text-white/60 hover:text-white mr-1"><ChevronLeft size={18} /></button>
          <div className="flex gap-1">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={`text-base ${i < uiSnap.lives ? 'text-red-400' : 'text-white/15'}`}>❤️</span>
            ))}
          </div>
          <div className="flex-1 text-center">
            <div className="text-white text-xs font-bold" style={{ color: accent, textShadow: `0 0 8px ${accent}` }}>{ld.name}</div>
          </div>
          <div className="text-yellow-400 text-xs font-bold">{uiSnap.score.toLocaleString()}</div>
        </div>

        {/* Boss HP bar */}
        {uiSnap.bossMaxHp > 0 && !gsRef.current?.bossDefeated && (
          <div className="px-4 py-1 z-10" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-xs font-bold">BOSS</span>
              <div className="flex-1 h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${(uiSnap.bossHp / uiSnap.bossMaxHp) * 100}%`, background: `linear-gradient(90deg,#FF4444,${accent})` }} />
              </div>
              <span className="text-white/60 text-xs">{uiSnap.bossHp}/{uiSnap.bossMaxHp}</span>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div ref={wrapRef} className="flex-1 overflow-hidden relative">
          <canvas ref={canvasRef} width={CW} height={CH} style={{ imageRendering: 'pixelated', display: 'block' }} />
          {/* Water warning */}
          {ld.waterRises && uiSnap.waterY < CH * 0.7 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs text-blue-300 font-bold animate-pulse"
              style={{ background: 'rgba(0,100,200,0.6)', border: '1px solid rgba(0,150,255,0.5)' }}>
              💧 SU YÜKSELİYOR! YUKARI ÇIK!
            </div>
          )}
        </div>

        {/* Touch controls */}
        <div className="flex items-center justify-between px-4 py-3 z-10" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="flex gap-3">
            <button
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold select-none active:scale-95"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
              onTouchStart={e => { e.preventDefault(); touchRef.current.left = true; }}
              onTouchEnd={e => { e.preventDefault(); touchRef.current.left = false; }}
              onMouseDown={() => touchRef.current.left = true}
              onMouseUp={() => touchRef.current.left = false}
            >◀</button>
            <button
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold select-none active:scale-95"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
              onTouchStart={e => { e.preventDefault(); touchRef.current.right = true; }}
              onTouchEnd={e => { e.preventDefault(); touchRef.current.right = false; }}
              onMouseDown={() => touchRef.current.right = true}
              onMouseUp={() => touchRef.current.right = false}
            >▶</button>
          </div>
          <button
            className="w-20 h-14 rounded-xl flex items-center justify-center text-xl font-bold select-none active:scale-95"
            style={{ background: `linear-gradient(135deg,${accent}44,${accent}22)`, border: `1px solid ${accent}66` }}
            onTouchStart={e => { e.preventDefault(); touchRef.current.jump = true; }}
            onTouchEnd={e => { e.preventDefault(); touchRef.current.jump = false; }}
            onMouseDown={() => { touchRef.current.jump = true; inputRef.current.jumpPress = true; }}
            onMouseUp={() => touchRef.current.jump = false}
          >JUMP</button>
        </div>
      </div>
    );
  }

  // ── RENDER: Level Win ─────────────────────────────────────────────────────
  if (screen === 'lvlwin') {
    const gs = gsRef.current;
    const score = gs?.score ?? 0;
    const lvlIdx = gs?.lvl ?? 0;
    const isLast = lvlIdx >= LEVELS.length - 1;
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6"
        style={{ background: 'linear-gradient(135deg,#001a00,#002a00)' }}>
        <div className="text-5xl">🎉</div>
        <div className="text-white text-2xl font-black">BÖLÜM TAMAM!</div>
        <div className="text-white/60 text-sm">{LEVELS[lvlIdx]?.name}</div>
        <div className="text-yellow-400 text-3xl font-bold">{score.toLocaleString()}</div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {!isLast && (
            <button
              onClick={() => {
                const sd = loadSave();
                const next = lvlIdx + 1;
                if (next > sd.unlocked) { sd.unlocked = next; }
                if (score > (sd.best[lvlIdx] ?? 0)) sd.best[lvlIdx] = score;
                saveSave(sd); setSaveData(sd);
                addLB(userName || 'ASPECT', score, lvlIdx + 1);
                (gsRef as any)._bossIntroShown = false;
                startLevel(next, gs?.lives ?? 3, score);
              }}
              className="w-full py-3 rounded-xl text-white font-bold text-lg"
              style={{ background: 'linear-gradient(90deg,#44aa44,#22cc22)' }}>
              Sonraki Bölüm ▶
            </button>
          )}
          {isLast && (
            <button
              onClick={() => {
                addLB(userName || 'ASPECT', score, LEVELS.length);
                setScreen('victory');
              }}
              className="w-full py-3 rounded-xl text-white font-bold text-lg"
              style={{ background: 'linear-gradient(90deg,#FFD700,#FF8800)' }}>
              🏆 FİNAL! 🏆
            </button>
          )}
          <button onClick={() => setScreen('menu')}
            className="w-full py-2.5 rounded-xl text-white/70 font-medium border border-white/15">
            Ana Menü
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Game Over ─────────────────────────────────────────────────────
  if (screen === 'over') {
    const gs = gsRef.current;
    const score = gs?.score ?? 0;
    const lvlIdx = gs?.lvl ?? 0;
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-6"
        style={{ background: 'linear-gradient(135deg,#200000,#400000)' }}>
        <div className="text-5xl">💀</div>
        <div className="text-red-400 text-2xl font-black">OYUN BİTTİ</div>
        <div className="text-white/50 text-sm">Skor: {score.toLocaleString()}</div>
        <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
          <button
            onClick={() => {
              (gsRef as any)._bossIntroShown = false;
              startLevel(lvlIdx, 3, 0);
            }}
            className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(90deg,#aa2222,#cc4444)' }}>
            <RotateCcw size={16} /> Tekrar Dene
          </button>
          <button onClick={() => setScreen('menu')}
            className="w-full py-2.5 rounded-xl text-white/70 font-medium border border-white/15">
            Ana Menü
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Victory ───────────────────────────────────────────────────────
  if (screen === 'victory') {
    const gs = gsRef.current;
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-6"
        style={{ background: 'linear-gradient(135deg,#000022,#001100,#000022)' }}>
        <div className="text-6xl">🏆</div>
        <div className="text-yellow-400 text-3xl font-black">TÜM BÖLÜMLER TAMAM!</div>
        <div className="text-white/70 text-sm text-center">
          8 mekanda 8 fotoğraf!<br/>
          Gerçek bir ASPECT Fotoğrafçısısın! 📸
        </div>
        <div className="text-yellow-400 text-4xl font-bold mt-2">{(gs?.score ?? 0).toLocaleString()}</div>
        <div className="mt-4 text-center space-y-1">
          {['Zoka Restaurant ✅', 'Fethiye Sokakları ✅', 'Balık Hali ✅', 'Müjgan Restaurant ✅',
            'Çalış Plajı ✅', 'İki Duble ✅', 'Mios ✅', 'ASPECT HQ 👑'].map(n => (
            <div key={n} className="text-white/50 text-xs">{n}</div>
          ))}
        </div>
        <button onClick={() => setScreen('menu')}
          className="mt-4 w-full max-w-xs py-3 rounded-xl text-white font-bold"
          style={{ background: 'linear-gradient(90deg,#FFD700,#FF8800)' }}>
          Ana Menüye Dön
        </button>
      </div>
    );
  }

  return null;
}
