/**
 * ASPECT QUEST — 8 Bölümlü Platformer
 * Türkiye · Fethiye · ASPECT Operations
 * Bosses: Celil & Selçuk, Zuhal, Büşra, Bronz Tanrıverdi, Kayhan, Aman Aman, Özgür
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
  flash:   () => { tone(1200, 0.06, 0.3, 'sine'); setTimeout(() => tone(800, 0.12, 0.2, 'sine'), 60); setTimeout(() => tone(1600, 0.1, 0.25, 'triangle'), 100); },
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
  type: 'plate' | 'ice' | 'net' | 'surfboard' | 'suncream' | 'album' | 'shockwave' | 'camshot';
  w: number; h: number; active: boolean; timer: number;
  netActive?: boolean; // net caught player
  fromPlayer?: boolean; // player-fired projectile
}
interface SpawnedGirl {
  id: number; x: number; y: number; vx: number; alive: boolean; vy: number; onGround: boolean;
}
interface Collectable {
  id: number; x: number; y: number; w: number; h: number;
  type: 'tl' | 'dolar' | 'euro' | 'star';
  pts: number; got: boolean;
}
interface NPC {
  id: number; x: number; y: number; vx: number;
  minX: number; maxX: number; face: number;
  type: 'enemy_tourist' | 'named_minion';
  alive: boolean;
  quote: string; quoteTimer: number; bobOffset: number;
  skinColor: string; clothColor: string;
  // named_minion extras
  name?: string; quotes?: string[]; quoteIdx?: number; quoteInterval?: number;
  // enemy extras
  chasing?: boolean; angerTimer?: number; hp?: number;
}
interface PhotoSpot {
  id: number; x: number; used: boolean;
}
interface Spark { x: number; y: number; vx: number; vy: number; life: number; maxl: number; col: string; sz: number; }
interface FloatText { x: number; y: number; text: string; life: number; col: string; }
interface Bird { id: number; x: number; y: number; baseY: number; vx: number; phase: number; alive: boolean; col: string; sz: number; }
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
  npcs: NPC[];
  photoSpots: PhotoSpot[];
  flashCooldown: number; // frames remaining on flash cooldown
  nearPhotoSpot: boolean;
  flashWhite: number; // frames of white flash overlay
  shootCooldown: number; // frames remaining on player shoot cooldown
  birds: Bird[]; birdId: number;
  birdSpawnTimer: number;
  _finishBlockedShown?: boolean;
  jumpHoldFrames: number;
  jumpIsDouble: boolean;
}

// ─────────────────────────── CONSTANTS ───────────────────────────────────────
const CW = 480, CH = 360;
const GY = 305;
const PW = 22, PH = 34;
const GRAV = 0.52, SPD = 3.7, MAXVY = 14;
const JV_TAP = -5.8,  JV_BOOST = -1.05, JV_HOLD_MAX = 8;
const DJV_TAP = -5.0, DJV_BOOST = -0.85, DJV_HOLD_MAX = 6;
const JUMP_CUT = -3.5;

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
      { speaker: 'Aspect Fotoğrafçısı', text: 'Zoka\'dan başlıyoruz. İlk durak, ilk fotoğraf. Ama kolay olduğunu sanma.', portrait: 'ozgur' },
      { speaker: 'Celil', text: 'Buyur kardeşim, güzel geldin. Bu mekanı sen yönetemezsin ama misafir olabilirsin.', portrait: 'celil' },
      { speaker: 'Selçuk', text: 'Celil\'in dediği gibi... Yani... Saygı çerçevesinde tabii. Hoş geldin.', portrait: 'selcuk' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Tamam tamam. Önce içeri girelim. Fotoğrafları yakala!', portrait: 'ozgur' },
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
      { speaker: 'Aspect Fotoğrafçısı', text: 'Fethiye sokaklarında çekim yaparken dikkatli ol. Belediye zabıtası bugün aktif.', portrait: 'ozgur' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'İzin belgesi... evet var ama... bulmak biraz zaman alıyor. Şimdilik koş!', portrait: 'ozgur' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Sokağın sonuna ulaş, bir şey olursa ararım seni. KOŞ!', portrait: 'ozgur' },
    ],
    boss_win: [
      { speaker: 'Aspect Fotoğrafçısı', text: 'Bravo! Zabıtaları atlattın. Hız konusunda sorun yok. 😄', portrait: 'ozgur' },
    ],
  },
  // Level 2: Balık Hali
  {
    intro: [
      { speaker: 'Necati Abi', text: 'Hoş geldin evladım. Balık Hali\'ne. Burası bizim topraklarımız.', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Kardeşlerim, arkanızdayım! Ne olursa olsun yanınızdayım. Devam edin!', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Ama dikkat et — Zuhal bugün sinirli. Sabahtan beri tartışıyor. Ona yaklaşma.', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Fotoğrafları çek, paralı müşterileri atlat. Ben buradayım, sorarsan bulursun.', portrait: 'necati' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Necati Abi sağ ol. Kardeşlerimiz yanımızda, yürüyoruz! Zuhal\'dan kaç, fotoğrafı kap!', portrait: 'ozgur' },
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
      { speaker: 'Necati Abi', text: 'Evladım Müjgan\'a gidiyorsun. Borular patlamış, su basıyor içeriyi.', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Kardeşlerim arkanızdayım — ama suya girmeyin, yüksekte kalın!', portrait: 'necati' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Su yükseliyor. Platformlara atla, yukarıda kal. Ve Büşra\'ya dikkat.', portrait: 'ozgur' },
      { speaker: 'Büşra', text: 'Özgür! Bu ne saçmalık? Burada ne arıyorsun sen?!', portrait: 'busra' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Merhaba Büşra... kamera... fotoğraf... iş gereği...', portrait: 'ozgur' },
      { speaker: 'Büşra', text: 'İş gereği?! Su bastı mekanı, sen fotoğraf çekiyorsun!', portrait: 'busra' },
    ],
    boss_intro: [
      { speaker: 'Büşra', text: 'Yeter! Dur bir saniye!', portrait: 'busra' },
      { speaker: 'Büşra', text: 'Ağı al! Bir ASPECT fotoğrafçısını bir balık gibi yakalamanın vakti geldi!', portrait: 'busra' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Büşra dur dur dur — iş birliği yapalım, beraber çözelim...', portrait: 'ozgur' },
    ],
    boss_win: [
      { speaker: 'Büşra', text: 'Tamam tamam. Hakkını vereyim. İyi kaçtın.', portrait: 'busra' },
      { speaker: 'Büşra', text: 'Ama bir daha burayı su basarsa seni çağırıyorum. Sen de geleceksin!', portrait: 'busra' },
      { speaker: 'Aspect Fotoğrafçısı', text: '...Tabii ki gelirim Büşra. 😅', portrait: 'ozgur' },
    ],
  },
  // Level 4: Çalış Plajı (Tanrıverdi boss)
  {
    intro: [
      { speaker: 'Necati Abi', text: 'Çalış Plajı evladım! Güneş var, deniz var, müşteri var. Mükemmel!', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Ama dikkat — Bronz Tanrıverdi o sahili sahiplenmiş. Güneş kremi sıkıyor her tarafa!', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Kardeşlerim, arkanızdayım! Sahilden iyi bir kare kap, gurur duyarız!', portrait: 'necati' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Necati Abi haklı. Kumda biraz yavaş kalırsın, dikkatli ol. Haydi!', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Bronz Tanrıverdi', text: 'Eyyy! Bu plajda çekim mi yapıyorsun sen?', portrait: 'tanriverdi' },
      { speaker: 'Bronz Tanrıverdi', text: 'Burası benim alanım. Ben burada bronzlaşmadan burada fotoğraf çekilmez.', portrait: 'tanriverdi' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Anlıyorum ama... turistik fotoğrafçılık, iznim var...', portrait: 'ozgur' },
      { speaker: 'Bronz Tanrıverdi', text: 'Al bakalım şu güneş kremini! 🧴', portrait: 'tanriverdi' },
    ],
    boss_win: [
      { speaker: 'Bronz Tanrıverdi', text: 'Tamam... fena değilsin. Devam et.', portrait: 'tanriverdi' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Sağ ol Bronz Tanrıverdi. Bir gün seninle fotoğraf çekeceğiz!', portrait: 'ozgur' },
    ],
  },
  // Level 5: İki Duble (Kayhan boss)
  {
    intro: [
      { speaker: 'Necati Abi', text: 'İki Duble\'ye giriyorsun evladım. Gece kulübü, karanlık, gürültülü.', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Kayhan orada her gece. Telefona sarıldı mı kızları çağırıyor, etraf dolup taşıyor.', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Kardeşlerim arkanızdayım — fotoğrafı çek, kızlardan kaç, Kayhan\'ı yen!', portrait: 'necati' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Kulaklar çınlıyor ama duyuyorum. Haydi!', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Kayhan', text: 'Dur bakalım. Fotoğrafçı mı bu? İyi, iyi...', portrait: 'kayhan' },
      { speaker: 'Kayhan', text: 'Ama bu mekanda öyle öyle dolaşılmaz. *telefona bakıyor*', portrait: 'kayhan' },
      { speaker: 'Kayhan', text: 'Alo? Siz gelin bakayım buraya. Evet. Şimdi.', portrait: 'kayhan' },
    ],
    boss_win: [
      { speaker: 'Kayhan', text: 'Vay be. Çevik adamsın. Tamam, bu kareyi hak ettin.', portrait: 'kayhan' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Teşekkürler Kayhan. Mios\'a geçiyorum.', portrait: 'ozgur' },
    ],
  },
  // Level 6: Mios Restaurant (Aman Aman boss)
  {
    intro: [
      { speaker: 'Necati Abi', text: 'Mios\'a gidiyorsun evladım. Güzel mekan, ama Aman Aman bugün çok sinirli.', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Sol kolu dövmeli, uzun boylu. Bağırdığında yer titriyor, şok dalgası çıkarıyor!', portrait: 'necati' },
      { speaker: 'Necati Abi', text: 'Kardeşlerim arkanızdayım! Bağırınca atlayın, yerde durma sakın!', portrait: 'necati' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Kulağım çınlıyor ama tamam. Son iki durak! Devam!', portrait: 'ozgur' },
    ],
    boss_intro: [
      { speaker: 'Aman Aman', text: 'Aman aman... Ne bu karışıklık? Kim bu adam?', portrait: 'amanaman' },
      { speaker: 'Aman Aman', text: 'BURASI ÖZEL ALAN!', portrait: 'amanaman' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Aman aman...', portrait: 'ozgur' },
      { speaker: 'Aman Aman', text: 'AMAN AMAN DEMEYECEKSİN BENİM ADIMI!', portrait: 'amanaman' },
    ],
    boss_win: [
      { speaker: 'Aman Aman', text: '...Tamam, tamam. İyi adamsın. Git.', portrait: 'amanaman' },
      { speaker: 'Aspect Fotoğrafçısı', text: 'Son durak ASPECT HQ. Özgür\'ün ofisi. Ama orada da çile var...', portrait: 'ozgur' },
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

const ANGRY_QUOTES = [
  "PAHALIII! 😡",
  "DOLANDIRICII!",
  "İADE İSTİYORUM!",
  "200 TL Ç-O-K!",
  "MÜDÜR ÇAĞIRIRIM!",
  "BERBAT ÇIKTI!!",
  "SİZİ ŞİKAYET..!",
  "FACEBOOK'A YAZARIM!",
];

function makePlatItems(xs: number[], y: number, types: Collectable['type'][]): { x: number; y: number; type: Collectable['type']; pts: number }[] {
  const PTS: Record<Collectable['type'], number> = { tl: 200, dolar: 99, euro: 38, star: 500 };
  return xs.map((x, i) => ({ x, y: y - 20, type: types[i % types.length], pts: PTS[types[i % types.length]] }));
}

// Balık Hali minion dialogues
const EZGI_QUOTES   = ["Ay telefonuma mesaj geldi..", "Dur dur bakayım...", "Kime yazmış acaba 🤔", "Off kaç mesaj var..."];
const ZELIHA_QUOTES = ["Hani müşteri yok gitmiyormuyuz..", "Pff.. Niye buradayız ki?", "Ben burada duramam...", "Uff.. Çok sıkıldım."];
const AYSE_QUOTES   = ["İnstagramıma bakmadım.", "Son postum kaç beğendi?", "Story atmadım daha.. 😮", "Filtre mi koyayım acaba..."];

function makeNPCs(ww: number, lvlIdx: number): NPC[] {
  const npcs: NPC[] = [];
  let nid = 0;

  // ── Level 2 (Balık Hali): Ezgi, Zeliha, Ayşe standing near boss area ────
  if (lvlIdx === 2) {
    const minionDefs = [
      { name: 'Ezgi',   x: 2820, quotes: EZGI_QUOTES,   skin: '#FDBCB4', cloth: '#E87040' },
      { name: 'Zeliha', x: 2960, quotes: ZELIHA_QUOTES, skin: '#F5CBA7', cloth: '#5566BB' },
      { name: 'Ayşe',  x: 3100, quotes: AYSE_QUOTES,   skin: '#FDBCB4', cloth: '#CC4477' },
    ];
    minionDefs.forEach(m => {
      npcs.push({
        id: nid++, x: m.x, y: GY - 34, vx: 0.3,
        minX: m.x - 22, maxX: m.x + 22, face: -1,
        type: 'named_minion', alive: true,
        name: m.name, quotes: m.quotes, quoteIdx: 0, quoteInterval: 240,
        quote: m.quotes[0], quoteTimer: 120,
        bobOffset: nid * 10,
        skinColor: m.skin, clothColor: m.cloth,
      });
    });
  }

  // ── Sinirli Müşteri (enemy) — 3-4 per level, spaced across the level ─────
  const enemyCount = 3 + (lvlIdx % 2); // 3 or 4
  for (let ei = 0; ei < enemyCount; ei++) {
    const ex = 600 + Math.floor((ww - 900) / enemyCount) * ei + 200 + (ei * 73 % 150);
    npcs.push({
      id: nid++, x: ex, y: GY - 34, vx: 1.4,
      minX: ex - 100, maxX: ex + 100, face: 1,
      type: 'enemy_tourist', alive: true,
      quote: ANGRY_QUOTES[(ei + lvlIdx * 2) % ANGRY_QUOTES.length],
      quoteTimer: 0, bobOffset: ei * 30,
      skinColor: '#FDBCB4', clothColor: '#CC2222',
      chasing: false, angerTimer: 0, hp: 2,
    });
  }

  return npcs;
}

function makePhotoSpots(ww: number): PhotoSpot[] {
  return [
    { id: 0, x: Math.floor(ww * 0.22), used: false },
    { id: 1, x: Math.floor(ww * 0.48), used: false },
    { id: 2, x: Math.floor(ww * 0.73), used: false },
  ];
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
      ...makePlatItems([140, 300, 470, 640, 810, 990, 1160, 1340, 1510, 1690, 1860, 2040, 2220, 2410, 2600, 2780, 2960, 3140], 255, ['tl', 'dolar', 'euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'dolar', 'star', 'tl', 'euro']),
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
      ...makePlatItems([110, 270, 430, 590, 760, 930, 1100, 1280, 1460, 1650, 1840, 2030, 2220, 2420, 2610], 255, ['tl', 'star', 'dolar', 'euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl']),
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
      ...makePlatItems([150, 320, 500, 670, 840, 1020, 1190, 1380, 1560, 1740, 1920, 2110, 2290, 2480, 2660, 2850, 3040, 3200], 265, ['euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'dolar']),
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
      ...makePlatItems([120, 290, 460, 630, 800, 980, 1150, 1330, 1510, 1690, 1870, 2050, 2230, 2420, 2600, 2780, 2960, 3120], 248, ['tl', 'dolar', 'star', 'euro', 'tl', 'tl', 'dolar', 'star', 'euro', 'tl', 'tl', 'dolar', 'star', 'euro', 'tl', 'dolar', 'tl', 'euro']),
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
      ...makePlatItems([130, 300, 470, 640, 810, 990, 1160, 1340, 1520, 1700, 1880, 2060, 2240, 2430, 2610, 2790, 2980, 3150], 258, ['dolar', 'tl', 'star', 'euro', 'tl', 'dolar', 'tl', 'star', 'euro', 'tl', 'dolar', 'tl', 'star', 'euro', 'tl', 'dolar', 'tl', 'euro']),
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
      ...makePlatItems([100, 260, 420, 580, 750, 920, 1100, 1280, 1460, 1640, 1820, 2000, 2180, 2370, 2560, 2740, 2920, 3090], 258, ['tl', 'euro', 'star', 'dolar', 'tl', 'tl', 'euro', 'star', 'dolar', 'tl', 'tl', 'euro', 'star', 'dolar', 'tl', 'euro', 'tl', 'dolar']),
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
      ...makePlatItems([110, 280, 450, 620, 790, 970, 1140, 1320, 1500, 1680, 1860, 2040, 2220, 2410, 2590, 2770, 2950, 3120], 258, ['euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'star', 'dolar', 'tl', 'euro', 'tl', 'tl']),
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
      ...makePlatItems([110, 285, 465, 640, 820, 1010, 1190, 1380, 1570, 1760, 1950, 2140, 2330, 2530, 2720, 2920, 3110, 3310, 3510, 3700], 258, ['star', 'tl', 'star', 'dolar', 'star', 'euro', 'star', 'tl', 'star', 'dolar', 'star', 'euro', 'star', 'tl', 'star', 'dolar', 'star', 'euro', 'star', 'tl']),
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
      // Bronz Tanrıverdi — bronz tenli, mayo, güneş kremi tutan
      // Vücut (mayo — koyu mavi)
      ctx.fillStyle = '#1144aa';
      ctx.fillRect(sx + 5, cy + 28 + bob, e.w - 10, e.h - 36);
      // Bronz ten
      ctx.fillStyle = '#C8773A';
      // Kol sol
      ctx.fillRect(sx, cy + 28 + bob, 8, 20);
      // Kol sağ — güneş kremi tutan
      ctx.fillRect(sx + e.w - 8, cy + 28 + bob, 8, 18);
      // Güneş kremi şişesi (sağ elde)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(sx + e.w - 6, cy + 36 + bob, 8, 16);
      ctx.fillStyle = '#FF6600';
      ctx.fillRect(sx + e.w - 5, cy + 37 + bob, 6, 6);
      ctx.fillStyle = '#EEEEEE';
      ctx.fillRect(sx + e.w - 5, cy + 44 + bob, 6, 6);
      // Kafa (bronz)
      ctx.fillStyle = '#C8773A';
      ctx.beginPath(); ctx.arc(cx, cy + 14 + bob, 14, 0, Math.PI * 2); ctx.fill();
      // Saç (koyu)
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath(); ctx.arc(cx, cy + 14 + bob, 14, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 14, cy + bob, 28, 7);
      // Sakal
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath(); ctx.arc(cx, cy + 24 + bob, 10, 0, Math.PI); ctx.fill();
      // Güneş gözlüğü
      ctx.fillStyle = '#111';
      ctx.fillRect(cx - 12, cy + 12 + bob, 9, 5);
      ctx.fillRect(cx + 3, cy + 12 + bob, 9, 5);
      ctx.fillStyle = '#0088FF'; ctx.globalAlpha = 0.5;
      ctx.fillRect(cx - 11, cy + 13 + bob, 7, 3);
      ctx.fillRect(cx + 4, cy + 13 + bob, 7, 3);
      ctx.globalAlpha = 1;
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
  const inputRef   = useRef({ left: false, right: false, jump: false, jumpPress: false, shoot: false, jumpHeld: false });
  const scaleRef   = useRef(1);
  const soundRef   = useRef(true);
  const touchRef   = useRef({ left: false, right: false, jump: false, jumpHeld: false, shoot: false });

  const [screen, setScreen]     = useState<Screen>('menu');
  const [saveData, setSaveData] = useState<SaveData>(() => loadSave());
  const [showLB, setShowLB]     = useState(false);
  const [currentDialog, setCurrentDialog] = useState<Dialog | null>(null);
  const [dialogIdx, setDialogIdx] = useState(0);
  const [dialogQueue, setDialogQueue] = useState<Dialog[]>([]);
  const [uiSnap, setUiSnap]     = useState({ score: 0, lives: 3, lvl: 0, bossHp: 0, bossMaxHp: 0, waterY: CH, nearPhotoSpot: false, flashCooldown: 0, shootCooldown: 0 });
  const flashRef = useRef({ flash: false });
  const godModeRef = useRef(false);
  const [godMode, setGodMode] = useState(false);
  const [cheatInput, setCheatInput] = useState('');
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
        type: ld.bossType, vx: 2.4, alive: true, minX: ld.bossX - 110, maxX: ld.bossX + 110,
        oy: GY - 60, hp: 10 + lvlIdx * 5, maxHp: 10 + lvlIdx * 5, attackTimer: 90, phase: 0, hitTimer: 0, stunTimer: 0,
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
      npcs: makeNPCs(ld.ww, lvlIdx),
      photoSpots: makePhotoSpots(ld.ww),
      flashCooldown: 0, nearPhotoSpot: false, flashWhite: 0, shootCooldown: 0,
      birds: [], birdId: 0, birdSpawnTimer: 60,
      jumpHoldFrames: 0, jumpIsDouble: false,
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
    if (!gs.shootCooldown) gs.shootCooldown = 0;
    if (gs.shootCooldown > 0) gs.shootCooldown--;

    // Death handling
    if (gs.pdead) {
      gs.pdeadT++;
      if (gs.pdeadT > 90) {
        if (!godModeRef.current) gs.lives--;
        if (gs.lives <= 0 && !godModeRef.current) {
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
    const doJump      = inp.jumpPress || tc.jump;
    const jumpHeld    = inp.jumpHeld  || tc.jumpHeld;
    const doShoot     = inp.shoot || tc.shoot;
    inp.jumpPress = false;
    inp.shoot = false;
    tc.jump = false;
    tc.shoot = false;

    const netSlow = gs.netTimer > 0 ? 0.45 : 1;
    const ld = LEVELS[gs.lvl];

    if (goLeft)       { gs.pvx = Math.max(gs.pvx - SPD * 0.45 * netSlow, -SPD * netSlow); gs.pface = -1; }
    else if (goRight) { gs.pvx = Math.min(gs.pvx + SPD * 0.45 * netSlow,  SPD * netSlow); gs.pface =  1; }
    else              { gs.pvx *= 0.72; if (Math.abs(gs.pvx) < 0.1) gs.pvx = 0; }

    if (doJump && gs.pjumps > 0) {
      const isDouble = gs.pjumps < 2;
      gs.pvy = isDouble ? DJV_TAP : JV_TAP;
      gs.pjumps--;
      gs.jumpHoldFrames = 0;
      gs.jumpIsDouble = isDouble;
      if (soundRef.current) isDouble ? SFX.djump() : SFX.jump();
    }

    // Hold-to-jump-higher boost
    if (!gs.ponG && gs.pvy < 0 && jumpHeld) {
      const maxF  = gs.jumpIsDouble ? DJV_HOLD_MAX : JV_HOLD_MAX;
      const boost = gs.jumpIsDouble ? DJV_BOOST     : JV_BOOST;
      if (gs.jumpHoldFrames < maxF) {
        gs.pvy += boost;
        gs.jumpHoldFrames++;
      }
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
        gs.jumpHoldFrames = 0;
        // Slippery sand
        if (p.slippery && Math.abs(gs.pvx) > 0.1) gs.pvx *= 0.95;
      } else if (gs.pvy < 0 && prevPy >= p.y + p.h - 5) {
        gs.py = p.y + p.h;
        gs.pvy = 0;
      }
    });

    // Fall death
    if (gs.py > GY + 120) {
      if (godModeRef.current) { gs.py = GY - PH; gs.pvy = 0; } // god mode: no fall death
      else { gs.pdead = true; gs.pdeadT = 0; if (soundRef.current) SFX.hit(); spawnSparks(gs, gs.px + PW / 2, GY, '#FF4444', 10); return; }
    }

    // Water death
    if (gs.waterRising) {
      // Water rises slowly
      gs.waterLevel -= 0.18;
      if (gs.waterLevel < CH - 50) gs.waterLevel = CH - 50; // cap
      // Check if player hit water
      if (gs.py + PH > gs.waterLevel) {
        if (godModeRef.current) { gs.py = gs.waterLevel - PH - 2; gs.pvy = -8; } // bounce up in god mode
        else { gs.pdead = true; gs.pdeadT = 0; gs.waterLevel = CH + 50; if (soundRef.current) SFX.hit();
        spawnSparks(gs, gs.px + PW / 2, gs.py, '#0088FF', 10);
        return; }
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
            gs.pinv = 100; if (!godModeRef.current) gs.lives--;
            spawnSparks(gs, gs.px, gs.py, '#FF4444', 8);
            gs.floats.push({ x: gs.px, y: gs.py - 15, text: godModeRef.current ? '🛡️ GOD!' : '-1 💔', life: 60, col: godModeRef.current ? '#00FFFF' : '#FF4444' });
            if (soundRef.current) SFX.hit();
            if (gs.lives <= 0 && !godModeRef.current) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
          }
        }
      }
    }

    // ── Enemies (boss) ─────────────────────────────────���──────────────────
    gs.enemies.forEach(e => {
      if (!e.alive) return;
      if (e.hitTimer !== undefined && e.hitTimer > 0) e.hitTimer--;
      if (e.stunTimer !== undefined && e.stunTimer > 0) { e.stunTimer--; return; }

      // Boss movement — speed up in phase 2
      const bossSpeedMult = (e.hp! < (e.maxHp ?? 10) * 0.5) ? 1.7 : 1.0;
      const bossVxDir = e.vx > 0 ? 1 : -1;
      e.x += bossVxDir * 2.4 * bossSpeedMult;
      if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
      if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }

      // Boss attacks — only when player is close enough (within 400px)
      const bossDistToPlayer = Math.abs(gs.px - (e.x + e.w / 2));
      if (e.attackTimer !== undefined) {
        if (bossDistToPlayer < 400) e.attackTimer--;
        if (e.attackTimer <= 0) {
          // Phase 2 (below 50% HP): much faster attacks
          const attackInterval = (e.hp! < e.maxHp! * 0.5) ? 55 : 90;
          e.attackTimer = attackInterval;
          const pid = gs.projId++;
          const bx = e.x + e.w / 2, by = e.y + 20;
          const dx = gs.px - bx, dy = gs.py - by;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const spd = (e.hp! < e.maxHp! * 0.5) ? 6.5 : 4.5;

          let ptype: Projectile['type'] = 'plate';
          if (e.type === 'boss_zuhal') ptype = 'ice';
          else if (e.type === 'boss_busra') ptype = 'net';
          else if (e.type === 'boss_tanriverdi') ptype = 'suncream';
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
              w: ptype === 'surfboard' ? 60 : ptype === 'suncream' ? 14 : ptype === 'album' ? 28 : 20,
              h: ptype === 'surfboard' ? 14 : ptype === 'suncream' ? 28 : 20,
              active: true, timer: 200,
            });
          }

          // Kayhan spawns girls — max 3 alive at once, slow speed
          if (e.type === 'boss_kayhan') {
            const aliveGirls = gs.spawnedGirls.filter(g => g.alive).length;
            if (aliveGirls < 3) {
              const spawnCount = Math.min(2, 3 - aliveGirls);
              for (let gi = 0; gi < spawnCount; gi++) {
                gs.spawnedGirls.push({
                  id: gs.girlId++,
                  x: e.x + e.w / 2 + (gi === 0 ? -50 : 50),
                  y: e.y,
                  vx: gi === 0 ? -0.55 : 0.55, // much slower
                  alive: true, vy: 0, onGround: false,
                });
              }
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
            gs.pvy = JV_TAP * 1.2; // stomp bounce
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
            gs.pinv = 100; if (!godModeRef.current) gs.lives--;
            spawnSparks(gs, gs.px + PW / 2, gs.py + PH / 2, '#FF4444', 8);
            gs.floats.push({ x: gs.px, y: gs.py - 15, text: godModeRef.current ? '🛡️ GOD!' : '-1 💔', life: 60, col: godModeRef.current ? '#00FFFF' : '#FF4444' });
            if (soundRef.current) SFX.hit();
            if (gs.lives <= 0 && !godModeRef.current) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
          }
        }
      }
    });

    // ── Player camera shot ────────────────────────────────────────────────
    if (doShoot && gs.shootCooldown === 0) {
      gs.shootCooldown = 28; // ~0.45s cooldown
      gs.pcamAnim = 12; // camera flash animation
      const shotVx = gs.pface * 11;
      gs.projectiles.push({
        id: gs.projId++,
        x: gs.px + (gs.pface > 0 ? PW + 4 : -4),
        y: gs.py + PH / 2,
        vx: shotVx, vy: 0,
        type: 'camshot',
        w: 18, h: 14,
        active: true, timer: 55,
        fromPlayer: true,
      });
      if (soundRef.current) {
        // Camera click SFX
        const ctx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx2.createOscillator(); const g2 = ctx2.createGain();
        o.connect(g2); g2.connect(ctx2.destination);
        o.frequency.setValueAtTime(1800, ctx2.currentTime);
        o.frequency.exponentialRampToValueAtTime(400, ctx2.currentTime + 0.08);
        g2.gain.setValueAtTime(0.22, ctx2.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.1);
        o.start(); o.stop(ctx2.currentTime + 0.12);
      }
    }

    // ── Projectiles ───────────────────────────────────────────────────────
    gs.projectiles.forEach(p => {
      if (!p.active) return;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity on projectiles
      p.timer--;
      if (p.timer <= 0 || p.y > GY + 50) { p.active = false; return; }
      // Player hit (only enemy projectiles)
      if (!p.fromPlayer && gs.pinv === 0 && aabb(gs.px, gs.py, PW, PH, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
        p.active = false;
        if (p.type === 'net') {
          gs.netTimer = 180;
          gs.floats.push({ x: gs.px, y: gs.py - 15, text: 'AĞA TAKILDIK! 🕸️', life: 80, col: '#88FF88' });
        } else {
          gs.pinv = 80; if (!godModeRef.current) gs.lives--;
          spawnSparks(gs, gs.px, gs.py, '#FF4444', 8);
          gs.floats.push({ x: gs.px, y: gs.py - 15, text: godModeRef.current ? '🛡️ GOD!' : '-1 💔', life: 60, col: godModeRef.current ? '#00FFFF' : '#FF4444' });
          if (soundRef.current) SFX.hit();
          if (gs.lives <= 0 && !godModeRef.current) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
        }
      }

      // Camshot hits enemies & NPCs
      if (p.fromPlayer && p.type === 'camshot' && p.active) {
        // Hit boss/enemies
        gs.enemies.forEach(e => {
          if (!e.alive || !p.active) return;
          if (aabb(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, e.x, e.y, e.w, e.h)) {
            p.active = false;
            e.hp = (e.hp ?? 1) - 1;
            e.hitTimer = 20;
            e.stunTimer = (e.stunTimer ?? 0) + 30; // kısa sersemletme (~0.5s)
            gs.score += 80;
            spawnSparks(gs, p.x, p.y, '#FFFF44', 12);
            gs.floats.push({ x: e.x, y: e.y - 10, text: `📸 -1 HP! (${e.hp}/${e.maxHp})`, life: 70, col: '#FFFF44' });
            if (soundRef.current) SFX.bossHit();
            if (e.hp! <= 0) {
              e.alive = false;
              gs.bossDefeated = true;
              gs.score += 1000;
              spawnSparks(gs, e.x + e.w / 2, e.y + e.h / 2, '#FFD700', 30);
              if (soundRef.current) SFX.bossWin();
              const winDialogs = LEVEL_DIALOGS[gs.lvl]?.boss_win ?? [];
              setTimeout(() => {
                showDialogs(winDialogs, () => {
                  if (gsRef.current) gsRef.current.levelComplete = true;
                  setTimeout(() => { setScreen('lvlwin'); }, 500);
                });
              }, 400);
            }
          }
        });
        // Hit spawned girls
        gs.spawnedGirls.forEach(g => {
          if (!g.alive || !p.active) return;
          if (aabb(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, g.x, g.y, 24, 34)) {
            p.active = false;
            g.alive = false;
            gs.score += 50;
            spawnSparks(gs, p.x, p.y, '#FFD700', 8);
            gs.floats.push({ x: p.x, y: p.y - 10, text: '📸 +50', life: 60, col: '#FFD700' });
          }
        });
        // Hit enemy NPCs
        gs.npcs.forEach(npc => {
          if (!npc.alive || npc.type !== 'enemy_tourist' || !p.active) return;
          if (aabb(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, npc.x - 11, npc.y - 30, 22, 34)) {
            p.active = false;
            npc.hp = (npc.hp ?? 2) - 1;
            spawnSparks(gs, p.x, p.y, '#FF8800', 8);
            if (npc.hp <= 0) {
              npc.alive = false;
              gs.score += 100;
              gs.floats.push({ x: p.x, y: p.y - 10, text: '📸 +100! 💀', life: 65, col: '#FF8800' });
            } else {
              gs.floats.push({ x: npc.x, y: npc.y - 35, text: '📸 Canı yarı! 😤', life: 60, col: '#FFAA00' });
            }
          }
        });
      }
    });
    gs.projectiles = gs.projectiles.filter(p => p.active);

    // ── Shockwave ─────────────────────────────────────────────────────────
    if (gs.shockwaveTimer > 0) {
      gs.shockwaveTimer--;
      const swDist = Math.abs(gs.px - gs.shockwaveX);
      if (gs.pinv === 0 && swDist < 380) {
        // shockwave hits if player is on ground and within range
        if (gs.ponG) {
          gs.pinv = 80; if (!godModeRef.current) gs.lives--;
          spawnSparks(gs, gs.px, gs.py, '#FF4444', 8);
          gs.floats.push({ x: gs.px, y: gs.py - 15, text: godModeRef.current ? '🛡️ GOD!' : 'SHOCKWAVE! 💥', life: 60, col: godModeRef.current ? '#00FFFF' : '#FF8800' });
          if (soundRef.current) SFX.hit();
          if (gs.lives <= 0 && !godModeRef.current) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
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
      // Chase player — Kayhan girls move slowly (0.7), Özgür personel faster (2.2)
      if (g.onGround) {
        const dx2 = gs.px - g.x;
        const isKayhanLevel = gsRef.current?.lvl === 5;
        const chaseSpd = isKayhanLevel ? 0.7 : 2.2;
        g.vx = dx2 > 0 ? chaseSpd : -chaseSpd;
      }
      if (gs.pinv === 0 && aabb(gs.px, gs.py, PW, PH, g.x, g.y, 24, 34)) {
        g.alive = false;
        gs.pinv = 80; if (!godModeRef.current) gs.lives--;
        spawnSparks(gs, gs.px, gs.py, '#FF4444', 8);
        gs.floats.push({ x: gs.px, y: gs.py - 15, text: godModeRef.current ? '🛡️ GOD!' : '-1 💔', life: 60, col: godModeRef.current ? '#00FFFF' : '#FF4444' });
        if (soundRef.current) SFX.hit();
        if (gs.lives <= 0 && !godModeRef.current) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
      }
    });
    gs.spawnedGirls = gs.spawnedGirls.filter(g => g.alive && g.x > gs.camX - 200 && g.x < gs.camX + CW + 200);

    // ── Collectibles ──────────────────────────────────────────────────────
    const MONEY_LABEL: Record<string, string> = { tl: '₺200', dolar: '$3', euro: '€1', star: '⭐500' };
    const MONEY_COL:   Record<string, string> = { tl: '#FFD700', dolar: '#44FF88', euro: '#44AAFF', star: '#FFD700' };
    gs.items.forEach(it => {
      if (it.got) return;
      if (aabb(gs.px, gs.py, PW, PH, it.x, it.y, it.w, it.h)) {
        it.got = true;
        gs.score += it.pts;
        const col3 = MONEY_COL[it.type] || '#88EEFF';
        if (soundRef.current) it.type === 'star' ? SFX.star() : SFX.collect();
        spawnSparks(gs, it.x, it.y, col3, 6);
        gs.floats.push({ x: it.x, y: it.y - 16, text: MONEY_LABEL[it.type] || `+${it.pts}`, life: 60, col: col3 });
      }
    });

    // ── NPCs ─────────────────────────────────────────────────────────────
    gs.npcs.forEach(npc => {
      if (!npc.alive) return;

      if (npc.type === 'named_minion') {
        npc.x += npc.vx * npc.face;
        if (npc.x >= npc.maxX) npc.face = -1;
        if (npc.x <= npc.minX) npc.face = 1;
        if (npc.quotes && npc.quotes.length > 0) {
          const interval = npc.quoteInterval ?? 260;
          if (gs.t % interval === (npc.id * 41) % interval) {
            npc.quoteIdx = ((npc.quoteIdx ?? 0) + 1) % npc.quotes.length;
            npc.quote = npc.quotes[npc.quoteIdx];
            npc.quoteTimer = 200;
          }
        }
        if (npc.quoteTimer > 0) npc.quoteTimer--;

      } else if (npc.type === 'enemy_tourist') {
        const dx = gs.px - npc.x;
        const dist = Math.abs(dx);
        // Start chasing when player within 180px
        if (dist < 180) {
          npc.chasing = true;
          npc.face = dx > 0 ? 1 : -1;
        } else if (dist > 260) {
          npc.chasing = false;
        }

        if (npc.chasing) {
          // Chase at speed 2.2, show angry quote
          npc.x += 2.2 * npc.face;
          if (npc.quoteTimer === 0) {
            npc.quote = ANGRY_QUOTES[(Math.floor(gs.t / 90) + npc.id) % ANGRY_QUOTES.length];
            npc.quoteTimer = 90;
          }
        } else {
          // Patrol normally
          npc.x += npc.vx * npc.face;
          if (npc.x >= npc.maxX) npc.face = -1;
          if (npc.x <= npc.minX) npc.face = 1;
        }
        if (npc.quoteTimer > 0) npc.quoteTimer--;

        // Damage player on contact
        if (gs.pinv === 0 && aabb(gs.px, gs.py, PW, PH, npc.x - 10, npc.y - 30, 22, 34)) {
          gs.pinv = 90;
          if (!godModeRef.current) gs.lives--;
          npc.alive = false; // disappear after hitting
          spawnSparks(gs, npc.x, npc.y, '#FF2200', 10);
          gs.floats.push({ x: npc.x, y: npc.y - 20, text: godModeRef.current ? '🛡️ GOD!' : '😡 -1 CAN!', life: 70, col: godModeRef.current ? '#00FFFF' : '#FF2200' });
          if (soundRef.current) SFX.hit();
          if (gs.lives <= 0 && !godModeRef.current) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
        }
      }
    });

    // ── Birds (flying + obstacles) ────────────────────────────────────────
    if (!gs.birds) gs.birds = [];
    if (gs.birdId === undefined) gs.birdId = 0;
    if (!gs.birdSpawnTimer) gs.birdSpawnTimer = 60;
    const BIRD_COLS = ['#FF4488', '#FF8800', '#FFDD00', '#44FFAA', '#88AAFF'];
    gs.birdSpawnTimer--;
    if (gs.birdSpawnTimer <= 0) {
      gs.birdSpawnTimer = 140 + Math.floor(Math.random() * 80);
      const fromRight = Math.random() > 0.5;
      const birdBaseY = 60 + Math.random() * 160;
      gs.birds.push({
        id: gs.birdId++,
        x: fromRight ? gs.camX + CW + 20 : gs.camX - 20,
        y: birdBaseY,
        baseY: birdBaseY,
        vx: fromRight ? -(2.2 + Math.random() * 1.8) : (2.2 + Math.random() * 1.8),
        phase: Math.random() * Math.PI * 2,
        alive: true,
        col: BIRD_COLS[gs.birdId % BIRD_COLS.length],
        sz: 8 + Math.floor(Math.random() * 6),
      });
    }
    gs.birds.forEach(b => {
      if (!b.alive) return;
      b.x += b.vx;
      b.phase += 0.07;
      b.y = b.baseY + Math.sin(b.phase) * 28;
      // Hurt player on contact
      const bx = b.x - b.sz, by = b.y - b.sz;
      if (gs.pinv === 0 && aabb(gs.px, gs.py, PW, PH, bx, by, b.sz * 2, b.sz * 2)) {
        b.alive = false;
        gs.pinv = 75; if (!godModeRef.current) gs.lives--;
        spawnSparks(gs, b.x, b.y, b.col, 10);
        gs.floats.push({ x: b.x, y: b.y - 15, text: godModeRef.current ? '🛡️ GOD!' : '🐦 -1!', life: 60, col: godModeRef.current ? '#00FFFF' : b.col });
        if (soundRef.current) SFX.hit();
        if (gs.lives <= 0 && !godModeRef.current) { gs.screen = 'over'; setScreen('over'); if (soundRef.current) SFX.gameOver(); }
      }
    });
    // camshot kills birds
    gs.projectiles.forEach(p => {
      if (!p.fromPlayer || p.type !== 'camshot' || !p.active) return;
      (gs.birds ?? []).forEach(b => {
        if (!b.alive) return;
        if (aabb(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, b.x - b.sz, b.y - b.sz, b.sz * 2, b.sz * 2)) {
          b.alive = false; p.active = false;
          gs.score += 60;
          spawnSparks(gs, b.x, b.y, b.col, 8);
          gs.floats.push({ x: b.x, y: b.y - 12, text: '📸 +60', life: 55, col: '#FFD700' });
        }
      });
    });
    // Remove off-screen birds
    gs.birds = gs.birds.filter(b => b.alive && b.x > gs.camX - 60 && b.x < gs.camX + CW + 60);

    // ── Photo spots ───────────────────────────────────────────────────────
    gs.nearPhotoSpot = false;
    if (gs.flashCooldown > 0) gs.flashCooldown--;
    gs.photoSpots.forEach(ps => {
      if (ps.used) return;
      if (Math.abs(gs.px - ps.x) < 55) {
        gs.nearPhotoSpot = true;
        // Flash triggered?
        if (flashRef.current.flash && gs.flashCooldown === 0) {
          ps.used = true;
          gs.flashCooldown = 1200; // 20s
          gs.flashWhite = 30;
          gs.score += 300;
          gs.pcamAnim = 20;
          if (soundRef.current) SFX.flash();
          spawnSparks(gs, gs.px, gs.py, '#FFFFFF', 20);
          gs.floats.push({ x: gs.px, y: gs.py - 20, text: '📸 +300!', life: 80, col: '#FFFFFF' });
          // Stun boss
          gs.enemies.forEach(e => {
            if (e.alive && e.stunTimer !== undefined) {
              e.stunTimer = 150; // 2.5s
              gs.floats.push({ x: e.x, y: e.y - 20, text: '😵 STUN!', life: 70, col: '#FFD700' });
            }
          });
        }
      }
    });
    flashRef.current.flash = false;

    // ── Flash white overlay decay ─────────────────────────────────────────
    if (gs.flashWhite > 0) gs.flashWhite--;

    // ── Finish check ──────────────────────────────────────────────────────
    // Guard: if this level has a boss that is still alive, block the finish
    const bossStillAlive = ld.hasBoss && !gs.bossDefeated;
    if (gs.px > ld.fx) {
      if (bossStillAlive) {
        // Bounce the player back — can't leave without defeating boss
        gs.pvx = -3;
        gs.px = ld.fx - PW - 4;
        if (!gs._finishBlockedShown) {
          gs._finishBlockedShown = true;
          gs.floats.push({ x: gs.px, y: gs.py - 20, text: '⚠️ Önce boss\'u yen!', life: 100, col: '#FF8800' });
        }
      } else if (!gs.levelComplete) {
        gs._finishBlockedShown = false;
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
    } else {
      gs._finishBlockedShown = false;
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
        nearPhotoSpot: gs.nearPhotoSpot,
        flashCooldown: gs.flashCooldown,
        shootCooldown: gs.shootCooldown,
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

    // Photo spots
    gs.photoSpots.forEach(ps => {
      if (ps.used) return;
      const psx2 = ps.x - camX;
      if (psx2 < -40 || psx2 > CW + 40) return;
      const pulse = 0.7 + 0.3 * Math.sin(t * 0.1);
      ctx.save();
      ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 16 * pulse;
      // Ground marker
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(psx2, GY - 2, 18, Math.PI, 0); ctx.stroke();
      // Camera icon
      ctx.fillStyle = `rgba(255,255,220,${0.9 * pulse})`;
      ctx.font = '16px serif'; ctx.textAlign = 'center';
      ctx.fillText('📷', psx2, GY - 8);
      // Glow ring
      ctx.strokeStyle = `rgba(255,240,100,${0.4 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(psx2, GY - 16, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });

    // ── Birds ─────────────────────────────────────────────────────────────
    (gs.birds ?? []).forEach(b => {
      if (!b.alive) return;
      const bsx = b.x - camX;
      if (bsx < -40 || bsx > CW + 40) return;
      ctx.save();
      ctx.translate(bsx, b.y);
      // Flap animation — squish vertically
      const flap = Math.abs(Math.sin(b.phase * 3));
      ctx.shadowColor = b.col; ctx.shadowBlur = 10;
      ctx.strokeStyle = b.col;
      ctx.lineWidth = b.sz * 0.55;
      ctx.lineCap = 'round';
      // "+" cross shape
      const arm = b.sz * (0.8 + flap * 0.4);
      ctx.beginPath(); ctx.moveTo(-arm, 0); ctx.lineTo(arm, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -arm * (1 - flap * 0.5)); ctx.lineTo(0, arm * (1 - flap * 0.5)); ctx.stroke();
      // Body dot center
      ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.arc(0, 0, b.sz * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // Collectibles
    gs.items.forEach(it => {
      if (it.got) return;
      const sx4 = it.x - camX;
      if (sx4 < -20 || sx4 > CW + 20) return;
      const bob = Math.sin(t * 0.08 + it.id) * 3;
      const coinCols: Record<string, string> = { tl: '#FFD700', dolar: '#44FF88', euro: '#44AAFF', star: '#FFD700' };
      const col2 = coinCols[it.type] || '#FFF';
      const cx5 = sx4 + it.w / 2;
      const cy5 = it.y + bob + it.h / 2;
      ctx.save();
      ctx.shadowColor = col2; ctx.shadowBlur = 10;
      if (it.type === 'star') {
        ctx.fillStyle = col2;
        const r1 = it.w / 2, r2 = r1 * 0.45;
        ctx.beginPath();
        for (let si = 0; si < 10; si++) {
          const angle = (si * Math.PI) / 5 - Math.PI / 2;
          const rr = si % 2 === 0 ? r1 : r2;
          si === 0 ? ctx.moveTo(cx5 + Math.cos(angle) * rr, cy5 + Math.sin(angle) * rr)
                   : ctx.lineTo(cx5 + Math.cos(angle) * rr, cy5 + Math.sin(angle) * rr);
        }
        ctx.closePath(); ctx.fill();
      } else {
        // Coin circle
        ctx.fillStyle = col2;
        ctx.beginPath(); ctx.arc(cx5, cy5, 8, 0, Math.PI * 2); ctx.fill();
        // Dark inner
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(cx5, cy5, 6, 0, Math.PI * 2); ctx.fill();
        // Currency symbol
        ctx.fillStyle = col2;
        ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const sym = it.type === 'tl' ? '₺' : it.type === 'dolar' ? '$' : '€';
        ctx.fillText(sym, cx5, cy5);
        ctx.textBaseline = 'alphabetic';
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
        const barW = 70, barH = 6;
        const bx = ex2 + e.w / 2 - barW / 2;
        const by = e.y - 22;
        // Boss name label
        const bossNameMap: Record<string, string> = {
          boss_celil: 'Celil', boss_selcuk: 'Selçuk', boss_zuhal: 'Zuhal',
          boss_busra: 'Büşra', boss_tanriverdi: 'Bronz Tanrıverdi',
          boss_kayhan: 'Kayhan', boss_amanaman: 'Aman Aman', boss_ozgur: 'Özgür',
        };
        const bossLabel = bossNameMap[e.type] ?? 'BOSS';
        ctx.save();
        ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(bossLabel, ex2 + e.w / 2, by - 3);
        ctx.fillStyle = '#FFD700';
        ctx.fillText(bossLabel, ex2 + e.w / 2, by - 4);
        ctx.restore();
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

    // NPCs
    gs.npcs.forEach(npc => {
      if (!npc.alive) return;
      const nx = npc.x - camX;
      if (nx < -80 || nx > CW + 80) return;
      ctx.save();
      if (npc.type === 'enemy_tourist') {
        const ny = npc.y;
        const angerBob = npc.chasing ? Math.sin(t * 0.35 + npc.id) * 3 : 0;
        const legSpd = npc.chasing ? 0.35 : 0.14;
        const legBob = Math.sin(t * legSpd + npc.id) * 5;
        // Red glow when chasing
        if (npc.chasing) {
          ctx.shadowColor = '#FF2200'; ctx.shadowBlur = 16;
        }
        // Body — red shirt
        ctx.fillStyle = '#CC2222';
        ctx.fillRect(nx - 9, ny + 12 + angerBob, 18, 22);
        // Head — flushed red face
        ctx.fillStyle = '#F08070';
        ctx.beginPath(); ctx.arc(nx, ny + 6 + angerBob, 10, 0, Math.PI * 2); ctx.fill();
        // Vein line on forehead when chasing
        if (npc.chasing) {
          ctx.strokeStyle = '#CC0000'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(nx - 4, ny - 2 + angerBob); ctx.lineTo(nx - 2, ny + 1 + angerBob); ctx.lineTo(nx + 1, ny + angerBob); ctx.stroke();
        }
        // Hair — short, dark
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath(); ctx.arc(nx, ny + 6 + angerBob, 10, Math.PI, 0); ctx.fill();
        ctx.fillRect(nx - 10, ny - 4 + angerBob, 20, 5);
        // Angry eyes — thick brows, small pupils
        ctx.fillStyle = '#111';
        ctx.fillRect(nx - 5 + (npc.face < 0 ? 2 : 0), ny + 4 + angerBob, 4, 4);
        ctx.fillRect(nx + 1 + (npc.face < 0 ? 2 : 0), ny + 4 + angerBob, 4, 4);
        // Angry brows slanted
        ctx.fillStyle = '#2a1a0a'; ctx.lineWidth = 2;
        if (npc.face > 0) {
          ctx.fillRect(nx - 6, ny + 1 + angerBob, 5, 2);
          ctx.fillRect(nx + 1, ny + 2 + angerBob, 5, 2);
        } else {
          ctx.fillRect(nx - 6, ny + 2 + angerBob, 5, 2);
          ctx.fillRect(nx + 1, ny + 1 + angerBob, 5, 2);
        }
        // Mouth — open shouting O
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(nx, ny + 12 + angerBob, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
        // Legs
        ctx.fillStyle = '#555';
        ctx.fillRect(nx - 7, ny + 34, 6, 11 + legBob);
        ctx.fillRect(nx + 1, ny + 34, 6, 11 - legBob);
        // Fist arm extended when chasing
        if (npc.chasing) {
          ctx.fillStyle = '#F08070';
          const armX = npc.face > 0 ? nx + 10 : nx - 18;
          ctx.fillRect(armX, ny + 16 + angerBob, 10, 6);
          ctx.beginPath(); ctx.arc(armX + (npc.face > 0 ? 10 : 0), ny + 19 + angerBob, 5, 0, Math.PI * 2); ctx.fill();
        }
        // Quote bubble
        if (npc.quoteTimer > 0) {
          const alpha = Math.min(1, npc.quoteTimer / 30);
          const bw3 = 88; const bh3 = 18;
          const bx3 = nx - bw3 / 2; const by3 = ny - 42 + angerBob;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = 'rgba(255,30,0,0.92)';
          drawRoundRect(ctx, bx3, by3, bw3, bh3, 5); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
          ctx.fillText(npc.quote, bx3 + bw3 / 2, by3 + 13);
          ctx.globalAlpha = 1;
        }
      } else if (npc.type === 'named_minion') {
        const ny = npc.y;
        // Slight weight-shift bob
        const idleBob = Math.sin(t * 0.07 + npc.id * 1.1) * 1.5;
        // Body
        ctx.fillStyle = npc.clothColor;
        ctx.fillRect(nx - 9, ny + 12 + idleBob, 18, 22);
        // Head
        ctx.fillStyle = npc.skinColor;
        ctx.beginPath(); ctx.arc(nx, ny + 7 + idleBob, 10, 0, Math.PI * 2); ctx.fill();
        // Hair (dişi - longer)
        ctx.fillStyle = npc.name === 'Ezgi' ? '#C87941' : npc.name === 'Zeliha' ? '#1a1a1a' : '#8B4513';
        ctx.beginPath(); ctx.arc(nx, ny + 7 + idleBob, 10, Math.PI, 0); ctx.fill();
        ctx.fillRect(nx - 10, ny - 3 + idleBob, 20, 5);
        // Shoulder-length hair sides
        ctx.fillRect(nx - 10, ny + 7 + idleBob, 4, 12);
        ctx.fillRect(nx + 6, ny + 7 + idleBob, 4, 12);
        // Eyes (feminine, slightly larger)
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(nx - 3.5, ny + 6 + idleBob, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(nx + 3.5, ny + 6 + idleBob, 2.2, 0, Math.PI * 2); ctx.fill();
        // Phone in hand (Ezgi always has phone)
        if (npc.name === 'Ezgi') {
          ctx.fillStyle = '#111';
          ctx.fillRect(nx + 10, ny + 18 + idleBob, 6, 10);
          ctx.fillStyle = '#4FC3F7';
          ctx.fillRect(nx + 11, ny + 19 + idleBob, 4, 7);
          // screen glow
          ctx.save(); ctx.shadowColor = '#4FC3F7'; ctx.shadowBlur = 6;
          ctx.fillStyle = 'rgba(79,195,247,0.3)';
          ctx.fillRect(nx + 11, ny + 19 + idleBob, 4, 7);
          ctx.restore();
        }
        // Legs (standing, slight sway)
        ctx.fillStyle = '#333';
        const legSway = Math.sin(t * 0.04 + npc.id) * 1;
        ctx.fillRect(nx - 7, ny + 34, 6, 12 + legSway);
        ctx.fillRect(nx + 1, ny + 34, 6, 12 - legSway);
        // Name tag above head
        const nameColor = npc.name === 'Ezgi' ? '#E87040' : npc.name === 'Zeliha' ? '#5566BB' : '#CC4477';
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(nx - 17, ny - 18 + idleBob, 34, 12);
        ctx.fillStyle = nameColor;
        ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
        ctx.fillText(npc.name ?? '', nx, ny - 9 + idleBob);
        ctx.restore();
        // Quote bubble (always visible for named minions, color-coded)
        if (npc.quoteTimer > 0) {
          const alpha = Math.min(1, npc.quoteTimer / 40);
          const bw2 = 115; const bh2 = 30;
          const bx2 = nx - bw2 / 2; const by2 = ny - 58 + idleBob;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          drawRoundRect(ctx, bx2, by2, bw2, bh2, 7); ctx.fill();
          ctx.strokeStyle = nameColor; ctx.lineWidth = 1.5; ctx.stroke();
          // Tail
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath(); ctx.moveTo(nx - 5, by2 + bh2); ctx.lineTo(nx + 5, by2 + bh2); ctx.lineTo(nx, by2 + bh2 + 8); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = nameColor; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(nx - 5, by2 + bh2); ctx.lineTo(nx, by2 + bh2 + 8); ctx.lineTo(nx + 5, by2 + bh2); ctx.stroke();
          // Text (split into 2 lines)
          ctx.fillStyle = '#111';
          ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center';
          const words2 = npc.quote.split(' ');
          const mid2 = Math.ceil(words2.length / 2);
          const l1 = words2.slice(0, mid2).join(' ');
          const l2 = words2.slice(mid2).join(' ');
          ctx.fillText(l1, nx, by2 + 13);
          if (l2) ctx.fillText(l2, nx, by2 + 23);
          ctx.restore();
        }
      }
      ctx.restore();
    });

    // Projectiles
    gs.projectiles.forEach(p => {
      if (!p.active) return;
      const px2 = p.x - camX;
      if (px2 < -60 || px2 > CW + 60) return;
      ctx.save();

      // Camshot — player's camera bullet
      if (p.type === 'camshot') {
        const life01 = p.timer / 55;
        ctx.translate(px2, p.y);
        // Glow halo
        ctx.shadowColor = '#FFFF88'; ctx.shadowBlur = 16;
        // Main flash oval
        ctx.fillStyle = '#FFFFAA';
        ctx.globalAlpha = 0.92 * life01;
        ctx.beginPath(); ctx.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill();
        // Bright white center
        ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = life01;
        ctx.beginPath(); ctx.ellipse(0, 0, p.w / 4, p.h / 4, 0, 0, Math.PI * 2); ctx.fill();
        // Speed lines
        ctx.strokeStyle = '#FFE033'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.65 * life01;
        const dir = p.vx > 0 ? 1 : -1;
        for (let li = 0; li < 3; li++) {
          const ly = (li - 1) * 4;
          ctx.beginPath(); ctx.moveTo(-dir * 6, ly); ctx.lineTo(-dir * (12 + li * 4), ly); ctx.stroke();
        }
        // Camera shutter icon (tiny)
        ctx.globalAlpha = 0.8 * life01;
        ctx.fillStyle = '#333';
        ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('📸', 0, 3);
        ctx.restore();
        return;
      }

      const rot = p.type === 'surfboard' ? Math.atan2(p.vy, p.vx) : p.type === 'suncream' ? (t * 0.22) : (t * 0.15);
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
      } else if (p.type === 'suncream') {
        // Güneş kremi şişesi — beyaz tüp, turuncu kapak, dönerek uçar
        const sw = p.w, sh = p.h;
        // Şişe gövdesi
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(-sw / 2, -sh / 2 + 4, sw, sh - 4, 3);
        ctx.fill();
        ctx.strokeStyle = '#DDDDDD'; ctx.lineWidth = 1;
        ctx.stroke();
        // Turuncu etiket şeridi
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(-sw / 2, -sh / 2 + 10, sw, 7);
        // SPF yazısı
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('SPF50', 0, -sh / 2 + 16);
        // Beyaz krem lekesi (fırlıyor etkisi)
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(sw / 2 + 3, -sh / 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sw / 2 + 7, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        // Kapak (turuncu)
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.roundRect(-sw / 2 + 1, -sh / 2, sw - 2, 6, 2);
        ctx.fill();
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

    // Flash white overlay (photo flash effect)
    if (gs.flashWhite > 0) {
      ctx.save();
      ctx.globalAlpha = gs.flashWhite / 30;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

    // Flash cooldown indicator
    if (gs.flashCooldown > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 9px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`📷 ${Math.ceil(gs.flashCooldown / 60)}s`, CW - 6, 30);
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
      // Fill width on mobile, keep aspect ratio
      const scale = Math.min(sw, sh, 2.5);
      scaleRef.current = scale;
      canvas.style.transform = `scale(${scale})`;
      canvas.style.transformOrigin = 'top left';
      // Center canvas horizontally if narrower than wrapper
      const scaledW = CW * scale;
      const scaledH = CH * scale;
      canvas.style.marginLeft = scaledW < wrap.clientWidth ? `${(wrap.clientWidth - scaledW) / 2}px` : '0';
      canvas.style.marginTop = scaledH < wrap.clientHeight ? `${(wrap.clientHeight - scaledH) / 2}px` : '0';
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
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        if (!e.repeat) inputRef.current.jumpPress = true;
        inputRef.current.jumpHeld = true;
      }
      if ((e.key === 'f' || e.key === 'F') && !e.repeat) flashRef.current.flash = true;
      if ((e.key === 'z' || e.key === 'Z' || e.key === 'x' || e.key === 'X') && !e.repeat) inputRef.current.shoot = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft'  || e.key === 'a') inputRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        inputRef.current.jumpHeld = false;
        // jump cut: if player is moving up, cap velocity
        const gs = gsRef.current;
        if (gs && gs.pvy < 0) gs.pvy = Math.max(gs.pvy, JUMP_CUT);
      }
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
        {/* HUD — compact single row */}
        <div className="flex items-center gap-2 px-3 py-1.5 z-20 relative shrink-0" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <button onClick={onBack} className="text-white/60 hover:text-white mr-1"><ChevronLeft size={18} /></button>
          <div className="flex gap-0.5">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={`text-sm ${i < uiSnap.lives ? 'text-red-400' : 'text-white/15'}`}>❤️</span>
            ))}
          </div>
          {uiSnap.bossMaxHp > 0 && !gsRef.current?.bossDefeated ? (
            <div className="flex items-center gap-1 flex-1 mx-2">
              <span className="text-white/50 text-xs font-bold shrink-0">BOSS</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${(uiSnap.bossHp / uiSnap.bossMaxHp) * 100}%`, background: `linear-gradient(90deg,#FF4444,${accent})` }} />
              </div>
            </div>
          ) : (
            <div className="flex-1 text-center">
              <span className="text-xs font-bold" style={{ color: accent }}>{ld.name}</span>
            </div>
          )}
          <div className="text-yellow-400 text-xs font-bold shrink-0">{uiSnap.score.toLocaleString()}</div>
          {/* God mode indicator */}
          {godMode && (
            <div className="text-xs font-black px-2 py-0.5 rounded-full shrink-0 animate-pulse"
              style={{ background: 'rgba(0,255,255,0.2)', border: '1px solid #00FFFF88', color: '#00FFFF' }}>
              🛡️ GOD
            </div>
          )}

        </div>

        {/* Canvas + overlaid controls — fills all remaining space */}
        <div ref={wrapRef} className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
          <canvas ref={canvasRef} width={CW} height={CH} style={{ imageRendering: 'pixelated', display: 'block' }} />

          {/* Cheat code input — mid-right, invisible text */}
          <div className="absolute z-30 flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ bottom: 230, right: 8, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ fontSize: 13 }}>🔒</span>
            <input
              type="text"
              value={cheatInput}
              onChange={e => {
                const val = e.target.value.toLowerCase();
                setCheatInput(val);
                if (val.endsWith('aspect123123')) {
                  const next = !godModeRef.current;
                  godModeRef.current = next;
                  setGodMode(next);
                  setCheatInput('');
                  if (gsRef.current) {
                    gsRef.current.floats.push({ x: gsRef.current.px, y: gsRef.current.py - 30, text: next ? '🛡️ GOD MODE ON!' : '💀 GOD MODE OFF', life: 120, col: next ? '#00FFFF' : '#FF8800' });
                  }
                }
                if (val.length > 20) setCheatInput(val.slice(-12));
              }}
              className="bg-transparent outline-none"
              style={{
                width: 50,
                color: 'transparent',
                caretColor: 'rgba(255,255,255,0.4)',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                fontSize: 12,
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          {/* Water warning */}
          {ld.waterRises && uiSnap.waterY < CH * 0.7 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs text-blue-300 font-bold animate-pulse z-10"
              style={{ background: 'rgba(0,100,200,0.6)', border: '1px solid rgba(0,150,255,0.5)' }}>
              💧 SU YÜKSELİYOR! YUKARI ÇIK!
            </div>
          )}

          {/* Touch controls */}
          <div className="absolute bottom-20 left-0 right-0 flex items-end justify-between px-5 pb-2 z-20">
            {/* Left: directional */}
            <div className="flex gap-3">
              <button
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold select-none active:scale-90 transition-transform"
                style={{ background: 'rgba(255,255,255,0.16)', border: '1.5px solid rgba(255,255,255,0.32)', WebkitTapHighlightColor: 'transparent', backdropFilter: 'blur(6px)' }}
                onTouchStart={e => { e.preventDefault(); touchRef.current.left = true; }}
                onTouchEnd={e => { e.preventDefault(); touchRef.current.left = false; }}
                onTouchCancel={e => { e.preventDefault(); touchRef.current.left = false; }}
                onMouseDown={() => touchRef.current.left = true}
                onMouseUp={() => touchRef.current.left = false}
                onMouseLeave={() => touchRef.current.left = false}
              >◀</button>
              <button
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold select-none active:scale-90 transition-transform"
                style={{ background: 'rgba(255,255,255,0.16)', border: '1.5px solid rgba(255,255,255,0.32)', WebkitTapHighlightColor: 'transparent', backdropFilter: 'blur(6px)' }}
                onTouchStart={e => { e.preventDefault(); touchRef.current.right = true; }}
                onTouchEnd={e => { e.preventDefault(); touchRef.current.right = false; }}
                onTouchCancel={e => { e.preventDefault(); touchRef.current.right = false; }}
                onMouseDown={() => touchRef.current.right = true}
                onMouseUp={() => touchRef.current.right = false}
                onMouseLeave={() => touchRef.current.right = false}
              >▶</button>
            </div>
            {/* Right: FLASH + SHOOT + JUMP */}
            <div className="flex gap-2 items-end">
              {/* FLASH — always visible, active only when near spot & off cooldown */}
              {(() => {
                const gs = gsRef.current;
                const canFlash = gs && gs.nearPhotoSpot && gs.flashCooldown === 0;
                const onCD = gs && gs.flashCooldown > 0;
                const cdSec = gs ? Math.ceil(gs.flashCooldown / 60) : 0;
                return (
                  <button
                    className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center select-none active:scale-90 transition-all"
                    style={{
                      background: canFlash
                        ? 'linear-gradient(135deg,#fff84499,#ffaa0099)'
                        : 'rgba(255,255,255,0.07)',
                      border: canFlash ? '2px solid #FFD700' : '1.5px solid rgba(255,255,255,0.15)',
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: canFlash ? '0 0 22px #FFD70099' : 'none',
                      opacity: onCD ? 0.45 : 1,
                    }}
                    onTouchStart={e => { e.preventDefault(); if (canFlash) flashRef.current.flash = true; }}
                    onTouchEnd={e => e.preventDefault()}
                    onMouseDown={() => { if (canFlash) flashRef.current.flash = true; }}
                  >
                    <span className="text-lg leading-none">📷</span>
                    <span className="text-xs font-black leading-none mt-0.5"
                      style={{ color: canFlash ? '#78350f' : 'rgba(255,255,255,0.35)' }}>
                      {onCD ? `${cdSec}s` : 'FLASH'}
                    </span>
                  </button>
                );
              })()}

              {/* SHOOT — camera attack button */}
              {(() => {
                const onCD = uiSnap.shootCooldown > 0;
                const cdSec = Math.ceil(uiSnap.shootCooldown / 60 * 10) / 10;
                return (
                  <button
                    className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center select-none active:scale-90 transition-all"
                    style={{
                      background: onCD
                        ? 'rgba(255,255,255,0.07)'
                        : 'linear-gradient(135deg,#ff550077,#ff990077)',
                      border: onCD ? '1.5px solid rgba(255,255,255,0.15)' : '2px solid #FF7755',
                      WebkitTapHighlightColor: 'transparent',
                      boxShadow: onCD ? 'none' : '0 0 18px #FF775588',
                      opacity: onCD ? 0.5 : 1,
                      backdropFilter: 'blur(6px)',
                    }}
                    onTouchStart={e => { e.preventDefault(); inputRef.current.shoot = true; }}
                    onTouchEnd={e => e.preventDefault()}
                    onMouseDown={() => { inputRef.current.shoot = true; }}
                  >
                    <span className="text-lg leading-none">📸</span>
                    <span className="text-xs font-black leading-none mt-0.5"
                      style={{ color: onCD ? 'rgba(255,255,255,0.3)' : '#fff' }}>
                      {onCD ? `${cdSec}s` : 'ÇEK'}
                    </span>
                  </button>
                );
              })()}

              <button
                className="w-20 h-16 rounded-2xl flex items-center justify-center text-xl font-black select-none active:scale-90 transition-transform"
                style={{ background: `linear-gradient(135deg,${accent}77,${accent}44)`, border: `2px solid ${accent}99`, WebkitTapHighlightColor: 'transparent', boxShadow: `0 0 20px ${accent}66`, backdropFilter: 'blur(6px)' }}
                onTouchStart={e => { e.preventDefault(); touchRef.current.jump = true; touchRef.current.jumpHeld = true; inputRef.current.jumpPress = true; inputRef.current.jumpHeld = true; }}
                onTouchEnd={e => { e.preventDefault(); touchRef.current.jump = false; touchRef.current.jumpHeld = false; inputRef.current.jumpHeld = false; const gs = gsRef.current; if (gs && gs.pvy < 0) gs.pvy = Math.max(gs.pvy, JUMP_CUT); }}
                onTouchCancel={e => { e.preventDefault(); touchRef.current.jump = false; touchRef.current.jumpHeld = false; inputRef.current.jumpHeld = false; }}
                onMouseDown={() => { touchRef.current.jump = true; touchRef.current.jumpHeld = true; inputRef.current.jumpPress = true; inputRef.current.jumpHeld = true; }}
                onMouseUp={() => { touchRef.current.jump = false; touchRef.current.jumpHeld = false; inputRef.current.jumpHeld = false; const gs = gsRef.current; if (gs && gs.pvy < 0) gs.pvy = Math.max(gs.pvy, JUMP_CUT); }}
                onMouseLeave={() => { touchRef.current.jump = false; touchRef.current.jumpHeld = false; inputRef.current.jumpHeld = false; }}
              >
                <span className="text-white font-black tracking-wide">ZIPla</span>
              </button>
            </div>
          </div>
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
