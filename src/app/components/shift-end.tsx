import { useState } from 'react';
import { CheckCircle, Package, AlertCircle, Printer, Film, Camera, X, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';
import { getToken, appendGhostParam } from '../lib/api';
import { projectId, publicAnonKey } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface PrimBilgi {
  kademeIndex: number;
  kademeHedef: number;
  topKademePrim: number;
  toplamPrim: number;
  toplamKademe: number;
  toplamKademeAdet: number;
  personelSayisi: number;
  coklu: boolean;
  ciro: number;
}

interface ShiftEndProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  projectName: string;
  onBack: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function ShiftEnd({ userName, userRole, projectName, onBack, onLogout, onNavigate }: ShiftEndProps) {
  const [ribbonChanges, setRibbonChanges] = useState(0);
  const [ribbonEndCount, setRibbonEndCount] = useState(0);
  const [showRibbonNotification, setShowRibbonNotification] = useState(false);
  const [showClosingCount, setShowClosingCount] = useState(false);
  const [showShiftEndSuccess, setShowShiftEndSuccess] = useState(false);
  const [venuePhotoTaken, setVenuePhotoTaken] = useState(false);
  const [venuePhotoPreview, setVenuePhotoPreview] = useState<string | null>(null);
  const [primBilgi, setPrimBilgi] = useState<PrimBilgi | null>(null);
  const [primFark, setPrimFark] = useState<number | null>(null);
  const [primYukleniyor, setPrimYukleniyor] = useState(false);

  // Kapanış sayımı state
  const [closingCount, setClosingCount] = useState({
    shelfEnd: {
      album3: 0,
      album5: 0,
      album7: 0,
      album9: 0,
      album11: 0,
      album15: 0,
    },
    damagedAlbums: {
      album3: 0,
      album5: 0,
      album7: 0,
      album9: 0,
      album11: 0,
      album15: 0,
    },
  });

  const handleRibbonChange = () => {
    setRibbonChanges(prev => prev + 1);
    setRibbonEndCount(prev => prev + 1);
    setShowRibbonNotification(true);
    setTimeout(() => {
      setShowRibbonNotification(false);
    }, 2000);
  };

  const updateClosingCount = (category: 'shelfEnd' | 'damagedAlbums', key: string, value: number) => {
    setClosingCount({
      ...closingCount,
      [category]: {
        ...closingCount[category],
        [key]: Math.max(0, value),
      },
    });
  };

  const handleVenuePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVenuePhotoPreview(reader.result as string);
        setVenuePhotoTaken(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveVenuePhoto = () => {
    setVenuePhotoPreview(null);
    setVenuePhotoTaken(false);
  };

  const handleCompleteShift = async () => {
    if (confirm(`Vardiyayı bitirmek istediğinize emin misiniz?\n\nRibon Değişimi: ${ribbonChanges} adet`)) {
      // Prim bilgisini çek
      setPrimYukleniyor(true);
      try {
        const token = await getToken();
        const res = await fetch(
          appendGhostParam(`${API_BASE}/shift/prim-bilgi?mekanAdi=${encodeURIComponent(projectName)}`),
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-Access-Token': token,
            },
          }
        );
        const data = await res.json();
        if (res.ok) {
          setPrimBilgi(data.primBilgi || null);
          setPrimFark(data.fark ?? null);
        } else {
          console.log('[ShiftEnd] prim-bilgi hatası:', data.error);
        }
      } catch (e) {
        console.log('[ShiftEnd] prim-bilgi fetch error:', e);
      } finally {
        setPrimYukleniyor(false);
      }

      setShowShiftEndSuccess(true);
      setTimeout(() => {
        setShowShiftEndSuccess(false);
        onNavigate('profile');
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen relative pb-20" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      {/* Sticky Top Bar - Only for staff */}
      {['personel', 'operasyon', 'bekleyen'].includes(userRole) && (
        <StaffTopBar
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          onNavigate={onNavigate}
          onBack={onBack}
          showBackButton={true}
        />
      )}

      {/* Ribbon Change Notification */}
      {showRibbonNotification && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className="backdrop-blur-xl bg-gradient-to-br from-[#a8e6cf]/90 to-[#8dd9b8]/90 border border-[#a8e6cf]/30 rounded-2xl px-6 py-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#2d3748]" />
              <span className="font-bold text-[#2d3748]">Ribon değiştirildi!</span>
            </div>
          </div>
        </motion.div>
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

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="relative z-10 w-full max-w-md">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#ffd4a3]/20 to-[#ffb3ba]/20 border border-white/10 rounded-full mb-4 backdrop-blur-sm">
              <div className="w-2 h-2 bg-[#ffd4a3] rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-white">Vardiya Bitiş</span>
            </div>
            <h1 className="text-2xl font-black text-white mb-2">
              Günü Kapat
            </h1>
            <p className="text-gray-400 text-sm">
              {projectName} • {userName}
            </p>
          </motion.div>

          {/* Ribbon Change Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                    <Printer className="w-6 h-6 text-[#2d3748]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Ribon Değişimi</h3>
                    <p className="text-xs text-gray-400">Toplam: {ribbonChanges} değişim</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleRibbonChange}
                className="w-full bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] rounded-xl py-3 px-4 font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Ribon Değiştirildi
              </button>
            </div>
          </motion.div>

          {/* Ribbon End Count */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center justify-center shadow-lg">
                  <Film className="w-6 h-6 text-[#2d3748]" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Ribon Bitiş Sayısı</h3>
                  <p className="text-xs text-gray-400">Kalan ribon adedi</p>
                </div>
              </div>
              
              <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <input
                  type="number"
                  value={ribbonEndCount || ''}
                  onChange={(e) => setRibbonEndCount(parseInt(e.target.value) || 0)}
                  placeholder="Ribon sayısını girin"
                  className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#a8e6cf]/50 focus:border-[#a8e6cf]/50 transition-all text-center font-bold text-xl"
                />
              </div>
            </div>
          </motion.div>

          {/* Closing Count Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <button
              onClick={() => setShowClosingCount(!showClosingCount)}
              className="w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 hover:border-[#ffd4a3]/50 rounded-2xl p-5 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
                    <Package className="w-6 h-6 text-[#744210]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Kapanış Sayımı</h3>
                    <p className="text-xs text-gray-400">Reyon bitiş ve bozuk albümler</p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: showClosingCount ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg className="w-5 h-5 text-[#ffd4a3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.div>
              </div>
            </button>
          </motion.div>

          {/* Closing Count Details */}
          {showClosingCount && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 mb-6"
            >
              {/* Reyon Bitiş */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[#a8e6cf]" />
                  Reyon Bitiş
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'album3', label: '3 Kare Album', emoji: '📘' },
                    { key: 'album5', label: '5 Kare Album', emoji: '📗' },
                    { key: 'album7', label: '7 Kare Album', emoji: '📙' },
                    { key: 'album9', label: '9 Kare Album', emoji: '📕' },
                    { key: 'album11', label: '11 Kare Album', emoji: '📔' },
                    { key: 'album15', label: '15 Kare Album', emoji: '📒' },
                  ].map(({ key, label, emoji }) => (
                    <div key={key} className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-3">
                      <div className="text-2xl text-center mb-2">{emoji}</div>
                      <div className="text-xs text-gray-400 text-center mb-2">{label}</div>
                      <input
                        type="number"
                        value={closingCount.shelfEnd[key as keyof typeof closingCount.shelfEnd] || ''}
                        onChange={(e) => updateClosingCount('shelfEnd', key, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-2 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#a8e6cf]/50 focus:border-[#a8e6cf]/50 transition-all text-center font-bold"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bozuk Albümler */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#ffb3ba]" />
                  Bozuk Albümler
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'album3', label: '3 Kare Album', emoji: '📘' },
                    { key: 'album5', label: '5 Kare Album', emoji: '📗' },
                    { key: 'album7', label: '7 Kare Album', emoji: '📙' },
                    { key: 'album9', label: '9 Kare Album', emoji: '📕' },
                    { key: 'album11', label: '11 Kare Album', emoji: '📔' },
                    { key: 'album15', label: '15 Kare Album', emoji: '📒' },
                  ].map(({ key, label, emoji }) => (
                    <div key={key} className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-3">
                      <div className="text-2xl text-center mb-2">{emoji}</div>
                      <div className="text-xs text-gray-400 text-center mb-2">{label}</div>
                      <input
                        type="number"
                        value={closingCount.damagedAlbums[key as keyof typeof closingCount.damagedAlbums] || ''}
                        onChange={(e) => updateClosingCount('damagedAlbums', key, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-2 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ffb3ba]/50 focus:border-[#ffb3ba]/50 transition-all text-center font-bold"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Venue Photo Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
          >
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                  <span className="text-2xl">📸</span>
                </div>
                <div>
                  <h3 className="font-bold text-white">Mekan Genel Görünüm</h3>
                  <p className="text-xs text-gray-400">Net fotoğraf çekimi</p>
                </div>
              </div>

              <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-2xl">💡</div>
                  <div className="text-xs text-gray-400">
                    <p className="font-semibold text-white mb-1">Fotoğraf Gereksinimleri:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Mekanın genel görünümü net olmalı</li>
                      <li>Reyon düzenini gösterecek açıda</li>
                      <li>İyi aydınlatma altında çekilmeli</li>
                      <li>Tüm sergi alanını kapsayan çekim</li>
                    </ul>
                  </div>
                </div>

                {/* Photo Preview or Capture Button */}
                {venuePhotoPreview ? (
                  <div className="relative">
                    <img 
                      src={venuePhotoPreview} 
                      alt="Mekan fotoğrafı" 
                      className="w-full h-48 object-cover rounded-xl border-2 border-[#a8e6cf]/50"
                    />
                    <button
                      onClick={handleRemoveVenuePhoto}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 rounded-full p-2 shadow-lg transition-all active:scale-95"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="mt-3 flex items-center gap-2 text-[#a8e6cf]">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-semibold">Fotoğraf çekildi</span>
                    </div>
                  </div>
                ) : (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleVenuePhotoCapture}
                      className="hidden"
                    />
                    <div className="cursor-pointer bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] hover:shadow-xl rounded-xl py-4 px-4 flex items-center justify-center gap-3 transition-all active:scale-95">
                      <Camera className="w-6 h-6 text-[#2d3748]" />
                      <span className="font-bold text-[#2d3748]">Fotoğraf Çek</span>
                    </div>
                  </label>
                )}
              </div>

              {!venuePhotoTaken && (
                <div className="bg-[#ffb3ba]/10 border border-[#ffb3ba]/30 rounded-xl p-3 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-[#ffb3ba]" />
                  <span className="text-xs text-gray-300">Vardiyayı bitirmeden önce mekan fotoğrafı çekilmelidir</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Complete Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            disabled={!venuePhotoTaken}
            className={`w-full rounded-2xl py-4 px-6 font-bold shadow-lg transition-all ${
              venuePhotoTaken
                ? 'bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] hover:shadow-xl active:scale-95'
                : 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/10'
            }`}
            onClick={handleCompleteShift}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Vardiyayı Tamamla</span>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Bottom Navigation - Only for staff */}
      {['personel', 'operasyon', 'bekleyen'].includes(userRole) && (
        <NewBottomNav
          activeTab="home"
          onTabChange={onNavigate}
          userRole={userRole}
        />
      )}

      {/* Shift End Success Modal */}
      {showShiftEndSuccess && (() => {
        const KADEME_COLORS = ['#60a5fa', '#a855f7', '#fbbf24', '#34d399'];
        const KADEME_EMOJIS = ['🥉', '🥈', '🥇', '🏅'];
        const pb = primBilgi;
        const idx = pb ? Math.min(pb.kademeIndex, 3) : 0;
        const kColor = pb ? KADEME_COLORS[idx] : '#a8e6cf';
        const kEmoji = pb ? KADEME_EMOJIS[idx] : null;

        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full max-w-md bg-black rounded-3xl shadow-2xl overflow-hidden"
              style={{ border: `2px solid ${pb ? kColor + '60' : 'rgba(168,230,207,0.3)'}` }}
            >
              {/* Success Icon */}
              <div className="relative pt-10 pb-6 px-8 text-center">
                {/* Background Glow */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 blur-3xl"
                  style={{ background: `linear-gradient(135deg, ${pb ? kColor + '30' : 'rgba(168,230,207,0.25)'} 0%, rgba(157,217,234,0.2) 100%)` }}
                />

                {/* Success Check Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="relative w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center shadow-2xl"
                  style={{ background: `linear-gradient(135deg, #a8e6cf, #8dd9b8)` }}
                >
                  <CheckCircle className="w-14 h-14 text-[#2d3748]" strokeWidth={2.5} />
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl font-black text-white mb-1"
                >
                  Harika İş! 🎉
                </motion.h2>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-gray-400 text-sm mb-5"
                >
                  Vardiya başarıyla tamamlandı · Bugünkü çalışmanız için teşekkürler! 🌟
                </motion.p>

                {/* Decorative */}
                <div className="absolute top-8 left-8 text-3xl animate-bounce">✨</div>
                <div className="absolute top-12 right-10 text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎊</div>
              </div>

              {/* Prim Bölümü */}
              <div className="px-6 pb-8">
                {primYukleniyor ? (
                  <div className="flex items-center justify-center gap-2 py-4"
                    style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Hakediş hesaplanıyor…</span>
                  </div>
                ) : pb ? (
                  <motion.div
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.65 }}
                    style={{
                      background: `linear-gradient(135deg, ${kColor}18 0%, ${kColor}08 100%)`,
                      border: `1px solid ${kColor}40`,
                      borderRadius: 16, padding: '14px 16px',
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <div style={{
                        width: 36, height: 36, borderRadius: 11,
                        background: `${kColor}22`, border: `1px solid ${kColor}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0,
                      }}>
                        {kEmoji}
                      </div>
                      <div className="flex-1">
                        <p style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>🏆 Hakediş Kazandınız!</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                          {pb.toplamKademe}/{pb.toplamKademeAdet} kota · ₺{pb.ciro.toLocaleString('tr-TR')} ciro
                        </p>
                      </div>
                      <div style={{
                        padding: '4px 10px', borderRadius: 10,
                        background: `${kColor}25`, border: `1px solid ${kColor}50`,
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: kColor }}>
                          ₺{pb.toplamPrim.toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Kişi Başı', val: `₺${pb.topKademePrim.toLocaleString('tr-TR')}`, color: kColor },
                        { label: 'Personel', val: `${pb.personelSayisi} kişi${pb.coklu ? ' 👥' : ' 👤'}`, color: 'rgba(255,255,255,0.8)' },
                        { label: 'Kademe', val: `${pb.toplamKademe}/${pb.toplamKademeAdet}`, color: 'rgba(255,255,255,0.8)' },
                      ].map(item => (
                        <div key={item.label} style={{
                          background: 'rgba(255,255,255,0.05)', borderRadius: 10,
                          padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</p>
                          <p style={{ fontSize: 12, fontWeight: 800, color: item.color }}>{item.val}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                      {Array.from({ length: pb.toplamKademeAdet }).map((_, i) => {
                        const reached = i < pb.toplamKademe;
                        const c = KADEME_COLORS[Math.min(i, 3)];
                        return (
                          <div key={i} style={{
                            flex: 1, height: 4, borderRadius: 4,
                            background: reached ? c : 'rgba(255,255,255,0.1)',
                            boxShadow: reached ? `0 0 6px ${c}80` : 'none',
                          }} />
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                      Hakediş ödemesi yönetici tarafından yapılacaktır
                    </p>
                  </motion.div>
                ) : primFark !== null && primFark > 0 ? (
                  <motion.div
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.65 }}
                    style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 16, padding: '12px 14px',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Trophy style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>Hakediş eşiğine ulaşılamadı</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                          İlk kotaya ₺{primFark.toLocaleString('tr-TR')} eksik kaldı
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.65 }}
                    style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 16, padding: '12px 14px', textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      Bu mekana hakediş kotası tanımlı değil
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </div>
  );
}