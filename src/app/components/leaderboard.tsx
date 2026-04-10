import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Medal, Award, RefreshCw, Loader2, ChevronDown,
  Tag, TrendingUp, AlertTriangle, Users, MapPin, Clock,
  ShieldCheck, Filter, Zap, Camera, Pencil, X, Check, MessageSquare, HelpCircle, Settings,
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { projectId } from '../lib/supabase-info';
import { buildHeaders, getToken, appendGhostParam } from '../lib/api';

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
  purple:  '#a855f7',
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
/** İş günü tarihi: TR 00:00-04:59 → önceki takvim günü (vardiya 05:00'da biter). */
function bizToday(): string {
  const trMs   = Date.now() + 3 * 60 * 60 * 1000;
  const trHour = new Date(trMs).getUTCHours();
  if (trHour < 5) return new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return new Date(trMs).toISOString().split('T')[0];
}

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
  userId?: string;
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

function getPeriodKey(period: Period): string {
  const now = trNow();
  if (period === 'bu-hafta') {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now); mon.setDate(now.getDate() + diff);
    return `hafta_${fmt(mon)}`;
  }
  if (period === 'bu-ay') return `ay_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (period === 'bu-yil') return `yil_${now.getFullYear()}`;
  return 'tumzamanlar';
}

function getPeriodDates(period: Period) {
  const now = trNow();
  const today = bizToday();
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

/** Avatar — emoji veya URL ikisini de handle eder */
function AvatarDisplay({
  avatar, size, borderColor, bgColor, boxShadow,
}: {
  avatar: string; size: number; borderColor?: string; bgColor?: string; boxShadow?: string;
}) {
  const isUrl = avatar.startsWith('http') || avatar.startsWith('/');
  const style: React.CSSProperties = {
    width: size, height: size,
    borderRadius: '50%',
    border: `2px solid ${borderColor || 'rgba(255,255,255,0.15)'}`,
    background: bgColor || 'rgba(255,255,255,0.07)',
    boxShadow: boxShadow,
    flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    fontSize: size * 0.45,
  };
  if (isUrl) {
    return (
      <div style={style}>
        <img src={avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return <div style={style}>{avatar || '👤'}</div>;
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
export function Leaderboard({ userName, userId, userRole, accessToken, onLogout, onNavigate }: LeaderboardProps) {
  const [period, setPeriod] = useState<Period>('bu-ay');
  const [mekanFilter, setMekanFilter] = useState('');
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [mekanlar, setMekanlar] = useState<Mekan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLbGuide, setShowLbGuide] = useState(false);
  const [showLbConfig, setShowLbConfig] = useState(false);
  const [lbConfig, setLbConfig] = useState<any>(null);
  const [lbConfigSaving, setLbConfigSaving] = useState(false);
  const [acikKart, setAcikKart] = useState<string | null>(null);
  const [showMekanFilter, setShowMekanFilter] = useState(false);
  // Quote state
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quoteInput, setQuoteInput] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);

  const showCiro = ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(userRole);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = accessToken || await getToken();
      const { baslangic, bitis } = getPeriodDates(period);
      const pk = getPeriodKey(period);
      const params = new URLSearchParams({ baslangic, bitis, periodKey: pk });
      if (mekanFilter) params.set('mekanId', mekanFilter);
      const res = await fetch(appendGhostParam(`${API_BASE}/leaderboard/performans?${params}`), { headers: buildHeaders(token) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Veri yüklenemedi.'); return; }
      setPersoneller(data.personeller || []);
      setMekanlar(data.mekanlar || []);
      setQuotes(data.quotes || {});
    } catch (e) {
      setError('Sunucuya ulaşılamadı.');
      console.error('Leaderboard error:', e);
    } finally { setLoading(false); }
  }, [accessToken, period, mekanFilter]);

  const handleSaveQuote = async () => {
    if (!editingId) return;
    setSavingQuote(true);
    try {
      const token = accessToken || await getToken();
      const pk = getPeriodKey(period);
      const res = await fetch(`${API_BASE}/leaderboard/quotes`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify({ periodKey: pk, quote: quoteInput }),
      });
      const data = await res.json();
      if (!res.ok) { console.error('Quote save error:', data.error); return; }
      setQuotes(prev => ({ ...prev, [editingId]: quoteInput.trim() }));
      setEditingId(null);
      setQuoteInput('');
    } catch (e) {
      console.error('Quote save error:', e);
    } finally { setSavingQuote(false); }
  };

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
      style={{ background: 'var(--app-bg, linear-gradient(to bottom, #0a051e, #120830, #1a0a3c))' }}
    >
      {/* ── Arka plan glow blob'ları ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(var(--app-accent-rgb),0.08)' }} />
        <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(157,217,234,0.06)' }} />
        <div className="absolute bottom-1/3 left-1/3 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(192,132,252,0.05)' }} />
        {/* Büyük Trophy silüeti — çok hafif */}
        <div className="absolute bottom-16 right-4 text-[180px] opacity-[0.02] select-none pointer-events-none">🏆</div>
      </div>

      {/* ── Sticky Header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-12 pb-3"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
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
          {['yonetici', 'ust-mudur', 'mudur'].includes(userRole) && (
          <button
            onClick={async () => {
              setShowLbConfig(true);
              if (!lbConfig) {
                try {
                  const token = await getToken();
                  const res = await fetch(appendGhostParam(`${API_BASE}/leaderboard/config`), { headers: buildHeaders(token) });
                  if (res.ok) { const d = await res.json(); setLbConfig(d.config); }
                } catch {}
              }
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
            style={{ background: 'rgba(168,130,255,0.15)', border: '1px solid rgba(168,130,255,0.4)' }}
          >
            <Settings className="w-4 h-4" style={{ color: '#c4b5fd' }} />
          </button>
          )}
          <button
            onClick={() => setShowLbGuide(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 8px rgba(251,191,36,0.2)' }}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>
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
                ? { background: `linear-gradient(135deg, ${C.violet}, var(--app-accent, #a855f7))`, color: '#fff', boxShadow: `0 4px 16px ${C.violet}40` }
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
                          <div className="relative">
                            <AvatarDisplay
                              avatar={p.avatar}
                              size={isFirst ? 64 : 52}
                              borderColor={`${glowColor}60`}
                              bgColor={`${glowColor}18`}
                              boxShadow={`0 0 20px ${glowColor}25`}
                            />
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
                        <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.30)' }}>{p.ham.satisAdet} satış</p>

                        {/* Quote alanı */}
                        <div className="w-full mb-1.5 min-h-[28px] flex flex-col items-center gap-1">
                          {editingId === p.id ? (
                            /* Düzenleme modu */
                            <div className="w-full px-1">
                              <textarea
                                autoFocus
                                value={quoteInput}
                                onChange={e => setQuoteInput(e.target.value)}
                                maxLength={80}
                                rows={2}
                                placeholder="Mesajını yaz..."
                                className="w-full text-[9px] text-white rounded-xl px-2 py-1.5 resize-none outline-none"
                                style={{
                                  background: 'rgba(255,255,255,0.10)',
                                  border: `1px solid ${glowColor}50`,
                                  lineHeight: 1.4,
                                  fontStyle: 'italic',
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                              <div className="flex gap-1 mt-1 justify-center">
                                <button
                                  onClick={e => { e.stopPropagation(); handleSaveQuote(); }}
                                  disabled={savingQuote}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95"
                                  style={{ background: glowColor, color: isFirst ? '#1a1a1a' : '#fff' }}
                                >
                                  {savingQuote ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                                  Kaydet
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setEditingId(null); setQuoteInput(''); }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95"
                                  style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.6)' }}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Görüntüleme modu */
                            <div className="w-full flex flex-col items-center gap-0.5">
                              {quotes[p.id] ? (
                                <p
                                  className="text-center text-[9px] leading-tight px-1.5 w-full"
                                  style={{ color: `${glowColor}cc`, fontStyle: 'italic' }}
                                >
                                  "{quotes[p.id]}"
                                </p>
                              ) : userId === p.id ? (
                                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.20)', fontStyle: 'italic' }}>
                                  mesaj yaz...
                                </p>
                              ) : null}
                              {/* Edit butonu — sadece kendi slotu */}
                              {userId === p.id && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingId(p.id);
                                    setQuoteInput(quotes[p.id] || '');
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg transition-all active:scale-95"
                                  style={{ background: `${glowColor}18`, border: `1px solid ${glowColor}30` }}
                                >
                                  <Pencil className="w-2.5 h-2.5" style={{ color: glowColor }} />
                                  <span className="text-[8px] font-semibold" style={{ color: `${glowColor}cc` }}>
                                    {quotes[p.id] ? 'düzenle' : 'yaz'}
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Basamak */}
                        <div
                          className={`w-full ${podiumHeight[idx]} rounded-t-2xl flex items-center justify-center text-base`}
                          style={{
                            background: isFirst
                              ? `linear-gradient(to bottom, ${C.gold}22, ${C.gold}08)`
                              : 'rgba(255,255,255,0.05)',
                            borderTop: `1px solid ${glowColor}25`,
                            borderLeft: `1px solid ${glowColor}25`,
                            borderRight: `1px solid ${glowColor}25`,
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
                { label: 'İskonto Disiplini', pct: `%${Math.round((personeller[0]?.config?.iskonto ?? 0.25) * 100)}`, color: C.green,  icon: Tag },
                { label: 'Ort. Satış Tutarı', pct: `%${Math.round((personeller[0]?.config?.ortSatis ?? 0.15) * 100)}`, color: C.cyan,   icon: TrendingUp },
                { label: 'Mekan Katkısı',     pct: `%${Math.round((personeller[0]?.config?.mekanKatki ?? 0.30) * 100)}`, color: C.gold2,  icon: MapPin },
                { label: 'Anomali Temizliği', pct: `%${Math.round((personeller[0]?.config?.anomali ?? 0.20) * 100)}`, color: C.purple, icon: ShieldCheck },
                { label: 'Devamsızlık',       pct: `%${Math.round((personeller[0]?.config?.devamsizlik ?? 0.10) * 100)}`, color: C.violet, icon: Clock },
              ].filter(m => m.pct !== '%0').map(({ label, pct, color, icon: Icon }) => (
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
                      <AvatarDisplay
                        avatar={p.avatar}
                        size={36}
                        borderColor={p.sira <= 3 ? `${glowColor}40` : 'rgba(255,255,255,0.10)'}
                        bgColor={p.sira <= 3 ? `${glowColor}15` : 'rgba(255,255,255,0.07)'}
                      />

                      {/* İsim + özet */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-white truncate leading-tight">{p.ad}</p>
                        {p.sira <= 3 && quotes[p.id] && (
                          <p className="text-[10px] truncate mt-0.5 flex items-center gap-1" style={{ color: `${glowColor}bb`, fontStyle: 'italic' }}>
                            <MessageSquare className="w-2.5 h-2.5 flex-shrink-0" style={{ color: glowColor }} />
                            {quotes[p.id]}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {(showCiro || p.id === userId) && (
                            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.ham.satisAdet} satış</span>
                          )}
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
                      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.07)' }}
                    >
                      {/* 5 metrik bar */}
                      <div className="space-y-2.5">
                        <MetrikBar label="İsk. Disiplini" puan={p.metrikler.iskontoPuan}     color={C.green}  icon={Tag} />
                        <MetrikBar label="Ort. Satış"     puan={p.metrikler.ortSatisPuan}    color={C.cyan}   icon={TrendingUp} />
                        <MetrikBar label="Mekan Katkı"    puan={p.metrikler.mekanKatkiPuan}  color={C.gold2}  icon={MapPin} />
                        <MetrikBar label="Anomali"        puan={p.metrikler.anomaliPuan}     color={C.purple} icon={ShieldCheck} />
                        <MetrikBar label="Devamsızlık"    puan={p.metrikler.devamsizlikPuan || 0} color={C.violet} icon={Clock} />
                      </div>

                      {/* Ham veri grid */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        {showCiro && (
                          <div className="rounded-2xl p-2.5" style={{ background: `${C.green}0d`, border: `1px solid ${C.green}20` }}>
                            <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Net Ciro</p>
                            <p className="text-sm font-bold" style={{ color: C.green }}>₺{p.ham.ciro.toLocaleString('tr-TR')}</p>
                          </div>
                        )}
                        {(showCiro || p.id === userId) && (
                          <div className="rounded-2xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Satış Adedi</p>
                            <p className="text-sm font-bold text-white">{p.ham.satisAdet}</p>
                          </div>
                        )}
                        {(showCiro || p.id === userId) && (
                          <div className="rounded-2xl p-2.5" style={{ background: `${C.cyan}0d`, border: `1px solid ${C.cyan}20` }}>
                            <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Ort. Satış</p>
                            <p className="text-sm font-bold" style={{ color: C.cyan }}>₺{p.ham.ortSatis.toLocaleString('tr-TR')}</p>
                          </div>
                        )}
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
                        <div
                          className="rounded-2xl p-2.5"
                          style={{
                            background: (p.ham.gecGirisSayisi || 0) > 0 ? 'rgba(248,113,113,0.08)' : `${C.green}0d`,
                            border: (p.ham.gecGirisSayisi || 0) > 0 ? '1px solid rgba(248,113,113,0.20)' : `1px solid ${C.green}20`,
                          }}
                        >
                          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Devamsızlık</p>
                          <p className="text-sm font-bold" style={{ color: (p.ham.gecGirisSayisi || 0) > 0 ? '#f87171' : C.green }}>
                            {(p.ham.gecGirisSayisi || 0) > 0
                              ? `${p.ham.gecGirisSayisi} geç giriş`
                              : 'Dakik ✓'}
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

      {/* Liderlik Tablosu Rehber Modalı */}
      {showLbGuide && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setShowLbGuide(false)}>
          <div
            className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-ta" /> Liderlik Tablosu Rehberi
              </h3>
              <button onClick={() => setShowLbGuide(false)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-[12px] leading-relaxed text-white/70">

              <div>
                <h4 className="text-[13px] font-bold text-white mb-1.5">🏆 Bu Sayfa Ne İşe Yarar?</h4>
                <p>Personelin <span className="text-ta font-semibold">performans sıralamasını</span> çoklu metriklerle takip edin.</p>
                <p className="mt-1">• 5 farklı metriğin ağırlıklı ortalamasıyla hesaplanan 0-100 arası toplam skor</p>
                <p>• Dönem şampiyonları podyumda, tüm personel sıralı listede gösterilir</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📊 5 Performans Metriği</h4>
                <div className="space-y-1.5 mt-1">
                  <p>• <span className="font-semibold" style={{ color: C.green }}>İskonto Disiplini %25</span> — Verilen iskonto oranının düşüklüğü (az iskonto = yüksek puan)</p>
                  <p>• <span className="font-semibold" style={{ color: C.cyan }}>Ort. Satış Tutarı %15</span> — Satış başına ortalama tutar</p>
                  <p>• <span className="font-semibold" style={{ color: C.gold2 }}>Mekan Katkısı %25</span> — Farklı mekanlarda çalışma çeşitliliği</p>
                  <p>• <span className="font-semibold" style={{ color: C.purple }}>Anomali Temizliği %20</span> — Anomali olmayan vardiya oranı</p>
                  <p>• <span className="font-semibold" style={{ color: C.violet }}>Kare Performansı %15</span> — Kaydedilen toplam kare sayısı</p>
                </div>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">👑 Dönem Şampiyonları</h4>
                <p>Seçilen dönemde en yüksek skora sahip ilk 3 personel podyumda gösterilir.</p>
                <p className="mt-1">• 🥇 <span className="text-amber-400 font-semibold">1. sıra</span> ortada, büyük profil</p>
                <p>• 🥈 <span className="text-gray-300 font-semibold">2. sıra</span> solda · 🥉 <span className="text-amber-600 font-semibold">3. sıra</span> sağda</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📅 Dönem Filtreleri</h4>
                <p>Farklı zaman dilimlerine göre sıralama görüntüleyin:</p>
                <p className="mt-1">• <span className="text-ta font-semibold">Bu Hafta</span> · <span className="text-ta font-semibold">Bu Ay</span> · <span className="text-ta font-semibold">Bu Yıl</span> · <span className="text-ta font-semibold">Tüm Zamanlar</span></p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📍 Mekan Filtresi</h4>
                <p>Sağ üstteki <span className="text-ta font-semibold">filtre</span> ikonu ile belirli bir mekana göre sıralama daraltılabilir.</p>
                <p className="mt-1">• Mekan seçildiğinde sadece o mekandaki performans baz alınır</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">🔢 Skor Halkası</h4>
                <p>Her personelin sağındaki dairesel halka toplam skoru gösterir:</p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: `${C.green}20`, color: C.green }}>75+ Yeşil</span>
                  <span className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: `${C.cyan}20`, color: C.cyan }}>50-74 Mavi</span>
                  <span className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: `${C.gold2}20`, color: C.gold2 }}>30-49 Altın</span>
                  <span className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>0-29 Kırmızı</span>
                </div>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">👆 Kart Detayı</h4>
                <p>Personel kartına tıklayarak detay panelini açın:</p>
                <p className="mt-1">• 5 metriğin ayrı ayrı bar grafikleri</p>
                <p>• Ciro, satış adedi, ortalama satış tutarı</p>
                <p>• Toplam iskonto, anomali vardiya oranı, toplam kare</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">⚡ Hesaplama Yöntemi</h4>
                <p>Sıralama <span className="text-ta font-semibold">5 metriğin normalize edilmiş ağırlıklı ortalaması</span> ile hesaplanır.</p>
                <p className="mt-1">• Her metrik 0-100 arasında normalize edilir</p>
                <p>• Ağırlıklar ayarlanabilir (varsayılan: İskonto %25 · Mekan %30 · Anomali %20 · Ort. Satış %15 · Devamsızlık %10)</p>
                <p>• Sonuç: Toplam skor = ağırlıklı toplam</p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── AYAR PANELİ MODAL ── */}
      {showLbConfig && lbConfig && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowLbConfig(false)}>
          <div className="w-full max-w-md bg-[#1a1a2e] rounded-3xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" style={{ color: '#c4b5fd' }} />
                <h3 className="text-base font-bold text-white">Liderlik Ayarları</h3>
              </div>
              <button onClick={() => setShowLbConfig(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4 text-white/50" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-[11px] text-white/40">Metrik ağırlıklarını ayarlayın. Toplam %100 olmalıdır.</p>

              {/* Metrik ağırlıkları */}
              {[
                { key: 'iskontoPuan', label: 'İskonto Disiplini', icon: '📊', color: '#34d399' },
                { key: 'ortSatisPuan', label: 'Ort. Satış Tutarı', icon: '💰', color: '#67e8f9' },
                { key: 'mekanKatkiPuan', label: 'Mekan Katkısı', icon: '🏢', color: '#fbbf24' },
                { key: 'anomaliPuan', label: 'Anomali Temizliği', icon: '🔍', color: '#a78bfa' },
                { key: 'devamsizlikPuan', label: 'Devamsızlık', icon: '⏰', color: '#c4b5fd' },
              ].map(m => (
                <div key={m.key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base">{m.icon}</span>
                    <span className="text-sm font-semibold text-white truncate">{m.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: m.color }}>%</span>
                    <input
                      type="number" min="0" max="100" step="5"
                      value={Math.round((lbConfig[m.key] || 0) * 100)}
                      disabled={userRole !== 'yonetici'}
                      onChange={e => setLbConfig({ ...lbConfig, [m.key]: Number(e.target.value) / 100 })}
                      className="w-16 px-2 py-1.5 bg-white/5 border border-white/15 rounded-lg text-white text-sm text-center font-bold focus:outline-none focus:border-[#c4b5fd] disabled:opacity-40"
                    />
                  </div>
                </div>
              ))}

              {/* Toplam gösterge */}
              {(() => {
                const toplam = Math.round(((lbConfig.iskontoPuan || 0) + (lbConfig.ortSatisPuan || 0) + (lbConfig.mekanKatkiPuan || 0) + (lbConfig.anomaliPuan || 0) + (lbConfig.devamsizlikPuan || 0)) * 100);
                const gecerli = toplam === 100;
                return (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: gecerli ? 'rgba(34,197,94,0.1)' : 'rgba(248,113,113,0.1)', border: gecerli ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(248,113,113,0.3)' }}>
                    <span className="text-xs font-semibold" style={{ color: gecerli ? '#34d399' : '#f87171' }}>Toplam</span>
                    <span className="text-sm font-bold" style={{ color: gecerli ? '#34d399' : '#f87171' }}>%{toplam} {gecerli ? '✓' : '(100 olmalı)'}</span>
                  </div>
                );
              })()}

              {/* Mekan Katkısı iç oranı */}
              <div className="border-t border-white/8 pt-3">
                <p className="text-[11px] text-white/40 mb-3">Mekan Katkısı iç dağılımı (Ciro / Kare)</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-white/60">Ciro</span>
                    <input
                      type="number" min="0" max="100" step="5"
                      value={Math.round((lbConfig.mekanKatkiCiroAgirlik || 0.65) * 100)}
                      disabled={userRole !== 'yonetici'}
                      onChange={e => {
                        const v = Number(e.target.value) / 100;
                        setLbConfig({ ...lbConfig, mekanKatkiCiroAgirlik: v, mekanKatkiKareAgirlik: Math.max(0, 1 - v) });
                      }}
                      className="w-16 px-2 py-1.5 bg-white/5 border border-white/15 rounded-lg text-white text-sm text-center font-bold focus:outline-none focus:border-[#fbbf24] disabled:opacity-40"
                    />
                    <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>%</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-white/60">Kare</span>
                    <input
                      type="number" min="0" max="100" step="5"
                      value={Math.round((lbConfig.mekanKatkiKareAgirlik || 0.35) * 100)}
                      disabled={userRole !== 'yonetici'}
                      onChange={e => {
                        const v = Number(e.target.value) / 100;
                        setLbConfig({ ...lbConfig, mekanKatkiKareAgirlik: v, mekanKatkiCiroAgirlik: Math.max(0, 1 - v) });
                      }}
                      className="w-16 px-2 py-1.5 bg-white/5 border border-white/15 rounded-lg text-white text-sm text-center font-bold focus:outline-none focus:border-[#c4b5fd] disabled:opacity-40"
                    />
                    <span className="text-xs font-bold" style={{ color: '#c4b5fd' }}>%</span>
                  </div>
                </div>
              </div>

              {/* Kaydet butonu (sadece yönetici) */}
              {userRole === 'yonetici' && (
                <button
                  onClick={async () => {
                    const toplam = Math.round(((lbConfig.iskontoPuan || 0) + (lbConfig.ortSatisPuan || 0) + (lbConfig.mekanKatkiPuan || 0) + (lbConfig.anomaliPuan || 0) + (lbConfig.devamsizlikPuan || 0)) * 100);
                    if (toplam !== 100) { alert(`Toplam %100 olmalı (şu an: %${toplam})`); return; }
                    setLbConfigSaving(true);
                    try {
                      const token = await getToken();
                      const res = await fetch(appendGhostParam(`${API_BASE}/leaderboard/config`), {
                        method: 'PUT', headers: buildHeaders(token),
                        body: JSON.stringify(lbConfig),
                      });
                      if (res.ok) { setShowLbConfig(false); fetchData(); }
                      else { const d = await res.json(); alert(d.error || 'Hata oluştu'); }
                    } catch { alert('Bağlantı hatası'); }
                    setLbConfigSaving(false);
                  }}
                  disabled={lbConfigSaving}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #c4b5fd, #a78bfa)', color: '#1a1a2e' }}
                >
                  {lbConfigSaving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
                </button>
              )}

              {/* Açıklama bölümü */}
              <div className="border-t border-white/8 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-white/60">Metrik Açıklamaları</h4>
                {[
                  { icon: '📊', title: 'İskonto Disiplini', desc: 'Personelin verdiği iskonto oranı. Brüt ciro ile net ciro farkı ne kadar küçükse puan o kadar yüksek. Gereksiz indirimden kaçınan personel ödüllendirilir.' },
                  { icon: '💰', title: 'Ort. Satış Tutarı', desc: 'Her satışın ortalama tutarı. Toplam ciro / satış adedi. Daha büyük paketler satan personel daha yüksek puan alır.' },
                  { icon: '🏢', title: 'Mekan Katkısı', desc: 'İki bileşenden oluşur: mekana sağlanan ciro katkısı ve çekilen kare katkısı. Ciro/kare iç oranını yönetici belirler. Satıcı da fotoğrafçı da adil şekilde değerlendirilir.' },
                  { icon: '🔍', title: 'Anomali Temizliği', desc: 'Açılış ve kapanış stok sayımlarında tutarsızlık olup olmadığını ölçer. Anomali çıkmayan vardiya oranı ne kadar yüksekse puan o kadar yüksek.' },
                  { icon: '⏰', title: 'Devamsızlık', desc: 'Vardiyaya zamanında gelme oranını ölçer. Geç giriş yapılan vardiya sayısı ne kadar azsa puan o kadar yüksek. Düzenli ve dakik personel ödüllendirilir.' },
                ].map(m => (
                  <div key={m.title} className="flex gap-2">
                    <span className="text-sm flex-shrink-0">{m.icon}</span>
                    <div>
                      <p className="text-[11px] font-bold text-white/70">{m.title}</p>
                      <p className="text-[10px] text-white/35 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}