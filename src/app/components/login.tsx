import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Camera, User } from 'lucide-react';
import { motion } from 'motion/react';
import logoImage from 'figma:asset/6a6eb47a9fe2eac247532ef175a68c5b1b4ebed7.png';

export type UserRole = 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';

interface LoginProps {
  onLogin: (role: UserRole, name: string) => void;
}

// Mock kullanıcı veritabanı
const MOCK_USERS: Record<string, { email: string; password: string; role: UserRole; name: string; emoji: string; color: string }> = {
  'admin@aspect.com': { 
    email: 'admin@aspect.com', 
    password: '123456', 
    role: 'yonetici', 
    name: 'Ahmet Yılmaz',
    emoji: '👨‍💼',
    color: 'from-[#9dd9ea] to-[#b8d4f1]'
  },
  'ust-mudur@aspect.com': { 
    email: 'ust-mudur@aspect.com', 
    password: '123456', 
    role: 'ust-mudur', 
    name: 'Mehmet Demir',
    emoji: '👔',
    color: 'from-[#ffd4a3] to-[#ffb86c]'
  },
  'mudur@aspect.com': { 
    email: 'mudur@aspect.com', 
    password: '123456', 
    role: 'mudur', 
    name: 'Ayşe Kaya',
    emoji: '👩‍💼',
    color: 'from-[#a8e6cf] to-[#7dd3a0]'
  },
  'operasyon@aspect.com': { 
    email: 'operasyon@aspect.com', 
    password: '123456', 
    role: 'operasyon', 
    name: 'Fatma Şahin',
    emoji: '⚙️',
    color: 'from-[#9dd9ea] to-[#ffd4a3]'
  },
  'personel@aspect.com': { 
    email: 'personel@aspect.com', 
    password: '123456', 
    role: 'personel', 
    name: 'Ali Yıldız',
    emoji: '📸',
    color: 'from-[#b8d4f1] to-[#9dd9ea]'
  },
  'idari@aspect.com': { 
    email: 'idari@aspect.com', 
    password: '123456', 
    role: 'idari', 
    name: 'Zeynep Çelik',
    emoji: '📋',
    color: 'from-[#ffd4a3] to-[#a8e6cf]'
  },
  'bekleyen@aspect.com': { 
    email: 'bekleyen@aspect.com', 
    password: '123456', 
    role: 'bekleyen', 
    name: 'Can Öztürk',
    emoji: '⏳',
    color: 'from-gray-400 to-gray-500'
  },
};

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showQuickLogin, setShowQuickLogin] = useState(true);

  // ✅ Kullanıcıyı aspect_users'a ekle/güncelle ve gerçek ID'yi al
  const ensureUserInAspectUsers = (user: { email: string; password: string; role: UserRole; name: string; emoji: string; color: string }): string => {
    // Stable ID: Her MOCK_USER için rol bazlı sabit ID
    const stableId = `mock-user-${user.role}`;
    
    try {
      const aspectUsersStr = localStorage.getItem('aspect_users');
      let aspectUsers: any[] = [];
      
      if (aspectUsersStr) {
        aspectUsers = JSON.parse(aspectUsersStr);
        
        // 🔍 full_name VE role'e göre kullanıcıyı bul (field adı: full_name!)
        const matchedUser = aspectUsers.find((u: any) =>
          (u.full_name === user.name || u.name === user.name) && u.role === user.role
        );
        
        if (matchedUser?.id) {
          // ✅ Gerçek ID bulundu
          return matchedUser.id;
        }
        
        // 🔍 stableId ile bul (daha önce eklendiyse)
        const existingMock = aspectUsers.find((u: any) => u.id === stableId);
        if (existingMock) {
          return stableId;
        }
        
        // ➕ Kullanıcı listede yok - ekle
        const newUser = {
          id: stableId,
          email: user.email,
          full_name: user.name,
          role: user.role,
          created_at: new Date().toISOString(),
          last_sign_in: new Date().toISOString(),
          phone: '',
        };
        aspectUsers.push(newUser);
        localStorage.setItem('aspect_users', JSON.stringify(aspectUsers));
        return stableId;
        
      } else {
        // aspect_users hiç yok - yeni oluştur
        const newUsers = [{
          id: stableId,
          email: user.email,
          full_name: user.name,
          role: user.role,
          created_at: new Date().toISOString(),
          last_sign_in: new Date().toISOString(),
          phone: '',
        }];
        localStorage.setItem('aspect_users', JSON.stringify(newUsers));
        return stableId;
      }
    } catch (e) {
      // Silent fail - use stable ID as fallback
      return stableId;
    }
  };

  const handleLogin = () => {
    if (!email || !password) {
      alert('Lütfen e-posta ve şifre girin');
      return;
    }

    // Mock kullanıcıyı kontrol et
    const user = MOCK_USERS[email.toLowerCase()];
    
    if (!user || user.password !== password) {
      alert('Hatalı e-posta veya şifre');
      return;
    }

    // ✅ aspect_users'dan gerçek kullanıcı ID'sini al (yoksa ekle)
    const userId = ensureUserInAspectUsers(user);

    // LocalStorage'a kullanıcı bilgilerini kaydet
    localStorage.setItem('aspectUser', JSON.stringify({
      id: userId,
      email: user.email,
      role: user.role,
      name: user.name,
      avatar: user.emoji,
      hideBirthdayFromOthers: false,
      hideOthersBirthdays: false,
    }));

    // Create mock users list for birthday system
    const mockUsersList = Object.values(MOCK_USERS).map(u => ({
      id: u.email,
      email: u.email,
      name: u.name,
      role: u.role,
      avatar: u.emoji,
      birthday: '',
      hideBirthdayFromOthers: false,
      hideOthersBirthdays: false,
    }));
    localStorage.setItem('aspectUsers', JSON.stringify(mockUsersList));

    // Login callback
    onLogin(user.role, user.name);
  };

  // Hızlı giriş
  const handleQuickLogin = (userEmail: string) => {
    const user = MOCK_USERS[userEmail];
    
    // ✅ aspect_users'dan gerçek kullanıcı ID'sini al (yoksa ekle)
    const userId = ensureUserInAspectUsers(user);
    
    // LocalStorage'a kaydet
    localStorage.setItem('aspectUser', JSON.stringify({
      id: userId,
      email: user.email,
      role: user.role,
      name: user.name,
      avatar: user.emoji,
      hideBirthdayFromOthers: false,
      hideOthersBirthdays: false,
    }));

    // Create mock users list for birthday system
    const mockUsersList = Object.values(MOCK_USERS).map(u => ({
      id: u.email,
      email: u.email,
      name: u.name,
      role: u.role,
      avatar: u.emoji,
      birthday: '',
      hideBirthdayFromOthers: false,
      hideOthersBirthdays: false,
    }));
    localStorage.setItem('aspectUsers', JSON.stringify(mockUsersList));

    // Direkt giriş yap
    onLogin(user.role, user.name);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const getRoleTitle = (role: UserRole): string => {
    const titles: Record<UserRole, string> = {
      'yonetici': 'Yönetici',
      'ust-mudur': 'Üst Müdür',
      'mudur': 'Müdür',
      'operasyon': 'Operasyon',
      'personel': 'Personel',
      'idari': 'İdari',
      'bekleyen': 'Bekleyen',
    };
    return titles[role];
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] flex items-center justify-center p-6">
      {/* Animated Background Particles */}
      {[...Array(20)].map((_, i) => {
        const randomX1 = Math.random() * 100;
        const randomY1 = Math.random() * 100;
        const randomX2 = Math.random() * 100;
        const randomY2 = Math.random() * 100;
        const randomX3 = Math.random() * 100;
        const randomY3 = Math.random() * 100;
        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#9dd9ea] rounded-full"
            style={{
              left: `${randomX1}%`,
              top: `${randomY1}%`,
            }}
            initial={{
              opacity: 0,
            }}
            animate={{
              y: [`${randomY1}vh`, `${randomY2}vh`, `${randomY3}vh`],
              x: [`${randomX1}vw`, `${randomX2}vw`, `${randomX3}vw`],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        );
      })}

      {/* Gradient Orbs */}
      <motion.div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br from-[#9dd9ea]/30 to-transparent blur-3xl"
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
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-[#ffd4a3]/30 to-transparent blur-3xl"
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

      {/* Camera Lens Decorations */}
      <motion.div
        className="absolute bottom-10 left-10 opacity-20"
        animate={{
          rotate: [0, 10, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Camera className="w-24 h-24 text-[#9dd9ea]" strokeWidth={1} />
      </motion.div>
      <motion.div
        className="absolute top-20 right-10 opacity-10"
        animate={{
          rotate: [0, -15, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
      >
        <Camera className="w-32 h-32 text-[#ffd4a3]" strokeWidth={1} />
      </motion.div>

      {/* Light Rays */}
      <motion.div
        className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-transparent via-[#06b6d4]/20 to-transparent"
        animate={{
          opacity: [0.1, 0.3, 0.1],
          scaleY: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-0 right-1/3 w-1 h-full bg-gradient-to-b from-transparent via-[#fb923c]/20 to-transparent"
        animate={{
          opacity: [0.1, 0.3, 0.1],
          scaleY: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          {/* Logo Container with Glow Effect */}
          <motion.div
            className="relative inline-block mb-8"
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Glow Effect Behind Logo */}
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-[#9dd9ea]/50 via-transparent to-[#ffd4a3]/50 scale-150" />
            
            {/* Logo */}
            <img 
              src={logoImage} 
              alt="Aspect Logo" 
              className="relative w-72 h-auto drop-shadow-2xl scale-[2.8] translate-y-12"
            />
            
            {/* Orbiting Ring */}
            <motion.div
              className="absolute inset-0 border-2 border-[#9dd9ea]/30 rounded-full"
              style={{ width: '120%', height: '120%', top: '-10%', left: '-10%' }}
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-[#9dd9ea] rounded-full -translate-x-1/2" />
            </motion.div>

            <motion.div
              className="absolute inset-0 border border-[#ffd4a3]/20 rounded-full"
              style={{ width: '140%', height: '140%', top: '-20%', left: '-20%' }}
              animate={{
                rotate: -360,
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <div className="absolute bottom-0 right-1/4 w-1.5 h-1.5 bg-[#ffd4a3] rounded-full" />
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-sm text-gray-400 font-medium tracking-wide"
          >
            Operasyon ve Satış Platformu
          </motion.p>
        </motion.div>

        {/* Quick Login Buttons */}
        {showQuickLogin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="mb-6"
          >
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-[#9dd9ea]" />
                  Hızlı Giriş
                </h3>
                <button
                  onClick={() => setShowQuickLogin(false)}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Gizle
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(MOCK_USERS).map((user, index) => (
                  <motion.button
                    key={user.email}
                    onClick={() => handleQuickLogin(user.email)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className={`relative p-3 rounded-xl bg-gradient-to-br ${user.color} bg-opacity-20 border border-white/10 hover:border-white/30 transition-all group overflow-hidden`}
                  >
                    {/* Hover Glow */}
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all" />
                    
                    <div className="relative flex items-center gap-2">
                      <div className="text-2xl">{user.emoji}</div>
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{getRoleTitle(user.role)}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Show Quick Login Button if hidden */}
        {!showQuickLogin && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowQuickLogin(true)}
            className="w-full mb-4 py-2 text-sm text-[#9dd9ea] hover:text-[#ffd4a3] transition-colors"
          >
            Hızlı Giriş Seçeneklerini Göster
          </motion.button>
        )}

        {/* Login Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-3xl p-8 shadow-2xl"
        >
          {/* Inner Glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#9dd9ea]/5 to-[#ffd4a3]/5" />

          <div className="relative space-y-5">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">
                E-posta Adresi
              </label>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea] to-[#ffd4a3] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-gray-400 group-focus-within:text-[#9dd9ea] transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="ornek@aspect.com"
                    className="w-full pl-12 pr-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#9dd9ea]/50 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">
                Şifre
              </label>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea] to-[#ffd4a3] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-gray-400 group-focus-within:text-[#ffd4a3] transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#ffd4a3]/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <button className="text-sm text-[#9dd9ea] hover:text-[#ffd4a3] transition-colors font-medium">
                Şifremi Unuttum?
              </button>
            </div>

            {/* Login Button */}
            <motion.button
              onClick={handleLogin}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative w-full py-4 rounded-2xl font-bold text-white overflow-hidden group"
            >
              {/* Animated Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea] via-[#b8d4f1] to-[#ffd4a3] opacity-100" />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-[#ffd4a3] via-[#9dd9ea] to-[#b8d4f1]"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
              
              {/* Shine Effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{
                  x: ['-200%', '200%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
              />

              <span className="relative z-10 flex items-center justify-center gap-2">
                Giriş Yap
                <motion.svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  animate={{ x: [0, 5, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </motion.svg>
              </span>
            </motion.button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 text-gray-400 bg-transparent">veya</span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white font-medium hover:border-white/20 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm">Google</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white font-medium hover:border-white/20 transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                <span className="text-sm">Apple</span>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Bottom Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 text-center space-y-4"
        >
          {/* Professional Photography Management Badge */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <Camera className="w-4 h-4 text-[#ffd4a3]" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9dd9ea] to-[#ffd4a3] font-bold">
              Profesyonel Fotoğrafçılık Yönetimi
            </span>
          </div>

          {/* Copyright */}
          <p className="text-xs text-gray-500">
            © 2025 <span className="text-[#9dd9ea] font-semibold">Aspect</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}