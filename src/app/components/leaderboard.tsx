import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Medal, Award, RefreshCw, Loader2, ChevronDown,
  Tag, TrendingUp, AlertTriangle, Users, MapPin,
  ShieldCheck, Filter, Zap, Camera,
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { projectId } from '/utils/supabase/info';
import { buildHeaders, getToken } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/* ────────────────────────────────────────────────────────────
   Temayla eşleşen renk & stil sabitleri
──────────────────────────────────────────────────────────── */
const C = {
  violet:  '#a855f7',
  cyan:    '#9dd9ea',
  gold:    '#ffe5b4',
  gold2:   '#ffd4a3',
  silver:  '#d6e0ec',
  bronze:  '#ffcba4',
  green:   '#a8e6cf',
  purple:  '#c084fc',
};

const glassCard: React.CSSProperties = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         24,
  position:             'relative',
  overflow:             'hidden',
};

/* ────────────────────────────────────────────────────────────
   Türkiye saati yardımcıları
──────────────────────────────────────────────────────────── */
function trNow() {
  const now = new Date();
  return new Date(now.getTime() + 3 * 60 * 60 * 1000);
}
function fmt(d: Date) { return d.toISOString().split('T')[0]; }

/* ────────────────────────────────────────────────────────────
   Tipler
──────────────────────────────────────────────────────────── */
type Period = 'bu-hafta' | 'bu-ay' | 'bu-yil' | 'tum-zamanlar';

interface Personel {
  id: string; ad: string; avatar: string; sira: number; toplamSkor: number;
  metrikler: { iskontoPuan: number; ortSatisPuan: number; mekanKatkiPuan: number; anomaliPuan: number; karePuan: number; };
  ham: { ciro: number; satisAdet: number; iskonto: number; brutCiro: number; ortSatis: number; anomaliVardiya: number; toplamVardiya: number; toplamKare: number; };
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

function getPeriodDates(period: Period) {
  const now = trNow();
  const today = fmt(now);
  if (period === 'bu-hafta') {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now); mon.setDate(now.getDate() + diff);
    return { baslangic: fmt(mon), bitis: today };
  }
  if (period === 'bu-ay') return { baslangic: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, bitis: today };
  if (period === 'bu-yil') return { baslangic: `${now.getFullYear()}-01-01`, bitis: today };
  return { baslangic: '2020-01-01', bitis: today };
}

/* ────────────────────────────────────────────────────────────
   Alt bileşenler
──────────────────────────────────────────────────────────── */

/** Üst ince accent çizgisi — diğer komponentlerde de var */
function TopAccent({ color = 'rgba(255,255,255,0.25)' }: { color?: string }) {
  return (
    <div
      className="absolute top-0 left-8 right-8 h-px pointer-events-none"
      style={{ background: `linear-gradient(to right, transparent, ${color}, transparent)` }}
    />
  );
}

/** Skor dairesel halka (SVG) */
function SkorHalka({ skor, size = 48 }: { skor: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (skor / 100) * circ;
  const color = skor >= 75 ? C.green : skor >= 50 ? C.cyan : skor >= 30 ? C.gold2 : '#f87171';
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
      <text x={size/2} y={size/2+4} textAnchor="middle" fontSize={10} fontWeight="bold" fill={color}>{skor}</text>
    </svg>
  );
}

/** Metrik bar satırı */
function MetrikBar({ label, puan, color, icon: Icon }: { label: string; puan: number; color: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <span className="text-[10px] text-white/40 w-[72px] flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${puan}%`, background: color, opacity: 0.85, transition: 'width 0.9s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <span className="text-[10px] font-bold w-6 text-right" style={{ color }}>{puan}</span>
    </div>
  );
}

/** Rank rozeti */
function RankBadge({ sira }: { sira: number }) {
  if (sira === 1) return <Trophy className="w-4 h-4" style={{ color: C.gold }} />;
  if (sira === 2) return <Medal className="w-4 h-4" style={{ color: C.silver }} />;
  if (sira === 3) return <Award className="w-4 h-4" style={{ color: C.bronze }} />;
  return <span className="text-xs font-bold text-white/30">#{sira}</span>;
}

