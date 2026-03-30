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

// Sabit parçacık pozisyonları — her render'da Math.random() çağrılmaz
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 100,
  tx: ((i * 37 + 11) % 100) + ((i % 2 === 0 ? 1 : -1) * ((i * 19 + 5) % 20 + 5)),
  ty: ((i * 53 + 7) % 100) - ((i * 13 + 9) % 30 + 10),
  dur: 6 + (i % 5),
  delay: (i * 0.4) % 3,
  size: i % 3 === 0 ? 2 : 1,
  color: i % 3 === 0 ? '#d4b5f7' : i % 3 === 1 ? '#9dd9ea' : '#ffd4a3',
  opacity: i % 4 === 0 ? 0.7 : 0.4,
}));

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('signin');

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState('');
  const [signUpCompanyCode, setSignUpCompanyCode] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpPasswordConfirm, setShowSignUpPasswordConfirm] = useState(false);

  const [companyValidation, setCompanyValidation] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'suspended'>('idle');
  const [companyInfo, setCompanyInfo] = useState<{ name: string; emoji: string; color: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const code = signUpCompanyCode.trim().toLowerCase();
    if (!code) { setCompanyValidation('idle'); setCompanyInfo(null); return; }
    if (code.length < 2) { setCompanyValidation('idle'); setCompanyInfo(null); return; }
    setCompanyValidation('checking');
    setCompanyInfo(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/public/validate-company/${encodeURIComponent(code)}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (!res.ok) { setCompanyValidation('idle'); return; }
        const data = await res.json();
        if (!data.valid) {
          setCompanyValidation(data.reason === 'suspended' ? 'suspended' : 'invalid');
          setCompanyInfo(null);
        } else {
          setCompanyValidation('valid');
          setCompanyInfo({ name: data.company.name, emoji: data.company.emoji || '🏢', color: data.company.color || '#a855f7' });
        }
      } catch { setCompanyValidation('idle'); }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [signUpCompanyCode]);

  const handleSignIn = async () => {
    setError('');
    if (!signInEmail || !signInPassword) { setError('E-posta ve şifre zorunludur.'); return; }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: signInEmail.toLowerCase().trim(),
        password: signInPassword,
      });
      if (authError) {
        if (authError.message.includes('Invalid login credentials')) setError('Hatalı e-posta veya şifre.');
        else if (authError.message.includes('Email not confirmed')) setError('E-posta adresiniz henüz onaylanmamış.');
        else setError(`Giriş hatası: ${authError.message}`);
        return;
      }
      if (!data.session || !data.user) { setError('Giriş başarısız. Lütfen tekrar deneyin.'); return; }
      let user = data.user;
      let session = data.session;
      try {
        const { data: fresh } = await supabase.auth.refreshSession();
        if (fresh.session?.user) { user = fresh.session.user; session = fresh.session; }
      } catch { /* ignore */ }
      const role: UserRole = (user.user_metadata?.role as UserRole) || 'bekleyen';
      const name: string = user.user_metadata?.full_name || user.email || '';
      const companyId: string = user.user_metadata?.company_id || '';
      onLogin(role, name, user.id, session.access_token, user.user_metadata?.avatar || '', user.email || '', companyId);
    } catch (err) {
      setError(`Beklenmeyen hata: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(''); setSuccessMsg('');
    if (!signUpName.trim()) { setError('Ad Soyad zorunludur.'); return; }
    if (!signUpEmail.trim()) { setError('E-posta zorunludur.'); return; }
    if (signUpPassword.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }
    if (signUpPassword !== signUpPasswordConfirm) { setError('Şifreler eşleşmiyor.'); return; }
    if (!signUpCompanyCode.trim()) { setError('Şirket Kodu zorunludur.'); return; }
    if (companyValidation === 'checking') { setError('Şirket kodu doğrulanıyor, lütfen bekleyin.'); return; }
    if (companyValidation === 'invalid') { setError('Geçersiz şirket kodu. Yöneticinizden doğru kodu alın.'); return; }
    if (companyValidation === 'suspended') { setError('Bu şirket hesabı askıya alınmıştır.'); return; }
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
      if (!res.ok) { setError(json.error || 'Kayıt olunamadı.'); return; }
      setSuccessMsg('Hesabınız oluşturuldu! Giriş yapılıyor...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: signUpEmail.toLowerCase().trim(),
        password: signUpPassword,
      });
      if (signInError || !signInData.session) {
        setSuccessMsg(''); setError('Hesap oluşturuldu fakat giriş yapılamadı. Lütfen giriş yapın.');
        setMode('signin'); setSignInEmail(signUpEmail); return;
      }
      const user = signInData.user!;
      const session = signInData.session;
      const role: UserRole = (user.user_metadata?.role as UserRole) || 'bekleyen';
      const name: string = user.user_metadata?.full_name || user.email || '';
      const companyId: string = user.user_metadata?.company_id || '';
      onLogin(role, name, user.id, session.access_token, user.user_metadata?.avatar || '', user.email || '', companyId);
    } catch (err) {
      setError(`Beklenmeyen hata: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') mode === 'signin' ? handleSignIn() : handleSignUp();
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-5"
      style={{ background: 'var(--app-bg, linear-gradient(145deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}
    >
      {/* ── Arka plan orb'ları ── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ width: 380, height: 380, borderRadius: '50%', top: -120, left: -120, background: 'radial-gradient(circle, rgba(var(--app-accent-rgb),0.18) 0%, transparent 70%)', filter: 'blur(40px)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute pointer-events-none"
        style={{ width: 320, height: 320, borderRadius: '50%', bottom: -80, right: -80, background: 'radial-gradient(circle, rgba(157,217,234,0.14) 0%, transparent 70%)', filter: 'blur(40px)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div
        className="absolute pointer-events-none"
        style={{ width: 200, height: 200, borderRadius: '50%', top: '40%', right: '10%', background: 'radial-gradient(circle, rgba(255,212,163,0.10) 0%, transparent 70%)', filter: 'blur(30px)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* ── Floating particles ── */}
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute pointer-events-none rounded-full"
          style={{
            width: p.size * 2,
            height: p.size * 2,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
          }}
          animate={{
            y: [0, -(p.ty - p.y) * 1.5, 0],
            x: [0, (p.tx - p.x) * 0.8, 0],
            opacity: [0, p.opacity, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        />
      ))}

      {/* ── Dekoratif kamera ikonları ── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ bottom: 32, left: 24, opacity: 0.08 }}
        animate={{ rotate: [0, 8, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Camera style={{ width: 96, height: 96, color: '#9dd9ea' }} strokeWidth={1} />
      </motion.div>
      <motion.div
        className="absolute pointer-events-none"
        style={{ top: 24, right: 20, opacity: 0.06 }}
        animate={{ rotate: [0, -12, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        <Camera style={{ width: 120, height: 120, color: '#d4b5f7' }} strokeWidth={1} />
      </motion.div>

      {/* ── Grid desen ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(var(--app-accent-rgb),0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--app-accent-rgb),0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── Ana içerik ── */}
      <div className="relative z-10 w-full" style={{ maxWidth: 390 }}>

        {/* ── LOGO BÖLÜMÜ ── */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-7"
        >
          {/* Logo rozeti */}
          <motion.div
            className="inline-flex items-center gap-3 mb-4"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Kare logo */}
            <div
              className="relative flex items-center justify-center"
              style={{
                width: 52, height: 52, borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(var(--app-accent-rgb),0.4), rgba(157,217,234,0.25))',
                border: '1px solid rgba(var(--app-accent-rgb),0.5)',
                boxShadow: '0 0 24px rgba(var(--app-accent-rgb),0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            >
              <Camera style={{ width: 26, height: 26, color: '#d4b5f7' }} strokeWidth={1.5} />
              {/* Glow halkası */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ border: '1px solid rgba(var(--app-accent-rgb),0.6)' }}
                animate={{ opacity: [0.3, 0.9, 0.3], scale: [1, 1.08, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {/* Metin */}
            <div className="text-left">
              <div
                className="font-black tracking-widest uppercase"
                style={{ fontSize: 11, color: 'rgba(var(--app-accent-rgb),0.7)', letterSpacing: '0.22em' }}
              >
                Operasyon
              </div>
              <div
                className="font-black tracking-wide"
                style={{ fontSize: 18, color: '#fff', letterSpacing: '0.04em', lineHeight: 1.1, marginTop: 1 }}
              >
                Paneli
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}
          >
            Operasyon & Satış Platformu
          </motion.p>
        </motion.div>

        {/* ── SEKMELer ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex gap-1.5 mb-3"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 4,
          }}
        >
          {[
            { key: 'signin', label: 'Giriş Yap', icon: <LogIn style={{ width: 14, height: 14 }} />, color: '#9dd9ea' },
            { key: 'signup', label: 'Hesap Oluştur', icon: <UserPlus style={{ width: 14, height: 14 }} />, color: '#ffd4a3' },
          ].map((tab) => (
            <motion.button
              key={tab.key}
              onClick={() => { setMode(tab.key as AuthMode); setError(''); setSuccessMsg(''); }}
              whileTap={{ scale: 0.97 }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all"
              style={{
                fontSize: 12,
                fontWeight: 700,
                background: mode === tab.key
                  ? `linear-gradient(135deg, ${tab.color}22, ${tab.color}12)`
                  : 'transparent',
                border: mode === tab.key ? `1px solid ${tab.color}35` : '1px solid transparent',
                color: mode === tab.key ? tab.color : 'rgba(255,255,255,0.35)',
                boxShadow: mode === tab.key ? `0 0 12px ${tab.color}20` : 'none',
              }}
            >
              {tab.icon}
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* ── FORM KARTI ── */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.28, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 24,
            padding: '24px 22px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Kart üst ışığı */}
          <div
            className="absolute inset-x-0 top-0 h-px rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--app-accent-rgb),0.5), rgba(157,217,234,0.4), transparent)' }}
          />

          {/* Hata / Başarı mesajları */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-3 rounded-2xl mb-4"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', padding: '12px 14px' }}
              >
                <AlertCircle style={{ width: 16, height: 16, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>{error}</p>
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-3 rounded-2xl mb-4"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', padding: '12px 14px' }}
              >
                <CheckCircle2 style={{ width: 16, height: 16, color: '#4ade80', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#86efac' }}>{successMsg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ─── GİRİŞ FORMU ─── */}
            {mode === 'signin' && (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <InputField
                  label="E-posta Adresi"
                  icon={<Mail style={{ width: 16, height: 16 }} />}
                  type="email"
                  value={signInEmail}
                  onChange={(v) => setSignInEmail(v)}
                  onKeyPress={handleKeyPress}
                  placeholder="ornek@email.com"
                  disabled={loading}
                  autoComplete="email"
                  accentColor="#9dd9ea"
                />
                <InputField
                  label="Şifre"
                  icon={<Lock style={{ width: 16, height: 16 }} />}
                  type={showSignInPassword ? 'text' : 'password'}
                  value={signInPassword}
                  onChange={(v) => setSignInPassword(v)}
                  onKeyPress={handleKeyPress}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                  accentColor="#ffd4a3"
                  suffix={
                    <button type="button" onClick={() => setShowSignInPassword(!showSignInPassword)} style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center' }}>
                      {showSignInPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                    </button>
                  }
                />

                <ShimmerButton
                  onClick={handleSignIn}
                  disabled={loading}
                  gradient="linear-gradient(135deg, #9dd9ea, #b8d4f1, var(--app-accent, #a855f7))"
                  label={loading ? 'Giriş yapılıyor...' : 'Giriş Yap →'}
                  loading={loading}
                />
              </motion.div>
            )}

            {/* ─── KAYIT FORMU ─── */}
            {mode === 'signup' && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <InputField label="Ad Soyad" icon={<User style={{ width: 16, height: 16 }} />} type="text" value={signUpName} onChange={setSignUpName} onKeyPress={handleKeyPress} placeholder="Adınız Soyadınız" disabled={loading} autoComplete="name" accentColor="#ffd4a3" />
                <InputField label="E-posta" icon={<Mail style={{ width: 16, height: 16 }} />} type="email" value={signUpEmail} onChange={setSignUpEmail} onKeyPress={handleKeyPress} placeholder="ornek@email.com" disabled={loading} autoComplete="email" accentColor="#9dd9ea" />
                <InputField label="Telefon (isteğe bağlı)" icon={<Phone style={{ width: 16, height: 16 }} />} type="tel" value={signUpPhone} onChange={setSignUpPhone} onKeyPress={handleKeyPress} placeholder="+90 5xx xxx xx xx" disabled={loading} autoComplete="tel" accentColor="#9dd9ea" />
                <InputField
                  label="Şifre"
                  icon={<Lock style={{ width: 16, height: 16 }} />}
                  type={showSignUpPassword ? 'text' : 'password'}
                  value={signUpPassword}
                  onChange={setSignUpPassword}
                  onKeyPress={handleKeyPress}
                  placeholder="En az 6 karakter"
                  disabled={loading}
                  autoComplete="new-password"
                  accentColor="#ffd4a3"
                  suffix={
                    <button type="button" onClick={() => setShowSignUpPassword(!showSignUpPassword)} style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center' }}>
                      {showSignUpPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                    </button>
                  }
                />
                <InputField
                  label="Şifre Tekrar"
                  icon={<Lock style={{ width: 16, height: 16 }} />}
                  type={showSignUpPasswordConfirm ? 'text' : 'password'}
                  value={signUpPasswordConfirm}
                  onChange={setSignUpPasswordConfirm}
                  onKeyPress={handleKeyPress}
                  placeholder="Şifrenizi tekrar girin"
                  disabled={loading}
                  autoComplete="new-password"
                  accentColor="#ffd4a3"
                  suffix={
                    <button type="button" onClick={() => setShowSignUpPasswordConfirm(!showSignUpPasswordConfirm)} style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center' }}>
                      {showSignUpPasswordConfirm ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                    </button>
                  }
                />

                {/* Şirket kodu */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, marginLeft: 2 }}>
                    Şirket Kodu
                  </label>
                  <div
                    className="relative flex items-center"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: `1px solid ${
                        companyValidation === 'valid' ? 'rgba(52,211,153,0.5)'
                          : companyValidation === 'invalid' || companyValidation === 'suspended' ? 'rgba(239,68,68,0.5)'
                          : 'rgba(255,255,255,0.1)'
                      }`,
                      borderRadius: 14,
                      transition: 'border-color 0.25s',
                      boxShadow: companyValidation === 'valid' ? '0 0 12px rgba(52,211,153,0.15)' : 'none',
                    }}
                  >
                    <div style={{ position: 'absolute', left: 13, color: companyValidation === 'valid' ? '#34d399' : companyValidation === 'invalid' || companyValidation === 'suspended' ? '#f87171' : 'rgba(156,163,175,1)' }}>
                      <Building2 style={{ width: 16, height: 16 }} />
                    </div>
                    <input
                      type="text"
                      value={signUpCompanyCode}
                      onChange={(e) => setSignUpCompanyCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      onKeyPress={handleKeyPress}
                      placeholder="Yöneticinizden aldığınız kod"
                      disabled={loading}
                      autoComplete="off"
                      autoCapitalize="none"
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        color: '#fff', fontSize: 13, padding: '12px 40px 12px 38px',
                        fontFamily: signUpCompanyCode ? 'monospace' : 'inherit',
                      }}
                    />
                    <div style={{ position: 'absolute', right: 13 }}>
                      {companyValidation === 'checking' && <Loader2 style={{ width: 15, height: 15, color: '#d4b5f7' }} className="animate-spin" />}
                      {companyValidation === 'valid' && <CheckCircle2 style={{ width: 15, height: 15, color: '#4ade80' }} />}
                      {(companyValidation === 'invalid' || companyValidation === 'suspended') && <AlertCircle style={{ width: 15, height: 15, color: '#f87171' }} />}
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    {companyValidation === 'valid' && companyInfo && (
                      <motion.div key="valid" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 mt-1.5 ml-1">
                        <span style={{ fontSize: 13 }}>{companyInfo.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: companyInfo.color }}>{companyInfo.name}</span>
                        <span style={{ fontSize: 10, color: '#4ade80' }}>— Geçerli ✓</span>
                      </motion.div>
                    )}
                    {companyValidation === 'invalid' && (
                      <motion.p key="inv" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ fontSize: 11, color: '#f87171', marginTop: 6, marginLeft: 4 }}>
                        Bu kod sistemde kayıtlı değil.
                      </motion.p>
                    )}
                    {companyValidation === 'suspended' && (
                      <motion.p key="sus" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ fontSize: 11, color: '#f87171', marginTop: 6, marginLeft: 4 }}>
                        Bu şirket hesabı askıya alınmış.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Info notu */}
                <div style={{ background: 'rgba(157,217,234,0.08)', border: '1px solid rgba(157,217,234,0.18)', borderRadius: 14, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertCircle style={{ width: 14, height: 14, color: '#9dd9ea', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    Hesabınız <span style={{ color: '#ffd4a3', fontWeight: 700 }}>bekleyen</span> rolüyle oluşturulur. Yönetici rolünüzü aktif ettikten sonra erişebilirsiniz.
                  </p>
                </div>

                <ShimmerButton
                  onClick={handleSignUp}
                  disabled={loading}
                  gradient="linear-gradient(135deg, #ffd4a3, #fb923c, #9dd9ea)"
                  label={loading ? 'Hesap oluşturuluyor...' : 'Hesap Oluştur →'}
                  loading={loading}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Alt bağlantılar ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}
        >
          <motion.a
            href="/apply"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center justify-center gap-2 w-full"
            style={{
              background: 'rgba(167,199,231,0.07)',
              border: '1px solid rgba(167,199,231,0.18)',
              borderRadius: 14,
              padding: '11px 16px',
              color: '#a7c7e7',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Building2 style={{ width: 14, height: 14 }} />
            Şirketinizi sisteme eklemek ister misiniz?
            <ExternalLink style={{ width: 11, height: 11, opacity: 0.6 }} />
          </motion.a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera style={{ width: 13, height: 13, color: '#ffd4a3' }} />
            <span style={{ fontSize: 11, background: 'linear-gradient(90deg, #9dd9ea, #ffd4a3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>
              Profesyonel Fotoğrafçılık Yönetimi
            </span>
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
            © 2025 <span style={{ color: '#9dd9ea' }}>Operasyon Paneli</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ── Yardımcı bileşenler ──────────────────────────────────────

function InputField({
  label, icon, type, value, onChange, onKeyPress, placeholder, disabled, autoComplete, accentColor, suffix,
}: {
  label: string;
  icon: React.ReactNode;
  type: string;
  value: string;
  onChange: (v: string) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  placeholder: string;
  disabled?: boolean;
  autoComplete?: string;
  accentColor: string;
  suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, marginLeft: 2 }}>
        {label}
      </label>
      <motion.div
        animate={{ boxShadow: focused ? `0 0 0 1px ${accentColor}50, 0 0 16px ${accentColor}18` : '0 0 0 0px transparent' }}
        transition={{ duration: 0.2 }}
        style={{ position: 'relative', borderRadius: 14 }}
      >
        <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused ? accentColor : 'rgba(156,163,175,1)', transition: 'color 0.2s' }}>
          {icon}
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={onKeyPress}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          style={{
            width: '100%',
            background: focused ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.3)',
            border: `1px solid ${focused ? accentColor + '55' : 'rgba(255,255,255,0.09)'}`,
            borderRadius: 14,
            color: '#fff',
            fontSize: 13,
            padding: `12px ${suffix ? '40px' : '14px'} 12px 38px`,
            outline: 'none',
            transition: 'border-color 0.2s, background 0.2s',
            boxSizing: 'border-box',
          }}
        />
        {suffix && (
          <div style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)' }}>
            {suffix}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ShimmerButton({ onClick, disabled, gradient, label, loading }: {
  onClick: () => void;
  disabled: boolean;
  gradient: string;
  label: string;
  loading: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      className="relative w-full overflow-hidden"
      style={{
        borderRadius: 14,
        padding: '14px 0',
        fontWeight: 800,
        fontSize: 14,
        color: '#0d0a2e',
        background: gradient,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        marginTop: 4,
      }}
    >
      {/* Shimmer */}
      {!disabled && (
        <motion.div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)' }}
          animate={{ x: ['-120%', '120%'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
        />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading && (
          <motion.div
            style={{ width: 16, height: 16, border: '2px solid rgba(13,10,46,0.25)', borderTop: '2px solid #0d0a2e', borderRadius: '50%' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {label}
      </span>
    </motion.button>
  );
}