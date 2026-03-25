import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, Search, Filter,
  MapPin, TrendingDown, TrendingUp, Users, ShieldAlert,
  ChevronDown, ChevronUp, Info, Tag, BarChart2, Percent,
} from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { buildHeaders, getToken, appendGhostParam } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background: 'rgba(10,5,30,0.82)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 16,
};

/* ── Renk kodlama: yüksek oran = kırmızı, düşük = yeşil ── */
function oranRenk(oran: number) {
  if (oran >= 20) return { bar: 'bg-red-500',    badge: 'bg-red-500/25 text-red-300',    border: 'border-red-500/30',    text: 'text-red-400'    };
  if (oran >= 12) return { bar: 'bg-orange-500', badge: 'bg-orange-500/25 text-orange-300', border: 'border-orange-500/30', text: 'text-orange-400' };
  if (oran >= 6)  return { bar: 'bg-amber-400',  badge: 'bg-amber-400/25 text-amber-300',  border: 'border-amber-400/30',  text: 'text-amber-300'  };
  if (oran >= 1)  return { bar: 'bg-emerald-500',badge: 'bg-emerald-500/25 text-emerald-300',border:'border-emerald-500/30',text:'text-emerald-400'};
  return           { bar: 'bg-gray-500',         badge: 'bg-white/10 text-gray-400',       border: 'border-white/10',      text: 'text-gray-400'   };
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

type DonemKey = 'uzun' | 'kisa';

interface Kova {
  toplamSatis: number;
  indirimliSatis: number;
  toplamIndirimTL: number;
  toplamBrutoCiro: number;
  ortalamaIndirimOrani: number;
  indirimliSatisOrani: number;
}

interface Personel {
  userId: string;
  ad: string;
  avatar: string;
  uzun: Kova;
  kisa: Kova;
}

interface Mekan { id: string; name: string; emoji: string; }

interface Ozet {
  uzun: { toplamSatis: number; toplamIndirimTL: number };
  kisa: { toplamSatis: number; toplamIndirimTL: number };
  kisaDonemBaslangic: string;
}

interface IndirimIstatistikProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function IndirimIstatistik({ userName, userRole, accessToken, onLogout, onNavigate }: IndirimIstatistikProps) {
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [mekanlar, setMekanlar]       = useState<Mekan[]>([]);
  const [ozet, setOzet]               = useState<Ozet | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const [mekanFiltre, setMekanFiltre] = useState('');
  const [aramaMetni, setAramaMetni]   = useState('');
  const [siralama, setSiralama]       = useState<'indirimOrani' | 'indirimAdet' | 'indirimTL'>('indirimOrani');
  const [donem, setDonem]             = useState<DonemKey>('uzun');
  const [showFiltre, setShowFiltre]   = useState(false);
  const [acikKart, setAcikKart]       = useState<string | null>(null);

  /* ── Yetki ── */
  const yetkili = ['yonetici', 'ust-mudur', 'mudur'].includes(userRole);

  /* ── Veri çek ── */
  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = accessToken || await getToken();
      const params = new URLSearchParams();
      if (mekanFiltre) params.set('mekanId', mekanFiltre);
      const res = await fetch(appendGhostParam(`${API_BASE}/personel/indirim-istatistik?${params}`), {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Veri yüklenemedi.'); return; }
      setPersoneller(data.personeller || []);
      setMekanlar(data.mekanlar || []);
      setOzet(data.ozet || null);
    } catch (e) {
      setError('Sunucuya ulaşılamadı.');
      console.error('IndirimIstatistik fetchData error:', e);
    } finally { setLoading(false); }
  }, [accessToken, mekanFiltre]);

  useEffect(() => { if (yetkili) fetchData(); }, [fetchData, yetkili]);

  /* ── Filtrelenmiş + sıralanmış liste ── */
  const islenmis = personeller
    .filter(p => aramaMetni ? p.ad.toLowerCase().includes(aramaMetni.toLowerCase()) : true)
    .sort((a, b) => {
      const ka = a[donem]; const kb = b[donem];
      if (siralama === 'indirimOrani') return kb.ortalamaIndirimOrani - ka.ortalamaIndirimOrani;
      if (siralama === 'indirimAdet')  return kb.indirimliSatisOrani  - ka.indirimliSatisOrani;
      return kb.toplamIndirimTL - ka.toplamIndirimTL;
    });

  const maxOran = islenmis.length > 0 ? Math.max(...islenmis.map(p => p[donem].ortalamaIndirimOrani), 1) : 1;

  /* ── Yetki yok ── */
  if (!yetkili) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a051e] via-[#120830] to-[#1a0a3c] flex items-center justify-center p-6">
        <div style={glass} className="p-8 text-center max-w-sm">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white font-bold text-lg mb-2">Erişim Reddedildi</p>
          <p className="text-gray-400 text-sm">Bu modülü yalnızca yöneticiler görebilir.</p>
          <button onClick={() => onNavigate('isletme-istatistikleri')} className="mt-6 px-6 py-2 rounded-xl bg-white/10 text-white text-sm">Geri Dön</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051e] via-[#120830] to-[#1a0a3c] pb-28">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-3"
        style={{ background: 'rgba(10,5,30,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('isletme-istatistikleri')} className="p-2 rounded-xl bg-white/10 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white leading-tight">İndirim İstatistikleri</h1>
            <p className="text-xs text-gray-400">Personel İstatistikleri</p>
          </div>
          <button onClick={fetchData} disabled={loading} className="p-2 rounded-xl bg-white/10 active:scale-95 transition-all">
            {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <RefreshCw className="w-5 h-5 text-white" />}
          </button>
          <button
            onClick={() => setShowFiltre(v => !v)}
            className={`p-2 rounded-xl transition-all active:scale-95 ${showFiltre ? 'bg-violet-600/60 border border-violet-400/40' : 'bg-white/10'}`}
          >
            <Filter className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Dönem seçici ── */}
        <div style={glass} className="p-1 flex gap-1">
          {([['uzun', '📊 Uzun Dönem', 'Tüm zamanlar'], ['kisa', '📅 Kısa Dönem', 'Son 1 yıl']] as const).map(([k, label, sub]) => (
            <button
              key={k}
              onClick={() => setDonem(k)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${donem === k ? 'bg-violet-600 text-white' : 'text-gray-400'}`}
            >
              <div>{label}</div>
              <div className={`text-[10px] font-normal mt-0.5 ${donem === k ? 'text-violet-200' : 'text-gray-500'}`}>{sub}</div>
            </button>
          ))}
        </div>

        {/* ── Filtre paneli ── */}
        {showFiltre && (
          <div style={glass} className="p-4 space-y-4">
            {/* Mekan */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> Mekan</p>
              <select value={mekanFiltre} onChange={e => setMekanFiltre(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs">
                <option value="">Tüm Mekanlar</option>
                {mekanlar.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
              </select>
            </div>

            {/* Sıralama */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium flex items-center gap-1"><BarChart2 className="w-3 h-3" /> Sıralama Kriteri</p>
              <div className="flex gap-2">
                {([
                  ['indirimOrani', '% Oran'],
                  ['indirimAdet',  '% Adet'],
                  ['indirimTL',    '₺ Tutar'],
                ] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setSiralama(k)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${siralama === k ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-300'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={fetchData}
              className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm active:scale-[0.98] transition-all">
              Filtrele
            </button>
          </div>
        )}

        {/* ── Kişi arama ── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Personel ara..."
            value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl text-white text-sm placeholder-gray-500"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }} />
        </div>

        {/* ── Hata ── */}
        {error && (
          <div style={{ ...glass, borderColor: 'rgba(239,68,68,0.3)' }} className="p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* ── Özet kartlar ── */}
        {!loading && !error && ozet && (
          <div className="grid grid-cols-3 gap-3">
            <div style={glass} className="p-3 text-center">
              <Tag className="w-5 h-5 text-rose-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">
                {islenmis.length > 0 ? fmt(islenmis[0][donem].ortalamaIndirimOrani) + '%' : '—'}
              </p>
              <p className="text-[10px] text-gray-400 leading-tight">En Yüksek<br/>İndirim</p>
            </div>
            <div style={glass} className="p-3 text-center">
              <Users className="w-5 h-5 text-violet-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">{islenmis.length}</p>
              <p className="text-[10px] text-gray-400 leading-tight">Personel<br/>Sayısı</p>
            </div>
            <div style={glass} className="p-3 text-center">
              <Percent className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">
                {islenmis.length > 0 ? fmt(islenmis[islenmis.length - 1][donem].ortalamaIndirimOrani) + '%' : '—'}
              </p>
              <p className="text-[10px] text-gray-400 leading-tight">En Düşük<br/>İndirim</p>
            </div>
          </div>
        )}

        {/* ── Toplam indirim özet banner ── */}
        {!loading && !error && ozet && (
          <div style={{ ...glass, borderColor: 'rgba(139,92,246,0.2)' }} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">
                  {donem === 'uzun' ? 'Tüm zamanlardaki' : `Son 1 yıldaki (${ozet.kisaDonemBaslangic} itibaren)`}
                </p>
                <p className="text-sm text-white font-semibold">
                  Toplam verilen indirim:{' '}
                  <span className="text-rose-400 font-bold">
                    ₺{ozet[donem].toplamIndirimTL.toLocaleString('tr-TR')}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 mb-0.5">Satış adedi</p>
                <p className="text-sm text-white font-bold">{ozet[donem].toplamSatis.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Yükleniyor ── */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            <p className="text-gray-400 text-sm">Veriler hesaplanıyor...</p>
          </div>
        )}

        {/* ── Boş durum ── */}
        {!loading && !error && islenmis.length === 0 && (
          <div style={glass} className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏷️</span>
            </div>
            <p className="text-white font-bold mb-1">Veri Yok</p>
            <p className="text-gray-400 text-sm">
              {aramaMetni ? `"${aramaMetni}" isimli personel bulunamadı.` : 'Seçilen kriterlere uygun satış verisi yok.'}
            </p>
          </div>
        )}

        {/* ── Personel listesi ── */}
        {!loading && islenmis.length > 0 && (
          <div className="space-y-3">
            {/* Başlık satırı */}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-gray-500">
                {islenmis.length} personel · {donem === 'uzun' ? 'Tüm zamanlar' : 'Son 1 yıl'}
              </p>
              <p className="text-xs text-gray-500">
                {siralama === 'indirimOrani' ? '↓ Ort. indirim oranı' : siralama === 'indirimAdet' ? '↓ İndirimli satış %' : '↓ Toplam indirim ₺'}
              </p>
            </div>

            {islenmis.map((p, idx) => {
              const kova  = p[donem];
              const renk  = oranRenk(kova.ortalamaIndirimOrani);
              const acik  = acikKart === p.userId;
              const barW  = maxOran > 0 ? (kova.ortalamaIndirimOrani / maxOran) * 100 : 0;

              return (
                <div key={p.userId} style={glass} className={`overflow-hidden border ${renk.border}`}>
                  {/* Kart başlığı */}
                  <button
                    onClick={() => setAcikKart(acik ? null : p.userId)}
                    className="w-full p-4 flex items-center gap-3 active:bg-white/5 transition-all"
                  >
                    {/* Sıra */}
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      idx === 0 ? 'bg-red-500/30 text-red-300' :
                      idx === 1 ? 'bg-orange-500/30 text-orange-300' :
                      idx === 2 ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-gray-400'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
                      <span>{p.avatar}</span>
                    </div>

                    {/* İsim + alt bilgi */}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{p.ad}</p>
                      <p className="text-gray-400 text-xs">{kova.toplamSatis} satış · {kova.indirimliSatis} indirimli</p>
                    </div>

                    {/* Ana metrik badge */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-xl text-sm font-bold ${renk.badge}`}>
                        %{fmt(kova.ortalamaIndirimOrani)}
                      </span>
                      <span className="text-[10px] text-gray-500">ort. indirim</span>
                    </div>

                    {acik ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>

                  {/* Gösterge çubuğu */}
                  <div className="mx-4 mb-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${renk.bar}`}
                      style={{ width: `${barW}%` }}
                    />
                  </div>

                  {/* Detay accordion */}
                  {acik && (
                    <div className="border-t border-white/10 px-4 pt-3 pb-4">
                      <div className="grid grid-cols-2 gap-3 mb-3">

                        {/* Uzun dönem */}
                        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
                          <p className="text-[10px] text-gray-400 font-semibold mb-2 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-violet-400" /> UZUN DÖNEM
                          </p>
                          <MetrikSatir label="Ort. indirim oranı" deger={`%${fmt(p.uzun.ortalamaIndirimOrani)}`} renk={oranRenk(p.uzun.ortalamaIndirimOrani).text} />
                          <MetrikSatir label="İndirimli satış %" deger={`%${fmt(p.uzun.indirimliSatisOrani)}`} />
                          <MetrikSatir label="Toplam indirim"     deger={`₺${p.uzun.toplamIndirimTL.toLocaleString('tr-TR')}`} />
                          <MetrikSatir label="Brüt ciro"          deger={`₺${p.uzun.toplamBrutoCiro.toLocaleString('tr-TR')}`} />
                          <MetrikSatir label="Toplam satış"       deger={`${p.uzun.toplamSatis} adet`} />
                        </div>

                        {/* Kısa dönem */}
                        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
                          <p className="text-[10px] text-gray-400 font-semibold mb-2 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-teal-400" /> SON 1 YIL
                          </p>
                          <MetrikSatir label="Ort. indirim oranı" deger={`%${fmt(p.kisa.ortalamaIndirimOrani)}`} renk={oranRenk(p.kisa.ortalamaIndirimOrani).text} />
                          <MetrikSatir label="İndirimli satış %" deger={`%${fmt(p.kisa.indirimliSatisOrani)}`} />
                          <MetrikSatir label="Toplam indirim"     deger={`₺${p.kisa.toplamIndirimTL.toLocaleString('tr-TR')}`} />
                          <MetrikSatir label="Brüt ciro"          deger={`₺${p.kisa.toplamBrutoCiro.toLocaleString('tr-TR')}`} />
                          <MetrikSatir label="Toplam satış"       deger={`${p.kisa.toplamSatis} adet`} />
                        </div>
                      </div>

                      {/* Trend karşılaştırma */}
                      {p.uzun.ortalamaIndirimOrani > 0 && p.kisa.toplamSatis > 0 && (() => {
                        const fark = p.kisa.ortalamaIndirimOrani - p.uzun.ortalamaIndirimOrani;
                        const artti = fark > 0;
                        const neutral = Math.abs(fark) < 0.5;
                        return (
                          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                            neutral ? 'bg-white/5 border-white/10 text-gray-400' :
                            artti   ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                                      'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          }`}>
                            {neutral ? <Info className="w-3.5 h-3.5 flex-shrink-0" /> :
                             artti   ? <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" /> :
                                       <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />}
                            {neutral
                              ? 'Son 1 yıl uzun dönemle benzer seyirde.'
                              : artti
                                ? `Son 1 yılda indirim oranı uzun döneme göre %${fmt(Math.abs(fark))} arttı.`
                                : `Son 1 yılda indirim oranı uzun döneme göre %${fmt(Math.abs(fark))} azaldı.`
                            }
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Açıklama notu ── */}
        {!loading && (
          <div style={{ ...glass, borderColor: 'rgba(139,92,246,0.2)' }} className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs text-violet-300 font-semibold">Nasıl Hesaplanır?</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-white font-medium">Ort. indirim oranı</span> = Toplam indirim ₺ ÷ Toplam brüt ciro × 100<br />
                  <span className="text-white font-medium">İndirimli satış %</span> = İndirimli satış adedi ÷ Toplam satış × 100<br />
                  <span className="text-white font-medium">Uzun dönem</span> tüm geçmiş verileri, <span className="text-white font-medium">Kısa dönem</span> son 365 günü kapsar.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Yardımcı bileşen ── */
function MetrikSatir({ label, deger, renk }: { label: string; deger: string; renk?: string }) {
  return (
    <div className="flex items-center justify-between mb-1.5 last:mb-0">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-[11px] font-bold ${renk || 'text-white'}`}>{deger}</span>
    </div>
  );
}