import { Package, Printer, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';

interface CurrentStockProps {
  userName: string;
  userRole: 'admin' | 'staff';
  projectName: string;
  onBack: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

// Mock data - gerçek uygulamada API'den gelecek
const mockStockData = {
  stock: {
    album3: 45,
    album5: 32,
    album7: 28,
    album9: 15,
    album11: 12,
    album13: 8,
    album15: 20,
    passepartout: 50,
  },
  printer: {
    currentCounter: '1450',
  },
};

export function CurrentStock({ userName, userRole, projectName, onBack, onLogout, onNavigate }: CurrentStockProps) {
  const albumItems = [
    { key: 'album3', label: '3 Kare Albüm', emoji: '📘' },
    { key: 'album5', label: '5 Kare Albüm', emoji: '📗' },
    { key: 'album7', label: '7 Kare Albüm', emoji: '📙' },
    { key: 'album9', label: '9 Kare Albüm', emoji: '📕' },
    { key: 'album11', label: '11 Kare Albüm', emoji: '📔' },
    { key: 'album13', label: '13 Kare Albüm', emoji: '📒' },
    { key: 'album15', label: '15 Kare Albüm', emoji: '📓' },
    { key: 'passepartout', label: 'Paspartu', emoji: '🖼️' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] relative pb-20">
      {/* Sticky Top Bar - Only for staff */}
      {userRole === 'staff' && (
        <StaffTopBar
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          onNavigate={onNavigate}
          onBack={onBack}
          showBackButton={true}
        />
      )}

      {/* Background Effects */}
      <motion.div
        className="absolute top-20 right-20 w-96 h-96 rounded-full bg-gradient-to-br from-[#9dd9ea]/20 to-transparent blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-gradient-to-br from-[#ffd4a3]/20 to-transparent blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen p-6 pt-20">
        <div className="relative z-10 w-full max-w-md">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9dd9ea]/20 to-[#ffd4a3]/20 border border-white/10 rounded-full mb-4 backdrop-blur-sm">
              <div className="w-2 h-2 bg-[#9dd9ea] rounded-full"></div>
              <span className="text-sm font-semibold text-white">Bilgi Ekranı</span>
            </div>
            <h1 className="text-2xl font-black text-white mb-2">
              Mevcut Stok Durumu
            </h1>
            <p className="text-gray-400 text-sm">
              {projectName} • Güncel Stok
            </p>
          </motion.div>

          {/* Content */}
          <div className="space-y-4 mb-6">
            {/* Albüm Stoğu */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                  <Package className="w-6 h-6 text-[#2d3748]" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Albüm Stoğu</h3>
                  <p className="text-xs text-gray-400">Depodaki mevcut stok</p>
                </div>
              </div>

              <div className="space-y-2">
                {albumItems.map(({ key, label, emoji }) => (
                  <div key={key} className="flex items-center justify-between bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{emoji}</span>
                      <span className="font-medium text-white text-sm">{label}</span>
                    </div>
                    <div className="px-4 py-1.5 bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 rounded-lg">
                      <span className="font-bold text-white">{mockStockData.stock[key as keyof typeof mockStockData.stock]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Baskı Cihazı */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
                  <Printer className="w-6 h-6 text-[#744210]" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Baskı Cihazı</h3>
                  <p className="text-xs text-gray-400">Mevcut sayaç değeri</p>
                </div>
              </div>

              <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-1">Toplam Baskı</div>
                  <div className="text-3xl font-bold text-white">{mockStockData.printer.currentCounter}</div>
                </div>
              </div>
            </motion.div>


          </div>

          {/* Info Note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="text-xs text-gray-400">
                <p className="font-semibold text-white mb-1">Not:</p>
                Bu ekran yalnızca bilgilendirme amaçlıdır. Stok güncellemeleri 
                otomatik olarak satış ve vardiya işlemlerine göre yapılır.
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Navigation - Only for staff */}
      {userRole === 'staff' && (
        <NewBottomNav
          activeTab="stock"
          onTabChange={onNavigate}
          userRole={userRole}
        />
      )}
    </div>
  );
}