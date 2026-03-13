import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Medal, Award, RefreshCw, Loader2, ChevronDown,
  Tag, TrendingUp, AlertTriangle, Users, BarChart2, MapPin,
  ShieldCheck, Filter,
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { projectId } from '/utils/supabase/info';
import { buildHeaders, getToken } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 16,
};

const glassStrong: React.CSSProperties = {
  background: 'rgba(10,5,30,0.82)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 16,
};

/* ── Türkiye saati yardımcısı ── */
function trNow() {
  const now = new Date();
  return new Date(now.getTime() + 3 * 60 * 60 * 1000);
}
function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

type Period = 'bu-hafta' | 'bu-ay' | 'bu-yil' | 'tum-zamanlar';

interface Personel {
  id: string;
  ad: string;
  avatar: string;
  sira: number;
  toplamSkor: number;
  metrikler: {
    iskontoPuan: number;
    ortSatisPuan: number;
    mekanKatkiPuan: number;
    anomaliPuan: number;
  };
  ham: {
    ciro: number;
    satisAdet: number;
    iskonto: number;
    brutCiro: number;
    ortSatis: number;
    anomaliVardiya: number;
    toplamVardiya: number;
  };
}

interface Mekan { id: string; name: string; emoji: string; }

interface LeaderboardProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken?: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

const PERIOD_LABELS: Record<Period, string> = {
  'bu-hafta': 'Bu Hafta',
  'bu-ay': 'Bu Ay',
  'bu-yil': 'Bu Yıl',
  'tum-zamanlar': 'Tüm Zamanlar',
};

function getPeriodDates(period: Period): { baslangic: string; bitis: string } {
  const now = trNow();
  const today = fmt(now);

  if (period === 'bu-hafta') {
    const day = now.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // Monday
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    return { baslangic: fmt(mon), bitis: today };
  }
  if (period === 'bu-ay') {
    return {
      baslangic: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      bitis: today,
    };
  }
  if (period === 'bu-yil') {
    return { baslangic: `${now.getFullYear()}-01-01`, bitis: today };
  }
  // tum-zamanlar
  return { baslangic: '2020-01-01', bitis: today };
}

/* ── Metrik bar bileşeni ── */
function MetrikBar({
  label, puan, color, icon: Icon,
}: {
  label: string; puan: number; color: string; icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-3 h-3 flex-shrink-0 ${color}`} />
      <span className="text-[10px] text-gray-400 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700`}
          style={{ width: `${puan}%`, background: color.includes('green') ? '#a8e6cf' : color.includes('blue') ? '#9dd9ea' : color.includes('amber') ? '#ffd4a3' : '#c084fc' }}
        />
      </div>
      <span className={`text-[10px] font-bold w-7 text-right ${color}`}>{puan}</span>
    </div>
  );
}

/* ── Rank rozeti ── */
function RankBadge({ sira }: { sira: number }) {
  if (sira === 1) return <Trophy className="w-4 h-4 text-yellow-400" />;
  if (sira === 2) return <Medal className="w-4 h-4 text-gray-300" />;
  if (sira === 3) return <Award className="w-4 h-4 text-amber-400" />;
  return <span className="text-xs font-bold text-gray-400">#{sira}</span>;
}

/* ── Skor halkası ── */
function SkorHalka({ skor, size = 56 }: { skor: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (skor / 100) * circ;
  const color = skor >= 75 ? '#a8e6cf' : skor >= 50 ? '#9dd9ea' : skor >= 30 ? '#ffd4a3' : '#ffb3ba';

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill={color}>
        {skor}
      </text>
    </svg>
  );
}

