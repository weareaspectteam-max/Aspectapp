import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, Users, Wallet,
  ShoppingCart, RotateCcw, Tag, Layers, ChevronDown, Calendar, Building2,
  AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine, LabelList,
} from 'recharts';
import { projectId } from '../lib/supabase-info';
import { buildHeaders, getToken, appendGhostParam } from '../lib/api';
import { ayLabel, calculateYoY, formatNumber, formatPct, formatTLShort } from '../lib/aggregations';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background: 'rgba(0,0,0,0.72)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 16,
};

const COMPARE_COLORS = ['#22c55e', '#60a5fa', '#fb923c', '#f472b6', '#a855f7'];
const CURRENCY_COLORS: Record<string, string> = {
  TRY: '#ef4444', EUR: '#60a5fa', USD: '#22c55e', GBP: '#a855f7',
  BGN: '#fbbf24', RUB: '#f472b6', SAR: '#2dd4bf',
};
const GUN_LABEL = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];

type Mode = 'tek' | 'karsilastir';

interface Props {
  userName: string;
  userRole: string;
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface MekanRef { id: string; name: string; emoji: string; color: string; }

interface KPI {
  musteriSayisi: number;
  ciroTRY: number;
  brutoCiroTRY: number;
  satisAdet: number;
  iadeAdet: number;
  iadeCiroTRY: number;
  indirimTLTRY: number;
  toplamKare: number;
  sepetOrtalama: number;
  musteriBasiOrt: number;
  iadeOrani: number;
  indirimOrani: number;
  kareBasiGelir: number;
}

interface PrevKPI {
  musteriSayisi: number;
  ciroTRY: number;
  satisAdet: number;
  iadeAdet: number;
  toplamKare: number;
  musteriBasiOrt: number;
  iadeOrani: number;
  indirimOrani: number;
  kareBasiGelir: number;
}

interface AyOzeti {
  ay: string;
  ciro: number;
  musteri: number;
  iadeAdet: number;
  iadeFoto: number;
  indirimTL: number;
  brutoCiro: number;
  anomali: number;
  gunSayisi: number;
}

interface MekanData {
  id: string; name: string; emoji: string; color: string; printType: string;
  yearlyRent: number; gunlukKira: number;
  kpi: KPI;
  onceki: PrevKPI;
  ayliklar: AyOzeti[];
  gunlukler: { tarih: string; ciro: number; satis: number; musteri: number; iadeAdet: number }[];
  paraBirimi: { currency: string; adet: number; tutarOriginal: number; tutarTRY: number }[];
  gunDagilim: { gun: number; ciro: number; satis: number; musteri: number }[];
  saatDagilim: { saat: number; ciro: number; satis: number }[];
  saatDagilimAylik?: Record<string, { saat: number; ciro: number; satis: number }[]>;
  topPersonel: { id: string; name: string; ciro: number; satisAdet: number }[];
}

interface ApiResponse {
  baslangic: string; bitis: string;
  oncekiBaslangic: string; oncekiBitis: string;
  exchangeRates: Record<string, number>;
  mekanlar: MekanData[];
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Yıl bazlı tarih aralığı hesaplar.
 * Cari yıl ise: 1 Ocak - bugün, önceki = 1 Ocak prev - aynı tarih prev
 * Geçmiş yıl ise: 1 Ocak - 31 Aralık, önceki = 1 Ocak öncesinin yıl - 31 Aralık öncesinin yıl
 */
function getYearRange(yil: number): { baslangic: string; bitis: string; oncekiBaslangic: string; oncekiBitis: string } {
  const now = new Date();
  const buYil = now.getFullYear();
  const baslangic = `${yil}-01-01`;
  let bitis: string;
  let oncekiBitis: string;
  if (yil === buYil) {
    // Cari yıl — bugüne kadar
    bitis = fmtDate(now);
    // Önceki yıl aynı dönem (1 Oca - bugünün ay/gün'ü, geçen yılda)
    const oncekiSon = new Date(yil - 1, now.getMonth(), now.getDate());
    oncekiBitis = fmtDate(oncekiSon);
  } else {
    // Geçmiş yıl — tam yıl
    bitis = `${yil}-12-31`;
    oncekiBitis = `${yil - 1}-12-31`;
  }
  return {
    baslangic,
    bitis,
    oncekiBaslangic: `${yil - 1}-01-01`,
    oncekiBitis,
  };
}

/* ════════════════════════════════════════════
   YoY Badge — KPI kartının altında % değişim
   ════════════════════════════════════════════ */
function YoYBadge({ current, previous, isPercent = false }: { current: number; previous: number; isPercent?: boolean }) {
  const change = isPercent ? (current - previous) : calculateYoY(current, previous);
  const isUp = change > 0.05;
  const isDown = change < -0.05;
  const color = isUp ? '#22c55e' : isDown ? '#f87171' : 'rgba(255,255,255,0.4)';
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const txt = isPercent
    ? `${change >= 0 ? '+' : ''}${(Math.round(change * 10) / 10).toString().replace('.', ',')} pp`
    : `${change >= 0 ? '+' : ''}${(Math.round(change * 10) / 10).toString().replace('.', ',')}%`;
  return (
    <div className="flex items-center gap-1 mt-1" style={{ color }}>
      <Icon style={{ width: 11, height: 11 }} />
      <span className="text-[10px] font-bold">{txt}</span>
      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>önceki</span>
    </div>
  );
}

/* ════════════════════════════════════════════
   KPI Kart
   ════════════════════════════════════════════ */
function KpiCard({ icon, title, value, sub, color, yoy, isPercent }: {
  icon: React.ReactNode; title: string; value: string; sub?: string; color: string;
  yoy?: { current: number; previous: number }; isPercent?: boolean;
}) {
  return (
    <div style={{ ...glass, padding: 14, border: `1px solid ${color}25`, boxShadow: `0 4px 20px ${color}12` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center justify-center" style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${color}20`, border: `1px solid ${color}40`,
        }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{title}</p>
      <p className="text-base font-black text-white leading-tight" style={{ wordBreak: 'break-word' }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}
      {yoy && <YoYBadge current={yoy.current} previous={yoy.previous} isPercent={isPercent} />}
    </div>
  );
}

/* ════════════════════════════════════════════
   Section Title
   ════════════════════════════════════════════ */
function SectionTitle({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mt-4 mb-2">
      <span className="text-base">{emoji}</span>
      <h3 className="text-sm font-black text-white">{title}</h3>
      {sub && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>· {sub}</span>}
    </div>
  );
}

/* ════════════════════════════════════════════
   Chart Tooltip
   ════════════════════════════════════════════ */
const tooltipStyle = {
  contentStyle: {
    background: '#0f0a1f',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  labelStyle: { color: '#fff', fontWeight: 700, marginBottom: 4 },
  itemStyle: { color: 'rgba(255,255,255,0.85)' },
};

/* ════════════════════════════════════════════
   ANA COMPONENT
   ════════════════════════════════════════════ */
export function MekanIstatistikleri({ accessToken, userRole }: Props) {
  const [mode, setMode] = useState<Mode>('tek');
  const [yil, setYil] = useState<number>(new Date().getFullYear());
  const [aktifAy, setAktifAy] = useState<number>(new Date().getMonth() + 1);
  const [mekanlar, setMekanlar] = useState<MekanRef[]>([]);
  const [seciliMekanIds, setSeciliMekanIds] = useState<string[]>([]);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMekanDrop, setShowMekanDrop] = useState(false);

  const showFinancials = ['yonetici', 'ust-mudur'].includes(userRole);

  /* Mekanları yükle */
  useEffect(() => {
    (async () => {
      try {
        const token = accessToken || await getToken();
        const h = buildHeaders(token);
        const res = await fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers: h });
        if (res.ok) {
          const d = await res.json();
          const list = d.mekanlar || [];
          setMekanlar(list);
          if (list.length > 0 && seciliMekanIds.length === 0) {
            setSeciliMekanIds([list[0].id]);
          }
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  /* Veriyi çek */
  const fetchData = useCallback(async () => {
    if (seciliMekanIds.length === 0) return;
    const { baslangic, bitis, oncekiBaslangic, oncekiBitis } = getYearRange(yil);

    setLoading(true);
    setError('');
    try {
      const token = accessToken || await getToken();
      const h = buildHeaders(token);
      const url = appendGhostParam(
        `${API_BASE}/mekan/istatistik?baslangic=${baslangic}&bitis=${bitis}&oncekiBaslangic=${oncekiBaslangic}&oncekiBitis=${oncekiBitis}&mekanIds=${seciliMekanIds.join(',')}`
      );
      const res = await fetch(url, { headers: h });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Veri alınamadı.');
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      setError(`Bağlantı hatası: ${err}`);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [yil, seciliMekanIds, accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Mekan seçim toggle */
  const toggleMekan = (id: string) => {
    setSeciliMekanIds(prev => {
      if (mode === 'tek') return [id];
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(x => x !== id) : prev;
      }
      if (prev.length >= 3) return prev; // max 3 karşılaştırma
      return [...prev, id];
    });
  };

  const tumMekanlarSec = () => {
    setSeciliMekanIds(mekanlar.map(m => m.id));
  };
  const tumMekanlarSecili = mekanlar.length > 0 && seciliMekanIds.length === mekanlar.length;

  /* Mod değişince seçimi normalize et */
  useEffect(() => {
    if (mode === 'tek' && seciliMekanIds.length > 1) {
      setSeciliMekanIds([seciliMekanIds[0]]);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Yıl değişince aktif ay'ı reset et — cari yıl ise mevcut ay, geçmiş yıl ise Aralık */
  useEffect(() => {
    const today = new Date();
    if (yil === today.getFullYear()) setAktifAy(today.getMonth() + 1);
    else setAktifAy(12);
  }, [yil]);

  const aktifMekanlar = data?.mekanlar || [];
  const tekMekan = useMemo(() => {
    if (aktifMekanlar.length === 0) return null;
    if (mode === 'tek' && tumMekanlarSecili && aktifMekanlar.length > 1) {
      return aggregateMekanlar(aktifMekanlar);
    }
    return aktifMekanlar[0];
  }, [aktifMekanlar, mode, tumMekanlarSecili]);
  const { baslangic, bitis } = getYearRange(yil);

  /* Görüntülenecek mekan isimlerini sırayla hazırla (rozet için) */
  const seciliMekanRef = useMemo(() => mekanlar.filter(m => seciliMekanIds.includes(m.id)), [mekanlar, seciliMekanIds]);

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--app-bg, linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%))' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-black text-white">Mekan İstatistikleri</h1>
          <span className="text-xl">🏪</span>
        </div>
        <p className="text-xs font-medium" style={{ color: 'rgba(var(--app-accent-rgb),0.5)' }}>
          Performans, ciro, iade ve kâr analizi
        </p>
      </div>

      {/* Mod Seçici */}
      <div className="px-4 mb-3">
        <div className="flex gap-1 p-1" style={{ ...glass, borderRadius: 12, padding: 4 }}>
          {(['tek', 'karsilastir'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all"
              style={{
                background: mode === m ? 'rgba(var(--app-accent-rgb),0.18)' : 'transparent',
                color: mode === m ? 'var(--app-accent, #a855f7)' : 'rgba(255,255,255,0.5)',
                border: mode === m ? '1px solid rgba(var(--app-accent-rgb),0.4)' : '1px solid transparent',
              }}
            >
              {m === 'tek' ? '🎯 Tek Mekan' : '⚖️ Karşılaştırma'}
            </button>
          ))}
        </div>
      </div>

      {/* Mekan + Tarih Filtreleri */}
      <div className="px-4 space-y-2 mb-3">
        {/* Mekan seçici */}
        <div style={{ ...glass, padding: 10 }}>
          <button
            onClick={() => setShowMekanDrop(v => !v)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 style={{ width: 14, height: 14, color: 'var(--app-accent, #a855f7)', flexShrink: 0 }} />
              <span className="text-xs font-bold text-white truncate">
                {seciliMekanRef.length > 0
                  ? seciliMekanRef.map(m => `${m.emoji} ${m.name}`).join(', ')
                  : 'Mekan seç'}
              </span>
            </div>
            <ChevronDown style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)', transform: showMekanDrop ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {showMekanDrop && (
            <div className="mt-2 max-h-56 overflow-y-auto space-y-1 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {mode === 'karsilastir' && (
                <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Maksimum 3 mekan seçebilirsin</p>
              )}
              {mode === 'tek' && (
                <button
                  onClick={tumMekanlarSec}
                  className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                  style={{
                    background: tumMekanlarSecili ? 'rgba(var(--app-accent-rgb),0.18)' : 'transparent',
                    border: tumMekanlarSecili ? '1px solid rgba(var(--app-accent-rgb),0.4)' : '1px solid transparent',
                  }}
                >
                  <span>🏢</span>
                  <span className="text-xs font-bold flex-1" style={{ color: tumMekanlarSecili ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                    Tüm Mekanlar (toplam)
                  </span>
                  {tumMekanlarSecili && <span className="text-[10px] font-bold" style={{ color: 'var(--app-accent, #a855f7)' }}>✓</span>}
                </button>
              )}
              {mekanlar.map(m => {
                const sec = seciliMekanIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMekan(m.id)}
                    className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
                    style={{
                      background: sec ? 'rgba(var(--app-accent-rgb),0.18)' : 'transparent',
                      border: sec ? '1px solid rgba(var(--app-accent-rgb),0.4)' : '1px solid transparent',
                    }}
                  >
                    <span>{m.emoji}</span>
                    <span className="text-xs font-semibold flex-1 truncate" style={{ color: sec ? '#fff' : 'rgba(255,255,255,0.7)' }}>{m.name}</span>
                    {sec && <span className="text-[10px] font-bold" style={{ color: 'var(--app-accent, #a855f7)' }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Yıl seçici */}
        <div style={{ ...glass, padding: 8 }}>
          <div className="flex items-center gap-1 mb-2">
            <Calendar style={{ width: 12, height: 12, color: '#fbbf24' }} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>Yıl</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(() => {
              const buYil = new Date().getFullYear();
              const yillar = [buYil, buYil - 1, buYil - 2, buYil - 3];
              return yillar.map(y => (
                <button
                  key={y}
                  onClick={() => setYil(y)}
                  className="py-2 px-2 rounded-md text-[12px] font-bold transition-colors"
                  style={{
                    background: yil === y ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.04)',
                    color: yil === y ? '#fbbf24' : 'rgba(255,255,255,0.55)',
                    border: yil === y ? '1px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {y}
                </button>
              ));
            })()}
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {baslangic} → {bitis} · YoY karşılaştırması: {yil - 1}
          </p>
        </div>
      </div>

      {/* Yenile */}
      <div className="px-4 mb-3 flex justify-end">
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
          style={{
            background: 'rgba(var(--app-accent-rgb),0.12)',
            border: '1px solid rgba(var(--app-accent-rgb),0.3)',
            color: 'var(--app-accent, #a855f7)',
          }}
        >
          {loading ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <RefreshCw style={{ width: 12, height: 12 }} />}
          Yenile
        </button>
      </div>

      {/* Hata */}
      {error && (
        <div className="px-4 mb-3">
          <div style={{ ...glass, padding: 12, border: '1px solid rgba(248,113,113,0.4)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle style={{ width: 16, height: 16, color: '#f87171' }} />
              <p className="text-xs font-semibold" style={{ color: '#fca5a5' }}>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="px-4 space-y-2">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* İçerik */}
      {!loading && data && aktifMekanlar.length === 0 && (
        <div className="px-4">
          <div style={{ ...glass, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <p style={{ color: 'white', fontWeight: 700 }}>Veri bulunamadı</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4 }}>
              Seçili dönemde bu mekan(lar) için satış kaydı yok
            </p>
          </div>
        </div>
      )}

      {!loading && aktifMekanlar.length > 0 && (
        <div className="px-4 space-y-2">
          {/* Tek Mekan Modu */}
          {mode === 'tek' && tekMekan && (
            <TekMekanGorunum mekan={tekMekan} showFinancials={showFinancials} baslangic={baslangic} bitis={bitis} aktifAy={aktifAy} onAyChange={setAktifAy} />
          )}

          {/* Karşılaştırma Modu */}
          {mode === 'karsilastir' && aktifMekanlar.length >= 2 && (
            <KarsilastirmaGorunum mekanlar={aktifMekanlar} showFinancials={showFinancials} bitis={bitis} />
          )}

          {mode === 'karsilastir' && aktifMekanlar.length < 2 && (
            <div style={{ ...glass, padding: 24, textAlign: 'center' }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>
                Karşılaştırma için en az 2 mekan seç
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                Yukarıdan farklı mekanlar ekleyebilirsin
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   AGGREGATE — Tüm Mekanları tek bir görünümde topla
   ════════════════════════════════════════════ */
function aggregateMekanlar(mekanlar: MekanData[]): MekanData {
  const sumKpi = (key: keyof KPI): number =>
    mekanlar.reduce((s, m) => s + (Number((m.kpi as any)[key]) || 0), 0);
  const sumOnceki = (key: keyof PrevKPI): number =>
    mekanlar.reduce((s, m) => s + (Number((m.onceki as any)[key]) || 0), 0);

  // Aylık verileri ay bazında topla
  const ayMap = new Map<string, AyOzeti>();
  for (const m of mekanlar) {
    for (const a of m.ayliklar) {
      const ex = ayMap.get(a.ay);
      if (ex) {
        ex.ciro += a.ciro;
        ex.musteri += a.musteri;
        ex.iadeAdet += a.iadeAdet;
        ex.iadeFoto += a.iadeFoto || 0;
        ex.indirimTL += a.indirimTL;
        ex.brutoCiro += a.brutoCiro;
        ex.anomali += a.anomali;
        ex.gunSayisi = Math.max(ex.gunSayisi, a.gunSayisi);
      } else {
        ayMap.set(a.ay, { ...a, iadeFoto: a.iadeFoto || 0 });
      }
    }
  }
  const ayliklar = Array.from(ayMap.values()).sort((a, b) => a.ay.localeCompare(b.ay));

  // Günlük (tarih bazında topla)
  const gunMap = new Map<string, { tarih: string; ciro: number; satis: number; musteri: number; iadeAdet: number }>();
  for (const m of mekanlar) {
    for (const g of m.gunlukler || []) {
      const ex = gunMap.get(g.tarih);
      if (ex) {
        ex.ciro += g.ciro; ex.satis += g.satis; ex.musteri += g.musteri; ex.iadeAdet += g.iadeAdet;
      } else {
        gunMap.set(g.tarih, { ...g });
      }
    }
  }
  const gunlukler = Array.from(gunMap.values()).sort((a, b) => a.tarih.localeCompare(b.tarih));

  // Para birimi
  const pbMap = new Map<string, { currency: string; adet: number; tutarOriginal: number; tutarTRY: number }>();
  for (const m of mekanlar) {
    for (const p of m.paraBirimi) {
      const ex = pbMap.get(p.currency);
      if (ex) {
        ex.adet += p.adet; ex.tutarOriginal += p.tutarOriginal; ex.tutarTRY += p.tutarTRY;
      } else {
        pbMap.set(p.currency, { ...p });
      }
    }
  }
  const paraBirimi = Array.from(pbMap.values()).sort((a, b) => b.tutarTRY - a.tutarTRY);

  // Gün dağılımı (Pzt..Paz)
  const gunDagilim = Array.from({ length: 7 }, (_, gun) => {
    let ciro = 0, satis = 0, musteri = 0;
    for (const m of mekanlar) {
      const g = m.gunDagilim.find(x => x.gun === gun);
      if (g) { ciro += g.ciro; satis += g.satis; musteri += g.musteri; }
    }
    return { gun, ciro, satis, musteri };
  });

  // Saat dağılımı
  const saatDagilim = Array.from({ length: 24 }, (_, saat) => {
    let ciro = 0, satis = 0;
    for (const m of mekanlar) {
      const s = m.saatDagilim.find(x => x.saat === saat);
      if (s) { ciro += s.ciro; satis += s.satis; }
    }
    return { saat, ciro, satis };
  });

  // Top personel — id bazında topla, top 5
  const personelMap = new Map<string, { id: string; name: string; ciro: number; satisAdet: number }>();
  for (const m of mekanlar) {
    for (const p of m.topPersonel) {
      const ex = personelMap.get(p.id);
      if (ex) { ex.ciro += p.ciro; ex.satisAdet += p.satisAdet; }
      else personelMap.set(p.id, { ...p });
    }
  }
  const topPersonel = Array.from(personelMap.values()).sort((a, b) => b.ciro - a.ciro).slice(0, 5);

  // Toplam KPI'lar — toplanabilir alanları topla, oran/ortalama olanları yeniden hesapla
  const ciroTRY = sumKpi('ciroTRY');
  const brutoCiroTRY = sumKpi('brutoCiroTRY');
  const indirimTLTRY = sumKpi('indirimTLTRY');
  const satisAdet = sumKpi('satisAdet');
  const iadeAdet = sumKpi('iadeAdet');
  const musteriSayisi = sumKpi('musteriSayisi');
  const toplamKare = sumKpi('toplamKare');

  const oCiro = sumOnceki('ciroTRY');
  const oSatis = sumOnceki('satisAdet');
  const oIade = sumOnceki('iadeAdet');
  const oMusteri = sumOnceki('musteriSayisi');
  const oKare = sumOnceki('toplamKare');

  const yearlyRent = mekanlar.reduce((s, m) => s + m.yearlyRent, 0);
  const gunlukKira = mekanlar.reduce((s, m) => s + m.gunlukKira, 0);

  return {
    id: '__all__',
    name: 'Tüm Mekanlar (toplam)',
    emoji: '🏢',
    color: '#a855f7',
    printType: 'tam',
    yearlyRent,
    gunlukKira,
    kpi: {
      musteriSayisi,
      ciroTRY,
      brutoCiroTRY,
      satisAdet,
      iadeAdet,
      iadeCiroTRY: sumKpi('iadeCiroTRY'),
      indirimTLTRY,
      toplamKare,
      sepetOrtalama: satisAdet > 0 ? Math.round(ciroTRY / satisAdet) : 0,
      musteriBasiOrt: musteriSayisi > 0 ? Math.round(ciroTRY / musteriSayisi) : 0,
      iadeOrani: satisAdet > 0 ? Math.round((iadeAdet / satisAdet) * 1000) / 10 : 0,
      indirimOrani: brutoCiroTRY > 0 ? Math.round((indirimTLTRY / brutoCiroTRY) * 1000) / 10 : 0,
      kareBasiGelir: toplamKare > 0 ? Math.round(ciroTRY / toplamKare) : 0,
    },
    onceki: {
      musteriSayisi: oMusteri,
      ciroTRY: oCiro,
      satisAdet: oSatis,
      iadeAdet: oIade,
      toplamKare: oKare,
      musteriBasiOrt: oMusteri > 0 ? Math.round(oCiro / oMusteri) : 0,
      iadeOrani: oSatis > 0 ? Math.round((oIade / oSatis) * 1000) / 10 : 0,
      indirimOrani: 0, // basit aggregate
      kareBasiGelir: oKare > 0 ? Math.round(oCiro / oKare) : 0,
    },
    ayliklar,
    gunlukler,
    paraBirimi,
    gunDagilim,
    saatDagilim,
    topPersonel,
  };
}

/* ════════════════════════════════════════════
   TEK MEKAN GÖRÜNÜMÜ
   ════════════════════════════════════════════ */
function TekMekanGorunum({ mekan, showFinancials, baslangic, bitis, aktifAy, onAyChange }: {
  mekan: MekanData; showFinancials: boolean; baslangic: string; bitis: string;
  aktifAy: number; onAyChange: (ay: number) => void;
}) {
  const k = mekan.kpi;
  const o = mekan.onceki;

  /* Aylık trend grafiği — Ocak'tan Aralık'a 12 ay (eksik aylar 0 doldurulur) */
  const yilForChart = parseInt(bitis.slice(0, 4), 10);
  const ayliklarChart = Array.from({ length: 12 }, (_, i) => {
    const ayNo = i + 1;
    const ayKey = `${yilForChart}-${String(ayNo).padStart(2, '0')}`;
    const veri = mekan.ayliklar.find(x => x.ay === ayKey);
    return {
      ay: ayKey,
      label: ayLabel(ayKey).replace(/ \d{4}$/, ''), // "Nis 2026" → "Nis"
      ciro: veri?.ciro || 0,
      musteri: veri?.musteri || 0,
      iadeAdet: veri?.iadeAdet || 0,
      iadeFoto: veri?.iadeFoto || 0,
      indirimTL: veri?.indirimTL || 0,
      brutoCiro: veri?.brutoCiro || 0,
      anomali: veri?.anomali || 0,
      gunSayisi: veri?.gunSayisi || 0,
    };
  });

  /* Para birimi pie verisi */
  const paraBirimiData = mekan.paraBirimi.map(p => ({
    name: p.currency,
    value: p.tutarTRY,
    adet: p.adet,
    color: CURRENCY_COLORS[p.currency] || '#94a3b8',
  }));

  /* Hafta günü dağılım */
  const haftaData = mekan.gunDagilim.map(g => ({
    gun: GUN_LABEL[g.gun],
    ciro: g.ciro,
    musteri: g.musteri,
    satis: g.satis,
  }));

  /* Saat dağılım — sadece veri olan saatler */
  const veriliSaatler = mekan.saatDagilim.filter(s => s.satis > 0);
  const saatData = mekan.saatDagilim.map(s => ({
    saat: `${String(s.saat).padStart(2, '0')}:00`,
    satis: s.satis,
    ciro: s.ciro,
  }));

  return (
    <>
      {/* Başlık */}
      <div className="flex items-center gap-2 mb-1 mt-2">
        <span className="text-2xl">{mekan.emoji}</span>
        <div>
          <h2 className="text-base font-black text-white">{mekan.name}</h2>
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Baskı: {mekan.printType === 'yarim' ? 'Yarım boy' : 'Tam boy'}
            {mekan.yearlyRent > 0 && ` · Yıllık kira: ${formatTLShort(mekan.yearlyRent)}`}
          </p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard
          icon={<Users style={{ width: 14, height: 14 }} />}
          title="Müşteri"
          value={formatNumber(k.musteriSayisi)}
          color="#60a5fa"
          yoy={{ current: k.musteriSayisi, previous: o.musteriSayisi }}
        />
        {showFinancials && (
          <KpiCard
            icon={<Wallet style={{ width: 14, height: 14 }} />}
            title="Toplam Ciro"
            value={formatTLShort(k.ciroTRY)}
            sub={`${formatNumber(k.satisAdet)} satış`}
            color="#22c55e"
            yoy={{ current: k.ciroTRY, previous: o.ciroTRY }}
          />
        )}
        {showFinancials && (
          <KpiCard
            icon={<ShoppingCart style={{ width: 14, height: 14 }} />}
            title="Sepet Ort."
            value={formatTLShort(k.sepetOrtalama)}
            sub={`Müş. başı ${formatTLShort(k.musteriBasiOrt)}`}
            color="#fb923c"
            yoy={{ current: k.musteriBasiOrt, previous: o.musteriBasiOrt }}
          />
        )}
        <KpiCard
          icon={<RotateCcw style={{ width: 14, height: 14 }} />}
          title="İade Oranı"
          value={formatPct(k.iadeOrani)}
          sub={`${formatNumber(k.iadeAdet)} iade / ${formatNumber(k.satisAdet)}`}
          color="#f87171"
          yoy={{ current: k.iadeOrani, previous: o.iadeOrani }}
          isPercent
        />
        <KpiCard
          icon={<Tag style={{ width: 14, height: 14 }} />}
          title="İndirim"
          value={formatPct(k.indirimOrani)}
          sub={showFinancials ? formatTLShort(k.indirimTLTRY) : ''}
          color="#fbbf24"
          yoy={{ current: k.indirimOrani, previous: o.indirimOrani }}
          isPercent
        />
        {showFinancials && (
          <KpiCard
            icon={<Layers style={{ width: 14, height: 14 }} />}
            title="Kare Başı Gelir"
            value={formatTLShort(k.kareBasiGelir)}
            sub={`${formatNumber(k.toplamKare)} kare`}
            color="#a855f7"
            yoy={{ current: k.kareBasiGelir, previous: o.kareBasiGelir }}
          />
        )}
      </div>

      {/* AYLIK CİRO TRENDİ */}
      {ayliklarChart.length > 0 && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="📈" title="Aylık Ciro" sub={`${ayliklarChart.length} ay`} />
          <ResponsiveContainer width="100%" height={200} minWidth={0}>
            <LineChart data={ayliklarChart} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={(v) => formatTLShort(v)} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [formatTLShort(value), 'Ciro']} />
              <Line type="monotone" dataKey="ciro" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AYLIK MÜŞTERİ */}
      {ayliklarChart.length > 0 && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="👥" title="Aylık Müşteri" />
          <ResponsiveContainer width="100%" height={180} minWidth={0}>
            <BarChart data={ayliklarChart} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [formatNumber(value), 'Müşteri']} />
              <Bar dataKey="musteri" fill="#60a5fa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* İADE SATIŞ TRENDİ */}
      {ayliklarChart.length > 0 && k.iadeAdet > 0 && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="↩️" title="Aylık İade Satış" sub="iptal edilen satış adedi" />
          <ResponsiveContainer width="100%" height={160} minWidth={0}>
            <BarChart data={ayliklarChart} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [formatNumber(value), 'İade Satış']} />
              <Bar dataKey="iadeAdet" fill="#f87171" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* İADE FOTOĞRAF TRENDİ */}
      {ayliklarChart.length > 0 && ayliklarChart.some(a => a.iadeFoto > 0) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="🖼️" title="Aylık İade Fotoğraf" sub="basılan ama satılmayan" />
          <ResponsiveContainer width="100%" height={160} minWidth={0}>
            <BarChart data={ayliklarChart} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [formatNumber(value), 'İade Foto']} />
              <Bar dataKey="iadeFoto" fill="#fb923c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* İNDİRİM TRENDİ */}
      {showFinancials && ayliklarChart.length > 0 && k.indirimTLTRY > 0 && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="🏷️" title="Aylık İndirim" />
          <ResponsiveContainer width="100%" height={160} minWidth={0}>
            <LineChart data={ayliklarChart.map(a => ({
              ...a,
              indirimOrani: a.brutoCiro > 0 ? (a.indirimTL / a.brutoCiro) * 100 : 0,
            }))} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={(v) => `%${Math.round(v)}`} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [formatPct(value), 'İndirim Oranı']} />
              <Line type="monotone" dataKey="indirimOrani" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3, fill: '#fbbf24' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* PARA BİRİMİ DAĞILIMI */}
      {showFinancials && paraBirimiData.length > 1 && (() => {
        const toplam = paraBirimiData.reduce((s, p) => s + p.value, 0);
        return (
          <div style={{ ...glass, padding: 14 }}>
            <SectionTitle emoji="💱" title="Para Birimi Dağılımı" sub="ciro TL bazında" />
            <ResponsiveContainer width="100%" height={180} minWidth={0}>
              <PieChart>
                <Pie
                  data={paraBirimiData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={2}
                  labelLine={false}
                >
                  {paraBirimiData.map((e, i) => (
                    <Cell key={i} fill={e.color} stroke="rgba(0,0,0,0.4)" />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => [formatTLShort(value), name]} />
              </PieChart>
            </ResponsiveContainer>
            {/* Alt liste — daha okunaklı */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
              {paraBirimiData.map((p, i) => {
                const pct = toplam > 0 ? (p.value / toplam) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.color}30` }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: p.color, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[11px] font-bold text-white">{p.name}</span>
                        <span className="text-[11px] font-bold" style={{ color: p.color }}>
                          {pct >= 1 ? `%${Math.round(pct)}` : `<%1`}
                        </span>
                      </div>
                      <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{formatTLShort(p.value)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* HAFTANIN GÜNÜNE GÖRE */}
      {showFinancials && haftaData.some(d => d.satis > 0) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="📅" title="Haftanın Gününe Göre" sub="yıllık toplam · ciro" />
          <p className="text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Seçili yılın tüm Pazartesilerinin, Salılarının... toplam cirosu — hangi gün daha kazançlı?
          </p>
          <ResponsiveContainer width="100%" height={170} minWidth={0}>
            <BarChart data={haftaData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="gun" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={(v) => formatTLShort(v)} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [formatTLShort(value), 'Ciro']} />
              <Bar dataKey="ciro" fill="#a855f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
            💡 Yüksek günler peak günleri · Personel/stok planlamasında kullanılabilir
          </p>
        </div>
      )}

      {/* AY GÜNLERİ — 1'den ayın sonuna kadar (önceki/sonraki ay tuşlarıyla) */}
      {showFinancials && mekan.gunlukler && mekan.gunlukler.length > 0 && (() => {
        const [yil] = bitis.split('-').map(Number);
        const today = new Date();
        const isCurrentYear = yil === today.getFullYear();
        const lastAllowedAy = isCurrentYear ? today.getMonth() + 1 : 12;

        const ayNo = aktifAy;
        const lastDay = new Date(yil, ayNo, 0).getDate();
        const isCurrentMonth = isCurrentYear && ayNo === today.getMonth() + 1;
        const todayDayNo = isCurrentMonth ? today.getDate() : 999;

        const TR_GUN_KISA = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
        const ayGunleri: { tarih: string; gunNo: number; ciro: number; gelecek: boolean; gunHarf: string }[] = [];
        for (let g = 1; g <= lastDay; g++) {
          const tarih = `${yil}-${String(ayNo).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
          const veri = mekan.gunlukler.find(x => x.tarih === tarih);
          const dt = new Date(yil, ayNo - 1, g);
          const idx = (dt.getDay() + 6) % 7; // Pzt=0..Paz=6
          const ciro = veri?.ciro || 0;
          ayGunleri.push({
            tarih,
            gunNo: g,
            ciro,
            gelecek: g > todayDayNo,
            gunHarf: ciro > 0 ? TR_GUN_KISA[idx] : '',
          });
        }

        // Ortalama = sadece veri olan (geçmiş + bugün) günler
        const verili = ayGunleri.filter(g => !g.gelecek);
        const toplam = verili.reduce((s, g) => s + g.ciro, 0);
        const ortalama = Math.round(toplam / Math.max(verili.length, 1));
        const ayAd = ayLabel(`${yil}-${String(ayNo).padStart(2, '0')}`);

        const prevDisabled = ayNo <= 1;
        const nextDisabled = ayNo >= lastAllowedAy;

        return (
          <div style={{ ...glass, padding: 14 }}>
            <div className="flex items-center justify-between mb-1">
              <SectionTitle emoji="📆" title={`${ayAd} — Günlük`} sub={`ortalama ${formatTLShort(ortalama)}/gün`} />
            </div>
            {/* Ay navigasyon */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => onAyChange(Math.max(1, ayNo - 1))}
                disabled={prevDisabled}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors"
                style={{
                  background: prevDisabled ? 'rgba(255,255,255,0.03)' : 'rgba(var(--app-accent-rgb),0.12)',
                  border: `1px solid ${prevDisabled ? 'rgba(255,255,255,0.06)' : 'rgba(var(--app-accent-rgb),0.3)'}`,
                  color: prevDisabled ? 'rgba(255,255,255,0.25)' : 'var(--app-accent, #a855f7)',
                  cursor: prevDisabled ? 'default' : 'pointer',
                }}
              >
                <ChevronLeft style={{ width: 12, height: 12 }} /> Önceki
              </button>
              <span className="flex-1 text-center text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>{ayAd}</span>
              <button
                onClick={() => onAyChange(Math.min(lastAllowedAy, ayNo + 1))}
                disabled={nextDisabled}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors"
                style={{
                  background: nextDisabled ? 'rgba(255,255,255,0.03)' : 'rgba(var(--app-accent-rgb),0.12)',
                  border: `1px solid ${nextDisabled ? 'rgba(255,255,255,0.06)' : 'rgba(var(--app-accent-rgb),0.3)'}`,
                  color: nextDisabled ? 'rgba(255,255,255,0.25)' : 'var(--app-accent, #a855f7)',
                  cursor: nextDisabled ? 'default' : 'pointer',
                }}
              >
                Sonraki <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={190} minWidth={0}>
              <BarChart data={ayGunleri} margin={{ top: 5, right: 6, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="gunNo" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={1} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={(v) => formatTLShort(v)} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number) => [formatTLShort(value), 'Ciro']}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload;
                    if (!item) return '';
                    const [y, m, d] = item.tarih.split('-').map(Number);
                    const TR_GUNLER_TAM = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
                    const date = new Date(y, m - 1, d);
                    return `${TR_GUNLER_TAM[date.getDay()]} · ${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`;
                  }}
                />
                <ReferenceLine
                  y={ortalama}
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{
                    value: `Ort ${formatTLShort(ortalama)}`,
                    position: 'insideTopRight',
                    fill: '#fbbf24',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                />
                <Bar dataKey="ciro" radius={[3, 3, 0, 0]} maxBarSize={14}>
                  {ayGunleri.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.gelecek ? 'rgba(255,255,255,0.04)' :
                        entry.ciro === 0 ? 'rgba(255,255,255,0.08)' :
                        entry.ciro >= ortalama ? '#22c55e' :
                        '#60a5fa'
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="gunHarf"
                    position="top"
                    fill="rgba(255,255,255,0.65)"
                    fontSize={8}
                    fontWeight={700}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              💡 Yeşil = ortalama üstü · Mavi = altı · Boş gri = veri yok · Soluk gri = gelecek gün
            </p>
          </div>
        );
      })()}

      {/* SAATLİK DAĞILIM — aktif aya göre */}
      {showFinancials && (() => {
        const yilForSaat = parseInt(bitis.slice(0, 4), 10);
        const today = new Date();
        const isCurrentYear = yilForSaat === today.getFullYear();
        const lastAllowedAy = isCurrentYear ? today.getMonth() + 1 : 12;
        const ayKey = `${yilForSaat}-${String(aktifAy).padStart(2, '0')}`;
        const aySaatVeri = mekan.saatDagilimAylik?.[ayKey] || [];
        const saatDataAy = Array.from({ length: 24 }, (_, saat) => {
          const v = aySaatVeri.find(x => x.saat === saat);
          return { saat: `${String(saat).padStart(2, '0')}:00`, satis: v?.satis || 0, ciro: v?.ciro || 0 };
        });
        const veriliSaatlerAy = saatDataAy.filter(s => s.satis > 0);
        if (veriliSaatlerAy.length === 0) return null;
        const ayAd = ayLabel(ayKey);
        const prevDisabled = aktifAy <= 1;
        const nextDisabled = aktifAy >= lastAllowedAy;

        return (
          <div style={{ ...glass, padding: 14 }}>
            <SectionTitle emoji="⏰" title={`${ayAd} — Saatlik Yoğunluk`} sub="satış adedi" />
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => onAyChange(Math.max(1, aktifAy - 1))}
                disabled={prevDisabled}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors"
                style={{
                  background: prevDisabled ? 'rgba(255,255,255,0.03)' : 'rgba(var(--app-accent-rgb),0.12)',
                  border: `1px solid ${prevDisabled ? 'rgba(255,255,255,0.06)' : 'rgba(var(--app-accent-rgb),0.3)'}`,
                  color: prevDisabled ? 'rgba(255,255,255,0.25)' : 'var(--app-accent, #a855f7)',
                  cursor: prevDisabled ? 'default' : 'pointer',
                }}
              >
                <ChevronLeft style={{ width: 12, height: 12 }} /> Önceki
              </button>
              <span className="flex-1 text-center text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>{ayAd}</span>
              <button
                onClick={() => onAyChange(Math.min(lastAllowedAy, aktifAy + 1))}
                disabled={nextDisabled}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-colors"
                style={{
                  background: nextDisabled ? 'rgba(255,255,255,0.03)' : 'rgba(var(--app-accent-rgb),0.12)',
                  border: `1px solid ${nextDisabled ? 'rgba(255,255,255,0.06)' : 'rgba(var(--app-accent-rgb),0.3)'}`,
                  color: nextDisabled ? 'rgba(255,255,255,0.25)' : 'var(--app-accent, #a855f7)',
                  cursor: nextDisabled ? 'default' : 'pointer',
                }}
              >
                Sonraki <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={170} minWidth={0}>
              <BarChart data={saatDataAy} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="saat" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.5)' }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
                <Tooltip {...tooltipStyle} formatter={(value: number) => [formatNumber(value), 'Satış']} />
                <Bar dataKey="satis" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* KÂR/ZARAR — Takvim Yılı (Ocak–Aralık) */}
      {showFinancials && mekan.yearlyRent > 0 && (() => {
        // Aylık sabit kira = yıllık kira / 12
        const aylikKira = Math.round(mekan.yearlyRent / 12);
        // Cari yıl (bitis tarihinden)
        const yil = parseInt(bitis.slice(0, 4), 10);
        const today = new Date();
        const kapakGun = (yil === today.getFullYear()) ? today.getDate() : 31;
        const buckets = Array.from({ length: 12 }, (_, i) => {
          const ayNo = i + 1;
          const ayKey = `${yil}-${String(ayNo).padStart(2, '0')}`;
          const veri = mekan.ayliklar.find(x => x.ay === ayKey);
          const ciro = veri?.ciro || 0;
          // Cari ay mı? — eğer öyleyse sadece tek çubuk (ciroGune'yi gizle)
          const isCurrentMonth = (yil === today.getFullYear() && ayNo === today.getMonth() + 1);
          // O ayın 1-{kapakGun} arası ciro toplamı (gunlukler'den) — sadece geçmiş aylar için
          let ciroGune = 0;
          if (!isCurrentMonth) {
            for (const g of (mekan.gunlukler || [])) {
              if (!g.tarih.startsWith(ayKey + '-')) continue;
              const gun = parseInt(g.tarih.slice(8), 10);
              if (gun <= kapakGun) ciroGune += g.ciro;
            }
          }
          return {
            ay: ayKey,
            label: ayLabel(ayKey).replace(/ \d{4}$/, ''), // "Nis 2026" → "Nis"
            ciro,
            ciroGune,
            aylikKira,
            netKar: ciro - aylikKira,
          };
        });

        return (
          <div style={{ ...glass, padding: 14 }}>
            <SectionTitle emoji="💰" title="Kâr Eşiği — Yıllık" sub={`${yil} · aylık kira ${formatTLShort(aylikKira)}`} />
            <p className="text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Solid = ay tamamı · Saydam = bugüne ({kapakGun}.) kadar · Kırmızı çizgi = aylık kira
            </p>
            <ResponsiveContainer width="100%" height={240} minWidth={0}>
              <BarChart data={buckets} margin={{ top: 5, right: 6, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.7)' }} interval={0} />
                <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={(v) => formatTLShort(v)} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number, name: string) => {
                    if (value === 0 && name !== 'Ay Tamamı') return ['', '']; // 0 değerli çubuk gösterme
                    return [formatTLShort(value), name];
                  }}
                  labelFormatter={(_label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? ayLabel(item.ay) : '';
                  }}
                />
                <ReferenceLine
                  y={aylikKira}
                  stroke="#f87171"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  label={{
                    value: `Kira ${formatTLShort(aylikKira)}`,
                    position: 'insideTopRight',
                    fill: '#f87171',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                <Bar dataKey="ciro" name="Ay Tamamı" radius={[4, 4, 0, 0]} maxBarSize={14}>
                  {buckets.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.ciro >= aylikKira ? '#22c55e' : entry.ciro > 0 ? '#fbbf24' : 'rgba(255,255,255,0.08)'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="ciroGune" name={`${kapakGun}. Güne Kadar`} radius={[4, 4, 0, 0]} maxBarSize={14}>
                  {buckets.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.ciroGune > 0 ? '#60a5fa' : 'transparent'}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              💡 Mavi çubuklar her ayın aynı gününe kadar ki ciroyu gösterir — diğer aylar bu noktada nereye gelmişti? Yükseliş/düşüş trendi görünür.
            </p>
          </div>
        );
      })()}

      {/* TOP PERSONEL */}
      {showFinancials && mekan.topPersonel.length > 0 && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="🏆" title="Top Personel" sub="ciro bazında" />
          <div className="space-y-1.5">
            {mekan.topPersonel.map((p, i) => {
              const pct = mekan.topPersonel[0].ciro > 0 ? (p.ciro / mekan.topPersonel[0].ciro) * 100 : 0;
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="flex items-center justify-center font-black text-[11px] flex-shrink-0" style={{
                    width: 22, height: 22, borderRadius: 7,
                    background: i === 0 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)',
                    color: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                  }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#22c55e' }} />
                      </div>
                      <span className="text-[10px] font-bold flex-shrink-0" style={{ color: '#22c55e', minWidth: 60, textAlign: 'right' }}>
                        {formatTLShort(p.ciro)}
                      </span>
                    </div>
                    <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.satisAdet} satış</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ANOMALI TRENDİ */}
      {ayliklarChart.length > 0 && ayliklarChart.some(a => a.anomali > 0) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="🚨" title="Aylık Anomali Puanı" />
          <ResponsiveContainer width="100%" height={150} minWidth={0}>
            <LineChart data={ayliklarChart} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [formatNumber(value), 'Anomali']} />
              <Line type="monotone" dataKey="anomali" stroke="#f87171" strokeWidth={2} dot={{ r: 3, fill: '#f87171' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════
   KARŞILAŞTIRMA GÖRÜNÜMÜ (2-3 mekan yan yana)
   ════════════════════════════════════════════ */
function KarsilastirmaGorunum({ mekanlar, showFinancials, bitis }: { mekanlar: MekanData[]; showFinancials: boolean; bitis: string }) {
  /* 12 aylık birleşik dataset'ler (Ocak–Aralık padding) */
  const yilK = parseInt(bitis.slice(0, 4), 10);
  const ayKeys = Array.from({ length: 12 }, (_, i) => `${yilK}-${String(i + 1).padStart(2, '0')}`);
  const ayLabelKisa = (k: string) => ayLabel(k).replace(/ \d{4}$/, '');

  const buildAyData = (field: 'ciro' | 'musteri' | 'iadeAdet' | 'iadeFoto') =>
    ayKeys.map(ay => {
      const row: any = { ay, label: ayLabelKisa(ay) };
      mekanlar.forEach(m => {
        const a = m.ayliklar.find(x => x.ay === ay);
        row[m.id] = a?.[field] || 0;
      });
      return row;
    });

  const ayCiroData = buildAyData('ciro');
  const ayMusteriData = buildAyData('musteri');
  const ayIadeData = buildAyData('iadeAdet');
  const ayIadeFotoData = buildAyData('iadeFoto');

  // Aylık indirim oranı (% — bruto cirodan iskontonun payı)
  const ayIndirimData = ayKeys.map(ay => {
    const row: any = { ay, label: ayLabelKisa(ay) };
    mekanlar.forEach(m => {
      const a = m.ayliklar.find(x => x.ay === ay);
      row[m.id] = a && a.brutoCiro > 0 ? Math.round((a.indirimTL / a.brutoCiro) * 1000) / 10 : 0;
    });
    return row;
  });

  // Hafta günü (0..6 → Pzt..Paz)
  const haftaData = Array.from({ length: 7 }, (_, gun) => {
    const row: any = { gun, label: ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'][gun] };
    mekanlar.forEach(m => {
      const g = m.gunDagilim.find(x => x.gun === gun);
      row[m.id] = g?.ciro || 0;
    });
    return row;
  });

  // Saatlik (yıllık aggregate)
  const saatData = Array.from({ length: 24 }, (_, saat) => {
    const row: any = { saat, label: `${String(saat).padStart(2, '0')}:00` };
    mekanlar.forEach(m => {
      const s = m.saatDagilim.find(x => x.saat === saat);
      row[m.id] = s?.satis || 0;
    });
    return row;
  });

  return (
    <>
      {/* KPI Kartlar — her mekan kendi satırı */}
      <div className="space-y-2">
        {mekanlar.map((mekan, idx) => {
          const k = mekan.kpi;
          const o = mekan.onceki;
          const renk = COMPARE_COLORS[idx];
          return (
            <div key={mekan.id} style={{ ...glass, padding: 12, border: `1px solid ${renk}40` }}>
              <div className="flex items-center gap-2 mb-2">
                <div style={{ width: 8, height: 8, borderRadius: 999, background: renk }} />
                <span className="text-base">{mekan.emoji}</span>
                <h3 className="text-sm font-black text-white flex-1">{mekan.name}</h3>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <MiniKpi label="Müşteri" value={formatNumber(k.musteriSayisi)} yoy={calculateYoY(k.musteriSayisi, o.musteriSayisi)} />
                {showFinancials && (
                  <MiniKpi label="Ciro" value={formatTLShort(k.ciroTRY)} yoy={calculateYoY(k.ciroTRY, o.ciroTRY)} />
                )}
                {showFinancials && (
                  <MiniKpi label="Sepet" value={formatTLShort(k.sepetOrtalama)} yoy={calculateYoY(k.musteriBasiOrt, o.musteriBasiOrt)} />
                )}
                <MiniKpi label="İade" value={formatPct(k.iadeOrani)} yoy={k.iadeOrani - o.iadeOrani} isPercent reverseColor />
                <MiniKpi label="İndirim" value={formatPct(k.indirimOrani)} yoy={k.indirimOrani - o.indirimOrani} isPercent reverseColor />
                {showFinancials && (
                  <MiniKpi label="Kare/₺" value={formatTLShort(k.kareBasiGelir)} yoy={calculateYoY(k.kareBasiGelir, o.kareBasiGelir)} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Aylık Ciro karşılaştırma */}
      {showFinancials && ayCiroData.length > 0 && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="📈" title="Aylık Ciro Karşılaştırma" />
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <LineChart data={ayCiroData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={(v) => formatTLShort(v)} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => {
                const m = mekanlar.find(x => x.id === name);
                return [formatTLShort(value), m?.name || name];
              }} />
              <Legend
                wrapperStyle={{ fontSize: 10 }}
                iconType="circle"
                formatter={(value: string) => mekanlar.find(m => m.id === value)?.name || value}
              />
              {mekanlar.map((m, i) => (
                <Line
                  key={m.id}
                  type="monotone"
                  dataKey={m.id}
                  stroke={COMPARE_COLORS[i]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: COMPARE_COLORS[i] }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aylık Müşteri karşılaştırma */}
      {ayMusteriData.length > 0 && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="👥" title="Aylık Müşteri Karşılaştırma" />
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <BarChart data={ayMusteriData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => {
                const m = mekanlar.find(x => x.id === name);
                return [formatNumber(value), m?.name || name];
              }} />
              <Legend
                wrapperStyle={{ fontSize: 10 }}
                iconType="circle"
                formatter={(value: string) => mekanlar.find(m => m.id === value)?.name || value}
              />
              {mekanlar.map((m, i) => (
                <Bar key={m.id} dataKey={m.id} fill={COMPARE_COLORS[i]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aylık İade Satış karşılaştırma */}
      {mekanlar.some(m => m.kpi.iadeAdet > 0) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="↩️" title="Aylık İade Satış Karşılaştırma" sub="iptal edilen satış adedi" />
          <ResponsiveContainer width="100%" height={200} minWidth={0}>
            <BarChart data={ayIadeData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => {
                const m = mekanlar.find(x => x.id === name);
                return [formatNumber(value), m?.name || name];
              }} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" formatter={(value: string) => mekanlar.find(m => m.id === value)?.name || value} />
              {mekanlar.map((m, i) => (
                <Bar key={m.id} dataKey={m.id} fill={COMPARE_COLORS[i]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aylık İade Fotoğraf karşılaştırma */}
      {mekanlar.some(m => m.ayliklar.some(a => a.iadeFoto > 0)) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="🖼️" title="Aylık İade Fotoğraf Karşılaştırma" sub="basılan ama satılmayan kare" />
          <ResponsiveContainer width="100%" height={200} minWidth={0}>
            <BarChart data={ayIadeFotoData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => {
                const m = mekanlar.find(x => x.id === name);
                return [formatNumber(value), m?.name || name];
              }} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" formatter={(value: string) => mekanlar.find(m => m.id === value)?.name || value} />
              {mekanlar.map((m, i) => (
                <Bar key={m.id} dataKey={m.id} fill={COMPARE_COLORS[i]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aylık İndirim Oranı karşılaştırma — % ile */}
      {showFinancials && mekanlar.some(m => m.kpi.indirimOrani > 0) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="🏷️" title="Aylık İndirim Oranı Karşılaştırma" sub="brüto cironun yüzdesi" />
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <LineChart data={ayIndirimData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={(v) => `%${Math.round(v)}`} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => {
                const m = mekanlar.find(x => x.id === name);
                return [formatPct(value), m?.name || name];
              }} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" formatter={(value: string) => mekanlar.find(m => m.id === value)?.name || value} />
              {mekanlar.map((m, i) => (
                <Line key={m.id} type="monotone" dataKey={m.id} stroke={COMPARE_COLORS[i]} strokeWidth={2.5} dot={{ r: 3, fill: COMPARE_COLORS[i] }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Hafta Günü karşılaştırma */}
      {showFinancials && haftaData.some(d => mekanlar.some(m => d[m.id] > 0)) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="📅" title="Hafta Günü Karşılaştırma" sub="yıllık ciro · TL" />
          <ResponsiveContainer width="100%" height={220} minWidth={0}>
            <BarChart data={haftaData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} tickFormatter={(v) => formatTLShort(v)} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => {
                const m = mekanlar.find(x => x.id === name);
                return [formatTLShort(value), m?.name || name];
              }} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" formatter={(value: string) => mekanlar.find(m => m.id === value)?.name || value} />
              {mekanlar.map((m, i) => (
                <Bar key={m.id} dataKey={m.id} fill={COMPARE_COLORS[i]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Saatlik karşılaştırma — yıllık */}
      {showFinancials && saatData.some(d => mekanlar.some(m => d[m.id] > 0)) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="⏰" title="Saatlik Yoğunluk Karşılaştırma" sub="yıllık · satış adedi" />
          <ResponsiveContainer width="100%" height={200} minWidth={0}>
            <LineChart data={saatData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.5)' }} interval={2} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => {
                const m = mekanlar.find(x => x.id === name);
                return [formatNumber(value), m?.name || name];
              }} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" formatter={(value: string) => mekanlar.find(m => m.id === value)?.name || value} />
              {mekanlar.map((m, i) => (
                <Line key={m.id} type="monotone" dataKey={m.id} stroke={COMPARE_COLORS[i]} strokeWidth={2} dot={{ r: 2, fill: COMPARE_COLORS[i] }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Para Birimi — her mekan kendi mini özeti */}
      {showFinancials && mekanlar.some(m => m.paraBirimi.length > 0) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="💱" title="Para Birimi Karşılaştırma" sub="ciro TL bazında" />
          <div className="space-y-2 mt-2">
            {mekanlar.map((m, idx) => {
              const toplam = m.paraBirimi.reduce((s, p) => s + p.tutarTRY, 0);
              if (toplam === 0) return null;
              return (
                <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 10, border: `1px solid ${COMPARE_COLORS[idx]}40` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: COMPARE_COLORS[idx] }} />
                    <span className="text-base">{m.emoji}</span>
                    <span className="text-xs font-bold text-white flex-1 truncate">{m.name}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{formatTLShort(toplam)}</span>
                  </div>
                  {/* Yatay stacked bar — her para birimi bir parça */}
                  <div className="flex w-full overflow-hidden rounded-md" style={{ height: 14, background: 'rgba(255,255,255,0.04)' }}>
                    {m.paraBirimi.map(p => {
                      const pct = (p.tutarTRY / toplam) * 100;
                      if (pct < 0.5) return null;
                      return (
                        <div
                          key={p.currency}
                          style={{
                            width: `${pct}%`,
                            background: CURRENCY_COLORS[p.currency] || '#94a3b8',
                          }}
                          title={`${p.currency} %${Math.round(pct)} (${formatTLShort(p.tutarTRY)})`}
                        />
                      );
                    })}
                  </div>
                  {/* Etiketler */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.paraBirimi.map(p => {
                      const pct = (p.tutarTRY / toplam) * 100;
                      if (pct < 0.5) return null;
                      return (
                        <div key={p.currency} className="flex items-center gap-1">
                          <div style={{ width: 6, height: 6, borderRadius: 999, background: CURRENCY_COLORS[p.currency] || '#94a3b8' }} />
                          <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{p.currency}</span>
                          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>%{Math.round(pct)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kâr Eşiği — her mekan için yıllık özet */}
      {showFinancials && mekanlar.some(m => m.yearlyRent > 0) && (
        <div style={{ ...glass, padding: 14 }}>
          <SectionTitle emoji="💰" title="Kâr Eşiği Karşılaştırma" sub="yıllık net" />
          <div className="space-y-2 mt-2">
            {mekanlar.map((m, idx) => {
              if (m.yearlyRent === 0) return null;
              const aylikKira = Math.round(m.yearlyRent / 12);
              const today = new Date();
              const buYil = today.getFullYear();
              const yilForK = parseInt(bitis.slice(0, 4), 10);
              // Cari yıl ise bugüne kadar geçen ay sayısı, geçmiş yıl ise 12
              const gecenAy = yilForK === buYil ? today.getMonth() + 1 : 12;
              const beklenenKira = aylikKira * gecenAy;
              const ciro = m.kpi.ciroTRY;
              const netKar = ciro - beklenenKira;
              const orani = beklenenKira > 0 ? (ciro / beklenenKira) * 100 : 0;
              const kar = netKar > 0;
              return (
                <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 10, border: `1px solid ${COMPARE_COLORS[idx]}40` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: COMPARE_COLORS[idx] }} />
                    <span className="text-base">{m.emoji}</span>
                    <span className="text-xs font-bold text-white flex-1 truncate">{m.name}</span>
                    <span className="text-[10px] font-bold" style={{ color: kar ? '#22c55e' : '#f87171' }}>
                      {kar ? '✓ Kâr' : '⚠ Zarar'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <MiniKpi label="Ciro" value={formatTLShort(ciro)} yoy={0} />
                    <MiniKpi label="Beklenen Kira" value={formatTLShort(beklenenKira)} yoy={0} />
                    <MiniKpi label="Net" value={formatTLShort(netKar)} yoy={orani - 100} isPercent />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════
   MiniKpi (karşılaştırma satırı için)
   ════════════════════════════════════════════ */
function MiniKpi({ label, value, yoy, isPercent, reverseColor }: {
  label: string; value: string; yoy: number; isPercent?: boolean; reverseColor?: boolean;
}) {
  const isUp = yoy > 0.05;
  const isDown = yoy < -0.05;
  // İade / indirim için artış kötü → renk tersine
  const goodUp = !reverseColor;
  const color = (isUp && goodUp) || (isDown && !goodUp) ? '#22c55e'
              : (isDown && goodUp) || (isUp && !goodUp) ? '#f87171'
              : 'rgba(255,255,255,0.4)';
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const txt = isPercent
    ? `${yoy >= 0 ? '+' : ''}${(Math.round(yoy * 10) / 10).toString().replace('.', ',')}pp`
    : `${yoy >= 0 ? '+' : ''}${(Math.round(yoy * 10) / 10).toString().replace('.', ',')}%`;
  return (
    <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="text-[12px] font-black text-white leading-tight" style={{ wordBreak: 'break-word' }}>{value}</p>
      <div className="flex items-center gap-0.5 mt-0.5" style={{ color }}>
        <Icon style={{ width: 9, height: 9 }} />
        <span className="text-[9px] font-bold">{txt}</span>
      </div>
    </div>
  );
}
