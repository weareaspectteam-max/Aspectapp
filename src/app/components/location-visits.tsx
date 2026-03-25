import { useState, useRef, useEffect } from 'react';
import { 
  MapPin, Calendar, Clock, Star, Camera, CheckCircle, AlertTriangle, 
  XCircle, Plus, Filter, Search, User, ArrowLeft, ChevronRight, 
  TrendingUp, Award, FileText, X, Edit2, Trash2, Loader2
} from 'lucide-react';
import { getToken, buildHeaders, appendGhostParam } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface LocationVisitsProps {
  userName?: string;
  userRole?: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken?: string;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  embedded?: boolean;
  onBack?: () => void;
  showOwnHeader?: boolean;
  externalTriggerNewVisit?: boolean;
  onNewVisitFormOpen?: () => void;
}

interface UploadedPhoto {
  id: string;
  url: string;
  timestamp: number;
}

interface Visit {
  id: string;
  locationName: string;
  locationId: string;
  visitDate: string;
  visitTime: string;
  manager: string;
  managerRole: string;
  visitType: 'routine' | 'problem' | 'quality' | 'meeting';
  status: 'completed' | 'pending' | 'cancelled';
  duration: string;
  generalScore: number;
  cleanlinessScore: number;
  equipmentScore: number;
  staffScore: number;
  customerScore: number;
  issuesFound: string[];
  actionsTaken: string[];
  photos: UploadedPhoto[];
  notes: string;
  nextVisitDate: string;
  hasOpenActions: boolean;
}

interface Location {
  id: string;
  name: string;
  type: 'Beach Club' | 'Restaurant' | 'Hotel' | 'Boat Tour';
}

// mockLocations kaldırıldı — gerçek mekan listesi API'den geliyor

const visitTypeConfig = {
  routine: { emoji: '📅', label: 'Rutin Kontrol', color: 'blue' },
  problem: { emoji: '⚠️', label: 'Sorun Çözme', color: 'red' },
  quality: { emoji: '⭐', label: 'Kalite Kontrol', color: 'yellow' },
  meeting: { emoji: '🤝', label: 'İşletmeci Görüşmesi', color: 'purple' }
};

const statusConfig = {
  completed: { label: 'Tamamlandı', color: 'green', icon: CheckCircle },
  pending: { label: 'Beklemede', color: 'yellow', icon: Clock },
  cancelled: { label: 'İptal', color: 'red', icon: XCircle }
};

