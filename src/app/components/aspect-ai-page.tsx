import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Package, Users, MapPin,
  AlertTriangle, CheckCircle, BarChart3, Zap,
  RefreshCw, Clock, DollarSign, ShoppingBag,
  Brain, MessageSquare, Star, Loader2, WifiOff, Wifi
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: Date;
  card?: ResponseCard;
}

interface ResponseCard {
  type: 'briefing' | 'profit' | 'stock' | 'personnel' | 'anomaly' | 'tip' | 'payment';
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
];

const STAFF_CHIPS = [
  { icon: '📦', label: 'Stok sorgula', q: 'Stok durumu nedir?' },
  { icon: '📸', label: 'Çekim ipuçları', q: 'Portre çekim ipuçları ver' },
  { icon: '❓', label: 'Satış kaydı', q: 'Nasıl satış kaydederim?' },
  { icon: '📊', label: 'Bugün özet', q: 'Bugünkü operasyon özetini göster' },
];

// ─── AI Response Engine (gerçek KV verisi kullanır) ───────────────────────────

function generateAIResponse(q: string, role: string, ozet: AIOzet | null): { text: string; card?: ResponseCard } {
  const lower = q.toLowerCase();
  const isAdmin = ['yonetici', 'ust-mudur', 'mudur', 'idari', 'operasyon'].includes(role);

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
        ].map(stat => (
          <div key={stat.label} className="bg-[#1a1a2e] px-3 py-2 text-center">
            <div className="text-xs font-bold" style={{ color: stat.color }}>{stat.val}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="px-3 pt-3 pb-1 space-y-1.5">
        {shown.map(m => (
          <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl bg-white/4 border border-white/6">
            <span className="text-sm shrink-0">{m.emoji}</span>
            <span className="text-xs font-semibold text-white flex-1 truncate">{m.name}</span>
            <span className="text-xs font-bold text-white/80 shrink-0">₺{m.ciro.toLocaleString('tr-TR')}</span>
          </div>
        ))}
      </div>
      {data.mekanlar.length > 2 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1 py-2 text-[10px] text-white/30 hover:text-white/60 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" />Daha az</> : <><ChevronDown className="w-3 h-3" />Tüm mekanlar ({data.mekanlar.length})</>}
        </button>
      )}
    </div>
  );
}

