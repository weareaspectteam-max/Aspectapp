import { Package, ShoppingCart, ArrowRight, Sparkles, Eye, Moon, Printer, Film } from 'lucide-react';
import { motion } from 'motion/react';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';

interface ShiftChoiceProps {
  userName: string;
  userRole: 'admin' | 'staff';
  projectName: string;
  onStartShiftSetup: () => void;
  onStartSales: () => void;
  onViewStock: () => void;
  onEndShift: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  onBack?: () => void;
}

export function ShiftChoice({ userName, userRole, projectName, onStartShiftSetup, onStartSales, onViewStock, onEndShift, onLogout, onNavigate, onBack }: ShiftChoiceProps) {
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
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9dd9ea]/20 to-[#ffd4a3]/20 border border-white/10 rounded-full mb-4 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-[#9dd9ea]" />
            <span className="text-sm font-semibold text-white">{projectName}</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">
            Hoş Geldin, {userName}
          </h1>
          <p className="text-gray-400 text-sm">
            Nasıl devam etmek istersin?
          </p>
        </motion.div>

        {/* Choice Cards */}
        <div className="space-y-4">
          {/* Vardiya Hazırlığı */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={onStartShiftSetup}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-full group"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea]/50 to-[#7ec8dd]/50 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Card */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 group-hover:border-[#9dd9ea]/50 rounded-2xl p-6 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                    <Package className="w-7 h-7 text-[#2d3748]" />
                  </div>
                  
                  {/* Text */}
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white mb-1">
                      Vardiya Hazırlığı
                    </h3>
                    <p className="text-sm text-gray-400">
                      Stok, yazıcı ve reyon sayımı
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <ArrowRight className="w-6 h-6 text-[#9dd9ea]" />
                </motion.div>
              </div>

              {/* Features */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 rounded-lg text-xs text-[#7ec8dd] font-medium">
                    📦 Albüm Stok
                  </span>
                  <span className="px-3 py-1 bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 rounded-lg text-xs text-[#7ec8dd] font-medium">
                    🖨️ Yazıcı Sayaç
                  </span>
                  <span className="px-3 py-1 bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 rounded-lg text-xs text-[#7ec8dd] font-medium">
                    📍 Reyon Bilgisi
                  </span>
                </div>
              </div>
            </div>
          </motion.button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 text-gray-500 bg-transparent">veya</span>
            </div>
          </div>

          {/* Satışa Başla */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            onClick={onStartSales}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-full group"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#ffd4a3]/50 to-[#ffc78f]/50 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Card */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 group-hover:border-[#ffd4a3]/50 rounded-2xl p-6 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
                    <ShoppingCart className="w-7 h-7 text-[#744210]" />
                  </div>
                  
                  {/* Text */}
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white mb-1">
                      Satışa Başla
                    </h3>
                    <p className="text-sm text-gray-400">
                      Direkt satış ekranına geç
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.3,
                  }}
                >
                  <ArrowRight className="w-6 h-6 text-[#ffd4a3]" />
                </motion.div>
              </div>

              {/* Features */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-[#ffd4a3]/20 border border-[#ffd4a3]/30 rounded-lg text-xs text-[#d4a574] font-medium">
                    ⚡ Hızlı Satış
                  </span>
                  <span className="px-3 py-1 bg-[#ffd4a3]/20 border border-[#ffd4a3]/30 rounded-lg text-xs text-[#d4a574] font-medium">
                    💳 Ödeme İşlemi
                  </span>
                  <span className="px-3 py-1 bg-[#ffd4a3]/20 border border-[#ffd4a3]/30 rounded-lg text-xs text-[#d4a574] font-medium">
                    📊 Liderlik Tablosu
                  </span>
                </div>
              </div>
            </div>
          </motion.button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 text-gray-500 bg-transparent">diğer</span>
            </div>
          </div>

          {/* Mevcut Stok */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            onClick={onViewStock}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-full group"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#a8e6cf]/30 to-[#8edec0]/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Card */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 group-hover:border-[#a8e6cf]/50 rounded-2xl p-6 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8edec0] flex items-center justify-center shadow-lg">
                    <Eye className="w-7 h-7 text-[#2d3748]" />
                  </div>
                  
                  {/* Text */}
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white mb-1">
                      Mevcut Stok
                    </h3>
                    <p className="text-sm text-gray-400">
                      Güncel stok durumunu görüntüle
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5,
                  }}
                >
                  <ArrowRight className="w-6 h-6 text-[#a8e6cf]" />
                </motion.div>
              </div>

              {/* Features */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-[#a8e6cf]/20 border border-[#a8e6cf]/30 rounded-lg text-xs text-[#8edec0] font-medium">
                    📦 Albüm Stoğu
                  </span>
                  <span className="px-3 py-1 bg-[#a8e6cf]/20 border border-[#a8e6cf]/30 rounded-lg text-xs text-[#8edec0] font-medium">
                    🖨️ Baskı Cihazı
                  </span>
                </div>
              </div>
            </div>
          </motion.button>

          {/* Vardiya Bitiş */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            onClick={onEndShift}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            className="relative w-full group"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#ffb3ba]/30 to-[#ffa0a8]/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            {/* Card */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 group-hover:border-[#ffb3ba]/50 rounded-2xl p-6 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#ffb3ba] to-[#ffa0a8] flex items-center justify-center shadow-lg">
                    <Moon className="w-7 h-7 text-white" />
                  </div>
                  
                  {/* Text */}
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white mb-1">
                      Vardiya Bitiş
                    </h3>
                    <p className="text-sm text-gray-400">
                      Günü kapat ve sayım yap
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.6,
                  }}
                >
                  <ArrowRight className="w-6 h-6 text-[#ffb3ba]" />
                </motion.div>
              </div>

              {/* Features */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 px-3 py-1 bg-[#ffb3ba]/20 border border-[#ffb3ba]/30 rounded-lg text-xs text-[#ffb3ba] font-medium">
                    <Printer className="w-3.5 h-3.5" />
                    Ribon Değişimi
                  </span>
                  <span className="flex items-center gap-1 px-3 py-1 bg-[#ffb3ba]/20 border border-[#ffb3ba]/30 rounded-lg text-xs text-[#ffb3ba] font-medium">
                    <Film className="w-3.5 h-3.5" />
                    Ribon Bitiş Sayısı
                  </span>
                  <span className="flex items-center gap-1 px-3 py-1 bg-[#ffb3ba]/20 border border-[#ffb3ba]/30 rounded-lg text-xs text-[#ffb3ba] font-medium">
                    <Package className="w-3.5 h-3.5" />
                    Kapanış Sayımı
                  </span>
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Info Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div className="text-xs text-gray-400">
              <p className="font-semibold text-white mb-1">Bilgi:</p>
              Vardiya hazırlığı ekip üyelerinden biri tarafından yapılabilir. 
              Eğer başka biri zaten yapmışsa direkt satışa başlayabilirsin.
            </div>
          </div>
        </motion.div>
        </div>
      </div>

      {/* Bottom Navigation - Only for staff */}
      {userRole === 'staff' && (
        <NewBottomNav
          activeTab="home"
          onTabChange={onNavigate}
          userRole={userRole}
        />
      )}
    </div>
  );
}