import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, ChevronDown, ChevronUp,
  Package,
  AlertTriangle, CheckCircle, Zap,
  RefreshCw, Clock,
  Brain, MessageSquare, Loader2, Trash2, Settings, Mic,
} from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';
import type { VardiyaSatis } from '../services/stock-service';
import { getLeaveRequests, saveLeaveRequest, deleteLeaveRequest, getDailyOnLeave, getStaffMembers, getLocations, getTasks, saveTask, updateTask, type LeaveRequest, type Location, type StaffMember, type Task } from '../services/rotation-service';
import { AspectAISettings } from './aspect-ai-settings';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Fethiye koordinatları (altın saat hesabı için) ──────────────────────────
const FETHIYE_LAT = 36.6552;
const FETHIYE_LON = 29.1265;

// ─── Albüm maliyet tipi ───────────────────────────────────────────────────────
interface AlbumMaliyet {
  size: number;
  tamBoy: number;
  yarimBoy: number;
  currency: string;
}

// ─── Mekan detay zenginleştirilmiş veri ──────────────────────────────────────
type AIOzetMekan = {
  id: string; name: string; emoji: string; color: string;
  ciro: number; satisAdet: number; iskonto: number;
  acilisYapildi: boolean; kapanisYapildi: boolean;
};

type MekanDetayData = AIOzetMekan & {
  satislar?: VardiyaSatis[];
  albumMaliyetleri?: AlbumMaliyet[];
  printType?: 'tam' | 'yarim';
  vardiyaToplam?: { toplamKullanilanBaskı: number; toplamMaliyet: number; paperName: string | null; birimMaliyet: number; currency: string } | null;
  personelListesi?: { id: string; name: string; gunlukMaas: number; hasMaas: boolean }[];
  kiraMaliyeti?: number;
  yukleniyor?: boolean;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: Date;
  card?: ResponseCard;
}

interface ResponseCard {
  type: 'briefing' | 'profit' | 'stock' | 'personnel' | 'anomaly' | 'tip' | 'payment' | 'golden_hour' | 'mekan_detay' | 'izin' | 'leave_flow' | 'leave_confirm' | 'rotation_flow' | 'rotation_cancel_flow';
  data: any;
}

interface LeaveFlowState {
  step: 'type' | 'duration' | 'start_date' | 'end_date' | 'notes' | 'confirm';
  leaveType?: 'annual' | 'sick' | 'personal';
  durationType?: 'single' | 'multiple';
  startDate?: string;
  endDate?: string;
  notes?: string;
  completed?: boolean;
}

interface RotationFlowState {
  step: 'loading' | 'date' | 'location' | 'personnel' | 'time' | 'confirm' | 'done';
  date?: string;
  locationId?: string;
  locationName?: string;
  locationIcon?: string;
  selectedPersonnel?: Array<{ id: string; name: string; avatar: string; role: string }>;
  startTime?: string;
  endTime?: string;
  notes?: string;
  completed?: boolean;
  taskId?: string;
  taskStatus?: 'draft' | 'sent';
  locations?: Location[];
  staffMembers?: StaffMember[];
  onLeaveIds?: string[];
}

interface RotationCancelFlowState {
  step: 'select' | 'confirm' | 'done';
  date?: string;
  tasks?: Task[];
  selectedTaskId?: string;
  selectedTaskLocation?: string;
  completed?: boolean;
}

