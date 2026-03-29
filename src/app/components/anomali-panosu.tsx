import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, AlertTriangle, Users,
  ChevronDown, ChevronUp, Search, Filter, Calendar, MapPin,
  TrendingUp, ShieldAlert, Info, Trash2,
} from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { buildHeaders, getToken, appendGhostParam } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/* ── Glassmorphism stili ── */
const glass: React.CSSProperties = {
  background: 'rgba(0,0,0,0.65)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 16,
};

const ALAN_ADI: Record<string, string> = {
  album3:  "3'lü Albüm",
  album5:  "5'li Albüm",
  album7:  "7'li Albüm",
  album9:  "9'lu Albüm",
  album11: "11'li Albüm",
  album13: "13'lü Albüm",
  album15: "15'li Albüm",
  paspartu: 'Paspartu',
  ribon:    'Ribon Takımı',
};

const ALAN_EMOJI: Record<string, string> = {
  album3:  '📷', album5:  '📷', album7:  '📷',
  album9:  '📷', album11: '📷', album13: '📷', album15: '📷',
  paspartu: '🖼️', ribon: '🎀',
};

/** ribonlar.{kagitTipiId} key'leri için dinamik etiket */
const getAlanAdi = (alan: string): string => {
  if (ALAN_ADI[alan]) return ALAN_ADI[alan];
  if (alan.startsWith('ribonlar.')) return `${alan.replace('ribonlar.', '')} Ribon`;
  return alan;
};
const getAlanEmoji = (alan: string): string => {
  if (ALAN_EMOJI[alan]) return ALAN_EMOJI[alan];
  if (alan.startsWith('ribonlar.')) return '🎞️';
  return '📦';
};

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function trDate(tarih: string) {
  const [y, m, dd] = tarih.split('-');
  return `${dd}.${m}.${y}`;
}

