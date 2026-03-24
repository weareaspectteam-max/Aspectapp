import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, User, Phone, CheckCircle2, AlertCircle, Camera, ArrowLeft } from 'lucide-react';
import { SERVER_URL } from '../lib/supabase';
import { buildHeaders } from '../lib/api';
import { publicAnonKey, projectId as pid } from '/utils/supabase/info';

// ── Statik fallback şirketler (KV yüklenmeden önce) ──────────────────────
const FALLBACK_COMPANIES: Record<string, { name: string; emoji: string; color: string; gradient: string; border: string }> = {
  aspect: { name: 'Aspect Operations', emoji: '✦',  color: '#9dd9ea', gradient: 'linear-gradient(135deg, rgba(157,217,234,0.20) 0%, rgba(157,217,234,0.05) 100%)', border: 'rgba(157,217,234,0.35)' },
  frame:  { name: 'Frame Studios',     emoji: '🖼', color: '#d4b5f7', gradient: 'linear-gradient(135deg, rgba(212,181,247,0.20) 0%, rgba(212,181,247,0.05) 100%)', border: 'rgba(212,181,247,0.35)' },
  tetra:  { name: 'Tetra Works',       emoji: '🔷', color: '#ffd4a3', gradient: 'linear-gradient(135deg, rgba(255,212,163,0.20) 0%, rgba(255,212,163,0.05) 100%)', border: 'rgba(255,212,163,0.35)' },
};

// KV company_profile verilerini display config'e çevir
const profileToConfig = (profile: any) => ({
  name:     profile.name,
  emoji:    profile.emoji || '🏢',
  color:    profile.color || '#a855f7',
  gradient: `linear-gradient(135deg, ${profile.color || '#a855f7'}20 0%, ${profile.color || '#a855f7'}08 100%)`,
  border:   `${profile.color || '#a855f7'}35`,
});

