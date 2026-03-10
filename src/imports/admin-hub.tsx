import { MapPin, Users, Briefcase, ArrowRight, Package, PieChart, DollarSign, ClipboardList } from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface AdminHubProps {
  userName: string;
  userRole: 'admin' | 'staff';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function AdminHub({ userName, userRole, onLogout, onNavigate }: AdminHubProps) {
  const [stats, setStats] = useState({ locations: 0, users: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch locations
        const locationsRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/locations`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        const locationsData = await locationsRes.json();
        
        // Fetch users
        const usersRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/users`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        const usersData = await usersRes.json();
        
        // Count active users (not pending)
        const activeUsers = usersData.users?.filter((u: any) => u.role !== 'pending').length || 0;
        
        setStats({
          locations: locationsData.locations?.length || 0,
          users: activeUsers
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    
    fetchStats();
  }, []);

  const menuItems = [
    {
      id: 'locations-page',
      title: 'Mekan Yönetimi',
      description: 'Proje mekanlarını yönetin',
      icon: MapPin,
      emoji: '📍',
      gradient: 'from-purple-500/20 to-purple-600/20',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400',
    },
    {
      id: 'users-page',
      title: 'Kullanıcı Yönetimi',
      description: 'Personel ve yöneticileri yönetin',
      icon: Users,
      emoji: '👥',
      gradient: 'from-blue-500/20 to-blue-600/20',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      id: 'business-page',
      title: 'İşletme Genel Durum',
      description: 'Gelir, gider ve kar/zarar takibi',
      icon: Briefcase,
      emoji: '💼',
      gradient: 'from-green-500/20 to-green-600/20',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-400',
    },
    {
      id: 'equipment-page',
      title: 'Malzeme Yönetimi',
      description: 'Ekipman ve malzemeleri yönetin',
      icon: Package,
      emoji: '📦',
      gradient: 'from-orange-500/20 to-orange-600/20',
      borderColor: 'border-orange-500/30',
      iconColor: 'text-orange-400',
    },
    {
      id: 'album-distribution',
      title: 'Stok Dağılımı',
      description: 'Albüm ve baskı kağıdı stok analizi',
      icon: PieChart,
      emoji: '📊',
      gradient: 'from-indigo-500/20 to-indigo-600/20',
      borderColor: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
    },
    {
      id: 'photo-pricing',
      title: 'Fotoğraf Fiyat Yönetimi',
      description: 'Her mekan için birim fiyat belirleyin',
      icon: DollarSign,
      emoji: '💰',
      gradient: 'from-emerald-500/20 to-emerald-600/20',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      id: 'manager-reports',
      title: 'Müdür Raporları',
      description: 'Müdür ziyaretleri ve faaliyetleri',
      icon: ClipboardList,
      emoji: '📋',
      gradient: 'from-pink-500/20 to-pink-600/20',
      borderColor: 'border-pink-500/30',
      iconColor: 'text-pink-400',
    },
  ];

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold text-white">Yönetici Paneli</h1>
          <span className="text-3xl">⚙️</span>
        </div>
        <p className="text-sm text-gray-400">İşletme yönetim araçları</p>
      </div>

      {/* Menu Cards */}
      <div className="px-6 space-y-4">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full backdrop-blur-xl bg-gradient-to-br ${item.gradient} border-2 ${item.borderColor} rounded-2xl p-6 hover:scale-[1.02] transition-all active:scale-95`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Icon Circle */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} border-2 ${item.borderColor} flex items-center justify-center shadow-lg`}>
                    <span className="text-3xl">{item.emoji}</span>
                  </div>

                  {/* Text */}
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight className={`w-6 h-6 ${item.iconColor}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Info Section */}
      <div className="px-6 mt-8 space-y-4">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">ℹ️</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">📊 Sistem Özeti</h4>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-semibold">{stats.locations}</span>
                  <span className="text-gray-400">Aktif Mekan</span>
                </div>
                <div className="w-px h-4 bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-semibold">{stats.users}</span>
                  <span className="text-gray-400">Aktif Personel</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Data Init */}
        <button
          onClick={async () => {
            if (confirm('Demo ziyaret verilerini başlatmak istiyor musunuz? Bu işlem müdür atamalarını ve örnek ziyaretleri oluşturacak.')) {
              try {
                const response = await fetch(
                  `https://${projectId}.supabase.co/functions/v1/make-server-91934896/init-demo-visits`,
                  {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${publicAnonKey}` }
                  }
                );
                const data = await response.json();
                if (data.success) {
                  alert('✅ Demo veriler başarıyla oluşturuldu!');
                } else {
                  alert('❌ Hata: ' + data.error);
                }
              } catch (error) {
                alert('❌ Demo veriler oluşturulamadı');
                console.error(error);
              }
            }
          }}
          className="w-full backdrop-blur-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-4 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <span className="text-xl">🎬</span>
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-semibold text-white">Demo Ziyaret Verilerini Başlat</h4>
              <p className="text-xs text-gray-400 mt-0.5">Müdür Raporları'nı test etmek için örnek veriler oluştur</p>
            </div>
          </div>
        </button>
      </div>

      {/* Bottom Navigation */}
      <NewBottomNav
        activeTab="settings"
        onTabChange={onNavigate}
        userRole={userRole}
      />
    </div>
  );
}