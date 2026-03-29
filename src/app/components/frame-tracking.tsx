import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Camera, Clock,
  MapPin, CheckCircle, Trash2, RefreshCw, TrendingUp,
  Award, Layers, ChevronRight, UserPlus, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getLocations, getStaffMembers, type Location, type StaffMember } from '../services/rotation-service';
import { getToken } from '../lib/api';

interface FrameEntry {
  id: string;
  photographerName: string;
  photographerId: string;
  frameCount: number;
  location: string;
  locationIcon: string;
  timestamp: string;
  enteredBy: string;
}

interface FrameTrackingProps {
  userName: string;
  userRole: string;
  accessToken: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
}



type TabType = 'entry' | 'live' | 'report';
type ReportFilter = 'today' | 'week' | 'month';
type EntryStep = 'location' | 'photographer' | 'frames';

export function FrameTracking({ userName, userRole, accessToken, onNavigate, onLogout }: FrameTrackingProps) {
  const [activeTab, setActiveTab] = useState<TabType>('entry');
  const [entries, setEntries] = useState<FrameEntry[]>([]);
  const [reportFilter, setReportFilter] = useState<ReportFilter>('today');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);

  // Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);

  // Entry form state
  const [entryStep, setEntryStep] = useState<EntryStep>('location');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [rotationPersonnel, setRotationPersonnel] = useState<StaffMember[]>([]);
  const [selectedPhotographer, setSelectedPhotographer] = useState<StaffMember | null>(null);
  const [frameCount, setFrameCount] = useState('');
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      // accessToken prop'u direkt kullan — modül cache'ine bağımlılığı ortadan kaldırır
      const token = accessToken || await getToken();

      // Mekanları yükle
      const locs = await getLocations(token);
      setLocations(Array.isArray(locs) ? locs : []);

      // Tüm personeli yükle
      const staff = await getStaffMembers(token);
      setAllStaff(Array.isArray(staff) ? staff : []);

      // Kayıtları yükle
      loadEntries(locs);
    };
    init();
  }, [accessToken]);

  const loadEntries = (_locs?: Location[]) => {
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    setEntries([]);
    setLastRefresh(new Date());
  };

  // Seçili mekan için bugünkü rotasyon personelini bul
  const getRotationPersonnelForLocation = useCallback((_location: Location): StaffMember[] => {
    // Rotasyon personelini burada sync çekemedik (getTasks async);
    // ileride useEffect'te önceden yüklenmiş tasksFromStore state'i kullanılacak.
    return [];
  }, []);

  const handleLocationSelect = (loc: Location) => {
    setSelectedLocation(loc);
    const rotPersonnel = getRotationPersonnelForLocation(loc);
    setRotationPersonnel(rotPersonnel);
    setSelectedPhotographer(null);
    setFrameCount('');
    setEntryStep('photographer');
  };

  const handlePhotographerSelect = (staff: StaffMember) => {
    setSelectedPhotographer(staff);
    setShowManualPicker(false);
    setEntryStep('frames');
  };

  const handleSave = () => {
    if (!selectedLocation || !selectedPhotographer || !frameCount) return;
    const count = parseInt(frameCount);
    if (isNaN(count) || count <= 0) return;

    const newEntry: FrameEntry = {
      id: `entry-${Date.now()}`,
      photographerName: selectedPhotographer.name,
      photographerId: selectedPhotographer.id,
      frameCount: count,
      location: selectedLocation.name,
      locationIcon: selectedLocation.icon,
      timestamp: new Date().toISOString(),
      enteredBy: userName,
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak

    // Reset - mekân korunur, sadece fotoğrafçı ve kare sıfırlanır
    setSelectedPhotographer(null);
    setFrameCount('');
    setManualSearch('');
    setShowManualPicker(false);
    setEntryStep('photographer'); // Aynı mekan, yeni fotoğrafçı seçimine geri dön

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
  };

  // Bugünün kayıtları
  const todayEntries = entries.filter(e => {
    const d = new Date(e.timestamp);
    const now = new Date();
    return d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Rapor için filtrelenmiş kayıtlar
  const getFilteredEntries = useCallback(() => {
    const now = new Date();
    return entries.filter(e => {
      const d = new Date(e.timestamp);
      if (reportFilter === 'today') {
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (reportFilter === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      } else {
        const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
        return d >= monthAgo;
      }
    });
  }, [entries, reportFilter]);

  const filteredEntries = getFilteredEntries();

  const photographerStats = filteredEntries.reduce((acc, e) => {
    if (!acc[e.photographerName]) acc[e.photographerName] = { total: 0, sessions: 0 };
    acc[e.photographerName].total += e.frameCount;
    acc[e.photographerName].sessions += 1;
    return acc;
  }, {} as Record<string, { total: number; sessions: number }>);
  const photographerList = Object.entries(photographerStats).sort((a, b) => b[1].total - a[1].total);

  const locationStats = filteredEntries.reduce((acc, e) => {
    if (!acc[e.location]) acc[e.location] = { total: 0, sessions: 0, icon: e.locationIcon };
    acc[e.location].total += e.frameCount;
    acc[e.location].sessions += 1;
    return acc;
  }, {} as Record<string, { total: number; sessions: number; icon: string }>);
  const locationList = Object.entries(locationStats).sort((a, b) => b[1].total - a[1].total);

  const totalFrames = filteredEntries.reduce((sum, e) => sum + e.frameCount, 0);
  const todayTotalFrames = todayEntries.reduce((sum, e) => sum + e.frameCount, 0);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });

  // Manuel seçici için arama filtresi - rotasyon listesinde olmayanlar + hepsi
  const filteredManualStaff = allStaff.filter(s =>
    s.name.toLowerCase().includes(manualSearch.toLowerCase())
  );

  const stepLabels: Record<EntryStep, string> = {
    location: 'Mekan Seç',
    photographer: 'Fotoğrafçı Seç',
    frames: 'Kare Sayısı',
  };

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      <div className="fixed top-20 right-10 w-48 h-48 rounded-full bg-gradient-to-br from-[#9dd9ea]/8 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 left-5 w-40 h-40 rounded-full bg-gradient-to-br from-[#ffd4a3]/8 to-transparent blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 max-w-[480px] mx-auto z-50">
        <div className="backdrop-blur-xl bg-black/80 border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                <Camera className="w-5 h-5 text-[#2d3748]" />
              </div>
              <div>
                <h1 className="font-black text-white text-base leading-tight">Kare Takibi</h1>
                <p className="text-xs text-gray-400">Fotoğraf Karesi Takip Sistemi</p>
              </div>
            </div>
            <button
              onClick={() => loadEntries()}
              className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-[#9dd9ea]" />
            </button>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-2 mt-3">
            {[
              { id: 'entry' as TabType, label: 'Giriş', emoji: '✍️' },
              { id: 'live' as TabType, label: 'Canlı', emoji: '🔴' },
              { id: 'report' as TabType, label: 'Rapor', emoji: '📊' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg'
                    : 'bg-white/10 text-gray-400 border border-white/10'
                }`}
              >
                <span>{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-36 left-1/2 -translate-x-1/2 z-[200] bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] text-[#1a4a2e] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-bold text-sm whitespace-nowrap"
          >
            <CheckCircle className="w-5 h-5" />
            Kare kaydı başarıyla eklendi!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Picker Modal */}
      <AnimatePresence>
        {showManualPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center max-w-[480px] mx-auto"
            onClick={() => setShowManualPicker(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full bg-black rounded-t-3xl p-5 max-h-[70vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-white text-base">Tüm Personel</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Listeden fotoğrafçıyı seçin</p>
                </div>
                <button onClick={() => setShowManualPicker(false)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="İsim ara..."
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none focus:border-[#9dd9ea]/50 mb-3"
              />

              {/* List */}
              <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                {filteredManualStaff.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-6">Personel bulunamadı</p>
                ) : (
                  filteredManualStaff.map(s => {
                    const isInRotation = rotationPersonnel.some(r => r.id === s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => handlePhotographerSelect(s)}
                        className="w-full flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-3 text-left transition-all active:scale-95"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9dd9ea]/30 to-[#7ec8dd]/20 flex items-center justify-center text-base flex-shrink-0">
                          {s.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-sm truncate">{s.name}</div>
                          <div className="text-xs text-gray-400 capitalize">{s.role}</div>
                        </div>
                        {isInRotation && (
                          <span className="text-xs bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30 rounded-lg px-2 py-0.5 flex-shrink-0">
                            Rotasyonda
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="pt-36 pb-8 px-4 space-y-4">

        {/* ── GİRİŞ TAB ── */}
        {activeTab === 'entry' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              {(['location', 'photographer', 'frames'] as EntryStep[]).map((step, i) => {
                const steps: EntryStep[] = ['location', 'photographer', 'frames'];
                const currentIndex = steps.indexOf(entryStep);
                const stepIndex = steps.indexOf(step);
                const isDone = stepIndex < currentIndex;
                const isCurrent = stepIndex === currentIndex;
                return (
                  <div key={step} className="flex items-center gap-2 flex-1">
                    <div className={`flex items-center gap-1.5 flex-1 ${isCurrent ? '' : ''}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        isDone ? 'bg-[#a8e6cf] text-[#1a4a2e]' :
                        isCurrent ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748]' :
                        'bg-white/10 text-gray-500'
                      }`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-xs font-bold truncate ${isCurrent ? 'text-white' : isDone ? 'text-[#a8e6cf]' : 'text-gray-500'}`}>
                        {stepLabels[step]}
                      </span>
                    </div>
                    {i < 2 && <div className={`w-4 h-px flex-shrink-0 ${stepIndex < currentIndex ? 'bg-[#a8e6cf]' : 'bg-white/20'}`} />}
                  </div>
                );
              })}
            </div>

            {/* STEP 1: Mekan Seç */}
            {entryStep === 'location' && (
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-[#d4b5f7]" />
                  <span className="font-black text-white text-sm">Hangi mekan?</span>
                </div>

                {locations.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-3xl mb-2">📍</div>
                    <p className="text-gray-400 text-sm">Mekan bulunamadı.</p>
                    <p className="text-gray-500 text-xs mt-1">Mekan Yönetimi'nden mekan ekleyin.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {locations.map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => handleLocationSelect(loc)}
                        className="w-full flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-4 text-left transition-all active:scale-95 group"
                      >
                        <span className="text-2xl">{loc.icon}</span>
                        <span className="font-bold text-white text-sm flex-1">{loc.name}</span>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Fotoğrafçı Seç */}
            {entryStep === 'photographer' && selectedLocation && (
              <div className="space-y-3">
                {/* Seçili mekan göster */}
                <div className="flex items-center gap-3 backdrop-blur-xl bg-gradient-to-br from-[#d4b5f7]/15 to-[#c79ff0]/10 border border-[#d4b5f7]/30 rounded-2xl p-3">
                  <span className="text-xl">{selectedLocation.icon}</span>
                  <span className="font-bold text-white text-sm flex-1">{selectedLocation.name}</span>
                  <button
                    onClick={() => setEntryStep('location')}
                    className="text-xs text-[#d4b5f7] border border-[#d4b5f7]/30 rounded-lg px-2 py-1"
                  >
                    Değiştir
                  </button>
                </div>

                <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#9dd9ea]" />
                    <span className="font-black text-white text-sm">Fotoğrafçıyı seç</span>
                  </div>

                  {rotationPersonnel.length > 0 ? (
                    <>
                      <p className="text-xs text-gray-400">Bugün bu mekanda rotasyonda olan personel:</p>
                      <div className="space-y-2">
                        {rotationPersonnel.map(p => (
                          <button
                            key={p.id}
                            onClick={() => handlePhotographerSelect(p)}
                            className="w-full flex items-center gap-3 bg-white/10 hover:bg-gradient-to-br hover:from-[#9dd9ea]/20 hover:to-[#7ec8dd]/10 border border-white/15 rounded-xl p-3.5 text-left transition-all active:scale-95"
                          >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea]/30 to-[#7ec8dd]/20 flex items-center justify-center text-lg flex-shrink-0">
                              {p.avatar}
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-white text-sm">{p.name}</div>
                              <div className="text-xs text-[#9dd9ea]/80 flex items-center gap-1 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#a8e6cf]" />
                                Rotasyonda
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="text-2xl mb-1">📋</div>
                      <p className="text-gray-400 text-xs">Bu mekan için bugün rotasyon kaydı yok.</p>
                      <p className="text-gray-500 text-xs mt-0.5">Aşağıdan tüm personelden seçebilirsiniz.</p>
                    </div>
                  )}

                  {/* Manuel Ekle butonu */}
                  <button
                    onClick={() => { setManualSearch(''); setShowManualPicker(true); }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 transition-all text-sm font-bold"
                  >
                    <UserPlus className="w-4 h-4" />
                    Listeden başka biri seç
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Kare Sayısı */}
            {entryStep === 'frames' && selectedLocation && selectedPhotographer && (
              <div className="space-y-3">
                {/* Özet */}
                <div className="backdrop-blur-xl bg-gradient-to-br from-[#9dd9ea]/15 to-[#9dd9ea]/5 border border-[#9dd9ea]/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{selectedLocation.icon}</span>
                    <div>
                      <div className="font-bold text-white text-sm">{selectedLocation.name}</div>
                      <div className="text-xs text-gray-400">Mekan</div>
                    </div>
                    <button onClick={() => setEntryStep('location')} className="ml-auto text-xs text-[#9dd9ea]/60 border border-[#9dd9ea]/20 rounded-lg px-2 py-0.5">Değiştir</button>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9dd9ea]/30 to-[#7ec8dd]/20 flex items-center justify-center text-base">
                      {selectedPhotographer.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{selectedPhotographer.name}</div>
                      <div className="text-xs text-gray-400">Fotoğrafçı</div>
                    </div>
                    <button onClick={() => setEntryStep('photographer')} className="ml-auto text-xs text-[#9dd9ea]/60 border border-[#9dd9ea]/20 rounded-lg px-2 py-0.5">Değiştir</button>
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#ffd4a3]" />
                    <span className="font-black text-white text-sm">Kaç kare teslim edildi?</span>
                  </div>

                  <input
                    type="number"
                    placeholder="Kare sayısını girin..."
                    value={frameCount}
                    onChange={e => setFrameCount(e.target.value)}
                    min="1"
                    autoFocus
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white text-2xl font-black placeholder-gray-600 outline-none focus:border-[#ffd4a3]/50 text-center"
                  />

                  <div className="flex items-center justify-center gap-2 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400">Saat otomatik:</span>
                    <span className="text-xs font-black text-[#9dd9ea]">{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={!frameCount || parseInt(frameCount) <= 0}
                    className={`w-full py-4 rounded-2xl font-black text-base transition-all ${
                      frameCount && parseInt(frameCount) > 0
                        ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-xl active:scale-95'
                        : 'bg-white/10 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    ✅ Kareyi Kaydet
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── CANLI TAB ── */}
        {activeTab === 'live' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Live Header */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#a8e6cf] animate-pulse" />
                  <span className="font-black text-white text-sm">Bugün Canlı</span>
                </div>
                <span className="text-xs text-gray-400">
                  {lastRefresh.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gradient-to-br from-[#9dd9ea]/20 to-[#9dd9ea]/10 rounded-xl p-3 text-center border border-[#9dd9ea]/20">
                  <div className="font-black text-[#9dd9ea] text-xl">{todayTotalFrames.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Toplam Kare</div>
                </div>
                <div className="bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffd4a3]/10 rounded-xl p-3 text-center border border-[#ffd4a3]/20">
                  <div className="font-black text-[#ffd4a3] text-xl">{todayEntries.length}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Teslim</div>
                </div>
                <div className="bg-gradient-to-br from-[#d4b5f7]/20 to-[#d4b5f7]/10 rounded-xl p-3 text-center border border-[#d4b5f7]/20">
                  <div className="font-black text-[#d4b5f7] text-xl">
                    {new Set(todayEntries.map(e => e.photographerId)).size}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Fotoğrafçı</div>
                </div>
              </div>
            </div>

            {todayEntries.length === 0 ? (
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-3">📷</div>
                <p className="text-gray-400 text-sm">Bugün henüz kare girişi yok</p>
                <button
                  onClick={() => setActiveTab('entry')}
                  className="mt-4 px-4 py-2 bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 rounded-xl text-[#9dd9ea] text-sm font-bold"
                >
                  İlk Girişi Yap
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {todayEntries.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/15 rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-xl flex-shrink-0">
                        {entry.locationIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm truncate">{entry.photographerName}</div>
                        <div className="text-xs text-gray-400 truncate">{entry.location}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-500">{formatTime(entry.timestamp)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="bg-gradient-to-br from-[#9dd9ea]/30 to-[#9dd9ea]/20 border border-[#9dd9ea]/30 rounded-xl px-3 py-1.5">
                          <span className="font-black text-[#9dd9ea] text-base">{entry.frameCount}</span>
                          <span className="text-xs text-gray-400 ml-1">kare</span>
                        </div>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── RAPOR TAB ── */}
        {activeTab === 'report' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2">
              {[
                { id: 'today' as ReportFilter, label: 'Bugün', emoji: '📅' },
                { id: 'week' as ReportFilter, label: 'Bu Hafta', emoji: '📆' },
                { id: 'month' as ReportFilter, label: 'Bu Ay', emoji: '🗓️' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setReportFilter(f.id)}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    reportFilter === f.id
                      ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg'
                      : 'bg-white/10 text-gray-400 border border-white/10'
                  }`}
                >
                  {f.emoji} {f.label}
                </button>
              ))}
            </div>

            {/* Genel Özet */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
              <h3 className="font-black text-white text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#9dd9ea]" />
                Genel Özet
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-[#9dd9ea]/20 to-transparent rounded-xl p-3 border border-[#9dd9ea]/20">
                  <div className="font-black text-[#9dd9ea] text-2xl">{totalFrames.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Toplam Kare</div>
                </div>
                <div className="bg-gradient-to-br from-[#ffd4a3]/20 to-transparent rounded-xl p-3 border border-[#ffd4a3]/20">
                  <div className="font-black text-[#ffd4a3] text-2xl">{filteredEntries.length}</div>
                  <div className="text-xs text-gray-400">Toplam Teslim</div>
                </div>
                <div className="bg-gradient-to-br from-[#d4b5f7]/20 to-transparent rounded-xl p-3 border border-[#d4b5f7]/20">
                  <div className="font-black text-[#d4b5f7] text-2xl">{photographerList.length}</div>
                  <div className="text-xs text-gray-400">Fotoğrafçı</div>
                </div>
                <div className="bg-gradient-to-br from-[#a8e6cf]/20 to-transparent rounded-xl p-3 border border-[#a8e6cf]/20">
                  <div className="font-black text-[#a8e6cf] text-2xl">{locationList.length}</div>
                  <div className="text-xs text-gray-400">Aktif Mekan</div>
                </div>
              </div>
            </div>

            {/* Fotoğrafçı Sıralaması */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
              <h3 className="font-black text-white text-sm mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-[#ffd4a3]" />
                Fotoğrafçı Sıralaması
              </h3>
              {photographerList.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">Bu dönemde kayıt yok</p>
              ) : (
                <div className="space-y-3">
                  {photographerList.map(([name, stats], index) => {
                    const maxTotal = photographerList[0][1].total;
                    const pct = Math.round((stats.total / maxTotal) * 100);
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{medals[index] || `${index + 1}.`}</span>
                            <span className="text-sm font-bold text-white">{name}</span>
                            <span className="text-xs text-gray-500">{stats.sessions} teslim</span>
                          </div>
                          <span className="font-black text-[#9dd9ea] text-sm">{stats.total.toLocaleString()} kare</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: index * 0.05 }}
                            className="h-full bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mekan Dağılımı */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
              <h3 className="font-black text-white text-sm mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#d4b5f7]" />
                Mekan Dağılımı
              </h3>
              {locationList.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">Bu dönemde kayıt yok</p>
              ) : (
                <div className="space-y-3">
                  {locationList.map(([name, stats], index) => {
                    const maxTotal = locationList[0][1].total;
                    const pct = Math.round((stats.total / maxTotal) * 100);
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{stats.icon}</span>
                            <span className="text-sm font-bold text-white truncate max-w-[140px]">{name}</span>
                            <span className="text-xs text-gray-500">{stats.sessions} teslim</span>
                          </div>
                          <span className="font-black text-[#d4b5f7] text-sm">{stats.total.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: index * 0.05 }}
                            className="h-full bg-gradient-to-r from-[#d4b5f7] to-[#c79ff0] rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tüm Kayıtlar */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
              <h3 className="font-black text-white text-sm mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#a8e6cf]" />
                Tüm Kayıtlar ({filteredEntries.length})
              </h3>
              {filteredEntries.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">Bu dönemde kayıt yok</p>
              ) : (
                <div className="space-y-2">
                  {[...filteredEntries]
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                        <span className="text-lg">{entry.locationIcon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{entry.photographerName}</div>
                          <div className="text-xs text-gray-500">{formatDate(entry.timestamp)} {formatTime(entry.timestamp)} · {entry.location}</div>
                        </div>
                        <div className="font-black text-[#9dd9ea] text-sm flex-shrink-0">
                          {entry.frameCount} <span className="text-xs text-gray-400">kare</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}