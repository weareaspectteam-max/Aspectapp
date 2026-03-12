import { useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, BarChart3, Eye, Settings as SettingsIcon,
  AlertCircle, Activity, Zap,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { StaffPerformanceList } from './staff-performance-list';
import { CurrencyWidget } from './currency-widget';

interface AdminDashboardProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

/* ── Glassmorphism kart stili ── */
const glass = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         20,
} as React.CSSProperties;

/* ── Renk sistemi — header/nav ile aynı ── */
const COLORS = {
  violet:  '#a855f7',
  emerald: '#34d399',
  orange:  '#fb923c',
  blue:    '#60a5fa',
  pink:    '#f472b6',
  yellow:  '#fbbf24',
  fuchsia: '#e879f9',
};

interface StatCardProps {
  title:   string;
  value:   string;
  change?: number;
  icon:    React.ReactNode;
  color:   string;
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
        padding: 16,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: `0 4px 24px ${color}15`,
        border: `1px solid ${color}25`,
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

/* ── Hızlı Aksiyon butonu ── */
function QuickAction({ label, icon, color, onClick }: {
  label: string; icon: React.ReactNode; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
      style={{
        ...glass,
        padding: '14px 8px',
        border:  `1px solid ${color}30`,
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

export function AdminDashboard({ userName, userRole, onLogout, onNavigate }: AdminDashboardProps) {
  const [showPerformanceList, setShowPerformanceList] = useState(false);

  const totalRevenue = 45200;
  const totalSales   = 98;
  const activeStaff  = 12;
  const averageSale  = 461;

  const salesTrendData = [
    { time: '09:00', sales: 12,  revenue: 5400  },
    { time: '10:00', sales: 18,  revenue: 8200  },
    { time: '11:00', sales: 24,  revenue: 11400 },
    { time: '12:00', sales: 32,  revenue: 14800 },
    { time: '13:00', sales: 28,  revenue: 12600 },
    { time: '14:00', sales: 35,  revenue: 16200 },
    { time: '15:00', sales: 42,  revenue: 19400 },
  ];

  const albumDistribution = [
    { name: '3 Kare',  value: 12, color: COLORS.blue    },
    { name: '5 Kare',  value: 18, color: COLORS.emerald },
    { name: '7 Kare',  value: 24, color: COLORS.orange  },
    { name: '9 Kare',  value: 20, color: COLORS.pink    },
    { name: '11 Kare', value: 14, color: COLORS.violet  },
    { name: '13 Kare', value:  8, color: COLORS.yellow  },
    { name: '15 Kare', value: 10, color: COLORS.fuchsia },
  ];
  const totalAlbums = albumDistribution.reduce((s, i) => s + i.value, 0);

  const topPerformers = [
    { name: 'Ahmet Yılmaz', sales: 18, revenue: 8400, project: 'ZOKA Beach Club' },
    { name: 'Ayşe Demir',   sales: 15, revenue: 7200, project: 'ZOKA Beach Club' },
    { name: 'Mehmet Kaya',  sales: 14, revenue: 6800, project: 'Balık Hali'      },
    { name: 'Can Yücel',    sales: 11, revenue: 4800, project: 'Tekne Turu'      },
  ];

  const rankColors = [COLORS.yellow, 'rgba(192,192,192,0.9)', '#cd7f32', 'rgba(255,255,255,0.3)'];

  const handleSendMessage = () => {
    setShowPerformanceList(false);
    onNavigate('messaging');
  };

  return (
    <div className="px-4 py-4 space-y-4">

      {/* ── Sayfa başlığı ── */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-black text-white">Genel Durum</h1>
          <span className="text-xl">📊</span>
        </div>
        <p className="text-xs font-medium" style={{ color: 'rgba(196,181,253,0.5)' }}>
          Tüm projelerin canlı özeti · {new Date().toLocaleDateString('tr-TR')}
        </p>
      </div>

      {/* ── İstatistik Kartları — 2×2 grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Toplam Günlük Ciro"
          value={`₺${totalRevenue.toLocaleString('tr-TR')}`}
          change={15}
          icon={<DollarSign className="w-5 h-5" />}
          color={COLORS.emerald}
        />
        <StatCard
          title="Toplam Satış"
          value={totalSales.toString()}
          change={12}
          icon={<Package className="w-5 h-5" />}
          color={COLORS.blue}
        />
        <StatCard
          title="Aktif Personel"
          value={activeStaff.toString()}
          icon={<Users className="w-5 h-5" />}
          color={COLORS.orange}
          onClick={() => onNavigate('rotation')}
        />
        <StatCard
          title="Ortalama Satış"
          value={`₺${averageSale}`}
          change={-2}
          icon={<BarChart3 className="w-5 h-5" />}
          color={COLORS.violet}
        />
      </div>

      {/* ── Döviz Widget ── */}
      <CurrencyWidget />

      {/* ── Saatlik Satış Trendi ── */}
      <div style={{ ...glass, padding: 16 }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-white">Saatlik Satış & Ciro Trendi</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: COLORS.violet }} />
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>Satış</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: COLORS.emerald }} />
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>Ciro</span>
            </div>
          </div>
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height={180} minWidth={0}>
            <LineChart data={salesTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                key="xaxis"
                dataKey="time"
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              />
              <YAxis
                key="yaxis-left"
                yAxisId="left"
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              />
              <YAxis
                key="yaxis-right"
                yAxisId="right"
                orientation="right"
                stroke="rgba(255,255,255,0.2)"
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              />
              <Tooltip
                key="tooltip"
                contentStyle={{
                  background:   'rgba(10,5,30,0.95)',
                  border:       '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  color:        '#fff',
                  fontSize:     12,
                }}
              />
              <Line
                key="line-sales"
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                stroke={COLORS.violet}
                strokeWidth={2.5}
                dot={{ fill: COLORS.violet, r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                key="line-revenue"
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke={COLORS.emerald}
                strokeWidth={2.5}
                dot={{ fill: COLORS.emerald, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Albüm Dağılımı ── */}
      <div style={{ ...glass, padding: 16 }}>
        <p className="text-sm font-bold text-white mb-3">Genel Albüm Dağılımı</p>
        <div className="space-y-2">
          {albumDistribution.map(item => {
            const pct = Math.round((item.value / totalAlbums) * 100);
            return (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-xs font-semibold w-14 shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {item.name}
                </span>
                <div
                  className="flex-1 rounded-full overflow-hidden"
                  style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: item.color }}
                  />
                </div>
                <span className="text-xs font-bold w-6 text-right text-white">{item.value}</span>
                <span className="text-[10px] w-8 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  %{pct}
                </span>
              </div>
            );
          })}
        </div>
        <div
          className="flex justify-between items-center mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Toplam Albüm</span>
          <span className="text-sm font-black text-white">{totalAlbums}</span>
        </div>
      </div>

      {/* ── En İyi Performans ── */}
      <div style={{ ...glass, padding: 16 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">🏆 En İyi Performans</p>
          <button
            onClick={() => setShowPerformanceList(true)}
            className="text-xs font-bold transition-opacity active:opacity-60"
            style={{ color: COLORS.yellow }}
          >
            Tümünü Gör
          </button>
        </div>
        <div className="space-y-2">
          {topPerformers.map((p, i) => (
            <div
              key={p.name}
              className="flex items-center gap-3"
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Sıra rozeti */}
              <div
                className="flex items-center justify-center text-xs font-black shrink-0"
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${rankColors[i]}20`,
                  border: `1px solid ${rankColors[i]}50`,
                  color: rankColors[i],
                }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{p.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {p.project}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black" style={{ color: COLORS.emerald }}>
                  ₺{p.revenue.toLocaleString('tr-TR')}
                </p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {p.sales} satış
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Hızlı İşlemler ── */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(196,181,253,0.5)' }}>
          Hızlı İşlemler
        </p>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction label="Canlı Feed"  icon={<Activity className="w-4 h-4" />}      color={COLORS.emerald} onClick={() => onNavigate('live-feed')}  />
          <QuickAction label="Rotasyon"    icon={<Users className="w-4 h-4" />}          color={COLORS.orange}  onClick={() => onNavigate('rotation')}   />
          <QuickAction label="Mesajlar"    icon={<AlertCircle className="w-4 h-4" />}    color={COLORS.blue}    onClick={() => onNavigate('messaging')}  />
          <QuickAction label="Ayarlar"     icon={<SettingsIcon className="w-4 h-4" />}   color={COLORS.violet}  onClick={() => onNavigate('settings')}   />
        </div>
      </div>

      {/* Modal */}
      <StaffPerformanceList
        isOpen={showPerformanceList}
        onClose={() => setShowPerformanceList(false)}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}