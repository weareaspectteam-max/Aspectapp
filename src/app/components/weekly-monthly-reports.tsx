import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Calendar,
  MapPin,
  FileText,
  CheckSquare,
  AlertTriangle,
  Check,
  Clock,
  X,
  Star,
  Edit2,
  Loader2
} from 'lucide-react';
import { UserRole } from './login';
import { getToken, buildHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface Report {
  id: string;
  managerName: string;
  type: 'weekly' | 'monthly';
  startDate: string; // Format: "DD.MM.YYYY"
  endDate: string;   // Format: "DD.MM.YYYY"
  locations: string[];
  highlights: string[];
  challenges: string[];
  status: 'draft' | 'submitted' | 'overdue';
  notes: string;
}

interface WeeklyMonthlyReportsProps {
  onBack: () => void;
  userName?: string;
  userRole?: UserRole;
  accessToken?: string;
}

const MOCK_REPORTS: Report[] = [
  {
    id: '1',
    managerName: 'Ahmet Yılmaz',
    type: 'weekly',
    startDate: '01.03.2026',
    endDate: '07.03.2026',
    locations: ['Beach Club Antalya', 'Sunset Restaurant'],
    highlights: [
      "Beach Club'da haftalık satış hedefi %115 oranında aşıldı",
      "Yeni eleman Mehmet başarılı adaptasyon gösterdi",
      "Albüm stok sistemi optimize edildi"
    ],
    challenges: [
      "Hava şartları nedeniyle 2 gün fotoğraf çekimi durdu",
      "Yeni yazıcıda teknik sorun yaşandı (giderildi)"
    ],
    status: 'submitted',
    notes: 'Genel olarak çok verimli bir hafta geçirdik.'
  },
  {
    id: '2',
    managerName: 'Ayşe Demir',
    type: 'weekly',
    startDate: '23.02.2026',
    endDate: '29.02.2026',
    locations: ['Tekne Turu', 'Paradise Beach'],
    highlights: [
      "Tekne turlarında günlük ortalama 45 fotoğraf satışı gerçekleşti",
      "Müşteri memnuniyet oranı %95'e yükseldi",
      "Yeni drone ekipmanı ile ilk çekimler başarıyla tamamlandı"
    ],
    challenges: [
      "Paradise Beach'te elektrik kesintisi yaşandı"
    ],
    status: 'draft',
    notes: ''
  },
  {
    id: '3',
    managerName: 'Mehmet Kaya',
    type: 'monthly',
    startDate: '01.02.2026',
    endDate: '28.02.2026',
    locations: ['Beach Club Antalya', 'Sunset Restaurant', 'Tekne Turu'],
    highlights: [
      "Şubat ayında toplam 1.250 fotoğraf satışı yapıldı (%18 artış)",
      "2 yeni personel işe alındı ve eğitim tamamlandı",
      "Yeni drone ekipmanı ile hava çekimleri başlatıldı",
      "Sosyal medya takipçi sayısı 5.000'e ulaştı"
    ],
    challenges: [
      "Yazıcı bakım maliyetleri beklenenin üzerinde çıktı",
      "Bir personel hastalık nedeniyle 1 hafta izin kullandı"
    ],
    status: 'submitted',
    notes: 'Mart ayı için yeni hedefler belirlendi. Operasyonel verimliliği artırmak öncelik.'
  },
  {
    id: '4',
    managerName: 'Zeynep Arslan',
    type: 'weekly',
    startDate: '15.02.2026',
    endDate: '21.02.2026',
    locations: ['Paradise Beach'],
    highlights: [
      "Hafta sonu yoğunluğu rekor seviyede oldu (250+ fotoğraf)",
      "Yeni albüm tasarımları müşteriler tarafından çok beğenildi"
    ],
    challenges: [],
    status: 'overdue',
    notes: ''
  },
  {
    id: '5',
    managerName: 'Can Yıldız',
    type: 'monthly',
    startDate: '01.03.2026',
    endDate: '31.03.2026',
    locations: ['Sunset Restaurant', 'Beach Club Antalya'],
    highlights: [
      "Mart ayı devam ediyor - ara değerlendirme",
      "İlk 2 haftada hedefin %60'ı tamamlandı"
    ],
    challenges: [],
    status: 'draft',
    notes: 'Ay sonunda final rapor güncellenecek.'
  },
  {
    id: '6',
    managerName: 'Fatma Şahin',
    type: 'weekly',
    startDate: '01.03.2026',
    endDate: '07.03.2026',
    locations: ['Tekne Turu'],
    highlights: [
      "Tekne turlarında müşteri memnuniyeti artışı gözlendi",
      "Yeni pazarlama stratejisi olumlu sonuç verdi"
    ],
    challenges: [
      "Hava koşulları bazı turları etkiledi"
    ],
    status: 'draft',
    notes: 'Gelecek hafta için iyileştirmeler planlandı.'
  },
  {
    id: '7',
    managerName: 'Fatma Şahin',
    type: 'monthly',
    startDate: '01.02.2026',
    endDate: '28.02.2026',
    locations: ['Tekne Turu', 'Paradise Beach'],
    highlights: [
      "Şubat ayında toplam 850 fotoğraf satışı gerçekleşti",
      "Yeni ekipman kullanımı personel tarafından başarıyla uygulandı",
      "Müşteri geri bildirimleri %92 olumlu"
    ],
    challenges: [
      "Bazı günlerde personel eksikliği yaşandı",
      "Teknik ekipman bakımı için ek bütçe gerekti"
    ],
    status: 'submitted',
    notes: 'Mart ayı için kapasite artırımı planlanıyor.'
  }
];

export function WeeklyMonthlyReports({ onBack, userName = '', userRole = 'mudur', accessToken = '' }: WeeklyMonthlyReportsProps) {
  const [selectedTab, setSelectedTab] = useState<'weekly' | 'monthly'>('weekly');
  const [showNewReportForm, setShowNewReportForm] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [mekanlar, setMekanlar] = useState<{ id: string; name: string; type: string }[]>([]);

  const getAuthHeaders = async () => buildHeaders(await getToken());

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const h = await getAuthHeaders();
        const [raporRes, mekanRes] = await Promise.all([
          fetch(`${API_BASE}/mudur-raporlar`, { headers: h }),
          fetch(`${API_BASE}/mekanlar`, { headers: h }),
        ]);
        if (raporRes.ok) { const d = await raporRes.json(); setReports(d.raporlar || []); }
        else { const e = await raporRes.json().catch(() => ({})); setApiError(e.error || `HTTP ${raporRes.status}`); }
        if (mekanRes.ok) { const d = await mekanRes.json(); setMekanlar(d.mekanlar || []); }
      } catch (err) { console.log('fetchData mudur-raporlar error:', err); setApiError('Sunucuya bağlanılamadı.'); }
      finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  const [newReport, setNewReport] = useState({
    type: 'weekly' as Report['type'],
    startDate: '',
    endDate: '',
    locations: [] as string[],
    highlights: [''],
    challenges: [] as string[],
    status: 'draft' as Report['status'],
    notes: ''
  });

  // Yetki Kontrolü Fonksiyonları
  const canViewReport = (report: Report): boolean => {
    // Admin ve Üst Müdür tüm raporları görebilir
    if (userRole === 'yonetici' || userRole === 'ust-mudur') {
      return true;
    }
    // Müdür ve Operasyon sadece kendi raporlarını görebilir
    return report.managerName === userName;
  };

  const canEditReport = (report: Report): boolean => {
    // Sadece taslak raporlar düzenlenebilir
    if (report.status !== 'draft') return false;
    
    // Admin herkesin taslağını düzenleyebilir
    if (userRole === 'yonetici') {
      return true;
    }
    
    // Diğerleri sadece kendi taslağını düzenleyebilir
    return report.managerName === userName;
  };

  const filteredReports = reports.filter(report => {
    // Tip filtresi
    if (report.type !== selectedTab) return false;
    
    // Yetki kontrolü
    return canViewReport(report);
  });

  // Düzenleme Fonksiyonu
  const handleEditReport = (report: Report) => {
    setEditingReport(report);
    setNewReport({
      type: report.type,
      startDate: report.startDate,
      endDate: report.endDate,
      locations: [...report.locations],
      highlights: [...report.highlights],
      challenges: [...report.challenges],
      status: report.status,
      notes: report.notes
    });
    setShowNewReportForm(true);
  };

  // Handler Functions
  const handleAddLocation = () => {
    setNewReport({ 
      ...newReport, 
      locations: [...newReport.locations, ''] 
    });
  };

  const handleRemoveLocation = (index: number) => {
    setNewReport({ 
      ...newReport, 
      locations: newReport.locations.filter((_, i) => i !== index) 
    });
  };

  const handleLocationChange = (index: number, value: string) => {
    const updated = [...newReport.locations];
    updated[index] = value;
    setNewReport({ ...newReport, locations: updated });
  };

  const handleAddHighlight = () => {
    setNewReport({ 
      ...newReport, 
      highlights: [...newReport.highlights, ''] 
    });
  };

  const handleRemoveHighlight = (index: number) => {
    setNewReport({ 
      ...newReport, 
      highlights: newReport.highlights.filter((_, i) => i !== index) 
    });
  };

  const handleHighlightChange = (index: number, value: string) => {
    const updated = [...newReport.highlights];
    updated[index] = value;
    setNewReport({ ...newReport, highlights: updated });
  };

  const handleAddChallenge = () => {
    setNewReport({ 
      ...newReport, 
      challenges: [...newReport.challenges, ''] 
    });
  };

  const handleRemoveChallenge = (index: number) => {
    setNewReport({ 
      ...newReport, 
      challenges: newReport.challenges.filter((_, i) => i !== index) 
    });
  };

  const handleChallengeChange = (index: number, value: string) => {
    const updated = [...newReport.challenges];
    updated[index] = value;
    setNewReport({ ...newReport, challenges: updated });
  };

  // Lokasyon toggle (mekanlar listesinden)
  const handleToggleLocation = (mekanName: string) => {
    const current = newReport.locations;
    if (current.includes(mekanName)) {
      setNewReport({ ...newReport, locations: current.filter(l => l !== mekanName) });
    } else {
      setNewReport({ ...newReport, locations: [...current, mekanName] });
    }
  };

  const canSave = 
    newReport.startDate.trim() !== '' &&
    newReport.endDate.trim() !== '' &&
    newReport.locations.length > 0 &&
    newReport.highlights.some(h => h.trim() !== '');

  const handleSaveReport = async () => {
    if (!canSave) return;

    const payload = {
      managerName: userName,
      type: newReport.type,
      startDate: newReport.startDate.trim(),
      endDate: newReport.endDate.trim(),
      locations: newReport.locations,
      highlights: newReport.highlights.filter(h => h.trim() !== ''),
      challenges: newReport.challenges.filter(c => c.trim() !== ''),
      status: newReport.status,
      notes: newReport.notes.trim(),
    };

    setIsSaving(true);
    try {
      const h = await getAuthHeaders();
      let res: Response;
      if (editingReport) {
        res = await fetch(`${API_BASE}/mudur-raporlar/${editingReport.id}`, { method: 'PUT', headers: h, body: JSON.stringify(payload) });
        if (res.ok) { const d = await res.json(); setReports(prev => prev.map(r => r.id === editingReport.id ? d.rapor : r)); }
      } else {
        res = await fetch(`${API_BASE}/mudur-raporlar`, { method: 'POST', headers: h, body: JSON.stringify(payload) });
        if (res.ok) { const d = await res.json(); setReports(prev => [d.rapor, ...prev]); }
      }
      if (res && !res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Kayıt başarısız.'); return; }
    } catch (err) { console.log('handleSaveReport error:', err); alert('Sunucu hatası!'); }
    finally { setIsSaving(false); }

    setShowNewReportForm(false);
    setEditingReport(null);
    setNewReport({ type: 'weekly', startDate: '', endDate: '', locations: [], highlights: [''], challenges: [], status: 'draft', notes: '' });
  };

  // NEW REPORT FORM VIEW
  if (showNewReportForm) {
    return (
      <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
        {/* Form Header (Sticky) */}
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
          <div className="px-4 py-4">
            {/* Title Row */}
            <div className="flex items-center gap-3 mb-3">
              {/* Back Button */}
              <button
                onClick={() => {
                  setShowNewReportForm(false);
                  setNewReport({ type: 'weekly', startDate: '', endDate: '', locations: [], highlights: [''], challenges: [], status: 'draft', notes: '' });
                }}
                className="w-10 h-10 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 flex items-center justify-center active:scale-95 transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              
              {/* Title Group */}
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Plus className="w-6 h-6 text-purple-400" />
                  Yeni Rapor Kaydı
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  Periyodik rapor detayları
                </p>
              </div>
            </div>

            {/* Raporu yapan - sadece gösterim */}
            <div className="mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <span className="text-lg">👤</span>
              <div>
                <p className="text-xs text-gray-400">Raporu hazırlayan</p>
                <p className="text-sm font-semibold text-white">{userName}</p>
              </div>
            </div>
            
            {/* Save Button */}
            <button
              onClick={handleSaveReport}
              disabled={!canSave || isSaving}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                canSave && !isSaving
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:scale-[1.02] active:scale-95'
                  : 'bg-gray-600 opacity-50 cursor-not-allowed'
              }`}
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</> : canSave ? '✅ Raporu Kaydet' : '⚠️ Gerekli Alanları Doldurun'}
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="px-6 mt-4 space-y-4 pb-6">
          {/* 1. Rapor Tipi */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-white mb-2">
              <FileText className="w-4 h-4 inline mr-2 text-purple-400" />
              Rapor Tipi *
            </label>
            <select
              value={newReport.type}
              onChange={(e) => setNewReport({ ...newReport, type: e.target.value as 'weekly' | 'monthly' })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              style={{ colorScheme: 'dark' }}
            >
              <option value="weekly" className="bg-[#2a2a3a] text-white">📅 Haftalık Rapor</option>
              <option value="monthly" className="bg-[#2a2a3a] text-white">📆 Aylık Rapor</option>
            </select>
          </div>

          {/* 2. Tarih Aralığı */}
          <div className="grid grid-cols-2 gap-3">
            {/* Başlangıç Tarihi */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
              <label className="block text-sm font-semibold text-white mb-2">
                <Calendar className="w-4 h-4 inline mr-2 text-purple-400" />
                Başlangıç *
              </label>
              <input
                type="text"
                value={newReport.startDate}
                onChange={(e) => setNewReport({ ...newReport, startDate: e.target.value })}
                placeholder="01.03.2026"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Bitiş Tarihi */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
              <label className="block text-sm font-semibold text-white mb-2">
                <Calendar className="w-4 h-4 inline mr-2 text-purple-400" />
                Bitiş *
              </label>
              <input
                type="text"
                value={newReport.endDate}
                onChange={(e) => setNewReport({ ...newReport, endDate: e.target.value })}
                placeholder="07.03.2026"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* 3. Lokasyonlar — mekan listesinden çoklu seçim */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-blue-400 mb-3">
              <MapPin className="w-4 h-4 inline mr-2" />
              Lokasyonlar * <span className="text-xs text-gray-400 font-normal ml-1">(birden fazla seçilebilir)</span>
            </label>

            {mekanlar.length === 0 ? (
              <div className="flex items-center justify-center py-4 gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                Mekanlar yükleniyor...
              </div>
            ) : (
              <div className="space-y-2">
                {mekanlar.map((mekan) => {
                  const isSelected = newReport.locations.includes(mekan.name);
                  return (
                    <button
                      key={mekan.id}
                      onClick={() => handleToggleLocation(mekan.name)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] text-left ${
                        isSelected
                          ? 'bg-blue-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <MapPin className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-500'}`} />
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${isSelected ? 'text-blue-200' : 'text-white'}`}>{mekan.name}</p>
                        {mekan.type && <p className="text-xs text-gray-500 capitalize">{mekan.type}</p>}
                      </div>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected ? 'bg-blue-500 border-blue-400' : 'border-white/20 bg-white/5'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {newReport.locations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-blue-400/20">
                {newReport.locations.map(loc => (
                  <span key={loc} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    <MapPin className="w-3 h-3" />
                    {loc}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 4. Öne Çıkanlar */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-green-400 mb-3">
              <CheckSquare className="w-4 h-4 inline mr-2" />
              ✅ Öne Çıkanlar *
            </label>
            
            {newReport.highlights.map((highlight, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <textarea
                  value={highlight}
                  onChange={(e) => handleHighlightChange(index, e.target.value)}
                  placeholder="Bu dönemde öne çıkan başarı, hedef aşımı, olumlu gelişme..."
                  rows={2}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 resize-none"
                />
                {newReport.highlights.length > 1 && (
                  <button
                    onClick={() => handleRemoveHighlight(index)}
                    className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 transition-all self-start"
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            ))}
            
            <button
              onClick={handleAddHighlight}
              className="w-full py-2 mt-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-semibold hover:bg-green-500/30 transition-all"
            >
              + Öne Çıkan Ekle
            </button>
          </div>

          {/* 5. Zorluklar */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-orange-400 mb-3">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              ⚠️ Zorluklar <span className="text-xs text-gray-500">(Opsiyonel)</span>
            </label>
            
            {newReport.challenges.map((challenge, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <textarea
                  value={challenge}
                  onChange={(e) => handleChallengeChange(index, e.target.value)}
                  placeholder="Karşılaşılan zorluk, problem, engel..."
                  rows={2}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
                />
                <button
                  onClick={() => handleRemoveChallenge(index)}
                  className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 transition-all self-start"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
            
            <button
              onClick={handleAddChallenge}
              className="w-full py-2 mt-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm font-semibold hover:bg-orange-500/30 transition-all"
            >
              + Zorluk Ekle
            </button>
          </div>

          {/* 6. Durum */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-white mb-2">
              <Star className="w-4 h-4 inline mr-2 text-yellow-400" />
              Durum *
            </label>
            <select
              value={newReport.status}
              onChange={(e) => setNewReport({ ...newReport, status: e.target.value as Report['status'] })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              style={{ colorScheme: 'dark' }}
            >
              <option value="draft" className="bg-[#2a2a3a] text-white">📝 Taslak</option>
              <option value="submitted" className="bg-[#2a2a3a] text-white">✅ Teslim Edildi</option>
            </select>
          </div>

          {/* 7. Ek Notlar */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-white mb-2">
              📝 Ek Notlar <span className="text-xs text-gray-500">(Opsiyonel)</span>
            </label>
            <textarea
              value={newReport.notes}
              onChange={(e) => setNewReport({ ...newReport, notes: e.target.value })}
              placeholder="Ek açıklamalar, gözlemler, gelecek dönem planları..."
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>
        </div>
      </div>
    );
  }

  // MAIN LIST VIEW
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-[5] backdrop-blur-xl bg-gradient-to-b from-[#2a2a3a]/95 via-[#2a2a3a]/90 to-transparent border-b border-white/10">
        <div className="px-6 py-4">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-3">
            {/* Back Button */}
            <button 
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            {/* Title */}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Müdür Raporları</h1>
              <span className="text-2xl">📊</span>
            </div>

            {/* New Report Button */}
            <button 
              onClick={() => setShowNewReportForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 border-2 border-purple-400/30 shadow-lg shadow-purple-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-sm">Yeni Rapor</span>
            </button>
          </div>

          {/* Subtitle */}
          <p className="text-sm text-gray-400 ml-14">
            Haftalık ve aylık periyodik raporlar
          </p>
        </div>
      </div>

      {/* Tab System */}
      <div className="px-6 mt-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Weekly Tab */}
            <button 
              onClick={() => setSelectedTab('weekly')}
              className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                selectedTab === 'weekly'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/50 border-2 border-purple-400/30'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <span className="mr-2">📅</span>
              Haftalık Raporlar
            </button>

            {/* Monthly Tab */}
            <button 
              onClick={() => setSelectedTab('monthly')}
              className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                selectedTab === 'monthly'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/50 border-2 border-purple-400/30'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              <span className="mr-2">📆</span>
              Aylık Raporlar
            </button>
          </div>
        </div>
      </div>

      {/* Report Cards List */}
      <div className="px-6 mt-6 space-y-4">
        {filteredReports.map((report) => (
          <div 
            key={report.id}
            className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-500/20 rounded-2xl p-5 hover:scale-[1.02] transition-all duration-200 relative"
          >
            {/* Edit Button - Sadece taslak raporlarda ve yetki varsa */}
            {canEditReport(report) && (
              <button
                onClick={() => handleEditReport(report)}
                className="absolute top-4 right-4 w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center hover:bg-blue-500/30 transition-all active:scale-95 group z-10"
                title="Raporu Düzenle"
              >
                <Edit2 className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
              </button>
            )}

            {/* Card Header */}
            <div className="flex items-start justify-between mb-4 pr-10">
              <div className="flex-1">
                {/* Manager Name */}
                <h3 className="text-xl font-bold text-white mb-2">
                  {report.managerName}
                </h3>
                {/* Date Range */}
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {report.type === 'weekly' 
                      ? `${report.startDate.split('.')[0]}-${report.endDate.split('.')[0]} ${report.endDate.split('.')[1] === '03' ? 'Mart' : 'Şubat'} ${report.endDate.split('.')[2]}`
                      : report.endDate.split('.')[1] === '02' ? 'Şubat 2026' : 'Mart 2026'
                    }
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              {report.status === 'submitted' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400 font-semibold">Teslim Edildi</span>
                </div>
              )}
              {report.status === 'draft' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-full">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-orange-400 font-semibold">Taslak</span>
                </div>
              )}
              {report.status === 'overdue' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400 font-semibold">Gecikmiş</span>
                </div>
              )}
            </div>

            {/* Location Badges */}
            <div className="flex flex-wrap gap-2 mt-4 mb-4">
              {report.locations.map((location, idx) => (
                <span 
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs font-medium text-purple-300"
                >
                  <span>📍</span>
                  {location}
                </span>
              ))}
            </div>

            {/* Highlights Section */}
            <div className="mt-5 mb-4">
              {/* Title */}
              <div className="flex items-center gap-2 mb-3">
                <CheckSquare className="w-5 h-5 text-green-400" />
                <h4 className="text-sm font-semibold text-green-400">Öne Çıkanlar</h4>
              </div>
              
              {/* List */}
              <ul className="space-y-1.5">
                {report.highlights.map((highlight, idx) => (
                  <li 
                    key={idx}
                    className="text-sm text-gray-300 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-pink-400 before:font-bold"
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>

            {/* Challenges Section */}
            {report.challenges.length > 0 && (
              <div className="mt-4 mb-4">
                {/* Title */}
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <h4 className="text-sm font-semibold text-orange-400">Zorluklar</h4>
                </div>
                
                {/* List */}
                <ul className="space-y-1.5">
                  {report.challenges.map((challenge, idx) => (
                    <li 
                      key={idx}
                      className="text-sm text-gray-300 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-orange-400 before:font-bold"
                    >
                      {challenge}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {report.notes && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-sm text-gray-400 italic">
                  💭 {report.notes}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info Card */}
      <div className="px-6 mt-6 mb-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">ℹ️</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">📊 Periyodik Raporlama Sistemi</h4>
              <p className="text-sm text-gray-400 mb-3">
                Yetkililer haftalık ve aylık olarak lokasyonlardaki faaliyetleri, başarıları ve 
                karşılaşılan zorlukları raporlarlar. Bu raporlar performans takibi ve stratejik 
                karar alma süreçlerinde kullanılır.
              </p>
              <p className="text-sm text-gray-400">
                <span className="text-blue-300 font-medium">ℹ️ Yetki:</span> Her yetkili yalnızca kendi yazdığı raporu okuyabilir. Admin tüm raporları okuyabilir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}