import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  User,
  MessageSquare,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  X,
  Clock,
  MapPin,
  FileText,
  Briefcase,
  Loader2
} from 'lucide-react';
import { UserRole } from './login';
import { getToken, buildHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface Interview {
  id: string;
  managerName: string;
  staffName: string;
  staffRole: string;
  location: string;
  date: string;
  type: 'performance' | 'feedback' | 'development' | 'problem-solving';
  duration: number; // minutes
  topics: string[];
  staffPerformance: {
    salesScore: number;
    customerServiceScore: number;
    teamworkScore: number;
    attendanceScore: number;
  };
  discussionPoints: string[];
  agreements: string[];
  nextMeetingDate: string;
  mood: 'positive' | 'neutral' | 'negative';
}

interface StaffInterviewsProps {
  onBack: () => void;
  userName?: string;
  userRole?: UserRole;
  accessToken?: string;
}

const mockInterviews: Interview[] = [
  {
    id: '1',
    managerName: 'Ahmet Yılmaz',
    staffName: 'Mehmet Özkan',
    staffRole: 'Fotoğrafçı',
    location: 'Beach Club Antalya',
    date: '05.03.2026',
    type: 'performance',
    duration: 30,
    topics: ['Satış Performansı', 'Liderlik', 'Müşteri Memnuniyeti'],
    staffPerformance: {
      salesScore: 85,
      customerServiceScore: 90,
      teamworkScore: 88,
      attendanceScore: 95
    },
    discussionPoints: [
      'Satış hedeflerini %120 aştı',
      'Müşteri memnuniyeti yüksek',
      'Liderlik gösteriyor'
    ],
    agreements: [
      'Terfi değerlendirmesi',
      'Mentor görevlendirilecek',
      '%15 maaş artışı'
    ],
    nextMeetingDate: '05.04.2026',
    mood: 'positive'
  },
  {
    id: '2',
    managerName: 'Ayşe Demir',
    staffName: 'Zeynep Kaya',
    staffRole: 'Satış Danışmanı',
    location: 'Tekne Turu', // ✅ FIXED: Changed from "Marina Tekne Turu" to match Mekan Yönetimi
    date: '03.03.2026',
    type: 'problem-solving',
    duration: 45,
    topics: ['Müşteri Şikayetleri', 'Stres Yönetimi', 'Ekip İletişimi'],
    staffPerformance: {
      salesScore: 65,
      customerServiceScore: 70,
      teamworkScore: 60,
      attendanceScore: 85
    },
    discussionPoints: [
      'Müşteri şikayetleri arttı',
      'Stres yüksek',
      'Ekip iletişimi zayıf'
    ],
    agreements: [
      'Çalışma saatleri gözden geçirilecek',
      'Stres yönetimi eğitimi',
      '2 hafta sonra kontrol'
    ],
    nextMeetingDate: '17.03.2026',
    mood: 'neutral'
  },
  {
    id: '3',
    managerName: 'Mehmet Kaya',
    staffName: 'Can Yıldız',
    staffRole: 'Asistan Fotoğrafçı',
    location: 'Paradise Beach',
    date: '01.03.2026',
    type: 'development',
    duration: 40,
    topics: ['Kariyer Gelişimi', 'Eğitim Talebi', 'Video Prodüksiyon'],
    staffPerformance: {
      salesScore: 75,
      customerServiceScore: 80,
      teamworkScore: 85,
      attendanceScore: 90
    },
    discussionPoints: [
      'Profesyonel eğitim istiyor',
      'Video çekiminde yetenekli',
      'Drone öğrenmek istiyor'
    ],
    agreements: [
      'Fotoğrafçılık kursu',
      'Drone sertifikası',
      'Sosyal medya görevi',
      '6 ay sonra değerlendirme'
    ],
    nextMeetingDate: '01.09.2026',
    mood: 'positive'
  },
  {
    id: '4',
    managerName: 'Zeynep Arslan',
    staffName: 'Elif Şahin',
    staffRole: 'Fotoğrafçı',
    location: 'Sunset Restaurant',
    date: '28.02.2026',
    type: 'feedback',
    duration: 25,
    topics: ['İş Memnuniyeti', 'Çalışma Koşulları', 'Komisyon Sistemi'],
    staffPerformance: {
      salesScore: 80,
      customerServiceScore: 85,
      teamworkScore: 90,
      attendanceScore: 88
    },
    discussionPoints: [
      'İşinden memnun',
      'Çalışma saatleri uygun',
      'Komisyon sistemi şeffaf olmalı'
    ],
    agreements: [
      'Komisyon sistemi anlatılacak',
      'Performans raporları paylaşılacak'
    ],
    nextMeetingDate: '28.03.2026',
    mood: 'positive'
  },
  {
    id: '5',
    managerName: 'Ahmet Yılmaz',
    staffName: 'Burak Demir',
    staffRole: 'Satış Danışmanı',
    location: 'Beach Club Antalya',
    date: '25.02.2026',
    type: 'performance',
    duration: 35,
    topics: ['Hedef Performansı', 'Ürün Bilgisi', 'Özgüven'],
    staffPerformance: {
      salesScore: 55,
      customerServiceScore: 65,
      teamworkScore: 70,
      attendanceScore: 75
    },
    discussionPoints: [
      'Hedeflerin altında',
      'Kendine güven eksik',
      'Ürün bilgisi yetersiz'
    ],
    agreements: [
      'Yoğun ürün eğitimi',
      'Mentörlük programı',
      'Mini hedefler belirlendi',
      '2 hafta sonra kontrol'
    ],
    nextMeetingDate: '11.03.2026',
    mood: 'neutral'
  }
];

const interviewTypeConfig = {
  performance: { emoji: '📊', label: 'Performans', color: 'purple' },
  feedback: { emoji: '💬', label: 'Geri Bildirim', color: 'blue' },
  development: { emoji: '🚀', label: 'Gelişim', color: 'green' },
  'problem-solving': { emoji: '⚠️', label: 'Sorun Çözme', color: 'orange' }
};

const moodConfig = {
  positive: { icon: TrendingUp, label: 'Pozitif', color: 'green' },
  neutral: { icon: Minus, label: 'Nötr', color: 'yellow' },
  negative: { icon: TrendingDown, label: 'Negatif', color: 'red' }
};

export function StaffInterviews({ onBack, userName = '', userRole = 'personel', accessToken = '' }: StaffInterviewsProps) {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showNewInterviewForm, setShowNewInterviewForm] = useState(false);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string; avatar: string }[]>([]);

  const getAuthHeaders = async () => buildHeaders(await getToken());

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const h = await getAuthHeaders();
        const [gorusmeRes, personelRes] = await Promise.all([
          fetch(`${API_BASE}/gorusmeler`, { headers: h }),
          fetch(`${API_BASE}/users`, { headers: h }),
        ]);
        if (gorusmeRes.ok) { const d = await gorusmeRes.json(); setInterviews(d.gorusmeler || []); }
        else { const e = await gorusmeRes.json().catch(() => ({})); setApiError(e.error || `HTTP ${gorusmeRes.status}`); }
        if (personelRes.ok) {
          const d = await personelRes.json();
          const aktifRoller = ['personel', 'operasyon', 'mudur', 'ust-mudur', 'idari'];
          const mapped = (d.users || [])
            .filter((u: any) => aktifRoller.includes(u.role))
            .map((u: any) => ({
              id: u.id,
              name: u.full_name || u.email || 'İsimsiz',
              role: u.role,
              avatar: u.avatar || '👤',
            }));
          setStaffList(mapped);
        } else {
          console.log('Personel listesi yüklenemedi:', personelRes.status);
        }
      } catch (err) { console.log('fetchData gorusmeler error:', err); setApiError('Sunucuya bağlanılamadı.'); }
      finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  // Yetki kontrolü: Yönetici ve Üst Müdür hepsini görebilir, diğerleri sadece kendi görüşmelerini
  const canSeeAllInterviews = userRole === 'yonetici' || userRole === 'ust-mudur';

  // Filter interviews
  const filteredInterviews = selectedType === 'all' 
    ? interviews 
    : interviews.filter(i => i.type === selectedType);

  // Yetki bazlı filtreleme
  const visibleInterviews = canSeeAllInterviews
    ? filteredInterviews
    : filteredInterviews.filter(i => 
        i.managerName === userName || 
        i.staffName === userName
      );

  // Form States — managerName ve location kaldırıldı, userName otomatik kullanılıyor
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState(30);
  const [interviewType, setInterviewType] = useState<Interview['type']>('performance');
  const [mood, setMood] = useState<Interview['mood']>('positive');
  const [salesScore, setSalesScore] = useState(50);
  const [customerServiceScore, setCustomerServiceScore] = useState(50);
  const [teamworkScore, setTeamworkScore] = useState(50);
  const [attendanceScore, setAttendanceScore] = useState(50);
  const [topics, setTopics] = useState<string[]>(['']);
  const [discussionPoints, setDiscussionPoints] = useState<string[]>(['']);
  const [agreements, setAgreements] = useState<string[]>(['']);
  const [nextMeetingDate, setNextMeetingDate] = useState('');

  const resetForm = () => {
    setSelectedStaffId('');
    setStaffName('');
    setStaffRole('');
    setDate('');
    setDuration(30);
    setInterviewType('performance');
    setMood('positive');
    setSalesScore(50);
    setCustomerServiceScore(50);
    setTeamworkScore(50);
    setAttendanceScore(50);
    setTopics(['']);
    setDiscussionPoints(['']);
    setAgreements(['']);
    setNextMeetingDate('');
  };

  const addTopic = () => setTopics([...topics, '']);
  const removeTopic = (index: number) => setTopics(topics.filter((_, i) => i !== index));
  const updateTopic = (index: number, value: string) => {
    const updated = [...topics];
    updated[index] = value;
    setTopics(updated);
  };

  const addDiscussionPoint = () => setDiscussionPoints([...discussionPoints, '']);
  const removeDiscussionPoint = (index: number) => setDiscussionPoints(discussionPoints.filter((_, i) => i !== index));
  const updateDiscussionPoint = (index: number, value: string) => {
    const updated = [...discussionPoints];
    updated[index] = value;
    setDiscussionPoints(updated);
  };

  const addAgreement = () => setAgreements([...agreements, '']);
  const removeAgreement = (index: number) => setAgreements(agreements.filter((_, i) => i !== index));
  const updateAgreement = (index: number, value: string) => {
    const updated = [...agreements];
    updated[index] = value;
    setAgreements(updated);
  };

  const canSave = 
    staffName.trim() !== '' &&
    date.trim() !== '' &&
    topics.some(t => t.trim() !== '') &&
    discussionPoints.some(d => d.trim() !== '');

  const handleSave = async () => {
    const validTopics = topics.filter(t => t.trim() !== '');
    const validDiscussionPoints = discussionPoints.filter(d => d.trim() !== '');
    const validAgreements = agreements.filter(a => a.trim() !== '');

    const payload = {
      managerName: userName,
      staffName, staffRole,
      location: '',
      date,
      type: interviewType, duration,
      topics: validTopics,
      staffPerformance: { salesScore, customerServiceScore, teamworkScore, attendanceScore },
      discussionPoints: validDiscussionPoints,
      agreements: validAgreements,
      nextMeetingDate, mood,
    };

    setIsSaving(true);
    try {
      const h = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/gorusmeler`, { method: 'POST', headers: h, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Kayıt başarısız.'); return; }
      const { gorusme } = await res.json();
      setInterviews(prev => [gorusme, ...prev]);
      setShowNewInterviewForm(false);
      resetForm();
    } catch (err) { console.log('handleSave gorusme error:', err); alert('Sunucu hatası!'); }
    finally { setIsSaving(false); }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  // NEW INTERVIEW FORM
  if (showNewInterviewForm) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => {
                  setShowNewInterviewForm(false);
                  resetForm();
                }}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Plus className="w-6 h-6 text-green-400" />
                  Yeni Görüşme Kaydı
                </h1>
                <p className="text-sm text-gray-400">Personel görüşmesi detayları</p>
              </div>
            </div>
            {/* Müdür bilgisi - sadece gösterim */}
            <div className="mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <span className="text-lg">👤</span>
              <div>
                <p className="text-xs text-gray-400">Görüşmeyi yapan</p>
                <p className="text-sm font-semibold text-white">{userName}</p>
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
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</> : canSave ? '✅ Görüşmeyi Kaydet' : '⚠️ Gerekli Alanları Doldurun'}
            </button>
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          {/* Personel Seçimi */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-400" />
              Personel Seçimi <span className="text-red-400">*</span>
            </h3>
            {staffList.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                Personel listesi yükleniyor...
              </div>
            ) : (
              <div className="space-y-2">
                {staffList
                  .filter(s => s.name !== userName)
                  .map(s => {
                    const isSelected = selectedStaffId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedStaffId(s.id);
                          setStaffName(s.name);
                          setStaffRole(s.role);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-95 text-left ${
                          isSelected
                            ? 'bg-blue-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-2xl">{s.avatar || '👤'}</span>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isSelected ? 'text-blue-200' : 'text-white'}`}>{s.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{s.role}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Date & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <label className="block text-white font-medium mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Tarih <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="05.03.2026"
                className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-400/50"
              />
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <label className="block text-white font-medium mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                Süre (dk)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min="1"
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-purple-400/50"
              />
            </div>
          </div>

          {/* Type & Mood */}
          <div className="grid grid-cols-2 gap-4">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <label className="block text-white font-medium mb-2">Görüşme Tipi</label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value as Interview['type'])}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400/50"
                style={{ colorScheme: 'dark' }}
              >
                <option value="performance" className="bg-[#2a2a3a]">📊 Performans</option>
                <option value="feedback" className="bg-[#2a2a3a]">💬 Geri Bildirim</option>
                <option value="development" className="bg-[#2a2a3a]">🚀 Gelişim</option>
                <option value="problem-solving" className="bg-[#2a2a3a]">⚠️ Sorun Çözme</option>
              </select>
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
              <label className="block text-white font-medium mb-2">Ruh Hali</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as Interview['mood'])}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-blue-400/50"
                style={{ colorScheme: 'dark' }}
              >
                <option value="positive" className="bg-[#2a2a3a]">😊 Pozitif</option>
                <option value="neutral" className="bg-[#2a2a3a]">😐 Nötr</option>
                <option value="negative" className="bg-[#2a2a3a]">😟 Negatif</option>
              </select>
            </div>
          </div>

          {/* Performance Scores */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              ⭐ Performans Değerlendirmesi
            </h3>
            <div className="space-y-4">
              {/* Sales */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400 text-sm">Satış</span>
                  <span className={`font-bold ${getScoreColor(salesScore)}`}>{salesScore}/100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={salesScore}
                  onChange={(e) => setSalesScore(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(168 85 247) 0%, rgb(168 85 247) ${salesScore}%, rgb(55 65 81) ${salesScore}%, rgb(55 65 81) 100%)`
                  }}
                />
              </div>
              {/* Customer Service */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400 text-sm">Müşteri Hizmetleri</span>
                  <span className={`font-bold ${getScoreColor(customerServiceScore)}`}>{customerServiceScore}/100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customerServiceScore}
                  onChange={(e) => setCustomerServiceScore(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(168 85 247) 0%, rgb(168 85 247) ${customerServiceScore}%, rgb(55 65 81) ${customerServiceScore}%, rgb(55 65 81) 100%)`
                  }}
                />
              </div>
              {/* Teamwork */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400 text-sm">Ekip Çalışması</span>
                  <span className={`font-bold ${getScoreColor(teamworkScore)}`}>{teamworkScore}/100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={teamworkScore}
                  onChange={(e) => setTeamworkScore(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(168 85 247) 0%, rgb(168 85 247) ${teamworkScore}%, rgb(55 65 81) ${teamworkScore}%, rgb(55 65 81) 100%)`
                  }}
                />
              </div>
              {/* Attendance */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400 text-sm">Devamsızlık</span>
                  <span className={`font-bold ${getScoreColor(attendanceScore)}`}>{attendanceScore}/100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={attendanceScore}
                  onChange={(e) => setAttendanceScore(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(168 85 247) 0%, rgb(168 85 247) ${attendanceScore}%, rgb(55 65 81) ${attendanceScore}%, rgb(55 65 81) 100%)`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Topics */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              🏷️ Görüşme Konuları <span className="text-red-400">*</span>
            </h3>
            <div className="space-y-2">
              {topics.map((topic, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => updateTopic(idx, e.target.value)}
                    placeholder="Konu başlığı..."
                    className="flex-1 bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-2 focus:outline-none focus:border-gray-400/50"
                  />
                  {topics.length > 1 && (
                    <button
                      onClick={() => removeTopic(idx)}
                      className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center hover:bg-red-500/30 transition-all active:scale-95"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addTopic}
              className="mt-3 w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95"
            >
              + Konu Ekle
            </button>
          </div>

          {/* Discussion Points */}
          <div className="backdrop-blur-xl bg-blue-500/10 border border-blue-400/20 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              💭 Görüşülen Konular <span className="text-red-400">*</span>
            </h3>
            <div className="space-y-2">
              {discussionPoints.map((point, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => updateDiscussionPoint(idx, e.target.value)}
                    placeholder="Görüşme detayı..."
                    className="flex-1 bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-400/50"
                  />
                  {discussionPoints.length > 1 && (
                    <button
                      onClick={() => removeDiscussionPoint(idx)}
                      className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center hover:bg-red-500/30 transition-all active:scale-95"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addDiscussionPoint}
              className="mt-3 w-full py-2 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 hover:bg-blue-500/30 transition-all active:scale-95"
            >
              + Görüşme Konusu Ekle
            </button>
          </div>

          {/* Agreements */}
          <div className="backdrop-blur-xl bg-green-500/10 border border-green-400/20 rounded-2xl p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              ✅ Alınan Kararlar
            </h3>
            <div className="space-y-2">
              {agreements.map((agreement, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={agreement}
                    onChange={(e) => updateAgreement(idx, e.target.value)}
                    placeholder="Karar detayı..."
                    className="flex-1 bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-2 focus:outline-none focus:border-green-400/50"
                  />
                  {agreements.length > 1 && (
                    <button
                      onClick={() => removeAgreement(idx)}
                      className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center hover:bg-red-500/30 transition-all active:scale-95"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addAgreement}
              className="mt-3 w-full py-2 rounded-xl bg-green-500/20 border border-green-400/30 text-green-300 hover:bg-green-500/30 transition-all active:scale-95"
            >
              + Karar Ekle
            </button>
          </div>

          {/* Next Meeting Date */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
            <label className="block text-white font-medium mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-400" />
              Sonraki Görüşme Tarihi
            </label>
            <input
              type="text"
              value={nextMeetingDate}
              onChange={(e) => setNextMeetingDate(e.target.value)}
              placeholder="05.04.2026"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl px-4 py-3 focus:outline-none focus:border-yellow-400/50"
            />
          </div>
        </div>
      </div>
    );
  }

  // MAIN LIST VIEW
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      )}
      {apiError && !isLoading && (
        <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
          <p className="text-red-300 text-sm mb-2">{apiError}</p>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-[5] backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
        <div className="px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-blue-400">💬</span>
                Personel Görüşmeleri
              </h1>
              <p className="text-sm text-gray-400">Müdür-personel birebir görüşme kayıtları</p>
            </div>
            <button
              onClick={() => setShowNewInterviewForm(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 text-green-300 text-xs font-medium hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Yeni Ekle
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setSelectedType('all')}
              className={`py-2.5 rounded-xl font-medium text-sm transition-all ${
                selectedType === 'all'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              🔍 Tümü
            </button>
            <button
              onClick={() => setSelectedType('performance')}
              className={`py-2.5 rounded-xl font-medium text-sm transition-all ${
                selectedType === 'performance'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              📊 Performans
            </button>
            <button
              onClick={() => setSelectedType('feedback')}
              className={`py-2.5 rounded-xl font-medium text-sm transition-all ${
                selectedType === 'feedback'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              💬 Geri Bildirim
            </button>
            <button
              onClick={() => setSelectedType('development')}
              className={`py-2.5 rounded-xl font-medium text-sm transition-all ${
                selectedType === 'development'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              🚀 Gelişim
            </button>
            <button
              onClick={() => setSelectedType('problem-solving')}
              className={`col-span-2 py-2.5 rounded-xl font-medium text-sm transition-all ${
                selectedType === 'problem-solving'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              ⚠️ Sorun Çözme
            </button>
          </div>
        </div>

        {/* Interview Cards */}
        <div className="space-y-4">
          {visibleInterviews.map((interview) => {
            const typeConfig = interviewTypeConfig[interview.type];
            const moodConf = moodConfig[interview.mood];
            const MoodIcon = moodConf.icon;

            return (
              <div
                key={interview.id}
                className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/20 rounded-2xl p-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-bold text-white">{interview.staffName}</h3>
                    </div>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      {interview.staffRole}
                    </span>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                      <MessageSquare className="w-4 h-4" />
                      <span>{interview.managerName}</span>
                      <span className="text-gray-600">|</span>
                      <Calendar className="w-4 h-4" />
                      <span>{interview.date}</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-${moodConf.color}-500/20 border border-${moodConf.color}-400/30`}>
                    <MoodIcon className={`w-4 h-4 text-${moodConf.color}-400`} />
                    <span className={`text-xs font-medium text-${moodConf.color}-300`}>{moodConf.label}</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-gray-500/20 text-gray-300 border border-gray-400/30">
                    📍 {interview.location}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-${typeConfig.color}-500/20 text-${typeConfig.color}-300 border border-${typeConfig.color}-400/30`}>
                    {typeConfig.emoji} {typeConfig.label}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    ⏱️ {interview.duration} dk
                  </span>
                </div>

                {/* Performance Scores */}
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <h4 className="text-white font-semibold mb-3 text-sm">⭐ Performans Değerlendirmesi</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Satış</div>
                      <div className={`text-xl font-bold ${getScoreColor(interview.staffPerformance.salesScore)}`}>
                        {interview.staffPerformance.salesScore}/100
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Müşteri Hizmetleri</div>
                      <div className={`text-xl font-bold ${getScoreColor(interview.staffPerformance.customerServiceScore)}`}>
                        {interview.staffPerformance.customerServiceScore}/100
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Ekip Çalışması</div>
                      <div className={`text-xl font-bold ${getScoreColor(interview.staffPerformance.teamworkScore)}`}>
                        {interview.staffPerformance.teamworkScore}/100
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Devamsızlık</div>
                      <div className={`text-xl font-bold ${getScoreColor(interview.staffPerformance.attendanceScore)}`}>
                        {interview.staffPerformance.attendanceScore}/100
                      </div>
                    </div>
                  </div>
                </div>

                {/* Discussion Points */}
                <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-3 mb-3">
                  <h4 className="text-blue-300 font-semibold mb-2 text-sm">💭 Görüşülen Konular</h4>
                  <div className="space-y-1">
                    {interview.discussionPoints.map((point, idx) => (
                      <p key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{point}</span>
                      </p>
                    ))}
                  </div>
                </div>

                {/* Agreements */}
                {interview.agreements.length > 0 && (
                  <div className="bg-green-500/10 border border-green-400/20 rounded-xl p-3 mb-3">
                    <h4 className="text-green-300 font-semibold mb-2 text-sm">✅ Alınan Kararlar</h4>
                    <div className="space-y-1">
                      {interview.agreements.map((agreement, idx) => (
                        <p key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="text-green-400 mt-1">•</span>
                          <span>{agreement}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  {interview.nextMeetingDate ? (
                    <span className="text-xs text-gray-400">
                      Sonraki Görüşme: {interview.nextMeetingDate}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Sonraki görüşme planlanmadı</span>
                  )}
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {interview.topics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-300 border border-gray-400/20"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Card */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-400/20 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">💬 Görüşme Sistemi</h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                Yöneticiler personelle düzenli birebir görüşmeler yaparak performans, motivasyon, kariyer gelişimi ve sorunları takip ederler. 
                Her görüşme kaydedilir, performans skorları güncellenir ve aksiyonlar belirlenir. Sistem sayesinde personel gelişimi sürekli izlenir.
              </p>
              <p className="text-sm text-gray-400 leading-relaxed">
                <span className="text-blue-300 font-medium">ℹ️ Yetki:</span> Her yönetici yalnızca kendi yazdığı raporu okuyabilir. Admin her raporu okuyabilir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}