import { FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { CurrencyWidget } from './currency-widget';

interface AdministrativeDashboardProps {
  userName: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function AdministrativeDashboard({ userName }: AdministrativeDashboardProps) {
  const tasks = [
    { title: 'Fatura Düzenleme', status: 'pending', deadline: 'Bugün' },
    { title: 'Maaş Ödemeleri', status: 'completed', deadline: 'Tamamlandı' },
    { title: 'Stok Siparişi', status: 'pending', deadline: 'Yarın' },
    { title: 'Sözleşme Yenileme', status: 'pending', deadline: '3 gün' },
  ];

  return (
    <div className="min-h-screen p-6 pt-24" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          İdari Panel
        </h1>
        <p className="text-gray-400">{userName} - İdari Görevli</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#b8d4f1] flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-400 text-sm mb-1">Bekleyen Fatura</p>
          <p className="text-2xl font-bold text-white">12</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffb86c] flex items-center justify-center mb-3">
            <CurrencyWidget className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-400 text-sm mb-1">Aylık Gider</p>
          <p className="text-2xl font-bold text-white">₺85,450</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#7dd3a0] flex items-center justify-center mb-3">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-400 text-sm mb-1">Personel Sayısı</p>
          <p className="text-2xl font-bold text-white">18</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#ffd4a3] flex items-center justify-center mb-3">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-400 text-sm mb-1">İzin Talepleri</p>
          <p className="text-2xl font-bold text-white">5</p>
        </motion.div>
      </div>

      {/* Currency Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-6"
      >
        <CurrencyWidget />
      </motion.div>

      {/* Tasks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-6"
      >
        <h2 className="text-xl font-bold text-white mb-4">Görevler</h2>
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div
              key={index}
              className="bg-black/20 rounded-xl p-4 border border-white/10 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-white mb-1">{task.title}</p>
                <p className="text-sm text-gray-400">{task.deadline}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs ${
                task.status === 'completed' 
                  ? 'bg-[#a8e6cf]/20 text-[#a8e6cf]' 
                  : 'bg-[#ffd4a3]/20 text-[#ffd4a3]'
              }`}>
                {task.status === 'completed' ? 'Tamamlandı' : 'Bekliyor'}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}