export function Leaderboard({ userName, userRole, accessToken, onLogout, onNavigate }: LeaderboardProps) {
  const [period, setPeriod] = useState<Period>('bu-ay');
  const [mekanFilter, setMekanFilter] = useState('');
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [mekanlar, setMekanlar] = useState<Mekan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acikKart, setAcikKart] = useState<string | null>(null);
  const [showMekanFilter, setShowMekanFilter] = useState(false);

  const showCiro = ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(userRole);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = accessToken || await getToken();
      const { baslangic, bitis } = getPeriodDates(period);
      const params = new URLSearchParams({ baslangic, bitis });
      if (mekanFilter) params.set('mekanId', mekanFilter);

      const res = await fetch(`${API_BASE}/leaderboard/performans?${params}`, {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Veri yüklenemedi.'); return; }
      setPersoneller(data.personeller || []);
      setMekanlar(data.mekanlar || []);
    } catch (e) {
      setError('Sunucuya ulaşılamadı.');
      console.error('Leaderboard fetchData error:', e);
    } finally {
      setLoading(false);
    }
  }, [accessToken, period, mekanFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const top3 = personeller.slice(0, 3);

  /* ── Podium sırası: 2-1-3 ── */
  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
      ? [top3[1], top3[0]]
      : top3;

  const podiumConfig = [
    { height: 'h-16', label: '🥈', textSize: 'text-sm', avatarSize: 'w-14 h-14 text-2xl', borderColor: 'border-gray-400/50' },
    { height: 'h-24', label: '🏆', textSize: 'text-base', avatarSize: 'w-18 h-18 text-3xl', borderColor: 'border-yellow-400/60' },
    { height: 'h-12', label: '🥉', textSize: 'text-sm', avatarSize: 'w-12 h-12 text-xl', borderColor: 'border-amber-500/50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-28">

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-12 pb-4"
        style={{ background: 'rgba(30,25,50,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400/30 to-amber-500/20 flex items-center justify-center border border-yellow-400/30">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white leading-tight">Performans Liderlik Tablosu</h1>
            <p className="text-[11px] text-gray-400">{PERIOD_LABELS[period]} • {personeller.length} personel</p>
          </div>
          <button onClick={fetchData} disabled={loading} className="p-2 rounded-xl bg-white/10 active:scale-95 transition-all">
            {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <RefreshCw className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={() => setShowMekanFilter(v => !v)}
            className={`p-2 rounded-xl transition-all active:scale-95 ${mekanFilter || showMekanFilter ? 'bg-violet-600/60 border border-violet-400/40' : 'bg-white/10'}`}
          >
            <Filter className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Dönem seçici */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
                period === p
                  ? 'bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-900/40'
                  : 'bg-white/8 text-gray-400 border border-white/10'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Mekan filtresi */}
        {showMekanFilter && mekanlar.length > 0 && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
            <button
              onClick={() => setMekanFilter('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                !mekanFilter ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              Tümü
            </button>
            {mekanlar.map(m => (
              <button
                key={m.id}
                onClick={() => setMekanFilter(m.id === mekanFilter ? '' : m.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                  mekanFilter === m.id ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {m.emoji} {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Hata ── */}
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Yükleniyor ── */}
      {loading && personeller.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-gray-400 text-sm">Performans verileri hesaplanıyor...</p>
        </div>
      )}

      {/* ── Boş durum ── */}
      {!loading && !error && personeller.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-300 font-semibold">Bu dönemde satış verisi yok</p>
          <p className="text-gray-500 text-sm">Farklı bir dönem veya mekan seçin</p>
        </div>
      )}

      {personeller.length > 0 && (
        <>
          {/* ── Puan Sistemi Açıklama Kartı ── */}
          <div className="mx-4 mt-4 mb-4">
            <div style={glass} className="p-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Skor Formülü</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <Tag className="w-3 h-3 text-green-400" />
                  <span className="text-gray-300">İskonto Disiplini</span>
                  <span className="ml-auto text-green-400 font-bold">%35</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <TrendingUp className="w-3 h-3 text-blue-400" />
                  <span className="text-gray-300">Ort. Satış Tutarı</span>
                  <span className="ml-auto text-blue-400 font-bold">%25</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span className="text-gray-300">Mekan Katkısı</span>
                  <span className="ml-auto text-amber-400 font-bold">%20</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <ShieldCheck className="w-3 h-3 text-purple-400" />
                  <span className="text-gray-300">Anomali Temizliği</span>
                  <span className="ml-auto text-purple-400 font-bold">%20</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Podium (Top 3) ── */}
          {top3.length >= 2 && (
            <div className="mx-4 mb-4">
              <div style={glassStrong} className="p-5 pt-8 relative overflow-hidden">
                {/* Arka plan efekti */}
                <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />

                <div className="flex items-end justify-center gap-3 mb-4">
                  {podiumOrder.map((p, idx) => {
                    const cfg = podiumConfig[idx];
                    const isFirst = p.sira === 1;
                    return (
                      <div key={p.id} className="flex-1 flex flex-col items-center">
                        {/* Avatar */}
                        <div className="relative mb-2">
                          {isFirst && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                          )}
                          <div
                            className={`${isFirst ? 'w-16 h-16 text-3xl' : 'w-13 h-13 text-2xl'} rounded-full flex items-center justify-center border-2 ${cfg.borderColor} shadow-lg`}
                            style={{ background: isFirst ? 'rgba(250,200,50,0.2)' : 'rgba(255,255,255,0.1)' }}
                          >
                            <span style={{ fontSize: isFirst ? 28 : 22 }}>{p.avatar}</span>
                          </div>
                          {/* Skor badge */}
                          <div
                            className="absolute -bottom-1 -right-1 px-1.5 rounded-full text-[9px] font-bold"
                            style={{ background: isFirst ? '#fbbf24' : 'rgba(255,255,255,0.2)', color: isFirst ? '#1a1a1a' : '#fff' }}
                          >
                            {p.toplamSkor}
                          </div>
                        </div>

                        {/* İsim */}
                        <div className={`text-center ${cfg.textSize} font-semibold text-white mb-1 leading-tight px-1`}>
                          {p.ad.split(' ')[0]}
                        </div>
                        <div className="text-[10px] text-gray-400 mb-2">{p.ham.satisAdet} satış</div>

                        {/* Podyum basamağı */}
                        <div
                          className={`w-full ${cfg.height} rounded-t-xl flex items-center justify-center text-xl border-t border-x`}
                          style={{
                            background: isFirst
                              ? 'linear-gradient(to bottom, rgba(250,200,50,0.25), rgba(250,200,50,0.08))'
                              : 'rgba(255,255,255,0.06)',
                            borderColor: isFirst ? 'rgba(250,200,50,0.3)' : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          {cfg.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Tüm liste ── */}
          <div className="px-4 space-y-2">
            <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5" />
              Tüm Sıralama
            </p>

            {personeller.map((p) => {
              const isOpen = acikKart === p.id;
              const rankColor =
                p.sira === 1 ? 'from-yellow-500/20 to-amber-500/10 border-yellow-500/30' :
                p.sira === 2 ? 'from-gray-400/15 to-gray-500/5 border-gray-400/25' :
                p.sira === 3 ? 'from-amber-600/15 to-amber-700/5 border-amber-600/25' :
                'from-white/7 to-white/3 border-white/12';

              const skorColor =
                p.toplamSkor >= 75 ? 'text-green-400' :
                p.toplamSkor >= 50 ? 'text-blue-300' :
                p.toplamSkor >= 30 ? 'text-amber-400' : 'text-red-400';

              const anomaliOran = p.ham.toplamVardiya > 0
                ? Math.round((p.ham.anomaliVardiya / p.ham.toplamVardiya) * 100)
                : 0;

              return (
                <div key={p.id}>
                  <button
                    onClick={() => setAcikKart(isOpen ? null : p.id)}
                    className={`w-full bg-gradient-to-br ${rankColor} border rounded-2xl p-3.5 transition-all active:scale-[0.98] text-left`}
                    style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Sıra */}
                      <div className="w-7 flex items-center justify-center flex-shrink-0">
                        <RankBadge sira={p.sira} />
                      </div>

                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 border border-white/20"
                        style={{ background: 'rgba(255,255,255,0.1)' }}
                      >
                        {p.avatar}
                      </div>

                      {/* İsim + özet */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm leading-tight truncate">{p.ad}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-400">{p.ham.satisAdet} satış</span>
                          {showCiro && (
                            <span className="text-[10px] text-green-400 font-semibold">
                              ₺{p.ham.ciro.toLocaleString('tr-TR')}
                            </span>
                          )}
                          {p.ham.anomaliVardiya > 0 && (
                            <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />{p.ham.anomaliVardiya}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Skor halkası */}
                      <SkorHalka skor={p.toplamSkor} size={48} />

                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* ── Açılır detay ── */}
                  {isOpen && (
                    <div
                      className="mx-1 rounded-b-2xl border-x border-b border-white/10 px-4 py-4 space-y-3"
                      style={{ background: 'rgba(10,5,30,0.7)', backdropFilter: 'blur(20px)' }}
                    >
                      {/* Metrik barları */}
                      <div className="space-y-2">
                        <MetrikBar
                          label="İsk. Disiplini"
                          puan={p.metrikler.iskontoPuan}
                          color="text-green-400"
                          icon={Tag}
                        />
                        <MetrikBar
                          label="Ort. Satış"
                          puan={p.metrikler.ortSatisPuan}
                          color="text-blue-400"
                          icon={TrendingUp}
                        />
                        <MetrikBar
                          label="Mekan Katkı"
                          puan={p.metrikler.mekanKatkiPuan}
                          color="text-amber-400"
                          icon={MapPin}
                        />
                        <MetrikBar
                          label="Anomali"
                          puan={p.metrikler.anomaliPuan}
                          color="text-purple-400"
                          icon={ShieldCheck}
                        />
                      </div>

                      {/* Ham veriler */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/8">
                        {showCiro && (
                          <div className="bg-white/5 rounded-xl p-2.5">
                            <div className="text-[10px] text-gray-500 mb-0.5">Net Ciro</div>
                            <div className="text-sm font-bold text-green-400">₺{p.ham.ciro.toLocaleString('tr-TR')}</div>
                          </div>
                        )}
                        <div className="bg-white/5 rounded-xl p-2.5">
                          <div className="text-[10px] text-gray-500 mb-0.5">Satış Adedi</div>
                          <div className="text-sm font-bold text-white">{p.ham.satisAdet}</div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5">
                          <div className="text-[10px] text-gray-500 mb-0.5">Ort. Satış</div>
                          <div className="text-sm font-bold text-blue-300">₺{p.ham.ortSatis.toLocaleString('tr-TR')}</div>
                        </div>
                        {showCiro && (
                          <div className="bg-white/5 rounded-xl p-2.5">
                            <div className="text-[10px] text-gray-500 mb-0.5">Toplam İskonto</div>
                            <div className="text-sm font-bold text-amber-400">
                              ₺{p.ham.iskonto.toLocaleString('tr-TR')}
                              {p.ham.brutCiro > 0 && (
                                <span className="text-[10px] text-gray-500 font-normal ml-1">
                                  (%{Math.round((p.ham.iskonto / p.ham.brutCiro) * 100)})
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className={`bg-white/5 rounded-xl p-2.5 ${p.ham.anomaliVardiya > 0 ? 'border border-red-500/20' : ''}`}>
                          <div className="text-[10px] text-gray-500 mb-0.5">Anomali Vardiya</div>
                          <div className={`text-sm font-bold ${p.ham.anomaliVardiya > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {p.ham.anomaliVardiya > 0
                              ? `${p.ham.anomaliVardiya} / ${p.ham.toplamVardiya} (%${anomaliOran})`
                              : 'Temiz ✓'}
                          </div>
                        </div>
                      </div>

                      {/* İskonto disiplini mesajı */}
                      {p.ham.brutCiro > 0 && (
                        <div className={`rounded-xl px-3 py-2 text-[10px] flex items-center gap-1.5 ${
                          p.ham.iskonto / p.ham.brutCiro < 0.05
                            ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                            : p.ham.iskonto / p.ham.brutCiro < 0.15
                              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                              : 'bg-red-500/10 border border-red-500/20 text-red-300'
                        }`}>
                          <Tag className="w-3 h-3 flex-shrink-0" />
                          {p.ham.iskonto / p.ham.brutCiro < 0.05
                            ? 'Mükemmel fiyat disiplini — indirim oranı düşük'
                            : p.ham.iskonto / p.ham.brutCiro < 0.15
                              ? 'Orta düzey indirim — geliştirilebilir'
                              : 'Yüksek indirim oranı — fiyat savunması zayıf'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Alt bilgi ── */}
          <div className="mx-4 mt-6 mb-2">
            <div style={glass} className="p-3 text-center">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Sıralama normalize edilmiş puan sistemiyle hesaplanır. Her metrik ekip içinde göreli olarak değerlendirilerek adil karşılaştırma sağlanır.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Bottom Nav */}
      {['personel', 'operasyon', 'bekleyen'].includes(userRole) && (
        <NewBottomNav activeTab="leaderboard" onTabChange={onNavigate} userRole={userRole} />
      )}
    </div>
  );
}