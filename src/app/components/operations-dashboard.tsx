import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Users, Package,
  MapPin, ClipboardList, Zap, RotateCcw,
  BarChart3, AlertCircle, Activity,
} from 'lucide-react';

import { CurrencyWidget } from './currency-widget';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/** İş günü tarihi: TR 00:00-04:59 → hâlâ önceki takvim günü (vardiya 05:00'da biter). */
function todayTR(): string {
  const trMs   = Date.now() + 3 * 60 * 60 * 1000;
  const trHour = new Date(trMs).getUTCHours();
  if (trHour < 5) return new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
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
  violet:  '#a855f7',
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

interface Props { userName: string; onLogout: () => void; onNavigate: (tab: string) => void; }

export function OperationsDashboard({ userName, onNavigate }: Props) {
  const [staffMembers,  setStaffMembers]  = useState<StaffMember[]>([]);
  const [todayTasks,    setTodayTasks]    = useState<Task[]>([]);
  const [mekanlar,      setMekanlar]      = useState<Mekan[]>([]);
  const [stokOzetler,   setStokOzetler]   = useState<StokOzet[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);

  const loadAll = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const today   = todayTR();
      const [staffRes, tasksRes, mekanRes, stokRes, leaveRes] = await Promise.allSettled([
        fetch(`${SERVER}/rotasyon/personel${ghostParams()}`,  { headers }),
        fetch(`${SERVER}/rotasyon/gorevler${ghostParams()}`,  { headers }),
        fetch(`${SERVER}/mekanlar${ghostParams()}`,           { headers }),
        fetch(`${SERVER}/stok/genel-durum${ghostParams()}`,   { headers }),
        fetch(`${SERVER}/rotasyon/izinler${ghostParams()}`,   { headers }),
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
    } catch (e) {
      console.error('[OperationsDashboard] loadAll error:', e);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [loadAll]);

  /* ── Türetilen değerler ── */
  const activeStaff   = staffMembers.filter(s => s.status === 'active').length;
  const totalStaff    = staffMembers.length;
  const totalMekan    = mekanlar.length;
  const activeMekan   = stokOzetler.filter(m => m.vardiyaDurumu === 'acik' || m.vardiyaDurumu === 'kapandi').length;
  const completedTask = todayTasks.filter(t => t.status === 'completed').length;
  const activeTask    = todayTasks.length;

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
        <StatCard
          title="Aktif Personel"
          value={totalStaff > 0 ? `${activeStaff}/${totalStaff}` : '—'}
          change={activeStaff > 0 ? 8 : undefined}
          icon={<Users className="w-5 h-5" />}
          color={COLORS.teal}
          onClick={() => onNavigate('rotation')}
        />
        <StatCard
          title="Bugünkü Görev"
          value={activeTask > 0 ? `${completedTask}/${activeTask}` : `${activeTask}`}
          icon={<ClipboardList className="w-5 h-5" />}
          color={COLORS.orange}
          onClick={() => onNavigate('rotation')}
        />
        <StatCard
          title="Aktif Lokasyon"
          value={totalMekan > 0 ? `${activeMekan}/${totalMekan}` : '—'}
          icon={<MapPin className="w-5 h-5" />}
          color={COLORS.emerald}
          onClick={() => onNavigate('stock-distribution')}
        />
        <StatCard
          title="Bekleyen İzin"
          value={`${pendingLeaves.length}`}
          icon={<AlertCircle className="w-5 h-5" />}
          color={pendingLeaves.length > 0 ? COLORS.yellow : COLORS.violet}
          onClick={() => onNavigate('rotation')}
        />
      </div>

      {/* ── Döviz Widget ── */}
      <CurrencyWidget />

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

    </div>
  );
}