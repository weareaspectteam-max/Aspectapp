import { useState, useEffect } from 'react';
import { Target, RefreshCw, Loader2, TrendingUp, ArrowLeft, ChevronDown, ChevronRight, Trophy, AlertTriangle } from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { buildHeaders, ghostParams } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

type UserRole = 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';

interface HedefTakipProps {
  userName: string;
  userRole: UserRole;
  accessToken: string;
  onNavigate: (tab: string) => void;
}

interface AyData {
  ay: string;
  ciro: number;
  baskiMaliyet: number;
  albumMaliyet: number;
  maas: number;
  prim: number;
}

interface MekanData {
  id: string;
  name: string;
  emoji: string;
  color: string;
  yearlyRent: number;
  profitTarget: number;
  aylar: AyData[];
  enIyi5: Array<{ tarih: string; ciro: number }>;
  enKotu5: Array<{ tarih: string; ciro: number }>;
  toplamCiro: number;
  toplamBaskiMaliyet: number;
  toplamAlbumMaliyet: number;
  toplamMaas: number;
  toplamPrim: number;
  toplamGider: number;
  netKar: number;
  netKarKiraDahil: number;
}

interface GenelData {
  yearlyRent: number;
  profitTarget: number;
  aylar: AyData[];
  enIyi5: Array<{ tarih: string; ciro: number }>;
  enKotu5: Array<{ tarih: string; ciro: number }>;
  toplamCiro: number;
  toplamBaskiMaliyet: number;
  toplamAlbumMaliyet: number;
  toplamMaas: number;
  toplamPrim: number;
  toplamGider: number;
  netKar: number;
  netKarKiraDahil: number;
  giderByKategori?: Record<string, number>;
}

const formatTL = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(Math.abs(v) >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return v.toLocaleString('tr-TR');
};

const AY_ISIMLERI_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const AY_ISIMLERI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUN_ISIMLERI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const gunAdi = (tarih: string) => {
  const d = new Date(tarih + 'T00:00:00');
  return GUN_ISIMLERI[d.getDay()];
};

