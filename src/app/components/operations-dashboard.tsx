/**
 * OperationsDashboard — Operasyon rolü ana ekranı.
 * Admin dashboard ile aynı glassmorphism stili, aynı kart yapısı.
 * Accent: #fb923c (orange)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Package, MapPin, TrendingUp, TrendingDown,
  RotateCcw, Activity, Zap, BarChart3,
  AlertTriangle, CalendarDays, ClipboardList, RefreshCw,
} from 'lucide-react';
import { CurrencyWidget } from './currency-widget';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/* ── Türkiye saati YYYY-MM-DD ── */
function todayTR(): string {
  const now = new Date();
  const tr  = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return tr.toISOString().split('T')[0];
}

/* ── Glassmorphism kart stili (admin ile birebir aynı) ── */
const glass = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         20,
} as React.CSSProperties;

/* ── Renk sistemi ── */
const COLORS = {
  orange:  '#fb923c',
  emerald: '#34d399',
  violet:  '#a855f7',
  blue:    '#60a5fa',
  pink:    '#f472b6',
  yellow:  '#fbbf24',
  teal:    '#9dd9ea',
};

/* ── Stat Kartı (admin'deki ile aynı yapı) ── */
interface StatCardProps {
  title:    string;
  value:    string;
  change?:  number;
  icon:     React.ReactNode;
  color:    string;
  onClick?: () => void;
}

