import { useState, useEffect } from 'react';
import { Camera, Mail, Lock, User, Save, Eye, EyeOff, Shield, Bell, CheckCircle, Cake, Loader2 } from 'lucide-react';

import { NewBottomNav } from './new-bottom-nav';
import { authHeaders } from '../lib/api';
import { projectId, publicAnonKey } from '../lib/supabase-info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface SettingsProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  userAvatar: string;
  userEmail: string;
  userBirthDate: string;
  accessToken: string;
  onAvatarChange: (avatar: string) => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function Settings({ userName, userRole, userAvatar, userEmail, userBirthDate, accessToken, onAvatarChange, onLogout, onNavigate }: SettingsProps) {
  const [email, setEmail] = useState(userEmail || '');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successText, setSuccessText] = useState('Değişiklikler kaydedildi!');
  const [hideBirthdayFromOthers, setHideBirthdayFromOthers] = useState(false);
  const [hideOthersBirthdays, setHideOthersBirthdays] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdayError, setBirthdayError] = useState('');
  const [birthdayLoading, setBirthdayLoading] = useState(true);

  const avatarOptions = [
    '👨‍💼', '👩‍💼', '😊', '🤓', '😎', '👨‍🎨', '👩‍🎨', '🧑‍💻', '👨‍🔧', '👩‍🔧',
    '👨‍⚖️', '👩‍⚖️', '👨‍🏫', '👩‍🏫', '👨‍⚕️', '👩‍⚕️',
    '👨‍🎤', '👩‍🎤', '👨‍🍳', '👩‍🍳',
    '🧑‍🚀', '👨‍🔬', '👩‍🔬', '🧙‍♂️', '🧙‍♀️',
    '🥳', '🤩', '🥰', '😇', '🤠',
    '🦸‍♂️', '🦸‍♀️', '🧝‍♂️', '🧝‍♀️', '🧞'
  ];

  // Mevcut avatar ile başlat
  const [selectedAvatar, setSelectedAvatar] = useState(userAvatar || '👨‍💼');

  // userAvatar prop değişince sync et
  useEffect(() => {
    setSelectedAvatar(userAvatar || '👨‍💼');
  }, [userAvatar]);

  // userEmail prop değişince emaili sync et
  useEffect(() => {
    if (userEmail) setEmail(userEmail);
  }, [userEmail]);

  // Doğum günü gizlilik ayarlarını sunucudan yükle (tarih profilden geliyor)
  useEffect(() => {
    const loadBirthday = async () => {
      setBirthdayLoading(true);
      try {
        const headers = await authHeaders();
        const res = await fetch(`${SERVER_URL}/birthday`, { headers });
        if (res.ok) {
          const data = await res.json();
          setHideBirthdayFromOthers(data.hideBirthdayFromOthers || false);
          setHideOthersBirthdays(data.hideOthersBirthdays || false);
        }
      } catch (err) {
        console.error('Birthday load error:', err);
      } finally {
        setBirthdayLoading(false);
      }
    };
    loadBirthday();
  }, []);

  const showSuccess = (text = 'Değişiklikler kaydedildi!') => {
    setSuccessText(text);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleSaveBirthday = async () => {
    setBirthdaySaving(true);
    setBirthdayError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER_URL}/birthday`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ hideBirthdayFromOthers, hideOthersBirthdays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBirthdayError(data.error || 'Ayarlar kaydedilemedi.');
        return;
      }
      showSuccess('Doğum günü ayarları kaydedildi! 🎂');
    } catch (err) {
      console.error('Birthday save error:', err);
      setBirthdayError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setBirthdaySaving(false);
    }
  };

  const handleSaveEmail = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || trimmed === userEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Geçerli bir e-posta adresi girin.');
      return;
    }
    setEmailSaving(true);
    setEmailError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER_URL}/auth/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || 'E-posta güncellenemedi.');
        return;
      }
      showSuccess('E-posta güncellendi! ✉️');
    } catch (err) {
      console.error('Email save error:', err);
      setEmailError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleChangePassword = () => {
    if (newPassword === confirmPassword && newPassword.length >= 6) {
      showSuccess('Şifre güncellendi!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleSaveAvatar = async () => {
    if (selectedAvatar === userAvatar) return;
    setSavingAvatar(true);
    setAvatarError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER_URL}/auth/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ avatar: selectedAvatar }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAvatarError(data.error || 'Avatar kaydedilemedi.');
        return;
      }
      onAvatarChange(selectedAvatar);
      showSuccess('Avatar güncellendi! ✨');
    } catch (err) {
      console.error('Avatar save error:', err);
      setAvatarError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setSavingAvatar(false);
    }
  };

  return (
    <div className="pb-20 min-h-screen" style={{ background: 'var(--app-bg, linear-gradient(to bottom, #2a2a3a, #3a3a4e, #2f3439))' }}>
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4">
          <div className="backdrop-blur-xl bg-gradient-to-br from-[#a8e6cf]/90 to-[#8dd9b8]/90 border-2 border-white/20 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-white" />
            <span className="font-bold text-white">{successText}</span>
          </div>
        </div>
      )}

      <div className="px-6 space-y-5 pb-8">
        {/* Profile Photo Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Profil Fotoğrafı</h3>
              <p className="text-xs text-gray-400">Avatar'ınızı seçin</p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {avatarOptions.map((avatar) => (
              <button
                key={avatar}
                onClick={() => { setSelectedAvatar(avatar); setAvatarError(''); }}
                className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all hover:scale-110 active:scale-95 ${
                  selectedAvatar === avatar
                    ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] border-3 border-white/50 shadow-lg shadow-[#9dd9ea]/30'
                    : 'bg-white/10 hover:bg-white/20 border-2 border-white/20'
                }`}
              >
                {avatar}
              </button>
            ))}
          </div>

          {avatarError && (
            <p className="mt-3 text-sm text-red-400 text-center">{avatarError}</p>
          )}

          <button
            onClick={handleSaveAvatar}
            disabled={savingAvatar || selectedAvatar === userAvatar}
            className="mt-4 w-full py-3 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#9dd9ea]/30 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingAvatar ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Kaydediliyor...</>
            ) : (
              <><Save className="w-5 h-5" /> Avatar'ı Kaydet</>
            )}
          </button>
        </div>

        {/* Email Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">E-posta Adresi</h3>
              <p className="text-xs text-gray-400">İletişim bilgilerinizi güncelleyin</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Mevcut E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffd4a3] transition-all"
                placeholder="ornek@email.com"
              />
              {emailError && (
                <p className="mt-2 text-sm text-red-400">{emailError}</p>
              )}
            </div>

            <button
              onClick={handleSaveEmail}
              disabled={emailSaving || !email.trim() || email.trim().toLowerCase() === userEmail}
              className="w-full py-3 bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] text-[#744210] font-bold rounded-xl hover:shadow-lg hover:shadow-[#ffd4a3]/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {emailSaving ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Güncelleniyor...</>
              ) : (
                <><Save className="w-5 h-5" /> E-posta Güncelle</>
              )}
            </button>
          </div>
        </div>

        {/* Birthday Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffb3ba] to-[#ffa3aa] flex items-center justify-center">
              <Cake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Doğum Günü</h3>
              <p className="text-xs text-gray-400">Gizlilik tercihlerinizi ayarlayın</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
              <span className="text-2xl">🎂</span>
              <div className="flex-1">
                <div className="text-xs text-gray-400 mb-0.5">Profilinizdeki doğum tarihi</div>
                {userBirthDate ? (
                  <div className="font-semibold text-white">
                    {new Date(userBirthDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">Profilde doğum tarihi yok — yöneticinize bildirin</div>
                )}
              </div>
            </div>

            {userBirthDate && (
              <div className="p-4 bg-gradient-to-br from-[#ffb3ba]/20 to-[#ffa3aa]/10 rounded-xl border border-[#ffb3ba]/30">
                <p className="text-sm text-gray-300">
                  🎉 Ekip arkadaşlarınız doğum gününüzden 1 gün önce hatırlatılacak ve özel gününüzde kutlama mesajı alacaksınız!
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🙈</span>
                  <div>
                    <div className="font-semibold text-white text-sm">Doğum günümü gizle</div>
                    <div className="text-xs text-gray-400">Diğer kullanıcılara hatırlatılmaz</div>
                  </div>
                </div>
                <button
                  onClick={() => setHideBirthdayFromOthers(!hideBirthdayFromOthers)}
                  className={`relative w-14 h-8 rounded-full transition-all ${
                    hideBirthdayFromOthers ? 'bg-gradient-to-r from-[#ffb3ba] to-[#ffa3aa]' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                      hideBirthdayFromOthers ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔕</span>
                  <div>
                    <div className="font-semibold text-white text-sm">Diğerlerini gizle</div>
                    <div className="text-xs text-gray-400">Başkalarının doğum günü hatırlatmalarını alma</div>
                  </div>
                </div>
                <button
                  onClick={() => setHideOthersBirthdays(!hideOthersBirthdays)}
                  className={`relative w-14 h-8 rounded-full transition-all ${
                    hideOthersBirthdays ? 'bg-gradient-to-r from-[#ffb3ba] to-[#ffa3aa]' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                      hideOthersBirthdays ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveBirthday}
              disabled={birthdaySaving || birthdayLoading}
              className="w-full py-3 bg-gradient-to-br from-[#ffb3ba] to-[#ffa3aa] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#ffb3ba]/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {birthdaySaving ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Kaydediliyor...</>
              ) : (
                <><Save className="w-5 h-5" /> Ayarları Kaydet</>
              )}
            </button>
            {birthdayError && (
              <p className="text-sm text-red-400 text-center mt-1">{birthdayError}</p>
            )}
          </div>
        </div>

        {/* Password Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4b5f7] to-[#c79ff0] flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Şifre Değiştir</h3>
              <p className="text-xs text-gray-400">Hesabınızın güvenliğini sağlayın</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Mevcut Şifre</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#d4b5f7] transition-all"
                  placeholder="••••••••"
                />
                <button
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Yeni Şifre</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#d4b5f7] transition-all"
                  placeholder="••••••••"
                />
                <button
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-[#ffb3ba] mt-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Şifre en az 6 karakter olmalıdır
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Yeni Şifre (Tekrar)</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#d4b5f7] transition-all"
                  placeholder="••••••••"
                />
                <button
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-[#ffb3ba] mt-2">Şifreler eşleşmiyor</p>
              )}
            </div>

            <button
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="w-full py-3 bg-gradient-to-br from-[#d4b5f7] to-[#c79ff0] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#d4b5f7]/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Lock className="w-5 h-5" />
              Şifreyi Güncelle
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Bildirimler</h3>
              <p className="text-xs text-gray-400">Bildirim tercihlerinizi yönetin</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <div className="font-semibold text-white">Push Bildirimleri</div>
                  <div className="text-xs text-gray-400">Anlık bildirimler alın</div>
                </div>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  notifications ? 'bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                    notifications ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📧</span>
                <div>
                  <div className="font-semibold text-white">E-posta Bildirimleri</div>
                  <div className="text-xs text-gray-400">Önemli güncellemeler için</div>
                </div>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`relative w-14 h-8 rounded-full transition-all ${
                  emailNotifications ? 'bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform ${
                    emailNotifications ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-white">Hesap Bilgileri</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Kullanıcı Adı:</span>
              <span className="text-white font-semibold">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Rol:</span>
              <span className="text-white font-semibold capitalize">{{
                'yonetici': 'Yönetici',
                'ust-mudur': 'Üst Müdür',
                'mudur': 'Müdür',
                'operasyon': 'Operasyon',
                'personel': 'Personel',
                'idari': 'İdari',
                'bekleyen': 'Bekleyen',
              }[userRole] ?? userRole}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Durum:</span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#a8e6cf] rounded-full animate-pulse"></div>
                <span className="text-[#a8e6cf] font-semibold">Aktif</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Only for personel/bekleyen */}
      {['personel', 'bekleyen'].includes(userRole) && (
        <NewBottomNav
          activeTab="settings"
          onNavigate={onNavigate}
          userRole={userRole}
        />
      )}
    </div>
  );
}
