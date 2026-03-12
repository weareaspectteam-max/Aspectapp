import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Package, Users, ArrowRight, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  userName: string;
}

interface Location {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export function Dashboard({ userName }: DashboardProps) {
  const [locations, setLocations] = useState<Location[]>([]);

  // localStorage kaldırıldı - KV store entegrasyonu yapılacak
  useEffect(() => {
    // Boş başlıyoruz
  }, []);

  const stats = [
    { title: 'Toplam Ciro', value: '₺15,600', change: 12, icon: <DollarSign className="w-5 h-5 text-primary" />, color: 'blue' },
    { title: 'Net Kâr', value: '₺10,800', change: 8, icon: <TrendingUp className="w-5 h-5 text-[#10b981]" />, color: 'green' },
    { title: 'Maliyet', value: '₺4,800', icon: <TrendingDown className="w-4 h-4 text-[#ef4444]" />, color: 'red' },
    { title: 'Baskı', value: '124', icon: <Package className="w-4 h-4 text-[#f59e0b]" />, color: 'orange' },
    { title: 'Albüm', value: '38', icon: <Users className="w-4 h-4 text-primary" />, color: 'blue' },
  ];

  // ✅ DYNAMIC: Project data from Mekan Yönetimi
  // Mock revenue data - will be replaced with real API data later
  const projects = locations.map((location, index) => ({
    name: location.name,
    revenue: index === 0 ? '₺5,600' : index === 1 ? '₺3,800' : '₺2,000',
    performance: index === 0 ? 92 : index === 1 ? 65 : 58,
  }));

  const revenueData = [
    { time: '09:00', value: 1200 },
    { time: '11:00', value: 3400 },
    { time: '13:00', value: 5600 },
    { time: '15:00', value: 8900 },
    { time: '17:00', value: 12400 },
    { time: '19:00', value: 15600 },
  ];

  const profitData = [
    { time: '09:00', value: 800 },
    { time: '11:00', value: 2200 },
    { time: '13:00', value: 3800 },
    { time: '15:00', value: 6100 },
    { time: '17:00', value: 8500 },
    { time: '19:00', value: 10800 },
  ];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-foreground mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm">27 Şubat 2026 - Bugünün Performansı</p>
      </div>

      {/* Stats Grid */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <StatCard
            title="Toplam Ciro"
            value="₺15,600"
            change={12}
            icon={<DollarSign className="w-5 h-5 text-primary" />}
            color="blue"
          />
          <StatCard
            title="Net Kâr"
            value="₺10,800"
            change={8}
            icon={<TrendingUp className="w-5 h-5 text-[#10b981]" />}
            color="green"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            title="Maliyet"
            value="₺4,800"
            icon={<TrendingDown className="w-4 h-4 text-[#ef4444]" />}
            color="red"
          />
          <StatCard
            title="Baskı"
            value="124"
            icon={<Package className="w-4 h-4 text-[#f59e0b]" />}
            color="orange"
          />
          <StatCard
            title="Albüm"
            value="38"
            icon={<Users className="w-4 h-4 text-primary" />}
            color="blue"
          />
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="px-6 mb-6">
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground mb-1">Ciro Grafiği</h3>
            <p className="text-xs text-muted-foreground">Günlük satış trendi</p>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height={180} minWidth={0}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(value) => `₺${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value) => [`₺${value}`, 'Ciro']}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#1e40af" 
                  strokeWidth={3}
                  dot={{ fill: '#1e40af', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Profit Chart */}
      <div className="px-6 mb-6">
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground mb-1">Kâr Grafiği</h3>
            <p className="text-xs text-muted-foreground">Net kâr trendi</p>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height={180} minWidth={0}>
              <LineChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(value) => `₺${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value) => [`₺${value}`, 'Kâr']}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Projects Performance */}
      <div className="px-6 mb-6">
        <h3 className="font-semibold text-foreground mb-3">Proje Performansı</h3>
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard key={project.name} {...project} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  color?: 'green' | 'red' | 'blue' | 'orange';
}

function StatCard({ title, value, change, icon, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    green: 'text-[#10b981]',
    red: 'text-[#ef4444]',
    blue: 'text-primary',
    orange: 'text-[#f59e0b]',
  };

  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl bg-opacity-10 ${colorClasses[color]}`} style={{
          backgroundColor: color === 'green' ? 'rgba(16, 185, 129, 0.1)' : 
                         color === 'red' ? 'rgba(239, 68, 68, 0.1)' : 
                         color === 'orange' ? 'rgba(245, 158, 11, 0.1)' : 
                         'rgba(30, 64, 175, 0.1)'
        }}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className="text-muted-foreground text-xs mb-1">{title}</div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

interface ProjectCardProps {
  name: string;
  revenue: string;
  performance: number;
}

function ProjectCard({ name, revenue, performance }: ProjectCardProps) {
  const performanceColor = performance >= 80 ? '#10b981' : performance >= 50 ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">{name}</h3>
        <div className="text-xs px-2 py-1 rounded-full" style={{
          backgroundColor: `${performanceColor}20`,
          color: performanceColor
        }}>
          {performance}%
        </div>
      </div>
      <div className="text-muted-foreground text-xs mb-1">Ciro</div>
      <div className="text-xl font-semibold text-foreground">{revenue}</div>
    </div>
  );
}