export function LocationVisits({ 
  userName = '', 
  userRole = 'yonetici',
  accessToken = '',
  onLogout = () => {}, 
  onNavigate = () => {},
  embedded = false,
  onBack = () => {},
  showOwnHeader = true,
  externalTriggerNewVisit = false,
  onNewVisitFormOpen = () => {}
}: LocationVisitsProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [realLocations, setRealLocations] = useState<{ id: string; name: string; type: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showNewVisitForm, setShowNewVisitForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form States
  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [visitType, setVisitType] = useState<'routine' | 'problem' | 'quality' | 'meeting'>('routine');
  const [duration, setDuration] = useState('');
  const [cleanlinessScore, setCleanlinessScore] = useState(0);
  const [equipmentScore, setEquipmentScore] = useState(0);
  const [staffScore, setStaffScore] = useState(0);
  const [customerScore, setCustomerScore] = useState(0);
  const [issuesFound, setIssuesFound] = useState<string[]>(['']);
  const [actionsTaken, setActionsTaken] = useState<string[]>(['']);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [notes, setNotes] = useState('');
  const [nextVisitDate, setNextVisitDate] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeaders = async () => {
    const token = await getToken();
    return buildHeaders(token);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const h = await getAuthHeaders();
      const [visitsRes, mekanRes] = await Promise.all([
        fetch(appendGhostParam(`${API_BASE}/ziyaretler`), { headers: h }),
        fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers: h }),
      ]);
      if (visitsRes.ok) {
        const d = await visitsRes.json();
        setVisits(d.ziyaretler || []);
      } else {
        const e = await visitsRes.json().catch(() => ({}));
        setApiError(e.error || `HTTP ${visitsRes.status}`);
      }
      if (mekanRes.ok) {
        const d = await mekanRes.json();
        setRealLocations((d.mekanlar || []).map((m: any) => ({
          id: m.id, name: m.name || m.ad || 'Mekan', type: m.type || m.tur || '',
        })));
      }
    } catch (err) {
      console.log('fetchData ziyaretler error:', err);
      setApiError('Sunucuya bağlanılamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle external trigger for new visit
  useEffect(() => {
    if (externalTriggerNewVisit) {
      setShowNewVisitForm(true);
      const now = new Date();
      setVisitDate(now.toISOString().split('T')[0]);
      setVisitTime(now.toTimeString().slice(0, 5));
      onNewVisitFormOpen();
    }
  }, [externalTriggerNewVisit]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map(file => ({
      id: Date.now().toString() + Math.random(),
      url: URL.createObjectURL(file),
      timestamp: Date.now()
    }));
    setPhotos([...photos, ...newPhotos]);
  };

  const removePhoto = (photoId: string) => {
    setPhotos(photos.filter(p => p.id !== photoId));
  };

  const addIssue = () => {
    setIssuesFound([...issuesFound, '']);
  };

  const removeIssue = (index: number) => {
    setIssuesFound(issuesFound.filter((_, i) => i !== index));
  };

  const updateIssue = (index: number, value: string) => {
    const updated = [...issuesFound];
    updated[index] = value;
    setIssuesFound(updated);
  };

  const addAction = () => {
    setActionsTaken([...actionsTaken, '']);
  };

  const removeAction = (index: number) => {
    setActionsTaken(actionsTaken.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, value: string) => {
    const updated = [...actionsTaken];
    updated[index] = value;
    setActionsTaken(updated);
  };

  const resetForm = () => {
    setLocationId('');
    setLocationName('');
    setVisitDate('');
    setVisitTime('');
    setVisitType('routine');
    setDuration('');
    setCleanlinessScore(0);
    setEquipmentScore(0);
    setStaffScore(0);
    setCustomerScore(0);
    setIssuesFound(['']);
    setActionsTaken(['']);
    setPhotos([]);
    setNotes('');
    setNextVisitDate('');
  };

  const handleSave = async () => {
    const avgScore = (cleanlinessScore + equipmentScore + staffScore + customerScore) / 4;
    const validIssues = issuesFound.filter(i => i.trim());
    const validActions = actionsTaken.filter(a => a.trim());

    const payload = {
      locationName, locationId, visitDate, visitTime,
      manager: userName || 'Yönetici',
      managerRole: ['yonetici', 'ust-mudur'].includes(userRole ?? '') ? 'Yönetici' : 'Müdür',
      visitType, status: 'completed', duration,
      generalScore: avgScore, cleanlinessScore, equipmentScore, staffScore, customerScore,
      issuesFound: validIssues, actionsTaken: validActions,
      photos, notes, nextVisitDate,
      hasOpenActions: validIssues.length > validActions.length,
    };

    setIsSaving(true);
    try {
      const h = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/ziyaretler`, {
        method: 'POST', headers: h, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Kayıt başarısız.'); return; }
      const { ziyaret } = await res.json();
      setVisits(prev => [ziyaret, ...prev]);
      setShowNewVisitForm(false);
      resetForm();
    } catch (err) {
      console.log('handleSave ziyaret error:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVisit = async (id: string) => {
    if (!confirm('Bu ziyareti silmek istediğinizden emin misiniz?')) return;
    try {
      const h = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/ziyaretler/${id}`, { method: 'DELETE', headers: h });
      if (!res.ok) { alert('Silinemedi.'); return; }
      setVisits(prev => prev.filter(v => v.id !== id));
      if (selectedVisit?.id === id) setSelectedVisit(null);
    } catch (err) { alert('Sunucu hatası!'); }
  };

  const canSave = locationName && duration && 
    cleanlinessScore > 0 && equipmentScore > 0 && 
    staffScore > 0 && customerScore > 0 && 
    nextVisitDate;

  // Statistics
  const stats = {
    totalVisits: visits.filter(v => v.status === 'completed').length,
    avgScore: visits.length > 0 ? visits.reduce((sum, v) => sum + v.generalScore, 0) / visits.length : 0,
    openActions: visits.filter(v => v.hasOpenActions).length,
    pendingVisits: visits.filter(v => v.status === 'pending').length
  };

  // Filtered visits
  const filteredVisits = visits.filter(visit => {
    const matchesSearch = visit.locationName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || visit.visitType === filterType;
    const matchesStatus = filterStatus === 'all' || visit.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Star Rating Component
  const StarRating = ({ 
    score, 
    onRate, 
    readonly = false 
  }: { 
    score: number; 
    onRate?: (rating: number) => void; 
    readonly?: boolean 
  }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onRate?.(star)}
          disabled={readonly}
          className={`transition-all ${!readonly && 'hover:scale-110 active:scale-95'}`}
        >
          <Star 
            className={`w-6 h-6 ${
              score >= star 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-600'
            }`} 
          />
        </button>
      ))}
    </div>
  );

  // DETAIL VIEW
  if (selectedVisit) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">
        {/* Header */}
        {embedded && showOwnHeader && (
          <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
            <div className="px-4 py-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedVisit(null)}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-6 h-6 text-purple-400" />
                    Ziyaret Detayı
                  </h1>
                  <p className="text-sm text-gray-400 mt-0.5">{selectedVisit.locationName}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 py-6 space-y-4">
          {/* Location Header */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-2">{selectedVisit.locationName}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(selectedVisit.visitDate)} - {selectedVisit.visitTime}
              </div>
            </div>
            <div className="mt-3">
              {(() => {
                const config = statusConfig[selectedVisit.status];
                const Icon = config.icon;
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-${config.color}-500/20 text-${config.color}-300 border border-${config.color}-400/30`}>
                    <Icon className="w-3.5 h-3.5" />
                    {config.label}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Visit Type */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-3xl mb-2">{visitTypeConfig[selectedVisit.visitType].emoji}</div>
            <div className="text-white font-medium">{visitTypeConfig[selectedVisit.visitType].label}</div>
          </div>

          {/* Manager & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <User className="w-5 h-5 text-blue-400 mb-2" />
              <div className="text-sm text-gray-400">Müdür</div>
              <div className="text-white font-medium">{selectedVisit.manager}</div>
              <div className="text-xs text-gray-500">{selectedVisit.managerRole}</div>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <Clock className="w-5 h-5 text-purple-400 mb-2" />
              <div className="text-sm text-gray-400">Süre</div>
              <div className="text-white font-medium">{selectedVisit.duration} dakika</div>
            </div>
          </div>

          {/* General Score */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-6 text-center">
            <div className="text-5xl font-bold text-white mb-3">{selectedVisit.generalScore.toFixed(1)}</div>
            <div className="flex justify-center gap-1 mb-3">
              <StarRating score={selectedVisit.generalScore} readonly />
            </div>
            <p className="text-gray-300">Genel Değerlendirme</p>
          </div>

          {/* Detailed Scores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-white font-medium">Temizlik</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{selectedVisit.cleanlinessScore.toFixed(1)}</div>
              <StarRating score={selectedVisit.cleanlinessScore} readonly />
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-white font-medium">Ekipman</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{selectedVisit.equipmentScore.toFixed(1)}</div>
              <StarRating score={selectedVisit.equipmentScore} readonly />
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-white font-medium">Personel</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{selectedVisit.staffScore.toFixed(1)}</div>
              <StarRating score={selectedVisit.staffScore} readonly />
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Award className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-white font-medium">Müşteri</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{selectedVisit.customerScore.toFixed(1)}</div>
              <StarRating score={selectedVisit.customerScore} readonly />
            </div>
          </div>

          {/* Issues */}
          {selectedVisit.issuesFound.length > 0 && (
            <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-400/20 rounded-2xl p-4">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Tespit Edilen Sorunlar
              </h3>
              <div className="space-y-2">
                {selectedVisit.issuesFound.map((issue, idx) => (
                  <p key={idx} className="text-gray-300 text-sm">• {issue}</p>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {selectedVisit.actionsTaken.length > 0 && (
            <div className="backdrop-blur-xl bg-green-500/10 border border-green-400/20 rounded-2xl p-4">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Alınan Aksiyonlar
              </h3>
              <div className="space-y-2">
                {selectedVisit.actionsTaken.map((action, idx) => (
                  <p key={idx} className="text-gray-300 text-sm">• {action}</p>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          {selectedVisit.photos.length > 0 && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-400" />
                Fotoğraflar
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {selectedVisit.photos.map(photo => (
                  <div key={photo.id} className="relative">
                    <img 
                      src={photo.url} 
                      alt="Visit photo"
                      className="w-full h-32 object-cover rounded-xl"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {selectedVisit.notes && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Notlar
              </h3>
              <p className="text-gray-300 text-sm">{selectedVisit.notes}</p>
            </div>
          )}

          {/* Next Visit */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-6 text-center">
            <Calendar className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-sm text-gray-300 mb-1">Sonraki Ziyaret</div>
            <div className="text-2xl font-bold text-white">{formatDate(selectedVisit.nextVisitDate)}</div>
          </div>
        </div>
      </div>
    );
  }

  // NEW VISIT FORM
  if (showNewVisitForm) {
    const generalScore = cleanlinessScore && equipmentScore && staffScore && customerScore
      ? ((cleanlinessScore + equipmentScore + staffScore + customerScore) / 4).toFixed(1)
      : '0.0';

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">
        {/* Header */}
        {embedded && showOwnHeader && (
          <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
            <div className="px-4 py-4">
              <div className="flex items-center gap-3 mb-3">
                <button 
                  onClick={() => {
                    setShowNewVisitForm(false);
                    resetForm();
                  }}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Plus className="w-6 h-6 text-green-400" />
                    Yeni Ziyaret Kaydı
                  </h1>
                  <p className="text-sm text-gray-400">Mekan ziyareti oluştur ve değerlendir</p>
                </div>
              </div>
              <button 
                onClick={handleSave}
                disabled={!canSave || isSaving}
                className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                  canSave && !isSaving
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 active:scale-95'
                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</> : canSave ? '✅ Kaydet' : '⚠️ Tüm Gerekli Alanları Doldurun'}
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-6 space-y-4">
          {/* Location Selection */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
            <label className="block text-white font-medium mb-2">
              Mekan Seçimi <span className="text-red-400">*</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                const loc = realLocations.find(l => l.id === e.target.value);
                setLocationName(loc ? loc.name : '');
              }}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400/50"
              style={{ colorScheme: 'dark' }}
            >
              <option value="" className="bg-[#2a2a3a] text-white">Mekan Seçin</option>
              {realLocations.map(loc => (
                <option key={loc.id} value={loc.id} className="bg-[#2a2a3a] text-white">
                  {loc.name}{loc.type ? ` - ${loc.type}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <label className="block text-white font-medium mb-2">
                Tarih <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-blue-400/50"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <label className="block text-white font-medium mb-2">
                Saat <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-blue-400/50"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Visit Type */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
            <label className="block text-white font-medium mb-2">
              Ziyaret Tipi <span className="text-red-400">*</span>
            </label>
            <select
              value={visitType}
              onChange={(e) => setVisitType(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400/50"
              style={{ colorScheme: 'dark' }}
            >
              {Object.entries(visitTypeConfig).map(([key, config]) => (
                <option key={key} value={key} className="bg-[#2a2a3a] text-white">
                  {config.emoji} {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
            <label className="block text-white font-medium mb-2">
              Süre (dakika) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              min="1"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400/50"
            />
          </div>

          {/* Scores */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-purple-400" />
              Değerlendirme Skorları
            </h3>

            <div className="space-y-4">
              {/* Cleanliness */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-white font-medium">Temizlik</span>
                  </div>
                  <span className="text-gray-400">*</span>
                </div>
                <StarRating score={cleanlinessScore} onRate={setCleanlinessScore} />
              </div>

              {/* Equipment */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Camera className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-white font-medium">Ekipman</span>
                  </div>
                  <span className="text-gray-400">*</span>
                </div>
                <StarRating score={equipmentScore} onRate={setEquipmentScore} />
              </div>

              {/* Staff */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-white font-medium">Personel</span>
                  </div>
                  <span className="text-gray-400">*</span>
                </div>
                <StarRating score={staffScore} onRate={setStaffScore} />
              </div>

              {/* Customer */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <Award className="w-4 h-4 text-orange-400" />
                    </div>
                    <span className="text-white font-medium">İşletme Memnuniyeti</span>
                  </div>
                  <span className="text-gray-400">*</span>
                </div>
                <StarRating score={customerScore} onRate={setCustomerScore} />
              </div>

              {/* General Average */}
              <div className="bg-gradient-to-br from-yellow-400/20 to-yellow-500/20 rounded-xl p-4 text-center border border-yellow-400/30">
                <div className="text-sm text-gray-300 mb-1">Genel Ortalama</div>
                <div className="text-3xl font-bold text-white">{generalScore}</div>
              </div>
            </div>
          </div>

          {/* Issues */}
          <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-400/20 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Tespit Edilen Sorunlar
            </h3>
            <div className="space-y-2">
              {issuesFound.map((issue, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={issue}
                    onChange={(e) => updateIssue(idx, e.target.value)}
                    placeholder="Sorun açıklayın..."
                    className="flex-1 bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-400/50"
                  />
                  {issuesFound.length > 1 && (
                    <button
                      onClick={() => removeIssue(idx)}
                      className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center hover:bg-red-500/30 transition-all active:scale-95"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addIssue}
              className="mt-3 w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95"
            >
              + Sorun Ekle
            </button>
          </div>

          {/* Actions */}
          <div className="backdrop-blur-xl bg-green-500/10 border border-green-400/20 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Alınan Aksiyonlar
            </h3>
            <div className="space-y-2">
              {actionsTaken.map((action, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={action}
                    onChange={(e) => updateAction(idx, e.target.value)}
                    placeholder="Aksiyon açıklayın..."
                    className="flex-1 bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-2 focus:outline-none focus:border-green-400/50"
                  />
                  {actionsTaken.length > 1 && (
                    <button
                      onClick={() => removeAction(idx)}
                      className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center hover:bg-red-500/30 transition-all active:scale-95"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addAction}
              className="mt-3 w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95"
            >
              + Aksiyon Ekle
            </button>
          </div>

          {/* Photo Upload */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-400" />
              Fotoğraflar
            </h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 hover:bg-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Fotoğraf Ekle
            </button>
            
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {photos.map(photo => (
                  <div key={photo.id} className="relative">
                    <img 
                      src={photo.url} 
                      alt="Upload preview"
                      className="w-full h-32 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all active:scale-95"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
            <label className="block text-white font-medium mb-2">Notlar</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Ziyaret notları..."
              className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400/50 resize-none"
            />
          </div>

          {/* Next Visit Date */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-4">
            <label className="block text-white font-medium mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Sonraki Ziyaret Tarihi <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={nextVisitDate}
              onChange={(e) => setNextVisitDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-purple-400/50"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // MAIN LIST VIEW
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
        </div>
      )}
      {apiError && !isLoading && (
        <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
          <p className="text-red-300 text-sm mb-2">{apiError}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">Tekrar Dene</button>
        </div>
      )}

      {/* Header */}
      {embedded && showOwnHeader && (
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={onBack}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-teal-400" />
                  Mekan Ziyaretleri
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  Lokasyon ziyaret kayıtları ve değerlendirmeler
                </p>
              </div>
              {/* Yeni Kayıt Ekle Button */}
              <button
                onClick={() => {
                  setShowNewVisitForm(true);
                  // Set defaults
                  const now = new Date();
                  setVisitDate(now.toISOString().split('T')[0]);
                  setVisitTime(now.toTimeString().slice(0, 5));
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white text-sm font-medium shadow-lg hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Yeni Kayıt Ekle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-6 space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-400/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-blue-400" />
              <TrendingUp className="w-5 h-5 text-blue-300" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalVisits}</div>
            <div className="text-sm text-gray-300">Tamamlanan Ziyaret</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-400/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Star className="w-8 h-8 text-yellow-400" />
              <Award className="w-5 h-5 text-yellow-300" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.avgScore.toFixed(1)}</div>
            <div className="text-sm text-gray-300">Ortalama Skor</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-400/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <FileText className="w-5 h-5 text-red-300" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.openActions}</div>
            <div className="text-sm text-gray-300">Açık Aksiyon</div>
          </div>

          <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-purple-400" />
              <Calendar className="w-5 h-5 text-purple-300" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.pendingVisits}</div>
            <div className="text-sm text-gray-300">Bekleyen Ziyaret</div>
          </div>
        </div>

        {/* Search */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mekan ara..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
            <label className="block text-gray-400 text-xs mb-1">Ziyaret Tipi</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-transparent text-white text-sm focus:outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all" className="bg-[#2a2a3a]">Tümü</option>
              <option value="routine" className="bg-[#2a2a3a]">📅 Rutin</option>
              <option value="problem" className="bg-[#2a2a3a]">⚠️ Sorun</option>
              <option value="quality" className="bg-[#2a2a3a]">⭐ Kalite</option>
              <option value="meeting" className="bg-[#2a2a3a]">🤝 Toplantı</option>
            </select>
          </div>

          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3">
            <label className="block text-gray-400 text-xs mb-1">Durum</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-transparent text-white text-sm focus:outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all" className="bg-[#2a2a3a]">Tümü</option>
              <option value="completed" className="bg-[#2a2a3a]">✅ Tamamlandı</option>
              <option value="pending" className="bg-[#2a2a3a]">⏳ Beklemede</option>
              <option value="cancelled" className="bg-[#2a2a3a]">❌ İptal</option>
            </select>
          </div>
        </div>

        {/* Visit Cards */}
        {filteredVisits.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Henüz ziyaret kaydı bulunmuyor</p>
            <p className="text-sm text-gray-500 mt-2">Yeni ziyaret eklemek için + butonunu kullanın</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVisits.map(visit => {
              const typeConfig = visitTypeConfig[visit.visitType];
              const statusConf = statusConfig[visit.status];
              const StatusIcon = statusConf.icon;

              return (
                <div
                  key={visit.id}
                  className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 hover:scale-[1.01] transition-all active:scale-95"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                        {visit.locationName}
                        {visit.hasOpenActions && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-${typeConfig.color}-500/20 text-${typeConfig.color}-300 border border-${typeConfig.color}-400/30`}>
                          {typeConfig.emoji} {typeConfig.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-${statusConf.color}-500/20 text-${statusConf.color}-300 border border-${statusConf.color}-400/30`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConf.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${
                            i <= visit.generalScore 
                              ? 'fill-yellow-400 text-yellow-400' 
                              : 'text-gray-600'
                          }`} 
                        />
                      ))}
                    </div>
                    <span className="text-white font-bold">{visit.generalScore.toFixed(1)}</span>
                  </div>

                  {/* Issues */}
                  {visit.issuesFound.length > 0 && (
                    <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-medium text-red-300">
                          {visit.issuesFound.length} Sorun Tespit Edildi
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {visit.actionsTaken.length > 0 && (
                    <div className="bg-green-500/10 border border-green-400/20 rounded-xl p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-green-300">
                          {visit.actionsTaken.length} Aksiyon Alındı
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Date & Details Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="w-4 h-4" />
                      {formatDate(visit.visitDate)} - {visit.visitTime}
                    </div>
                    <button
                      onClick={() => setSelectedVisit(visit)}
                      className="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 hover:bg-blue-500/30 transition-all active:scale-95 flex items-center gap-1"
                    >
                      Detayları Gör
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="px-4 mt-6 mb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">ℹ️</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">📍 Mekan Ziyaret Sistemi</h4>
              <p className="text-sm text-gray-400 mb-3">
                Yöneticiler ve müdürler düzenli olarak mekanlara ziyaret yaparak operasyonel performansı, 
                ekipman durumunu, personel verimliliğini ve müşteri memnuniyetini değerlendirirler. 
                Her ziyaret skorlanır, sorunlar tespit edilir ve aksiyonlar alınır.
              </p>
              <p className="text-sm text-gray-400">
                <span className="text-teal-300 font-medium">ℹ️ Yetki:</span> Bu ziyaretleri yalnızca Admin ve Müdürler görebilir.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Add Button - Only show if not embedded */}
      {!embedded && (
        <button
          onClick={() => {
            setShowNewVisitForm(true);
            // Set defaults
            const now = new Date();
            setVisitDate(now.toISOString().split('T')[0]);
            setVisitTime(now.toTimeString().slice(0, 5));
          }}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-lg flex items-center justify-center hover:scale-110 transition-all active:scale-95 z-10"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}