/** Sol accent çizgisi (altın/gümüş/bronz için) */
function RankAccent({ sira }: { sira: number }) {
  const color = sira === 1 ? C.gold : sira === 2 ? C.silver : sira === 3 ? C.bronze : 'transparent';
  if (sira > 3) return null;
  return <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: color }} />;
}

/* ────────────────────────────────────────────────────────────
   Ana bileşen
──────────────────────────────────────────────────────────── */
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
    setLoading(true); setError('');
    try {
      const token = accessToken || await getToken();
      const { baslangic, bitis } = getPeriodDates(period);
      const params = new URLSearchParams({ baslangic, bitis });
      if (mekanFilter) params.set('mekanId', mekanFilter);
      const res = await fetch(`${API_BASE}/leaderboard/performans?${params}`, { headers: buildHeaders(token) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Veri yüklenemedi.'); return; }
      setPersoneller(data.personeller || []);
      setMekanlar(data.mekanlar || []);
    } catch (e) {
      setError('Sunucuya ulaşılamadı.');
      console.error('Leaderboard error:', e);
    } finally { setLoading(false); }
  }, [accessToken, period, mekanFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const top3 = personeller.slice(0, 3);
  // Podyum sırası: gümüş (2) – altın (1) – bronz (3)
  const podiumSlots = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2 ? [top3[1], top3[0]] : top3;

  const podiumHeight = ['h-14', 'h-20', 'h-10'];
  const podiumGlow: Record<number, string> = { 1: C.gold, 2: C.silver, 3: C.bronze };

  return (
    <div
      className="min-h-screen pb-32 relative overflow-x-hidden"
      style={{ background: 'linear-gradient(to bottom, #0a051e, #120830, #1a0a3c)' }}
    >
      {/* ── Arka plan glow blob'ları ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(168,85,247,0.08)' }} />
        <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(157,217,234,0.06)' }} />
        <div className="absolute bottom-1/3 left-1/3 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(192,132,252,0.05)' }} />
        {/* Büyük Trophy silüeti — çok hafif */}
        <div className="absolute bottom-16 right-4 text-[180px] opacity-[0.02] select-none pointer-events-none">🏆</div>
      </div>

      {/* ── Sticky Header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-12 pb-3"
        style={{ background: 'rgba(10,5,30,0.88)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Başlık satırı */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${C.violet}30, ${C.gold}18)`, border: `1px solid ${C.violet}35` }}
          >
            <Trophy className="w-4 h-4" style={{ color: C.gold }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-white leading-tight">Liderlik Tablosu</h1>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {PERIOD_LABELS[period]} · {personeller.length} personel
            </p>
          </div>
          <button
            onClick={fetchData} disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            {loading
              ? <Loader2 className="w-3.5 h-3.5 text-white/50 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5 text-white/50" />}
          </button>
          <button
            onClick={() => setShowMekanFilter(v => !v)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{
              background: mekanFilter ? `${C.violet}25` : 'rgba(255,255,255,0.07)',
              border: mekanFilter ? `1px solid ${C.violet}50` : '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <Filter className="w-3.5 h-3.5" style={{ color: mekanFilter ? C.violet : 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* Dönem pill'leri */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
              style={period === p
                ? { background: `linear-gradient(135deg, ${C.violet}, #7c3aed)`, color: '#fff', boxShadow: `0 4px 16px ${C.violet}40` }
                : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Mekan filtresi */}
        {showMekanFilter && mekanlar.length > 0 && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-none pb-0.5">
            {[{ id: '', name: 'Tümü', emoji: '🌐' }, ...mekanlar].map(m => (
              <button
                key={m.id}
                onClick={() => setMekanFilter(m.id === mekanFilter ? '' : m.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
                style={mekanFilter === m.id || (!mekanFilter && m.id === '')
                  ? { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.20)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.07)' }
                }
              >
                {m.emoji} {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Hata ── */}
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-2xl flex items-center gap-2 text-sm"
          style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.20)', color: '#fca5a5' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Yükleniyor skeleton ── */}
      {loading && personeller.length === 0 && (
        <div className="px-4 pt-5 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ ...glassCard, padding: 16 }} className="animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-white/8" />
                <div className="w-10 h-10 rounded-full bg-white/8" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 rounded-full bg-white/8 w-32" />
                  <div className="h-2 rounded-full bg-white/5 w-20" />
                </div>
                <div className="w-12 h-12 rounded-full bg-white/8" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Boş durum ── */}
      {!loading && !error && personeller.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Users className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.25)' }} />
          </div>
          <p className="text-white/60 font-semibold text-sm">Bu dönemde satış verisi yok</p>
          <p className="text-white/30 text-xs">Farklı bir dönem veya mekan seçin</p>
        </div>
      )}

      {personeller.length > 0 && (
        <div className="relative z-10">

          {/* ────────────────────────────────────────────
              HERO PODYUM
          ──────────────────────────────────────────── */}
          {top3.length >= 2 && (
            <div className="px-4 pt-5 pb-2">
              <div style={{ ...glassCard, padding: '32px 20px 20px' }}
                   className="shadow-2xl">
                <TopAccent color="rgba(255,255,255,0.20)" />
                {/* İç gradient overlay */}
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${C.gold}08 0%, transparent 65%)` }} />

                {/* Podyum başlığı */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, rgba(255,229,180,0.20))' }} />
                  <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: `${C.gold}99` }}>Dönem Şampiyonları</span>
                  <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, rgba(255,229,180,0.20))' }} />
                </div>

                <div className="flex items-end justify-center gap-4">
                  {podiumSlots.map((p, idx) => {
                    const isFirst = p.sira === 1;
                    const glowColor = podiumGlow[p.sira] || 'transparent';
                    return (
                      <div key={p.id} className="flex-1 flex flex-col items-center">
                        {/* Avatar bölgesi */}
                        <div className="relative mb-3">
                          {isFirst && (
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xl animate-bounce select-none">👑</span>
                          )}
                          {/* Glow halkası */}
                          <div
                            className="absolute inset-0 rounded-full blur-md"
                            style={{ background: glowColor, opacity: isFirst ? 0.35 : 0.18, transform: 'scale(1.3)' }}
                          />
                          {/* Avatar dairesi */}
                          <div
                            className="relative flex items-center justify-center rounded-full border-2"
                            style={{
                              width: isFirst ? 64 : 52,
                              height: isFirst ? 64 : 52,
                              fontSize: isFirst ? 28 : 22,
                              background: `${glowColor}18`,
                              borderColor: `${glowColor}60`,
                              boxShadow: `0 0 20px ${glowColor}25`,
                            }}
                          >
                            {p.avatar}
                          </div>
                          {/* Skor chip */}
                          <div
                            className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: glowColor, color: isFirst ? '#1a1a1a' : '#fff', fontSize: 9 }}
                          >
                            {p.toplamSkor}
                          </div>
                        </div>

                        {/* İsim */}
                        <p className="text-center text-xs font-bold text-white mb-0.5 leading-tight px-1 truncate w-full">
                          {p.ad.split(' ')[0]}
                        </p>
                        <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.30)' }}>{p.ham.satisAdet} satış</p>

                        {/* Basamak */}
                        <div
                          className={`w-full ${podiumHeight[idx]} rounded-t-2xl flex items-center justify-center text-base`}
                          style={{
                            background: isFirst
                              ? `linear-gradient(to bottom, ${C.gold}22, ${C.gold}08)`
                              : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${glowColor}25`,
                            borderBottom: 'none',
                          }}
                        >
                          {p.sira === 1 ? '🥇' : p.sira === 2 ? '🥈' : '🥉'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────
              SKOR FORMÜLÜ — kaydırmalı pill bar
          ──────────────────────────────────────────── */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
              {[
                { label: 'İskonto Disiplini', pct: '%25', color: C.green,  icon: Tag },
                { label: 'Ort. Satış Tutarı', pct: '%15', color: C.cyan,   icon: TrendingUp },
                { label: 'Mekan Katkısı',     pct: '%25', color: C.gold2,  icon: MapPin },
                { label: 'Anomali Temizliği', pct: '%20', color: C.purple, icon: ShieldCheck },
                { label: 'Kare Performansı',  pct: '%15', color: C.violet, icon: Camera },
              ].map(({ label, pct, color, icon: Icon }) => (
                <div
                  key={label}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl"
                  style={{ background: `${color}12`, border: `1px solid ${color}25` }}
                >
                  <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
                  <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</span>
                  <span className="text-[10px] font-bold ml-0.5" style={{ color }}>{pct}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ────────────────────────────────────────────
              TÜM SIRALAMALAR LİSTESİ
          ──────────────────────────────────────────── */}
          <div className="px-4 pt-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5" style={{ color: C.violet }} />
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.30)' }}>Tüm Sıralama</span>
            </div>

            {personeller.map((p) => {
              const isOpen = acikKart === p.id;
              const glowColor = p.sira === 1 ? C.gold : p.sira === 2 ? C.silver : p.sira === 3 ? C.bronze : 'transparent';
              const anomaliOran = p.ham.toplamVardiya > 0
                ? Math.round((p.ham.anomaliVardiya / p.ham.toplamVardiya) * 100) : 0;
              const iskentoPct = p.ham.brutCiro > 0 ? p.ham.iskonto / p.ham.brutCiro : 0;

              return (
                <div key={p.id}>
                  {/* ── Kart başlığı ── */}
                  <button
                    onClick={() => setAcikKart(isOpen ? null : p.id)}
                    className="w-full text-left transition-all active:scale-[0.98]"
                    style={{
                      ...glassCard,
                      padding: '14px 14px 14px 18px',
                      borderColor: p.sira <= 3 ? `${glowColor}30` : 'rgba(255,255,255,0.09)',
                      boxShadow: p.sira <= 3 ? `0 4px 20px ${glowColor}10` : 'none',
                    }}
                  >
                    <TopAccent color={p.sira <= 3 ? `${glowColor}50` : 'rgba(255,255,255,0.12)'} />
                    <RankAccent sira={p.sira} />

                    <div className="flex items-center gap-3">
                      {/* Sıra rozeti */}
                      <div className="w-6 flex items-center justify-center flex-shrink-0">
                        <RankBadge sira={p.sira} />
                      </div>

                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                        style={{
                          background: p.sira <= 3 ? `${glowColor}15` : 'rgba(255,255,255,0.07)',
                          border: `1px solid ${p.sira <= 3 ? glowColor + '40' : 'rgba(255,255,255,0.10)'}`,
                        }}
                      >
                        {p.avatar}
                      </div>

                      {/* İsim + özet */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white truncate leading-tight">{p.ad}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.ham.satisAdet} satış</span>
                          {showCiro && (
                            <span className="text-[10px] font-semibold" style={{ color: C.green }}>
                              ₺{p.ham.ciro.toLocaleString('tr-TR')}
                            </span>
                          )}
                          {p.ham.anomaliVardiya > 0 && (
                            <span className="text-[10px] flex items-center gap-0.5" style={{ color: '#f87171' }}>
                              <AlertTriangle className="w-2.5 h-2.5" />{p.ham.anomaliVardiya}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Skor halkası */}
                      <SkorHalka skor={p.toplamSkor} size={46} />

                      <ChevronDown
                        className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                        style={{ color: 'rgba(255,255,255,0.25)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      />
                    </div>
                  </button>

                  {/* ── Açılır detay paneli ── */}
                  {isOpen && (
                    <div
                      className="mx-1 rounded-b-3xl border-x border-b px-4 pt-3 pb-4 space-y-4"
                      style={{ background: 'rgba(10,5,30,0.75)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.07)' }}
                    >
                      {/* 5 metrik bar */}
                      <div className="space-y-2.5">
                        <MetrikBar label="İsk. Disiplini" puan={p.metrikler.iskontoPuan}    color={C.green}  icon={Tag} />
                        <MetrikBar label="Ort. Satış"     puan={p.metrikler.ortSatisPuan}   color={C.cyan}   icon={TrendingUp} />
                        <MetrikBar label="Mekan Katkı"    puan={p.metrikler.mekanKatkiPuan} color={C.gold2}  icon={MapPin} />
                        <MetrikBar label="Anomali"        puan={p.metrikler.anomaliPuan}    color={C.purple} icon={ShieldCheck} />
                        <MetrikBar label="Kare Perf."     puan={p.metrikler.karePuan}       color={C.violet} icon={Camera} />
                      </div>

                      {/* Ham veri grid */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        {showCiro && (
                          <div className="rounded-2xl p-2.5" style={{ background: `${C.green}0d`, border: `1px solid ${C.green}20` }}>
                            <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Net Ciro</p>
                            <p className="text-sm font-bold" style={{ color: C.green }}>₺{p.ham.ciro.toLocaleString('tr-TR')}</p>
                          </div>
                        )}
                        <div className="rounded-2xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Satış Adedi</p>
                          <p className="text-sm font-bold text-white">{p.ham.satisAdet}</p>
                        </div>
                        <div className="rounded-2xl p-2.5" style={{ background: `${C.cyan}0d`, border: `1px solid ${C.cyan}20` }}>
                          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Ort. Satış</p>
                          <p className="text-sm font-bold" style={{ color: C.cyan }}>₺{p.ham.ortSatis.toLocaleString('tr-TR')}</p>
                        </div>
                        {showCiro && (
                          <div className="rounded-2xl p-2.5" style={{ background: `${C.gold2}0d`, border: `1px solid ${C.gold2}20` }}>
                            <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Toplam İskonto</p>
                            <p className="text-sm font-bold" style={{ color: C.gold2 }}>
                              ₺{p.ham.iskonto.toLocaleString('tr-TR')}
                              {p.ham.brutCiro > 0 && (
                                <span className="text-[9px] font-normal ml-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
                                  (%{Math.round(iskentoPct * 100)})
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                        <div
                          className="rounded-2xl p-2.5"
                          style={{
                            background: p.ham.anomaliVardiya > 0 ? 'rgba(248,113,113,0.08)' : `${C.green}0d`,
                            border: p.ham.anomaliVardiya > 0 ? '1px solid rgba(248,113,113,0.20)' : `1px solid ${C.green}20`,
                          }}
                        >
                          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Anomali Vardiya</p>
                          <p className="text-sm font-bold" style={{ color: p.ham.anomaliVardiya > 0 ? '#f87171' : C.green }}>
                            {p.ham.anomaliVardiya > 0
                              ? `${p.ham.anomaliVardiya}/${p.ham.toplamVardiya} (%${anomaliOran})`
                              : 'Temiz ✓'}
                          </p>
                        </div>
                        <div className="rounded-2xl p-2.5" style={{ background: `${C.violet}0d`, border: `1px solid ${C.violet}25` }}>
                          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Toplam Kare</p>
                          <p className="text-sm font-bold" style={{ color: C.violet }}>
                            {p.ham.toplamKare > 0 ? `${p.ham.toplamKare.toLocaleString('tr-TR')} 📷` : '—'}
                          </p>
                        </div>
                      </div>

                      {/* İskonto disiplini chip */}
                      {p.ham.brutCiro > 0 && (
                        <div
                          className="rounded-2xl px-3 py-2 flex items-center gap-2 text-[10px]"
                          style={
                            iskentoPct < 0.05
                              ? { background: `${C.green}10`, border: `1px solid ${C.green}25`, color: C.green }
                              : iskentoPct < 0.15
                                ? { background: `${C.gold2}10`, border: `1px solid ${C.gold2}25`, color: C.gold2 }
                                : { background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.25)', color: '#fca5a5' }
                          }
                        >
                          <Tag className="w-3 h-3 flex-shrink-0" />
                          {iskentoPct < 0.05
                            ? 'Mükemmel fiyat disiplini — indirim oranı çok düşük'
                            : iskentoPct < 0.15
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

          {/* Alt not */}
          <div className="mx-4 mt-5 mb-2 px-4 py-3 rounded-2xl flex items-start gap-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: C.violet }} />
            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.30)' }}>
              Sıralama 5 metriğin normalize edilmiş ağırlıklı ortalamasıyla hesaplanır: İskonto %25 · Ort. Satış %15 · Mekan Katkı %25 · Anomali %20 · Kare %15
            </p>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      {['personel', 'operasyon', 'bekleyen'].includes(userRole) && (
        <NewBottomNav activeTab="leaderboard" onTabChange={onNavigate} userRole={userRole} />
      )}
    </div>
  );
}
