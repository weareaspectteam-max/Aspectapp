import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Users, Package,
  MapPin, Zap, RotateCcw,
  BarChart3, AlertCircle, Activity, AlertTriangle, Clock,
} from 'lucide-react';

import { CurrencyWidget } from './currency-widget';
import { ShiftCheckInCard } from './shift-checkin-card';
import { authHeaders, ghostParams, buildHeaders, getToken, appendGhostParam } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/** İş günü tarihi: TR 00:00-04:59 → hâlâ önceki takvim günü (vardiya 05:00'da biter). */
function todayTR(): string {
  const trMs   = Date.now() + 3 * 60 * 60 * 1000;
  const trHour = new Date(trMs).getUTCHours();
  if (trHour < 7) return new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return new Date(trMs).toISOString().split('T')[0];
}

/* ── Glassmorphism — yönetici ile aynı ── */
const glass = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         20,
} as React.CSSProperties;

const COLORS = {
  orange:  '#fb923c',
  emerald: '#34d399',
  violet:  'var(--app-accent, #a855f7)',
  blue:    '#60a5fa',
  pink:    '#f472b6',
  yellow:  '#fbbf24',
  teal:    '#9dd9ea',
};

/* ── StatCard — yönetici ile aynı ── */
function StatCard({ title, value, change, icon, color, onClick }: {
  title: string; value: string; change?: number;
  icon: React.ReactNode; color: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full text-left transition-all active:scale-95"
      style={{
        ...glass,
        padding:   16,
        cursor:    onClick ? 'pointer' : 'default',
        boxShadow: `0 4px 24px ${color}15`,
        border:    `1px solid ${color}25`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="flex items-center justify-center"
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: `${color}20`,
            border:     `1px solid ${color}40`,
          }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
        {change !== undefined && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
            style={{
              background: change >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)',
              color:      change >= 0 ? '#34d399' : '#fb7185',
              border:     `1px solid ${change >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
            }}
          >
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>%{Math.abs(change)}</span>
          </div>
        )}
      </div>
      <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{title}</p>
      <p className="text-xl font-black text-white leading-none">{value}</p>
    </button>
  );
}

/* ── QuickAction — yönetici ile aynı ── */
function QuickAction({ label, icon, color, onClick }: {
  label: string; icon: React.ReactNode; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
      style={{
        ...glass,
        padding:   '14px 8px',
        border:    `1px solid ${color}30`,
        boxShadow: `0 4px 20px ${color}10`,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}20`,
          border: `1px solid ${color}40`,
        }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
    </button>
  );
}

interface StaffMember  { id: string; name: string; status: string; role?: string; }
interface Task         { id: string; date: string; location: string; status: string; personnel: { id: string; name: string }[]; }
interface Mekan        { id: string; name: string; emoji: string; }
interface StokOzet     { vardiyaDurumu: string; veriVar: boolean; name: string; emoji: string; }
interface LeaveRequest { id: string; status: string; staffName?: string; type?: string; }
interface DashboardSummary {
  aktifMekanSayisi?: number;
  toplamMekanSayisi?: number;
  aktifPersonelSayisi?: number;
  toplamPersonelSayisi?: number;
  aktifPersonelDetay?: Array<{ name: string; mekan?: string; checkinZamani?: string }>;
  anomaliSayisi?: number;
  gecGirisSayisi?: number;
}

interface Props { userName: string; userId?: string; accessToken?: string; onLogout: () => void; onNavigate: (tab: string) => void; }

export function OperationsDashboard({ userName, userId = '', accessToken = '', onNavigate }: Props) {
  const [staffMembers,  setStaffMembers]  = useState<StaffMember[]>([]);
  const [todayTasks,    setTodayTasks]    = useState<Task[]>([]);
  const [mekanlar,      setMekanlar]      = useState<Mekan[]>([]);
  const [stokOzetler,   setStokOzetler]   = useState<StokOzet[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [rotasyonTasks, setRotasyonTasks] = useState<any[]>([]);
  const [rotasyonLoading, setRotasyonLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [showAktifPersonel, setShowAktifPersonel] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const today   = todayTR();
      const [staffRes, tasksRes, mekanRes, stokRes, leaveRes, summaryRes] = await Promise.allSettled([
        fetch(`${SERVER}/rotasyon/personel${ghostParams()}`,        { headers }),
        fetch(`${SERVER}/rotasyon/gorevler${ghostParams()}`,        { headers }),
        fetch(`${SERVER}/mekanlar${ghostParams()}`,                 { headers }),
        fetch(`${SERVER}/stok/genel-durum${ghostParams()}`,         { headers }),
        fetch(`${SERVER}/rotasyon/izinler${ghostParams()}`,         { headers }),
        fetch(`${SERVER}/manager/dashboard-summary${ghostParams()}`, { headers }),
      ]);
      if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
        const d = await staffRes.value.json();
        setStaffMembers(d.staffMembers || []);
      }
      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const d = await tasksRes.value.json();
        setTodayTasks(((d.tasks || []) as Task[]).filter(t => t.date === today && t.status !== 'cancelled'));
      }
      if (mekanRes.status === 'fulfilled' && mekanRes.value.ok) {
        const d = await mekanRes.value.json();
        setMekanlar(d.mekanlar || []);
      }
      if (stokRes.status === 'fulfilled' && stokRes.value.ok) {
        const d = await stokRes.value.json();
        setStokOzetler((d.mekanlar || []).map((m: any) => ({
          vardiyaDurumu: m.vardiyaDurumu,
          veriVar:       m.veriVar,
          name:          m.name,
          emoji:         m.emoji,
        })));
      }
      if (leaveRes.status === 'fulfilled' && leaveRes.value.ok) {
        const d = await leaveRes.value.json();
        setPendingLeaves((d.leaveRequests || []).filter((l: any) => l.status === 'pending'));
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const d = await summaryRes.value.json();
        setSummary(d);
      }
    } catch (e) {
      console.error('[OperationsDashboard] loadAll error:', e);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadAll]);

  /* ── Vardiya kartı için kendi rotasyon görevlerimi çek ── */
  const fetchMyRotasyon = useCallback(async () => {
    if (!userId) { setRotasyonLoading(false); return; }
    setRotasyonLoading(true);
    try {
      const token = accessToken || await getToken();
      const res = await fetch(appendGhostParam(`${SERVER}/rotasyon/gorevler`), { headers: buildHeaders(token) });
      if (!res.ok) { setRotasyonLoading(false); return; }
      const data = await res.json();
      const tasks: any[] = data.tasks || [];
      const myTasks = tasks.filter((t: any) =>
        Array.isArray(t.personnel) && t.personnel.some((p: any) => p.id === userId)
        && ['sent', 'revised'].includes(t.status)
      );
      setRotasyonTasks(myTasks);
    } catch (e) {
      console.error('[OpsDash] rotasyon fetch error:', e);
    } finally {
      setRotasyonLoading(false);
    }
  }, [userId, accessToken]);

  useEffect(() => { fetchMyRotasyon(); }, [fetchMyRotasyon]);

  /* ── Türetilen değerler ── */
  const acikVardiya     = stokOzetler.filter(m => m.vardiyaDurumu === 'acik').length;
  const kapanmisVardiya = stokOzetler.filter(m => m.vardiyaDurumu === 'kapandi').length;
  const anomali     = summary?.anomaliSayisi ?? 0;
  const hasAnomali  = anomali > 0;
  const gecGiris    = summary?.gecGirisSayisi ?? 0;
  const hasGecGiris = gecGiris > 0;

  /* ── Lokasyon dağılımı ── */
  const lokasyonDagilim = mekanlar.map(m => {
    const ozet = stokOzetler.find(o => o.name === m.name);
    const vd   = ozet?.vardiyaDurumu ?? 'yok';
    const renk =
      vd === 'kapandi' ? COLORS.emerald :
      vd === 'acik'    ? COLORS.teal    :
                         COLORS.violet;
    const deger =
      vd === 'kapandi' ? 100 :
      vd === 'acik'    ? 60  : 15;
    return { name: m.name, emoji: m.emoji, deger, renk, durum: vd === 'kapandi' ? 'Kapandı' : vd === 'acik' ? 'Açık' : 'Başlamadı' };
  });
  const totalLokasyon = mekanlar.length;

  /* ── Personel özet listesi ── */
  const aktifPersonel  = staffMembers.filter(s => s.status === 'active').slice(0, 4);
  const rankColors     = [COLORS.orange, COLORS.teal, COLORS.emerald, COLORS.blue];

  return (
    <div className="px-4 py-4 space-y-4">

      {/* ── Başlık — yönetici ile aynı stil ── */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-black text-white">Operasyon</h1>
          <span className="text-xl">⚡</span>
        </div>
        <p className="text-xs font-medium" style={{ color: 'rgba(251,146,60,0.55)' }}>
          Tüm operasyonların canlı özeti · {new Date().toLocaleDateString('tr-TR')}
        </p>
      </div>

      {/* ── 4 Stat Kartı ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Aktif Mekan + Aktif Personel combo */}
        <div style={{ ...glass, padding: 0, border: '1px solid rgba(168,230,207,0.25)', boxShadow: '0 4px 24px rgba(168,230,207,0.08)', display: 'flex' }}>
          <button onClick={() => onNavigate('quick-sales')} className="text-left transition-all active:scale-95" style={{ flex: 1, padding: 12, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(168,230,207,0.15)', border: '1px solid rgba(168,230,207,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <MapPin className="w-3.5 h-3.5" style={{ color: '#a8e6cf' }} />
            </div>
            <p className="text-[9px] font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Aktif Mekan</p>
            <p className="text-base font-black text-white leading-none">{summary?.aktifMekanSayisi ?? 0}</p>
            <p className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>/ {summary?.toplamMekanSayisi ?? 0} toplam</p>
          </button>
          <div style={{ width: 1, background: 'rgba(168,230,207,0.15)', margin: '10px 0' }} />
          <button onClick={() => setShowAktifPersonel(!showAktifPersonel)} className="text-left transition-all active:scale-95" style={{ flex: 1, padding: 12, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Users className="w-3.5 h-3.5" style={{ color: '#9dd9ea' }} />
            </div>
            <p className="text-[9px] font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Aktif Personel</p>
            <p className="text-base font-black text-white leading-none">{summary?.aktifPersonelSayisi ?? 0}</p>
            <p className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>/ {summary?.toplamPersonelSayisi ?? 0} toplam</p>
          </button>
        </div>

        {/* Anomali + Geç Giriş combo */}
        <div style={{ ...glass, padding: 0, border: hasAnomali ? '1px solid rgba(248,113,113,0.3)' : hasGecGiris ? '1px solid rgba(255,180,50,0.3)' : '1px solid rgba(255,255,255,0.1)', display: 'flex' }}>
          <button onClick={() => onNavigate('anomali-panosu')} className="text-left transition-all active:scale-95" style={{ flex: 1, padding: 12, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: hasAnomali ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${hasAnomali ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: hasAnomali ? '#f87171' : 'rgba(255,255,255,0.3)' }} />
            </div>
            <p className="text-[9px] font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Anomali</p>
            <p className="text-base font-black leading-none" style={{ color: hasAnomali ? '#f87171' : 'white' }}>{anomali}</p>
            <p className="text-[8px] mt-0.5" style={{ color: hasAnomali ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.3)' }}>
              {hasAnomali ? 'detay →' : 'anomali yok'}
            </p>
          </button>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
          <button onClick={() => onNavigate('vardiya-istatistikleri')} className="text-left transition-all active:scale-95" style={{ flex: 1, padding: 12, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: hasGecGiris ? 'rgba(255,180,50,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${hasGecGiris ? 'rgba(255,180,50,0.4)' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Clock className="w-3.5 h-3.5" style={{ color: hasGecGiris ? '#fbbf24' : 'rgba(255,255,255,0.3)' }} />
            </div>
            <p className="text-[9px] font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Geç Giriş</p>
            <p className="text-base font-black leading-none" style={{ color: hasGecGiris ? '#fbbf24' : 'white' }}>{gecGiris}</p>
            <p className="text-[8px] mt-0.5" style={{ color: hasGecGiris ? 'rgba(255,180,50,0.6)' : 'rgba(255,255,255,0.3)' }}>
              {hasGecGiris ? 'detay →' : 'geç giriş yok'}
            </p>
          </button>
        </div>

        <StatCard
          title="Bekleyen İzin"
          value={`${pendingLeaves.length}`}
          icon={<AlertCircle className="w-5 h-5" />}
          color={pendingLeaves.length > 0 ? COLORS.yellow : COLORS.violet}
          onClick={() => onNavigate('rotation')}
        />
        <StatCard
          title="Vardiya"
          value={`${acikVardiya} açık / ${kapanmisVardiya} kapandı`}
          icon={<Activity className="w-5 h-5" />}
          color={COLORS.teal}
          onClick={() => onNavigate('stock-distribution')}
        />
      </div>

      {/* ── Döviz Widget ── */}
      <CurrencyWidget />

      {/* ── Vardiya Başlat Kartı ── */}
      {userId && (
        <ShiftCheckInCard
          userId={userId}
          userName={userName}
          accessToken={accessToken}
          tasks={rotasyonTasks}
          tasksLoading={rotasyonLoading}
        />
      )}

      {/* ── Lokasyon Dağılımı (albüm dağılımı gibi) ── */}
      {lokasyonDagilim.length > 0 && (
        <div style={{ ...glass, padding: 16 }}>
          <p className="text-sm font-bold text-white mb-3">Lokasyon Durumu</p>
          <div className="space-y-2">
            {lokasyonDagilim.map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-base w-6 shrink-0 text-center">{item.emoji}</span>
                <span
                  className="text-xs font-semibold w-24 shrink-0 truncate"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  {item.name}
                </span>
                <div
                  className="flex-1 rounded-full overflow-hidden"
                  style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${item.deger}%`, background: item.renk }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold w-16 text-right shrink-0"
                  style={{ color: item.renk }}
                >
                  {item.durum}
                </span>
              </div>
            ))}
          </div>
          <div
            className="flex justify-between items-center mt-3 pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Toplam Lokasyon</span>
            <span className="text-sm font-black text-white">{totalLokasyon}</span>
          </div>
        </div>
      )}

      {/* ── Aktif Personel (top performers gibi) ── */}
      <div style={{ ...glass, padding: 16 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">👥 Aktif Personel</p>
          <button
            onClick={() => onNavigate('rotation')}
            className="text-xs font-bold transition-opacity active:opacity-60"
            style={{ color: COLORS.orange }}
          >
            Rotasyona Git
          </button>
        </div>

        {aktifPersonel.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Aktif personel bulunamadı
          </p>
        ) : (
          <div className="space-y-2">
            {aktifPersonel.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3"
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="flex items-center justify-center text-xs font-black shrink-0"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${rankColors[i] ?? COLORS.violet}20`,
                    border:     `1px solid ${rankColors[i] ?? COLORS.violet}50`,
                    color:       rankColors[i] ?? COLORS.violet,
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{p.name}</p>
                  <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {p.role || 'Personel'}
                  </p>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: `${COLORS.emerald}15`, color: COLORS.emerald }}
                >
                  Aktif
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Hızlı İşlemler — yönetici ile aynı ── */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(251,146,60,0.5)' }}>
          Hızlı İşlemler
        </p>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction label="Rotasyon"    icon={<RotateCcw className="w-4 h-4" />}  color={COLORS.orange}  onClick={() => onNavigate('rotation')}          />
          <QuickAction label="Hızlı Satış" icon={<Zap className="w-4 h-4" />}        color={COLORS.emerald} onClick={() => onNavigate('quick-sales')}        />
          <QuickAction label="Stok"        icon={<Package className="w-4 h-4" />}     color={COLORS.teal}    onClick={() => onNavigate('stock-distribution')} />
          <QuickAction label="Malzeme"     icon={<BarChart3 className="w-4 h-4" />}   color={COLORS.violet}  onClick={() => onNavigate('equipment-page')}    />
        </div>
      </div>

      {/* Aktif Personel Modal */}
      {showAktifPersonel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowAktifPersonel(false)}>
          <div className="w-full max-w-sm bg-[#1a1a2e] rounded-3xl border border-white/10 shadow-2xl max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: '#9dd9ea' }} />
                <h3 className="text-base font-bold text-white">Aktif Personel</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(157,217,234,0.15)', color: '#9dd9ea' }}>{summary?.aktifPersonelSayisi ?? 0} / {summary?.toplamPersonelSayisi ?? 0}</span>
              </div>
              <button onClick={() => setShowAktifPersonel(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <span className="text-white/50 text-sm">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {(summary?.aktifPersonelDetay?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">😴</p>
                  <p className="text-sm text-white/40">Şu an aktif personel yok</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {summary!.aktifPersonelDetay!.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-3 rounded-xl" style={{ background: 'rgba(157,217,234,0.06)', border: '1px solid rgba(157,217,234,0.12)' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#9dd9ea]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">👤</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                          {p.mekan && <p className="text-[10px] text-[#a8e6cf]">📍 {p.mekan}</p>}
                        </div>
                      </div>
                      {p.checkinZamani && (
                        <span className="text-[10px] text-white/30 flex-shrink-0">
                          🕐 {new Date(p.checkinZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}