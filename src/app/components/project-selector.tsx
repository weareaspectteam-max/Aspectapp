import { getTasks, getLocations } from '../services/rotation-service';
import { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle2, Navigation, AlertTriangle, Zap, ArrowLeft } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  location: string;
  shift: string;
  color: string;
  icon: string;
  distance?: number;
}

interface Location {
  id: string;
  name: string;
  icon: string;
  color: string;
  workingHours?: {
    start: string;
    end: string;
  };
}

interface ProjectSelectorProps {
  onProjectSelect: (project: Project) => void;
  selectedProject: Project | null;
  onNavigate?: (route: string) => void;
  onBack?: () => void;
  userRole?: string;
  onLiveFeed?: () => void;
}

export function ProjectSelector({ onProjectSelect, selectedProject, onNavigate, onBack, userRole, onLiveFeed }: ProjectSelectorProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showSelector, setShowSelector] = useState(!selectedProject);
  const [locations, setLocations] = useState<Location[]>([]);
  const [myRotationVenues, setMyRotationVenues] = useState<Set<string>>(new Set());
  const [pendingProject, setPendingProject] = useState<Project | null>(null);

  // Mevcut kullanıcı rolünü al
  const getCurrentUserRole = (): string => {
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    return 'personel';
  };
  const currentUserRole = getCurrentUserRole();

  // Rol bazlı davranış
  const isTopRole = userRole === 'yonetici' || userRole === 'ust-mudur';
  const isPersonel = userRole === 'personel';

  // Load locations from Mekan Yönetimi
  useEffect(() => {
    const load = async () => {
      const locs = await getLocations();
      setLocations(Array.isArray(locs) ? locs : []);
    };
    load();
  }, []);

  // Bugünkü rotasyonda hangi mekanlar var → mevcut kullanıcı için
  useEffect(() => {
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    setMyRotationVenues(new Set());
  }, []);

  // ✅ DYNAMIC: Convert Mekan Yönetimi locations to projects
  const projects: Project[] = locations.map((location) => {
    const workingHours = location.workingHours
      ? `${location.workingHours.start} - ${location.workingHours.end}`
      : '09:00 - 18:00';

    return {
      id: location.id,
      name: location.name,
      location: location.name.includes('Beach') ? 'Çeşme' : location.name.includes('Turu') ? 'Çeşme Liman' : 'Alaçatı',
      shift: workingHours,
      color: location.color || '#9dd9ea',
      icon: location.icon,
    };
  });

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Location permission denied or unavailable');
        }
      );
    }
  }, []);

  const handleProjectSelect = (project: Project) => {
    const offRotation = !myRotationVenues.has(project.name) && myRotationVenues.size > 0;
    if (offRotation && !isTopRole) {
      // Uyarı modal → personel veya diğer roller
      setPendingProject(project);
    } else {
      onProjectSelect(project);
      setShowSelector(false);
    }
  };

  const confirmOffRotation = () => {
    if (pendingProject) {
      onProjectSelect(pendingProject);
      setShowSelector(false);
      setPendingProject(null);
    }
  };

  if (!showSelector && selectedProject) {
    const isManagement = ['yonetici', 'ust-mudur', 'mudur', 'operasyon'].includes(userRole || '');
    // Unified Operasyon header — project card + Operasyon başlığı tek blokta
    return (
      <div className="px-6 pt-5 pb-3">
        {/* Dış sarmalayıcı relative — badge kartın dışına taşmaz */}
        <div className="relative">

          {/* CANLI badge — kartın sağ üst köşesi */}
          {isManagement && onLiveFeed && (
            <button
              onClick={onLiveFeed}
              className="absolute -top-2 right-3 z-20 flex items-center gap-1.5 bg-[#0f1a12]/90 backdrop-blur-sm border border-emerald-500/60 rounded-full pl-2 pr-2.5 py-1 shadow-lg active:scale-90 transition-all hover:border-emerald-400 hover:bg-emerald-950/80"
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-[9px] font-bold text-emerald-300 tracking-widest leading-none">CANLI</span>
            </button>
          )}

          <div className="overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/15 to-white/10 rounded-2xl px-4 py-3.5 border border-white/20 shadow-lg">
            {/* Ghost Zap watermark */}
            <Zap className="absolute -left-3 -bottom-4 w-28 h-28 text-white opacity-[0.05]" />

            <div className="flex items-center justify-between relative z-10">
              {/* Sol: Operasyon başlığı + konum/saat */}
              <div className="flex items-center gap-2.5">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all flex-shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4 text-white" />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h1 className="text-lg font-bold text-white leading-tight">Operasyon</h1>
                    <span className="text-lg leading-tight">⚡</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedProject.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {selectedProject.shift}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sağ: Proje ikonu + isim + Değiştir */}
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-white text-sm">{selectedProject.name}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#a8e6cf] flex-shrink-0" />
                  </div>
                  <button
                    onClick={() => setShowSelector(true)}
                    className="text-[11px] font-semibold text-[#9dd9ea] hover:bg-[#9dd9ea]/10 px-2 py-0.5 rounded-lg transition-all"
                  >
                    Değiştir
                  </button>
                </div>

                {/* Mekan ikonu */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow-md flex-shrink-0"
                  style={{ backgroundColor: selectedProject.color + '99' }}
                >
                  {selectedProject.icon}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-6 pb-4">
      {/* Rotasyon dışı uyarı overlay */}
      {pendingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/60 backdrop-blur-sm">
          <div className="backdrop-blur-xl bg-[#2a2a3a]/95 border-2 border-amber-500/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="font-bold text-white text-lg">Rotasyon Dışı Mekan</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                <span className="text-amber-300 font-semibold">{pendingProject.name}</span> bugünkü rotasyonunda yer almıyor.
                Devam etmek istediğinizden emin misiniz?
              </p>
              <div className="w-full flex gap-3 mt-2">
                <button
                  onClick={() => setPendingProject(null)}
                  className="flex-1 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
                >
                  Vazgeç
                </button>
                {!isPersonel && (
                  <button
                    onClick={confirmOffRotation}
                    className="flex-1 py-3 bg-amber-500/40 border-2 border-amber-400/60 rounded-xl text-amber-200 font-semibold hover:bg-amber-500/60 transition-all active:scale-95"
                  >
                    Yine de Devam Et
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          Bugünkü Göreviniz
          <span className="text-2xl">📍</span>
        </h2>
        <p className="text-sm text-gray-400">Hangi projede çalışıyorsunuz?</p>
      </div>

      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-8 border-2 border-white/20 text-center">
            <div className="text-6xl mb-4">🏖️</div>
            <h3 className="text-xl font-bold text-white mb-2">Henüz Mekan Eklenmemiş</h3>
            <p className="text-sm text-gray-400 mb-4">
              Lütfen önce "Mekan Yönetimi"nden en az bir mekan ekleyin.
            </p>
            {onNavigate && (
              <button
                onClick={() => onNavigate('mekan-management')}
                className="bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all active:scale-95"
              >
                📍 Mekan Yönetimine Git
              </button>
            )}
          </div>
        ) : (
          projects.map((project) => {
            const isMyVenue = myRotationVenues.has(project.name);
            const hasRotationData = myRotationVenues.size > 0;
            return (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project)}
                className="w-full rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all active:scale-[0.98] text-left relative overflow-hidden"
                style={{ backgroundColor: project.color }}
              >
                {/* Rotasyon etiketi */}
                {hasRotationData && (
                  <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                    isMyVenue
                      ? 'bg-green-500/30 border border-green-400/50 text-green-100'
                      : 'bg-black/30 border border-white/20 text-white/70'
                  }`}>
                    {isMyVenue ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Rotasyonumda
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        Rotasyonumda Değil
                      </>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                  >
                    {project.icon}
                  </div>
                  <div className="flex-1 pr-24">
                    <div className="font-bold text-lg mb-1">{project.name}</div>
                    <div className="flex items-center gap-3 text-sm opacity-90">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {project.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {project.shift}
                      </span>
                    </div>
                  </div>
                  {userLocation && (
                    <div className="text-center">
                      <Navigation className="w-5 h-5 mx-auto mb-1 opacity-80" />
                      <div className="text-xs opacity-80">Yakın</div>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {userLocation && (
        <div className="mt-4 bg-[#a8e6cf]/20 rounded-xl p-3 border border-[#a8e6cf]/30">
          <div className="flex items-center gap-2 text-sm text-[#a8e6cf] font-semibold">
            <Navigation className="w-4 h-4" />
            <span>Konum algılandı - En yakın projeler gösteriliyor</span>
          </div>
        </div>
      )}
    </div>
  );
}