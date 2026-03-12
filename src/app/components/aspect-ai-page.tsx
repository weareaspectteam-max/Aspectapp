import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, ChevronDown, ChevronUp,
  Package,
  AlertTriangle, CheckCircle, Zap,
  RefreshCw, Clock,
  Brain, MessageSquare, Loader2,
} from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// Fethiye koordinatları
const FETHIYE_LAT = 36.6552;
const FETHIYE_LON = 29.1234;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: Date;
  card?: ResponseCard;
}

interface ResponseCard {
  type: 'briefing' | 'profit' | 'stock' | 'personnel' | 'anomaly' | 'tip' | 'payment' | 'golden_hour';
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
  mekanlar: {
    id: string; name: string; emoji: string; color: string;
    ciro: number; satisAdet: number; iskonto: number;
    acilisYapildi: boolean; kapanisYapildi: boolean;
  }[];
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

const ADMIN_CHIPS = [
  { icon: '📊', label: 'Günlük özet', q: 'Bugünkü operasyon özetini göster' },
  { icon: '💰', label: 'Kâr hesabı', q: 'Bugün ne kadar ciro yaptık?' },
  { icon: '📦', label: 'Stok durumu', q: 'Stok durumu nedir?' },
  { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
  { icon: '🏆', label: 'En iyi mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
  { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
  { icon: '💳', label: 'Ödeme dağılımı', q: 'Ödeme yöntemleri nasıl dağılmış?' },
  { icon: '🌅', label: 'Altın saat', q: 'Bugün Fethiye altın saat kaçta?' },
];

const STAFF_CHIPS = [
  { icon: '📦', label: 'Stok sorgula', q: 'Stok durumu nedir?' },
  { icon: '📸', label: 'Çekim ipuçları', q: 'Portre çekim ipuçları ver' },
  { icon: '❓', label: 'Satış kaydı', q: 'Nasıl satış kaydederim?' },
  { icon: '🌅', label: 'Altın saat', q: 'Bugün Fethiye altın saat kaçta?' },
];

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

// ─── AI Response Engine (gerçek KV verisi kullanır) ───────────────────────────

function generateAIResponse(q: string, role: string, ozet: AIOzet | null): { text: string; card?: ResponseCard } | 'GOLDEN_HOUR' {
  const lower = q.toLowerCase();
  const isAdmin = ['yonetici', 'ust-mudur', 'mudur', 'idari', 'operasyon'].includes(role);
  const isPersonel = role === 'personel';

  // Altın saat — async flag döndür
  if (lower.includes('altın saat') || lower.includes('altin saat') || lower.includes('golden hour') || lower.includes('gün batımı saati') || lower.includes('günbatımı')) {
    return 'GOLDEN_HOUR';
  }

  // Personel: para/ciro/finansal sorgular engellendi
  if (isPersonel) {
    const finansalKelimeler = [
      'ciro', 'kâr', 'kar', 'kazandık', 'kazanç', 'gelir', 'para',
      'ödeme', 'nakit', 'kart', 'iban', 'döviz', 'fiyat', 'ücret',
      'indirim', 'iskonto', 'toplam satış', 'özet', 'genel', 'operasyon',
      'en iyi mekan', 'en iyi personel', 'personel sıralama', 'anomali',
      'nasıl geçti', 'bugün ne'
    ];
    if (finansalKelimeler.some(k => lower.includes(k))) {
      return {
        text: '🔒 Bu bilgiye erişim yetkiniz bulunmuyor. Stok durumu, çekim ipuçları veya satış kayıt süreci hakkında yardımcı olabilirim!',
      };
    }
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
  const bestMekan = d.mekanlar[0];

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

  // Default
  return {
    text: isAdmin
      ? `Anlıyorum. "${q}" hakkında şu an elimdeki verilere göre yardımcı olabilirim. Günlük özet, ciro, stok durumu, anomaliler veya personel performansı hakkında soru sorabilirsin.`
      : `"${q}" için elimdeki verilere göre yardımcı olmaya çalışayım. Stok durumu veya çekim ipuçları hakkında soru sorabilirsin!`,
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function AspectAIPage({ userRole = 'personel', userName = 'Kullanıcı', onLogout, onNavigate }: AspectAIProps) {
  const isAdmin = ['yonetici', 'ust-mudur', 'mudur', 'idari', 'operasyon'].includes(userRole);
  const chips = isAdmin ? ADMIN_CHIPS : STAFF_CHIPS;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'ai',
      text: isAdmin
        ? `Merhaba **${userName}**! Ben Aspect AI. Satış raporları, kâr hesabı, stok durumu ve operasyonel analizler için buradayım. Soru sorabilir ya da kestirmeleri kullanabilirsin.`
        : `Merhaba **${userName}**! Ben Aspect AI. Stok durumu, çekim teknikleri veya satış süreci hakkında sorularına yardımcı olabilirim!`,
      ts: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [ozet, setOzet] = useState<AIOzet | null>(null);
  const [ozetLoading, setOzetLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<'brifing' | 'kestirmeler'>('brifing');
  const [brifingOpen, setBrifingOpen] = useState(true);
  const [kestirmelerOpen, setKestirmelerOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text.trim(), ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simulate AI thinking delay
    await new Promise(r => setTimeout(r, 700 + Math.random() * 600));

    const result = generateAIResponse(text.trim(), userRole, ozet);

    let aiText: string;
    let aiCard: ResponseCard | undefined;

    if (result === 'GOLDEN_HOUR') {
      const ghResult = await fetchAltiSaat();
      aiText = ghResult.text;
      aiCard = ghResult.card;
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
  }, [isLoading, ozet, userRole]);

  const handleChip = (q: string) => sendMessage(q);
  const handleSend = () => sendMessage(input);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Derived display name: "Özgür D." style
  const nameParts = userName.trim().split(' ');
  const displayName = nameParts.length >= 2
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
    : nameParts[0];

  return (
    <div
      className="flex flex-col bg-gradient-to-br from-[#0a051e] via-[#120830] to-[#1a0a3c] overflow-hidden"
      style={{ height: 'calc(100vh - 60px - 51px)' }}
    >

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
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={ozetLoading}
              className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white/60 ${ozetLoading ? 'animate-spin' : ''}`} />
            </button>

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