import { TrendingUp, Users, Camera, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import { CurrencyWidget } from './currency-widget';

interface ManagerDashboardProps {
  userName: string;
  roleTitle: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function ManagerDashboard({ userName, roleTitle }: ManagerDashboardProps) {
  const stats = [
    { label: 'Günlük Satış', value: '₺45,890', change: '+12.5%', icon: DollarSign, color: 'from-[#9dd9ea] to-[#b8d4f1]' },
    { label: 'Aktif Personel', value: '12', change: '+2', icon: Users, color: 'from-[#ffd4a3] to-[#ffb86c]' },
    { label: 'Toplam Fotoğraf', value: '234', change: '+45', icon: Camera, color: 'from-[#a8e6cf] to-[#7dd3a0]' },
    { label: 'Performans', value: '%87', change: '+5%', icon: TrendingUp, color: 'from-[#9dd9ea] to-[#ffd4a3]' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] p-6 pt-24">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          Hoş Geldiniz, {userName}
        </h1>
        <p className="text-gray-400">{roleTitle}</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 shadow-xl"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
            <p className="text-[#a8e6cf] text-sm">{stat.change}</p>
          </motion.div>
        ))}
      </div>

      {/* Currency Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <CurrencyWidget />
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-6"
      >
        <h2 className="text-xl font-bold text-white mb-4">Hızlı İşlemler</h2>
        <div className="grid grid-cols-2 gap-3">
          <button className="p-4 bg-gradient-to-br from-[#9dd9ea]/20 to-[#9dd9ea]/10 border border-[#9dd9ea]/30 rounded-xl text-white hover:from-[#9dd9ea]/30 hover:to-[#9dd9ea]/20 transition-all">
            Satış Gir
          </button>
          <button className="p-4 bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffd4a3]/10 border border-[#ffd4a3]/30 rounded-xl text-white hover:from-[#ffd4a3]/30 hover:to-[#ffd4a3]/20 transition-all">
            Rapor Görüntüle
          </button>
          <button className="p-4 bg-gradient-to-br from-[#a8e6cf]/20 to-[#a8e6cf]/10 border border-[#a8e6cf]/30 rounded-xl text-white hover:from-[#a8e6cf]/30 hover:to-[#a8e6cf]/20 transition-all">
            Personel Yönetimi
          </button>
          <button className="p-4 bg-gradient-to-br from-[#9dd9ea]/20 to-[#ffd4a3]/10 border border-white/20 rounded-xl text-white hover:from-[#9dd9ea]/30 hover:to-[#ffd4a3]/20 transition-all">
            Ayarlar
          </button>
        </div>
      </motion.div>
    </div>
  );
}