interface AspectAIProps {
  userRole?: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  userName?: string;
  userId?: string;
  userAvatar?: string;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

interface AIOzet {
  tarih: string;
  tarihTR: string;
  toplamCiro: number;
  toplamSatisAdet: number;
  toplamIskonto: number;
  toplamKare: number;
  mekanSayisi: number;
  aktifMekanSayisi: number;
  mekanlar: AIOzetMekan[];
  stokDurum: { alan: string; name: string; count: number; status: string }[];
  mekanBazliStok: { mekanId: string; mekanAdi: string; mekanEmoji: string; stokTipi: string; urunler: { alan: string; name: string; count: number; status: string }[] }[];
  anomaliler: { mekan: string; mekanEmoji: string; type: string; detail: any }[];
  personelSiralama: { ad: string; ciro: number; satis: number; iskonto?: number; brutoCiro?: number; indirimOrani?: number }[];
  albumSatisDokumu?: { product: string; adet: number; ciro: number }[];
  odemeDagilimi: { cash: number; card: number; iban: number; foreign: number };
  callerName: string;
  callerRole: string;
  isAdmin: boolean;
  guncellemeZamani: string;
}

// ─── Quick chip categories ────────────────────────────────────────────────────

// ─── Rol Konfigürasyonu ────────────────────────────────────────────────────────

interface RoleConfig {
  chips: { icon: string; label: string; q: string }[];
  welcomeText: (name: string) => string;
  blockedKeywords: string[];
  blockedMessage: string;
  canSeeFinancials: boolean;
  canSeePersonnel: boolean;
  canSeeAnomalies: boolean;
  loadOzet: boolean;
}

const ROLE_CONFIG: Record<string, RoleConfig> = {
  yonetici: {
    chips: [
      { icon: '🗓️', label: 'Rotasyon Oluştur', q: '__ROT_CREATE__' },
      { icon: '🤖', label: 'Rotasyon Öner', q: '__ROT_SUGGEST__' },
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '💰', label: 'Ciro & Kâr', q: 'Bugün toplam ciro ne kadar?' },
      { icon: '🛍️', label: 'Albüm Satışları', q: 'Bugün ürün bazlı satış dökümü nedir?' },
      { icon: '📈', label: 'Haftalık Satış', q: 'Bu hafta satış raporu nedir?' },
      { icon: '🏆', label: 'En İyi Mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
      { icon: '💳', label: 'Ödeme Dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '📋', label: 'Anomali Raporu', q: 'Son 30 günlük anomali raporu nedir?' },
      { icon: '💸', label: 'İndirim Analizi', q: 'Bu ay kimin indirim oranları nedir?' },
      { icon: '🏠', label: 'Mekan Kiraları', q: 'Mekanlarımızın kira bilgileri nedir?' },
      { icon: '💲', label: 'Fiyat Listesi', q: 'Albüm ve ürün fiyat listemiz nedir?' },
      { icon: '⚙️', label: 'Maliyet Özeti', q: 'Aylık sabit giderlerimiz ve malzeme maliyetleri nedir?' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
      { icon: '🏖️', label: 'İzin Talebi', q: '__LEAVE_REQUEST__' },
      { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
    ],
    welcomeText: (name) => `Merhaba **${name}**! Ben Aspect AI. Tüm mekanların satış, kâr, stok ve personel verilerine erişimim var. Ne öğrenmek istersin?`,
    blockedKeywords: [],
    blockedMessage: '',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: true,
    loadOzet: true,
  },
  'ust-mudur': {
    chips: [
      { icon: '🗓️', label: 'Rotasyon Oluştur', q: '__ROT_CREATE__' },
      { icon: '🤖', label: 'Rotasyon Öner', q: '__ROT_SUGGEST__' },
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '🛍️', label: 'Albüm Satışları', q: 'Bugün ürün bazlı satış dökümü nedir?' },
      { icon: '📈', label: 'Haftalık Satış', q: 'Bu hafta satış raporu nedir?' },
      { icon: '🏆', label: 'En İyi Mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
      { icon: '🏖️', label: 'İzin Talebi', q: '__LEAVE_REQUEST__' },
      { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
    ],
    welcomeText: (name) => `Merhaba **${name}**! Ben Aspect AI. Operasyon geneli, mekan performansları ve anomali takibi için buradayım.`,
    blockedKeywords: [],
    blockedMessage: '',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: true,
    loadOzet: true,
  },
  mudur: {
    chips: [
      { icon: '🗓️', label: 'Rotasyon Oluştur', q: '__ROT_CREATE__' },
      { icon: '🤖', label: 'Rotasyon Öner', q: '__ROT_SUGGEST__' },
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '🛍️', label: 'Albüm Satışları', q: 'Bugün ürün bazlı satış dökümü nedir?' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
      { icon: '🏖️', label: 'İzin Talebi', q: '__LEAVE_REQUEST__' },
      { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
    ],
    welcomeText: (name) => `Merhaba **${name}**! Ben Aspect AI. Mekan yönetimi, stok takibi ve personel performansı konularında yardımcı olabilirim.`,
    blockedKeywords: [],
    blockedMessage: '',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: true,
    loadOzet: true,
  },
  operasyon: {
    chips: [
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
      { icon: '🏖️', label: 'İzin Talebi', q: '__LEAVE_REQUEST__' },
      { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
    ],
    welcomeText: (name) => `Merhaba **${name}**! Ben Aspect AI. Saha koordinasyonu, stok durumu ve mekan anomalileri için buradayım.`,
    blockedKeywords: ['kâr marjı', 'net kâr', 'brüt kâr'],
    blockedMessage: '🔒 Kâr/maliyet detaylarına erişim yetkiniz bulunmuyor. Stok, anomali veya mekan durumu hakkında yardımcı olabilirim!',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: true,
    loadOzet: true,
  },
  idari: {
    chips: [
      { icon: '💳', label: 'Ödeme Dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
      { icon: '💰', label: 'Ciro & Kâr', q: 'Bugün toplam ciro ne kadar?' },
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '🏖️', label: 'İzin Talebi', q: '__LEAVE_REQUEST__' },
      { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
    ],
    welcomeText: (name) => `Merhaba **${name}**! Ben Aspect AI. Ödeme dağılımları, ciro takibi ve personel verileri için buradayım.`,
    blockedKeywords: [],
    blockedMessage: '',
    canSeeFinancials: true,
    canSeePersonnel: true,
    canSeeAnomalies: false,
    loadOzet: true,
  },
  personel: {
    chips: [
      { icon: '📦', label: 'Stok Sorgula', q: 'Stok durumu nedir?' },
      { icon: '📸', label: 'Çekim İpuçları', q: 'Portre çekim ipuçları ver' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '🏖️', label: 'İzin Talebi', q: '__LEAVE_REQUEST__' },
      { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
    ],
    welcomeText: (name) => `Merhaba **${name}**! Ben Aspect AI. Stok durumu, çekim teknikleri, izin talebi ve satış süreci hakkında sorularına yardımcı olabilirim!`,
    blockedKeywords: [
      'ciro', 'kâr', 'kar', 'kazandık', 'kazanç', 'gelir', 'para',
      'ödeme', 'nakit', 'kart', 'iban', 'döviz', 'fiyat', 'ücret',
      'indirim', 'iskonto', 'toplam satış', 'özet', 'genel', 'operasyon',
      'en iyi mekan', 'en iyi personel', 'personel sıralama', 'anomali',
      'nasıl geçti', 'bugün ne',
    ],
    blockedMessage: '🔒 Bu bilgiye erişim yetkiniz bulunmuyor. Stok durumu, çekim ipuçları veya satış kayıt süreci hakkında yardımcı olabilirim!',
    canSeeFinancials: false,
    canSeePersonnel: false,
    canSeeAnomalies: false,
    loadOzet: false,
  },
  bekleyen: {
    chips: [
      { icon: '📸', label: 'Çekim İpuçları', q: 'Portre çekim ipuçları ver' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '❓', label: 'Nasıl Başlarım?', q: 'Uygulamayı nasıl kullanabilirim?' },
    ],
    welcomeText: (name) => `Merhaba **${name}**! Ben Aspect AI. Hesabın henüz onay aşamasında. Bu süreçte fotoğrafçılık ipuçları ve genel bilgiler için buradayım!`,
    blockedKeywords: [
      'ciro', 'kâr', 'kar', 'satış', 'stok', 'mekan', 'anomali',
      'personel', 'ödeme', 'gelir', 'operasyon', 'vardiya',
    ],
    blockedMessage: '🔒 Hesabınız henüz onaylanmamış. Yönetici onayından sonra tüm özelliklere erişebilirsiniz.',
    canSeeFinancials: false,
    canSeePersonnel: false,
    canSeeAnomalies: false,
    loadOzet: false,
  },
};

// ─── Altın Saat API ───────────────────────────────────────────────────────────

async function fetchAltiSaat(): Promise<{ text: string; card: ResponseCard }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://api.sunrise-sunset.org/json?lat=${FETHIYE_LAT}&lng=${FETHIYE_LON}&date=${today}&formatted=0`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK') throw new Error('API hatası');

    const { sunrise, sunset } = json.results;

    const toTR = (utcStr: string) => {
      const d = new Date(utcStr);
      // TR = UTC+3
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
    };

    const addMinutes = (utcStr: string, mins: number) => {
      const d = new Date(utcStr);
      d.setMinutes(d.getMinutes() + mins);
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
    };

    const sabahBaslangic = toTR(sunrise);
    const sabahBitis = addMinutes(sunrise, 60);
    const aksamBaslangic = addMinutes(sunset, -60);
    const aksamBitis = toTR(sunset);

    // Kalan süre hesapla
    const now = new Date();
    const sunsetDate = new Date(sunset);
    const aksamBaslangicDate = new Date(sunsetDate.getTime() - 60 * 60 * 1000);
    const diff = aksamBaslangicDate.getTime() - now.getTime();

    let kalanMesaj = '';
    if (diff > 0) {
      const saat = Math.floor(diff / 3600000);
      const dakika = Math.floor((diff % 3600000) / 60000);
      kalanMesaj = saat > 0
        ? `⏳ Akşam altın saatine **${saat} saat ${dakika} dakika** kaldı!`
        : dakika > 0
          ? `⏳ Akşam altın saatine **${dakika} dakika** kaldı!`
          : `🔥 Akşam altın saati **şu an başlamak üzere!**`;
    } else if (now.getTime() < sunsetDate.getTime()) {
      kalanMesaj = `🌇 Akşam altın saati **şu an aktif!** Hemen çekime çık!`;
    } else {
      kalanMesaj = `🌙 Bugünün altın saatleri tamamlandı. Yarın için plan yap!`;
    }

    const text = `📍 **Fethiye** — Bugün altın saatler:\n\n🌅 **Sabah:** ${sabahBaslangic} – ${sabahBitis}\nlightbox **Akşam:** ${aksamBaslangic} – ${aksamBitis}\n\n${kalanMesaj}`;

    return {
      text,
      card: {
        type: 'golden_hour',
        data: {
          sabahBaslangic, sabahBitis, aksamBaslangic, aksamBitis,
          sunsetRaw: sunset, sunriseRaw: sunrise,
        },
      },
    };
  } catch (e) {
    return {
      text: `📍 **Fethiye** altın saat verisine şu an ulaşılamadı. Genel kural: gündoğumu +1 saat ve günbatımı -1 saati altın ışık penceresidir.`,
      card: { type: 'tip', data: { title: 'Altın Saat', icon: '🌅' } },
    };
  }
}

// ─── İzin Geçmişi Fetch ───────────────────────────────────────────────────────

// ─── Bugün tüm izinliler (yönetici/müdür için) ───────────────────────────────

async function fetchBugunIzinliler(targetDate?: string): Promise<{ text: string; card?: ResponseCard }> {
  try {
    const [leaves, dailyOnLeave, staffMembers] = await Promise.all([
      getLeaveRequests(),
      getDailyOnLeave(),
      getStaffMembers(),
    ]);

    // Türkiye saati (UTC+3)
    const now = new Date();
    const trOffset = 3 * 60;
    const nowTR = new Date(now.getTime() + (trOffset - now.getTimezoneOffset()) * 60000);
    const todayStr = targetDate || nowTR.toISOString().split('T')[0];

    const izinliler: { ad: string; tip: string; kaynak: string; bas?: string; bit?: string; durum?: string }[] = [];
    const eklenenIds   = new Set<string>();  // auth user ID bazlı dedup
    const eklenenAdlar = new Set<string>();  // isim bazlı ek dedup (ID null/boş ise)

    const ekle = (id: string | undefined, ad: string, entry: typeof izinliler[0]) => {
      if (id && eklenenIds.has(id)) return;           // ID eşleşmesi
      if (eklenenAdlar.has(ad.toLowerCase().trim())) return; // isim eşleşmesi
      izinliler.push(entry);
      if (id) eklenenIds.add(id);
      eklenenAdlar.add(ad.toLowerCase().trim());
    };

    // Kaynak 1: Resmi izin talepleri (onaylı / bekleyen) — en yüksek öncelik
    for (const l of leaves) {
      if (l.status === 'rejected') continue;
      if (todayStr >= l.startDate && todayStr <= l.endDate) {
        const tip   = l.type === 'annual' ? 'Yıllık İzin' : l.type === 'sick' ? 'Hastalık' : l.type === 'personal' ? 'Mazeret' : 'İzin';
        const durum = l.status === 'approved' ? '✅' : '⏳';
        ekle(l.personnelId, l.personnelName, { ad: l.personnelName, tip, kaynak: 'resmi', bas: l.startDate, bit: l.endDate, durum });
      }
    }

    // Kaynak 2: Günlük manuel izin — sadece Kaynak 1'de olmayanlar
    const gunlukIds: string[] = Array.isArray(dailyOnLeave[todayStr]) ? dailyOnLeave[todayStr] : [];
    for (const sid of gunlukIds) {
      const staff = staffMembers.find(s => s.id === sid);
      const ad = staff?.name || sid;
      ekle(sid, ad, { ad, tip: 'Günlük İzin', kaynak: 'manuel', durum: '✅' });
    }

    // Kaynak 3: Sabit on_leave statüsü — sadece diğer kaynaklarda olmayanlar
    for (const s of staffMembers) {
      if (s.status === 'on_leave') {
        ekle(s.id, s.name, { ad: s.name, tip: 'Sabit İzin', kaynak: 'statü', durum: '🔴' });
      }
    }

    const tarihLabel = (() => {
      const now2 = new Date();
      const trOff = 3 * 60;
      const nowTR2 = new Date(now2.getTime() + (trOff - now2.getTimezoneOffset()) * 60000);
      const realToday = nowTR2.toISOString().split('T')[0];
      const realYesterday = new Date(nowTR2.getTime() - 86400000).toISOString().split('T')[0];
      if (todayStr === realToday) return 'Bugün';
      if (todayStr === realYesterday) return 'Dün';
      return todayStr;
    })();

    if (izinliler.length === 0) {
      return { text: `📅 **${tarihLabel}** (**${todayStr}**) izinli personel yok — tüm ekip aktif! 💪` };
    }

    const liste = izinliler.map(p => {
      const tarihStr = p.bas && p.bit && p.bas !== p.bit ? ` (${p.bas} → ${p.bit})` : p.bas ? ` (${p.bas})` : '';
      return `• ${p.durum} **${p.ad}** — ${p.tip}${tarihStr}`;
    }).join('\n');

    return {
      text: `📅 **${tarihLabel}** (**${todayStr}**) izinli **${izinliler.length} personel** var:\n${liste}`,
    };
  } catch (e) {
    console.error('fetchBugunIzinliler error:', e);
    return { text: 'İzin verilerine şu an ulaşılamadı. Lütfen daha sonra tekrar dene.' };
  }
}

// ─── İzin Geçmişi Fetch ───────────────────────────────────────────────────────

async function fetchIzinGecmisi(userId: string, userName: string): Promise<{ text: string; card: ResponseCard }> {
  try {
    const [leaves, dailyOnLeave, staffMembers] = await Promise.all([
      getLeaveRequests(),
      getDailyOnLeave(),
      getStaffMembers(),
    ]);

    // Türkiye saatini (UTC+3) baz alarak bugünü hesapla
    const now = new Date();
    const trOffset = 3 * 60;
    const nowTR = new Date(now.getTime() + (trOffset - now.getTimezoneOffset()) * 60000);

    // Son 7 gün (bugün dahil, geriye doğru) — YYYY-MM-DD
    const last7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(nowTR);
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    // Kullanıcının izin taleplerini filtrele
    const matchLeave = (l: LeaveRequest) => {
      if (userId && l.personnelId === userId) return true;
      if (!userId) {
        const nameLower = l.personnelName.toLowerCase().trim();
        const userLower = userName.toLowerCase().trim();
        return nameLower === userLower ||
          (nameLower.split(' ')[0] === userLower.split(' ')[0] &&
           nameLower.split(' ').pop() === userLower.split(' ').pop());
      }
      return false;
    };

    const myLeaves       = leaves.filter(matchLeave);
    const approvedLeaves = myLeaves.filter(l => l.status === 'approved');
    const pendingLeaves  = myLeaves.filter(l => l.status === 'pending');

    // Personelin sabit izin statüsü
    const staffMember    = staffMembers.find(s => s.id === userId);
    const isStatusOnLeave = staffMember?.status === 'on_leave';

    // Her gün için izinli mi? (3 kaynak)
    let leaveDayCount = 0;
    for (const dateStr of last7Days) {
      const isToday = dateStr === last7Days[0];

      // Kaynak 1: Onaylı izin talebi
      const inApproved = approvedLeaves.some(l => dateStr >= l.startDate && dateStr <= l.endDate);

      // Kaynak 2: Günlük manuel izin (rotation_daily_onleave)
      const inDaily = Array.isArray(dailyOnLeave[dateStr]) && dailyOnLeave[dateStr].includes(userId);

      // Kaynak 3: status === 'on_leave' — sadece bugün için güvenilir
      const inStatus = isToday && isStatusOnLeave;

      if (inApproved || inDaily || inStatus) leaveDayCount++;
    }

    const workDayCount = 7 - leaveDayCount;
    const todayStr     = last7Days[0];
    const todayInLeave = approvedLeaves.some(l => todayStr >= l.startDate && todayStr <= l.endDate)
      || (Array.isArray(dailyOnLeave[todayStr]) && dailyOnLeave[todayStr].includes(userId))
      || isStatusOnLeave;

    const text = leaveDayCount === 0
      ? `📅 Son 7 günde hiç izin kaydın yok — **${workDayCount} gün** aktif çalışma. 💪`
      : `📅 Son 7 günde **${workDayCount} gün çalışma**, **${leaveDayCount} gün izin** kaydın var.${pendingLeaves.length > 0 ? ` ⏳ ${pendingLeaves.length} adet onay bekleyen talep var.` : ''}`;

    return {
      text,
      card: {
        type: 'izin',
        data: { workDayCount, leaveDayCount, pendingLeaves, todayInLeave, userName, userId },
      },
    };
  } catch (e) {
    console.error('fetchIzinGecmisi error:', e);
    return {
      text: `İzin geçmişine şu an ulaşılamadı. Lütfen daha sonra tekrar dene.`,
      card: { type: 'tip', data: { title: 'İzin Geçmişi', icon: '📅' } },
    };
  }
}

// ─── AI Response Engine (gerçek KV verisi kullanır) ───────────────────────────

// ─── İndirim Analizi — kişi bazlı, tarihsel, oran sıralaması ────────────────
async function fetchIndirimAnalizi(soru: string): Promise<{ text: string }> {
  try {
    const lower = soru.toLowerCase();
    const headers = await authHeaders();

    // Tarih aralığı — son 30 gün varsayılan, aylık/haftalık destek
    const now = new Date();
    const trOffset = 3 * 60;
    const nowTR = new Date(now.getTime() + (trOffset - now.getTimezoneOffset()) * 60000);
    const todayStr = nowTR.toISOString().split('T')[0];

    let baslangic = '', bitis = todayStr, rangeLabel = 'son 30 gün';
    const AYLAR: Record<string, number> = {
      'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
      'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
    };
    const isGecen = lower.includes('geçen') || lower.includes('gecen');

    if (lower.includes('bugün') || lower.includes('bugun')) {
      baslangic = bitis = todayStr;
      rangeLabel = 'bugün';
    } else if (lower.includes('bu hafta') || lower.includes('geçen hafta') || lower.includes('gecen hafta')) {
      const p = new Date(nowTR);
      const g = p.getDay();
      const fark = (isGecen ? 7 : 0) + (g === 0 ? 6 : g - 1);
      p.setDate(p.getDate() - fark);
      baslangic = p.toISOString().split('T')[0];
      const pe = new Date(p); pe.setDate(pe.getDate() + 6);
      bitis = pe.toISOString().split('T')[0] > todayStr ? todayStr : pe.toISOString().split('T')[0];
      rangeLabel = isGecen ? 'geçen hafta' : 'bu hafta';
    } else {
      const ayAdi = Object.keys(AYLAR).find(a => lower.includes(a));
      if (lower.includes('bu ay') || lower.includes('geçen ay') || lower.includes('gecen ay') || ayAdi) {
        const ay = ayAdi ? AYLAR[ayAdi] : nowTR.getMonth();
        const gercekAy = (isGecen && !ayAdi) ? (ay === 0 ? 11 : ay - 1) : ay;
        const yil = (isGecen && !ayAdi && gercekAy === 11) ? nowTR.getFullYear() - 1 : nowTR.getFullYear();
        baslangic = `${yil}-${String(gercekAy + 1).padStart(2, '0')}-01`;
        const sonGun = new Date(yil, gercekAy + 1, 0).getDate();
        bitis = `${yil}-${String(gercekAy + 1).padStart(2, '0')}-${sonGun}`;
        if (bitis > todayStr) bitis = todayStr;
        rangeLabel = `${Object.keys(AYLAR)[gercekAy]} ${yil}`;
      } else {
        const otuz = new Date(nowTR); otuz.setDate(otuz.getDate() - 30);
        baslangic = otuz.toISOString().split('T')[0];
      }
    }

    const url = `${API_BASE}/personel/indirim-istatistik?baslangic=${baslangic}&bitis=${bitis}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return { text: `İndirim verisi alınamadı (${res.status}).` };
    const data = await res.json();
    const liste: any[] = data.personeller || [];

    if (liste.length === 0) {
      return { text: `📊 **${rangeLabel}** (${baslangic} → ${bitis}) için indirim verisi bulunamadı.` };
    }

    // Belirli kişi filtresi
    const kisiFiltreAday = liste.find((p: any) => lower.includes((p.name || '').toLowerCase().split(' ')[0]));

    if (kisiFiltreAday) {
      const p = kisiFiltreAday;
      const uzun = p.uzunDonem || {};
      const kisa = p.kisaDonem || {};
      return {
        text: `👤 **${p.name}** — ${rangeLabel} indirim analizi:\n` +
          `  • Uzun dönem: ${uzun.toplamSatis || 0} işlem | İndirim: ${uzun.indirimliSatisOrani || 0}% | Ort. indirim: %${uzun.ortalamaIndirimYuzde || 0} | Toplam ₺${Number(uzun.toplamIndirimTL || 0).toLocaleString('tr-TR')}\n` +
          `  • Son ${kisa.gun || 7} gün: ${kisa.toplamSatis || 0} işlem | İndirim: ${kisa.indirimliSatisOrani || 0}% | Ort. indirim: %${kisa.ortalamaIndirimYuzde || 0} | Toplam ₺${Number(kisa.toplamIndirimTL || 0).toLocaleString('tr-TR')}`
      };
    }

    // Sıralama türü belirle
    const sortByTL = lower.includes('toplam') || lower.includes('tutar') || lower.includes('tl') || lower.includes('lira');
    const sortBy = sortByTL ? 'toplamIndirimTL' : 'ortalamaIndirimYuzde';

    const sirali = [...liste].sort((a: any, b: any) => {
      const av = a.uzunDonem?.[sortBy] || 0;
      const bv = b.uzunDonem?.[sortBy] || 0;
      return bv - av;
    });

    const enCok = sirali[0];
    const enAz = sirali[sirali.length - 1];

    const satirlar = sirali.map((p: any, i: number) => {
      const u = p.uzunDonem || {};
      return `  ${i + 1}. **${p.name}**: %${u.ortalamaIndirimYuzde || 0} ort. oran | ${u.indirimliSatisOrani || 0}% işlemde indirim | ₺${Number(u.toplamIndirimTL || 0).toLocaleString('tr-TR')} toplam`;
    }).join('\n');

    return {
      text: `💸 **${rangeLabel}** personel indirim sıralaması (${sortByTL ? 'toplam TL' : 'oran'} bazlı):\n\n${satirlar}\n\n` +
        `🔴 En yüksek: **${enCok?.name}** (%${enCok?.uzunDonem?.ortalamaIndirimYuzde || 0})\n` +
        `🟢 En düşük: **${enAz?.name}** (%${enAz?.uzunDonem?.ortalamaIndirimYuzde || 0})`
    };
  } catch (e) {
    console.error('fetchIndirimAnalizi error:', e);
    return { text: 'İndirim analizi şu an kullanılamıyor.' };
  }
}

// ─── Anomali Analizi — tarihsel, mekan/tip bazlı (yönetici/müdür) ────────────
async function fetchAnomaliAnalizi(soru: string): Promise<{ text: string }> {
  try {
    const now = new Date();
    const trOffset = 3 * 60;
    const nowTR = new Date(now.getTime() + (trOffset - now.getTimezoneOffset()) * 60000);
    const todayStr = nowTR.toISOString().split('T')[0];
    const lower = soru.toLowerCase();

    const AYLAR: Record<string, number> = {
      'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
      'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
    };

    // Tarih aralığı belirle
    let baslangic = '', bitis = todayStr, rangeLabel = 'bugün';
    const isGecen = lower.includes('geçen') || lower.includes('gecen');

    if (lower.includes('dün') || lower.includes('dun')) {
      const dun = new Date(nowTR); dun.setDate(dun.getDate() - 1);
      baslangic = bitis = dun.toISOString().split('T')[0];
      rangeLabel = 'dün';
    } else if (lower.includes('bu hafta') || lower.includes('geçen hafta') || lower.includes('gecen hafta')) {
      const p = new Date(nowTR);
      const g = p.getDay();
      const fark = (isGecen ? 7 : 0) + (g === 0 ? 6 : g - 1);
      p.setDate(p.getDate() - fark);
      baslangic = p.toISOString().split('T')[0];
      const pe = new Date(p); pe.setDate(pe.getDate() + 6);
      bitis = pe.toISOString().split('T')[0] > todayStr ? todayStr : pe.toISOString().split('T')[0];
      rangeLabel = isGecen ? 'geçen hafta' : 'bu hafta';
    } else {
      const ayAdi = Object.keys(AYLAR).find(a => lower.includes(a));
      if (lower.includes('bu ay') || lower.includes('geçen ay') || lower.includes('gecen ay') || ayAdi) {
        const ay = ayAdi ? AYLAR[ayAdi] : nowTR.getMonth();
        const gercekAy = (isGecen && !ayAdi) ? (ay === 0 ? 11 : ay - 1) : ay;
        const yil = (isGecen && !ayAdi && gercekAy === 11) ? nowTR.getFullYear() - 1 : nowTR.getFullYear();
        baslangic = `${yil}-${String(gercekAy + 1).padStart(2, '0')}-01`;
        const sonGun = new Date(yil, gercekAy + 1, 0).getDate();
        bitis = `${yil}-${String(gercekAy + 1).padStart(2, '0')}-${sonGun}`;
        if (bitis > todayStr) bitis = todayStr;
        rangeLabel = `${Object.keys(AYLAR)[gercekAy]} ${yil}`;
      } else if (lower.includes('bu yıl') || lower.includes('bu yil')) {
        baslangic = `${nowTR.getFullYear()}-01-01`;
        rangeLabel = `${nowTR.getFullYear()} yılı`;
      } else {
        // Son 30 gün varsayılan
        const otuz = new Date(nowTR); otuz.setDate(otuz.getDate() - 30);
        baslangic = otuz.toISOString().split('T')[0];
        rangeLabel = 'son 30 gün';
      }
    }

    // API çağrısı
    const headers = await authHeaders();
    const url = `${API_BASE}/stok/anomali-raporu?baslangic=${baslangic}&bitis=${bitis}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return { text: `Anomali raporu alınamadı (${res.status}).` };
    const data = await res.json();

    const anomaliler: any[] = data.anomaliler || [];
    const ozet = data.ozet || {};

    if (anomaliler.length === 0) {
      return { text: `✅ **${rangeLabel}** (${baslangic}${bitis !== baslangic ? ` → ${bitis}` : ''}) için anomali kaydı bulunamadı.` };
    }

    // Tip filtresi
    const isYazici = lower.includes('yazıcı') || lower.includes('yazici');
    const isStok = lower.includes('stok anomali') && !isYazici;
    let filtrelenmis = anomaliler;
    if (isYazici) filtrelenmis = anomaliler.filter((a: any) => a.type.startsWith('yazici'));
    else if (isStok) filtrelenmis = anomaliler.filter((a: any) => !a.type.startsWith('yazici'));

    // En çok anomali olan mekan
    const mekanSayac: Record<string, number> = {};
    for (const a of filtrelenmis) {
      mekanSayac[a.mekan] = (mekanSayac[a.mekan] || 0) + 1;
    }
    const enCokMekan = Object.entries(mekanSayac).sort((a, b) => b[1] - a[1])[0];

    const typeLabel = (t: string) =>
      t === 'acilis' ? 'Açılış Stok' : t === 'kapanis' ? 'Kapanış Stok' :
      t === 'yazici_acilis' ? 'Yazıcı Açılış' : t === 'yazici_kapanis' ? 'Yazıcı Kapanış' : t;

    const liste = filtrelenmis.slice(0, 20).map((a: any) =>
      `  • ${a.tarih} ${a.mekanEmoji || '📍'} **${a.mekan}** — ${typeLabel(a.type)}: ${a.detailStr || '-'}`
    ).join('\n');

    const ozetStr = `Toplam: **${filtrelenmis.length} anomali** | Stok: ${ozet.stokAnomali || 0} | Yazıcı: ${ozet.yaziciAnomali || 0}`;

    return {
      text: `⚠️ **${rangeLabel}** anomali raporu (${baslangic}${bitis !== baslangic ? ` → ${bitis}` : ''}):\n${ozetStr}` +
        (enCokMekan ? `\nEn çok anomali: **${enCokMekan[0]}** (${enCokMekan[1]}x)` : '') +
        `\n\n${filtrelenmis.length > 20 ? `İlk 20 gösteriliyor (toplam ${filtrelenmis.length}):\n` : ''}${liste}`
    };
  } catch (e) {
    console.error('fetchAnomaliAnalizi error:', e);
    return { text: 'Anomali analizi şu an kullanılamıyor.' };
  }
}

// ─── Satış Analizi — ürün/albüm bazlı, tarihsel (yönetici/müdür) ─────────────
async function fetchSatisAnalizi(soru: string): Promise<{ text: string }> {
  try {
    const now = new Date();
    const trOffset = 3 * 60;
    const nowTR = new Date(now.getTime() + (trOffset - now.getTimezoneOffset()) * 60000);
    const todayStr = nowTR.toISOString().split('T')[0];
    const lower = soru.toLowerCase();

    const AYLAR: Record<string, number> = {
      'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
      'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
    };

    // Tarih aralığı belirle
    let baslangic = '', bitis = todayStr, rangeLabel = 'bugün';
    const isGecen = lower.includes('geçen') || lower.includes('gecen');

    if (lower.includes('bu hafta') || lower.includes('geçen hafta') || lower.includes('gecen hafta')) {
      const p = new Date(nowTR);
      const g = p.getDay();
      const fark = (isGecen ? 7 : 0) + (g === 0 ? 6 : g - 1);
      p.setDate(p.getDate() - fark);
      baslangic = p.toISOString().split('T')[0];
      const pe = new Date(p); pe.setDate(pe.getDate() + 6);
      bitis = pe.toISOString().split('T')[0] > todayStr ? todayStr : pe.toISOString().split('T')[0];
      rangeLabel = isGecen ? 'geçen hafta' : 'bu hafta';
    } else {
      const ayAdi = Object.keys(AYLAR).find(a => lower.includes(a));
      if (lower.includes('bu ay') || lower.includes('geçen ay') || lower.includes('gecen ay') || ayAdi) {
        const ay = ayAdi ? AYLAR[ayAdi] : nowTR.getMonth();
        const gercekAy = (isGecen && !ayAdi) ? (ay === 0 ? 11 : ay - 1) : ay;
        const yil = (isGecen && !ayAdi && gercekAy === 11) ? nowTR.getFullYear() - 1 : nowTR.getFullYear();
        baslangic = `${yil}-${String(gercekAy + 1).padStart(2, '0')}-01`;
        const sonGun = new Date(yil, gercekAy + 1, 0).getDate();
        bitis = `${yil}-${String(gercekAy + 1).padStart(2, '0')}-${sonGun}`;
        if (bitis > todayStr) bitis = todayStr;
        rangeLabel = `${Object.keys(AYLAR)[gercekAy]} ${yil}`;
      } else if (lower.includes('bu yıl') || lower.includes('bu yil')) {
        baslangic = `${nowTR.getFullYear()}-01-01`;
        rangeLabel = `${nowTR.getFullYear()} yılı`;
      } else {
        // Varsayılan: bugün
        baslangic = todayStr;
        rangeLabel = 'bugün';
      }
    }

    // API çağrısı
    const headers = await authHeaders();
    const url = `${API_BASE}/isletme/satis-raporu?baslangic=${baslangic}&bitis=${bitis}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return { text: 'Satış raporuna ulaşılamadı.' };
    const data = await res.json();

    const albumler: { tip: string; adet: number; ciro: number }[] = (data.albumler || data.albumListesi || []);
    const mekanlar: any[] = data.mekanlar || data.mekanListesi || [];
    const personel: any[] = data.personeller || data.personelListesi || [];
    const toplamCiro = data.toplamCiro || 0;
    const toplamSatis = data.toplamSatisAdet || 0;

    if (toplamSatis === 0) {
      return { text: `📊 **${rangeLabel}** (${baslangic}${bitis !== baslangic ? ` → ${bitis}` : ''}) için satış kaydı bulunamadı.` };
    }

    // Belirli ürün sorgusu
    const urunMatch = [
      { key: '3 kare', name: '3 Kare' }, { key: '5 kare', name: '5 Kare' },
      { key: '7 kare', name: '7 Kare' }, { key: '9 kare', name: '9 Kare' },
      { key: '11 kare', name: '11 Kare' }, { key: '13 kare', name: '13 Kare' },
      { key: '15 kare', name: '15 Kare' }, { key: 'ribon', name: 'Ribon' },
      { key: 'paspartu', name: 'Paspartu' },
    ].find(u => lower.includes(u.key));

    if (urunMatch) {
      const urun = albumler.find(a => a.tip.toLowerCase().includes(urunMatch.key) || a.tip.toLowerCase().includes(urunMatch.name.toLowerCase()));
      if (!urun) return { text: `📦 **${rangeLabel}** için **${urunMatch.name}** satışı bulunamadı.` };
      return {
        text: `📦 **${urunMatch.name}** — **${rangeLabel}**:\n• Satış adedi: **${urun.adet} adet**\n• Ciro: **₺${Number(urun.ciro).toLocaleString('tr-TR')}**\n• Birim başına ort.: **₺${urun.adet > 0 ? Math.round(urun.ciro / urun.adet).toLocaleString('tr-TR') : 0}**`
      };
    }

    // Genel ürün/albüm dökümü
    const albumStr = albumler.length > 0
      ? albumler.map((a, i) => `  ${i + 1}. **${a.tip}**: ${a.adet} adet — ₺${Number(a.ciro).toLocaleString('tr-TR')}`).join('\n')
      : '  Ürün detayı yok.';

    const mekanStr = mekanlar.slice(0, 5).map(m =>
      `  • ${m.emoji || '📍'} **${m.name}**: ${m.satisAdet} satış, ₺${Number(m.ciro).toLocaleString('tr-TR')}`
    ).join('\n');

    const personelStr = personel.slice(0, 5).map(p =>
      `  • **${p.name}**: ${p.satisAdet} satış, ₺${Number(p.ciro).toLocaleString('tr-TR')}`
    ).join('\n');

    return {
      text: `📊 **${rangeLabel}** satış raporu (${baslangic}${bitis !== baslangic ? ` → ${bitis}` : ''}):\n` +
        `Toplam: **${toplamSatis} satış** | **₺${Number(toplamCiro).toLocaleString('tr-TR')}** ciro\n\n` +
        `🛍️ Ürün bazlı:\n${albumStr}\n\n` +
        (mekanStr ? `📍 Mekan bazlı:\n${mekanStr}\n\n` : '') +
        (personelStr ? `👤 Personel:\n${personelStr}` : '')
    };
  } catch (e) {
    console.error('fetchSatisAnalizi error:', e);
    return { text: 'Satış analizi şu an kullanılamıyor.' };
  }
}

// ─── İzin Analizi — tarihsel/kişi/aylık/sıralama sorgular (yönetici) ─────────
async function fetchIzinAnalizi(soru: string, staffMembers: any[]): Promise<{ text: string }> {
  try {
    const [leaves, dailyOnLeave] = await Promise.all([getLeaveRequests(), getDailyOnLeave()]);
    const now = new Date();
    const trOffset = 3 * 60;
    const nowTR = new Date(now.getTime() + (trOffset - now.getTimezoneOffset()) * 60000);
    const todayStr = nowTR.toISOString().split('T')[0];
    const lower = soru.toLowerCase();

    const AYLAR: Record<string, number> = {
      'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
      'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
    };

    // İzin gün sayacı (approved + daily)
    const countLeaveDays = (id: string, rs: string, re: string) => {
      let days = 0;
      const d = new Date(rs); const end = new Date(re);
      while (d <= end) {
        const ds = d.toISOString().split('T')[0];
        const inL = leaves.some(l => l.personnelId === id && l.status === 'approved' && ds >= l.startDate && ds <= l.endDate);
        const inD = Array.isArray(dailyOnLeave[ds]) && dailyOnLeave[ds].includes(id);
        if (inL || inD) days++;
        d.setDate(d.getDate() + 1);
      }
      return days;
    };

    // Tarih tespit
    const tarihMatch = lower.match(/(\d{1,2})\s*(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/);
    const dunMatch   = lower.includes('dün') || lower.includes('dun');
    const haftaMatch = lower.includes('hafta');
    const ayAdi      = Object.keys(AYLAR).find(a => lower.includes(a));
    const ayMatch    = lower.includes('bu ay') || lower.includes('geçen ay') || lower.includes('gecen ay') || !!ayAdi;
    const isGecen    = lower.includes('geçen') || lower.includes('gecen');

    // Kişi tespit
    const staffMatch = staffMembers.find((s: any) =>
      lower.includes(s.name.toLowerCase().split(' ')[0]) || lower.includes(s.name.toLowerCase())
    );

    // Yardımcı: ay aralığı
    const ayAraligi = (adı?: string, gecen = false) => {
      const ayIdx = adı ? AYLAR[adı] : nowTR.getMonth();
      const gercek = gecen ? (ayIdx === 0 ? 11 : ayIdx - 1) : ayIdx;
      const yil    = gecen && gercek === 11 ? nowTR.getFullYear() - 1 : nowTR.getFullYear();
      const rs = `${yil}-${String(gercek + 1).padStart(2, '0')}-01`;
      const re = `${yil}-${String(gercek + 1).padStart(2, '0')}-${new Date(yil, gercek + 1, 0).getDate()}`;
      const label = `${Object.keys(AYLAR)[gercek].charAt(0).toUpperCase() + Object.keys(AYLAR)[gercek].slice(1)} ${yil}`;
      return { rs, re: re > todayStr ? todayStr : re, label };
    };

    // Yardımcı: hafta aralığı
    const haftaAraligi = (gecen = false) => {
      const p = new Date(nowTR);
      const g = p.getDay(); const fark = (gecen ? 7 : 0) + (g === 0 ? 6 : g - 1);
      p.setDate(p.getDate() - fark);
      const rs = p.toISOString().split('T')[0];
      const pe = new Date(p); pe.setDate(pe.getDate() + 6);
      const re = pe.toISOString().split('T')[0] > todayStr ? todayStr : pe.toISOString().split('T')[0];
      return { rs, re, label: gecen ? 'Geçen hafta' : 'Bu hafta' };
    };

    // ── Belirli gün (dün / tarih) ──
    if (dunMatch || tarihMatch) {
      let hedef = todayStr;
      if (dunMatch) { const d = new Date(nowTR); d.setDate(d.getDate() - 1); hedef = d.toISOString().split('T')[0]; }
      else if (tarihMatch) {
        const gun = parseInt(tarihMatch[1]); const ay = AYLAR[tarihMatch[2]];
        hedef = `${nowTR.getFullYear()}-${String(ay + 1).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
      }
      const gunlukIds: string[] = Array.isArray(dailyOnLeave[hedef]) ? dailyOnLeave[hedef] : [];
      const izinliler: string[] = []; const ek = new Set<string>();
      for (const l of leaves) {
        if (l.status === 'rejected') continue;
        if (hedef >= l.startDate && hedef <= l.endDate) {
          const tip = l.type === 'annual' ? 'Yıllık' : l.type === 'sick' ? 'Hastalık' : 'Mazeret';
          izinliler.push(`**${l.personnelName}** (${tip}${l.status === 'pending' ? ' ⏳' : ' ✅'})`);
          ek.add(l.personnelId);
        }
      }
      for (const sid of gunlukIds) { if (!ek.has(sid)) { const s = staffMembers.find((x: any) => x.id === sid); izinliler.push(`**${s?.name || sid}** (Günlük)`); } }
      if (!izinliler.length) return { text: `📅 **${hedef}** tarihinde izinli personel yok.` };
      return { text: `📅 **${hedef}** tarihinde **${izinliler.length} kişi** izinliydi:\n${izinliler.map(x => `• ${x}`).join('\n')}` };
    }

    // ── Belirli kişi ──
    if (staffMatch) {
      let rs = `${nowTR.getFullYear()}-01-01`, re = todayStr, label = `${nowTR.getFullYear()} yılı`;
      if (haftaMatch) { const r = haftaAraligi(isGecen); rs = r.rs; re = r.re; label = r.label; }
      else if (ayMatch) { const r = ayAraligi(ayAdi, isGecen && !ayAdi); rs = r.rs; re = r.re; label = r.label; }

      const gun = countLeaveDays(staffMatch.id, rs, re);
      const approved = leaves.filter(l => l.personnelId === staffMatch.id && l.status === 'approved' && l.startDate >= rs && l.startDate <= re);
      const pending  = leaves.filter(l => l.personnelId === staffMatch.id && l.status === 'pending' && l.startDate >= todayStr);
      const detay = approved.slice(-5).reverse().map(l => {
        const tip = l.type === 'annual' ? 'Yıllık' : l.type === 'sick' ? 'Hastalık' : 'Mazeret';
        return `  • ${l.startDate}${l.endDate !== l.startDate ? ` → ${l.endDate}` : ''}: ${tip} (${l.days} gün)`;
      }).join('\n');
      return {
        text: `📊 **${staffMatch.name}** — ${label}:\n• Toplam izin günü: **${gun} gün**\n• Onaylı talep: **${approved.length}**\n` +
          (pending.length ? `• Bekleyen: **${pending.length}** ⏳\n` : '') +
          (detay ? `\nİzinler:\n${detay}` : '')
      };
    }

    // ── Genel dönem özeti ──
    if (haftaMatch || ayMatch) {
      let rs = '', re = '', label = '';
      if (haftaMatch) { const r = haftaAraligi(isGecen); rs = r.rs; re = r.re; label = r.label; }
      else { const r = ayAraligi(ayAdi, isGecen && !ayAdi); rs = r.rs; re = r.re; label = r.label; }

      const personelIzin: { ad: string; gun: number }[] = [];
      for (const s of staffMembers) {
        const gun = countLeaveDays(s.id, rs, re);
        if (gun > 0) personelIzin.push({ ad: s.name, gun });
      }
      personelIzin.sort((a, b) => b.gun - a.gun);
      if (!personelIzin.length) return { text: `📅 **${label}** aralığında izin kaydı yok.` };
      const toplam = personelIzin.reduce((s, p) => s + p.gun, 0);
      return { text: `📊 **${label}** — toplam **${toplam} gün** izin:\n${personelIzin.map(p => `  • **${p.ad}**: ${p.gun} gün`).join('\n')}` };
    }

    // ── Sıralama ──
    if (lower.includes('en çok') || lower.includes('en cok') || lower.includes('sıralama') || lower.includes('siralama')) {
      const yil = nowTR.getFullYear(); const rs = `${yil}-01-01`;
      const rank: { ad: string; gun: number }[] = [];
      for (const s of staffMembers) { const gun = countLeaveDays(s.id, rs, todayStr); if (gun > 0) rank.push({ ad: s.name, gun }); }
      rank.sort((a, b) => b.gun - a.gun);
      if (!rank.length) return { text: `Bu yıl henüz onaylı izin kaydı yok.` };
      return { text: `🏆 **${yil} yılı izin sıralaması:**\n${rank.slice(0, 10).map((p, i) => `  ${i + 1}. **${p.ad}**: ${p.gun} gün`).join('\n')}` };
    }

    // ── Bekleyen talepler ──
    if (lower.includes('bekle') || lower.includes('onay')) {
      const pending = leaves.filter(l => l.status === 'pending' && l.endDate >= todayStr);
      if (!pending.length) return { text: `✅ Onay bekleyen izin talebi yok.` };
      return { text: `⏳ **${pending.length} bekleyen** talep:\n${pending.map(l => `  • **${l.personnelName}**: ${l.startDate}${l.endDate !== l.startDate ? ` → ${l.endDate}` : ''} (${l.days} gün)`).join('\n')}` };
    }

    // ── Fallback ──
    const yil = nowTR.getFullYear();
    const approved = leaves.filter(l => l.status === 'approved' && l.startDate >= `${yil}-01-01`);
    const pending  = leaves.filter(l => l.status === 'pending');
    return {
      text: `📅 **${yil} izin özeti:** ${approved.length} onaylı talep, toplam **${approved.reduce((s, l) => s + (l.days || 0), 0)} gün**. Bekleyen: **${pending.length}**.\n\nSorabileceklerin: "Dün kim izindi?", "Mart ayında kim kaç gün izin aldı?", "Bu ay en çok kim izin kullandı?"`
    };
  } catch (e) {
    console.error('fetchIzinAnalizi error:', e);
    return { text: 'İzin analizi şu an kullanılamıyor.' };
  }
}

function generateAIResponse(q: string, role: string, ozet: AIOzet | null, configMap?: Record<string, RoleConfig>): { text: string; card?: ResponseCard } | 'GOLDEN_HOUR' | 'IZIN_GECMISI' | 'BUGUN_IZINLILER' | 'DUN_IZINLILER' | 'IZIN_ANALIZI' | 'SATIS_ANALIZI' | 'ANOMALI_ANALIZI' | 'INDIRIM_ANALIZI' | 'LEAVE_REQUEST' | 'LEAVE_CONFIRM' | 'ROTATION_CREATE' | 'ROTATION_CANCEL' | 'ROTATION_SUGGEST' {
  const lower = q.toLowerCase();
  const map = configMap ?? ROLE_CONFIG;
  const config = map[role] ?? ROLE_CONFIG['personel'];
  const isAdmin = config.loadOzet;

  // Altın saat — async flag döndür
  if (lower.includes('altın saat') || lower.includes('altin saat') || lower.includes('golden hour') || lower.includes('gün batımı saati') || lower.includes('günbatımı')) {
    return 'GOLDEN_HOUR';
  }

  // İzin talebi — chip ile direk başlat
  if (q === '__LEAVE_REQUEST__' || q === '__LEAVE_CONFIRM_YES__') {
    return 'LEAVE_REQUEST';
  }

  // İzin talebi — yazı ile gelirse önce onay sor
  if (
    lower.includes('izin almak') || lower.includes('izin talep') ||
    lower.includes('izin istiyorum') || lower.includes('izin vermek') ||
    lower.includes('izin başvur') || lower.includes('izin talebinde') ||
    lower.includes('izin açmak') || lower.includes('izin almak istiyorum') ||
    lower.includes('izin oluştur') || lower.includes('izin açmak istiyorum')
  ) {
    return 'LEAVE_CONFIRM';
  }

  // Rotasyon iptal
  if (
    isAdmin && q !== '__ROT_CREATE__' && q !== '__ROT_SUGGEST__' && (
      (lower.includes('iptal') && (lower.includes('rotasyon') || lower.includes('görev') || lower.includes('vardiya'))) ||
      (lower.includes('sil') && (lower.includes('rotasyon') || lower.includes('görev'))) ||
      lower.includes('görevi kaldır') || lower.includes('rotasyonu kaldır')
    )
  ) {
    return 'ROTATION_CANCEL';
  }

  // Rotasyon önerisi / müsait personel
  if (
    isAdmin && (
      q === '__ROT_SUGGEST__' ||
      lower.includes('rotasyon öner') || lower.includes('otomatik rotasyon') ||
      lower.includes('otomatik dağıt') || lower.includes('kim müsait') ||
      lower.includes('müsait personel') || lower.includes('bugün müsait') ||
      lower.includes('yarın müsait') || lower.includes('rotasyon planla') ||
      (lower.includes('öner') && lower.includes('rotasyon')) ||
      lower.includes('bugünlük plan öner') || lower.includes('yarınki plan öner')
    )
  ) {
    return 'ROTATION_SUGGEST';
  }

  // Rotasyon oluşturma
  if (
    isAdmin && (
      q === '__ROT_CREATE__' ||
      lower.includes('rotasyon oluştur') || lower.includes('görev oluştur') ||
      lower.includes('vardiya oluştur') || lower.includes('atama yap') ||
      lower.includes('personel ata') || lower.includes('ai rotasyon') ||
      (lower.includes('gönder') && (lower.includes('personel') || lower.includes('mekan') || lower.includes('kim'))) ||
      lower.includes('bugün kim gitsin') || lower.includes('yarın kim gitsin') ||
      (lower.includes('sokağa gönder') || lower.includes('mekana gönder')) ||
      lower.includes('rotasyon yaz') || lower.includes('yeni rotasyon')
    )
  ) {
    return 'ROTATION_CREATE';
  }

  // Bugün izinliler
  if (
    isAdmin && (
      (lower.includes('bugün') || lower.includes('bugun')) &&
      (lower.includes('izin') || lower.includes('izinde') || lower.includes('izinli'))
    )
  ) {
    return 'BUGUN_IZINLILER';
  }

  // Dün izinliler
  if (
    isAdmin && (
      (lower.includes('dün') || lower.includes('dun')) &&
      (lower.includes('izin') || lower.includes('izinde') || lower.includes('izinli') ||
       lower.includes('göster') || lower.includes('goster') || lower.includes('kim'))
    )
  ) {
    return 'DUN_IZINLILER';
  }

  // Tarihsel izin analizi — yönetici/müdür: geçmiş, belirli kişi, ay, hafta, sıralama
  if (
    isAdmin && (
      lower.includes('dün') || lower.includes('dun') ||
      lower.includes('geçen hafta') || lower.includes('gecen hafta') ||
      lower.includes('bu hafta') ||
      lower.includes('geçen ay') || lower.includes('gecen ay') || lower.includes('bu ay') ||
      lower.includes('bu yıl') || lower.includes('bu yil') ||
      lower.includes('en çok izin') || lower.includes('en cok izin') ||
      lower.includes('izin sırala') || lower.includes('izin siralama') ||
      lower.includes('izin ranking') ||
      lower.includes('onay bekle') || lower.includes('bekleyen izin') ||
      (lower.includes('izin') && lower.includes('kaç gün')) ||
      (lower.includes('izin') && lower.includes('kaç kişi')) ||
      (lower.includes('izin') && lower.includes('kim')) ||
      (lower.includes('izin') && (
        lower.includes('ocak') || lower.includes('şubat') || lower.includes('mart') ||
        lower.includes('nisan') || lower.includes('mayıs') || lower.includes('haziran') ||
        lower.includes('temmuz') || lower.includes('ağustos') || lower.includes('eylül') ||
        lower.includes('ekim') || lower.includes('kasım') || lower.includes('aralık')
      ))
    )
  ) {
    return 'IZIN_ANALIZI';
  }

  // İzin geçmişi (kişisel) — async flag döndür
  if (q === '__IZIN_GECMISIM__' || lower.includes('izin geçmişim') || lower.includes('izin geçmiş') || lower.includes('kaç gün izin aldım') || lower.includes('ne kadar izin') || lower.includes('izin istatistik') || lower.includes('çalışma geçmiş')) {
    return 'IZIN_GECMISI';
  }

  // İndirim analizi — kişi bazlı, tarihsel, oran karşılaştırma (yönetici/müdür)
  if (
    isAdmin && (
      lower.includes('indirim') || lower.includes('iskonto') ||
      lower.includes('indirimli') || lower.includes('indirim oranı') ||
      lower.includes('kimin indirim') || lower.includes('indirim kim') ||
      lower.includes('en çok indirim') || lower.includes('en cok indirim') ||
      lower.includes('indirim istatistik') || lower.includes('indirim raporu') ||
      lower.includes('indirim sırala') || lower.includes('indirim ranking') ||
      lower.includes('discount')
    )
  ) {
    return 'INDIRIM_ANALIZI';
  }

  // Anomali analizi — tarihsel, mekan bazlı, detaylı (yönetici/müdür)
  if (
    isAdmin && (
      lower.includes('anomali geçmiş') || lower.includes('anomali gecmis') ||
      lower.includes('geçen hafta anomali') || lower.includes('bu hafta anomali') ||
      lower.includes('bu ay anomali') || lower.includes('geçen ay anomali') ||
      lower.includes('toplam anomali') || lower.includes('kaç anomali') ||
      lower.includes('hangi mekan anomali') || lower.includes('en çok anomali') ||
      lower.includes('en cok anomali') || lower.includes('anomali raporu') ||
      lower.includes('yazıcı anomali') || lower.includes('yazici anomali') ||
      lower.includes('stok anomali') ||
      (lower.includes('anomali') && (
        lower.includes('ocak') || lower.includes('şubat') || lower.includes('mart') ||
        lower.includes('nisan') || lower.includes('mayıs') || lower.includes('haziran') ||
        lower.includes('temmuz') || lower.includes('ağustos') || lower.includes('eylül') ||
        lower.includes('ekim') || lower.includes('kasım') || lower.includes('aralık') ||
        lower.includes('dün') || lower.includes('hafta') || lower.includes('ay')
      ))
    )
  ) {
    return 'ANOMALI_ANALIZI';
  }

  // Satış analizi — ürün/albüm bazlı veya tarihsel (yönetici/müdür)
  if (
    isAdmin && (
      lower.includes('albüm') || lower.includes('album') ||
      lower.includes('kare satı') || lower.includes('ürün satı') ||
      lower.includes('hangi ürün') || lower.includes('hangi albüm') ||
      lower.includes('en çok satan') || lower.includes('en cok satan') ||
      lower.includes('satış raporu') || lower.includes('satis raporu') ||
      lower.includes('geçen hafta satış') || lower.includes('bu hafta satış') ||
      lower.includes('bu ay satış') || lower.includes('geçen ay satış') ||
      lower.includes('satış geçmiş') || lower.includes('satis gecmis') ||
      lower.includes('toplam satış') || lower.includes('günlük satış') ||
      lower.includes('satış dökümü') || lower.includes('ürün bazlı')
    )
  ) {
    return 'SATIS_ANALIZI';
  }

  // Rol bazlı erişim engeli
  if (config.blockedKeywords.length > 0 && config.blockedKeywords.some(k => lower.includes(k))) {
    return { text: config.blockedMessage };
  }

  // Veri yok durumu
  if (!ozet) {
    return {
      text: isAdmin
        ? `Şu an gerçek veri y��klenemedi. Demo modundayım. Bağlantı sorunu yaşanıyor olabilir — sayfayı yenileyerek tekrar deneyebilirsin.`
        : `Şu an veriye ulaşamıyorum. Stok durumu, fiyatlar veya çekim ipuçları hakkında soru sorabilirsin!`,
    };
  }

  const d = ozet;
  const bestMekan = [...d.mekanlar].sort((a, b) => b.ciro - a.ciro)[0];

  // Günlük özet
  if (lower.includes('özet') || lower.includes('genel') || lower.includes('nasıl geçti') || lower.includes('operasyon')) {
    if (d.mekanSayisi === 0) {
      return {
        text: `**${d.tarihTR}** için henüz aktif vardiya kaydı yok. Vardiya açılışı yapıldığında satış ve stok verileri burada görünecek.`,
      };
    }
    const toplamItemAdet = (d.albumSatisDokumu || []).reduce((s: number, a: any) => s + a.adet, 0);
    return {
      text: `**${d.tarihTR}** — **${d.mekanSayisi} mekanda** toplam **${d.toplamSatisAdet} işlem** (**${toplamItemAdet} ürün**) gerçekleşti. ${bestMekan ? `En yüksek ciro **${bestMekan.emoji} ${bestMekan.name}** mekanından (₺${bestMekan.ciro.toLocaleString('tr-TR')}).` : ''} ${d.anomaliler.length > 0 ? `⚠️ **${d.anomaliler.length} anomali** dikkat bekliyor.` : ''}`,
      card: { type: 'briefing', data: d },
    };
  }

  // Ciro / kâr
  if (lower.includes('ciro') || lower.includes('kâr') || lower.includes('kar') || lower.includes('kazandık') || lower.includes('gelir')) {
    if (d.toplamCiro === 0) {
      return {
        text: `**${d.tarihTR}** için henüz kayıtlı satış yok. Vardiya açılışı yapıldığında veriler burada görünecek.`,
      };
    }
    return {
      text: `**${d.tarihTR}** ciro: **₺${d.toplamCiro.toLocaleString('tr-TR')}** — ${d.toplamSatisAdet} işlemden elde edildi${d.toplamIskonto > 0 ? `, iskonto: **₺${d.toplamIskonto.toLocaleString('tr-TR')}** (liste fiyatı ₺${(d.toplamCiro + d.toplamIskonto).toLocaleString('tr-TR')})` : ''}. ${bestMekan ? `En iyi mekan **${bestMekan.emoji} ${bestMekan.name}** ile ₺${bestMekan.ciro.toLocaleString('tr-TR')}.` : ''}`,
      card: { type: 'profit', data: d },
    };
  }

  // Stok
  if (lower.includes('stok')) {
    const kritik = d.stokDurum.filter(s => s.status === 'kritik');
    const az = d.stokDurum.filter(s => s.status === 'az');
    const hepsiBos = d.stokDurum.every(s => s.count === 0);

    if (hepsiBos) {
      return {
        text: `Bugün için stok verisi henüz girilmemiş. Vardiya açılışında fiziksel sayım yapıldığında stok verileri burada görünecek.`,
        card: { type: 'stock', data: d.stokDurum },
      };
    }
    return {
      text: kritik.length > 0
        ? `⚠️ **Kritik stok uyarısı:** **${kritik.map(s => s.name).join(', ')}** bitmek üzere! ${az.length > 0 ? `Ayrıca **${az.map(s => s.name).join(', ')}** de azalmış.` : ''} Hemen sipariş ver!`
        : az.length > 0
          ? `Stok genel iyi durumda. **${az.map(s => s.name).join(', ')}** biraz azalmış — takipte tut.`
          : `Tüm ürünler yeterli seviyede. 👍`,
      card: { type: 'stock', data: d.stokDurum },
    };
  }

  // Mekan detay / kira bilgisi (KV motoru — hızlı cevap, admin/yönetici)
  if (
    isAdmin && (
      lower.includes('kira') || lower.includes('mekan bilgi') ||
      lower.includes('tam sayfa') || lower.includes('yarım sayfa') ||
      lower.includes('baskı tipi') || lower.includes('fotoğraf fiyatı') ||
      lower.includes('çalışma saati') || lower.includes('mekanlar hakkında') ||
      lower.includes('mekan detay') || lower.includes('mekan özellikleri')
    ) && !lower.includes('indirim') && !lower.includes('anomali')
  ) {
    const mekanlar = d.mekanlar || [];
    if (mekanlar.length === 0) {
      return { text: `Mekan verisi henüz yüklenemedi. AI modunu açık tutarak daha detaylı bilgi alabilirsin.` };
    }
    // Mekanlar listesi — sadece bugünkü operasyonel veri var, detaylar için GPT gerekli
    return {
      text: `📍 Bu soru için **mekan detay bilgileri** (kira, baskı tipi, fotoğraf fiyatı) GPT-4o mini üzerinden yanıtlanabilir — şu an **${mekanlar.length} aktif mekanda** operasyon devam ediyor.\n\nAI modunu açık bırakarak aynı soruyu sor; kira, baskı tipi ve tüm detayları verebilirim! 🔍`,
      card: { type: 'briefing', data: d },
    };
  }

  // Fiyat listesi (KV motoru — kısa cevap)
  if (
    isAdmin && (
      lower.includes('fiyat listesi') || lower.includes('fiyat listemi') ||
      lower.includes('albüm fiyat') || lower.includes('album fiyat') ||
      lower.includes('kaç kare ne kadar') || lower.includes('ürün fiyatı') ||
      lower.includes('ribon fiyat') || lower.includes('paspartu fiyat')
    )
  ) {
    return {
      text: `💲 Fiyat listeleri mekan bazlı (photoPrice × kare adedi) belirlenir. AI modunu açık bırakarak sorduğunda her mekanın tam fiyat tablosunu görebilirsin. 📊`,
    };
  }

  // Maliyet / malzeme sorguları (KV motoru — kısa cevap)
  if (
    isAdmin && (
      lower.includes('maliyet') || lower.includes('malzeme') ||
      lower.includes('kağıt fiyatı') || lower.includes('sabit gider') ||
      lower.includes('aylık gider') || lower.includes('maas') || lower.includes('maaş') ||
      lower.includes('döviz kuru') || lower.includes('kur bilgisi') ||
      lower.includes('albüm maliyeti') || lower.includes('üretim maliyet')
    )
  ) {
    return {
      text: `⚙️ Maliyet verileri (albüm üretim maliyetleri, kağıt, giderler, maaşlar) AI üzerinden detaylı yanıtlanır. AI modunu açık bırakarak "Aylık sabit giderlerimiz ne kadar?" veya "7 kare albümün maliyeti ne?" diye sorabilirsin. 📊`,
    };
  }

  // Anomali (bugün — detaylı)
  if (lower.includes('anomali') || lower.includes('sorun') || lower.includes('uyarı') || lower.includes('problem')) {
    if (d.anomaliler.length === 0) {
      return {
        text: `✅ Bugün hiç anomali tespit edilmedi! Tüm mekanlar stok uyumlu çalışıyor.`,
        card: { type: 'anomaly', data: [] },
      };
    }
    const typeLabel = (t: string) =>
      t === 'acilis' ? 'Açılış Stok' : t === 'kapanis' ? 'Kapanış Stok' :
      t === 'yazici_acilis' ? 'Yazıcı Açılış' : t === 'yazici_kapanis' ? 'Yazıcı Kapanış' : t;
    const stokAnom = d.anomaliler.filter(a => !a.type.startsWith('yazici'));
    const yaziciAnom = d.anomaliler.filter(a => a.type.startsWith('yazici'));
    const detaylar = d.anomaliler.map(a =>
      `  • ${a.mekanEmoji} **${a.mekan}** — ${typeLabel(a.type)}${(a as any).detailStr ? `: ${(a as any).detailStr}` : ''}`
    ).join('\n');
    return {
      text: `⚠️ Bugün **${d.anomaliler.length} anomali** tespit edildi` +
        (stokAnom.length ? ` (${stokAnom.length} stok` : '') +
        (yaziciAnom.length ? `, ${yaziciAnom.length} yazıcı)` : (stokAnom.length ? ')' : '')) +
        `:\n${detaylar}`,
      card: { type: 'anomaly', data: d.anomaliler },
    };
  }

  // En iyi mekan
  if (lower.includes('en iyi') && (lower.includes('mekan') || lower.includes('lokasyon') || lower.includes('yer'))) {
    if (!bestMekan) {
      return { text: `Bugün için mekan verisi henüz yok.` };
    }
    return {
      text: `Bugünün şampiyonu **${bestMekan.emoji} ${bestMekan.name}**! ₺${bestMekan.ciro.toLocaleString('tr-TR')} ciro ile ${bestMekan.satisAdet} satış yaptı.${bestMekan.kapanisYapildi ? ' Vardiya kapanışı tamamlandı.' : ' Vardiya devam ediyor.'}`,
      card: { type: 'briefing', data: d },
    };
  }

  // İndirim — bugün, kişi/oran bazlı
  if (lower.includes('indirim') || lower.includes('iskonto')) {
    if (d.personelSiralama.length === 0 || d.toplamIskonto === 0) {
      return { text: `Bugün hiç indirimli satış yapılmamış. Tüm satışlar liste fiyatından gerçekleşmiş.` };
    }
    const sirali = [...d.personelSiralama]
      .filter((p: any) => (p.iskonto || 0) > 0)
      .sort((a: any, b: any) => (b.indirimOrani || 0) - (a.indirimOrani || 0));
    if (sirali.length === 0) {
      return { text: `Bugün indirimli satış yapan personel yok.` };
    }
    const liste = sirali.map((p: any) =>
      `  • **${p.ad}**: %${p.indirimOrani || 0} ort. oran | ₺${Number(p.iskonto || 0).toLocaleString('tr-TR')} iskonto / ₺${Number(p.brutoCiro || p.ciro).toLocaleString('tr-TR')} brüt`
    ).join('\n');
    const enCok = sirali[0];
    return {
      text: `💸 Bugün toplam **₺${d.toplamIskonto.toLocaleString('tr-TR')} iskonto** verildi (brüt ₺${(d.toplamCiro + d.toplamIskonto).toLocaleString('tr-TR')} → net ₺${d.toplamCiro.toLocaleString('tr-TR')}).\n\nPersonel indirim sıralaması:\n${liste}\n\n🔴 En yüksek oran: **${enCok.ad}** (%${enCok.indirimOrani || 0})`,
      card: { type: 'personnel', data: d },
    };
  }

  // Personel
  if (lower.includes('personel') || lower.includes('çalışan') || lower.includes('en iyi kimdi')) {
    if (d.personelSiralama.length === 0) {
      return { text: `Bugün için personel satış verisi henüz yok.` };
    }
    const best = d.personelSiralama[0];
    return {
      text: `Bugünün en iyi performansı **${best.ad}** — **${best.satis} satış** ile **₺${best.ciro.toLocaleString('tr-TR')}** ciro sağladı. Harika bir gün!`,
      card: { type: 'personnel', data: d },
    };
  }

  // Ödeme dağılımı
  if (lower.includes('ödeme') || lower.includes('kart') || lower.includes('nakit') || lower.includes('dağılım')) {
    const od = d.odemeDagilimi;
    const toplam = od.cash + od.card + od.iban + od.foreign;
    if (toplam === 0) {
      return { text: `Bugün için ödeme verisi henüz yok.` };
    }
    const pct = (v: number) => toplam > 0 ? Math.round(v / toplam * 100) : 0;
    return {
      text: `Ödeme dağılımı: 💵 Nakit **%${pct(od.cash)}** (₺${od.cash.toLocaleString('tr-TR')}), 💳 Kart **%${pct(od.card)}** (₺${od.card.toLocaleString('tr-TR')}), 🏦 IBAN **%${pct(od.iban)}** (₺${od.iban.toLocaleString('tr-TR')})${od.foreign > 0 ? `, 💱 Döviz **%${pct(od.foreign)}**` : ''}.`,
      card: { type: 'payment', data: { odemeDagilimi: od, toplam } },
    };
  }

  // Albüm/ürün bazlı satış — bugün (KV ozet'ten)
  if (
    lower.includes('albüm') || lower.includes('album') ||
    lower.includes('hangi ürün') || lower.includes('hangi albüm') ||
    lower.includes('ürün bazlı') || lower.includes('satış dökümü') ||
    lower.includes('en çok satan') || lower.includes('en cok satan') ||
    (lower.includes('kare') && lower.includes('satı'))
  ) {
    const dok = d.albumSatisDokumu;
    if (!dok || dok.length === 0) {
      return { text: `Bugün için ürün bazlı satış kaydı henüz yok.` };
    }
    const liste = dok.map((a, i) => `  ${i + 1}. **${a.product}**: ${a.adet} adet — ₺${Number(a.ciro).toLocaleString('tr-TR')}`).join('\n');
    const enCok = dok[0];
    return {
      text: `🛍️ Bugün ürün bazlı satış dökümü:\n${liste}\n\nEn çok satan: **${enCok.product}** (${enCok.adet} adet)`,
    };
  }

  // Kare (albüm karışıklığı için önce albüm kontrolü yapıldı, sonra kare)
  if (lower.includes('kare') || lower.includes('fotoğraf') || lower.includes('çekim sayısı')) {
    return {
      text: d.toplamKare > 0
        ? `Bugün toplam **${d.toplamKare} kare** çekildi.`
        : `Bugün için kare kaydı henüz yok.`,
    };
  }

  // Portre / çekim ipuçları
  if (lower.includes('portre') || lower.includes('ipucu') || lower.includes('çekim')) {
    return {
      text: '📸 Portre için: ISO 100–400, diyafram f/2.8–5.6, enstantane 1/125–1/250. **Altın saat** (gündoğumu/batımı) mükemmel ışık verir. Gözlere odaklan, doğal ışığı arkada bırak!',
      card: { type: 'tip', data: { title: 'Çekim İpuçları', icon: '📸' } },
    };
  }

  // Satış nasıl
  if (lower.includes('nasıl satış') || lower.includes('satış kayıt') || lower.includes('kayıt')) {
    return {
      text: '🛒 Satış kaydı: **QuickSales** tab\'ına git → Mekan seç → Albüm tipini seç → Adet gir → İskonto varsa uygula → Ödeme yöntemini seç → Onayla. Dövizli ödeme için USD/EUR/GBP butonlarını kullan!',
      card: { type: 'tip', data: { title: 'Satış Süreci', icon: '🛒' } },
    };
  }

  // Default — role göre yönlendirme
  const chipLabels = config.chips.map(c => c.label).join(', ');
  return {
    text: `"${q}" hakkında elimdeki verilere göre yardımcı olmaya çalışayım. Kestirmeler arasından seçim yapabilirsin: ${chipLabels}.`,
  };
}

// ─── Markdown renderer (bold **text**) ────────────────────────────────────────

function renderMD(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function renderMDLines(text: string) {
  return text.split('\n').map((line, i) => (
    <span key={i}>
      {renderMD(line)}
      {i < text.split('\n').length - 1 && <br />}
    </span>
  ));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
        <Brain className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white/8 border border-white/12 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
    </div>
  );
}

function BriefingCard({ data }: { data: AIOzet }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? data.mekanlar : data.mekanlar.slice(0, 2);
  return (
    <div className="mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden">
      <div className="grid grid-cols-3 gap-px bg-white/8 border-b border-white/8">
        {[
          { label: 'Ciro', val: `₺${(data.toplamCiro / 1000).toFixed(1)}K`, color: '#4ade80' },
          { label: 'Satış', val: `${data.toplamSatisAdet}`, color: '#a78bfa' },
          { label: 'Mekan', val: `${data.mekanSayisi}`, color: '#fbbf24' },
        ].map(item => (
          <div key={item.label} className="bg-white/3 px-3 py-2 text-center">
            <div className="text-sm font-bold" style={{ color: item.color }}>{item.val}</div>
            <div className="text-[10px] text-white/50 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="p-3 space-y-2">
        {shown.map(m => (
          <div key={m.id} className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
            <span className="text-sm text-white/80">{m.emoji} {m.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">{m.satisAdet} satış</span>
              <span className="text-xs font-semibold text-emerald-400">₺{m.ciro.toLocaleString('tr-TR')}</span>
            </div>
          </div>
        ))}
        {data.mekanlar.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs text-violet-400 py-1 flex items-center justify-center gap-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Daha az göster' : `${data.mekanlar.length - 2} mekan daha`}
          </button>
        )}
      </div>
    </div>
  );
}

function StockCard({ data }: { data: { alan: string; name: string; count: number; status: string }[] }) {
  const statusColor = (s: string) => s === 'kritik' ? '#f87171' : s === 'az' ? '#fbbf24' : '#4ade80';
  const statusLabel = (s: string) => s === 'kritik' ? 'Kritik' : s === 'az' ? 'Az' : 'İyi';
  return (
    <div className="mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-2">
        <Package className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-semibold text-white/70">Stok Durumu</span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {data.map(item => (
          <div key={item.alan} className="bg-white/5 rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-white/70 truncate">{item.name}</span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-xs font-bold text-white">{item.count}</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${statusColor(item.status)}20`, color: statusColor(item.status) }}>
                {statusLabel(item.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoldenHourCard({ data }: { data: any }) {
  const now = new Date();
  const sunsetDate = new Date(data.sunsetRaw);
  const aksamBaslangicDate = new Date(sunsetDate.getTime() - 60 * 60 * 1000);
  const sunriseDate = new Date(data.sunriseRaw);
  const sabahBitisDate = new Date(sunriseDate.getTime() + 60 * 60 * 1000);

  const isSabahAktif = now >= sunriseDate && now <= sabahBitisDate;
  const isAksamAktif = now >= aksamBaslangicDate && now <= sunsetDate;

  return (
    <div className="mt-3 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-500/15 flex items-center gap-2">
        <span className="text-base">🌅</span>
        <span className="text-xs font-semibold text-amber-300">Fethiye — Bugünün Altın Saatleri</span>
      </div>
      <div className="p-3 space-y-2">
        {/* Sabah */}
        <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${isSabahAktif ? 'bg-amber-500/20 border border-amber-400/40' : 'bg-white/5'}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🌅</span>
            <div>
              <div className="text-xs text-white/50">Sabah Altın Saat</div>
              <div className="text-sm font-bold text-white">{data.sabahBaslangic} – {data.sabahBitis}</div>
            </div>
          </div>
          {isSabahAktif && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse">
              AKTİF
            </span>
          )}
        </div>
        {/* Akşam */}
        <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${isAksamAktif ? 'bg-orange-500/20 border border-orange-400/40' : 'bg-white/5'}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🌇</span>
            <div>
              <div className="text-xs text-white/50">Akşam Altın Saat</div>
              <div className="text-sm font-bold text-white">{data.aksamBaslangic} – {data.aksamBitis}</div>
            </div>
          </div>
          {isAksamAktif && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-400/20 text-orange-300 border border-orange-400/30 animate-pulse">
              AKTİF
            </span>
          )}
        </div>
        <div className="text-[11px] text-white/40 text-center pt-1">
          📍 Fethiye koordinatları · sunrise-sunset.org
        </div>
      </div>
    </div>
  );
}

function TipCard({ data }: { data: { title: string; icon: string } }) {
  return (
    <div className="mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 px-4 py-3 flex items-center gap-3">
      <span className="text-2xl">{data.icon}</span>
      <span className="text-xs font-semibold text-violet-300">{data.title}</span>
    </div>
  );
}

function IzinGecmisiCard({ data, onNavigate }: {
  data: {
    workDayCount: number;
    leaveDayCount: number;
    pendingLeaves: LeaveRequest[];
    todayInLeave: boolean;
    userName: string;
    userId?: string;
  };
  onNavigate?: (tab: string) => void;
}) {
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>(data.pendingLeaves ?? []);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleCancelLeave = async (leaveId: string) => {
    setDeletingIds(prev => new Set(prev).add(leaveId));
    const success = await deleteLeaveRequest(leaveId);
    if (success) setPendingLeaves(prev => prev.filter(l => l.id !== leaveId));
    setDeletingIds(prev => { const s = new Set(prev); s.delete(leaveId); return s; });
  };

  const leaveTypeLabel: Record<string, string> = {
    annual: 'Yıllık İzin',
    sick: 'Hastalık İzni',
    personal: 'Mazeret İzni',
  };
  const leaveTypeIcon: Record<string, string> = {
    annual: '🏖️',
    sick: '🤒',
    personal: '📋',
  };
  const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

  return (
    <div className="mt-3 rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
        <span className="text-base">📅</span>
        <span className="text-[11px] font-black text-white uppercase tracking-widest">Son 7 Gün — İzin Özeti</span>
      </div>

      <div className="p-4 space-y-3">

        {/* ── Ana metin özet ── */}
        <div className="bg-white/5 rounded-2xl px-4 py-3.5 space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">💼</span>
            <span className="text-sm text-white/80">
              <span className="font-bold text-violet-300">{data.workDayCount} gün</span> çalışma
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🏖️</span>
            <span className="text-sm text-white/80">
              <span className={`font-bold ${data.leaveDayCount > 0 ? 'text-emerald-400' : 'text-white/30'}`}>{data.leaveDayCount} gün</span> izin
            </span>
          </div>
          {data.todayInLeave && (
            <div className="mt-1.5 flex items-center gap-1.5 bg-emerald-500/12 border border-emerald-500/20 rounded-xl px-3 py-1.5">
              <span className="text-[10px] text-emerald-300 font-semibold">✓ Bugün izinlisin</span>
            </div>
          )}
        </div>

        {/* ── Bekleyen talepler ── */}
        {pendingLeaves.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] text-amber-400/60 uppercase tracking-widest font-semibold px-1">⏳ Onay Bekleyen</p>
            {pendingLeaves.slice(0, 3).map(l => {
              const isDeleting = deletingIds.has(l.id);
              return (
                <div key={l.id} className="flex items-center gap-2 bg-amber-500/8 border border-amber-500/18 rounded-xl px-3 py-2.5">
                  <span className="text-sm shrink-0">{leaveTypeIcon[l.type] || '📅'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/65 truncate">{leaveTypeLabel[l.type] || l.type}</p>
                    <p className="text-[9px] text-white/30">
                      {fmt(l.startDate)}{l.startDate !== l.endDate ? ` – ${fmt(l.endDate)}` : ''} · {l.days} gün
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelLeave(l.id)}
                    disabled={isDeleting}
                    className="ml-0.5 shrink-0 w-6 h-6 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center hover:bg-red-500/30 transition-colors disabled:opacity-40"
                    title="Talebi iptal et"
                  >
                    {isDeleting
                      ? <Loader2 className="w-3 h-3 text-red-400 animate-spin" />
                      : <Trash2 className="w-3 h-3 text-red-400" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Kişisel İzin Çizelgesi yönlendirme notu ── */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-violet-500/20 bg-violet-500/8 cursor-pointer hover:bg-violet-500/14 transition-colors"
          onClick={() => onNavigate?.('kisisel-izin-cetveli')}
        >
          <span className="text-base shrink-0">🗓️</span>
          <p className="text-[10px] text-violet-300/80 leading-snug flex-1">
            Detaylı görünüm için menüden <span className="font-semibold text-violet-300">Kişisel İzin Çizelgesi</span>'ne ulaşabilirsiniz.
          </p>
          <span className="text-white/25 text-xs shrink-0">›</span>
        </div>
      </div>
    </div>
  );
}

// ─── RotationFlowCard ────────────────────────────────────────────────────────

function RotationFlowCard({ data, onAction, isActive, onNavigate }: {
  data: RotationFlowState;
  onAction: (command: string) => void;
  isActive: boolean;
  onNavigate?: (tab: string) => void;
}) {
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [customStart, setCustomStart] = useState('10:00');
  const [customEnd, setCustomEnd] = useState('18:00');
  const [showCustomTime, setShowCustomTime] = useState(false);

  const disabled = !isActive;

  // TR tarih yardımcısı
  const trDays = (offset: number) => {
    const now = new Date();
    const tr = new Date(now.getTime() + (3 * 60 - now.getTimezoneOffset()) * 60000);
    tr.setDate(tr.getDate() + offset);
    return tr.toISOString().split('T')[0];
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

  const btnBase = 'w-full py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all active:scale-95 text-left flex items-center gap-2';
  const btnPrimary = `${btnBase} bg-violet-500/20 border-violet-500/40 text-violet-200 hover:bg-violet-500/35`;
  const btnSecondary = `${btnBase} bg-white/5 border-white/15 text-white/75 hover:bg-white/12`;

  // ── Done ─────────────────────────────────────────────────────────────────
  if (data.completed) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/25 flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-300">Görev Oluşturuldu! ✅</p>
            <p className="text-[10px] text-white/40">{data.taskStatus === 'sent' ? 'Gönderildi — personel bilgilendirildi' : 'Taslak olarak kaydedildi'}</p>
          </div>
        </div>
        <div className="space-y-1.5 mb-3 bg-white/5 rounded-xl px-3 py-2.5">
          <p className="text-xs text-white/60"><span className="text-white/30">📅</span> {fmtDate(data.date || '')}</p>
          <p className="text-xs text-white/60"><span className="text-white/30">📍</span> {data.locationIcon} {data.locationName}</p>
          <p className="text-xs text-white/60"><span className="text-white/30">👥</span> {data.selectedPersonnel?.map(p => p.name).join(', ')}</p>
          <p className="text-xs text-white/60"><span className="text-white/30">⏰</span> {data.startTime} – {data.endTime}</p>
        </div>
        <button
          onClick={() => onNavigate?.('rotation')}
          className="w-full py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold hover:bg-violet-500/35 transition-colors"
        >
          Rotasyon Sistemine Git →
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (data.step === 'loading') {
    return (
      <div className="mt-3 rounded-2xl border border-violet-500/20 bg-violet-500/8 px-4 py-5 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-violet-400 animate-spin shrink-0" />
        <div>
          <p className="text-sm text-white/70 font-medium">Personel ve mekanlar yükleniyor...</p>
          <p className="text-[10px] text-white/30">Rotasyon verilerine bağlanılıyor</p>
        </div>
      </div>
    );
  }

  // ── Date ─────────────────────────────────────────────────────────────────
  if (data.step === 'date') {
    const opts = [
      { label: '📅 Bugün', sub: fmtDate(trDays(0)), date: trDays(0) },
      { label: '📅 Yarın', sub: fmtDate(trDays(1)), date: trDays(1) },
      { label: '📅 Öbür Gün', sub: fmtDate(trDays(2)), date: trDays(2) },
    ];
    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-2 bg-white/3">
          <span className="text-base">🗓️</span>
          <span className="text-xs font-black text-white uppercase tracking-wider">Rotasyon — Tarih Seç</span>
        </div>
        <div className="p-3 space-y-2">
          {opts.map(opt => (
            <button key={opt.date} onClick={() => onAction(`__ROT_DATE_${opt.date}__`)} className={btnPrimary}>
              <span className="text-base shrink-0">{opt.label.split(' ')[0]}</span>
              <div>
                <div className="text-sm font-semibold">{opt.label.split(' ').slice(1).join(' ')}</div>
                <div className="text-[10px] text-white/40 font-normal">{opt.sub}</div>
              </div>
            </button>
          ))}
          <button onClick={() => onAction('__ROT_CANCEL__')} className="w-full text-center text-[11px] text-white/30 hover:text-white/50 py-1 transition-colors">
            İptal
          </button>
        </div>
      </div>
    );
  }

  // ── Location ──────────────────────────────────────────────────────────────
  if (data.step === 'location') {
    const locations = data.locations || [];
    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="flex items-center gap-2">
            <span className="text-base">📍</span>
            <span className="text-xs font-black text-white uppercase tracking-wider">Mekan Seç</span>
          </div>
          <p className="text-[10px] text-white/35 mt-0.5">{fmtDate(data.date || '')}</p>
        </div>
        <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
          {locations.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-4">Mekan bulunamadı</p>
          ) : (
            locations.map(loc => (
              <button
                key={loc.id}
                onClick={() => onAction(`__ROT_LOC_${loc.id}|${loc.name}|${loc.icon || '📍'}__`)}
                className={btnSecondary}
              >
                <span className="text-lg shrink-0">{loc.icon || '📍'}</span>
                <span className="font-semibold text-white/80">{loc.name}</span>
                {loc.workingHours && (
                  <span className="ml-auto text-[10px] text-white/25 shrink-0">{loc.workingHours.start}–{loc.workingHours.end}</span>
                )}
              </button>
            ))
          )}
          <button onClick={() => onAction('__ROT_CANCEL__')} className="w-full text-center text-[11px] text-white/30 hover:text-white/50 py-1 transition-colors">
            İptal
          </button>
        </div>
      </div>
    );
  }

  // ── Personnel ─────────────────────────────────────────────────────────────
  if (data.step === 'personnel') {
    const staff = (data.staffMembers || []).filter(s => s.status === 'active');
    const onLeaveIds = data.onLeaveIds || [];
    const toggle = (id: string) => setSelectedStaff(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="flex items-center gap-2">
            <span className="text-base">👥</span>
            <span className="text-xs font-black text-white uppercase tracking-wider">Personel Seç</span>
            {selectedStaff.length > 0 && (
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300">{selectedStaff.length} seçili</span>
            )}
          </div>
          <p className="text-[10px] text-white/35 mt-0.5">{data.locationIcon} {data.locationName} · {fmtDate(data.date || '')}</p>
        </div>
        <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
          {staff.map(s => {
            const isOnLeave = onLeaveIds.includes(s.id);
            const isSelected = selectedStaff.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => !isOnLeave && toggle(s.id)}
                disabled={isOnLeave}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                  isOnLeave
                    ? 'bg-red-500/5 border-red-500/15 opacity-50 cursor-not-allowed'
                    : isSelected
                    ? 'bg-violet-500/25 border-violet-500/50'
                    : 'bg-white/5 border-white/12 hover:bg-white/10'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-violet-500 border-violet-400' : 'border-white/20 bg-white/5'
                }`}>
                  {isSelected && <span className="text-[10px] text-white font-bold">✓</span>}
                </div>
                <div className="text-sm font-medium text-left flex-1">
                  <span className={isOnLeave ? 'text-white/35' : isSelected ? 'text-violet-200' : 'text-white/75'}>{s.name}</span>
                </div>
                {isOnLeave && <span className="text-[10px] text-red-400 shrink-0">izinli 🏖️</span>}
                <span className="text-[10px] text-white/20 shrink-0">{
                  s.role === 'mudur' ? 'Müdür' : s.role === 'operasyon' ? 'Operasyon' : s.role === 'personel' ? 'Personel' : s.role
                }</span>
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-white/8 space-y-2">
          <button
            onClick={() => {
              if (selectedStaff.length === 0) return;
              onAction(`__ROT_STAFF_DONE_${selectedStaff.join(',')}__`);
            }}
            disabled={selectedStaff.length === 0}
            className="w-full py-2.5 rounded-xl bg-violet-500/25 border border-violet-500/40 text-violet-200 text-sm font-bold hover:bg-violet-500/40 transition-colors disabled:opacity-30"
          >
            {selectedStaff.length === 0 ? 'Personel seç...' : `Devam → (${selectedStaff.length} kişi)`}
          </button>
          <button onClick={() => onAction('__ROT_CANCEL__')} className="w-full text-center text-[11px] text-white/30 hover:text-white/50 py-1 transition-colors">İptal</button>
        </div>
      </div>
    );
  }

  // ── Time ──────────────────────────────────────────────────────────────────
  if (data.step === 'time') {
    const presets = [
      { label: '09:00 – 18:00', start: '09:00', end: '18:00' },
      { label: '10:00 – 18:00', start: '10:00', end: '18:00' },
      { label: '10:00 – 19:00', start: '10:00', end: '19:00' },
      { label: '11:00 – 19:00', start: '11:00', end: '19:00' },
    ];
    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="flex items-center gap-2">
            <span className="text-base">⏰</span>
            <span className="text-xs font-black text-white uppercase tracking-wider">Saat Aralığı</span>
          </div>
          <p className="text-[10px] text-white/35 mt-0.5">{data.locationIcon} {data.locationName} · {data.selectedPersonnel?.map(p => p.name.split(' ')[0]).join(', ')}</p>
        </div>
        <div className="p-3 space-y-2">
          {presets.map(p => (
            <button key={p.label} onClick={() => onAction(`__ROT_TIME_${p.start}|${p.end}__`)} className={btnSecondary}>
              <Clock className="w-4 h-4 text-violet-400 shrink-0" />
              <span className="font-semibold">{p.label}</span>
            </button>
          ))}
          {!showCustomTime ? (
            <button onClick={() => setShowCustomTime(true)} className="w-full text-[11px] text-violet-400/70 hover:text-violet-300 py-1 transition-colors">
              ✏️ Özel saat gir
            </button>
          ) : (
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <p className="text-[10px] text-white/40 mb-1">Başlangıç</p>
                  <input type="time" value={customStart} onChange={e => setCustomStart(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-white/40 mb-1">Bitiş</p>
                  <input type="time" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50" />
                </div>
              </div>
              <button onClick={() => onAction(`__ROT_TIME_${customStart}|${customEnd}__`)}
                className="w-full py-2 rounded-xl bg-violet-500/25 border border-violet-500/40 text-violet-200 text-sm font-bold hover:bg-violet-500/40 transition-colors">
                Özel saati kullan
              </button>
            </div>
          )}
          <button onClick={() => onAction('__ROT_CANCEL__')} className="w-full text-center text-[11px] text-white/30 hover:text-white/50 py-1 transition-colors">İptal</button>
        </div>
      </div>
    );
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  if (data.step === 'confirm') {
    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8 bg-white/3 flex items-center gap-2">
          <span className="text-base">✅</span>
          <span className="text-xs font-black text-white uppercase tracking-wider">Görevi Onayla</span>
        </div>
        <div className="p-3 space-y-1.5">
          {[
            { icon: '📅', label: 'Tarih', val: fmtDate(data.date || '') },
            { icon: '📍', label: 'Mekan', val: `${data.locationIcon} ${data.locationName}` },
            { icon: '👥', label: 'Personel', val: data.selectedPersonnel?.map(p => p.name).join(', ') || '-' },
            { icon: '⏰', label: 'Saat', val: `${data.startTime} – ${data.endTime}` },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2.5 bg-white/5 rounded-xl px-3 py-2">
              <span className="text-base shrink-0">{item.icon}</span>
              <div>
                <p className="text-[10px] text-white/35">{item.label}</p>
                <p className="text-sm text-white/80 font-medium">{item.val}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/8 space-y-2">
          <button onClick={() => onAction('__ROT_SAVE_sent__')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500/30 to-indigo-500/20 border border-violet-500/40 text-violet-200 text-sm font-bold hover:from-violet-500/45 hover:to-indigo-500/35 transition-all flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> Gönder (Personel Bilgilendirilir)
          </button>
          <button onClick={() => onAction('__ROT_SAVE_draft__')}
            className="w-full py-2.5 rounded-xl bg-white/8 border border-white/15 text-white/60 text-sm font-semibold hover:bg-white/14 transition-colors">
            📝 Taslak Olarak Kaydet
          </button>
          <button onClick={() => onAction('__ROT_CANCEL__')} className="w-full text-center text-[11px] text-white/30 hover:text-white/50 py-1 transition-colors">İptal</button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── RotationCancelFlowCard ───────────────────────────────────────────────────

function RotationCancelFlowCard({ data, onAction, isActive }: {
  data: RotationCancelFlowState;
  onAction: (command: string) => void;
  isActive: boolean;
}) {
  const disabled = !isActive;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });

  if (data.completed) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className="text-sm text-emerald-300 font-medium">Görev iptal edildi ✅</span>
      </div>
    );
  }

  if (data.step === 'select') {
    const tasks = (data.tasks || []).filter(t => t.status !== 'cancelled');
    return (
      <div className={`mt-3 rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/8 to-orange-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8 bg-white/3 flex items-center gap-2">
          <span className="text-base">🚫</span>
          <span className="text-xs font-black text-white uppercase tracking-wider">İptal Edilecek Görevi Seç</span>
        </div>
        <div className="p-3 space-y-2 max-h-56 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-4">İptal edilebilir görev bulunamadı</p>
          ) : (
            tasks.map(t => (
              <button key={t.id} onClick={() => onAction(`__ROT_CANCEL_SELECT_${t.id}|${t.location}__`)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/12 hover:bg-red-500/10 hover:border-red-500/25 transition-all text-left">
                <span className="text-base shrink-0">{t.locationIcon || '📍'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/80 truncate">{t.location}</p>
                  <p className="text-[10px] text-white/35">
                    {t.personnel?.map((p: any) => p.name).join(', ')} · {t.startTime}–{t.endTime}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                  t.status === 'sent' ? 'bg-emerald-500/20 text-emerald-300' :
                  t.status === 'draft' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/30'
                }`}>{t.status === 'sent' ? 'Gönderildi' : t.status === 'draft' ? 'Taslak' : t.status}</span>
              </button>
            ))
          )}
          <button onClick={() => onAction('__ROT_CANCEL_ABORT__')} className="w-full text-center text-[11px] text-white/30 hover:text-white/50 py-1 transition-colors">Vazgeç</button>
        </div>
      </div>
    );
  }

  if (data.step === 'confirm') {
    return (
      <div className={`mt-3 rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/8 to-orange-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8 bg-white/3 flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span className="text-xs font-black text-white uppercase tracking-wider">İptal Onayı</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-white/70">
            <strong className="text-white">{data.selectedTaskLocation}</strong> görevini iptal etmek istediğinden emin misin?
          </p>
          <div className="flex gap-2">
            <button onClick={() => onAction(`__ROT_CANCEL_CONFIRM_${data.selectedTaskId}__`)}
              className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-bold hover:bg-red-500/35 transition-colors">
              ✅ Evet, iptal et
            </button>
            <button onClick={() => onAction('__ROT_CANCEL_ABORT__')}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium hover:bg-white/10 transition-colors">
              Hayır
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ─── LeaveConfirmCard ─────────────────────────────────────────────────────────

function LeaveConfirmCard({ onAction, isActive }: { onAction: (cmd: string) => void; isActive: boolean }) {
  return (
    <div className="mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
        <span className="text-lg">🏖️</span>
        <span className="text-xs font-black text-white uppercase tracking-wider">İzin Talebi</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-white/70">Yeni bir izin talebi oluşturmak istiyor musun?</p>
        <div className="flex gap-2">
          <button
            onClick={() => onAction('__LEAVE_CONFIRM_YES__')}
            disabled={!isActive}
            className="flex-1 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/35 transition-colors disabled:opacity-40"
          >
            ✅ Evet, oluştur
          </button>
          <button
            onClick={() => onAction('__LEAVE_CONFIRM_NO__')}
            disabled={!isActive}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            Hayır
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LeaveFlowCard ────────────────────────────────────────────────────────────

const LEAVE_TYPE_META = {
  annual:   { label: 'Yıllık İzin',   icon: '🏖️', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20' },
  sick:     { label: 'Hastalık İzni', icon: '🤒', color: 'text-red-300 border-red-500/30 bg-red-500/10 hover:bg-red-500/20' },
  personal: { label: 'Mazeret İzni',  icon: '📋', color: 'text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20' },
} as const;

function LeaveFlowCard({ data, onAction, isActive }: {
  data: LeaveFlowState;
  onAction: (command: string) => void;
  isActive: boolean;
}) {
  const [dateVal, setDateVal] = useState('');
  const [noteVal, setNoteVal] = useState('');

  // Tamamlanmış kart
  if (data.completed) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className="text-sm text-emerald-300 font-medium">Talep başarıyla gönderildi ✅</span>
      </div>
    );
  }

  const disabled = !isActive;

  // ── Step: type ──────────────────────────────────────────────────────────────
  if (data.step === 'type') {
    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8">
          <span className="text-xs font-bold text-white uppercase tracking-wider">İzin Türü Seç</span>
        </div>
        <div className="p-3 space-y-2">
          {(['annual', 'sick', 'personal'] as const).map(type => (
            <button
              key={type}
              onClick={() => onAction(`__LEAVE_TYPE_${type}__`)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-95 ${LEAVE_TYPE_META[type].color}`}
            >
              <span className="text-xl">{LEAVE_TYPE_META[type].icon}</span>
              <span className="text-sm font-semibold">{LEAVE_TYPE_META[type].label}</span>
            </button>
          ))}
          <button
            onClick={() => onAction('__LEAVE_CANCEL__')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/25 bg-red-500/8 text-red-400 text-sm font-medium hover:bg-red-500/18 transition-all active:scale-95 mt-1"
          >
            <span>✕</span>
            <span>İptal</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Step: duration ──────────────────────────────────────────────────────────
  if (data.step === 'duration') {
    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Süre Tipi</span>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2">
          {[
            { value: 'single',   label: '1 Günlük',          icon: '📅', sub: 'Tek günlük' },
            { value: 'multiple', label: 'Birden Fazla Gün',   icon: '📆', sub: 'Aralık seç' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => onAction(`__LEAVE_DURATION_${opt.value}__`)}
              className="flex flex-col items-center gap-1.5 py-4 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 active:scale-95 transition-all"
            >
              <span className="text-2xl">{opt.icon}</span>
              <span className="text-xs font-bold text-white">{opt.label}</span>
              <span className="text-[10px] text-white/40">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step: start_date / end_date ─────────────────────────────────────────────
  if (data.step === 'start_date' || data.step === 'end_date') {
    const isStart  = data.step === 'start_date';
    const label    = isStart ? 'Başlangıç Tarihi' : 'Bitiş Tarihi';
    const minDate  = isStart
      ? new Date().toISOString().split('T')[0]
      : (data.startDate || new Date().toISOString().split('T')[0]);
    const cmdPfx   = isStart ? '__LEAVE_STARTDATE_' : '__LEAVE_ENDDATE_';

    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8">
          <span className="text-xs font-bold text-white uppercase tracking-wider">{label}</span>
          {!isStart && data.startDate && (
            <span className="text-[10px] text-violet-400 ml-2">Başlangıç: {new Date(data.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span>
          )}
        </div>
        <div className="p-3 space-y-2.5">
          <input
            type="date"
            min={minDate}
            value={dateVal}
            onChange={e => setDateVal(e.target.value)}
            className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-violet-500/60 transition-colors"
            style={{ colorScheme: 'dark' }}
          />
          <button
            onClick={() => { if (dateVal) onAction(`${cmdPfx}${dateVal}__`); }}
            disabled={!dateVal}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold disabled:opacity-30 active:scale-95 transition-all"
          >
            Devam Et →
          </button>
        </div>
      </div>
    );
  }

  // ── Step: notes ─────────────────────────────────────────────────────────────
  if (data.step === 'notes') {
    return (
      <div className={`mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Not Ekle</span>
          <span className="text-[10px] text-white/35 ml-2">— isteğe bağlı</span>
        </div>
        <div className="p-3 space-y-2.5">
          <textarea
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            placeholder="Sebebi veya açıklama yazabilirsin..."
            className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-violet-500/60 resize-none transition-colors"
            rows={3}
            style={{ colorScheme: 'dark' }}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAction('__LEAVE_NOTES_SKIP__')}
              className="py-3 rounded-xl border border-white/15 text-white/60 text-sm font-medium active:scale-95 transition-all hover:bg-white/8"
            >
              Geç
            </button>
            <button
              onClick={() => onAction(`__LEAVE_NOTES_${encodeURIComponent(noteVal.trim() || 'SKIP')}__`)}
              className="py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold active:scale-95 transition-all"
            >
              {noteVal.trim() ? 'Ekle & Devam' : 'Devam Et'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: confirm ───────────────────────────────────────────────────────────
  if (data.step === 'confirm') {
    const meta = LEAVE_TYPE_META[data.leaveType || 'annual'];
    const fmt  = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const isSingle = data.durationType === 'single';

    return (
      <div className={`mt-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 to-violet-500/5 overflow-hidden ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-2">
          <span className="text-sm">📋</span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">Talebi İncele & Gönder</span>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="bg-white/5 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/45">İzin Türü</span>
              <span className="text-xs font-bold text-white">{meta.icon} {meta.label}</span>
            </div>
            <div className="w-full h-px bg-white/8" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/45">Tarih</span>
              <span className="text-xs font-bold text-white text-right">
                {isSingle
                  ? fmt(data.startDate || '')
                  : `${fmt(data.startDate || '')} –\n${fmt(data.endDate || '')}`
                }
              </span>
            </div>
            {!isSingle && data.startDate && data.endDate && (
              <>
                <div className="w-full h-px bg-white/8" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45">Süre</span>
                  <span className="text-xs font-bold text-violet-300">
                    {Math.round((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} gün
                  </span>
                </div>
              </>
            )}
            {data.notes && data.notes !== 'SKIP' && (
              <>
                <div className="w-full h-px bg-white/8" />
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs text-white/45 shrink-0">Not</span>
                  <span className="text-xs text-white/70 text-right">{data.notes}</span>
                </div>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAction('__LEAVE_CANCEL__')}
              className="py-3 rounded-xl border border-red-500/30 bg-red-500/8 text-red-400 text-sm font-semibold active:scale-95 transition-all hover:bg-red-500/15"
            >
              ❌ İptal
            </button>
            <button
              onClick={() => onAction('__LEAVE_CONFIRM__')}
              className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold active:scale-95 transition-all shadow-lg shadow-emerald-600/30"
            >
              ✅ Gönder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function AnomalyCard({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-green-500/5 px-4 py-3 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400" />
        <span className="text-sm text-emerald-300">Anomali tespit edilmedi</span>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/10 to-orange-500/5 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-red-500/15 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-xs font-semibold text-red-300">{data.length} Anomali Tespit Edildi</span>
      </div>
      <div className="p-3 space-y-2">
        {data.map((a, i) => (
          <div key={i} className="bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
            <span>{a.mekanEmoji}</span>
            <span className="text-xs text-white/70">{a.mekan}</span>
            <span className="ml-auto text-[10px] text-red-300 bg-red-500/15 px-2 py-0.5 rounded-full">
              {a.type === 'acilis' ? 'Açılış' : 'Kapanış'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg, onFlowAction, isLastMsg, onNavigate }: {
  msg: Message;
  onFlowAction?: (command: string) => void;
  isLastMsg?: boolean;
  onNavigate?: (tab: string) => void;
}) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Brain className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-sm'
            : 'bg-white/8 border border-white/12 text-white/90 rounded-bl-sm'
        }`}>
          {renderMDLines(msg.text)}
        </div>
        {msg.card && (
          <>
            {msg.card.type === 'briefing' && <BriefingCard data={msg.card.data} />}
            {msg.card.type === 'profit' && <BriefingCard data={msg.card.data} />}
            {msg.card.type === 'stock' && <StockCard data={msg.card.data} />}
            {msg.card.type === 'anomaly' && <AnomalyCard data={msg.card.data} />}
            {msg.card.type === 'tip' && <TipCard data={msg.card.data} />}
            {msg.card.type === 'golden_hour' && <GoldenHourCard data={msg.card.data} />}
            {msg.card.type === 'mekan_detay' && <MekanDetayCard data={msg.card.data} />}
            {msg.card.type === 'izin' && <IzinGecmisiCard data={msg.card.data} onNavigate={onNavigate} />}
            {msg.card.type === 'leave_confirm' && (
              <LeaveConfirmCard
                onAction={onFlowAction ?? (() => {})}
                isActive={!!isLastMsg && !msg.card.data.answered}
              />
            )}
            {msg.card.type === 'leave_flow' && (
              <LeaveFlowCard
                data={msg.card.data}
                onAction={onFlowAction ?? (() => {})}
                isActive={!!isLastMsg && !msg.card.data.completed}
              />
            )}
            {msg.card.type === 'rotation_flow' && (
              <RotationFlowCard
                data={msg.card.data}
                onAction={onFlowAction ?? (() => {})}
                isActive={!!isLastMsg && !msg.card.data.completed}
                onNavigate={onNavigate}
              />
            )}
            {msg.card.type === 'rotation_cancel_flow' && (
              <RotationCancelFlowCard
                data={msg.card.data}
                onAction={onFlowAction ?? (() => {})}
                isActive={!!isLastMsg && !msg.card.data.completed}
              />
            )}
          </>
        )}
        <span className="text-[10px] text-white/25 mt-1 px-1">
          {msg.ts.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── DailyBriefingTopCard ────────────────────────────────────────────────────

function DailyBriefingTopCard({
  ozet, loading, onDetay, onAnomali
}: {
  ozet: AIOzet | null;
  loading: boolean;
  onDetay: () => void;
  onAnomali: () => void;
}) {
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const anomaliSayisi = ozet?.anomaliler?.length ?? 0;
  const mekanSayisi = ozet?.mekanSayisi ?? 0;
  const toplamCiro = ozet?.toplamCiro ?? 0;
  const iskonto = ozet?.toplamIskonto ?? 0;
  const karMarji = toplamCiro > 0
    ? Math.min(85, Math.max(60, Math.round((1 - (iskonto / toplamCiro) * 0.4) * 78)))
    : 73;

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-[rgba(88,28,235,0.18)] to-[rgba(79,70,229,0.08)] backdrop-blur-sm p-4 mb-1">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-500/30 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-violet-300" />
          </div>
          <span className="text-xs font-black text-white tracking-wider uppercase">Günlük Brifing</span>
        </div>
        <span className="text-[10px] text-white/40">{today}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          <span className="text-xs text-white/40">Veriler yükleniyor...</span>
        </div>
      ) : mekanSayisi > 0 ? (
        <>
          <p className="text-sm text-white/75 leading-relaxed">
            Bugün <strong className="text-white">{mekanSayisi} mekanda</strong> toplam{' '}
            <strong className="text-emerald-400">₺{toplamCiro.toLocaleString('tr-TR')}</strong> ciro,{' '}
            <strong className="text-white">%{karMarji}</strong> kâr marjı.
          </p>
          {anomaliSayisi > 0 && (
            <p className="text-sm font-semibold text-amber-400 mt-1">
              {anomaliSayisi} anomali dikkat bekliyor.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-white/45 leading-relaxed">
          Bugün henüz vardiya açılışı yapılmamış. Veriler açılıştan sonra buraya yansır.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onDetay}
          className="flex-1 py-3 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] active:scale-95 active:bg-[#5b21b6] text-white text-sm font-bold shadow-lg shadow-violet-700/40 transition-all"
        >
          Detayları Gör
        </button>
        <button
          onClick={onAnomali}
          className="flex-1 py-3 rounded-full bg-[#3d1a0a] hover:bg-[#4d220d] active:scale-95 active:bg-[#2a1108] border border-[#7c3008]/60 text-[#f97316] text-sm font-bold flex items-center justify-center gap-2 transition-all"
        >
          <span>🚨</span> Anomaliler
        </button>
      </div>
    </div>
  );
}

// ─── Mekan Seçim Modalı ───────────────────────────────────────────────────────

function MekanSecModal({
  mekanlar,
  onSelect,
  onClose,
}: {
  mekanlar: AIOzet['mekanlar'];
  onSelect: (mekan: AIOzet['mekanlar'][0]) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-gradient-to-b from-[#1a0a3c] to-[#0a051e] border-t border-white/15 pb-8 pt-4 px-4 mb-24"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">📍</span>
          <span className="text-sm font-bold text-white">Mekan Detaylı Bilgi</span>
          <span className="text-xs text-white/40 ml-1">— bir mekan seç</span>
        </div>
        {mekanlar.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-6">
            Bugün aktif mekan verisi yok.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {mekanlar.map(m => (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className="w-full flex items-center justify-between bg-white/6 hover:bg-white/12 active:scale-95 border border-white/10 rounded-2xl px-4 py-3 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{m.emoji}</span>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-white">{m.name}</div>
                    <div className="text-xs text-white/40">{m.satisAdet} satış · {m.acilisYapildi ? (m.kapanisYapildi ? 'Kapandı' : 'Açık') : 'Açılış yok'}</div>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-400">₺{m.ciro.toLocaleString('tr-TR')}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full py-3 rounded-full bg-white/8 border border-white/12 text-sm text-white/50 font-semibold"
        >
          İptal
        </button>
      </div>
    </div>
  );
}

// ─── MekanDetayCard ───────────────────────────────────────────────────────────

// Ürün adından albüm boyunu çıkar: "5'li" → 5, "13'lü" → 13
function extractAlbumSize(productName: string): number | null {
  const match = productName.match(/^(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Paspartu / albümsüz satış mı?
function _isPaspartu(productName: string): boolean {
  const lower = productName.toLowerCase();
  return lower === 'paspartu' || lower === '1 fotoğraf' || lower === '1 fotograf';
}

// Satışlardan albüm dağılımını hesapla
function computeAlbumBreakdown(
  satislar: VardiyaSatis[],
  albumMaliyetleri: AlbumMaliyet[],
  printType: 'tam' | 'yarim'
): { productName: string; quantity: number; birimMaliyet: number | null; toplamMaliyet: number | null; paspartu: boolean }[] {
  const grouped: Record<string, { quantity: number; birimMaliyet: number | null; paspartu: boolean }> = {};

  for (const satis of satislar) {
    for (const item of satis.items) {
      const name = item.product;
      if (!grouped[name]) {
        const pp = _isPaspartu(name);
        let birimMal: number | null = null;
        if (!pp) {
          const size = extractAlbumSize(name);
          if (size !== null) {
            const album = albumMaliyetleri.find(a => a.size === size);
            if (album) {
              birimMal = printType === 'tam' ? album.tamBoy : album.yarimBoy;
            }
          }
        }
        grouped[name] = { quantity: 0, birimMaliyet: birimMal, paspartu: pp };
      }
      grouped[name].quantity += item.quantity;
    }
  }

  return Object.entries(grouped)
    .map(([productName, { quantity, birimMaliyet, paspartu }]) => ({
      productName,
      quantity,
      birimMaliyet,
      toplamMaliyet: birimMaliyet !== null ? quantity * birimMaliyet : null,
      paspartu,
    }))
    .sort((a, b) => {
      if (a.paspartu && !b.paspartu) return 1;
      if (!a.paspartu && b.paspartu) return -1;
      return (extractAlbumSize(a.productName) ?? 0) - (extractAlbumSize(b.productName) ?? 0);
    });
}

function MekanDetayCard({ data }: { data: MekanDetayData }) {
  const vardiyaDurum = !data.acilisYapildi
    ? { label: 'Açılış Yapılmadı', color: '#f87171', bg: 'rgba(239,68,68,0.12)' }
    : data.kapanisYapildi
    ? { label: 'Kapandı', color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' }
    : { label: 'Vardiya Açık', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' };

  const breakdown = data.satislar && data.albumMaliyetleri && !data.yukleniyor
    ? computeAlbumBreakdown(data.satislar, data.albumMaliyetleri, data.printType || 'yarim')
    : null;

  const toplamAlbumMaliyeti = breakdown
    ? breakdown.reduce((sum, r) => sum + (r.toplamMaliyet ?? 0), 0)
    : 0;
  const toplamAlbumAdet = breakdown
    ? breakdown.reduce((sum, r) => sum + r.quantity, 0)
    : 0;
  const baskiMaliyeti = data.vardiyaToplam?.toplamMaliyet ?? 0;
  const personelToplamMaliyet = (data.personelListesi || []).reduce((s, p) => s + p.gunlukMaas, 0);
  const kiraMaliyeti = data.kiraMaliyeti ?? 0;
  const toplamMaliyet = toplamAlbumMaliyeti + baskiMaliyeti;
  const toplamGiderMaliyet = toplamMaliyet + personelToplamMaliyet + kiraMaliyeti;

  return (
    <div className="mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden">
      {/* Başlık */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{data.emoji}</span>
          <span className="text-sm font-bold text-white">{data.name}</span>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: vardiyaDurum.color, background: vardiyaDurum.bg }}
        >
          {vardiyaDurum.label}
        </span>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/8">
        {[
          { label: 'Ciro', val: `₺${data.ciro.toLocaleString('tr-TR')}`, color: '#4ade80' },
          { label: 'Satış', val: `${data.satisAdet}`, color: '#a78bfa' },
          { label: 'İskonto', val: `₺${data.iskonto.toLocaleString('tr-TR')}`, color: '#fbbf24' },
        ].map(item => (
          <div key={item.label} className="bg-white/3 px-2 py-2.5 text-center">
            <div className="text-sm font-bold" style={{ color: item.color }}>{item.val}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Durum detayı */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
          <span className="text-xs text-white/50">Açılış</span>
          <span className={`text-xs font-semibold ${data.acilisYapildi ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.acilisYapildi ? '✅ Yapıldı' : '❌ Yapılmadı'}
          </span>
        </div>
        <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
          <span className="text-xs text-white/50">Kapanış</span>
          <span className={`text-xs font-semibold ${data.kapanisYapildi ? 'text-emerald-400' : 'text-amber-400'}`}>
            {data.kapanisYapildi ? '✅ Tamamlandı' : '⏳ Bekleniyor'}
          </span>
        </div>
        {data.ciro > 0 && (
          <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
            <span className="text-xs text-white/50">Net ciro</span>
            <span className="text-xs font-bold text-emerald-400">
              ₺{(data.ciro - data.iskonto).toLocaleString('tr-TR')}
            </span>
          </div>
        )}
      </div>

      {/* ── Satılan Albümler & Maliyet ── */}
      <div className="border-t border-white/8">
        {/* Bölüm başlığı */}
        <div className="px-4 py-2.5 flex items-center gap-2 bg-white/3">
          <span className="text-sm">📦</span>
          <span className="text-[11px] font-bold text-white/60 tracking-wider uppercase">Satılan Albümler & Maliyet</span>
          {data.printType && !data.yukleniyor && (
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/25">
              {data.printType === 'tam' ? 'Tam Boy' : 'Yarım Boy'}
            </span>
          )}
        </div>

        {/* Yükleniyor */}
        {data.yukleniyor && (
          <div className="flex items-center justify-center gap-2 py-5">
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
            <span className="text-xs text-white/40">Satış verileri yükleniyor...</span>
          </div>
        )}

        {/* Satış yok */}
        {!data.yukleniyor && (!breakdown || breakdown.length === 0) && (
          <div className="px-4 py-4 text-center">
            <span className="text-xs text-white/30">Bugün satış kaydı bulunamadı</span>
          </div>
        )}

        {/* Tablo */}
        {!data.yukleniyor && breakdown && breakdown.length > 0 && (
          <div className="px-3 pb-3">
            {/* Tablo başlığı */}
            <div className="grid grid-cols-4 gap-1 px-2 py-1.5 mb-1">
              <span className="text-[10px] font-semibold text-white/30 col-span-2">Ürün</span>
              <span className="text-[10px] font-semibold text-white/30 text-right">Adet</span>
              <span className="text-[10px] font-semibold text-white/30 text-right">Maliyet</span>
            </div>

            {/* Satırlar */}
            <div className="space-y-1">
              {breakdown.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-4 gap-1 px-2 py-2 rounded-xl ${
                    row.paspartu ? 'bg-white/3' : 'bg-white/5'
                  }`}
                >
                  {/* Ürün adı */}
                  <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                    <span className="text-sm shrink-0">{row.paspartu ? '🖼️' : '📘'}</span>
                    <span className={`text-xs font-medium truncate ${row.paspartu ? 'text-white/40' : 'text-white/80'}`}>
                      {row.productName}
                    </span>
                    {!row.paspartu && row.birimMaliyet !== null && (
                      <span className="text-[9px] text-white/20 shrink-0">@{row.birimMaliyet}₺</span>
                    )}
                  </div>
                  {/* Adet */}
                  <div className="text-right self-center">
                    <span className="text-xs font-bold text-violet-300">{row.quantity}</span>
                  </div>
                  {/* Maliyet */}
                  <div className="text-right self-center">
                    {row.paspartu ? (
                      <span className="text-[10px] text-white/25">—</span>
                    ) : row.toplamMaliyet !== null ? (
                      <span className="text-xs font-bold text-orange-300">₺{row.toplamMaliyet.toLocaleString('tr-TR')}</span>
                    ) : (
                      <span className="text-[10px] text-amber-400/60">?</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Baskı maliyeti satırı — kapanış yapılmışsa göster */}
            {baskiMaliyeti > 0 && (
              <div className="mt-1 grid grid-cols-4 gap-1 px-2 py-2 rounded-xl bg-blue-500/8 border border-blue-500/15">
                <div className="col-span-2 flex items-center gap-1.5">
                  <span className="text-sm shrink-0">🖨️</span>
                  <div>
                    <span className="text-xs font-medium text-blue-300">Baskı Maliyeti</span>
                    {data.vardiyaToplam?.paperName && (
                      <div className="text-[9px] text-white/25">{data.vardiyaToplam.paperName}</div>
                    )}
                  </div>
                </div>
                <div className="text-right self-center">
                  <span className="text-xs font-bold text-blue-300">
                    {data.vardiyaToplam?.toplamKullanilanBaskı ?? '—'}
                  </span>
                </div>
                <div className="text-right self-center">
                  <span className="text-xs font-bold text-orange-300">₺{baskiMaliyeti.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {/* Toplam satır */}
            <div className="mt-2 grid grid-cols-4 gap-1 px-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/15 to-indigo-500/10 border border-violet-500/20">
              <div className="col-span-2">
                <span className="text-xs font-bold text-white/70">Toplam Maliyet</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-violet-300">{toplamAlbumAdet}</span>
              </div>
              <div className="text-right">
                {toplamMaliyet > 0 ? (
                  <span className="text-xs font-bold text-orange-300">₺{toplamMaliyet.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                ) : (
                  <span className="text-[10px] text-white/30">—</span>
                )}
              </div>
            </div>

            {/* Brüt kâr özeti — sadece albüm+baskı bazlı */}
            {toplamMaliyet > 0 && data.ciro > 0 && (
              <div className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div>
                  <div className="text-[10px] text-emerald-400/60">Brüt Kâr (Ürün)</div>
                  <div className="text-[9px] text-white/25">Net ciro − Albüm − Baskı</div>
                </div>
                <span className="text-sm font-bold text-emerald-400">
                  ₺{(data.ciro - data.iskonto - toplamMaliyet).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Personel Maliyeti ── */}
      {!data.yukleniyor && (
        <div className="border-t border-white/8">
          <div className="px-4 py-2.5 flex items-center gap-2 bg-white/3">
            <span className="text-sm">👥</span>
            <span className="text-[11px] font-bold text-white/60 tracking-wider uppercase">Personel Maliyeti</span>
            {(data.personelListesi || []).length > 0 && (
              <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/25">
                {(data.personelListesi || []).length} kişi
              </span>
            )}
          </div>

          {(data.personelListesi || []).length === 0 ? (
            <div className="px-4 py-3 text-center">
              <span className="text-xs text-white/30">Bugün rotasyona atanan personel bulunamadı</span>
            </div>
          ) : (
            <div className="px-3 pb-3">
              {/* Tablo başlığı */}
              <div className="grid grid-cols-3 gap-1 px-2 py-1.5 mb-1">
                <span className="text-[10px] font-semibold text-white/30 col-span-2">Personel</span>
                <span className="text-[10px] font-semibold text-white/30 text-right">Günlük</span>
              </div>
              <div className="space-y-1">
                {(data.personelListesi || []).map((p) => (
                  <div key={p.id} className="grid grid-cols-3 gap-1 px-2 py-2 rounded-xl bg-white/5">
                    <div className="col-span-2 flex items-center gap-1.5">
                      <span className="text-sm shrink-0">👤</span>
                      <span className="text-xs font-medium text-white/80 truncate">{p.name}</span>
                    </div>
                    <div className="text-right self-center">
                      {p.hasMaas ? (
                        <span className="text-xs font-bold text-pink-300">
                          ₺{p.gunlukMaas.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400/60">Maaş yok</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Personel toplam */}
              {personelToplamMaliyet > 0 && (
                <div className="mt-2 flex items-center justify-between px-2 py-2 rounded-xl bg-pink-500/10 border border-pink-500/20">
                  <span className="text-xs font-bold text-white/70">Toplam Personel</span>
                  <span className="text-xs font-bold text-pink-300">
                    ₺{personelToplamMaliyet.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Kira ── */}
      {!data.yukleniyor && kiraMaliyeti > 0 && (
        <div className="border-t border-white/8">
          <div className="px-4 py-2.5 flex items-center gap-2 bg-white/3">
            <span className="text-sm">🏢</span>
            <span className="text-[11px] font-bold text-white/60 tracking-wider uppercase">Kira Gideri</span>
          </div>
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5">
              <div>
                <div className="text-xs text-white/60">Günlük Kira</div>
                <div className="text-[9px] text-white/25">Yıllık kira ÷ 365</div>
              </div>
              <span className="text-xs font-bold text-amber-300">
                ₺{kiraMaliyeti.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Net Kâr Özeti ── */}
      {!data.yukleniyor && data.ciro > 0 && toplamGiderMaliyet > 0 && (
        <div className="border-t border-white/8 px-3 py-3">
          <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 px-3 py-3">
            <div className="text-[10px] text-white/30 mb-2">Gider Dağılımı</div>
            <div className="space-y-1 mb-3">
              {toplamAlbumMaliyeti > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/40">📦 Albüm</span>
                  <span className="text-orange-300">₺{toplamAlbumMaliyeti.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {baskiMaliyeti > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/40">🖨️ Baskı</span>
                  <span className="text-orange-300">₺{baskiMaliyeti.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {personelToplamMaliyet > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/40">👥 Personel</span>
                  <span className="text-pink-300">₺{personelToplamMaliyet.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {kiraMaliyeti > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/40">🏢 Kira</span>
                  <span className="text-amber-300">₺{kiraMaliyeti.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            <div className="border-t border-white/10 pt-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-300">Net Kâr</div>
                <div className="text-[9px] text-white/25">Net ciro − Albüm − Baskı − Personel − Kira</div>
              </div>
              <span className={`text-base font-bold ${(data.ciro - data.iskonto - toplamGiderMaliyet) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ₺{(data.ciro - data.iskonto - toplamGiderMaliyet).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AspectAIPage({ userRole = 'personel', userName = 'Kullanıcı', userId = '', userAvatar = '👤', onLogout, onNavigate }: AspectAIProps) {
  // KV'den yüklenmiş config override — başlangıçta kod sabit config'i kullanır,
  // sunucudan gelince otomatik override edilir
  const [serverConfig, setServerConfig] = useState<Record<string, RoleConfig> | null>(null);
  const activeROLE_CONFIG = serverConfig ?? ROLE_CONFIG;
  const roleConfig = activeROLE_CONFIG[userRole] ?? ROLE_CONFIG['personel'];
  const isAdmin = roleConfig.loadOzet;
  const chips = roleConfig.chips;

  // ── AI mod göstergesi (GPT mi, KV mi?) ──────────────────────────────────
  // Toggle ON  → sunucu GPT-4o mini'ye gider
  // Toggle OFF → mevcut KV tabanlı motor çalışır (hiçbir şey kilitlenmez)
  const [useOpenAI, setUseOpenAI] = useState(false); // başlangıçta bilinmiyor, KV mod

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'ai',
      text: roleConfig.welcomeText(userName),
      ts: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [ozet, setOzet] = useState<AIOzet | null>(null);
  const [ozetLoading, setOzetLoading] = useState(false);
  const [_activeMode, _setActiveMode] = useState<'brifing' | 'kestirmeler'>('brifing');
  const [brifingOpen, setBrifingOpen] = useState(true);
  const [kestirmelerOpen, setKestirmelerOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mekanModal, setMekanModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [leaveFlow, setLeaveFlow] = useState<LeaveFlowState | null>(null);
  const [rotationFlow, setRotationFlow] = useState<RotationFlowState | null>(null);
  const [rotationCancelFlow, setRotationCancelFlow] = useState<RotationCancelFlowState | null>(null);

  // KV'den config yükle ve ROLE_CONFIG'i override et
  useEffect(() => {
    authHeaders().then(headers =>
      fetch(`${API_BASE}/ai/role-config`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.config && typeof data.config === 'object') {
            // Serializable config'i RoleConfig'e dönüştür (welcomeTemplate → welcomeText fn)
            const converted: Record<string, RoleConfig> = {};
            for (const [role, cfg] of Object.entries(data.config as Record<string, any>)) {
              converted[role] = {
                ...cfg,
                welcomeText: (name: string) => (cfg.welcomeTemplate as string).replace('{name}', name),
              };
            }
            setServerConfig(converted);
            // Karşılama mesajını da güncelle (ilk mesaj)
            if (converted[userRole]) {
              const newWelcome = converted[userRole].welcomeText(userName);
              setMessages(prev => {
                if (prev.length === 1 && prev[0].id === '0') {
                  return [{ ...prev[0], text: newWelcome }];
                }
                return prev;
              });
            }
          }
        })
        .catch(() => {/* sessiz hata — fallback ROLE_CONFIG kullanılır */})
    ).catch(() => {});
  }, [userRole, userName]);

  // Scroll to bottom — sadece yeni mesaj eklenince, açılışta değil
  useEffect(() => {
    if (messages.length > 1 || isLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const loadOzet = useCallback(() => {
    if (!isAdmin) return;
    setOzetLoading(true);
    authHeaders().then(headers =>
      fetch(`${API_BASE}/ai/ozet`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.ozet) setOzet(data.ozet);
          setIsOnline(true);
        })
        .catch(() => setIsOnline(false))
        .finally(() => setOzetLoading(false))
    ).catch(() => setOzetLoading(false));
  }, [isAdmin]);

  // Load AI özet (admin only)
  useEffect(() => { loadOzet(); }, [loadOzet]);

  const handleRefresh = () => loadOzet();

  // ── İzin flow komutlarını işle ────────────────────────────────────────────
  const handleLeaveFlowCommand = useCallback(async (command: string): Promise<boolean> => {
    if (!command.startsWith('__LEAVE_')) return false;

    const makeId = () => Date.now().toString();

    // İptal
    if (command === '__LEAVE_CANCEL__') {
      setLeaveFlow(null);
      const aiMsg: Message = { id: makeId(), role: 'ai', text: 'İzin talebi iptal edildi. Başka bir konuda yardımcı olabilir miyim?', ts: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
      return true;
    }

    // Onay & Gönder
    if (command === '__LEAVE_CONFIRM__') {
      if (!leaveFlow) { setIsLoading(false); return true; }
      try {
        const isSingle   = leaveFlow.durationType === 'single';
        const startDate  = leaveFlow.startDate || new Date().toISOString().split('T')[0];
        const endDate    = isSingle ? startDate : (leaveFlow.endDate || startDate);
        const start      = new Date(startDate);
        const end        = new Date(endDate);
        const diffDays   = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const leaveNotes = (leaveFlow.notes && leaveFlow.notes !== 'SKIP') ? leaveFlow.notes : '';

        const leave: LeaveRequest = {
          id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          personnelId:     userId,
          personnelName:   userName,
          personnelAvatar: userAvatar,
          personnelRole:   userRole as any,
          startDate,
          endDate,
          days:      diffDays,
          type:      leaveFlow.leaveType || 'annual',
          notes:     leaveNotes,
          status:    'pending',
          createdAt: new Date().toISOString(),
        };

        await saveLeaveRequest(leave);

        const meta = LEAVE_TYPE_META[leave.type];
        const fmt  = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        const completedFlow: LeaveFlowState = { ...leaveFlow, completed: true };
        setLeaveFlow(null);

        const aiMsg: Message = {
          id: makeId(),
          role: 'ai',
          text: `✅ **İzin talebiniz gönderildi!**\n\n${meta.icon} ${meta.label} · ${isSingle ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`} · **${diffDays} gün**\n\nYöneticiniz onayladığında rotasyona yansıyacak.`,
          ts: new Date(),
          card: { type: 'leave_flow', data: completedFlow },
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (e) {
        console.error('İzin talebi gönderme hatası:', e);
        const aiMsg: Message = { id: makeId(), role: 'ai', text: '❌ İzin talebi gönderilirken bir hata oluştu. Lütfen tekrar dene.', ts: new Date() };
        setMessages(prev => [...prev, aiMsg]);
      }
      setIsLoading(false);
      return true;
    }

    // Tür seçimi
    if (command.startsWith('__LEAVE_TYPE_')) {
      const type = command.replace('__LEAVE_TYPE_', '').replace(/__$/, '') as 'annual' | 'sick' | 'personal';
      const newFlow: LeaveFlowState = { step: 'duration', leaveType: type };
      setLeaveFlow(newFlow);
      const meta = LEAVE_TYPE_META[type];
      const aiMsg: Message = {
        id: makeId(), role: 'ai',
        text: `${meta.icon} **${meta.label}** seçildi. Kaç günlük izin olacak?`,
        ts: new Date(),
        card: { type: 'leave_flow', data: newFlow },
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
      return true;
    }

    // Süre seçimi
    if (command.startsWith('__LEAVE_DURATION_')) {
      const durationType = command.replace('__LEAVE_DURATION_', '').replace(/__$/, '') as 'single' | 'multiple';
      const newFlow: LeaveFlowState = { ...leaveFlow, step: 'start_date', durationType };
      setLeaveFlow(newFlow);
      const aiMsg: Message = {
        id: makeId(), role: 'ai',
        text: durationType === 'single' ? '📅 Hangi tarihte izin alacaksın?' : '📅 Başlangıç tarihini seç:',
        ts: new Date(),
        card: { type: 'leave_flow', data: newFlow },
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
      return true;
    }

    // Başlangıç tarihi
    if (command.startsWith('__LEAVE_STARTDATE_')) {
      const startDate = command.replace('__LEAVE_STARTDATE_', '').replace(/__$/, '');
      const nextStep  = leaveFlow?.durationType === 'multiple' ? 'end_date' : 'notes';
      const newFlow: LeaveFlowState = { ...leaveFlow, step: nextStep as any, startDate };
      setLeaveFlow(newFlow);
      const aiMsg: Message = {
        id: makeId(), role: 'ai',
        text: nextStep === 'end_date' ? '📅 Bitiş tarihini seç:' : '📝 Nota eklemek ister misin? (isteğe bağlı)',
        ts: new Date(),
        card: { type: 'leave_flow', data: newFlow },
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
      return true;
    }

    // Bitiş tarihi
    if (command.startsWith('__LEAVE_ENDDATE_')) {
      const endDate  = command.replace('__LEAVE_ENDDATE_', '').replace(/__$/, '');
      const newFlow: LeaveFlowState = { ...leaveFlow, step: 'notes', endDate };
      setLeaveFlow(newFlow);
      const aiMsg: Message = {
        id: makeId(), role: 'ai',
        text: '📝 Nota eklemek ister misin? (isteğe bağlı)',
        ts: new Date(),
        card: { type: 'leave_flow', data: newFlow },
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
      return true;
    }

    // Not
    if (command.startsWith('__LEAVE_NOTES_')) {
      const raw   = command.replace('__LEAVE_NOTES_', '').replace(/__$/, '');
      const notes = raw === 'SKIP' ? '' : decodeURIComponent(raw);
      const newFlow: LeaveFlowState = { ...leaveFlow, step: 'confirm', notes };
      setLeaveFlow(newFlow);
      const aiMsg: Message = {
        id: makeId(), role: 'ai',
        text: '📋 Talebini kontrol et, her şey doğruysa gönder!',
        ts: new Date(),
        card: { type: 'leave_flow', data: newFlow },
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
      return true;
    }

    return false;
  }, [leaveFlow, userId, userName, userAvatar, userRole]);

  // ── Rotasyon flow komutlarını işle ────────────────────────────────────────
  const handleRotationFlowCommand = useCallback(async (command: string): Promise<boolean> => {
    if (!command.startsWith('__ROT_')) return false;
    const makeId = () => Date.now().toString();

    // İptal
    if (command === '__ROT_CANCEL__') {
      setRotationFlow(null);
      setMessages(prev => [...prev, { id: makeId(), role: 'ai', text: 'Rotasyon oluşturma iptal edildi. Başka bir konuda yardımcı olabilir miyim? 😊', ts: new Date() }]);
      setIsLoading(false);
      return true;
    }

    // İptal flow'u vazgeç
    if (command === '__ROT_CANCEL_ABORT__') {
      setRotationCancelFlow(null);
      setMessages(prev => [...prev, { id: makeId(), role: 'ai', text: 'İptal işleminden vazgeçildi. Görev aktif kalmaya devam ediyor.', ts: new Date() }]);
      setIsLoading(false);
      return true;
    }

    // Tarih seçimi
    if (command.startsWith('__ROT_DATE_')) {
      const date = command.replace('__ROT_DATE_', '').replace(/__$/, '');
      // İzinli IDs'i seçilen tarihe göre güncelle
      const allLeaves = await getLeaveRequests();
      const daily = await getDailyOnLeave();
      const staff = rotationFlow?.staffMembers || await getStaffMembers();
      const onLeaveSet = new Set<string>();
      for (const l of allLeaves) {
        if (l.status !== 'rejected' && date >= l.startDate && date <= l.endDate) onLeaveSet.add(l.personnelId);
      }
      const dailyIds: string[] = Array.isArray(daily[date]) ? daily[date] : [];
      dailyIds.forEach(id => onLeaveSet.add(id));
      staff.filter(s => s.status === 'on_leave').forEach(s => onLeaveSet.add(s.id));

      const newFlow: RotationFlowState = { ...rotationFlow, step: 'location', date, onLeaveIds: Array.from(onLeaveSet), staffMembers: staff };
      setRotationFlow(newFlow);
      const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
      setMessages(prev => [...prev, {
        id: makeId(), role: 'ai',
        text: `📅 **${fmtDate(date)}** seçildi. Hangi mekana görevlendirme yapılacak?`,
        ts: new Date(), card: { type: 'rotation_flow', data: newFlow },
      }]);
      setIsLoading(false);
      return true;
    }

    // Mekan seçimi
    if (command.startsWith('__ROT_LOC_')) {
      const raw = command.replace('__ROT_LOC_', '').replace(/__$/, '');
      const [locationId, locationName, locationIcon] = raw.split('|');
      const onLeaveCount = (rotationFlow?.onLeaveIds || []).length;
      const newFlow: RotationFlowState = { ...rotationFlow, step: 'personnel', locationId, locationName, locationIcon };
      setRotationFlow(newFlow);
      setMessages(prev => [...prev, {
        id: makeId(), role: 'ai',
        text: `📍 **${locationIcon} ${locationName}** seçildi. Kimleri görevlendireceksin?${onLeaveCount > 0 ? ` *(${onLeaveCount} kişi bugün izinli — otomatik gri gösterilecek)*` : ''}`,
        ts: new Date(), card: { type: 'rotation_flow', data: newFlow },
      }]);
      setIsLoading(false);
      return true;
    }

    // Personel seçimi tamamlandı
    if (command.startsWith('__ROT_STAFF_DONE_')) {
      const raw = command.replace('__ROT_STAFF_DONE_', '').replace(/__$/, '');
      const ids = raw.split(',').filter(Boolean);
      const allStaff = rotationFlow?.staffMembers || [];
      const selectedPersonnel = ids.map(id => {
        const s = allStaff.find(x => x.id === id);
        return s ? { id: s.id, name: s.name, avatar: s.avatar, role: s.role } : { id, name: id, avatar: '👤', role: 'personel' };
      });
      const newFlow: RotationFlowState = { ...rotationFlow, step: 'time', selectedPersonnel };
      setRotationFlow(newFlow);
      setMessages(prev => [...prev, {
        id: makeId(), role: 'ai',
        text: `👥 **${selectedPersonnel.map(p => p.name).join(', ')}** seçildi. Çalışma saatleri nedir?`,
        ts: new Date(), card: { type: 'rotation_flow', data: newFlow },
      }]);
      setIsLoading(false);
      return true;
    }

    // Saat seçimi
    if (command.startsWith('__ROT_TIME_')) {
      const raw = command.replace('__ROT_TIME_', '').replace(/__$/, '');
      const [startTime, endTime] = raw.split('|');
      const newFlow: RotationFlowState = { ...rotationFlow, step: 'confirm', startTime, endTime };
      setRotationFlow(newFlow);
      setMessages(prev => [...prev, {
        id: makeId(), role: 'ai',
        text: `⏰ **${startTime} – ${endTime}** ayarlandı. Her şey doğruysa görevi oluştur!`,
        ts: new Date(), card: { type: 'rotation_flow', data: newFlow },
      }]);
      setIsLoading(false);
      return true;
    }

    // Kaydet (draft veya sent)
    if (command === '__ROT_SAVE_draft__' || command === '__ROT_SAVE_sent__') {
      if (!rotationFlow) { setIsLoading(false); return true; }
      const status = command === '__ROT_SAVE_sent__' ? 'sent' : 'draft';
      try {
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const task: Task = {
          id: taskId,
          personnel: (rotationFlow.selectedPersonnel || []).map(p => ({
            id: p.id, name: p.name, avatar: p.avatar,
            role: p.role as any,
          })),
          location: rotationFlow.locationName || '',
          locationIcon: rotationFlow.locationIcon || '📍',
          startTime: rotationFlow.startTime || '10:00',
          endTime: rotationFlow.endTime || '18:00',
          type: 'regular',
          taskType: 'regular',
          status,
          date: rotationFlow.date || new Date().toISOString().split('T')[0],
          sentAt: status === 'sent' ? new Date().toISOString() : undefined,
        };
        await saveTask(task);
        const completedFlow: RotationFlowState = { ...rotationFlow, completed: true, taskId, taskStatus: status };
        setRotationFlow(null);
        setMessages(prev => [...prev, {
          id: makeId(), role: 'ai',
          text: status === 'sent'
            ? `✅ Rotasyon görevi **gönderildi!** ${rotationFlow.locationIcon} **${rotationFlow.locationName}** → ${rotationFlow.selectedPersonnel?.map(p => p.name).join(', ')} (${rotationFlow.startTime}–${rotationFlow.endTime})`
            : `📝 Rotasyon görevi **taslak olarak kaydedildi.** Rotasyon sisteminden gönderebilirsin.`,
          ts: new Date(), card: { type: 'rotation_flow', data: completedFlow },
        }]);
      } catch (e) {
        console.error('saveTask error:', e);
        setMessages(prev => [...prev, { id: makeId(), role: 'ai', text: '❌ Görev kaydedilirken hata oluştu. Lütfen tekrar dene.', ts: new Date() }]);
      }
      setIsLoading(false);
      return true;
    }

    // ── İptal flow komutları ──────────────────────────────────────────────
    // Görev seçildi → onay sor
    if (command.startsWith('__ROT_CANCEL_SELECT_')) {
      const raw = command.replace('__ROT_CANCEL_SELECT_', '').replace(/__$/, '');
      const [taskId, taskLocation] = raw.split('|');
      const newState: RotationCancelFlowState = { ...(rotationCancelFlow || {}), step: 'confirm', selectedTaskId: taskId, selectedTaskLocation: taskLocation };
      setRotationCancelFlow(newState);
      setMessages(prev => [...prev, {
        id: makeId(), role: 'ai',
        text: `**${taskLocation}** görevini iptal etmek istediğinden emin misin?`,
        ts: new Date(), card: { type: 'rotation_cancel_flow', data: newState },
      }]);
      setIsLoading(false);
      return true;
    }

    // İptal onaylandı → görevi güncelle
    if (command.startsWith('__ROT_CANCEL_CONFIRM_')) {
      const taskId = command.replace('__ROT_CANCEL_CONFIRM_', '').replace(/__$/, '');
      try {
        await updateTask(taskId, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: 'Aspect AI tarafından iptal edildi' });
        const completedState: RotationCancelFlowState = { ...(rotationCancelFlow || {}), completed: true };
        setRotationCancelFlow(null);
        setMessages(prev => [...prev, {
          id: makeId(), role: 'ai',
          text: `✅ **${rotationCancelFlow?.selectedTaskLocation}** görevi başarıyla iptal edildi.`,
          ts: new Date(), card: { type: 'rotation_cancel_flow', data: completedState },
        }]);
      } catch (e) {
        console.error('updateTask cancel error:', e);
        setMessages(prev => [...prev, { id: makeId(), role: 'ai', text: '❌ Görev iptal edilirken hata oluştu.', ts: new Date() }]);
      }
      setIsLoading(false);
      return true;
    }

    return false;
  }, [rotationFlow, rotationCancelFlow]);

  // ── Kullanıcıya gösterilen display text map'i ────────────────────────────
  const getDisplayText = (text: string): string => {
    const map: Record<string, string> = {
      '__IZIN_GECMISIM__':          '📅 İzin geçmişimi göster',
      '__LEAVE_REQUEST__':          '🏖️ İzin talebi oluşturmak istiyorum',
      '__LEAVE_TYPE_annual__':      '🏖️ Yıllık İzin',
      '__LEAVE_TYPE_sick__':        '🤒 Hastalık İzni',
      '__LEAVE_TYPE_personal__':    '📋 Mazeret İzni',
      '__LEAVE_DURATION_single__':  '📅 1 Günlük',
      '__LEAVE_DURATION_multiple__':'📆 Birden Fazla Gün',
      '__LEAVE_CANCEL__':           '❌ İptal et',
      '__LEAVE_CONFIRM__':          '✅ Talebi gönder',
      '__LEAVE_NOTES_SKIP__':       'Geç →',
      '__LEAVE_CONFIRM_YES__':      '✅ Evet, izin talebi oluştur',
      '__LEAVE_CONFIRM_NO__':       '❌ Hayır, teşekkürler',
      '__ROT_CREATE__':             '🗓️ AI ile rotasyon oluştur',
      '__ROT_SUGGEST__':            '🤖 Rotasyon öner',
      '__ROT_CANCEL__':             '❌ İptal',
      '__ROT_SAVE_draft__':         '📝 Taslak olarak kaydet',
      '__ROT_SAVE_sent__':          '✈️ Gönder',
      '__ROT_CANCEL_ABORT__':       '← Vazgeç',
    };
    if (text.startsWith('__ROT_DATE_')) {
      const d = text.replace('__ROT_DATE_', '').replace(/__$/, '');
      return `📅 ${new Date(d).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    }
    if (text.startsWith('__ROT_LOC_')) {
      const raw = text.replace('__ROT_LOC_', '').replace(/__$/, '');
      const [, name, icon] = raw.split('|');
      return `${icon || '📍'} ${name}`;
    }
    if (text.startsWith('__ROT_STAFF_DONE_')) {
      return '👥 Personel seçimi tamamlandı';
    }
    if (text.startsWith('__ROT_TIME_')) {
      const raw = text.replace('__ROT_TIME_', '').replace(/__$/, '');
      const [s, e] = raw.split('|');
      return `⏰ ${s} – ${e}`;
    }
    if (text.startsWith('__ROT_CANCEL_SELECT_')) {
      const raw = text.replace('__ROT_CANCEL_SELECT_', '').replace(/__$/, '');
      const [, loc] = raw.split('|');
      return `🚫 ${loc} görevini iptal et`;
    }
    if (text.startsWith('__ROT_CANCEL_CONFIRM_')) {
      return '✅ Evet, iptal et';
    }
    if (map[text]) return map[text];
    if (text.startsWith('__LEAVE_STARTDATE_')) {
      const d = text.replace('__LEAVE_STARTDATE_', '').replace(/__$/, '');
      return `📅 Başlangıç: ${new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`;
    }
    if (text.startsWith('__LEAVE_ENDDATE_')) {
      const d = text.replace('__LEAVE_ENDDATE_', '').replace(/__$/, '');
      return `📅 Bitiş: ${new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`;
    }
    if (text.startsWith('__LEAVE_NOTES_')) {
      const raw = text.replace('__LEAVE_NOTES_', '').replace(/__$/, '');
      return raw === 'SKIP' ? 'Geç →' : `Not: ${decodeURIComponent(raw)}`;
    }
    return text;
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const displayText = getDisplayText(text.trim());
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: displayText, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // İzin onay red cevabı
    if (text.trim() === '__LEAVE_CONFIRM_NO__') {
      await new Promise(r => setTimeout(r, 400));
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: 'Tamam, başka bir konuda yardımcı olabilir miyim? 😊',
        ts: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
      return;
    }

    // İzin onay evet — flow başlat
    if (text.trim() === '__LEAVE_CONFIRM_YES__') {
      await new Promise(r => setTimeout(r, 400));
      const newFlow: LeaveFlowState = { step: 'type' };
      setLeaveFlow(newFlow);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: '🏖️ İzin talebi oluşturalım! Önce izin türünü seç:',
        ts: new Date(),
        card: { type: 'leave_flow', data: newFlow },
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
      return;
    }

    // İzin flow komutlarını önce işle
    if (text.trim().startsWith('__LEAVE_')) {
      await handleLeaveFlowCommand(text.trim());
      return;
    }

    // Rotasyon flow komutlarını işle (başlatma komutları hariç — onlar generateAIResponse'a gider)
    const rotCmd = text.trim();
    if (rotCmd.startsWith('__ROT_') && rotCmd !== '__ROT_CREATE__' && rotCmd !== '__ROT_SUGGEST__') {
      await handleRotationFlowCommand(rotCmd);
      return;
    }

    // ── GPT modu: sunucuya sor ─────────────────────────────────────────────
    try {
      const headers = await authHeaders();
      const recentMsgs = messages.slice(-6).map(m => ({
        role: m.role,
        text: m.text,
      }));
      recentMsgs.push({ role: 'user', text: text.trim() });

      // Rol bazlı filtrelenmiş ozet verisini hazırla
      // yonetici → tüm veriler | diğerleri → sadece stok (kişisel veriler server'da KV'den çekilir)
      const isYonetici = userRole === 'yonetici';
      const ozetPayload = ozet ? (isYonetici ? {
        tarih: ozet.tarihTR,
        toplamCiro: ozet.toplamCiro,
        toplamSatisAdet: ozet.toplamSatisAdet,
        toplamIskonto: ozet.toplamIskonto,
        toplamKare: ozet.toplamKare,
        mekanSayisi: ozet.mekanSayisi,
        aktifMekanSayisi: ozet.aktifMekanSayisi,
        mekanlar: ozet.mekanlar.map(m => ({
          id: m.id, name: m.name, emoji: m.emoji,
          ciro: m.ciro, satisAdet: m.satisAdet, iskonto: m.iskonto,
          acilisYapildi: m.acilisYapildi, kapanisYapildi: m.kapanisYapildi,
        })),
        stokDurum: ozet.stokDurum,
        mekanBazliStok: ozet.mekanBazliStok,
        anomaliler: ozet.anomaliler,
        personelSiralama: ozet.personelSiralama,
        albumSatisDokumu: ozet.albumSatisDokumu,
        odemeDagilimi: ozet.odemeDagilimi,
        guncellemeZamani: ozet.guncellemeZamani,
      } : {
        // Diğer roller için sadece stok — finansal veri gönderilmez
        stokDurum: ozet.stokDurum,
        mekanBazliStok: ozet.mekanBazliStok,
      }) : null;

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: recentMsgs,
          userRole,
          userName,
          ozet: ozetPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.use_kv && data.reply) {
          // GPT yanıtı geldi
          setUseOpenAI(true);
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'ai',
            text: data.reply,
            ts: new Date(),
          };
          setMessages(prev => [...prev, aiMsg]);
          setIsLoading(false);
          return;
        }
        // use_kv: true → KV motoruna düş
        setUseOpenAI(false);
      }
    } catch (e) {
      console.error('[AI Chat] GPT isteği başarısız, KV moduna düşülüyor:', e);
      setUseOpenAI(false);
    }

    // ── KV Motoru (Toggle OFF veya GPT hata) ──────────────────────────────
    await new Promise(r => setTimeout(r, 700 + Math.random() * 600));

    const result = generateAIResponse(text.trim(), userRole, ozet, activeROLE_CONFIG);

    let aiText: string;
    let aiCard: ResponseCard | undefined;

    if (result === 'GOLDEN_HOUR') {
      const ghResult = await fetchAltiSaat();
      aiText = ghResult.text;
      aiCard = ghResult.card;
    } else if (result === 'BUGUN_IZINLILER') {
      const izinlilerResult = await fetchBugunIzinliler();
      aiText = izinlilerResult.text;
      aiCard = izinlilerResult.card;
    } else if (result === 'DUN_IZINLILER') {
      const now2 = new Date();
      const trOff = 3 * 60;
      const nowTR2 = new Date(now2.getTime() + (trOff - now2.getTimezoneOffset()) * 60000);
      const dunStr = new Date(nowTR2.getTime() - 86400000).toISOString().split('T')[0];
      const dunResult = await fetchBugunIzinliler(dunStr);
      aiText = dunResult.text;
      aiCard = dunResult.card;
    } else if (result === 'INDIRIM_ANALIZI') {
      const indirimResult = await fetchIndirimAnalizi(text.trim());
      aiText = indirimResult.text;
    } else if (result === 'ANOMALI_ANALIZI') {
      const anomaliResult = await fetchAnomaliAnalizi(text.trim());
      aiText = anomaliResult.text;
    } else if (result === 'SATIS_ANALIZI') {
      const satisResult = await fetchSatisAnalizi(text.trim());
      aiText = satisResult.text;
    } else if (result === 'IZIN_ANALIZI') {
      const staff = await getStaffMembers();
      const analizResult = await fetchIzinAnalizi(text.trim(), staff);
      aiText = analizResult.text;
    } else if (result === 'IZIN_GECMISI') {
      const izinResult = await fetchIzinGecmisi(userId, userName);
      aiText = izinResult.text;
      aiCard = izinResult.card;
    } else if (result === 'LEAVE_REQUEST') {
      const newFlow: LeaveFlowState = { step: 'type' };
      setLeaveFlow(newFlow);
      aiText = '🏖️ İzin talebi oluşturalım! Önce izin türünü seç:';
      aiCard = { type: 'leave_flow', data: newFlow };
    } else if (result === 'LEAVE_CONFIRM') {
      aiText = 'İzin talebi oluşturmak mı istiyorsunuz? 🏖️';
      aiCard = { type: 'leave_confirm', data: { answered: false } };
    } else if (result === 'ROTATION_CREATE') {
      // Rotasyon verilerini yükle
      try {
        const loadingFlow: RotationFlowState = { step: 'loading' };
        setRotationFlow(loadingFlow);
        const [locs, staff] = await Promise.all([getLocations(), getStaffMembers()]);
        const nowTR = new Date(Date.now() + (3 * 60 - new Date().getTimezoneOffset()) * 60000);
        const todayStr = nowTR.toISOString().split('T')[0];
        const todayLeaves = await getLeaveRequests();
        const todayDaily = await getDailyOnLeave();
        const onLeaveSet = new Set<string>();
        for (const l of todayLeaves) {
          if (l.status !== 'rejected' && todayStr >= l.startDate && todayStr <= l.endDate) onLeaveSet.add(l.personnelId);
        }
        (Array.isArray(todayDaily[todayStr]) ? todayDaily[todayStr] : []).forEach((id: string) => onLeaveSet.add(id));
        staff.filter(s => s.status === 'on_leave').forEach(s => onLeaveSet.add(s.id));
        const readyFlow: RotationFlowState = { step: 'date', locations: locs, staffMembers: staff, onLeaveIds: Array.from(onLeaveSet) };
        setRotationFlow(readyFlow);
        aiText = '🗓️ Rotasyon oluşturalım! Önce tarihi seç:';
        aiCard = { type: 'rotation_flow', data: readyFlow };
      } catch (e) {
        console.error('ROTATION_CREATE veri yükleme hatası:', e);
        setRotationFlow(null);
        aiText = 'Rotasyon verilerine şu an ulaşılamadı. Lütfen tekrar dene.';
      }
    } else if (result === 'ROTATION_CANCEL') {
      // İptal edilecek görevleri yükle
      try {
        const nowTR = new Date(Date.now() + (3 * 60 - new Date().getTimezoneOffset()) * 60000);
        const todayStr = nowTR.toISOString().split('T')[0];
        const tasks = await getTasks();
        const todayTasks = tasks.filter(t => t.date === todayStr && t.status !== 'cancelled');
        const cancelState: RotationCancelFlowState = { step: 'select', date: todayStr, tasks: todayTasks };
        setRotationCancelFlow(cancelState);
        if (todayTasks.length === 0) {
          aiText = `📅 Bugün (${todayStr}) iptal edilebilecek aktif görev bulunamadı.`;
        } else {
          aiText = `🚫 Bugün **${todayTasks.length} aktif görev** var. Hangisini iptal etmek istiyorsun?`;
          aiCard = { type: 'rotation_cancel_flow', data: cancelState };
        }
      } catch (e) {
        console.error('ROTATION_CANCEL veri yükleme hatası:', e);
        aiText = 'Görev verileri yüklenirken hata oluştu. Lütfen tekrar dene.';
      }
    } else if (result === 'ROTATION_SUGGEST') {
      // Müsait personel önerisi
      try {
        const nowTR = new Date(Date.now() + (3 * 60 - new Date().getTimezoneOffset()) * 60000);
        const todayStr = nowTR.toISOString().split('T')[0];
        const tomorrowStr = new Date(nowTR.getTime() + 86400000).toISOString().split('T')[0];
        const targetDate = text.toLowerCase().includes('yarın') ? tomorrowStr : todayStr;
        const [locs, staff, leaves, daily] = await Promise.all([getLocations(), getStaffMembers(), getLeaveRequests(), getDailyOnLeave()]);
        const onLeaveSet = new Set<string>();
        for (const l of leaves) {
          if (l.status !== 'rejected' && targetDate >= l.startDate && targetDate <= l.endDate) onLeaveSet.add(l.personnelId);
        }
        (Array.isArray(daily[targetDate]) ? daily[targetDate] : []).forEach((id: string) => onLeaveSet.add(id));
        staff.filter(s => s.status === 'on_leave').forEach(s => onLeaveSet.add(s.id));
        const available = staff.filter(s => !onLeaveSet.has(s.id));
        const onLeave = staff.filter(s => onLeaveSet.has(s.id));
        const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
        // Basit dağıtım önerisi: personeli mekan sayısına böl
        const locCount = locs.length;
        const avgPerLoc = locCount > 0 ? Math.ceil(available.length / locCount) : 0;
        let suggestion = `📊 **${fmtDate(targetDate)}** için rotasyon analizi:\n\n`;
        suggestion += `✅ **Müsait (${available.length} kişi):** ${available.map(s => s.name.split(' ')[0]).join(', ')}\n`;
        if (onLeave.length > 0) suggestion += `🏖️ **İzinli (${onLeave.length} kişi):** ${onLeave.map(s => s.name.split(' ')[0]).join(', ')}\n`;
        suggestion += `\n📍 **${locCount} mekan** için önerilen dağılım (mekan başı ~${avgPerLoc} kişi):\n`;
        locs.forEach((loc, i) => {
          const assigned = available.slice(i * avgPerLoc, (i + 1) * avgPerLoc);
          suggestion += `• ${loc.icon || '📍'} **${loc.name}**: ${assigned.length > 0 ? assigned.map(s => s.name.split(' ')[0]).join(', ') : '— atanacak personel yok'}\n`;
        });
        suggestion += `\nRotasyon oluşturmak için **"Rotasyon Oluştur"** chip'ini kullan veya "rotasyon oluştur" yaz.`;
        aiText = suggestion;
      } catch (e) {
        console.error('ROTATION_SUGGEST hatası:', e);
        aiText = 'Rotasyon önerisi oluşturulurken hata oluştu.';
      }
    } else {
      aiText = result.text;
      aiCard = result.card;
    }

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      text: aiText,
      ts: new Date(),
      card: aiCard,
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  }, [isLoading, ozet, userRole, activeROLE_CONFIG, userName, userId, handleLeaveFlowCommand, handleRotationFlowCommand, messages]);

  const initialMessage: Message = {
    id: '0',
    role: 'ai',
    text: roleConfig.welcomeText(userName),
    ts: new Date(),
  };

  const handleClearMessages = () => {
    setMessages([{ ...initialMessage, ts: new Date() }]);
  };

  const handleChip = (q: string) => {
    if (q === '__MEKAN_DETAY_MODAL__') {
      if (!ozet || ozet.mekanlar.length === 0) {
        sendMessage('Mekan detayı için önce vardiya açılışı yapılmalı.');
        return;
      }
      setMekanModal(true);
      return;
    }
    sendMessage(q);
  };


  const handleSend = () => sendMessage(input);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Tarayıcınız ses tanımayı desteklemiyor. Chrome veya Safari kullanın.');
      return;
    }

    // Dinleme aktifse durdur
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const rec = new SR();
    rec.lang = 'tr-TR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => setIsListening(true);
    rec.onend   = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      // Metni input'a yaz ve direkt gönder
      sendMessage(transcript);
    };

    try {
      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  // Derived display name: "Özgür D." style
  const _nameParts = userName.trim().split(' ');

  const handleMekanSec = async (mekan: AIOzet['mekanlar'][0]) => {
    setMekanModal(false);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: `📍 ${mekan.emoji} ${mekan.name} mekanının detaylı bilgisini göster`,
      ts: new Date(),
    };
    // Yükleniyor placeholder mesajı ekle
    const loadingMsgId = (Date.now() + 1).toString();
    const loadingMsg: Message = {
      id: loadingMsgId,
      role: 'ai',
      text: `**${mekan.emoji} ${mekan.name}** verileri yükleniyor...`,
      ts: new Date(),
      card: { type: 'mekan_detay', data: { ...mekan, yukleniyor: true } },
    };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    // Gerçek verileri paralel çek
    const today = new Date().toISOString().split('T')[0];
    let satislar: VardiyaSatis[] = [];
    let albumMaliyetleri: AlbumMaliyet[] = [];
    let printType: 'tam' | 'yarim' = 'yarim';
    let vardiyaToplam: MekanDetayData['vardiyaToplam'] = null;
    let personelListesi: MekanDetayData['personelListesi'] = [];
    let kiraMaliyeti = 0;

    try {
      const headers = await authHeaders();
      const [stokRes, maliyetRes, mekanlarRes, rotasyonRes] = await Promise.all([
        fetch(`${API_BASE}/stok/gunluk/${mekan.id}/${today}`, { headers }),
        fetch(`${API_BASE}/maliyetler`, { headers }),
        fetch(`${API_BASE}/mekanlar`, { headers }),
        fetch(`${API_BASE}/rotasyon/gorevler`, { headers }),
      ]);

      if (stokRes.ok) {
        const stokData = await stokRes.json();
        satislar = (stokData.bugun?.satislar || []).filter((s: any) => !s.iptal);
        if (stokData.bugun?.vardiyaToplam) {
          vardiyaToplam = stokData.bugun.vardiyaToplam;
        }
      }

      let salaries: any[] = [];
      if (maliyetRes.ok) {
        const malData = await maliyetRes.json();
        albumMaliyetleri = malData.albums || [];
        salaries = malData.salaries || [];
      }

      let yearlyRent = 0;
      if (mekanlarRes.ok) {
        const mekanData = await mekanlarRes.json();
        const mekanDetay = (mekanData.mekanlar || []).find((m: any) => m.id === mekan.id);
        if (mekanDetay?.printType) printType = mekanDetay.printType;
        yearlyRent = Number(mekanDetay?.yearlyRent) || 0;
      }
      kiraMaliyeti = yearlyRent > 0 ? parseFloat((yearlyRent / 365).toFixed(2)) : 0;

      // Rotasyondan bugün bu mekanda çalışan personeli bul
      if (rotasyonRes.ok) {
        const rotData = await rotasyonRes.json();
        const allTasks: any[] = rotData.tasks || [];
        // task.location = mekan adı (string), today = YYYY-MM-DD
        const bugunPersonelMap: Record<string, string> = {};
        for (const task of allTasks) {
          if (task.date !== today) continue;
          if (task.status === 'cancelled') continue;
          // location mekan adıyla eşleştir
          if (task.location !== mekan.name) continue;
          for (const p of (task.personnel || [])) {
            if (p?.id && !bugunPersonelMap[p.id]) {
              bugunPersonelMap[p.id] = p.name || 'Bilinmiyor';
            }
          }
        }
        personelListesi = Object.entries(bugunPersonelMap).map(([id, name]) => {
          const salary = salaries.find((s: any) => s.userId === id);
          const gunlukMaas = salary
            ? parseFloat(((salary.amount / 30) * (1 + (salary.extraCostPercentage || 0) / 100)).toFixed(2))
            : 0;
          return { id, name, gunlukMaas, hasMaas: !!salary };
        });
      }
    } catch (e) {
      console.error('Mekan detay veri yükleme hatası:', e);
    }

    // Placeholder'ı gerçek veriyle güncelle
    const enrichedData: MekanDetayData = { ...mekan, satislar, albumMaliyetleri, printType, vardiyaToplam, personelListesi, kiraMaliyeti, yukleniyor: false };
    const aiText = `**${mekan.emoji} ${mekan.name}** için bugünün detayları:\n${mekan.satisAdet > 0 ? `${mekan.satisAdet} satış ile ₺${mekan.ciro.toLocaleString('tr-TR')} ciro sağlandı.` : 'Henüz satış kaydı yok.'} ${mekan.kapanisYapildi ? 'Vardiya kapanışı tamamlandı.' : mekan.acilisYapildi ? 'Vardiya hâlâ açık.' : 'Açılış yapılmamış.'}`;

    setMessages(prev => prev.map(m =>
      m.id === loadingMsgId
        ? { ...m, text: aiText, card: { type: 'mekan_detay', data: enrichedData } }
        : m
    ));
    setIsLoading(false);
  };

  return (
    <div
      className="flex flex-col bg-gradient-to-br from-[#0a051e] via-[#120830] to-[#1a0a3c] overflow-hidden"
      style={{ height: 'calc(100vh - 60px - 51px)' }}
    >
      {/* Mekan Seçim Modalı */}
      {mekanModal && ozet && (
        <MekanSecModal
          mekanlar={ozet.mekanlar}
          onSelect={handleMekanSec}
          onClose={() => setMekanModal(false)}
        />
      )}

      {/* AI Ayarları Overlay */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-[#0a051e] overflow-y-auto">
          <AspectAISettings
            userRole={userRole}
            onBack={() => setShowSettings(false)}
            onSaved={() => {
              // Kaydedilen config'i yeniden yükle
              setTimeout(async () => {
                try {
                  const headers = await authHeaders();
                  const res = await fetch(`${API_BASE}/ai/role-config`, { headers });
                  const data = await res.json();
                  if (data?.config && typeof data.config === 'object') {
                    const converted: Record<string, RoleConfig> = {};
                    for (const [role, cfg] of Object.entries(data.config as Record<string, any>)) {
                      converted[role] = {
                        ...cfg,
                        welcomeText: (name: string) => (cfg.welcomeTemplate as string).replace('{name}', name),
                      };
                    }
                    setServerConfig(converted);
                  }
                } catch (e) {
                  console.error('Config reload error:', e);
                }
              }, 300);
            }}
          />
        </div>
      )}
      {/* ── SUB-HEADER — sabit, asla kımıldamaz ── */}
      <div className="shrink-0 px-4 pt-3 pb-3 bg-[rgba(10,5,30,0.92)] backdrop-blur-xl border-b border-white/8">
        <div className="flex items-center gap-2">
          {/* Brain icon */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
            <Brain className="w-4.5 h-4.5 text-white" />
          </div>
          {/* Title */}
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-white leading-tight">Aspect AI</span>
            {useOpenAI && (
              <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 600, letterSpacing: '0.04em' }}>
                ✦ GPT-4o mini
              </span>
            )}
          </div>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-1.5">
            {/* AI Ayarları — sadece yonetici */}
            {userRole === 'yonetici' && (
              <button
                onClick={() => setShowSettings(true)}
                className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-all hover:bg-violet-500/20 hover:border-violet-500/30"
                title="AI Ayarları"
              >
                <Settings className="w-3.5 h-3.5 text-white/60" />
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={ozetLoading}
              className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-all"
              title="Veriyi Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white/60 ${ozetLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Sohbeti Temizle */}
            {messages.length > 1 && (
              <button
                onClick={handleClearMessages}
                className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-all hover:bg-red-500/20 hover:border-red-500/30 group"
                title="Sohbeti Temizle"
              >
                <Trash2 className="w-3.5 h-3.5 text-white/50 group-hover:text-red-400 transition-colors" />
              </button>
            )}

            {/* Brifing toggle */}
            <button
              onClick={() => setBrifingOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                brifingOpen
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
                  : 'bg-white/8 border border-white/15 text-white/55'
              }`}
            >
              <Zap className="w-3 h-3" />
              Brifing
            </button>

            {/* Kestirmeler toggle */}
            <button
              onClick={() => setKestirmelerOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                kestirmelerOpen
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
                  : 'bg-white/8 border border-white/15 text-white/55'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              Kestirmeler
            </button>
          </div>
        </div>

        {/* Online status line */}
        <div className="flex items-center gap-1.5 mt-1.5 pl-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-[10px] text-white/35">
            {useOpenAI ? 'GPT-4o mini' : 'KV Tabanlı'} · {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
          </span>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">

        {/* GÜNLÜK BRİFİNG card — brifingOpen + admin */}
        {brifingOpen && isAdmin && (
          <div className="mt-4">
            <DailyBriefingTopCard
              ozet={ozet}
              loading={ozetLoading}
              onDetay={() => sendMessage('Bugünkü operasyon özetini göster')}
              onAnomali={() => sendMessage('Bugün anomali var mı?')}
            />
          </div>
        )}

        {/* KESTİRMELER 2×3 grid */}
        {kestirmelerOpen && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-3">
              <MessageSquare className="w-3 h-3 text-white/30" />
              <span className="text-[10px] font-bold text-white/30 tracking-widest uppercase">Kestirmeler</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {chips.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => handleChip(chip.q)}
                  disabled={isLoading}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/6 border border-white/10 text-left hover:bg-white/10 active:scale-95 transition-all disabled:opacity-40"
                >
                  <span className="text-xl leading-none">{chip.icon}</span>
                  <span className="text-xs font-medium text-white/75">{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Time divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/8" />
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-white/25" />
            <span className="text-[10px] text-white/30">Bugün</span>
          </div>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Chat messages */}
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onFlowAction={(cmd) => sendMessage(cmd)}
              isLastMsg={idx === messages.length - 1}
              onNavigate={onNavigate}
            />
          ))}
          {isLoading && <TypingIndicator />}
        </div>

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* ── INPUT BAR — sabit, asla kımıldamaz ── */}
      <div className="shrink-0 px-4 pt-2 pb-3 bg-[rgba(10,5,30,0.92)] backdrop-blur-xl border-t border-white/8">
        <div className="flex items-center gap-3 bg-white/6 border border-white/12 rounded-2xl px-4 py-3">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bir şey sor..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
            disabled={isLoading}
          />
          {/* Mikrofon butonu */}
          <button
            onClick={handleMic}
            disabled={isLoading}
            title={isListening ? 'Dinlemeyi durdur' : 'Sesli sor'}
            className="relative w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30 transition-all active:scale-90 shrink-0"
            style={{
              background: isListening
                ? 'rgba(239,68,68,0.25)'
                : 'rgba(255,255,255,0.08)',
              border: isListening
                ? '1px solid rgba(239,68,68,0.5)'
                : '1px solid rgba(255,255,255,0.12)',
              boxShadow: isListening ? '0 0 12px rgba(239,68,68,0.4)' : 'none',
            }}
          >
            <Mic
              className="w-4 h-4 transition-colors"
              style={{ color: isListening ? '#f87171' : 'rgba(255,255,255,0.5)' }}
            />
            {isListening && (
              <span
                className="absolute w-10 h-10 rounded-full animate-ping"
                style={{ background: 'rgba(239,68,68,0.2)', pointerEvents: 'none' }}
              />
            )}
          </button>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-[#8b5cf6] flex items-center justify-center disabled:opacity-30 transition-all active:scale-90 shadow-lg shadow-violet-500/40 shrink-0"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />
            }
          </button>
        </div>
      </div>

    </div>
  );
}