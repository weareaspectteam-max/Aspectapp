import { useState } from 'react';
import { Menu, X, LogOut, MessageSquare, User, Home, Sparkles, Settings, GraduationCap, Trophy, MapPin, Cake, Megaphone, Zap, Users, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HamburgerMenuProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  darkMode?: boolean;
}

type UserRole = 
  | 'yonetici'
  | 'ust-mudur'
  | 'mudur'
  | 'operasyon'
  | 'personel'
  | 'idari'
  | 'bekleyen';

export function HamburgerMenu({ userName, userRole, onLogout, onNavigate, darkMode = false }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get current logged in user role
  const getCurrentUserRole = (): UserRole => {
    return userRole as UserRole;
  };

  const currentUserRole = getCurrentUserRole();

  const menuItems = [
    {
      icon: Home,
      label: 'Başlangıç',
      action: () => {
        onNavigate('home');
        setIsOpen(false);
      },
      gradient: 'from-[#a8e6cf] to-[#8dd9b8]',
      emoji: '🏠',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[],
    },
    {
      icon: Zap,
      label: 'Operasyon',
      action: () => {
        onNavigate('quick-sales');
        setIsOpen(false);
      },
      gradient: 'from-[#9dd9ea] to-[#7ec8dd]',
      emoji: '⚡',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari'] as UserRole[], // Bekleyen ve personel hariç
    },
    {
      icon: MapPin,
      label: 'İşletme Yönetici Paneli',
      action: () => {
        onNavigate('business-panel');
        setIsOpen(false);
      },
      gradient: 'from-[#ffb3d9] to-[#ff99cc]',
      emoji: '📍',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari'] as UserRole[], // Sadece yönetici rolleri
    },
    {
      icon: Trophy,
      label: 'Liderlik Tablosu',
      action: () => {
        onNavigate('leaderboard');
        setIsOpen(false);
      },
      gradient: 'from-[#ffd4a3] to-[#ffc78f]',
      emoji: '🏆',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[],
    },
    {
      icon: User,
      label: currentUserRole === 'personel' ? 'Personel Profili' : 'Profil',
      action: () => {
        onNavigate('profile');
        setIsOpen(false);
      },
      gradient: 'from-[#9dd9ea] to-[#7ec8dd]',
      emoji: currentUserRole === 'personel' ? '😊' : '👨‍💼',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[], // Herkes
    },
    {
      icon: Users,
      label: 'Rotasyon',
      action: () => {
        onNavigate('rotation');
        setIsOpen(false);
      },
      gradient: 'from-[#b8d4f1] to-[#9dd9ea]',
      emoji: '🔄',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[], // Herkes
    },
    {
      icon: Camera,
      label: 'Kare Takibi',
      action: () => {
        onNavigate('frame-tracking');
        setIsOpen(false);
      },
      gradient: 'from-[#9dd9ea] to-[#7ec8dd]',
      emoji: '📷',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[], // Herkes (demo)
    },
    {
      icon: GraduationCap,
      label: 'Aspect Akademi',
      action: () => {
        onNavigate('academy');
        setIsOpen(false);
      },
      gradient: 'from-[#9dd9ea] to-[#7ec8dd]',
      emoji: '🎓',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[],
    },
    {
      icon: Cake,
      label: 'Doğum Günleri',
      action: () => {
        onNavigate('birthday-calendar');
        setIsOpen(false);
      },
      gradient: 'from-[#ffb3ba] to-[#ffa3aa]',
      emoji: '🎂',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari'] as UserRole[], // Sadece yönetici rolleri - Personel/Bekleyen YOK
    },
    {
      icon: Megaphone,
      label: 'Duyurular',
      action: () => {
        onNavigate('announcements');
        setIsOpen(false);
      },
      gradient: 'from-[#ffd4a3] to-[#ffc78f]',
      emoji: '📢',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[],
    },
    {
      icon: MessageSquare,
      label: 'Mesajlar',
      action: () => {
        onNavigate('messaging');
        setIsOpen(false);
      },
      gradient: 'from-[#ffd4a3] to-[#ffc78f]',
      badge: 3,
      emoji: '💬',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[],
    },
    {
      icon: Settings,
      label: 'Hesap Ayarları',
      action: () => {
        onNavigate('settings');
        setIsOpen(false);
      },
      gradient: 'from-[#d4b5f7] to-[#c79ff0]',
      emoji: '⚙️',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[],
    },
    {
      icon: LogOut,
      label: 'Çıkış Yap',
      action: () => {
        setIsOpen(false);
        onLogout();
      },
      gradient: 'from-[#ffb3ba] to-[#ffa0a8]',
      danger: true,
      emoji: '👋',
      showFor: ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari', 'personel', 'bekleyen'] as UserRole[],
    },
  ].filter(item => item.showFor?.includes(currentUserRole) ?? false);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative z-50 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
          darkMode
            ? 'bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm'
            : 'bg-gradient-to-br from-[#b8d4f1]/10 to-[#9dd9ea]/10 hover:from-[#b8d4f1]/20 hover:to-[#9dd9ea]/20 border border-[#b8d4f1]/20'
        }`}
      >
        <Menu className={`w-5 h-5 ${darkMode ? 'text-white' : 'text-primary'}`} />
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300]"
          />
        )}
      </AnimatePresence>

      {/* Menu Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed top-0 right-0 h-screen w-80 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] shadow-2xl z-[310] flex flex-col overflow-hidden border-l border-white/10"
          >
            {/* Decorative Background Elements */}
            <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-gradient-to-br from-[#9dd9ea]/10 to-transparent blur-3xl" />
            <div className="absolute bottom-20 left-10 w-40 h-40 rounded-full bg-gradient-to-br from-[#ffd4a3]/10 to-transparent blur-3xl" />

            {/* Header */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0 border-b border-white/10 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#9dd9ea]" />
                  <h2 className="text-xl font-black text-white">Menü</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all active:scale-95"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="relative flex-1 overflow-y-auto p-5 pb-6 pt-3">
              <div className="space-y-3">
                {menuItems.map((item, index) => (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08, type: 'spring', damping: 20 }}
                    onClick={item.action}
                    className={`group w-full backdrop-blur-xl rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${
                      item.danger
                        ? 'bg-gradient-to-br from-[#ffb3ba]/20 to-[#ffa0a8]/10 hover:from-[#ffb3ba]/30 hover:to-[#ffa0a8]/20 border-2 border-[#ffb3ba]/30 hover:border-[#ffb3ba]/50 shadow-lg hover:shadow-[#ffb3ba]/20'
                        : 'bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 border-2 border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    <div className="flex items-center p-4">
                      {/* Icon with Gradient Background */}
                      <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg mr-4 group-hover:scale-110 transition-transform`}>
                        <span className="text-xl">{item.emoji}</span>
                        <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>

                      {/* Label & Badge */}
                      <div className="flex-1 text-left">
                        <span className={`font-bold text-base ${item.danger ? 'text-[#ffb3ba]' : 'text-white'} group-hover:text-white transition-colors`}>
                          {item.label}
                        </span>
                      </div>

                      {/* Badge */}
                      {item.badge && (
                        <div className="ml-2 w-7 h-7 rounded-full bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg animate-pulse">
                          <span className="text-xs font-black text-[#744210]">{item.badge}</span>
                        </div>
                      )}

                      {/* Arrow */}
                      <div className={`ml-3 transition-transform group-hover:translate-x-1 ${item.danger ? 'text-[#ffb3ba]' : 'text-gray-400'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0 border-t border-white/10 p-5">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="text-2xl">📸</div>
                  <div className="font-black text-white text-sm">Aspect Operations</div>
                </div>
                <div className="text-xs text-gray-500">Turistik Fotoğraf Yönetimi</div>
                <div className="text-xs font-bold text-[#9dd9ea] mt-1">v1.0.0 • 2026</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}