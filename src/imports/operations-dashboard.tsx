import { MapPin, Users, Package, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { CurrencyWidget } from './currency-widget';

interface OperationsDashboardProps {
  userName: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function OperationsDashboard({ userName }: OperationsDashboardProps) {
  const locations = [
    { name: 'Beach Club Mavi', staff: 3, status: 'active', stock: '85%' },
    { name: 'Lüks Restoran', staff: 2, status: 'active', stock: '92%' },
    { name: 'Tekne Turları', staff: 2, status: 'inactive', stock: '45%' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] p-6 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          Operasyon Paneli
        </h1>
        <p className="text-gray-400">{userName} - Operasyon Yöneticisi</p>
      </motion.div>

      {/* Daily Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-6 mb-6"
      >
        <h2 className="text-xl font-bold text-white mb-4">Günlük Özet</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-[#9dd9ea]" />
              <p className="text-gray-400 text-sm">Aktif Personel</p>
            </div>
            <p className="text-2xl font-bold text-white">7/12</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-[#ffd4a3]" />
              <p className="text-gray-400 text-sm">Stok Durumu</p>
            </div>
            <p className="text-2xl font-bold text-white">74%</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-[#a8e6cf]" />
              <p className="text-gray-400 text-sm">Aktif Lokasyon</p>
            </div>
            <p className="text-2xl font-bold text-white">2/3</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-[#9dd9ea]" />
              <p className="text-gray-400 text-sm">Gelir Artışı</p>
            </div>
            <p className="text-2xl font-bold text-white">15%</p>
          </div>
        </div>
      </motion.div>

      {/* Currency Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <CurrencyWidget />
      </motion.div>

      {/* Locations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-6"
      >
        <h2 className="text-xl font-bold text-white mb-4">Lokasyonlar</h2>
        <div className="space-y-3">
          {locations.map((location, index) => (
            <div
              key={index}
              className="bg-black/20 rounded-xl p-4 border border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#9dd9ea]" />
                  <p className="font-semibold text-white">{location.name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  location.status === 'active' 
                    ? 'bg-[#a8e6cf]/20 text-[#a8e6cf]' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {location.status === 'active' ? 'Aktif' : 'Pasif'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{location.staff} Personel</span>
                <span>•</span>
                <span>Stok: {location.stock}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}