function puanRenk(puan: number) {
  if (puan >= 5) return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', badge: 'bg-red-500/30 text-red-300' };
  if (puan >= 3) return { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400', badge: 'bg-orange-500/30 text-orange-300' };
  if (puan >= 1) return { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', badge: 'bg-amber-500/30 text-amber-300' };
  return { bg: 'bg-white/5', border: 'border-white/10', text: 'text-gray-400', badge: 'bg-white/10 text-gray-300' };
}

interface AnomalDetay {
  tarih: string;
  mekanId: string;
  mekanAdi: string;
  mekanEmoji: string;
  tip: 'acilis' | 'kapanis';
  farklar: Record<string, number>;
}

interface PersonelPuan {
  userId: string;
  ad: string;
  avatar: string;
  toplamPuan: number;
  detaylar: AnomalDetay[];
}

interface MekanItem {
  id: string;
  name: string;
  emoji: string;
}

interface AnomaliPanosuProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function AnomaliPanosu({ userName, userRole, accessToken, onLogout, onNavigate }: AnomaliPanosuProps) {
  /* ─── State ─── */
  const [puanlar, setPuanlar]     = useState<PersonelPuan[]>([]);
  const [mekanlar, setMekanlar]   = useState<MekanItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [toplamAnomali, setToplamAnomali] = useState(0);
  const [etkilenen, setEtkilenen] = useState(0);

  /* ─── Filtre state ─── */
  const today = formatDate(new Date());
  const thisMonthStart = formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [filterKey, setFilterKey]         = useState<'bu-ay' | 'son-3-ay' | 'bu-yil' | 'ozel'>('bu-ay');
  const [baslangic, setBaslangic]         = useState(thisMonthStart);
  const [bitis, setBitis]                 = useState(today);
  const [mekanFiltre, setMekanFiltre]     = useState('');
  const [aramaMetni, setAramaMetni]       = useState('');

  /* ─── UI state ─── */
  const [acikKart, setAcikKart] = useState<string | null>(null);
  const [showFiltre, setShowFiltre] = useState(false);

  /* ─── Anomali sıfırla state ─── */
  const [showSifirlaModal, setShowSifirlaModal] = useState(false);
  const [sifirlaYukleniyor, setSifirlaYukleniyor] = useState(false);
  const [sifirlaHata, setSifirlaHata] = useState('');
  const [sifirlaBasarili, setSifirlaBasarili] = useState('');
  const [sifirlaFilterKey, setSifirlaFilterKey] = useState<'bugun' | 'bu-ay' | 'ozel'>('bu-ay');
  const [sifirlaBaslangic, setSifirlaBaslangic] = useState(thisMonthStart);
  const [sifirlasBitis, setSifirlasBitis] = useState(today);

  /* ─── Tarih aralığı hesaplama ─── */
  const applyFilterKey = (key: typeof filterKey) => {
    const now = new Date();
    if (key === 'bu-ay') {
      setBaslangic(formatDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setBitis(today);
    } else if (key === 'son-3-ay') {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      setBaslangic(formatDate(d)); setBitis(today);
    } else if (key === 'bu-yil') {
      setBaslangic(`${now.getFullYear()}-01-01`); setBitis(today);
    }
    setFilterKey(key);
  };

  /* ─── Veri çekme ─── */
  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = accessToken || await getToken();
      const params = new URLSearchParams({ baslangic, bitis });
      if (mekanFiltre) params.set('mekanId', mekanFiltre);
      const res = await fetch(appendGhostParam(`${API_BASE}/personel/anomali-puanlar?${params}`), {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Veri yüklenemedi.'); return; }
      setPuanlar(data.puanlar || []);
      setMekanlar(data.mekanlar || []);
      setToplamAnomali(data.toplamAnomaliOlayi || 0);
      setEtkilenen(data.etkilenenPersonelSayisi || 0);
    } catch (e) {
      setError('Sunucuya ulaşılamadı.');
      console.error('AnomaliPanosu fetchData error:', e);
    } finally { setLoading(false); }
  }, [accessToken, baslangic, bitis, mekanFiltre]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Anomali sıfırlama ─── */
  const handleAnomaliSifirla = async () => {
    setSifirlaYukleniyor(true);
    setSifirlaHata('');
    setSifirlaBasarili('');
    try {
      const token = accessToken || await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/personel/anomali-sifirla`), {
        method: 'POST',
        headers: { ...buildHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ baslangic: sifirlaBaslangic, bitis: sifirlasBitis }),
      });
      const data = await res.json();
      if (!res.ok) { setSifirlaHata(data.error || 'Sıfırlama başarısız.'); return; }
      setSifirlaBasarili(`${data.sifirlanenSayisi} kayıttaki anomali temizlendi.`);
      setShowSifirlaModal(false);
      await fetchData();
    } catch (e) {
      setSifirlaHata('Sunucuya ulaşılamadı.');
      console.error('Anomali sıfırla error:', e);
    } finally {
      setSifirlaYukleniyor(false);
    }
  };

  /* ─── Filtrelenmiş liste ─── */
  const filtrelenmis = puanlar.filter(p =>
    aramaMetni ? p.ad.toLowerCase().includes(aramaMetni.toLowerCase()) : true
  );

  /* ─── Yetki kontrolü ─── */
  if (!['yonetici', 'ust-mudur', 'mudur'].includes(userRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
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
    <div className="min-h-screen pb-24" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-20 px-4 pt-12 pb-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => onNavigate('isletme-istatistikleri')}
            className="p-2 rounded-xl bg-white/10 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white leading-tight">Anomali İstatistikleri</h1>
            <p className="text-xs text-gray-400">Personel İstatistikleri</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-white/10 active:scale-95 transition-all"
          >
            {loading
              ? <Loader2 className="w-5 h-5 text-white animate-spin" />
              : <RefreshCw className="w-5 h-5 text-white" />
            }
          </button>
          {userRole === 'yonetici' && (
            <button
              onClick={() => { setSifirlaHata(''); setSifirlaBasarili(''); setShowSifirlaModal(true); }}
              className="p-2 rounded-xl active:scale-95 transition-all"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }}
              title="Anomali Sıfırla"
            >
              <Trash2 className="w-5 h-5 text-red-400" />
            </button>
          )}
          <button
            onClick={() => setShowFiltre(v => !v)}
            className={`p-2 rounded-xl transition-all active:scale-95 ${showFiltre ? 'bg-violet-600/60 border border-violet-400/40' : 'bg-white/10'}`}
          >
            <Filter className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ─── Filtre Paneli ─── */}
        {showFiltre && (
          <div style={glass} className="p-4 space-y-4">
            {/* Hızlı tarih butonları */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> Tarih Aralığı</p>
              <div className="flex gap-2 flex-wrap">
                {(['bu-ay', 'son-3-ay', 'bu-yil', 'ozel'] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => applyFilterKey(k)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filterKey === k ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-300'}`}
                  >
                    {k === 'bu-ay' ? 'Bu Ay' : k === 'son-3-ay' ? 'Son 3 Ay' : k === 'bu-yil' ? 'Bu Yıl' : 'Özel'}
                  </button>
                ))}
              </div>
              {filterKey === 'ozel' && (
                <div className="flex gap-2 mt-2">
                  <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs" />
                  <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs" />
                </div>
              )}
            </div>

            {/* Mekan filtresi */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> Mekan</p>
              <select
                value={mekanFiltre}
                onChange={e => setMekanFiltre(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs"
              >
                <option value="">Tüm Mekanlar</option>
                {mekanlar.map(m => (
                  <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchData}
              className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm active:scale-[0.98] transition-all"
            >
              Filtrele
            </button>
          </div>
        )}

        {/* ─── Kişi arama ─── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Personel ara..."
            value={aramaMetni}
            onChange={e => setAramaMetni(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl text-white text-sm placeholder-gray-500"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
          />
        </div>

        {/* ─── Hata ─── */}
        {error && (
          <div style={{ ...glass, borderColor: 'rgba(239,68,68,0.3)' }} className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* ─── Özet kartları ─── */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-3">
            <div style={glass} className="p-3 text-center">
              <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">{toplamAnomali}</p>
              <p className="text-[10px] text-gray-400 leading-tight">Toplam<br/>Anomali</p>
            </div>
            <div style={glass} className="p-3 text-center">
              <Users className="w-5 h-5 text-violet-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">{etkilenen}</p>
              <p className="text-[10px] text-gray-400 leading-tight">Etkilenen<br/>Personel</p>
            </div>
            <div style={glass} className="p-3 text-center">
              <TrendingUp className="w-5 h-5 text-rose-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-white">
                {filtrelenmis.length > 0 ? filtrelenmis[0].toplamPuan : 0}
              </p>
              <p className="text-[10px] text-gray-400 leading-tight">En Yüksek<br/>Puan</p>
            </div>
          </div>
        )}

        {/* ─── Yükleniyor ─── */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            <p className="text-gray-400 text-sm">Veriler hesaplanıyor...</p>
          </div>
        )}

        {/* ─── Boş durum ─── */}
        {!loading && !error && filtrelenmis.length === 0 && (
          <div style={glass} className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <p className="text-white font-bold mb-1">Anomali Yok!</p>
            <p className="text-gray-400 text-sm">
              {aramaMetni
                ? `"${aramaMetni}" isimli personel bulunamadı.`
                : 'Seçilen tarih aralığında stok anomalisi olan personel bulunamadı.'}
            </p>
            {toplamAnomali > 0 && !aramaMetni && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    {toplamAnomali} anomali kaydı var ama eşleşen rotasyon görevi bulunamadı. Rotasyon görevleri oluşturulmamış olabilir.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Personel listesi ─── */}
        {!loading && filtrelenmis.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 px-1">
              {filtrelenmis.length} personel · {trDate(baslangic)} – {trDate(bitis)}
            </p>

            {filtrelenmis.map((p, idx) => {
              const renk = puanRenk(p.toplamPuan);
              const acik = acikKart === p.userId;
              return (
                <div key={p.userId} style={glass} className={`overflow-hidden border ${renk.border}`}>
                  {/* Kart başlığı */}
                  <button
                    onClick={() => setAcikKart(acik ? null : p.userId)}
                    className="w-full p-4 flex items-center gap-3 active:bg-white/5 transition-all"
                  >
                    {/* Sıra */}
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      idx === 0 ? 'bg-rose-500/30 text-rose-300' :
                      idx === 1 ? 'bg-orange-500/30 text-orange-300' :
                      idx === 2 ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-gray-400'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Avatar & isim */}
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
                      {p.avatar.startsWith('http') ? (
                        <img src={p.avatar} className="w-full h-full rounded-xl object-cover" alt={p.ad} />
                      ) : (
                        <span>{p.avatar}</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-white font-semibold text-sm">{p.ad}</p>
                      <p className="text-gray-400 text-xs">{p.detaylar.length} anomali olayı</p>
                    </div>

                    {/* Puan badge */}
                    <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${renk.badge}`}>
                      {p.toplamPuan} puan
                    </div>
                    {acik ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>

                  {/* Puan çubuğu */}
                  <div className="mx-4 mb-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.toplamPuan >= 5 ? 'bg-red-500' :
                        p.toplamPuan >= 3 ? 'bg-orange-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, (p.toplamPuan / Math.max(filtrelenmis[0]?.toplamPuan || 1, 1)) * 100)}%` }}
                    />
                  </div>

                  {/* Detay accordion */}
                  {acik && (
                    <div className="border-t border-white/10 px-4 pt-3 pb-4 space-y-2">
                      <p className="text-xs text-gray-500 font-medium mb-3 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Anomali Geçmişi
                      </p>
                      {p.detaylar.map((d, di) => (
                        <div
                          key={di}
                          className={`p-3 rounded-xl border ${
                            d.tip === 'acilis'
                              ? 'bg-blue-500/10 border-blue-500/20'
                              : 'bg-red-500/10 border-red-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{d.mekanEmoji}</span>
                              <span className="text-white text-xs font-semibold">{d.mekanAdi}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${
                                d.tip === 'acilis'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-red-500/20 text-red-300'
                              }`}>
                                {d.tip === 'acilis' ? '↑ Açılış' : '↓ Kapanış'}
                              </span>
                              <span className="text-gray-400 text-[10px]">{trDate(d.tarih)}</span>
                            </div>
                          </div>
                          {/* Farklar */}
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(d.farklar).map(([alan, fark]) => (
                              <span
                                key={alan}
                                className="text-[10px] px-2 py-0.5 rounded-lg bg-white/10 text-gray-300 font-mono"
                              >
                                {getAlanEmoji(alan)}{getAlanAdi(alan)}: {fark > 0 ? '+' : ''}{fark}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Açıklama notu ─── */}
        {!loading && (
          <div style={{ ...glass, borderColor: 'rgba(139,92,246,0.2)' }} className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs text-violet-300 font-semibold">Nasıl Hesaplanır?</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-blue-300 font-medium">Açılış anomalisi</span> → önceki günün o mekandaki rotasyon personeline +1 puan.<br />
                  <span className="text-red-300 font-medium">Kapanış anomalisi</span> → aynı günün o mekandaki rotasyon personeline +1 puan.<br />
                  Rotasyona yazılı herkes eşit puan alır. Her stok farkı (her alan) ayrı puan değil, <strong className="text-white">olay bazlı</strong> sayılır.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─── Başarı Banner ─── */}
      {sifirlaBasarili && (
        <div
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl flex items-center gap-2 text-sm font-semibold text-green-300 shadow-xl"
          style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)', backdropFilter: 'blur(16px)', whiteSpace: 'nowrap' }}
        >
          <AlertTriangle className="w-4 h-4 text-green-400" />
          {sifirlaBasarili}
        </div>
      )}

      {/* ─── Anomali Sıfırla Onay Modalı ─── */}
      {showSifirlaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 space-y-5"
            style={{ background: 'rgba(15,8,35,0.97)', border: '1px solid rgba(239,68,68,0.35)', backdropFilter: 'blur(24px)' }}>

            {/* İkon + Başlık */}
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }}>
                <Trash2 className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Anomali Kayıtlarını Sıfırla</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Seçilen tarih aralığındaki <span className="text-red-300 font-semibold">açılış</span> ve <span className="text-red-300 font-semibold">kapanış anomalileri</span> kalıcı olarak silinecek.
                Personel puanları güncellenir. Bu işlem geri alınamaz.
              </p>
            </div>

            {/* Tarih seçimi */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Tarih Aralığı
              </p>
              <div className="flex gap-2">
                {(['bugun', 'bu-ay', 'ozel'] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => {
                      setSifirlaFilterKey(k);
                      if (k === 'bugun') { setSifirlaBaslangic(today); setSifirlasBitis(today); }
                      if (k === 'bu-ay') { setSifirlaBaslangic(thisMonthStart); setSifirlasBitis(today); }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      sifirlaFilterKey === k ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-300'
                    }`}
                  >
                    {k === 'bugun' ? 'Bugün' : k === 'bu-ay' ? 'Bu Ay' : 'Özel'}
                  </button>
                ))}
              </div>
              {sifirlaFilterKey === 'ozel' && (
                <div className="flex gap-2 mt-2">
                  <input type="date" value={sifirlaBaslangic}
                    onChange={e => setSifirlaBaslangic(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs" />
                  <input type="date" value={sifirlasBitis}
                    onChange={e => setSifirlasBitis(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs" />
                </div>
              )}
            </div>

            {/* Hata */}
            {sifirlaHata && (
              <div className="rounded-xl px-4 py-3 text-sm text-red-300 flex items-center gap-2"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {sifirlaHata}
              </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSifirlaModal(false)}
                disabled={sifirlaYukleniyor}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-300 active:scale-95 transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                İptal
              </button>
              <button
                onClick={handleAnomaliSifirla}
                disabled={sifirlaYukleniyor}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white active:scale-95 transition-all flex items-center justify-center gap-2"
                style={{ background: sifirlaYukleniyor ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.5)' }}
              >
                {sifirlaYukleniyor
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sıfırlanıyor...</>
                  : <><Trash2 className="w-4 h-4" /> Evet, Sıfırla</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}