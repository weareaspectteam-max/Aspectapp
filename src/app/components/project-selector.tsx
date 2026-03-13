import { MapPin, Clock, CheckCircle2, Navigation, Zap, ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { getTasks, getLocations } from '../services/rotation-service';
import type { Task } from '../services/rotation-service';
import { useState, useEffect } from 'react';
import { localDateStr } from '../lib/date';

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
  userId?: string;
  userName?: string;
  onEkstraIsSelect?: (task: Task) => void;
  onOzelIsSelect?: (task: Task) => void;
}

export function ProjectSelector({ onProjectSelect, selectedProject, onNavigate, onBack, userRole, onLiveFeed, userId, userName, onEkstraIsSelect, onOzelIsSelect }: ProjectSelectorProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showSelector, setShowSelector] = useState(!selectedProject);
  const [locations, setLocations] = useState<Location[]>([]);
  const [myRotationVenues, setMyRotationVenues] = useState<Set<string>>(new Set());
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [rotasyonYukleniyor, setRotasyonYukleniyor] = useState(true);
  const [rotasyonDurumu, setRotasyonDurumu] = useState<'yukleniyor' | 'tanimlanmamis' | 'atanmamis' | 'hata' | 'tamam'>('yukleniyor');
  const [ekstraTasks, setEkstraTasks] = useState<Task[]>([]);
  const [ozelTasks, setOzelTasks] = useState<Task[]>([]);

  // Rol bazlı davranış
  // Rotasyona TAMAMEN BAĞLI roller: personel, operasyon, idari ve diğerleri
  // Rotasyonu BYPASS eden roller (her mekana girebilir): yonetici, ust-mudur, mudur
  const serbest = ['yonetici', 'ust-mudur', 'mudur'].includes(userRole || '');
  const isPersonel = userRole === 'personel'; // tam kilit ekranı sadece personel için
  const rotasyonZorunlu = !serbest; // operasyon, idari, personel vb. hepsi rotasyona tabi

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
    const loadRotation = async () => {
      setRotasyonYukleniyor(true);
      setRotasyonDurumu('yukleniyor');
      try {
        const today = localDateStr();
        const tasks = await getTasks();

        // Bugüne ait ve aktif (sent / revised) görevler
        const todaysTasks = tasks.filter(
          (t) => t.date === today && (t.status === 'sent' || t.status === 'revised')
        );

        if (todaysTasks.length === 0) {
          setMyRotationVenues(new Set());
          setRotasyonDurumu('tanimlanmamis');
          setRotasyonYukleniyor(false);
          return;
        }

        // Kullanıcının dahil olduğu görevleri bul
        const venues = new Set<string>();
        const myEkstra: Task[] = [];
        const myOzel: Task[] = [];

        for (const task of todaysTasks) {
          const benimGörevim = task.personnel.some(
            (p) =>
              (userId && p.id === userId) ||
              (userName && p.name === userName)
          );
          if (!benimGörevim) continue;

          if (task.taskType === 'regular' || !task.taskType) {
            venues.add(task.location);
          } else if (task.taskType === 'extra') {
            myEkstra.push(task);
          } else if (task.taskType === 'special') {
            myOzel.push(task);
          }
        }

        setMyRotationVenues(venues);
        setEkstraTasks(myEkstra);
        setOzelTasks(myOzel);
        setRotasyonDurumu(venues.size > 0 || myEkstra.length > 0 || myOzel.length > 0 ? 'tamam' : 'atanmamis');
      } catch (err) {
        console.error('Rotasyon yüklenemedi:', err);
        setMyRotationVenues(new Set());
        setRotasyonDurumu('hata');
      } finally {
        setRotasyonYukleniyor(false);
      }
    };
    loadRotation();
  }, [userId, userName]);

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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          console.log('Location permission denied or unavailable');
        }
      );
    }
  }, []);

  const handleProjectSelect = (project: Project) => {
    // Serbest roller (yonetici, ust-mudur, mudur) her mekana girebilir.
    if (serbest) {
      onProjectSelect(project);
      setShowSelector(false);
      return;
    }

    // Rotasyon zorunlu roller (personel, operasyon, idari vb.):
    // Rotasyon tanımlanmış VE bu mekan listesinde yoksa ENGELLE.
    // 'atanmamis' = rotasyon var ama bu kullanıcı hiçbir göreve dahil değil → tüm mekanlar kilitli
    const rotasyonAktif = rotasyonDurumu === 'tamam' || rotasyonDurumu === 'atanmamis';
    const mekanimDegil = !myRotationVenues.has(project.name);

    if (rotasyonAktif && mekanimDegil) {
      setPendingProject(project);
      return;
    }

    onProjectSelect(project);
    setShowSelector(false);
  };


  if (!showSelector && selectedProject) {
    const isManagement = ['yonetici', 'ust-mudur', 'mudur', 'operasyon'].includes(userRole || '');
    return (
      <div className="px-6 pt-5 pb-3">
        <div className="relative">
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
            <Zap className="absolute -left-3 -bottom-4 w-28 h-28 text-white opacity-[0.05]" />

            <div className="flex items-center justify-between relative z-10">
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
          <div className="backdrop-blur-xl bg-[#2a2a3a]/95 border-2 border-red-500/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="font-bold text-white text-lg">Erişim Engellendi</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                <span className="text-red-300 font-semibold">{pendingProject.name}</span>, bugünkü rotasyonunuzda yer almıyor.
                Bu mekana erişim yetkiniz bulunmuyor.
              </p>
              <div className="mt-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 w-full">
                <p className="text-xs text-gray-500">🔒 Yöneticinizle iletişime geçin</p>
              </div>
              <div className="w-full mt-1">
                <button
                  onClick={() => setPendingProject(null)}
                  className="w-full py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold active:scale-95 transition-all"
                >
                  Tamam
                </button>
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

      {/* Rotasyon zorunlu roller: yükleniyorsa beklet */}
      {rotasyonZorunlu && rotasyonYukleniyor ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-gray-400 text-sm">Rotasyon bilgisi kontrol ediliyor...</p>
        </div>
      ) : isPersonel && rotasyonDurumu !== 'tamam' ? (
        /* Personel kilitli ekran */
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-8 border-2 border-red-500/30 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          {rotasyonDurumu === 'tanimlanmamis' && (
            <>
              <h3 className="text-lg font-bold text-white mb-2">Rotasyon Tanımlanmamış</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Bugün için henüz bir rotasyon oluşturulmamış.<br />
                Yöneticinizle iletişime geçin.
              </p>
            </>
          )}
          {rotasyonDurumu === 'atanmamis' && (
            <>
              <h3 className="text-lg font-bold text-white mb-2">Rotasyona Atanmadınız</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Bugünkü rotasyonda size atanmış bir görev bulunmuyor.<br />
                Yöneticinizle iletişime geçin.
              </p>
            </>
          )}
          {rotasyonDurumu === 'hata' && (
            <>
              <h3 className="text-lg font-bold text-white mb-2">Bağlantı Hatası</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Rotasyon bilgisi alınamadı.<br />
                Bağlantınızı kontrol edin veya yöneticinizle iletişime geçin.
              </p>
            </>
          )}
          <div className="mt-5 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-gray-500">
              🔒 Güvenlik nedeniyle rotasyon dışı görevlere erişim engellendi
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Regular mekan kartları */}
          {projects.length === 0 && ekstraTasks.length === 0 && ozelTasks.length === 0 ? (
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
            <>
              {/* Regular mekan kartları */}
              {projects.map((project) => {
                const isMyVenue = myRotationVenues.has(project.name);
                // Rotasyon var ('tamam' veya 'atanmamis') ise kilit aktif
                // 'atanmamis' = rotasyon oluşturulmuş ama kullanıcı atanmamış → tüm mekanlar kilitli
                const hasRotationData = rotasyonDurumu === 'tamam' || rotasyonDurumu === 'atanmamis';
                // Serbest roller (yonetici,ust-mudur,mudur) hiçbir zaman kilitlenmez
                const locked = rotasyonZorunlu && hasRotationData && !isMyVenue;
                return (
                  <button
                    key={project.id}
                    onClick={() => !locked && handleProjectSelect(project)}
                    disabled={locked}
                    className={`w-full rounded-2xl p-5 text-white shadow-lg transition-all text-left relative overflow-hidden ${
                      locked
                        ? 'opacity-35 cursor-not-allowed'
                        : 'hover:shadow-xl active:scale-[0.98]'
                    }`}
                    style={{ backgroundColor: project.color }}
                  >
                    {locked && (
                      <div className="absolute inset-0 flex items-center justify-end pr-5 pointer-events-none">
                        <Lock className="w-6 h-6 text-white/60" />
                      </div>
                    )}

                    {/* Badge: sadece rotasyon zorunlu roller için göster */}
                    {rotasyonZorunlu && hasRotationData && (
                      <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                        isMyVenue
                          ? 'bg-green-500/30 border border-green-400/50 text-green-100'
                          : 'bg-black/40 border border-red-500/30 text-red-300'
                      }`}>
                        {isMyVenue ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Rotasyonumda
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            Kilitli
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
                      {userLocation && !locked && (
                        <div className="text-center">
                          <Navigation className="w-5 h-5 mx-auto mb-1 opacity-80" />
                          <div className="text-xs opacity-80">Yakın</div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Ekstra iş kartları */}
              {ekstraTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onEkstraIsSelect?.(task)}
                  className="w-full rounded-2xl p-5 text-white shadow-lg transition-all text-left relative overflow-hidden hover:shadow-xl active:scale-[0.98] border border-amber-500/30"
                  style={{ background: 'linear-gradient(135deg, #7c4a0a 0%, #b45309 100%)' }}
                >
                  {/* Tip etiketi */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-amber-500/30 border border-amber-400/40 text-amber-200">
                    ⚡ EKSTRA İŞ
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-white/15">
                      {task.locationIcon || '⚡'}
                    </div>
                    <div className="flex-1 pr-28">
                      <div className="font-bold text-lg mb-1">{task.location}</div>
                      <div className="flex items-center gap-3 text-sm opacity-80">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {task.startTime} – {task.endTime}
                        </span>
                      </div>
                      {task.notes && (
                        <p className="text-xs text-amber-200/70 mt-1 truncate">{task.notes}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {/* Özel iş kartları */}
              {ozelTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onOzelIsSelect?.(task)}
                  className="w-full rounded-2xl p-5 text-white shadow-lg transition-all text-left relative overflow-hidden hover:shadow-xl active:scale-[0.98] border border-purple-500/30"
                  style={{ background: 'linear-gradient(135deg, #3b0764 0%, #6d28d9 100%)' }}
                >
                  {/* Tip etiketi */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-purple-500/30 border border-purple-400/40 text-purple-200">
                    🔧 ÖZEL İŞ
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl bg-white/15">
                      {task.locationIcon || '🔧'}
                    </div>
                    <div className="flex-1 pr-28">
                      <div className="font-bold text-lg mb-1">{task.location}</div>
                      <div className="flex items-center gap-3 text-sm opacity-80">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {task.startTime} – {task.endTime}
                        </span>
                      </div>
                      {task.notes && (
                        <p className="text-xs text-purple-200/70 mt-1 truncate">{task.notes}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {userLocation && !(isPersonel && rotasyonDurumu !== 'tamam') && (
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