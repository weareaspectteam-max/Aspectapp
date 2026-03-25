import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, Eye, EyeOff, Camera, User, UserPlus, LogIn, Phone, AlertCircle, CheckCircle2, Building2, ExternalLink, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, SERVER_URL } from '../lib/supabase';
import { buildHeaders } from '../lib/api';
import { publicAnonKey } from '../lib/supabase-info';

export type UserRole = 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen' | 'superadmin';

interface LoginProps {
  onLogin: (role: UserRole, name: string, userId: string, accessToken: string, avatar: string, email: string, companyId: string) => void;
}

type AuthMode = 'signin' | 'signup';

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('signin');

  // Sign In fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up fields
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState('');
  const [signUpCompanyCode, setSignUpCompanyCode] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpPasswordConfirm, setShowSignUpPasswordConfirm] = useState(false);

  // Şirket kodu doğrulama state
  const [companyValidation, setCompanyValidation] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'suspended'>('idle');
  const [companyInfo, setCompanyInfo] = useState<{ name: string; emoji: string; color: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ─── Şirket kodu gerçek zamanlı doğrulama ──────────────────────────
  useEffect(() => {
    const code = signUpCompanyCode.trim().toLowerCase();
    if (!code) { setCompanyValidation('idle'); setCompanyInfo(null); return; }
    if (code.length < 2) { setCompanyValidation('idle'); setCompanyInfo(null); return; }

    setCompanyValidation('checking');
    setCompanyInfo(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/superadmin/companies`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (!res.ok) { setCompanyValidation('idle'); return; }
        const data = await res.json();
        const found = (data.companies || []).find((c: any) => c.id === code);
        if (!found) {
          setCompanyValidation('invalid');
          setCompanyInfo(null);
        } else if (found.status === 'suspended') {
          setCompanyValidation('suspended');
          setCompanyInfo(null);
        } else {
          setCompanyValidation('valid');
          setCompanyInfo({ name: found.name, emoji: found.emoji || '🏢', color: found.color || '#a855f7' });
        }
      } catch {
        setCompanyValidation('idle');
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [signUpCompanyCode]);

  // ─── SIGN IN ───────────────────────────────────
  const handleSignIn = async () => {
    setError('');
    if (!signInEmail || !signInPassword) {
      setError('E-posta ve şifre zorunludur.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: signInEmail.toLowerCase().trim(),
        password: signInPassword,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Hatalı e-posta veya şifre.');
        } else if (authError.message.includes('Email not confirmed')) {
          setError('E-posta adresiniz henüz onaylanmamış.');
        } else {
          setError(`Giriş hatası: ${authError.message}`);
        }
        return;
      }

      if (!data.session || !data.user) {
        setError('Giriş başarısız. Lütfen tekrar deneyin.');
        return;
      }

      // Giriş sonrası token'ı yenile — Supabase'deki en güncel user_metadata'yı yansıtır
      // (bootstrapSuperAdmin veya rol güncellemesi sonrası stale JWT sorununu çözer)
      let user = data.user;
      let session = data.session;
      try {
        const { data: fresh } = await supabase.auth.refreshSession();
        if (fresh.session?.user) {
          user = fresh.session.user;
          session = fresh.session;
        }
      } catch { /* refresh başarısız — orijinal session ile devam */ }

      const role: UserRole = (user.user_metadata?.role as UserRole) || 'bekleyen';
      const name: string = user.user_metadata?.full_name || user.email || '';
      const companyId: string = user.user_metadata?.company_id || '';

      onLogin(role, name, user.id, session.access_token, user.user_metadata?.avatar || '', user.email || '', companyId);
    } catch (err) {
      setError(`Beklenmeyen hata: ${err}`);
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── SIGN UP ───────────────────────────────────
  const handleSignUp = async () => {
    setError('');
    setSuccessMsg('');

    if (!signUpName.trim()) { setError('Ad Soyad zorunludur.'); return; }
    if (!signUpEmail.trim()) { setError('E-posta zorunludur.'); return; }
    if (signUpPassword.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }
    if (signUpPassword !== signUpPasswordConfirm) { setError('Şifreler eşleşmiyor.'); return; }
    if (!signUpCompanyCode.trim()) { setError('Şirket Kodu zorunludur.'); return; }
    if (companyValidation === 'checking') { setError('Şirket kodu doğrulanıyor, lütfen bekleyin.'); return; }
    if (companyValidation === 'invalid') { setError('Geçersiz şirket kodu. Yöneticinizden doğru kodu alın.'); return; }
    if (companyValidation === 'suspended') { setError('Bu şirket hesabı askıya alınmıştır. Yöneticinizle iletişime geçin.'); return; }
    if (companyValidation !== 'valid') { setError('Lütfen geçerli bir şirket kodu girin.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/auth/signup`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          email: signUpEmail.toLowerCase().trim(),
          password: signUpPassword,
          full_name: signUpName.trim(),
          phone: signUpPhone.trim(),
          company_id: signUpCompanyCode.toLowerCase().trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Kayıt olunamadı.');
        return;
      }

      // Kayıt başarılı → otomatik giriş yap
      setSuccessMsg('Hesabınız oluşturuldu! Giriş yapılıyor...');

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: signUpEmail.toLowerCase().trim(),
        password: signUpPassword,
      });

      if (signInError || !signInData.session) {
        setSuccessMsg('');
        setError('Hesap oluşturuldu fakat giriş yapılamadı. Lütfen giriş yapın.');
        setMode('signin');
        setSignInEmail(signUpEmail);
        return;
      }

      const user = signInData.user!;
      const session = signInData.session;
      const role: UserRole = (user.user_metadata?.role as UserRole) || 'bekleyen';
      const name: string = user.user_metadata?.full_name || user.email || '';
      const companyId: string = user.user_metadata?.company_id || '';

      onLogin(role, name, user.id, session.access_token, user.user_metadata?.avatar || '', user.email || '', companyId);
    } catch (err) {
      setError(`Beklenmeyen hata: ${err}`);
      console.error('Sign up error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      mode === 'signin' ? handleSignIn() : handleSignUp();
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] flex items-center justify-center p-6">
      {/* Animated Background Particles */}
      {[...Array(18)].map((_, i) => {
        const rx1 = Math.random() * 100, ry1 = Math.random() * 100;
        const rx2 = Math.random() * 100, ry2 = Math.random() * 100;
        const rx3 = Math.random() * 100, ry3 = Math.random() * 100;
        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#9dd9ea] rounded-full"
            style={{ left: `${rx1}%`, top: `${ry1}%` }}
            initial={{ opacity: 0 }}
            animate={{ y: [`${ry1}vh`, `${ry2}vh`, `${ry3}vh`], x: [`${rx1}vw`, `${rx2}vw`, `${rx3}vw`], opacity: [0, 0.6, 0] }}
            transition={{ duration: 8 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 }}
          />
        );
      })}

      {/* Gradient Orbs */}
      <motion.div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br from-[#9dd9ea]/30 to-transparent blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-[#ffd4a3]/30 to-transparent blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {/* Camera Decorations */}
      <motion.div className="absolute bottom-10 left-10 opacity-20" animate={{ rotate: [0, 10, 0], scale: [1, 1.05, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
        <Camera className="w-24 h-24 text-[#9dd9ea]" strokeWidth={1} />
      </motion.div>
      <motion.div className="absolute top-20 right-10 opacity-10" animate={{ rotate: [0, -15, 0], scale: [1, 1.1, 1] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}>
        <Camera className="w-32 h-32 text-[#ffd4a3]" strokeWidth={1} />
      </motion.div>

      {/* Light Rays */}
      <motion.div className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-transparent via-[#06b6d4]/20 to-transparent" animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 5, repeat: Infinity }} />
      <motion.div className="absolute top-0 right-1/3 w-1 h-full bg-gradient-to-b from-transparent via-[#fb923c]/20 to-transparent" animate={{ opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 6, repeat: Infinity, delay: 1 }} />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10"
        >
          <motion.div
            className="relative inline-block mb-8"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-[#9dd9ea]/50 via-transparent to-[#ffd4a3]/50 scale-150" />
            <span className="relative text-5xl font-black tracking-[0.25em] text-white drop-shadow-2xl">ASPECT</span>
            <motion.div
              className="absolute inset-0 border-2 border-[#9dd9ea]/30 rounded-full"
              style={{ width: '120%', height: '120%', top: '-10%', left: '-10%' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-[#9dd9ea] rounded-full -translate-x-1/2" />
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

        {/* Mode Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex gap-2 mb-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-1"
        >
          <button
            onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${mode === 'signin' ? 'bg-gradient-to-r from-[#9dd9ea]/30 to-[#b8d4f1]/30 text-white border border-[#9dd9ea]/40' : 'text-gray-400 hover:text-white'}`}
          >
            <LogIn className="w-4 h-4" />
            Giriş Yap
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${mode === 'signup' ? 'bg-gradient-to-r from-[#ffd4a3]/30 to-[#fb923c]/20 text-white border border-[#ffd4a3]/40' : 'text-gray-400 hover:text-white'}`}
          >
            <UserPlus className="w-4 h-4" />
            Hesap Oluştur
          </button>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-3xl p-8 shadow-2xl"
        >
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#9dd9ea]/5 to-[#ffd4a3]/5" />

          {/* Error / Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative flex items-start gap-3 bg-red-500/20 border border-red-500/30 rounded-2xl p-4 mb-5"
              >
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative flex items-start gap-3 bg-green-500/20 border border-green-500/30 rounded-2xl p-4 mb-5"
              >
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm text-green-300">{successMsg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ─── GİRİŞ FORMU ─── */}
            {mode === 'signin' && (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="relative space-y-5"
              >
                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">E-posta Adresi</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea] to-[#ffd4a3] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                    <div className="relative flex items-center">
                      <div className="absolute left-4 text-gray-400 group-focus-within:text-[#9dd9ea] transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        type="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="ornek@email.com"
                        className="w-full pl-12 pr-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#9dd9ea]/50 transition-all"
                        disabled={loading}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Şifre</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea] to-[#ffd4a3] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                    <div className="relative flex items-center">
                      <div className="absolute left-4 text-gray-400 group-focus-within:text-[#ffd4a3] transition-colors">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        type={showSignInPassword ? 'text' : 'password'}
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="••••••••"
                        className="w-full pl-12 pr-12 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#ffd4a3]/50 transition-all"
                        disabled={loading}
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowSignInPassword(!showSignInPassword)} className="absolute right-4 text-gray-400 hover:text-white transition-colors">
                        {showSignInPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Login Button */}
                <motion.button
                  onClick={handleSignIn}
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="relative w-full py-4 rounded-2xl font-bold text-white overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea] via-[#b8d4f1] to-[#ffd4a3]" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ['-200%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2 text-[#1a1a2e]">
                    {loading ? (
                      <>
                        <motion.div className="w-5 h-5 border-2 border-[#1a1a2e]/30 border-t-[#1a1a2e] rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                        Giriş yapılıyor...
                      </>
                    ) : (
                      <>
                        Giriş Yap
                        <motion.svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </motion.svg>
                      </>
                    )}
                  </span>
                </motion.button>
              </motion.div>
            )}

            {/* ─── KAYIT FORMU ─── */}
            {mode === 'signup' && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="relative space-y-4"
              >
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Ad Soyad</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ffd4a3] to-[#9dd9ea] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                    <div className="relative flex items-center">
                      <div className="absolute left-4 text-gray-400 group-focus-within:text-[#ffd4a3] transition-colors">
                        <User className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Adınız Soyadınız"
                        className="w-full pl-12 pr-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#ffd4a3]/50 transition-all"
                        disabled={loading}
                        autoComplete="name"
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">E-posta Adresi</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea] to-[#ffd4a3] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                    <div className="relative flex items-center">
                      <div className="absolute left-4 text-gray-400 group-focus-within:text-[#9dd9ea] transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        type="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="ornek@email.com"
                        className="w-full pl-12 pr-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#9dd9ea]/50 transition-all"
                        disabled={loading}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </div>

                {/* Phone (optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">
                    Telefon <span className="text-gray-500 font-normal">(isteğe bağlı)</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#9dd9ea] to-[#ffd4a3] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                    <div className="relative flex items-center">
                      <div className="absolute left-4 text-gray-400 group-focus-within:text-[#9dd9ea] transition-colors">
                        <Phone className="w-5 h-5" />
                      </div>
                      <input
                        type="tel"
                        value={signUpPhone}
                        onChange={(e) => setSignUpPhone(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="+90 5xx xxx xx xx"
                        className="w-full pl-12 pr-4 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#9dd9ea]/50 transition-all"
                        disabled={loading}
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Şifre</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ffd4a3] to-[#9dd9ea] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                    <div className="relative flex items-center">
                      <div className="absolute left-4 text-gray-400 group-focus-within:text-[#ffd4a3] transition-colors">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        type={showSignUpPassword ? 'text' : 'password'}
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="En az 6 karakter"
                        className="w-full pl-12 pr-12 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#ffd4a3]/50 transition-all"
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowSignUpPassword(!showSignUpPassword)} className="absolute right-4 text-gray-400 hover:text-white transition-colors">
                        {showSignUpPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Şifre Tekrar</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#ffd4a3] to-[#9dd9ea] rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity" />
                    <div className="relative flex items-center">
                      <div className="absolute left-4 text-gray-400 group-focus-within:text-[#ffd4a3] transition-colors">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        type={showSignUpPasswordConfirm ? 'text' : 'password'}
                        value={signUpPasswordConfirm}
                        onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Şifrenizi tekrar girin"
                        className="w-full pl-12 pr-12 py-4 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#ffd4a3]/50 transition-all"
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowSignUpPasswordConfirm(!showSignUpPasswordConfirm)} className="absolute right-4 text-gray-400 hover:text-white transition-colors">
                        {showSignUpPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Şirket Kodu */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">
                    Şirket Kodu
                  </label>
                  <div className="relative group">
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 blur-sm transition-opacity"
                      style={{
                        background: companyValidation === 'valid'
                          ? 'linear-gradient(to right, #34d399, #9dd9ea)'
                          : companyValidation === 'invalid' || companyValidation === 'suspended'
                          ? 'linear-gradient(to right, #ef4444, #f87171)'
                          : 'linear-gradient(to right, #d4b5f7, #9dd9ea)',
                      }}
                    />
                    <div className="relative flex items-center">
                      <div
                        className="absolute left-4 transition-colors"
                        style={{
                          color: companyValidation === 'valid' ? '#34d399'
                            : companyValidation === 'invalid' || companyValidation === 'suspended' ? '#f87171'
                            : 'rgba(156,163,175,1)',
                        }}
                      >
                        <Building2 className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        value={signUpCompanyCode}
                        onChange={(e) => setSignUpCompanyCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        onKeyPress={handleKeyPress}
                        placeholder="Yöneticinizden aldığınız kod"
                        className="w-full pl-12 pr-12 py-4 bg-black/40 backdrop-blur-sm border rounded-2xl text-white placeholder:text-gray-500 focus:outline-none transition-all"
                        style={{
                          borderColor: companyValidation === 'valid' ? 'rgba(52,211,153,0.50)'
                            : companyValidation === 'invalid' || companyValidation === 'suspended' ? 'rgba(239,68,68,0.50)'
                            : 'rgba(255,255,255,0.10)',
                          fontFamily: signUpCompanyCode ? 'monospace' : 'inherit',
                        }}
                        disabled={loading}
                        autoComplete="off"
                        autoCapitalize="none"
                      />
                      {/* Sağ ikon: doğrulama durumu */}
                      <div className="absolute right-4 transition-all">
                        {companyValidation === 'checking' && (
                          <Loader2 className="w-5 h-5 text-[#d4b5f7] animate-spin" />
                        )}
                        {companyValidation === 'valid' && (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        )}
                        {(companyValidation === 'invalid' || companyValidation === 'suspended') && (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Doğrulama geri bildirimi */}
                  <AnimatePresence mode="wait">
                    {companyValidation === 'valid' && companyInfo && (
                      <motion.div
                        key="valid"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2 mt-2 ml-1"
                      >
                        <span style={{ fontSize: 16 }}>{companyInfo.emoji}</span>
                        <span className="text-xs font-semibold" style={{ color: companyInfo.color }}>
                          {companyInfo.name}
                        </span>
                        <span className="text-xs text-green-400">— Geçerli şirket ✓</span>
                      </motion.div>
                    )}
                    {companyValidation === 'invalid' && (
                      <motion.p
                        key="invalid"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-xs text-red-400 mt-2 ml-1"
                      >
                        Bu kod sistemde kayıtlı değil. Yöneticinize danışın.
                      </motion.p>
                    )}
                    {companyValidation === 'suspended' && (
                      <motion.p
                        key="suspended"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-xs text-red-400 mt-2 ml-1"
                      >
                        Bu şirket hesabı askıya alınmış.
                      </motion.p>
                    )}
                    {companyValidation === 'idle' && !signUpCompanyCode && (
                      <motion.p
                        key="hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-gray-500 mt-1.5 ml-1"
                      >
                        Şirketinizin size verdiği özel erişim kodunu girin.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Info Note */}
                <div className="flex items-start gap-3 bg-[#9dd9ea]/10 border border-[#9dd9ea]/20 rounded-2xl p-4">
                  <AlertCircle className="w-4 h-4 text-[#9dd9ea] shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Hesabınız <span className="text-[#ffd4a3] font-semibold">bekleyen</span> rolüyle oluşturulur. Bir yönetici rolünüzü aktif ettikten sonra uygulamaya erişebilirsiniz.
                  </p>
                </div>

                {/* Register Button */}
                <motion.button
                  onClick={handleSignUp}
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="relative w-full py-4 rounded-2xl font-bold text-white overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#ffd4a3] via-[#fb923c]/80 to-[#9dd9ea]" />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ['-200%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2 text-[#1a1a2e]">
                    {loading ? (
                      <>
                        <motion.div className="w-5 h-5 border-2 border-[#1a1a2e]/30 border-t-[#1a1a2e] rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                        Hesap oluşturuluyor...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Hesap Oluştur
                      </>
                    )}
                  </span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 text-center space-y-4"
        >
          {/* Şirket Başvurusu linki */}
          <motion.a
            href="/apply"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold transition-all"
            style={{
              background: 'rgba(167,199,231,0.08)',
              border: '1px solid rgba(167,199,231,0.20)',
              color: '#a7c7e7',
              textDecoration: 'none',
            }}
          >
            <Building2 className="w-4 h-4" />
            Şirketinizi sisteme eklemek ister misiniz?
            <ExternalLink className="w-3 h-3 opacity-60" />
          </motion.a>

          <div className="flex items-center justify-center gap-2 text-sm">
            <Camera className="w-4 h-4 text-[#ffd4a3]" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9dd9ea] to-[#ffd4a3] font-bold">
              Profesyonel Fotoğrafçılık Yönetimi
            </span>
          </div>
          <p className="text-xs text-gray-500">
            © 2025 <span className="text-[#9dd9ea] font-semibold">Aspect Operations</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}