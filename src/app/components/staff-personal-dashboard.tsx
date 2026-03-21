import { useState, useEffect, useCallback } from 'react';
import type { ElementType, ReactNode } from 'react';
import {
  Zap, Percent, ChevronRight, Flame, Star, Trophy,
  Tag, TrendingUp, MapPin, ShieldCheck,
  Camera, WifiOff, Megaphone, Loader2, Award, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { CurrencyWidget } from './currency-widget';
import { getUserQueue, getUserFrameQueue } from '../lib/offline-queue';
import { buildHeaders, getToken } from '../lib/api';
import { projectId } from '/utils/supabase/info';
import { ShiftCheckInCard } from './shift-checkin-card';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface StaffPersonalDashboardProps {
  userName: string;
  userId: string;
  accessToken: string;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

interface MyPerf {
  sira: number;
  toplamPersonel: number;
  toplamSkor: number;
  iskontoPuan: number;
  ortSatisPuan: number;
  mekanKatkiPuan: number;
  anomaliPuan: number;
  karePuan: number;
  avgIskontoOran: number; // yüzde
}

interface TrendMonth {
  periodKey: string;
  monthShort: string;   // "Oca", "Şub", …
  sira: number | null;
  toplamPersonel: number;
  isCurrent: boolean;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'temporary' | 'pinned' | 'info';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

/* ── Türkiye saati yardımcıları ── */
function trNow() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}
function fmt(d: Date) { return d.toISOString().split('T')[0]; }
/** İş günü tarihi: TR 00:00-04:59 → önceki takvim günü (vardiya 05:00'da biter). */
function bizToday(): string {
  const trMs   = Date.now() + 3 * 60 * 60 * 1000;
  const trHour = new Date(trMs).getUTCHours();
  if (trHour < 5) return new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return new Date(trMs).toISOString().split('T')[0];
}
function getMonthDates() {
  const now = trNow();
  const baslangic = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const bitis = bizToday();
  const periodKey = `ay_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { baslangic, bitis, periodKey };
}

/* ── Ay listesi helper ── */
function getLast3Months(): { periodKey: string; baslangic: string; bitis: string; monthShort: string; isCurrent: boolean }[] {
  const now = trNow();
  const result = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const mm = String(m).padStart(2, '0');
    const periodKey = `ay_${y}-${mm}`;
    const baslangic = `${y}-${mm}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const bitis = i === 0 ? bizToday() : `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
    const monthShort = new Date(y, m - 1, 1).toLocaleString('tr-TR', { month: 'short' });
    result.push({ periodKey, baslangic, bitis, monthShort, isCurrent: i === 0 });
  }
  return result;
}

/* ── Rank rengi ── */
function rankColor(sira: number | null): string {
  if (sira === null) return 'rgba(255,255,255,0.25)';
  if (sira <= 3) return '#4ade80';
  if (sira <= 6) return '#ffd4a3';
  return '#f87171';
}

/* ── Mini Sparkline Tooltip ── */
function SparkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: 'rgba(15,10,40,0.92)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8, padding: '5px 10px',
      fontSize: 11, color: 'white',
    }}>
      <span style={{ color: 'rgba(255,255,255,0.50)', marginRight: 4 }}>{d?.monthShort}</span>
      <span style={{ fontWeight: 800, color: rankColor(d?.sira) }}>#{d?.sira ?? '—'}</span>
    </div>
  );
}

/* ── Metrik Bar ── */
function MetrikBar({
  label, puan, color, icon: Icon,
}: {
  label: string; puan: number; color: string; icon: ElementType;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon style={{ width: 12, height: 12, flexShrink: 0, color }} />
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', width: 78, flexShrink: 0 }}>{label}</span>
      <div style={{
        flex: 1, height: 6, borderRadius: 9999,
        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${puan}%`, height: '100%', borderRadius: 9999,
          background: color, opacity: 0.85,
          transition: 'width 0.9s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, width: 24, textAlign: 'right', color }}>{puan}</span>
    </div>
  );
}

/* ── Skeleton satırı ── */
function SkeletonBar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
      <div style={{ width: 78, height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
      <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.07)' }} />
      <div style={{ width: 20, height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.07)' }} />
    </div>
  );
}

const STROKE_LEN = 2 * Math.PI * 85; // ≈534

/* ══════════════════════════════════════════════════════════════
   Ana Bileşen
══════════════════════════════════════════════════════════════ */
export function StaffPersonalDashboard({
  userName,
  userId,
  accessToken,
  onLogout = () => {},
  onNavigate = () => {},
}: StaffPersonalDashboardProps) {

  const [perf, setPerf] = useState<MyPerf | null>(null);
  const [perfLoading, setPerfLoading] = useState(true);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [trendData, setTrendData] = useState<TrendMonth[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [rotasyonTasks, setRotasyonTasks] = useState<any[]>([]);
  const [rotasyonLoading, setRotasyonLoading] = useState(true);

  const now = new Date();
  const monthName = now.toLocaleString('tr-TR', { month: 'long' });
  const year = now.getFullYear();

  /* ── 1. Offline kuyruk (senkron, localStorage) ── */
  useEffect(() => {
    if (!userId) return;
    const sales = getUserQueue(userId);
    const frames = getUserFrameQueue(userId);
    setOfflineCount(sales.length + frames.length);
  }, [userId]);

  /* ── 2. Leaderboard verisi ── */
  const fetchLeaderboard = useCallback(async () => {
    if (!userId) { setPerfLoading(false); return; }
    setPerfLoading(true);
    try {
      const token = accessToken || await getToken();
      const { baslangic, bitis, periodKey } = getMonthDates();
      const params = new URLSearchParams({ baslangic, bitis, periodKey });
      const res = await fetch(`${API_BASE}/leaderboard/performans?${params}`, {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[StaffDash] leaderboard error:', data.error);
        return;
      }
      const personeller: any[] = data.personeller || [];
      const me = personeller.find((p: any) => p.id === userId);
      if (me) {
        const avgIskontoOran =
          me.ham.brutCiro > 0
            ? (me.ham.iskonto / me.ham.brutCiro) * 100
            : 0;
        setPerf({
          sira: me.sira,
          toplamPersonel: personeller.length,
          toplamSkor: me.toplamSkor,
          iskontoPuan: me.metrikler.iskontoPuan,
          ortSatisPuan: me.metrikler.ortSatisPuan,
          mekanKatkiPuan: me.metrikler.mekanKatkiPuan,
          anomaliPuan: me.metrikler.anomaliPuan,
          karePuan: me.metrikler.karePuan,
          avgIskontoOran,
        });
      } else {
        setPerf(null); // bu ay henüz veri yok
      }
    } catch (e) {
      console.error('[StaffDash] leaderboard fetch error:', e);
    } finally {
      setPerfLoading(false);
    }
  }, [userId, accessToken]);

  /* ── 2b. Sıralama Trendi (son 3 ay) ── */
  const fetchTrend = useCallback(async () => {
    if (!userId) { setTrendLoading(false); return; }
    setTrendLoading(true);
    try {
      const token = accessToken || await getToken();
      const months = getLast3Months();
      const results = await Promise.all(
        months.map(async (mo) => {
          try {
            const params = new URLSearchParams({ baslangic: mo.baslangic, bitis: mo.bitis, periodKey: mo.periodKey });
            const res = await fetch(`${API_BASE}/leaderboard/performans?${params}`, { headers: buildHeaders(token) });
            if (!res.ok) return { ...mo, sira: null, toplamPersonel: 0 };
            const data = await res.json();
            const personeller: any[] = data.personeller || [];
            const me = personeller.find((p: any) => p.id === userId);
            return { periodKey: mo.periodKey, monthShort: mo.monthShort, isCurrent: mo.isCurrent, sira: me?.sira ?? null, toplamPersonel: personeller.length };
          } catch {
            return { periodKey: mo.periodKey, monthShort: mo.monthShort, isCurrent: mo.isCurrent, sira: null, toplamPersonel: 0 };
          }
        })
      );
      setTrendData(results);
    } catch (e) {
      console.error('[StaffDash] trend fetch error:', e);
    } finally {
      setTrendLoading(false);
    }
  }, [userId, accessToken]);

  /* ── 3. Son duyuru ── */
  const fetchAnnouncement = useCallback(async () => {
    try {
      const token = accessToken || await getToken();
      const res = await fetch(`${API_BASE}/announcements`, {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) return;
      const list: Announcement[] = data.announcements || [];
      if (list.length === 0) return;
      const pOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const tOrder: Record<string, number> = { pinned: 3, info: 2, temporary: 1 };
      const sorted = [...list].sort((a, b) => {
        const t = (tOrder[b.type] ?? 0) - (tOrder[a.type] ?? 0);
        if (t !== 0) return t;
        return (pOrder[b.priority] ?? 0) - (pOrder[a.priority] ?? 0);
      });
      setAnnouncement(sorted[0]);
    } catch (e) {
      console.error('[StaffDash] announcement fetch error:', e);
    }
  }, [accessToken]);

  /* ── 4. Rotasyon Görevleri (bugün + bu kullanıcı) ── */
  const fetchRotasyon = useCallback(async () => {
    if (!userId) { setRotasyonLoading(false); return; }
    setRotasyonLoading(true);
    try {
      const token = accessToken || await getToken();
      const res = await fetch(`${API_BASE}/rotasyon/gorevler`, { headers: buildHeaders(token) });
      if (!res.ok) { console.error('[StaffDash] rotasyon error:', res.status); return; }
      const data = await res.json();
      const tasks: any[] = data.tasks || [];
      // Sadece bu kullanıcıya atanmış görevler
      const myTasks = tasks.filter((t: any) =>
        Array.isArray(t.personnel) && t.personnel.some((p: any) => p.id === userId)
        && ['sent', 'revised'].includes(t.status)
      );
      setRotasyonTasks(myTasks);
    } catch (e) {
      console.error('[StaffDash] rotasyon fetch error:', e);
    } finally {
      setRotasyonLoading(false);
    }
  }, [userId, accessToken]);

  useEffect(() => {
    fetchLeaderboard();
    fetchAnnouncement();
    fetchTrend();
  }, [fetchLeaderboard, fetchAnnouncement, fetchTrend]);

  useEffect(() => { fetchRotasyon(); }, [fetchRotasyon]);

  /* ── Performans etiketi ── */
  const skor = perf?.toplamSkor ?? 0;
  const perfLabel =
    skor >= 90 ? { text: 'Mükemmel', emoji: '🏆', color: '#ffd4a3' } :
    skor >= 75 ? { text: 'Harika',   emoji: '⭐', color: '#9dd9ea' } :
    skor >= 60 ? { text: 'İyi',      emoji: '👍', color: '#a8e6cf' } :
                 { text: 'Gelişiyor', emoji: '📈', color: '#c084fc' };

  /* ── Duyuru rengi ── */
  const annColor =
    announcement?.priority === 'high'   ? '#f87171' :
    announcement?.priority === 'medium' ? '#ffd4a3' : '#9dd9ea';

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <div
      className="min-h-screen pb-32 relative overflow-x-hidden"
      style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}
    >
      {/* Arka plan glow blob'ları */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'rgba(168,85,247,0.10)' }} />
        <div className="absolute top-1/3 -right-24 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'rgba(157,217,234,0.08)' }} />
        <div className="absolute bottom-1/4 left-1/4 w-56 h-56 rounded-full blur-3xl"
          style={{ background: 'rgba(192,132,252,0.08)' }} />
      </div>

      {/* ══════════════════════════════════════════
          HOŞGELDIN KARTI
      ══════════════════════════════════════════ */}
      <div style={{ padding: '20px 20px 16px', position: 'relative', zIndex: 10 }}>
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
        }}>
          {/* İç parıltı */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(135deg,rgba(167,139,250,0.10),transparent,rgba(157,217,234,0.08))',
          }} />
          {/* Üst ince çizgi */}
          <div style={{
            position: 'absolute', top: 0, left: 32, right: 32, height: 1,
            background: 'linear-gradient(to right,transparent,rgba(255,255,255,0.30),transparent)',
          }} />

          <div style={{ position: 'relative', padding: 20 }}>
            {/* Avatar + İsim */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: 'linear-gradient(135deg,#7c3aed,#22d3ee)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                  boxShadow: '0 8px 24px rgba(124,58,237,0.30)',
                  border: '1px solid rgba(255,255,255,0.20)',
                }}>😊</div>
                <div style={{
                  position: 'absolute', bottom: -4, right: -4,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#34d399', border: '2px solid #0a051e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 18, fontWeight: 900, color: 'white', lineHeight: 1.2, margin: 0 }}>
                  Merhaba, {userName}! 👋
                </h1>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2, marginBottom: 0 }}>
                  {monthName} {year} performansın
                </p>
              </div>
              <div style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: 12,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Flame style={{ width: 16, height: 16, color: '#fb923c' }} />
              </div>
            </div>

            {/* ── 3 Mini Kart ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>

              {/* Kart 1 — Liderboard Sırası */}
              <div style={{
                position: 'relative', overflow: 'hidden', borderRadius: 16,
                border: '1px solid rgba(255,212,163,0.22)',
                background: 'rgba(255,212,163,0.08)', padding: 12, textAlign: 'center',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 48, height: 1, background: 'rgba(255,212,163,0.40)',
                }} />
                <Trophy style={{ width: 16, height: 16, color: '#ffd4a3', margin: '0 auto 6px' }} />
                {perfLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 24 }}>
                    <Loader2 style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.25)', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'white', lineHeight: 1 }}>
                    {perf ? `#${perf.sira}` : '—'}
                  </div>
                )}
                <div style={{
                  fontSize: 9, color: 'rgba(255,212,163,0.75)', fontWeight: 600,
                  marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {perf && !perfLoading ? `/ ${perf.toplamPersonel} kişi` : 'Sıralama'}
                </div>
              </div>

              {/* Kart 2 — Aylık İskonto Ortalaması */}
              <div style={{
                position: 'relative', overflow: 'hidden', borderRadius: 16,
                border: '1px solid rgba(157,217,234,0.22)',
                background: 'rgba(157,217,234,0.08)', padding: 12, textAlign: 'center',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 48, height: 1, background: 'rgba(157,217,234,0.40)',
                }} />
                <Percent style={{ width: 16, height: 16, color: '#9dd9ea', margin: '0 auto 6px' }} />
                {perfLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 24 }}>
                    <Loader2 style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.25)', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'white', lineHeight: 1 }}>
                    {perf ? `%${perf.avgIskontoOran.toFixed(1)}` : '—'}
                  </div>
                )}
                <div style={{
                  fontSize: 9, color: 'rgba(157,217,234,0.75)', fontWeight: 600,
                  marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>İskonto Ort.</div>
              </div>

              {/* Kart 3 — Offline Kuyruk */}
              <div style={{
                position: 'relative', overflow: 'hidden', borderRadius: 16,
                border: offlineCount > 0
                  ? '1px solid rgba(251,146,60,0.30)'
                  : '1px solid rgba(52,211,153,0.22)',
                background: offlineCount > 0
                  ? 'rgba(251,146,60,0.08)'
                  : 'rgba(52,211,153,0.08)',
                padding: 12, textAlign: 'center',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 48, height: 1,
                  background: offlineCount > 0 ? 'rgba(251,146,60,0.40)' : 'rgba(52,211,153,0.40)',
                }} />
                <WifiOff style={{
                  width: 16, height: 16,
                  color: offlineCount > 0 ? '#fb923c' : '#34d399',
                  margin: '0 auto 6px',
                }} />
                <div style={{ fontSize: 20, fontWeight: 900, color: 'white', lineHeight: 1 }}>
                  {offlineCount > 0 ? offlineCount : '✓'}
                </div>
                <div style={{
                  fontSize: 9,
                  color: offlineCount > 0 ? 'rgba(251,146,60,0.75)' : 'rgba(52,211,153,0.75)',
                  fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {offlineCount > 0 ? 'Bekliyor' : 'Temiz'}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          ANLAK DURUM (Vardiya Check-in)
      ══════════════════════════════════════════ */}
      <div style={{ padding: '0 20px 16px', position: 'relative', zIndex: 10 }}>
        <ShiftCheckInCard
          userId={userId}
          userName={userName}
          accessToken={accessToken}
          tasks={rotasyonTasks}
          tasksLoading={rotasyonLoading}
        />
      </div>

      {/* ══════════════════════════════════════════
          AYLIK LIDERBOARD PERFORMANSI
      ══════════════════════════════════════════ */}
      <div style={{ padding: '0 20px 16px', position: 'relative', zIndex: 10 }}>
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(135deg,rgba(192,132,252,0.08),transparent,rgba(167,139,250,0.08))',
          }} />
          <div style={{
            position: 'absolute', top: 0, left: 32, right: 32, height: 1,
            background: 'linear-gradient(to right,transparent,rgba(255,255,255,0.25),transparent)',
          }} />

          <div style={{ position: 'relative', padding: 20 }}>
            {/* Başlık */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg,rgba(167,139,250,0.40),rgba(192,132,252,0.30))',
                border: '1px solid rgba(167,139,250,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(167,139,250,0.20)',
              }}>
                <Award style={{ width: 20, height: 20, color: '#c084fc' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 14, fontWeight: 900, color: 'white', margin: 0 }}>Aylık Performans</h2>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: 0 }}>
                  {monthName} {year} · Liderboard Verisi
                </p>
              </div>
              {/* Sıra Badge */}
              {perf && !perfLoading && (
                <div style={{
                  flexShrink: 0, borderRadius: 10,
                  background: 'rgba(255,212,163,0.12)',
                  border: '1px solid rgba(255,212,163,0.25)',
                  padding: '4px 10px',
                  fontSize: 11, fontWeight: 800, color: '#ffd4a3',
                }}>
                  #{perf.sira}&nbsp;/&nbsp;{perf.toplamPersonel}
                </div>
              )}
            </div>

            {/* ── İçerik: Yükleniyor ── */}
            {perfLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', gap: 12 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#a78bfa', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>Performans yükleniyor…</span>
                {/* Skeleton barlar */}
                <div style={{ width: '100%', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1,2,3,4].map(i => <SkeletonBar key={i} />)}
                </div>
              </div>
            )}

            {/* ── İçerik: Veri Yok ── */}
            {!perfLoading && perf === null && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '28px 0', gap: 8, textAlign: 'center',
              }}>
                <span style={{ fontSize: 36 }}>📊</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                  Bu ay henüz liderboard verisi yok.
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  İlk satışını yaptıktan sonra burada görünecek.
                </span>
              </div>
            )}

            {/* ── İçerik: Çember + Barlar ── */}
            {!perfLoading && perf !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* SVG Çember Halkası */}
                <div style={{ position: 'relative', flexShrink: 0, width: 144, height: 144 }}>
                  <svg
                    style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
                    viewBox="0 0 200 200"
                  >
                    <defs>
                      <linearGradient id="perfGradStaff" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%"   stopColor="#a78bfa" />
                        <stop offset="50%"  stopColor="#9dd9ea" />
                        <stop offset="100%" stopColor="#a8e6cf" />
                      </linearGradient>
                      <filter id="glowStaff">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Arka halka */}
                    <circle
                      cx="100" cy="100" r="85"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="16" fill="none"
                    />
                    {/* İlerleme halkası */}
                    <circle
                      cx="100" cy="100" r="85"
                      stroke="url(#perfGradStaff)"
                      strokeWidth="16" fill="none"
                      strokeDasharray={`${(skor / 100) * STROKE_LEN} ${STROKE_LEN}`}
                      strokeLinecap="round"
                      filter="url(#glowStaff)"
                      style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }}
                    />
                  </svg>
                  {/* Merkez */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'white', lineHeight: 1 }}>{skor}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: 600 }}>/ 100</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: perfLabel.color }}>
                      {perfLabel.emoji} {perfLabel.text}
                    </div>
                  </div>
                </div>

                {/* 5 Metrik Barı */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <MetrikBar label="İskonto Dis." puan={perf.iskontoPuan}    color="#ffd4a3" icon={Tag} />
                  <MetrikBar label="Ort. Satış"   puan={perf.ortSatisPuan}   color="#9dd9ea" icon={TrendingUp} />
                  <MetrikBar label="Mekan Katkı"  puan={perf.mekanKatkiPuan} color="#a7c7e7" icon={MapPin} />
                  <MetrikBar label="Anomali"      puan={perf.anomaliPuan}    color="#a8e6cf" icon={ShieldCheck} />
                  <MetrikBar label="Kare Perf."   puan={perf.karePuan}       color="#d4b5f7" icon={Camera} />
                </div>
              </div>
            )}

            {/* ── Sıralama Trendi ── */}
            {(trendLoading || trendData.length > 0) && (
              <div style={{ marginTop: 20 }}>
                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  <span style={{
                    fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.30)',
                    textTransform: 'uppercase', letterSpacing: '0.10em',
                  }}>Sıralama Trendi</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                </div>

                {trendLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                    <Loader2 style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.25)', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <>
                    {/* Büyük Sayılar Şeridi */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                      {trendData.map((mo, idx) => {
                        const prev = idx > 0 ? trendData[idx - 1] : null;
                        let arrowEl: ReactNode = null;
                        if (prev) {
                          const improved = mo.sira !== null && prev.sira !== null && mo.sira < prev.sira;
                          const worsened = mo.sira !== null && prev.sira !== null && mo.sira > prev.sira;
                          const diff = mo.sira !== null && prev.sira !== null ? Math.abs(mo.sira - prev.sira) : null;
                          arrowEl = (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4px', marginTop: -8 }}>
                              {improved ? (
                                <ArrowUp style={{ width: 14, height: 14, color: '#4ade80' }} />
                              ) : worsened ? (
                                <ArrowDown style={{ width: 14, height: 14, color: '#f87171' }} />
                              ) : (
                                <Minus style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.25)' }} />
                              )}
                              {diff !== null && (
                                <span style={{
                                  fontSize: 8, fontWeight: 700, marginTop: 1,
                                  color: improved ? '#4ade80' : worsened ? '#f87171' : 'rgba(255,255,255,0.25)',
                                }}>{improved ? `-${diff}` : worsened ? `+${diff}` : '='}</span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div key={mo.periodKey} style={{ display: 'flex', alignItems: 'center' }}>
                            {arrowEl}
                            <div style={{ textAlign: 'center', minWidth: 68 }}>
                              {/* Ay adı */}
                              <div style={{
                                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
                              }}>
                                {mo.monthShort}
                                {mo.isCurrent && (
                                  <span style={{
                                    marginLeft: 4, fontSize: 8,
                                    color: '#a78bfa', fontWeight: 900,
                                  }}>● bu ay</span>
                                )}
                              </div>
                              {/* Büyük sıra numarası */}
                              <div style={{
                                fontSize: mo.sira !== null ? 34 : 26,
                                fontWeight: 900,
                                color: mo.sira !== null ? rankColor(mo.sira) : 'rgba(255,255,255,0.20)',
                                lineHeight: 1,
                                textShadow: mo.sira !== null && mo.sira <= 3
                                  ? `0 0 20px ${rankColor(mo.sira)}66`
                                  : 'none',
                                transition: 'color 0.4s',
                              }}>
                                {mo.sira !== null ? `#${mo.sira}` : '—'}
                              </div>
                              {/* Kaçıncı / toplam */}
                              <div style={{
                                fontSize: 9, color: 'rgba(255,255,255,0.22)', marginTop: 3,
                              }}>
                                {mo.sira !== null && mo.toplamPersonel > 0 ? `/ ${mo.toplamPersonel}` : 'veri yok'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mini Sparkline */}
                    {trendData.some(d => d.sira !== null) && (
                      <div style={{ marginTop: 14, height: 44 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={trendData.map(d => ({ ...d, rankVal: d.sira }))}
                            margin={{ top: 6, right: 12, left: 12, bottom: 6 }}
                          >
                            <defs>
                              <linearGradient id="trendLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f87171" />
                                <stop offset="50%" stopColor="#ffd4a3" />
                                <stop offset="100%" stopColor="#4ade80" />
                              </linearGradient>
                            </defs>
                            <Tooltip content={<SparkTooltip />} />
                            <Line
                              type="monotone"
                              dataKey="rankVal"
                              stroke="url(#trendLineGrad)"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#1a0a3c', stroke: '#a78bfa', strokeWidth: 2 }}
                              activeDot={{ r: 5, fill: '#a78bfa', stroke: 'white', strokeWidth: 1.5 }}
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '0 12px',
                          fontSize: 8, color: 'rgba(255,255,255,0.20)', fontWeight: 600,
                        }}>
                          <span>Kötü (#yüksek)</span>
                          <span>İyi (#düşük)</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          DÖVİZ WİDGET
      ══════════════════════════════════════════ */}
      <div style={{ padding: '0 20px 16px', position: 'relative', zIndex: 10 }}>
        <CurrencyWidget />
      </div>

      {/* ══════════════════════════════════════════
          SON DUYURU (API'den gerçek veri)
      ══════════════════════════════════════════ */}
      {announcement && (
        <div style={{ padding: '0 20px 16px', position: 'relative', zIndex: 10 }}>
          {/* Bölüm başlığı */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          }}>
            <span style={{
              width: 4, height: 16, borderRadius: 9999,
              background: `linear-gradient(to bottom,${annColor},${annColor}55)`,
              display: 'inline-block', flexShrink: 0,
            }} />
            <h3 style={{
              fontSize: 11, fontWeight: 900, color: 'white',
              textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
            }}>Son Duyuru</h3>
            {/* Öncelik rozeti */}
            <span style={{
              marginLeft: 'auto',
              fontSize: 9, fontWeight: 800,
              color: annColor,
              background: `${annColor}18`,
              border: `1px solid ${annColor}35`,
              borderRadius: 6, padding: '2px 7px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {announcement.priority === 'high' ? '🔴 Öncelikli' :
               announcement.priority === 'medium' ? '🟡 Normal' : '🔵 Bilgi'}
            </span>
          </div>

          <div style={{
            position: 'relative', overflow: 'hidden', borderRadius: 20,
            border: `1px solid ${annColor}40`,
            background: `linear-gradient(135deg,${annColor}12,${annColor}06,rgba(255,255,255,0.04))`,
            backdropFilter: 'blur(20px)',
            boxShadow: `0 4px 24px ${annColor}18, inset 0 1px 0 ${annColor}20`,
            padding: 18,
          }}>
            {/* Üst parlama çizgisi */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1,
              background: `linear-gradient(to right,transparent,${annColor}60,transparent)`,
            }} />
            {/* Sol kenar aksanı */}
            <div style={{
              position: 'absolute', top: 12, bottom: 12, left: 0, width: 3,
              borderRadius: '0 3px 3px 0',
              background: `linear-gradient(to bottom,${annColor},${annColor}44)`,
            }} />
            {/* Arka plan glow */}
            <div style={{
              position: 'absolute', top: -20, right: -20, width: 80, height: 80,
              borderRadius: '50%', background: `${annColor}10`, filter: 'blur(20px)',
              pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {/* İkon kutusu */}
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: `${annColor}20`,
                border: `1.5px solid ${annColor}45`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 4px 12px ${annColor}20`,
              }}>
                <Megaphone style={{ width: 20, height: 20, color: annColor }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{
                  fontSize: 14, fontWeight: 800, color: 'white',
                  margin: '0 0 5px 0', lineHeight: 1.3,
                }}>
                  {announcement.title}
                </h4>
                <p style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.60)',
                  lineHeight: 1.55, margin: '0 0 12px 0',
                }}>
                  {announcement.message.length > 130
                    ? `${announcement.message.slice(0, 130)}…`
                    : announcement.message}
                </p>
                {/* Alt çizgi + buton */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: `1px solid ${annColor}20`,
                }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
                    {new Date(announcement.createdAt).toLocaleDateString('tr-TR', {
                      day: 'numeric', month: 'long',
                    })}
                  </span>
                  <button
                    onClick={() => onNavigate('announcements')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 800,
                      color: annColor,
                      background: `${annColor}15`,
                      border: `1px solid ${annColor}30`,
                      borderRadius: 8, padding: '5px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    Tüm Duyurular <ChevronRight style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          HIZLI ERİŞİM
      ══════════════════════════════════════════ */}
      <div style={{ padding: '0 20px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', marginBottom: 12,
        }}>
          <h3 style={{
            fontSize: 11, fontWeight: 900, color: 'white',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 8, margin: 0,
          }}>
            <span style={{
              width: 4, height: 16, borderRadius: 9999,
              background: 'linear-gradient(to bottom,#a78bfa,#9dd9ea)',
              display: 'inline-block',
            }} />
            Hızlı Erişim
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Hızlı Satış */}
          <button
            onClick={() => onNavigate('quick-sales')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: 14, borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(157,217,234,0.15)',
              border: '1px solid rgba(157,217,234,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Zap style={{ width: 16, height: 16, color: '#9dd9ea' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Hızlı Satış</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>Yeni satış oluştur</div>
            </div>
            <ChevronRight style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.30)', flexShrink: 0 }} />
          </button>

          {/* Liderlik Tablosu */}
          <button
            onClick={() => onNavigate('leaderboard')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: 14, borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,212,163,0.15)',
              border: '1px solid rgba(255,212,163,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Star style={{ width: 16, height: 16, color: '#ffd4a3' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Liderlik Tablosu</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                {perf && !perfLoading
                  ? `Sıran: #${perf.sira} / ${perf.toplamPersonel}`
                  : 'Sıralamanı gör'}
              </div>
            </div>
            <ChevronRight style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.30)', flexShrink: 0 }} />
          </button>

          {/* Primlerim */}
          <button
            onClick={() => onNavigate('personel-prim-takip')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: 14, borderRadius: 16,
              border: '1px solid rgba(251,191,36,0.20)',
              background: 'rgba(251,191,36,0.07)',
              backdropFilter: 'blur(20px)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(251,191,36,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Trophy style={{ width: 16, height: 16, color: '#fbbf24' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Primlerim</div>
              <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.60)' }}>Kazançlarını ve alacaklarını gör</div>
            </div>
            <ChevronRight style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.30)', flexShrink: 0 }} />
          </button>
        </div>
      </div>
    </div>
  );
}