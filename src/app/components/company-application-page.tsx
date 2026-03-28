/*
 * CompanyApplicationPage — Yeni şirket başvurusu
 * /apply route'unda erişilebilir.
 * Başvuru superadmin onayına gönderilir.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Hash, FileText, Mail, Phone, User, Lock, Eye, EyeOff,
  ArrowLeft, Camera, AlertCircle, Send, Loader2, ShieldCheck,
} from 'lucide-react';
import { SERVER_URL } from '../lib/supabase';
import { buildHeaders } from '../lib/api';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px 13px 44px',
  borderRadius: 14,
  fontSize: 14,
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.50)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  marginBottom: 6,
  display: 'block',
};

export function CompanyApplicationPage() {
  const navigate = useNavigate();

  // Şirket bilgileri
  const [companyName,   setCompanyName]   = useState('');
  const [companyCode,   setCompanyCode]   = useState('');
  const [description,   setDescription]   = useState('');
  const [contactEmail,  setContactEmail]  = useState('');
  const [contactPhone,  setContactPhone]  = useState('');

  // İlk yönetici bilgileri
  const [adminName,            setAdminName]            = useState('');
  const [adminEmail,           setAdminEmail]           = useState('');
  const [adminPhone,           setAdminPhone]           = useState('');
  const [adminPassword,        setAdminPassword]        = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [showAdminPass,        setShowAdminPass]        = useState(false);
  const [showAdminPassConfirm, setShowAdminPassConfirm] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  /* Şirket kodu otomatik formatlama */
  const handleCodeChange = (val: string) => {
    setCompanyCode(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleSubmit = async () => {
    setError('');

    // Şirket validasyonu
    if (!companyName.trim())  { setError('Şirket adı zorunludur.'); return; }
    if (!companyCode.trim())  { setError('Şirket kodu zorunludur.'); return; }
    if (companyCode.length < 3) { setError('Şirket kodu en az 3 karakter olmalıdır.'); return; }
    if (!contactEmail.trim()) { setError('Şirket iletişim e-postası zorunludur.'); return; }
    if (!contactEmail.includes('@')) { setError('Geçerli bir iletişim e-postası girin.'); return; }

    // Yönetici validasyonu
    if (!adminName.trim())   { setError('Yönetici adı zorunludur.'); return; }
    if (!adminEmail.trim())  { setError('Yönetici e-postası zorunludur.'); return; }
    if (!adminEmail.includes('@')) { setError('Geçerli bir yönetici e-postası girin.'); return; }
    if (adminPassword.length < 6) { setError('Yönetici şifresi en az 6 karakter olmalıdır.'); return; }
    if (adminPassword !== adminPasswordConfirm) { setError('Yönetici şifreleri eşleşmiyor.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/superadmin/applications`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          companyName:   companyName.trim(),
          companyCode:   companyCode.trim(),
          description:   description.trim(),
          contactEmail:  contactEmail.toLowerCase().trim(),
          contactPhone:  contactPhone.trim(),
          adminName:     adminName.trim(),
          adminEmail:    adminEmail.toLowerCase().trim(),
          adminPhone:    adminPhone.trim(),
          adminPassword: adminPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Başvuru gönderilemedi. Lütfen tekrar deneyin.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Başarı ekranı ── */
  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'var(--app-bg, linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%))' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 max-w-sm w-full"
          style={{
            background: 'linear-gradient(135deg, rgba(167,199,231,0.15), rgba(167,199,231,0.05))',
            border: '1px solid rgba(167,199,231,0.30)',
            backdropFilter: 'blur(20px)',
            borderRadius: 24,
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{ fontSize: 56, marginBottom: 16 }}
          >
            🎉
          </motion.div>
          <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#fff' }}>Başvurunuz Alındı!</p>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            <span style={{ color: '#a7c7e7', fontWeight: 700 }}>{companyName}</span> için başvurunuz superadmin incelemesine gönderildi.
          </p>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            Onaylandıktan sonra çalışanlarınız
          </p>
          <div style={{ margin: '10px 0 20px', padding: '10px 14px', borderRadius: 12, background: 'rgba(167,199,231,0.12)', border: '1px solid rgba(167,199,231,0.25)' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#a7c7e7', fontWeight: 700 }}>
              Şirket Kodu: <span style={{ letterSpacing: '0.08em' }}>{companyCode}</span>
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
              Bu kodu kayıt sırasında kullanacaklar.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%', padding: '13px', borderRadius: 14, cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(167,199,231,0.30), rgba(167,199,231,0.15))',
              border: '1px solid rgba(167,199,231,0.45)', color: '#fff', fontWeight: 700, fontSize: 14,
            }}
          >
            Ana Sayfaya Dön
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Ana form ── */
  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'var(--app-bg, linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%))' }}
    >
      {/* Arka plan partikülleri */}
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{ left: `${10 + i * 9}%`, top: `${20 + (i % 5) * 15}%`, background: '#a7c7e7' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.4 }}
        />
      ))}

      {/* Orb */}
      <motion.div
        className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-3xl"
        style={{ background: 'rgba(167,199,231,0.15)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full blur-3xl"
        style={{ background: 'rgba(212,181,247,0.12)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, delay: 1 }}
      />

      {/* Dekor kamera */}
      <motion.div
        className="absolute top-8 right-6 opacity-10"
        animate={{ rotate: [0, 10, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 7, repeat: Infinity }}
      >
        <Camera style={{ width: 70, height: 70, color: '#a7c7e7' }} strokeWidth={1} />
      </motion.div>

      <div className="relative z-10 max-w-md mx-auto px-4 py-8 pb-24">
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(167,199,231,0.25), rgba(167,199,231,0.10))', border: '1px solid rgba(167,199,231,0.35)' }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Building2 style={{ width: 28, height: 28, color: '#a7c7e7' }} />
          </motion.div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>
            Şirket Başvurusu
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            Başvurunuz superadmin tarafından incelenerek onaylanacaktır.
          </p>
        </motion.div>

        {/* Form kartı */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(167,199,231,0.20)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 24,
            padding: 24,
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

          {/* ─── ŞİRKET BİLGİLERİ ─── */}
          <p style={{ margin: '0 0 14px', fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 700, letterSpacing: '0.07em' }}>
            ŞİRKET BİLGİLERİ
          </p>

          {/* Şirket Adı */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Şirket Adı</label>
            <div style={{ position: 'relative' }}>
              <Building2 style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Horizon Fotoğrafçılık A.Ş."
                style={inputStyle}
                disabled={loading}
              />
            </div>
          </div>

          {/* Şirket Kodu */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Şirket Kodu
              <span style={{ color: 'rgba(255,255,255,0.30)', fontWeight: 400, marginLeft: 6, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                (çalışanlar bu kodla kayıt olacak)
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <Hash style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type="text"
                value={companyCode}
                onChange={e => handleCodeChange(e.target.value)}
                placeholder="horizon"
                style={{ ...inputStyle, color: companyCode ? '#a7c7e7' : '#fff', fontFamily: 'monospace' }}
                disabled={loading}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            {companyCode && (
              <p style={{ margin: '5px 0 0 4px', fontSize: 11, color: 'rgba(167,199,231,0.70)' }}>
                Çalışanlar kayıt formunda "<strong>{companyCode}</strong>" kodunu kullanacak.
              </p>
            )}
          </div>

          {/* Açıklama */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Şirket Hakkında <span style={{ color: 'rgba(255,255,255,0.30)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(isteğe bağlı)</span></label>
            <div style={{ position: 'relative' }}>
              <FileText style={{ position: 'absolute', left: 14, top: 14, width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Şirketiniz hakkında kısa bir açıklama…"
                rows={3}
                disabled={loading}
                style={{ ...inputStyle, paddingTop: 12, paddingBottom: 12, resize: 'none', lineHeight: 1.5 }}
              />
            </div>
          </div>

          {/* Ayırıcı — İletişim */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }} />
          <p style={{ margin: '0 0 14px', fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 700, letterSpacing: '0.07em' }}>
            ŞİRKET İLETİŞİM BİLGİLERİ
          </p>

          {/* İletişim E-posta */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>E-posta</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="bilgi@sirketiniz.com"
                style={inputStyle}
                disabled={loading}
              />
            </div>
          </div>

          {/* Telefon */}
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Telefon <span style={{ color: 'rgba(255,255,255,0.30)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(isteğe bağlı)</span></label>
            <div style={{ position: 'relative' }}>
              <Phone style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="+90 555 000 00 00"
                style={inputStyle}
                disabled={loading}
              />
            </div>
          </div>

          {/* ─── İLK YÖNETİCİ ─── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '20px 0 16px' }} />

          {/* Yönetici başlık + bilgilendirme */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ShieldCheck style={{ width: 16, height: 16, color: '#d4b5f7' }} />
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 700, letterSpacing: '0.07em' }}>
                İLK YÖNETİCİ HESABI
              </p>
            </div>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'rgba(212,181,247,0.08)',
                border: '1px solid rgba(212,181,247,0.22)',
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>
                Başvurunuz onaylandığında bu bilgilerle bir{' '}
                <span style={{ color: '#d4b5f7', fontWeight: 700 }}>Yönetici</span> hesabı otomatik oluşturulur.
                Bu hesap şirketinizin birincil yöneticisidir;{' '}
                <span style={{ color: '#ffd4a3', fontWeight: 600 }}>rolü sonradan değiştirilemez</span> ve sistem genelinde{' '}
                <span style={{ color: '#ffd4a3', fontWeight: 600 }}>yalnızca bir yönetici hesabı</span> tanımlanabilir.
              </p>
            </div>
          </div>

          {/* Ad Soyad */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Ad Soyad</label>
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type="text"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                placeholder="Ad Soyad"
                style={inputStyle}
                disabled={loading}
                autoComplete="name"
              />
            </div>
          </div>

          {/* E-posta */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>E-posta Adresi</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="yonetici@sirketiniz.com"
                style={inputStyle}
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Telefon */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Telefon <span style={{ color: 'rgba(255,255,255,0.30)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(isteğe bağlı)</span></label>
            <div style={{ position: 'relative' }}>
              <Phone style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type="tel"
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                placeholder="+90 555 000 00 00"
                style={inputStyle}
                disabled={loading}
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Şifre */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Şifre</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type={showAdminPass ? 'text' : 'password'}
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                placeholder="En az 6 karakter"
                style={{ ...inputStyle, paddingRight: 44 }}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowAdminPass(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.40)', padding: 0 }}
              >
                {showAdminPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          </div>

          {/* Şifre Tekrar */}
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>Şifre Tekrar</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.30)' }} />
              <input
                type={showAdminPassConfirm ? 'text' : 'password'}
                value={adminPasswordConfirm}
                onChange={e => setAdminPasswordConfirm(e.target.value)}
                placeholder="Şifreyi tekrar girin"
                style={{
                  ...inputStyle,
                  paddingRight: 44,
                  borderColor: adminPasswordConfirm
                    ? adminPassword === adminPasswordConfirm
                      ? 'rgba(52,211,153,0.45)'
                      : 'rgba(239,68,68,0.45)'
                    : 'rgba(255,255,255,0.14)',
                }}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassConfirm(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.40)', padding: 0 }}
              >
                {showAdminPassConfirm ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
            {adminPasswordConfirm && adminPassword !== adminPasswordConfirm && (
              <p style={{ margin: '5px 0 0 4px', fontSize: 11, color: 'rgba(239,68,68,0.80)' }}>
                Şifreler eşleşmiyor.
              </p>
            )}
            {adminPasswordConfirm && adminPassword === adminPasswordConfirm && (
              <p style={{ margin: '5px 0 0 4px', fontSize: 11, color: 'rgba(52,211,153,0.80)' }}>
                Şifreler eşleşiyor ✓
              </p>
            )}
          </div>

          {/* Genel bilgi notu */}
          <div
            className="flex items-start gap-3 mb-5 p-4 rounded-2xl"
            style={{ background: 'rgba(167,199,231,0.08)', border: '1px solid rgba(167,199,231,0.20)' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#a7c7e7' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.50)', margin: 0 }}>
              Başvurunuz superadmin tarafından incelendikten sonra onaylanacaktır. Onaylandığında yönetici hesabınız aktif olur ve çalışanlarınız{' '}
              <span style={{ color: '#a7c7e7', fontWeight: 700 }}>şirket kodunuzu</span> kullanarak kayıt olabilir.
            </p>
          </div>

          {/* Gönder butonu */}
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(167,199,231,0.35), rgba(167,199,231,0.20))',
              border: '1px solid rgba(167,199,231,0.50)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 24px rgba(167,199,231,0.20)',
            }}
          >
            {loading
              ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Başvuru Gönderiliyor…</>
              : <><Send style={{ width: 16, height: 16 }} /> Başvuruyu Gönder</>
            }
          </motion.button>
        </motion.div>

        {/* Alt not */}
        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © 2025 <span style={{ color: '#9dd9ea' }}>Operasyon Paneli</span> — Profesyonel Fotoğrafçılık Yönetimi
        </p>
      </div>
    </div>
  );
}