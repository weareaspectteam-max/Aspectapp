import { useState, useEffect } from 'react';
import { Camera, Mail, Lock, User, Save, Eye, EyeOff, Shield, Bell, CheckCircle, Cake } from 'lucide-react';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';

interface SettingsProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function Settings({ userName, userRole, onLogout, onNavigate }: SettingsProps) {
  const [email, setEmail] = useState('ahmet.kaya@aspectops.com');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [birthday, setBirthday] = useState('');
  const [hideBirthdayFromOthers, setHideBirthdayFromOthers] = useState(false);
  const [hideOthersBirthdays, setHideOthersBirthdays] = useState(false);

  // Load birthday from localStorage on mount
  useEffect(() => {
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
  }, []);

  const handleSaveBirthday = () => {
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleSaveEmail = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleChangePassword = () => {
    if (newPassword === confirmPassword && newPassword.length >= 6) {
      setShowSuccessMessage(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowSuccessMessage(false), 3000);
    }
  };

  const avatarOptions = [
    // Mevcut (10)
    '👨‍💼', '👩‍💼', '😊', '🤓', '😎', '👨‍🎨', '👩‍🎨', '🧑‍💻', '👨‍🔧', '👩‍🔧',
    // Profesyonel Seri (6)
    '👨‍⚖️', '👩‍⚖️', '👨‍🏫', '👩‍🏫', '👨‍⚕️', '👩‍⚕️',
    // Yaratıcı Seri (4)
    '👨‍🎤', '👩‍🎤', '👨‍🍳', '👩‍🍳',
    // Teknoloji Seri (5)
    '🧑‍🚀', '👨‍🔬', '👩‍🔬', '🧙‍♂️', '🧙‍♀️',
    // Eğlence Seri (5)
    '🥳', '🤩', '🥰', '😇', '🤠',
    // Özel Seri (5)
    '🦸‍♂️', '🦸‍♀️', '🧝‍♂️', '🧝‍♀️', '🧞'
  ];
  const [selectedAvatar, setSelectedAvatar] = useState('👨‍💼');

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Sticky Top Bar */}
      {['personel', 'bekleyen'].includes(userRole) && (
        <StaffTopBar
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          onNavigate={onNavigate}
          onBack={() => onNavigate('home')}
          showBackButton={true}
        />
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4">
          <div className="backdrop-blur-xl bg-gradient-to-br from-[#a8e6cf]/90 to-[#8dd9b8]/90 border-2 border-white/20 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-white" />
            <span className="font-bold text-white">Değişiklikler kaydedildi!</span>
          </div>
        </div>
      )}

      <div className="px-6 space-y-5 pb-8">{/* Removed pt-6 for staff role */}
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
                onClick={() => setSelectedAvatar(avatar)}
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

          {selectedAvatar !== '👨‍💼' && (
            <button
              onClick={handleSaveEmail}
              className="mt-4 w-full py-3 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#9dd9ea]/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Avatar'ı Kaydet
            </button>
          )}
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
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffd4a3] transition-all"
                placeholder="ornek@email.com"
              />
            </div>

            <button
              onClick={handleSaveEmail}
              className="w-full py-3 bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] text-[#744210] font-bold rounded-xl hover:shadow-lg hover:shadow-[#ffd4a3]/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              E-posta Güncelle
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
              <p className="text-xs text-gray-400">Doğum gününüzü ekleyin</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Doğum Tarihiniz</label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-[#ffb3ba] transition-all"
              />
            </div>

            {birthday && (
              <div className="p-4 bg-gradient-to-br from-[#ffb3ba]/20 to-[#ffa3aa]/10 rounded-xl border border-[#ffb3ba]/30">
                <p className="text-sm text-gray-300">
                  🎂 Ekip arkadaşlarınız doğum gününüzden 1 gün önce hatırlatılacak ve özel gününüzde kutlama mesajı alacaksınız!
                </p>
              </div>
            )}

            {/* Birthday Privacy Settings */}
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
              disabled={!birthday}
              className="w-full py-3 bg-gradient-to-br from-[#ffb3ba] to-[#ffa3aa] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#ffb3ba]/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Doğum Günü Kaydet
            </button>
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
            {/* Current Password */}
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

            {/* New Password */}
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

            {/* Confirm Password */}
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
            {/* Push Notifications Toggle */}
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

            {/* Email Notifications Toggle */}
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