// ─── Çubuk 1: Ciro vs Toplam Hedef (kira + giderler + kar hedefi) ──────────
function HedefCubuk({ toplamCiro, yearlyRent, toplamGider, profitTarget }: {
  toplamCiro: number; yearlyRent: number; toplamGider: number; profitTarget: number;
}) {
  // Hedef = kira + tüm giderler + kar hedefi (dinamik — gider eklendikçe büyür)
  const hedef = yearlyRent + toplamGider + profitTarget;
  const pct = hedef > 0 ? Math.min((toplamCiro / hedef) * 100, 100) : 0;
  const kalan = hedef - toplamCiro;
  const asim = toplamCiro > hedef;

  // Renk geçişi
  const renk = asim ? '#d4a017' : pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : pct >= 25 ? '#f97316' : '#dc2626';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Kâra Ulaşma Hedefi</span>
        <span className="text-xs font-bold" style={{ color: renk }}>₺{toplamCiro.toLocaleString('tr-TR')} / ₺{hedef.toLocaleString('tr-TR')}</span>
      </div>
      <div className="relative h-1 bg-white/6 rounded-full overflow-hidden"
        style={asim ? { boxShadow: `0 0 8px ${renk}40` } : {}}>
        <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${asim ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: renk, opacity: 0.9 }} />
      </div>
      <div className="text-[10px]">
        {asim ? (
          <span className="font-bold" style={{ color: '#d4a017' }}>🎯 Kâra ulaşıldı! +₺{(toplamCiro - hedef).toLocaleString('tr-TR')} net kâr</span>
        ) : (
          <span className="text-white/40">
            Kâra ₺{kalan.toLocaleString('tr-TR')} kaldı ·
            <span className="text-white/25 ml-1">Yıllık Kira ₺{yearlyRent.toLocaleString('tr-TR')} + Gider ₺{toplamGider.toLocaleString('tr-TR')}{profitTarget > 0 ? ` + Kâr Hedefi ₺${profitTarget.toLocaleString('tr-TR')}` : ''}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Çubuk 2: Kâr vs Gider (kira hariç) ───────────────────────────────────
function KarVsGiderCubuk({ netKar, toplamGider }: { netKar: number; toplamGider: number }) {
  const kar = Math.max(netKar, 0);
  const gider = toplamGider;
  const toplam = kar + gider || 1;
  const giderPct = (gider / toplam) * 100;
  const karPct = (kar / toplam) * 100;
  const zararda = netKar < 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Kâr vs Gider (kira hariç)</span>
      </div>
      <div className="relative h-1 bg-white/6 rounded-full overflow-hidden flex">
        {/* Gider (sol, kırmızı) */}
        <div className="h-full rounded-l-full transition-all duration-700"
          style={{ width: `${giderPct}%`, backgroundColor: '#ef4444', opacity: 0.9 }} />
        {/* Kâr (sağ, yeşil) */}
        {kar > 0 && (
          <div className="h-full rounded-r-full transition-all duration-700"
            style={{ width: `${karPct}%`, backgroundColor: '#22c55e', opacity: 0.9 }} />
        )}
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-red-400/70">Gider: ₺{Math.round(gider).toLocaleString('tr-TR')}</span>
        <span className="text-emerald-400/70">Kâr: ₺{Math.round(kar).toLocaleString('tr-TR')}</span>
      </div>
    </div>
  );
}

// ─── Detay Satırları ───────────────────────────────────────────────────────
const KATEGORI_META: Record<string, { label: string; icon: string }> = {
  personel: { label: 'Personel', icon: '👥' },
  malzeme: { label: 'Malzeme', icon: '📦' },
  ekipman: { label: 'Ekipman', icon: '🔧' },
  operasyonel: { label: 'Operasyonel', icon: '⚙️' },
  ulasim: { label: 'Ulaşım', icon: '🚗' },
  diger: { label: 'Diğer', icon: '📋' },
};

function DetaySatirlari({ data, yearlyRent }: { data: MekanData | GenelData; yearlyRent: number }) {
  const genelGiderler = (data as GenelData).giderByKategori || {};
  const ekGiderler = (data as any).ekGiderByKategori || {};

  // Sadece gider kategorileri (küçük kutular)
  const giderKalemleri: Array<{ label: string; value: number; icon: string }> = [];

  // Genel kart: giderByKategori varsa onu kullan
  if (Object.keys(genelGiderler).length > 0) {
    for (const [kat, tutar] of Object.entries(genelGiderler)) {
      if (tutar <= 0) continue;
      const meta = KATEGORI_META[kat] || { label: kat, icon: '📋' };
      giderKalemleri.push({ label: meta.label, value: tutar, icon: meta.icon });
    }
  } else {
    // Mekan kartları: operasyonel maliyetler
    if (data.toplamBaskiMaliyet > 0) giderKalemleri.push({ label: 'Kağıt/Baskı', value: data.toplamBaskiMaliyet, icon: '🖨️' });
    if (data.toplamAlbumMaliyet > 0) giderKalemleri.push({ label: 'Albüm', value: data.toplamAlbumMaliyet, icon: '📦' });
    if (data.toplamMaas > 0) giderKalemleri.push({ label: 'Maaş', value: data.toplamMaas, icon: '💰' });
    if (data.toplamPrim > 0) giderKalemleri.push({ label: 'Hakediş', value: data.toplamPrim, icon: '🏆' });
    // Mekan bazlı isletme_gider_ kategori kırılımı (ek giderler)
    for (const [kat, tutar] of Object.entries(ekGiderler)) {
      if (Number(tutar) <= 0) continue;
      const meta = KATEGORI_META[kat] || { label: kat, icon: '📋' };
      giderKalemleri.push({ label: meta.label, value: Number(tutar), icon: meta.icon });
    }
  }

  if (giderKalemleri.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {giderKalemleri.map((k, i) => (
        <div key={i} className="rounded-lg border border-red-500/15 bg-red-500/5 px-1.5 py-0.5 flex items-center gap-1">
          <span className="text-[8px] text-white/30">{k.icon}</span>
          <span className="text-[9px] text-white/40">{k.label}</span>
          <span className="text-[10px] font-bold text-red-400">-₺{Math.round(k.value).toLocaleString('tr-TR')}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Aylık Grafik (saf CSS) ────────────────────────────────────────────────
function AylikGrafik({ aylar, aylikKira }: { aylar: AyData[]; aylikKira: number }) {
  const buAyIndex = new Date().getMonth(); // 0-based
  const [seciliAy, setSeciliAy] = useState(buAyIndex);
  const aylikCirolar = aylar.map(a => a.ciro);
  const aylikGiderler = aylar.map(a => (a as any).gider || (a.baskiMaliyet + a.albumMaliyet + a.maas + a.prim));
  const maxVal = Math.max(...aylikCirolar, ...aylikGiderler, aylikKira, 1);

  const secili = aylar[seciliAy];
  const seciliGider = aylikGiderler[seciliAy];
  const seciliKar = (secili?.ciro || 0) - seciliGider;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Aylık Ciro vs Gider</span>
        <div className="flex gap-3 text-[8px]">
          <span className="text-emerald-400/60">● Ciro</span>
          <span className="text-orange-400/60">● Gider</span>
          <span className="text-red-400/60">┈ Kira</span>
        </div>
      </div>
      <div className="flex items-end gap-1 h-28">
        {aylar.map((a, i) => {
          const ciroH = maxVal > 0 ? (aylikCirolar[i] / maxVal) * 100 : 0;
          const giderH = maxVal > 0 ? (aylikGiderler[i] / maxVal) * 100 : 0;
          const kiraH = maxVal > 0 ? (aylikKira / maxVal) * 100 : 0;
          const hasCiro = a.ciro > 0;
          const hasGider = aylikGiderler[i] > 0;
          const isSecili = i === seciliAy;
          return (
            <div key={a.ay} className="flex-1 flex flex-col items-center gap-0.5 relative cursor-pointer"
              style={{ height: '100%' }} onClick={() => setSeciliAy(i)}>
              {/* Kira çizgisi (kırmızı kesikli) */}
              <div className="absolute w-full border-t-2 border-dashed border-red-500/70"
                style={{ bottom: `${Math.min(kiraH, 100) * 0.95}%` }} />
              {/* Gider çizgisi (turuncu kesikli) */}
              {hasGider && (
                <div className="absolute w-full border-t-2 border-dashed border-orange-400/70"
                  style={{ bottom: `${Math.min(giderH + kiraH, 100) * 0.95}%` }} />
              )}
              <div className="flex-1 flex items-end w-full justify-center">
                {hasCiro && (() => {
                  const karsilandiMi = aylikCirolar[i] >= (aylikGiderler[i] + aylikKira);
                  const renk = karsilandiMi ? '#22c55e' : aylikCirolar[i] >= aylikKira ? '#eab308' : '#ef4444';
                  return (
                    <div
                      className={`w-full max-w-[14px] rounded-t-sm transition-all duration-500 ${isSecili ? 'ring-1 ring-white/30' : ''}`}
                      style={{
                        height: `${Math.max(ciroH * 0.95, 2)}%`,
                        backgroundColor: renk,
                        opacity: isSecili ? 1 : 0.5,
                      }}
                    />
                  );
                })()}
              </div>
              <span className={`text-[8px] ${isSecili ? 'text-white font-bold' : 'text-white/25'}`}>{AY_ISIMLERI_KISA[i]}</span>
            </div>
          );
        })}
      </div>
      {/* Seçili ay detayı */}
      {(() => {
        const ayNetKar = (secili?.ciro || 0) - seciliGider - aylikKira;
        const kiraKarsilandi = (secili?.ciro || 0) >= aylikKira;
        const giderKarsilandi = (secili?.ciro || 0) >= (seciliGider + aylikKira);
        let durumMesaj = '';
        let durumRenk = '';
        if (giderKarsilandi) {
          durumMesaj = '🎉 Tebrikler! Bu ay kâra geçildi — kira ve tüm giderler karşılandı.';
          durumRenk = 'text-emerald-400';
        } else if (kiraKarsilandi) {
          durumMesaj = '⚠️ Kira karşılandı ama giderler henüz tam karşılanmadı.';
          durumRenk = 'text-yellow-400';
        } else if ((secili?.ciro || 0) > 0) {
          durumMesaj = '❌ Henüz kira bile karşılanmadı — ciro artmalı.';
          durumRenk = 'text-red-400';
        } else {
          durumMesaj = '📊 Bu ayda henüz ciro verisi yok.';
          durumRenk = 'text-white/30';
        }
        return (
          <div className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-[10px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-white/60 font-bold text-[11px]">{AY_ISIMLERI[seciliAy]} {aylar[seciliAy]?.ay?.slice(0, 4)}</span>
              <span className={`font-bold ${ayNetKar >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Kâr: ₺{Math.round(ayNetKar).toLocaleString('tr-TR')}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-400">● Ciro: ₺{(secili?.ciro || 0).toLocaleString('tr-TR')}</span>
              <span className="text-orange-400">● Gider: ₺{Math.round(seciliGider).toLocaleString('tr-TR')}</span>
              <span className="text-red-400">┈ Kira: ₺{aylikKira.toLocaleString('tr-TR')}</span>
            </div>
            <div className={`text-[9px] ${durumRenk}`}>{durumMesaj}</div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── En İyi / En Kötü 5 Gün ───────────────────────────────────────────────
function EnIyiKotu5({ enIyi5, enKotu5 }: { enIyi5: Array<{ tarih: string; ciro: number }>; enKotu5: Array<{ tarih: string; ciro: number }> }) {
  const [acik, setAcik] = useState(false);
  if (enIyi5.length === 0 && enKotu5.length === 0) return null;
  return (
    <div>
      <button onClick={() => setAcik(!acik)}
        className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 transition-colors">
        {acik ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        En İyi / En Kötü 5 Gün
      </button>
      {acik && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-400/60 flex items-center gap-1"><Trophy className="w-3 h-3" /> En İyi 5</span>
            {enIyi5.map((g, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-white/30">{g.tarih.slice(5)} <span className="text-white/20">{gunAdi(g.tarih)}</span></span>
                <span className="text-emerald-300 font-bold">₺{g.ciro.toLocaleString('tr-TR')}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-red-400/60 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> En Kötü 5</span>
            {enKotu5.map((g, i) => (
              <div key={i} className="flex justify-between text-[10px]">
                <span className="text-white/30">{g.tarih.slice(5)} <span className="text-white/20">{gunAdi(g.tarih)}</span></span>
                <span className="text-red-300 font-bold">₺{g.ciro.toLocaleString('tr-TR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tek Kart (genel veya mekan) ──────────────────────────────────────────
function HedefKart({ data, baslik, emoji, color, yearlyRent, profitTarget, isGenel }: {
  data: MekanData | GenelData;
  baslik: string;
  emoji?: string;
  color?: string;
  yearlyRent: number;
  profitTarget: number;
  isGenel?: boolean;
}) {
  const aylikKira = Math.round(yearlyRent / 12);

  return (
    <div className={`mx-4 rounded-2xl border backdrop-blur overflow-hidden ${isGenel ? 'border-white/15' : 'border-white/10'}`}
      style={{ background: 'rgba(255,255,255,0.04)' }}>
      {/* Başlık */}
      <div className="px-4 pt-4 pb-3 border-b border-white/8 flex items-center gap-2">
        {emoji && <span className="text-lg">{emoji}</span>}
        {isGenel && <TrendingUp className="w-4 h-4 text-purple-400" />}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white truncate block">{baslik}</span>
          <span className="text-[10px] text-white/25">
            Kira: ₺{yearlyRent.toLocaleString('tr-TR')}/yıl{profitTarget > 0 ? ` · Kâr Hedefi: ₺${profitTarget.toLocaleString('tr-TR')}` : ''}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Üst 3 kutu: Ciro, Kira, Net Kâr */}
        {(() => {
          const netKar = data.netKarKiraDahil;
          const netKarPozitif = netKar >= 0;
          return (
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-emerald-600/5 px-3 py-3 text-center">
                <span className="text-[10px] text-emerald-400/50 block">📈 Ciro</span>
                <span className="text-sm font-black text-emerald-400 block mt-1">₺{data.toplamCiro.toLocaleString('tr-TR')}</span>
              </div>
              <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-600/5 px-3 py-3 text-center">
                <span className="text-[10px] text-amber-400/50 block">🏠 Kira (yıllık)</span>
                <span className="text-sm font-black text-amber-400 block mt-1">-₺{yearlyRent.toLocaleString('tr-TR')}</span>
              </div>
              <div className={`rounded-2xl border-2 px-3 py-3 text-center ${
                netKarPozitif
                  ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-emerald-600/5'
                  : 'border-red-500/30 bg-gradient-to-b from-red-500/10 to-red-600/5'
              }`}>
                <span className={`text-[10px] block ${netKarPozitif ? 'text-emerald-400/50' : 'text-red-400/50'}`}>{netKarPozitif ? '✅' : '📉'} Net Kâr</span>
                <span className={`text-sm font-black block mt-1 ${netKarPozitif ? 'text-emerald-400' : 'text-red-400'}`}>
                  {netKarPozitif ? '+' : ''}₺{netKar.toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Çubuk 1: Kâra ulaşma hedefi */}
        {(() => {
          const giderler = (data as GenelData).giderByKategori || {};
          const giderToplam = Object.keys(giderler).length > 0
            ? Object.values(giderler).reduce((s, v) => s + v, 0)
            : (data.toplamBaskiMaliyet + data.toplamAlbumMaliyet + data.toplamMaas + data.toplamPrim);
          return <HedefCubuk toplamCiro={data.toplamCiro} yearlyRent={yearlyRent} toplamGider={giderToplam} profitTarget={profitTarget} />;
        })()}

        {/* Çubuk 2: Kâr vs Gider */}
        {(() => {
          const giderler = (data as GenelData).giderByKategori || {};
          const giderToplam = Object.keys(giderler).length > 0
            ? Object.values(giderler).reduce((s, v) => s + v, 0)
            : (data.toplamBaskiMaliyet + data.toplamAlbumMaliyet + data.toplamMaas + data.toplamPrim);
          const kar = data.toplamCiro - giderToplam;
          return <KarVsGiderCubuk netKar={kar} toplamGider={giderToplam} />;
        })()}

        {/* Gider kategorileri */}
        <DetaySatirlari data={data} yearlyRent={yearlyRent} />

        {/* Grafik */}
        <AylikGrafik aylar={data.aylar} aylikKira={aylikKira} />

        {/* En iyi/kötü */}
        <EnIyiKotu5 enIyi5={data.enIyi5} enKotu5={data.enKotu5} />
      </div>
    </div>
  );
}

// ─── Ana Component ─────────────────────────────────────────────────────────
export default function HedefTakip({ userName, userRole, accessToken, onNavigate }: HedefTakipProps) {
  const buYil = new Date().getFullYear();
  const [seciliYil, setSeciliYil] = useState(buYil);
  const [veri, setVeri] = useState<{ tarih: string; yil: string; genel: GenelData; mekanlar: MekanData[] } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');

  const yukle = async (yil?: number) => {
    setYukleniyor(true);
    setHata('');
    try {
      const yilParam = yil || seciliYil;
      const sep = ghostParams().includes('?') ? '&' : '?';
      const res = await fetch(`${API_BASE}/hedef-takip${ghostParams()}${sep}yil=${yilParam}`, {
        headers: buildHeaders(accessToken),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setVeri(json);
    } catch (err: any) {
      setHata(err.message || 'Veri yüklenemedi.');
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => { yukle(); }, []);

  const yilDegistir = (yil: number) => {
    setSeciliYil(yil);
    yukle(yil);
  };

  if (!['yonetici', 'ust-mudur'].includes(userRole)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-white/40 text-sm">Bu sayfa yalnızca yönetici ve üst müdüre açıktır.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a0015 0%, #1a0030 50%, #0d001a 100%))' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/8"
        style={{ background: 'rgba(0,0,0,0.65)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('dashboard')}
              className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform">
              <ArrowLeft className="w-4 h-4 text-white/60" />
            </button>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                Hedef Takibi
              </h1>
              <p className="text-[10px] text-white/30">{veri?.yil || '...'} Yılı</p>
            </div>
          </div>
          <button onClick={() => yukle()} disabled={yukleniyor}
            className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform">
            {yukleniyor ? <Loader2 className="w-4 h-4 text-white/40 animate-spin" /> : <RefreshCw className="w-4 h-4 text-white/40" />}
          </button>
        </div>
        {/* Yıl Filtresi */}
        {seciliYil !== buYil ? (
          <div className="flex items-center gap-1.5 px-4 pb-2.5">
            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              {seciliYil} yılı görüntüleniyor
            </span>
            <button onClick={() => yilDegistir(buYil)}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-400 border border-white/8 hover:bg-white/10 shrink-0">
              Güncel yıla dön
            </button>
          </div>
        ) : buYil > 2025 ? (
          <div className="flex items-center gap-1.5 px-4 pb-2.5">
            {Array.from({ length: buYil - 2025 }, (_, i) => buYil - 1 - i).map(yil => (
              <button key={yil} onClick={() => yilDegistir(yil)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-500 border border-white/8 hover:bg-white/10 shrink-0 transition-all">
                {yil}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {yukleniyor && !veri ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-xs text-white/30">Yükleniyor...</p>
        </div>
      ) : hata ? (
        <div className="mx-4 mt-4 rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-sm text-red-300">{hata}</p>
        </div>
      ) : veri && (
        <div className="space-y-4 pt-4">
          {/* Genel Toplam */}
          <HedefKart
            data={veri.genel}
            baslik="Genel Toplam"
            yearlyRent={veri.genel.yearlyRent}
            profitTarget={veri.genel.profitTarget}
            isGenel
          />

          {/* Mekan Kartları */}
          {veri.mekanlar.map(mekan => (
            <HedefKart
              key={mekan.id}
              data={mekan}
              baslik={mekan.name}
              emoji={mekan.emoji}
              color={mekan.color}
              yearlyRent={mekan.yearlyRent}
              profitTarget={mekan.profitTarget}
            />
          ))}
        </div>
      )}
    </div>
  );
}
