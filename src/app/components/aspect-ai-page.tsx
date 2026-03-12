import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, Mic, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Package, Users, MapPin,
  AlertTriangle, CheckCircle, BarChart3, Zap,
  RefreshCw, X, Clock, DollarSign, ShoppingBag,
  Brain, MessageSquare, Star
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  ts: Date;
  card?: ResponseCard;
}

interface ResponseCard {
  type: 'briefing' | 'profit' | 'stock' | 'personnel' | 'anomaly' | 'tip';
  data: any;
}

interface AspectAIProps {
  userRole?: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  userName?: string;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

// ─── Demo KV Data ─────────────────────────────────────────────────────────────

const DEMO_DATA = {
  today: {
    date: '11 Mart 2026',
    totalRevenue: 14200,
    totalCost: 3840,
    profit: 10360,
    profitMargin: 73,
    salesCount: 47,
    frameCount: 312,
    discountLoss: 620,
    mekanlar: [
      { id: '1', name: 'Boğaziçi', emoji: '🌊', revenue: 5800, sales: 19, frames: 128, color: '#9dd9ea', trend: +12 },
      { id: '2', name: 'Kapalıçarşı', emoji: '🏛️', revenue: 4200, sales: 14, frames: 96, color: '#fbbf24', trend: -5 },
      { id: '3', name: 'Taksim', emoji: '🎭', revenue: 2800, sales: 9, frames: 61, color: '#f87171', trend: +3 },
      { id: '4', name: 'Sultanahmet', emoji: '🕌', revenue: 1400, sales: 5, frames: 27, color: '#a78bfa', trend: -18 },
    ],
    bestPersonel: { name: 'Ahmet K.', revenue: 4200, sales: 14 },
    anomalies: [
      { mekan: 'Taksim', type: 'stock', msg: '4 albüm eksiği var, stok uyumsuzluğu' },
      { mekan: 'Sultanahmet', type: 'perf', msg: 'Geçen haftaya göre %18 düşüş' },
    ],
    topProduct: '15x21 Albüm',
    stock: [
      { name: '10x15 Albüm', count: 48, status: 'ok' },
      { name: '15x21 Albüm', count: 31, status: 'ok' },
      { name: '20x30 Albüm', count: 12, status: 'low' },
      { name: '30x40 Albüm', count: 4, status: 'critical' },
      { name: 'Paspartu', count: 67, status: 'ok' },
      { name: 'Panoramik', count: 19, status: 'ok' },
      { name: 'Magnet', count: 8, status: 'low' },
      { name: 'Ribon Takımı', count: 3, status: 'critical' },
    ],
  },
};

// ─── Quick chip categories ────────────────────────────────────────────────────

const ADMIN_CHIPS = [
  { icon: '📊', label: 'Günlük özet', q: 'Bugünkü operasyon özetini göster' },
  { icon: '💰', label: 'Kâr hesabı', q: 'Bugün ne kadar kâr ettik?' },
  { icon: '📦', label: 'Stok durumu', q: 'Stok durumu nedir?' },
  { icon: '🚨', label: 'Anomaliler', q: 'Bugün anomali var mı?' },
  { icon: '🏆', label: 'En iyi mekan', q: 'Bugün hangi mekan en iyi performansı gösterdi?' },
  { icon: '👤', label: 'Personel', q: 'En iyi personel kimdi bugün?' },
];

const STAFF_CHIPS = [
  { icon: '📦', label: 'Stok sorgula', q: 'Stok durumu nedir?' },
  { icon: '💵', label: 'Fiyatlar', q: 'Albüm fiyatları nedir?' },
  { icon: '📸', label: 'Çekim ipuçları', q: 'Portre çekim ipuçları ver' },
  { icon: '❓', label: 'Nasıl satış yapılır?', q: 'Nasıl satış kaydederim?' },
];

// ─── KV-based Response Engine ─────────────────────────────────────────────────

function generateAIResponse(q: string, role: string): { text: string; card?: ResponseCard } {
  const lower = q.toLowerCase();
  const isAdmin = ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(role);
  const d = DEMO_DATA.today;

  // Günlük özet
  if (lower.includes('özet') || lower.includes('genel') || lower.includes('nasıl geçti')) {
    return {
      text: `${d.date} günü toplam **${d.salesCount} satış** ve **${d.frameCount} kare** ile güçlü bir gün geçirildi. En yüksek ciro **${d.mekanlar[0].name}** mekanından geldi.`,
      card: { type: 'briefing', data: d },
    };
  }

  // Kâr / gelir
  if (lower.includes('kâr') || lower.includes('kar') || lower.includes('kazandık') || lower.includes('gelir') || lower.includes('ciro')) {
    return {
      text: `Bugün **₺${d.totalRevenue.toLocaleString('tr-TR')}** ciro ile **₺${d.profit.toLocaleString('tr-TR')}** kâr elde edildi. Kâr marjı %${d.profitMargin} — oldukça iyi bir gün! İskonto kayıpları **₺${d.discountLoss}** olarak gerçekleşti.`,
      card: { type: 'profit', data: d },
    };
  }

  // Stok
  if (lower.includes('stok')) {
    const criticals = d.stock.filter(s => s.status === 'critical');
    const lows = d.stock.filter(s => s.status === 'low');
    return {
      text: criticals.length > 0
        ? `⚠️ Kritik stok uyarısı: **${criticals.map(s => s.name).join(', ')}** bitmek üzere! ${lows.length > 0 ? `Ayrıca **${lows.map(s => s.name).join(', ')}** de azalmış durumda.` : ''} Hızlıca sipariş ver.`
        : `Stok durumu genel olarak iyi. ${lows.length > 0 ? `**${lows.map(s => s.name).join(', ')}** biraz azalmış, takipte tut.` : 'Tüm ürünler yeterli seviyede.'}`,
      card: { type: 'stock', data: d.stock },
    };
  }

  // Anomali
  if (lower.includes('anomali') || lower.includes('sorun') || lower.includes('uyarı') || lower.includes('problem')) {
    return {
      text: `Bugün **${d.anomalies.length} anomali** tespit edildi. ${d.anomalies.map(a => `${a.mekan}: ${a.msg}`).join(' | ')}. Detaylara bak ve önlem al.`,
      card: { type: 'anomaly', data: d.anomalies },
    };
  }

  // En iyi mekan
  if (lower.includes('en iyi') && (lower.includes('mekan') || lower.includes('lokasyon') || lower.includes('yer'))) {
    const best = d.mekanlar[0];
    return {
      text: `Bugünün şampiyonu **${best.emoji} ${best.name}**! ₺${best.revenue.toLocaleString('tr-TR')} ciro, ${best.sales} satış ve ${best.frames} kare ile zirvede. Geçen haftaya kıyasla %${best.trend > 0 ? '+' : ''}${best.trend} değişim.`,
      card: { type: 'briefing', data: d },
    };
  }

  // Personel
  if (lower.includes('personel') || lower.includes('çalışan') || lower.includes('iyi kimdi')) {
    return {
      text: `Bugünün en iyi performansı **${d.bestPersonel.name}** — ${d.bestPersonel.sales} satış ile ₺${d.bestPersonel.revenue.toLocaleString('tr-TR')} ciro sağladı. Harika bir gün geçirdi!`,
      card: { type: 'personnel', data: d },
    };
  }

  // Fiyat soruları
  if (lower.includes('fiyat') || lower.includes('albüm fiyat')) {
    return {
      text: '💵 Güncel albüm fiyatları: **10x15 → ₺120**, **15x21 → ₺200**, **20x30 → ₺280**, **30x40 → ₺380**, **Panoramik → ₺320**, **Paspartu → ₺80**, **Magnet → ₺80**. Tüm fiyatlar KDV dahildir.',
      card: { type: 'tip', data: { title: 'Albüm Fiyat Listesi', icon: '💵' } },
    };
  }

  // Portre / çekim ipuçları
  if (lower.includes('portre') || lower.includes('çekim') || lower.includes('ipucu')) {
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
      ? `Anladım! "${q}" hakkında şu an KV tabanlı demo modundayım. Gerçek veri için sunucu bağlantısını aktif et. Günlük özet, kâr hesabı, stok veya anomali sorularını deneyebilirsin.`
      : `"${q}" için şu an demo verisine sahibim. Stok durumu, fiyatlar veya çekim ipuçları hakkında soru sorabilirsin!`,
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

function BriefingCard({ data }: { data: typeof DEMO_DATA.today }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-3 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 overflow-hidden">
      {/* Özet satırı */}
      <div className="grid grid-cols-3 gap-px bg-white/8 border-b border-white/8">
        {[
          { label: 'Ciro', val: `₺${(data.totalRevenue / 1000).toFixed(1)}K`, color: '#4ade80' },
          { label: 'Kâr', val: `₺${(data.profit / 1000).toFixed(1)}K`, color: '#a78bfa' },
          { label: 'Marj', val: `%${data.profitMargin}`, color: '#fbbf24' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#1a1a2e] px-3 py-2 text-center">
            <div className="text-xs font-bold" style={{ color: stat.color }}>{stat.val}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Mekan listesi */}
      <div className="px-3 pt-3 pb-1 space-y-1.5">
        {data.mekanlar.slice(0, expanded ? data.mekanlar.length : 2).map(m => (
          <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl bg-white/4 border border-white/6">
            <span className="text-sm shrink-0">{m.emoji}</span>
            <span className="text-xs font-semibold text-white flex-1 truncate">{m.name}</span>
            <div className={`flex items-center gap-0.5 text-[10px] font-bold ${m.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {m.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {m.trend > 0 ? '+' : ''}{m.trend}%
            </div>
            <span className="text-xs font-bold text-white/80 shrink-0">₺{m.revenue.toLocaleString('tr-TR')}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-center gap-1 py-2 text-[10px] text-white/30 hover:text-white/60 transition-colors"
      >
        {expanded ? <><ChevronUp className="w-3 h-3" />Daha az göster</> : <><ChevronDown className="w-3 h-3" />Tüm mekanlar</>}
      </button>
    </div>
  );
}

function ProfitCard({ data }: { data: typeof DEMO_DATA.today }) {
  const items = [
    { label: 'Toplam Ciro', val: `₺${data.totalRevenue.toLocaleString('tr-TR')}`, color: '#4ade80', icon: <DollarSign className="w-3.5 h-3.5" /> },
    { label: 'Maliyet', val: `₺${data.totalCost.toLocaleString('tr-TR')}`, color: '#f87171', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { label: 'Brüt Kâr', val: `₺${data.profit.toLocaleString('tr-TR')}`, color: '#a78bfa', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { label: 'Kâr Marjı', val: `%${data.profitMargin}`, color: '#fbbf24', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { label: 'İskonto Kaybı', val: `₺${data.discountLoss.toLocaleString('tr-TR')}`, color: '#fb923c', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  ];
  return (
    <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-transparent overflow-hidden">
      <div className="px-3 pt-3 pb-2 space-y-2">
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
      {/* Progress bar kâr marjı */}
      <div className="px-3 pb-3">
        <div className="text-[10px] text-white/30 mb-1.5">Kâr Marjı Göstergesi</div>
        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400"
            style={{ width: `${data.profitMargin}%`, transition: 'width 1s ease' }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/25 mt-1">
          <span>0%</span><span>%{data.profitMargin} kâr</span><span>100%</span>
        </div>
      </div>
    </div>
  );
}

function StockCard({ data }: { data: typeof DEMO_DATA.today.stock }) {
  const statusConfig = {
    ok: { label: 'Normal', color: '#4ade80', bg: 'bg-emerald-500/15 border-emerald-500/30' },
    low: { label: 'Az', color: '#fbbf24', bg: 'bg-amber-500/15 border-amber-500/30' },
    critical: { label: 'Kritik', color: '#f87171', bg: 'bg-red-500/15 border-red-500/30' },
  };
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
      <div className="px-3 pt-3 pb-2 space-y-1.5">
        {data.map(s => {
          const cfg = statusConfig[s.status as keyof typeof statusConfig];
          return (
            <div key={s.name} className="flex items-center gap-2 px-2 py-2 rounded-xl bg-white/4">
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

function AnomalyCard({ data }: { data: typeof DEMO_DATA.today.anomalies }) {
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
              <div className="text-xs font-bold text-white">{a.mekan}</div>
              <div className="text-[11px] text-white/50 mt-0.5">{a.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonnelCard({ data }: { data: typeof DEMO_DATA.today }) {
  return (
    <div className="mt-3 rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/8 to-transparent overflow-hidden">
      <div className="px-3 pt-3 pb-3 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white">Bugünün Yıldızı</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/6 border border-white/10">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">{data.bestPersonel.name}</div>
            <div className="text-[11px] text-white/40 mt-0.5">{data.bestPersonel.sales} satış</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-emerald-400">₺{data.bestPersonel.revenue.toLocaleString('tr-TR')}</div>
            <div className="text-[10px] text-white/30">ciro</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-center">
            <div className="text-xs font-bold text-violet-300">{data.salesCount}</div>
            <div className="text-[10px] text-white/30 mt-0.5">Toplam Satış</div>
          </div>
          <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-center">
            <div className="text-xs font-bold text-blue-300">{data.frameCount}</div>
            <div className="text-[10px] text-white/30 mt-0.5">Toplam Kare</div>
          </div>
        </div>
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
    case 'tip':        return <TipCard data={card.data} />;
    default:           return null;
  }
}

function MessageBubble({ msg }: { msg: Message }) {
  const isAI = msg.role === 'ai';
  return (
    <div className={`flex items-end gap-2 ${isAI ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
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
        {/* Bubble */}
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

        {/* Data card */}
        {isAI && msg.card && <AICard card={msg.card} />}

        {/* Timestamp */}
        <span className="text-[10px] text-white/20 mt-1 px-1">
          {msg.ts.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Daily Briefing Banner (top of page) ─────────────────────────────────────

function DailyBriefingBanner({ onAsk }: { onAsk: (q: string) => void }) {
  const d = DEMO_DATA.today;
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/12 via-indigo-500/8 to-transparent overflow-hidden relative">
      {/* Decorative glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />

      <div className="relative px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-violet-300 tracking-wide">GÜNLÜK BRİFİNG</span>
          <span className="text-[10px] text-white/30 ml-auto">{d.date}</span>
        </div>

        <p className="text-xs text-white/70 leading-relaxed mb-3">
          Bugün <span className="font-bold text-white">{d.mekanlar.length} mekanda</span> toplam{' '}
          <span className="font-bold text-emerald-400">₺{d.totalRevenue.toLocaleString('tr-TR')}</span> ciro,{' '}
          <span className="font-bold text-violet-300">%{d.profitMargin}</span> kâr marjı.{' '}
          {d.anomalies.length > 0 && (
            <span className="text-amber-400 font-semibold">{d.anomalies.length} anomali dikkat bekliyor.</span>
          )}
        </p>

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
  const isAdmin = ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(userRole);
  const chips = isAdmin ? ADMIN_CHIPS : STAFF_CHIPS;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showBriefing, setShowBriefing] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hoş geldin mesajı
  useEffect(() => {
    const welcome: Message = {
      id: 'welcome',
      role: 'ai',
      ts: new Date(),
      text: isAdmin
        ? `Merhaba **${userName}**! Ben Aspect AI. Satış raporları, kâr hesabı, stok durumu ve operasyonel analizler için buradayım. Ne öğrenmek istersin?`
        : `Merhaba **${userName}**! Ben Aspect AI. Stok sorgulama, fiyat listesi ve çekim ipuçları için buradayım. Nasıl yardımcı olabilirim?`,
    };
    setMessages([welcome]);
  }, []);

  useEffect(() => {
    // Sadece kullanıcı mesaj gönderdikten sonra scroll yap
    // (welcome mesajı tek başına olduğunda length=1, scroll yapma)
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
    const delay = 800 + Math.random() * 600;
    setTimeout(() => {
      const { text: aiText, card } = generateAIResponse(text, userRole);
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
  }, [input, userRole]);

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
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/20 border border-violet-500/30 text-violet-300">
                  DEMO
                </span>
              </div>
              <div className="text-[10px] text-white/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                KV Tabanlı · Çevrimiçi
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={clearChat}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/6 border border-white/10 hover:bg-white/12 transition-all active:scale-90"
              title="Sohbeti temizle"
            >
              <RefreshCw className="w-3.5 h-3.5 text-white/40" />
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
          <DailyBriefingBanner onAsk={sendMessage} />
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
                  key={chip.label}
                  onClick={() => sendMessage(chip.q)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/6 border border-white/10 hover:bg-white/12 hover:border-indigo-500/30 transition-all active:scale-95"
                >
                  <span className="text-base shrink-0">{chip.icon}</span>
                  <span className="text-xs text-white/60 font-medium text-left">{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 px-4 mt-4 mb-3">
          <div className="flex-1 h-px bg-white/6" />
          <div className="flex items-center gap-1 text-[10px] text-white/20">
            <Clock className="w-3 h-3" />
            Bugün
          </div>
          <div className="flex-1 h-px bg-white/6" />
        </div>

        {/* Messages */}
        <div className="px-4 space-y-4">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {typing && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── INPUT BAR ── */}
      <div className="fixed bottom-20 left-0 right-0 z-30 px-4 pb-2">
        <div className="bg-[rgba(15,8,37,0.96)] backdrop-blur-2xl border border-white/12 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Bir şey sor…"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none min-w-0"
            />
            {input.trim() ? (
              <button
                onClick={() => sendMessage()}
                disabled={typing}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-900/40 active:scale-90 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            ) : (
              <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/6 border border-white/10 active:scale-90 transition-all">
                <Mic className="w-3.5 h-3.5 text-white/40" />
              </button>
            )}
          </div>

          {/* Alt bilgi */}
          <div className="px-4 pb-2 flex items-center justify-between">
            <span className="text-[10px] text-white/20">KV tabanlı · Gerçek zamanlı demo</span>
            <span className="text-[10px] text-white/20">{messages.length} mesaj</span>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <NewBottomNav activeTab="ai" onTabChange={onNavigate} userRole={userRole} />
    </div>
  );
}