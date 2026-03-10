import { useState } from 'react';
import { Package, Printer, CheckCircle, ArrowRight, Grid3x3, Camera, X } from 'lucide-react';
import { motion } from 'motion/react';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';

interface ShiftSetupProps {
  userName: string;
  userRole: 'admin' | 'staff';
  projectName: string;
  onComplete: (setupData: ShiftSetupData) => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  onBack?: () => void;
}

export interface ShiftSetupData {
  stock: {
    album3: number;
    album5: number;
    album7: number;
    album9: number;
    album11: number;
    album13: number;
    album15: number;
    passepartout: number;
  };
  printer: {
    startCounter: string;
  };
  shelves: {
    album3: number;
    album5: number;
    album7: number;
    album9: number;
    album11: number;
    album13: number;
    album15: number;
    passepartout: number;
  };
  teamPhoto: {
    taken: boolean;
    preview: string | null;
  };
}

export function ShiftSetup({ userName, userRole, projectName, onComplete, onLogout, onNavigate, onBack }: ShiftSetupProps) {
  const [currentStep, setCurrentStep] = useState<'stock' | 'printer' | 'shelf' | 'team-photo'>('stock');
  
  // Stok state
  const [stock, setStock] = useState({
    album3: 0,
    album5: 0,
    album7: 0,
    album9: 0,
    album11: 0,
    album13: 0,
    album15: 0,
    passepartout: 0,
  });

  // Yazıcı state
  const [printerStart, setPrinterStart] = useState('');

  // Reyon state
  const [shelfAlbums, setShelfAlbums] = useState({
    album3: 0,
    album5: 0,
    album7: 0,
    album9: 0,
    album11: 0,
    album13: 0,
    album15: 0,
    passepartout: 0,
  });

  // Takım fotoğrafı state
  const [teamPhotoTaken, setTeamPhotoTaken] = useState(false);
  const [teamPhotoPreview, setTeamPhotoPreview] = useState<string | null>(null);

  const updateStock = (key: keyof typeof stock, value: number) => {
    setStock({ ...stock, [key]: Math.max(0, value) });
  };

  const updateShelfAlbums = (key: keyof typeof shelfAlbums, value: number) => {
    setShelfAlbums({ ...shelfAlbums, [key]: Math.max(0, value) });
  };

  const handleTeamPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTeamPhotoPreview(reader.result as string);
        setTeamPhotoTaken(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveTeamPhoto = () => {
    setTeamPhotoPreview(null);
    setTeamPhotoTaken(false);
  };

  const handleComplete = () => {
    const setupData: ShiftSetupData = {
      stock,
      printer: { startCounter: printerStart },
      shelves: shelfAlbums,
      teamPhoto: { taken: teamPhotoTaken, preview: teamPhotoPreview },
    };
    onComplete(setupData);
  };

  const isStepComplete = () => {
    if (currentStep === 'stock') {
      return Object.values(stock).some(val => val > 0);
    }
    if (currentStep === 'printer') {
      return printerStart.trim() !== '';
    }
    if (currentStep === 'shelf') {
      return Object.values(shelfAlbums).some(val => val > 0);
    }
    if (currentStep === 'team-photo') {
      return teamPhotoTaken;
    }
    return false;
  };

  const renderStockStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
            <Package className="w-6 h-6 text-[#2d3748]" />
          </div>
          <div>
            <h3 className="font-bold text-white">Albüm Stoğu</h3>
            <p className="text-xs text-gray-400">Başlangıç stok miktarlarını girin</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'album3', label: '3 Kare Albüm', emoji: '📘' },
            { key: 'album5', label: '5 Kare Albüm', emoji: '📗' },
            { key: 'album7', label: '7 Kare Albüm', emoji: '📙' },
            { key: 'album9', label: '9 Kare Albüm', emoji: '📕' },
            { key: 'album11', label: '11 Kare Albüm', emoji: '📔' },
            { key: 'album13', label: '13 Kare Albüm', emoji: '📒' },
            { key: 'album15', label: '15 Kare Albüm', emoji: '📓' },
            { key: 'passepartout', label: 'Paspartu', emoji: '🖼️' },
          ].map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center justify-between bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{emoji}</span>
                <span className="font-semibold text-white">{label}</span>
              </div>
              <input
                type="number"
                value={stock[key as keyof typeof stock] || ''}
                onChange={(e) => updateStock(key as keyof typeof stock, parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-24 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 focus:border-[#9dd9ea]/50 transition-all text-center font-bold"
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderPrinterStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
            <Printer className="w-6 h-6 text-[#744210]" />
          </div>
          <div>
            <h3 className="font-bold text-white">Baskı Cihazı</h3>
            <p className="text-xs text-gray-400">Sayaç başlangıç değerini girin</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Başlangıç Sayacı
            </label>
            <input
              type="number"
              value={printerStart}
              onChange={(e) => setPrinterStart(e.target.value)}
              placeholder="100"
              className="w-full px-4 py-4 bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ffd4a3]/50 focus:border-[#ffd4a3]/50 transition-all text-lg font-bold text-center"
            />
          </div>

          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="text-xs text-gray-400">
                <p className="font-semibold text-white mb-1">Not:</p>
                Yazıcının LCD ekranında görünen toplam baskı sayısını girin. 
                Vardiya sonunda tekrar bu değeri girmeniz istenecek.
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderShelfStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
            <Grid3x3 className="w-6 h-6 text-[#2d3748]" />
          </div>
          <div>
            <h3 className="font-bold text-white">Reyon Albümleri</h3>
            <p className="text-xs text-gray-400">Reyonda bulunan hazır albümler</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'album3', label: '3 Kare Albüm', emoji: '📘' },
            { key: 'album5', label: '5 Kare Albüm', emoji: '📗' },
            { key: 'album7', label: '7 Kare Albüm', emoji: '📙' },
            { key: 'album9', label: '9 Kare Albüm', emoji: '📕' },
            { key: 'album11', label: '11 Kare Albüm', emoji: '📔' },
            { key: 'album13', label: '13 Kare Albüm', emoji: '📒' },
            { key: 'album15', label: '15 Kare Albüm', emoji: '📓' },
            { key: 'passepartout', label: 'Paspartu', emoji: '🖼️' },
          ].map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center justify-between bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{emoji}</span>
                <span className="font-semibold text-white">{label}</span>
              </div>
              <input
                type="number"
                value={shelfAlbums[key as keyof typeof shelfAlbums] || ''}
                onChange={(e) => updateShelfAlbums(key as keyof typeof shelfAlbums, parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-24 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 focus:border-[#9dd9ea]/50 transition-all text-center font-bold"
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderTeamPhotoStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-4"
    >
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center justify-center shadow-lg">
            <span className="text-2xl">📸</span>
          </div>
          <div>
            <h3 className="font-bold text-white">Personel Fotoğrafı</h3>
            <p className="text-xs text-gray-400">Vardiya başlangıç kaydı</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">💡</div>
              <div className="text-xs text-gray-400">
                <p className="font-semibold text-white mb-1">Fotoğraf Gereksinimleri:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Personelin görünür olması</li>
                  <li>Net ve iyi aydınlatılmış çekim</li>
                  <li>Mekan önünde veya içinde</li>
                  <li>Vardiya başlangıç kaydı için</li>
                </ul>
              </div>
            </div>

            {/* Photo Preview or Capture Button */}
            {teamPhotoPreview ? (
              <div className="relative">
                <img 
                  src={teamPhotoPreview} 
                  alt="Personel fotoğrafı" 
                  className="w-full h-48 object-cover rounded-xl border-2 border-[#a8e6cf]/50"
                />
                <button
                  onClick={handleRemoveTeamPhoto}
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
                  capture="user"
                  onChange={handleTeamPhotoCapture}
                  className="hidden"
                />
                <div className="cursor-pointer bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] hover:shadow-xl rounded-xl py-4 px-4 flex items-center justify-center gap-3 transition-all active:scale-95">
                  <Camera className="w-6 h-6 text-[#2d3748]" />
                  <span className="font-bold text-[#2d3748]">Fotoğraf Çek</span>
                </div>
              </label>
            )}
          </div>

          {!teamPhotoTaken && (
            <div className="bg-[#ffb3ba]/10 border border-[#ffb3ba]/30 rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <span className="text-xs text-gray-300">Vardiya başlamadan önce personel fotoğrafı çekilmelidir</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] relative pb-20">
      {/* Sticky Top Bar - Only for staff */}
      {userRole === 'staff' && (
        <StaffTopBar
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          onNavigate={onNavigate}
          onBack={onBack}
          showBackButton={true}
        />
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
      <motion.div
        className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-gradient-to-br from-[#ffd4a3]/20 to-transparent blur-3xl"
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

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9dd9ea]/20 to-[#ffd4a3]/20 border border-white/10 rounded-full mb-4 backdrop-blur-sm">
            <div className="w-2 h-2 bg-[#9dd9ea] rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-white">Vardiya Başlangıcı</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">
            Günlük Hazırlık
          </h1>
          <p className="text-gray-400 text-sm">
            {projectName} • {userName}
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { key: 'stock', label: 'Stok', icon: Package },
            { key: 'printer', label: 'Yazıcı', icon: Printer },
            { key: 'shelf', label: 'Reyon', icon: Grid3x3 },
            { key: 'team-photo', label: 'Takım Fotoğrafı', icon: Grid3x3 },
          ].map(({ key, label, icon: Icon }, index) => (
            <div key={key} className="flex items-center">
              <div className={`flex flex-col items-center gap-1`}>
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    currentStep === key
                      ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] scale-110 shadow-xl'
                      : index < ['stock', 'printer', 'shelf', 'team-photo'].indexOf(currentStep)
                      ? 'bg-[#9dd9ea]/20 text-[#7ec8dd] border border-[#9dd9ea]/30'
                      : 'bg-white/10 text-gray-500 border border-white/10'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold text-gray-400">
                  {label}
                </span>
              </div>
              {index < 3 && (
                <div
                  className={`w-8 h-0.5 mx-1 mb-5 ${
                    index < ['stock', 'printer', 'shelf', 'team-photo'].indexOf(currentStep)
                      ? 'bg-[#9dd9ea]'
                      : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="mb-6">
          {currentStep === 'stock' && renderStockStep()}
          {currentStep === 'printer' && renderPrinterStep()}
          {currentStep === 'shelf' && renderShelfStep()}
          {currentStep === 'team-photo' && renderTeamPhotoStep()}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {currentStep !== 'stock' && (
            <button
              onClick={() => {
                if (currentStep === 'printer') setCurrentStep('stock');
                if (currentStep === 'shelf') setCurrentStep('printer');
                if (currentStep === 'team-photo') setCurrentStep('shelf');
              }}
              className="px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold text-white transition-all"
            >
              Geri
            </button>
          )}
          <button
            onClick={() => {
              if (currentStep === 'stock') setCurrentStep('printer');
              else if (currentStep === 'printer') setCurrentStep('shelf');
              else if (currentStep === 'shelf') setCurrentStep('team-photo');
              else handleComplete();
            }}
            disabled={!isStepComplete()}
            className={`flex-1 py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
              isStepComplete()
                ? 'bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] hover:shadow-xl hover:shadow-[#9dd9ea]/50 active:scale-[0.98]'
                : 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/10'
            }`}
          >
            {currentStep === 'team-photo' ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Tamamla
              </>
            ) : (
              <>
                İleri
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
        </div>
      </div>

      {/* Bottom Navigation - Only for staff */}
      {userRole === 'staff' && (
        <NewBottomNav
          activeTab="home"
          onTabChange={onNavigate}
          userRole={userRole}
        />
      )}
    </div>
  );
}