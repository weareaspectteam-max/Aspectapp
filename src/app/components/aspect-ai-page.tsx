import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, ChevronDown, ChevronUp,
  Package,
  AlertTriangle, CheckCircle, Zap,
  RefreshCw, Clock,
  Brain, MessageSquare, Loader2, Trash2, Settings,
} from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';
import type { VardiyaSatis } from '../services/stock-service';
import { getLeaveRequests, type LeaveRequest } from '../services/rotation-service';
import { AspectAISettings } from './aspect-ai-settings';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

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
  type: 'briefing' | 'profit' | 'stock' | 'personnel' | 'anomaly' | 'tip' | 'payment' | 'golden_hour' | 'mekan_detay' | 'izin';
  data: any;
}

interface AspectAIProps {
  userRole?: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  userName?: string;
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
  anomaliler: { mekan: string; mekanEmoji: string; type: string; detail: any }[];
  personelSiralama: { ad: string; ciro: number; satis: number }[];
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
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '💰', label: 'Ciro & Kâr', q: 'Bugün toplam ciro ne kadar?' },
      { icon: '🏆', label: 'En İyi Mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
      { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
      { icon: '💳', label: 'Ödeme Dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
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
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '🏆', label: 'En İyi Mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '💳', label: 'Ödeme Dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
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
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
      { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
      { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
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
      { icon: '📍', label: 'Mekan Detay', q: '__MEKAN_DETAY_MODAL__' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
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
      { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
      { icon: '📊', label: 'Günlük Özet', q: 'Bugünkü operasyon özetini göster' },
      { icon: '📦', label: 'Stok Durumu', q: 'Stok durumu nedir?' },
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
      { icon: '❓', label: 'Satış Kaydı', q: 'Nasıl satış kaydederim?' },
      { icon: '🌅', label: 'Altın Saat', q: 'Bugün Fethiye altın saat kaçta?' },
      { icon: '📅', label: 'İzin Geçmişim', q: '__IZIN_GECMISIM__' },
    ],
    welcomeText: (name) => `Merhaba **${name}**! Ben Aspect AI. Stok durumu, çekim teknikleri veya satış süreci hakkında sorularına yardımcı olabilirim!`,
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

async function fetchIzinGecmisi(userName: string): Promise<{ text: string; card: ResponseCard }> {
  try {
    const leaves = await getLeaveRequests();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Kullanıcıya ait onaylı izinleri son 30 günle kesişen şekilde filtrele
    const myLeaves = leaves.filter(l => {
      const nameLower = l.personnelName.toLowerCase();
      const userLower = userName.toLowerCase();
      const nameMatch = nameLower.includes(userLower.split(' ')[0]) ||
                        userLower.includes(nameLower.split(' ')[0]);
      const leaveEnd = new Date(l.endDate);
      return nameMatch && l.status === 'approved' && leaveEnd >= thirtyDaysAgo;
    });

    // İzin günlerini hesapla (30 gün penceresi ile kesişen kısım)
    let totalLeaveDays = 0;
    let annualDays = 0, sickDays = 0, personalDays = 0;

    for (const l of myLeaves) {
      const start = new Date(Math.max(new Date(l.startDate).getTime(), thirtyDaysAgo.getTime()));
      const end = new Date(Math.min(new Date(l.endDate).getTime(), now.getTime()));
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const clampedDays = Math.max(0, Math.min(diffDays, l.days));
      totalLeaveDays += clampedDays;
      if (l.type === 'annual') annualDays += clampedDays;
      else if (l.type === 'sick') sickDays += clampedDays;
      else personalDays += clampedDays;
    }

    // Turizm işletmesi 7 gün çalışır — takvim günü baz alınır
    const totalCalendarDays = 30;
    const estimatedWorkDays = Math.max(0, totalCalendarDays - totalLeaveDays);

    let text = '';
    if (totalLeaveDays === 0) {
      text = `📅 Son 30 günde onaylı izin kaydın bulunmuyor.\n\n${totalCalendarDays} günün tamamında aktif çalışıyorsun! 💪`;
    } else {
      text = `📅 **Son 30 gün özeti:**\n\n• 🏖️ Toplam **${totalLeaveDays} gün** izin kullandın\n• 💼 Tahminen **${estimatedWorkDays} gün** aktif çalıştın`;
      if (annualDays > 0) text += `\n• Yıllık izin: ${annualDays} gün`;
      if (sickDays > 0) text += `\n• Hastalık izni: ${sickDays} gün`;
      if (personalDays > 0) text += `\n• Mazeret izni: ${personalDays} gün`;
    }

    return {
      text,
      card: {
        type: 'izin',
        data: { myLeaves, totalLeaveDays, annualDays, sickDays, personalDays, totalCalendarDays, estimatedWorkDays, userName },
      },
    };
  } catch (e) {
    console.error('fetchIzinGecmisi error:', e);
    return {
      text: `İzin geçmişine şu an ulaşılamadı. Rotasyon modülüne bağlanamadım.`,
      card: { type: 'tip', data: { title: 'İzin Geçmişi', icon: '📅' } },
    };
  }
}

// ─── AI Response Engine (gerçek KV verisi kullanır) ───────────────────────────

function generateAIResponse(q: string, role: string, ozet: AIOzet | null, configMap?: Record<string, RoleConfig>): { text: string; card?: ResponseCard } | 'GOLDEN_HOUR' | 'IZIN_GECMISI' {
  const lower = q.toLowerCase();
  const map = configMap ?? ROLE_CONFIG;
  const config = map[role] ?? ROLE_CONFIG['personel'];
  const isAdmin = config.loadOzet;

  // Altın saat — async flag döndür
  if (lower.includes('altın saat') || lower.includes('altin saat') || lower.includes('golden hour') || lower.includes('gün batımı saati') || lower.includes('günbatımı')) {
    return 'GOLDEN_HOUR';
  }

  // İzin geçmişi — async flag döndür
  if (q === '__IZIN_GECMISIM__' || lower.includes('izin geçmişim') || lower.includes('izin geçmiş') || lower.includes('kaç gün izin') || lower.includes('ne kadar izin') || lower.includes('izin istatistik') || lower.includes('çalışma geçmiş')) {
    return 'IZIN_GECMISI';
  }

  // Rol bazlı erişim engeli
  if (config.blockedKeywords.length > 0 && config.blockedKeywords.some(k => lower.includes(k))) {
    return { text: config.blockedMessage };
  }

  // Veri yok durumu
  if (!ozet) {
    return {
      text: isAdmin
        ? `Şu an gerçek veri yüklenemedi. Demo modundayım. Bağlantı sorunu yaşanıyor olabilir — sayfayı yenileyerek tekrar deneyebilirsin.`
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
    return {
      text: `**${d.tarihTR}** — **${d.mekanSayisi} mekanda** toplam **${d.toplamSatisAdet} satış** gerçekleşti. ${bestMekan ? `En yüksek ciro **${bestMekan.emoji} ${bestMekan.name}** mekanından (₺${bestMekan.ciro.toLocaleString('tr-TR')}).` : ''} ${d.anomaliler.length > 0 ? `⚠️ **${d.anomaliler.length} anomali** dikkat bekliyor.` : ''}`,
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
      text: `**${d.tarihTR}** ciro: **₺${d.toplamCiro.toLocaleString('tr-TR')}** — ${d.toplamSatisAdet} satıştan elde edildi. İskonto kaybı **₺${d.toplamIskonto.toLocaleString('tr-TR')}**. ${bestMekan ? `En iyi mekan **${bestMekan.emoji} ${bestMekan.name}** ile ₺${bestMekan.ciro.toLocaleString('tr-TR')}.` : ''}`,
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

  // Anomali
  if (lower.includes('anomali') || lower.includes('sorun') || lower.includes('uyarı') || lower.includes('problem')) {
    if (d.anomaliler.length === 0) {
      return {
        text: `✅ Bugün hiç anomali tespit edilmedi! Tüm mekanlar stok uyumlu çalışıyor.`,
        card: { type: 'anomaly', data: [] },
      };
    }
    return {
      text: `⚠️ Bugün **${d.anomaliler.length} anomali** tespit edildi: ${d.anomaliler.map(a => `${a.mekanEmoji} ${a.mekan} (${a.type === 'acilis' ? 'Açılış' : 'Kapanış'})`).join(', ')}. Detaylara bak ve önlem al.`,
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

  // Kare
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

function IzinGecmisiCard({ data }: {
  data: {
    myLeaves: LeaveRequest[];
    totalLeaveDays: number;
    annualDays: number;
    sickDays: number;
    personalDays: number;
    totalCalendarDays: number;
    estimatedWorkDays: number;
    userName: string;
  };
}) {
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
  const leaveTypeColor: Record<string, string> = {
    annual: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
    sick: 'text-red-300 bg-red-500/10 border-red-500/20',
    personal: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  };
  const workPct = data.totalCalendarDays > 0 ? Math.round((data.estimatedWorkDays / data.totalCalendarDays) * 100) : 100;

  return (
    <div className="mt-3 rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
        <span className="text-lg">📅</span>
        <span className="text-xs font-black text-white uppercase tracking-wider">Son 30 Gün — İzin & Çalışma</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Özet istatistik kutuları */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center gap-1">
            <span className="text-2xl font-black text-violet-300">{data.estimatedWorkDays}</span>
            <span className="text-[10px] text-white/45 text-center">gün aktif çalıştın</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center gap-1">
            <span className="text-2xl font-black text-indigo-300">{data.totalLeaveDays}</span>
            <span className="text-[10px] text-white/45 text-center">gün izin kullandın</span>
          </div>
        </div>

        {/* İlerleme çubuğu */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-white/40">Çalışma oranı</span>
            <span className="text-[10px] font-bold text-violet-300">%{workPct}</span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all"
              style={{ width: `${workPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-white/25">0</span>
            <span className="text-[9px] text-white/25">{data.totalCalendarDays} takvim günü</span>
          </div>
        </div>

        {/* İzin türü dağılımı */}
        {data.totalLeaveDays > 0 && (
          <div className="space-y-1.5">
            {(['annual', 'sick', 'personal'] as const).map(type => {
              const days = type === 'annual' ? data.annualDays : type === 'sick' ? data.sickDays : data.personalDays;
              if (days === 0) return null;
              return (
                <div key={type} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${leaveTypeColor[type]}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{leaveTypeIcon[type]}</span>
                    <span className="text-xs">{leaveTypeLabel[type]}</span>
                  </div>
                  <span className="text-xs font-bold">{days} gün</span>
                </div>
              );
            })}
          </div>
        )}

        {/* İzin listesi (varsa) */}
        {data.myLeaves.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium">İzin Kayıtları</p>
            {data.myLeaves.slice(0, 4).map((l) => {
              const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
              return (
                <div key={l.id} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                  <span className="text-sm shrink-0">{leaveTypeIcon[l.type] || '📅'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">{leaveTypeLabel[l.type] || l.type}</p>
                    <p className="text-[10px] text-white/35">{fmt(l.startDate)} – {fmt(l.endDate)}</p>
                  </div>
                  <span className="text-xs font-bold text-white/60 shrink-0">{l.days}g</span>
                </div>
              );
            })}
            {data.myLeaves.length > 4 && (
              <p className="text-[10px] text-white/30 text-center">+{data.myLeaves.length - 4} kayıt daha</p>
            )}
          </div>
        )}

        {data.totalLeaveDays === 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">Son 30 günde kayıtlı izin yok 💪</p>
          </div>
        )}

        <p className="text-[9px] text-white/20 text-center">
          * Tahmini değerler. Yalnızca onaylı izinler dahildir.
        </p>
      </div>
    </div>
  );
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

function MessageBubble({ msg }: { msg: Message }) {
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
            {msg.card.type === 'izin' && <IzinGecmisiCard data={msg.card.data} />}
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

export function AspectAIPage({ userRole = 'personel', userName = 'Kullanıcı', onLogout, onNavigate }: AspectAIProps) {
  // KV'den yüklenmiş config override — başlangıçta kod sabit config'i kullanır,
  // sunucudan gelince otomatik override edilir
  const [serverConfig, setServerConfig] = useState<Record<string, RoleConfig> | null>(null);
  const activeROLE_CONFIG = serverConfig ?? ROLE_CONFIG;
  const roleConfig = activeROLE_CONFIG[userRole] ?? ROLE_CONFIG['personel'];
  const isAdmin = roleConfig.loadOzet;
  const chips = roleConfig.chips;

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
  const [showSettings, setShowSettings] = useState(false);

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

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // __IZIN_GECMISIM__ özel komut — kullanıcıya gösterilen metin farklı
    const displayText = text.trim() === '__IZIN_GECMISIM__'
      ? '📅 İzin geçmişimi göster'
      : text.trim();

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: displayText, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simulate AI thinking delay
    await new Promise(r => setTimeout(r, 700 + Math.random() * 600));

    const result = generateAIResponse(text.trim(), userRole, ozet, activeROLE_CONFIG);

    let aiText: string;
    let aiCard: ResponseCard | undefined;

    if (result === 'GOLDEN_HOUR') {
      const ghResult = await fetchAltiSaat();
      aiText = ghResult.text;
      aiCard = ghResult.card;
    } else if (result === 'IZIN_GECMISI') {
      const izinResult = await fetchIzinGecmisi(userName);
      aiText = izinResult.text;
      aiCard = izinResult.card;
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
  }, [isLoading, ozet, userRole, activeROLE_CONFIG, userName]);

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
          <div>
            <span className="text-[15px] font-bold text-white leading-tight">Aspect AI</span>
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
            KV Tabanlı · {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
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
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
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
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-[#8b5cf6] flex items-center justify-center disabled:opacity-30 transition-all active:scale-90 shadow-lg shadow-violet-500/40"
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