function StatCard({ title, value, change, icon, color, onClick }: StatCardProps) {
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
        {/* İkon dairesi */}
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

        {/* Trend badge */}
        {change !== undefined && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
            style={{
              background: change >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)',
              color:      change >= 0 ? '#34d399' : '#fb7185',
              border:     `1px solid ${change >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
            }}
          >
            {change >= 0
              ? <TrendingUp  className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
            }
            <span>%{Math.abs(change)}</span>
          </div>
        )}
      </div>

      <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {title}
      </p>
      <p className="text-xl font-black text-white leading-none">{value}</p>
    </button>
  );
}

/* ── Hızlı Aksiyon butonu (admin ile aynı) ── */
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
      <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {label}
      </span>
    </button>
  );
}

/* ── Props ── */
interface Props {
  userName:   string;
  onLogout:   () => void;
  onNavigate: (tab: string) => void;
}

interface StaffMember  { id: string; name: string; status: string; }
interface Task         { id: string; date: string; location: string; status: string; personnel: { id: string; name: string }[]; }
interface Mekan        { id: string; name: string; emoji: string; }
interface StokOzet     { vardiyaDurumu: string; veriVar: boolean; name: string; emoji: string; }
interface LeaveRequest { id: string; status: string; }

export function OperationsDashboard({ userName, onNavigate }: Props) {
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [staffMembers,  setStaffMembers]  = useState<StaffMember[]>([]);
  const [todayTasks,    setTodayTasks]    = useState<Task[]>([]);
  const [mekanlar,      setMekanlar]      = useState<Mekan[]>([]);
  const [stokOzetler,   setStokOzetler]   = useState<StokOzet[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [todaySales,    setTodaySales]    = useState<{ ciro: number; satis: number } | null>(null);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);
    try {
      const headers = await authHeaders();
      const today   = todayTR();

      const [staffRes, tasksRes, mekanRes, stokRes, leaveRes, canlıRes] = await Promise.allSettled([
        fetch(`${SERVER}/rotasyon/personel`,    { headers }),
        fetch(`${SERVER}/rotasyon/gorevler`,    { headers }),
        fetch(`${SERVER}/mekanlar`,             { headers }),
        fetch(`${SERVER}/stok/genel-durum`,     { headers }),
        fetch(`${SERVER}/rotasyon/izinler`,     { headers }),
        fetch(`${SERVER}/stok/canli-satis`,     { headers }),
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
      if (canlıRes.status === 'fulfilled' && canlıRes.value.ok) {
        const d     = await canlıRes.value.json();
        const sales = d.satislar || [];
        const ciro  = sales.reduce((s: number, x: any) => s + (Number(x.finalPrice) || 0), 0);
        setTodaySales({ ciro, satis: sales.length });
      }

      setLastUpdate(new Date());
    } catch (e) {
      console.error('[OperationsDashboard] loadAll error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const iv = setInterval(() => loadAll(true), 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadAll]);

  /* ── Türetilen metrikler ── */
  const activeStaff = staffMembers.filter(s => s.status === 'active').length;
  const totalStaff  = staffMembers.length;
  const totalMekan  = mekanlar.length;
  const activeMekan = stokOzetler.filter(m => m.vardiyaDurumu === 'acik' || m.vardiyaDurumu === 'kapandi').length;
  const stokPct     = totalMekan > 0
    ? Math.round((stokOzetler.filter(m => m.veriVar).length / totalMekan) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div
            className="w-10 h-10 rounded-full animate-spin mx-auto"
            style={{ border: `2px solid ${COLORS.orange}30`, borderTopColor: COLORS.orange }}
          />
          <p className="text-white/40 text-sm">Yükleniyor…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">

      {/* ── Sayfa başlığı ── */}
      <div className="pt-1 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-black text-white">Operasyon Paneli</h1>
            <span className="text-xl">⚡</span>
          </div>
          <p className="text-xs font-medium" style={{ color: 'rgba(251,146,60,0.55)' }}>
            {userName} · {new Date().toLocaleDateString('tr-TR')}
          </p>
        </div>

        {/* Yenile butonu */}
        <button
          onClick={() => loadAll(true)}
          disabled={refreshing}
          className="transition-all active:scale-90 mt-1"
          style={{ ...glass, padding: '8px 10px', borderRadius: 12 }}
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            style={{ color: 'rgba(255,255,255,0.45)' }}
          />
        </button>
      </div>

      {/* ── Son güncelleme ── */}
      {lastUpdate && (
        <div className="flex items-center gap-1.5 -mt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* ── İstatistik Kartları — 2×2 ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Aktif Personel"
          value={totalStaff > 0 ? `${activeStaff}/${totalStaff}` : '—'}
          icon={<Users className="w-5 h-5" />}
          color={COLORS.teal}
          onClick={() => onNavigate('rotation')}
        />
        <StatCard
          title="Stok Durumu"
          value={`%${stokPct}`}
          icon={<Package className="w-5 h-5" />}
          color={COLORS.orange}
          onClick={() => onNavigate('stock-distribution')}
        />
        <StatCard
          title="Aktif Lokasyon"
          value={totalMekan > 0 ? `${activeMekan}/${totalMekan}` : '—'}
          icon={<MapPin className="w-5 h-5" />}
          color={COLORS.emerald}
        />
        <StatCard
          title="Bugünkü Görev"
          value={`${todayTasks.length}`}
          icon={<ClipboardList className="w-5 h-5" />}
          color={COLORS.violet}
          onClick={() => onNavigate('rotation')}
        />
      </div>

      {/* ── Döviz Widget ── */}
      <CurrencyWidget />

      {/* ── Bekleyen İzin Uyarısı ── */}
      {pendingLeaves.length > 0 && (
        <div
          style={{
            ...glass,
            padding:   16,
            border:    '1px solid rgba(251,191,36,0.22)',
            boxShadow: '0 4px 20px rgba(251,191,36,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-bold text-white">Bekleyen İzin Talepleri</p>
            </div>
            <button
              onClick={() => onNavigate('rotation')}
              className="text-xs font-bold transition-opacity active:opacity-60"
              style={{ color: '#fbbf24' }}
            >
              İncele
            </button>
          </div>
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}
          >
            <span className="text-3xl font-black text-amber-300">{pendingLeaves.length}</span>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              talep onay bekliyor
            </span>
          </div>
        </div>
      )}

      {/* ── Bugünkü Görevler ── */}
      <div style={{ ...glass, padding: 16 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">Bugünkü Görevler</p>
          <button
            onClick={() => onNavigate('rotation')}
            className="text-xs font-bold transition-opacity active:opacity-60"
            style={{ color: COLORS.teal }}
          >
            Tümünü Gör
          </button>
        </div>

        {todayTasks.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CalendarDays className="w-7 h-7 mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Bugün için görev oluşturulmamış
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.slice(0, 5).map((task) => {
              const done = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: done ? COLORS.emerald : COLORS.teal }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{task.location}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {(task.personnel || []).length} personel
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={
                      done
                        ? { background: `${COLORS.emerald}15`, color: COLORS.emerald }
                        : { background: `${COLORS.teal}15`,    color: COLORS.teal    }
                    }
                  >
                    {done ? 'Tamamlandı' : 'Aktif'}
                  </span>
                </div>
              );
            })}
            {todayTasks.length > 5 && (
              <button
                onClick={() => onNavigate('rotation')}
                className="w-full text-center text-xs py-2 transition-opacity active:opacity-60"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                +{todayTasks.length - 5} daha göster
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Lokasyon Durumu ── */}
      {mekanlar.length > 0 && (
        <div style={{ ...glass, padding: 16 }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">Lokasyon Durumu</p>
            <button
              onClick={() => onNavigate('stock-distribution')}
              className="text-xs font-bold transition-opacity active:opacity-60"
              style={{ color: COLORS.orange }}
            >
              Detay
            </button>
          </div>
          <div className="space-y-2">
            {mekanlar.map((m) => {
              const ozet = stokOzetler.find(o => o.name === m.name);
              const vd   = ozet?.vardiyaDurumu ?? 'yok';
              const badge =
                vd === 'kapandi' ? { label: 'Kapandı',   color: COLORS.emerald } :
                vd === 'acik'    ? { label: 'Açık',      color: COLORS.teal    } :
                                   { label: 'Başlamadı', color: 'rgba(255,255,255,0.25)' };
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span className="text-lg flex-shrink-0">{m.emoji}</span>
                  <p className="text-sm font-bold text-white flex-1 truncate">{m.name}</p>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: `${badge.color}15`, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hızlı İşlemler ── */}
      <div>
        <p
          className="text-xs font-black uppercase tracking-widest mb-3"
          style={{ color: 'rgba(251,146,60,0.5)' }}
        >
          Hızlı İşlemler
        </p>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction label="Rotasyon"  icon={<RotateCcw className="w-4 h-4" />} color={COLORS.orange}  onClick={() => onNavigate('rotation')}          />
          <QuickAction label="Hızlı Satış" icon={<Zap className="w-4 h-4" />}    color={COLORS.emerald} onClick={() => onNavigate('quick-sales')}        />
          <QuickAction label="Stok"      icon={<Package className="w-4 h-4" />}   color={COLORS.teal}    onClick={() => onNavigate('stock-distribution')} />
          <QuickAction label="Malzeme"   icon={<BarChart3 className="w-4 h-4" />} color={COLORS.violet}  onClick={() => onNavigate('equipment-page')}    />
        </div>
      </div>

    </div>
  );
}