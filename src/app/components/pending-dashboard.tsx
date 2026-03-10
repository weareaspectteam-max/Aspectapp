import { Clock, AlertCircle, Mail } from 'lucide-react';
import { motion } from 'motion/react';

interface PendingDashboardProps {
  userName: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function PendingDashboard({ userName, onLogout }: PendingDashboardProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        {/* Icon */}
        <motion.div
          className="flex justify-center mb-8"
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ffd4a3] to-[#ffb86c] flex items-center justify-center">
              <Clock className="w-12 h-12 text-white" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-[#ffd4a3]/30"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          </div>
        </motion.div>

        {/* Content Card */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">
            Hoş Geldiniz, {userName}
          </h1>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#ffd4a3]/20 border border-[#ffd4a3]/30 rounded-full text-[#ffd4a3] text-sm font-semibold mb-6">
            <AlertCircle className="w-4 h-4" />
            Hesap Onay Bekliyor
          </div>

          <p className="text-gray-400 mb-8 leading-relaxed">
            Hesabınız yönetici tarafından incelenmektedir. Onay sürecinin tamamlanmasının ardından tüm özelliklere erişim sağlayabileceksiniz.
          </p>

          {/* Info Box */}
          <div className="bg-black/20 rounded-2xl p-6 border border-white/10 mb-6">
            <div className="flex items-start gap-3 text-left">
              <Mail className="w-5 h-5 text-[#9dd9ea] mt-1 flex-shrink-0" />
              <div>
                <p className="text-white font-semibold mb-1">E-posta Bildirimi</p>
                <p className="text-sm text-gray-400">
                  Hesabınız onaylandığında size e-posta ile bildirim göndereceğiz.
                </p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#a8e6cf]"></div>
              <p className="text-sm text-gray-400">Kayıt tamamlandı</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#ffd4a3] animate-pulse"></div>
              <p className="text-sm text-gray-400">Yönetici onayı bekleniyor</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-600"></div>
              <p className="text-sm text-gray-500">Sistem erişimi</p>
            </div>
          </div>

          {/* Back to Login Button */}
          <button
            onClick={onLogout}
            className="w-full mt-6 bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] font-bold py-3 px-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <span>🔓 Login Ekranına Dön</span>
          </button>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-gray-500 text-sm mt-6"
        >
          Sorun yaşıyorsanız lütfen <span className="text-[#9dd9ea]">destek@aspect.com</span> adresinden iletişime geçin.
        </motion.p>
      </motion.div>
    </div>
  );
}