function ProfitCard({ data }: { data: AIOzet }) {
  const items = [
    { label: 'Toplam Ciro', val: `₺${data.toplamCiro.toLocaleString('tr-TR')}`, color: '#4ade80', icon: <DollarSign className="w-3.5 h-3.5" /> },
    { label: 'Toplam Satış', val: `${data.toplamSatisAdet} adet`, color: '#a78bfa', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { label: 'İskonto Kaybı', val: `₺${data.toplamIskonto.toLocaleString('tr-TR')}`, color: '#fb923c', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { label: 'Toplam Kare', val: `${data.toplamKare}`, color: '#38bdf8', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];
  return (
    <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-transparent overflow-hidden">
      <div className="px-3 pt-3 pb-3 space-y-2">
        {items.map(it => (
          <div key={it.label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/6">
            <div className="flex items-center gap-2">
              <span style={{ color: it.color }}>{it.icon}</span>
              <span className="text-xs text-white/60">{it.label}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: it.color }}>{it.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockCard({ data }: { data: { alan: string; name: string; count: number; status: string }[] }) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    normal: { label: 'Normal', color: '#4ade80', bg: 'bg-emerald-500/15 border-emerald-500/30' },
    az:     { label: 'Az', color: '#fbbf24', bg: 'bg-amber-500/15 border-amber-500/30' },
    kritik: { label: 'Kritik', color: '#f87171', bg: 'bg-red-500/15 border-red-500/30' },
  };
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
      <div className="px-3 pt-3 pb-2 space-y-1.5">
        {data.map(s => {
          const cfg = statusConfig[s.status] || statusConfig.normal;
          return (
            <div key={s.alan} className="flex items-center gap-2 px-2 py-2 rounded-xl bg-white/4">
              <Package className="w-3 h-3 text-white/30 shrink-0" />
              <span className="text-xs text-white/80 flex-1">{s.name}</span>
              <span className="text-xs font-bold text-white/60">{s.count} adet</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg border ${cfg.bg}`} style={{ color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnomalyCard({ data }: { data: { mekan: string; mekanEmoji: string; type: string; detail: any }[] }) {
  if (data.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 px-3 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-300">Bugün anomali yok — her şey normal!</span>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/8 to-transparent overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-amber-300">{data.length} Anomali Tespit Edildi</span>
      </div>
      <div className="px-3 pb-3 space-y-2">
        {data.map((a, i) => (
          <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <MapPin className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">{a.mekanEmoji} {a.mekan}</div>
              <div className="text-[11px] text-white/50 mt-0.5">{a.type === 'acilis' ? 'Açılış' : 'Kapanış'} stok uyumsuzluğu</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonnelCard({ data }: { data: AIOzet }) {
  return (
    <div className="mt-3 rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/8 to-transparent overflow-hidden">
      <div className="px-3 pt-3 pb-3 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white">Personel Sıralaması</span>
        </div>
        {data.personelSiralama.length === 0 ? (
          <div className="text-xs text-white/40 text-center py-2">Henüz veri yok</div>
        ) : (
          data.personelSiralama.map((p, i) => (
            <div key={p.ad} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/6 border border-white/10">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-white/50'}`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-white">{p.ad}</div>
                <div className="text-[10px] text-white/40">{p.satis} satış</div>
              </div>
              <div className="text-sm font-bold text-emerald-400">₺{p.ciro.toLocaleString('tr-TR')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PaymentCard({ data }: { data: { odemeDagilimi: { cash: number; card: number; iban: number; foreign: number }; toplam: number } }) {
  const { odemeDagilimi: od, toplam } = data;
  const items = [
    { label: 'Nakit', val: od.cash, icon: '💵', color: '#4ade80' },
    { label: 'Kart', val: od.card, icon: '💳', color: '#60a5fa' },
    { label: 'IBAN', val: od.iban, icon: '🏦', color: '#a78bfa' },
    { label: 'Döviz', val: od.foreign, icon: '💱', color: '#fbbf24' },
  ].filter(i => i.val > 0);
  return (
    <div className="mt-3 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/8 to-transparent overflow-hidden">
      <div className="px-3 pt-3 pb-3 space-y-2">
        {items.map(it => (
          <div key={it.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/6">
            <span className="text-base">{it.icon}</span>
            <span className="text-xs text-white/60 flex-1">{it.label}</span>
            <span className="text-[10px] text-white/30 mr-2">%{toplam > 0 ? Math.round(it.val / toplam * 100) : 0}</span>
            <span className="text-sm font-bold" style={{ color: it.color }}>₺{it.val.toLocaleString('tr-TR')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TipCard({ data }: { data: { title: string; icon: string } }) {
  return (
    <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
      <span className="text-base">{data.icon}</span>
      <span className="text-xs font-semibold text-violet-300">{data.title}</span>
      <CheckCircle className="w-3.5 h-3.5 text-violet-400 ml-auto shrink-0" />
    </div>
  );
}

function AICard({ card }: { card: ResponseCard }) {
  switch (card.type) {
    case 'briefing':   return <BriefingCard data={card.data} />;
    case 'profit':     return <ProfitCard data={card.data} />;
    case 'stock':      return <StockCard data={card.data} />;
    case 'anomaly':    return <AnomalyCard data={card.data} />;
    case 'personnel':  return <PersonnelCard data={card.data} />;
    case 'payment':    return <PaymentCard data={card.data} />;
    case 'tip':        return <TipCard data={card.data} />;
    default:           return null;
  }
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAI = msg.role === 'ai';
  return (
    <div className={`flex items-end gap-2 ${isAI ? '' : 'flex-row-reverse'}`}>
      {isAI ? (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mb-0.5">
          <Brain className="w-3.5 h-3.5 text-white" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shrink-0 mb-0.5">
          <Users className="w-3.5 h-3.5 text-white/70" />
        </div>
      )}

      <div className={`max-w-[82%] ${isAI ? '' : 'items-end flex flex-col'}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isAI
              ? 'bg-white/8 border border-white/12 text-white/90 rounded-bl-sm'
              : 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-br-sm shadow-lg shadow-violet-900/30'
          }`}
          dangerouslySetInnerHTML={{
            __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<span class="font-bold text-white">$1</span>'),
          }}
        />
        {isAI && msg.card && <AICard card={msg.card} />}
        <span className="text-[10px] text-white/20 mt-1 px-1">
          {msg.ts.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Daily Briefing Banner ────────────────────────────────────────────────────

function DailyBriefingBanner({ onAsk, ozet, loading }: { onAsk: (q: string) => void; ozet: AIOzet | null; loading: boolean }) {
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/12 via-indigo-500/8 to-transparent overflow-hidden relative">
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />
      <div className="relative px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-violet-300 tracking-wide">GÜNLÜK BRİFİNG</span>
          <span className="text-[10px] text-white/30 ml-auto">
            {ozet ? ozet.tarihTR : new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-2 mb-3">
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
            <span className="text-xs text-white/40">Veriler yükleniyor...</span>
          </div>
        ) : ozet ? (
          <p className="text-xs text-white/70 leading-relaxed mb-3">
            {ozet.mekanSayisi > 0 ? (
              <>
                <span className="font-bold text-white">{ozet.mekanSayisi} mekanda</span> toplam{' '}
                <span className="font-bold text-emerald-400">₺{ozet.toplamCiro.toLocaleString('tr-TR')}</span> ciro,{' '}
                <span className="font-bold text-violet-300">{ozet.toplamSatisAdet} satış</span>.{' '}
                {ozet.anomaliler.length > 0 && (
                  <span className="text-amber-400 font-semibold">{ozet.anomaliler.length} anomali dikkat bekliyor.</span>
                )}
              </>
            ) : (
              <span className="text-white/40">Bugün için henüz vardiya kaydı yok.</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-white/40 mb-3">Veri yüklenemedi — bağlantı kontrol et.</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onAsk('Bugünkü operasyon özetini göster')}
            className="flex-1 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-[11px] font-semibold text-violet-300 active:scale-95 transition-transform"
          >
            Detayları Gör
          </button>
          <button
            onClick={() => onAsk('Bugün anomali var mı?')}
            className="flex-1 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-[11px] font-semibold text-amber-300 active:scale-95 transition-transform"
          >
            🚨 Anomaliler
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AspectAIPage({
  userRole = 'yonetici',
  userName = 'Kullanıcı',
  onLogout = () => {},
  onNavigate = () => {},
}: AspectAIProps) {
  const isAdmin = ['yonetici', 'ust-mudur', 'mudur', 'idari', 'operasyon'].includes(userRole);
  const chips = isAdmin ? ADMIN_CHIPS : STAFF_CHIPS;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [ozet, setOzet] = useState<AIOzet | null>(null);
  const [ozetLoading, setOzetLoading] = useState(false);
  const [ozetError, setOzetError] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Gerçek KV verisini çek
  const fetchOzet = useCallback(async () => {
    setOzetLoading(true);
    setOzetError(false);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ai/ozet`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.ozet) {
        setOzet(json.ozet);
        setLastFetch(new Date());
        console.log('[AspectAI] Veri yüklendi:', json.ozet.tarih, `${json.ozet.toplamSatisAdet} satış`);
      } else {
        throw new Error('ozet alanı eksik');
      }
    } catch (err) {
      console.error('[AspectAI] Veri yüklenemedi:', err);
      setOzetError(true);
    } finally {
      setOzetLoading(false);
    }
  }, []);

  // Sayfa açılınca veri çek
  useEffect(() => {
    fetchOzet();
  }, [fetchOzet]);

  // Hoş geldin mesajı — veri geldikten sonra güncelle
  useEffect(() => {
    const text = ozet
      ? isAdmin
        ? `Merhaba **${userName}**! Ben Aspect AI — gerçek zamanlı KV verilerine bağlıyım. ${ozet.mekanSayisi > 0 ? `Bugün **${ozet.mekanSayisi} mekandan** ₺${ozet.toplamCiro.toLocaleString('tr-TR')} ciro görüyorum.` : 'Bugün için henüz vardiya kaydı yok.'} Ne sormak istersin?`
        : `Merhaba **${userName}**! Ben Aspect AI. Stok durumu ve çekim ipuçları için buradayım. Nasıl yardımcı olabilirim?`
      : isAdmin
        ? `Merhaba **${userName}**! Ben Aspect AI. Veriler yükleniyor... Hazır olduğunda günlük operasyon, stok ve satış analizleri için buradayım.`
        : `Merhaba **${userName}**! Ben Aspect AI. Hazırlanıyorum...`;

    setMessages([{
      id: 'welcome',
      role: 'ai',
      ts: new Date(),
      text,
    }]);
  }, [ozet]);

  useEffect(() => {
    if (messages.length <= 1 && !typing) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = useCallback((q?: string) => {
    const text = (q || input).trim();
    if (!text) return;
    setInput('');
    setShowBriefing(false);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);

    setTyping(true);
    const delay = 600 + Math.random() * 500;
    setTimeout(() => {
      const { text: aiText, card } = generateAIResponse(text, userRole, ozet);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: aiText,
        ts: new Date(),
        card,
      };
      setMessages(prev => [...prev, aiMsg]);
      setTyping(false);
    }, delay);
  }, [input, userRole, ozet]);

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'ai',
      ts: new Date(),
      text: 'Sohbet temizlendi. Yeni bir soru sormak için hazırım!',
    }]);
    setShowBriefing(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a051e] via-[#120830] to-[#1a0a3c] flex flex-col font-sans">
      {/* ── HEADER ── */}
      <div className="bg-[rgba(10,5,30,0.92)] backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                Aspect AI
                {ozetLoading ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> YÜKLENİYOR
                  </span>
                ) : ozetError ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-300">
                    BAĞLANTI YOK
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                    CANLI
                  </span>
                )}
              </div>
              <div className="text-[10px] text-white/30 flex items-center gap-1">
                {ozetError ? (
                  <><WifiOff className="w-2.5 h-2.5 text-red-400" /> Bağlantı hatası</>
                ) : ozetLoading ? (
                  <><Loader2 className="w-2.5 h-2.5 animate-spin" /> KV yükleniyor...</>
                ) : lastFetch ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" /> {lastFetch.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} güncellendi</>
                ) : (
                  <><Wifi className="w-2.5 h-2.5" /> KV Bağlantılı</>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchOzet}
              disabled={ozetLoading}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/6 border border-white/10 hover:bg-white/12 transition-all active:scale-90 disabled:opacity-40"
              title="Veriyi yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${ozetLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={clearChat}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/6 border border-white/10 hover:bg-white/12 transition-all active:scale-90"
              title="Sohbeti temizle"
            >
              <Clock className="w-3.5 h-3.5 text-white/40" />
            </button>
            <button
              onClick={() => setShowBriefing(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all active:scale-95 ${
                showBriefing
                  ? 'bg-violet-500/20 border-violet-500/35 text-violet-300'
                  : 'bg-white/6 border-white/10 text-white/35'
              }`}
            >
              <Zap className="w-3 h-3" />
              Brifing
            </button>
            <button
              onClick={() => setShowShortcuts(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all active:scale-95 ${
                showShortcuts
                  ? 'bg-indigo-500/20 border-indigo-500/35 text-indigo-300'
                  : 'bg-white/6 border-white/10 text-white/35'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              Kestirmeler
            </button>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto pb-40">

        {/* Daily Briefing Banner */}
        {showBriefing && isAdmin && (
          <DailyBriefingBanner onAsk={sendMessage} ozet={ozet} loading={ozetLoading} />
        )}

        {/* Quick Chips */}
        {showShortcuts && (
          <div className="px-4 mt-4 mb-1">
            <div className="text-[10px] text-white/25 font-semibold tracking-wider mb-2.5 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> KESTİRMELER
            </div>
            <div className="grid grid-cols-2 gap-2">
              {chips.map(chip => (
                <button
                  key={chip.q}
                  onClick={() => sendMessage(chip.q)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/6 border border-white/10 text-left hover:bg-white/10 active:scale-95 transition-all"
                >
                  <span className="text-sm">{chip.icon}</span>
                  <span className="text-xs font-semibold text-white/70">{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="px-4 pt-4 space-y-4">
          {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
          {typing && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── INPUT BAR ── */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-2 bg-gradient-to-t from-[#0a051e] via-[#0a051e]/95 to-transparent">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/8 border border-white/15 backdrop-blur-xl">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Bir şey sor..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || typing}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 disabled:opacity-30 active:scale-90 transition-all shadow-lg shadow-violet-900/40"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* Son güncelleme */}
        {lastFetch && !ozetLoading && (
          <div className="text-center mt-1.5">
            <span className="text-[10px] text-white/15">
              Veriler {lastFetch.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla güncellendi
            </span>
          </div>
        )}
      </div>

      <NewBottomNav activeTab="aspect-ai" onNavigate={onNavigate} userRole={userRole} onLogout={onLogout} />
    </div>
  );
}
