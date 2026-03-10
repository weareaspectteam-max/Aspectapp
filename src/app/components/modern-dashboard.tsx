import { TrendingUp, TrendingDown, DollarSign, Package, Award, Zap } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';

interface ModernDashboardProps {
  userName: string;
  userRole: 'admin' | 'staff';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  color?: 'green' | 'red' | 'blue' | 'orange';
}

function StatCard({ title, value, change, icon, color = 'blue' }: StatCardProps) {
  const bgGradient = {
    green: 'from-[#a8e6cf] to-[#8dd9b8]',
    red: 'from-[#ffb3ba] to-[#ffa0a8]',
    blue: 'from-[#b8d4f1] to-[#a7c7e7]',
    orange: 'from-[#ffd4a3] to-[#ffc78f]',
  };

  return (
    <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${bgGradient[color]} flex items-center justify-center shadow-lg`}>
          <div className="text-[#2d3748]">{icon}</div>
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${change >= 0 ? 'text-[#a8e6cf] bg-[#a8e6cf]/20' : 'text-[#ffb3ba] bg-[#ffb3ba]/20'}`}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className="text-gray-400 text-xs mb-1 font-medium">{title}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export function ModernDashboard({ userName, userRole, onLogout, onNavigate }: ModernDashboardProps) {
  const salesData = [
    { time: '09:00', sales: 4 },
    { time: '10:00', sales: 8 },
    { time: '11:00', sales: 12 },
    { time: '12:00', sales: 18 },
    { time: '13:00', sales: 24 },
    { time: '14:00', sales: 28 },
    { time: '15:00', sales: 32 },
  ];

  const projectData = [
    { name: 'ZOKA', revenue: 5600 },
    { name: 'Balık Hali', revenue: 3800 },
    { name: 'H. Kahvesi', revenue: 4200 },
    { name: 'Tekne', revenue: 2000 },
  ];

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Sticky Top Bar - Only for staff */}
      {userRole === 'staff' && (
        <StaffTopBar
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          onNavigate={onNavigate}
          showBackButton={false}
        />
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <span className="text-3xl">📊</span>
        </div>
        <p className="text-sm text-gray-400">Bugünkü performans özeti ☀️</p>
      </div>

      {/* Today's Stats */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Bugün Ciro"
            value="₺15,600"
            change={12}
            icon={<DollarSign className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="Toplam Satış"
            value="32"
            change={8}
            icon={<Package className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title="Ortalama Satış"
            value="₺488"
            change={-3}
            icon={<Award className="w-6 h-6" />}
            color="orange"
          />
          <StatCard
            title="Aktif Personel"
            value="6"
            icon={<Zap className="w-6 h-6" />}
            color="blue"
          />
        </div>
      </div>

      {/* Sales Chart */}
      <div className="px-6 mb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Saatlik Satış Trendi</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="time" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    color: '#fff',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#9dd9ea"
                  strokeWidth={3}
                  dot={{ fill: '#9dd9ea', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Project Performance */}
      <div className="px-6 mb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Proje Performansı</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="revenue" fill="url(#colorBar)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9dd9ea" />
                    <stop offset="100%" stopColor="#7ec8dd" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6">
        <h3 className="font-semibold text-white mb-3">Hızlı İşlemler</h3>
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] rounded-2xl p-4 font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95">
            Rapor Oluştur
          </button>
          <button className="bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] text-[#744210] rounded-2xl p-4 font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95">
            Ekip Görüntüle
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <NewBottomNav
        activeTab="dashboard"
        onTabChange={onNavigate}
        userRole={userRole}
      />
    </div>
  );
}