export function SignupPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();

  // Şirket profili durumu
  const [company, setCompany] = useState<{ name: string; emoji: string; color: string; gradient: string; border: string } | null>(
    companyId && FALLBACK_COMPANIES[companyId] ? FALLBACK_COMPANIES[companyId] : null
  );
  const [companyLoading, setCompanyLoading] = useState(!company);
  const [companyNotFound, setCompanyNotFound] = useState(false);

  // Şirket profilini KV'den dinamik yükle
  useEffect(() => {
    if (!companyId) { setCompanyNotFound(true); setCompanyLoading(false); return; }
    // Statik fallback varsa hemen devam et, arka planda KV'yi de kontrol et
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/superadmin/companies`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          const found = (data.companies || []).find((c: any) => c.id === companyId);
          if (found) {
            if (found.status === 'suspended') { setCompanyNotFound(true); }
            else { setCompany(profileToConfig(found)); }
          } else if (!FALLBACK_COMPANIES[companyId]) {
            setCompanyNotFound(true);
          }
        }
      } catch (_) { /* statik fallback yeterli */ }
      setCompanyLoading(false);
    };
    fetchProfile();
  }, [companyId]);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Yükleniyor
  if (companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#9dd9ea] border-t-transparent animate-spin" />
          <p className="text-white/50 text-sm">Şirket bilgileri yükleniyor…</p>
        </div>
      </div>
    );
  }

  // Geçersiz şirket
  if (companyNotFound || !company || !companyId) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}
      >
        <div
          className="text-center p-8 max-w-sm w-full"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,100,100,0.25)',
            backdropFilter: 'blur(20px)',
            borderRadius: 24,
          }}
        >
          <div className="text-5xl mb-4">❌</div>
          <p className="text-white font-bold text-xl mb-2">Geçersiz Kayıt Linki</p>
          <p className="text-white/50 text-sm mb-6">Bu kayıt linki geçerli değil. Yöneticinizden doğru linki isteyin.</p>
          <button
            onClick={() => navigate('/')}
            className="text-[#9dd9ea] text-sm underline"
          >
            Ana sayfaya dön
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    setError('');

    if (!fullName.trim()) { setError('Ad Soyad zorunludur.'); return; }
    if (!email.trim()) { setError('E-posta zorunludur.'); return; }
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }
    if (password !== passwordConfirm) { setError('Şifreler eşleşmiyor.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/auth/signup`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim(),
          company_id: companyId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Kayıt olunamadı.');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(`Beklenmeyen hata: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: '14px 16px 14px 44px',
    color: 'white',
    fontSize: 15,
    width: '100%',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 6,
    display: 'block',
  };

  // ── Başarı ekranı ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 max-w-sm w-full"
          style={{
            background: company.gradient,
            border: `1px solid ${company.border}`,
            backdropFilter: 'blur(20px)',
            borderRadius: 24,
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="text-6xl mb-4"
          >
            ✅
          </motion.div>
          <p className="text-white font-bold text-xl mb-2">Hesabınız Oluşturuldu!</p>
          <p className="text-white/60 text-sm mb-2">
            <span style={{ color: company.color }}>{company.name}</span> ekibine hoş geldiniz.
          </p>
          <p className="text-white/40 text-sm mb-6">
            Hesabınız yönetici onayı bekliyor. Onaylandıktan sonra giriş yapabilirsiniz.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              background: company.gradient,
              border: `1px solid ${company.border}`,
              borderRadius: 14,
              padding: '12px 28px',
              color: 'white',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Giriş Sayfasına Git
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Ana form ─────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}
    >
      {/* Arka plan partikülleri */}
      {[...Array(12)].map((_, i) => {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ left: `${x}%`, top: `${y}%`, background: company.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 6 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3 }}
          />
        );
      })}

      {/* Orb */}
      <motion.div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl"
        style={{ background: `${company.color}22` }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full blur-3xl"
        style={{ background: `${company.color}18` }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
      />

      {/* Kamera dekorasyon */}
      <motion.div
        className="absolute bottom-10 left-6 opacity-10"
        animate={{ rotate: [0, 8, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        <Camera style={{ width: 80, height: 80, color: company.color }} strokeWidth={1} />
      </motion.div>

      <div className="relative z-10 w-full max-w-md">
        {/* Geri butonu */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 mb-6 text-white/50 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Giriş sayfasına dön
        </button>

        {/* Başlık */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            className="text-5xl mb-4"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            {company.emoji}
          </motion.div>
          <h1 className="text-2xl font-black text-white tracking-wide mb-1">
            {company.name}
          </h1>
          <p className="text-white/40 text-sm">Yeni çalışan kaydı</p>
        </motion.div>

        {/* Form kartı */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${company.border}`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 24,
            padding: 28,
          }}
        >
          {/* Hata mesajı */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-3 mb-5 p-4 rounded-2xl"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)' }}
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ad Soyad */}
          <div className="mb-4">
            <label style={labelStyle}>Ad Soyad</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Adınız Soyadınız"
                style={inputStyle}
              />
            </div>
          </div>

          {/* E-posta */}
          <div className="mb-4">
            <label style={labelStyle}>E-posta</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="ornek@email.com"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Telefon */}
          <div className="mb-4">
            <label style={labelStyle}>Telefon <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(opsiyonel)</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="+90 555 000 00 00"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Şifre */}
          <div className="mb-4">
            <label style={labelStyle}>Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="En az 6 karakter"
                style={{ ...inputStyle, paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Şifre tekrar */}
          <div className="mb-6">
            <label style={labelStyle}>Şifre Tekrar</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showPasswordConfirm ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Şifreyi tekrar girin"
                style={{ ...inputStyle, paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPasswordConfirm(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Kayıt butonu */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: 14,
              border: `1px solid ${company.border}`,
              background: company.gradient,
              color: 'white',
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              letterSpacing: '0.03em',
            }}
          >
            {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
          </motion.button>

          {/* Bilgi notu */}
          <p className="text-center text-white/30 text-xs mt-4 leading-relaxed">
            Kaydınız yönetici onayına gönderilecektir.
            <br />Onaylandıktan sonra giriş yapabilirsiniz.
          </p>
        </motion.div>
      </div>
    </div>
  );
}