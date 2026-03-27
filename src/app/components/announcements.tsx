import { useState, useEffect } from 'react';
import { 
  Megaphone, Plus, X, Calendar, Clock, Image as ImageIcon, 
  Edit2, Trash2, Pin, Bell, AlertCircle, CheckCircle, ChevronLeft, Zap, Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { NewBottomNav } from './new-bottom-nav';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

type UserRole = 
  | 'yonetici'
  | 'ust-mudur'
  | 'mudur'
  | 'operasyon'
  | 'personel'
  | 'idari'
  | 'bekleyen';

type Priority = 'high' | 'medium' | 'low';
type AnnouncementType = 'temporary' | 'pinned' | 'info';

interface Announcement {
  id: string;
  title: string;
  message: string;
  photo?: string;
  type: AnnouncementType; // temporary, pinned, info
  endDate?: string; // Only for temporary
  priority: Priority;
  createdAt: string;
  createdBy: string;
  createdByRole: UserRole;
}

interface AnnouncementsProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function Announcements({ userName, userRole, onLogout, onNavigate }: AnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('personel');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'announcements' | 'pinned' | 'info'>('announcements');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formType, setFormType] = useState<AnnouncementType>('temporary');
  const [formEndDate, setFormEndDate] = useState('');
  const [formPriority, setFormPriority] = useState<Priority>('medium');

  // Load data
  useEffect(() => {
    loadAnnouncements();
    loadUserRole();
  }, []);

  // Auto-delete expired announcements and clean up old announcements from Tab 1
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupAnnouncements();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const loadUserRole = () => {
    setCurrentUserRole(userRole as UserRole);
  };

  const loadAnnouncements = async () => {
    setLoading(true);
    setApiError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER_URL}/announcements${ghostParams()}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || 'Duyurular yüklenemedi.');
        console.error('Load announcements error:', data.error);
        return;
      }
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error('Load announcements error:', err);
      setApiError('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const cleanupAnnouncements = () => {
    // Server tarafında zaten süresi dolmuş olanlar filtreleniyor.
    // Sadece client state'i temizle.
    const now = new Date();
    setAnnouncements(prev => prev.filter(a => {
      if (a.type === 'temporary' && a.endDate) return new Date(a.endDate) >= now;
      return true;
    }));
  };

  const canCreateAnnouncement = (): boolean => {
    return ['yonetici', 'ust-mudur', 'mudur', 'operasyon'].includes(currentUserRole);
  };

  // Check if user can manage (create/edit/delete) announcements based on type
  const canManageAnnouncementType = (type: AnnouncementType): boolean => {
    if (type === 'info') {
      // Only top 3 roles can manage 'info' type
      return ['yonetici', 'ust-mudur', 'mudur'].includes(currentUserRole);
    }
    // For 'temporary' and 'pinned', top 4 roles can manage
    return ['yonetici', 'ust-mudur', 'mudur', 'operasyon'].includes(currentUserRole);
  };

  // Check if user can manage a specific announcement
  const canManageAnnouncement = (announcement?: Announcement): boolean => {
    if (!announcement) {
      // For new announcements, check basic permission
      return canCreateAnnouncement();
    }
    // For existing announcements, check type-specific permission
    return canManageAnnouncementType(announcement.type);
  };

  const handleOpenModal = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormTitle(announcement.title);
      setFormMessage(announcement.message);
      setFormPhoto(announcement.photo || '');
      setFormType(announcement.type);
      setFormEndDate(announcement.endDate || '');
      setFormPriority(announcement.priority);
    } else {
      setEditingAnnouncement(null);
      setFormTitle('');
      setFormMessage('');
      setFormPhoto('');
      setFormType('temporary');
      setFormEndDate('');
      setFormPriority('medium');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormTitle('');
    setFormMessage('');
    setFormPhoto('');
    setFormType('temporary');
    setFormEndDate('');
    setFormPriority('medium');
  };

  const handleSaveAnnouncement = async () => {
    if (!formTitle.trim() || !formMessage.trim()) {
      alert('Lütfen başlık ve mesaj alanlarını doldurun!');
      return;
    }
    if (formType === 'temporary' && !formEndDate) {
      alert('Lütfen bitiş tarihi seçin veya farklı bir duyuru tipi seçin!');
      return;
    }

    setSaving(true);
    try {
      const headers = await authHeaders();
      const body = {
        title: formTitle,
        message: formMessage,
        photo: formPhoto || null,
        type: formType,
        endDate: formType === 'temporary' ? formEndDate : null,
        priority: formPriority,
      };

      let res: Response;
      if (editingAnnouncement) {
        res = await fetch(`${SERVER_URL}/announcements/${editingAnnouncement.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${SERVER_URL}/announcements`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Duyuru kaydedilemedi.');
        return;
      }

      // Listeyi yenile
      await loadAnnouncements();
      handleCloseModal();
    } catch (err) {
      console.error('Save announcement error:', err);
      alert('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER_URL}/announcements/${deletingId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setAnnouncements(prev => prev.filter(a => a.id !== deletingId));
      } else {
        const data = await res.json();
        alert(data.error || 'Duyuru silinemedi.');
      }
    } catch (err) {
      console.error('Delete announcement error:', err);
      alert('Bağlantı hatası.');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingId(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    return formatDate(dateString);
  };

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames = {
      'yonetici': 'Yönetici',
      'ust-mudur': 'Üst Müdür',
      'mudur': 'Müdür',
      'operasyon': 'Operasyon',
      'personel': 'Personel',
      'idari': 'İdari',
      'bekleyen': 'Bekleyen',
    };
    return roleNames[role] || role;
  };

  const getPriorityColor = (priority: Priority): string => {
    const priorityColors = {
      'high': '#ff4d4d',
      'medium': '#ffd4a3',
      'low': '#a8e6cf',
    };
    return priorityColors[priority] || '#a8e6cf';
  };

  const getPriorityLabel = (priority: Priority): string => {
    const priorityLabels = {
      'high': 'Yüksek Öncelik',
      'medium': 'Orta Öncelik',
      'low': 'Düşük Öncelik',
    };
    return priorityLabels[priority] || 'Orta Öncelik';
  };

  const isNew = (createdAt: string): boolean => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours < 24;
  };

  // Filter announcements by tab
  const getFilteredAnnouncements = (): Announcement[] => {
    const now = new Date();
    
    if (activeTab === 'announcements') {
      // Tab 1: All new announcements (< 24h) + active temporary announcements
      return announcements.filter(a => {
        const isNewAnnouncement = isNew(a.createdAt);
        
        // Show all new announcements (< 24h) regardless of type
        if (isNewAnnouncement) return true;
        
        // Show temporary announcements that are not expired
        if (a.type === 'temporary') {
          if (!a.endDate) return false;
          return new Date(a.endDate) >= now;
        }
        
        // Don't show old pinned or info announcements here
        return false;
      });
    } else if (activeTab === 'pinned') {
      // Tab 2: All pinned announcements
      return announcements.filter(a => a.type === 'pinned');
    } else if (activeTab === 'info') {
      // Tab 3: All info announcements
      return announcements.filter(a => a.type === 'info');
    }
    
    return [];
  };

  const sortAnnouncements = (items: Announcement[]): Announcement[] => {
    return [...items].sort((a, b) => {
      const aIsNew = isNew(a.createdAt);
      const bIsNew = isNew(b.createdAt);

      // New announcements always come first
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;

      // If both are new, sort by creation time (newest first)
      if (aIsNew && bIsNew) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      // If both are old, sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  const filteredAnnouncements = getFilteredAnnouncements();
  const sortedAnnouncements = sortAnnouncements(filteredAnnouncements);

  // Count announcements for each tab
  const getTabCount = (tab: 'announcements' | 'pinned' | 'info'): number => {
    const now = new Date();
    
    if (tab === 'announcements') {
      return announcements.filter(a => {
        const isNewAnnouncement = isNew(a.createdAt);
        if (isNewAnnouncement) return true;
        if (a.type === 'temporary') {
          if (!a.endDate) return false;
          return new Date(a.endDate) >= now;
        }
        return false;
      }).length;
    } else if (tab === 'pinned') {
      return announcements.filter(a => a.type === 'pinned').length;
    } else if (tab === 'info') {
      return announcements.filter(a => a.type === 'info').length;
    }
    
    return 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] pb-20">
      {/* Create Button - Yetkili tüm roller için */}
      {canCreateAnnouncement() && (
        <div className="sticky top-[64px] z-30 px-4 pt-4">
          <button
            onClick={() => handleOpenModal()}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#0d4d2d] font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-[#a8e6cf]/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Duyuru Oluştur</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="sticky top-[73px] z-20 backdrop-blur-xl bg-[#1a1a2e]/80 border-b border-white/10 px-4">
        <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex-shrink-0 px-4 py-3 font-bold text-sm transition-all relative ${
              activeTab === 'announcements'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              <span>Duyurular</span>
              {getTabCount('announcements') > 0 && (
                <div className="px-2 py-0.5 rounded-full bg-[#a8e6cf]/20 text-[#a8e6cf] text-xs font-bold">
                  {getTabCount('announcements')}
                </div>
              )}
            </div>
            {activeTab === 'announcements' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8]"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('pinned')}
            className={`flex-shrink-0 px-4 py-3 font-bold text-sm transition-all relative ${
              activeTab === 'pinned'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4" />
              <span>Sabit</span>
              {getTabCount('pinned') > 0 && (
                <div className="px-2 py-0.5 rounded-full bg-[#ffd4a3]/20 text-[#ffd4a3] text-xs font-bold">
                  {getTabCount('pinned')}
                </div>
              )}
            </div>
            {activeTab === 'pinned' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f]"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={`flex-shrink-0 px-4 py-3 font-bold text-sm transition-all relative ${
              activeTab === 'info'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>Genel Bilgiler</span>
              {getTabCount('info') > 0 && (
                <div className="px-2 py-0.5 rounded-full bg-[#9db4ff]/20 text-[#9db4ff] text-xs font-bold">
                  {getTabCount('info')}
                </div>
              )}
            </div>
            {activeTab === 'info' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#9db4ff] to-[#7a9cff]"
              />
            )}
          </button>
        </div>
      </div>

      {/* Announcements List */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Megaphone className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 text-sm">Duyurular yükleniyor...</p>
          </div>
        ) : apiError ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-red-400 text-sm">{apiError}</p>
            <button onClick={loadAnnouncements} className="mt-3 text-xs text-[#a8e6cf] underline">Tekrar dene</button>
          </div>
        ) : sortedAnnouncements.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-10 h-10 text-gray-500" />
            </div>
            <p className="text-gray-400 text-sm">
              {activeTab === 'announcements' && 'Henüz duyuru yok'}
              {activeTab === 'pinned' && 'Henüz sabit duyuru yok'}
              {activeTab === 'info' && 'Henüz genel bilgi yok'}
            </p>
            {canCreateAnnouncement() && (
              <p className="text-gray-500 text-xs mt-2">İlk içeriği oluşturun</p>
            )}
          </div>
        ) : (
          sortedAnnouncements.map((announcement, index) => {
            const priorityColor = getPriorityColor(announcement.priority);
            const bgOpacity = announcement.priority === 'high' ? 'from-white/15 to-white/10' : 
                            announcement.priority === 'medium' ? 'from-white/10 to-white/5' : 
                            'from-white/5 to-white/0';
            const showNewBadge = isNew(announcement.createdAt);
            
            return (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`relative backdrop-blur-xl bg-gradient-to-br ${bgOpacity} rounded-2xl border border-white/20 shadow-xl overflow-hidden`}
                style={{ borderLeftWidth: '4px', borderLeftColor: priorityColor }}
              >
                {/* Type Badge */}
                <div className="absolute top-3 right-3 z-10">
                  {announcement.type === 'pinned' && (
                    <div className="px-3 py-1 rounded-full bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center gap-1 shadow-lg">
                      <Pin className="w-3 h-3 text-[#744210]" />
                      <span className="text-xs font-bold text-[#744210]">Sabit</span>
                    </div>
                  )}
                  {announcement.type === 'info' && (
                    <div className="px-3 py-1 rounded-full bg-gradient-to-br from-[#9db4ff] to-[#7a9cff] flex items-center gap-1 shadow-lg">
                      <Info className="w-3 h-3 text-[#1e3a8a]" />
                      <span className="text-xs font-bold text-[#1e3a8a]">Bilgi</span>
                    </div>
                  )}
                </div>

                {/* NEW Badge - Below Type Badge */}
                {showNewBadge && (
                  <div className={`absolute right-3 z-10 ${announcement.type !== 'temporary' ? 'top-[52px]' : 'top-3'}`}>
                    <div className="px-3 py-1 rounded-full bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center gap-1 shadow-lg">
                      <span className="text-xs font-bold text-[#0d4d2d]">🆕 YENİ</span>
                    </div>
                  </div>
                )}

                {/* Photo */}
                {announcement.photo && (
                  <div className="w-full h-48 bg-black/20">
                    <img 
                      src={announcement.photo} 
                      alt={announcement.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-white mb-2">{announcement.title}</h3>
                  <p className="text-sm text-gray-300 mb-3 whitespace-pre-wrap">{announcement.message}</p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{getTimeAgo(announcement.createdAt)}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {announcement.createdBy} • {getRoleDisplayName(announcement.createdByRole)}
                      </div>
                      {announcement.type === 'temporary' && announcement.endDate && (
                        <div className="flex items-center gap-1 text-xs text-[#ffd4a3] mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>Bitiş: {formatDate(announcement.endDate)}</span>
                        </div>
                      )}
                    </div>

                    {canManageAnnouncement(announcement) && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenModal(announcement)}
                          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all active:scale-95"
                        >
                          <Edit2 className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(announcement.id)}
                          className="w-8 h-8 rounded-lg bg-[#ffb3ba]/20 hover:bg-[#ffb3ba]/30 border border-[#ffb3ba]/30 flex items-center justify-center transition-all active:scale-95"
                        >
                          <Trash2 className="w-4 h-4 text-[#ffb3ba]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg max-h-[80vh] overflow-y-auto backdrop-blur-xl bg-gradient-to-br from-[#2a2a3a] to-[#1a1a2e] rounded-3xl border border-white/20 shadow-2xl z-[51] p-6"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-[#744210]" />
                  </div>
                  <h2 className="text-xl font-black text-white">
                    {editingAnnouncement ? 'Düzenle' : 'Yeni İçerik'}
                  </h2>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all active:scale-95"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* Type Selection */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">İçerik Tipi</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormType('temporary')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                        formType === 'temporary' 
                          ? 'bg-[#a8e6cf]/20 border-[#a8e6cf] shadow-lg shadow-[#a8e6cf]/20' 
                          : 'bg-white/5 border-white/10 hover:border-[#a8e6cf]/50'
                      }`}
                    >
                      <Clock className="w-5 h-5 text-[#a8e6cf]" />
                      <div className="text-center">
                        <div className="text-xs font-bold text-white">Süreli</div>
                        <div className="text-xs text-gray-400">Duyuru</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('pinned')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                        formType === 'pinned' 
                          ? 'bg-[#ffd4a3]/20 border-[#ffd4a3] shadow-lg shadow-[#ffd4a3]/20' 
                          : 'bg-white/5 border-white/10 hover:border-[#ffd4a3]/50'
                      }`}
                    >
                      <Pin className="w-5 h-5 text-[#ffd4a3]" />
                      <div className="text-center">
                        <div className="text-xs font-bold text-white">Sabit</div>
                        <div className="text-xs text-gray-400">Duyuru</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => canManageAnnouncementType('info') && setFormType('info')}
                      disabled={!canManageAnnouncementType('info')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        !canManageAnnouncementType('info') 
                          ? 'opacity-40 cursor-not-allowed' 
                          : 'active:scale-95'
                      } ${
                        formType === 'info' 
                          ? 'bg-[#9db4ff]/20 border-[#9db4ff] shadow-lg shadow-[#9db4ff]/20' 
                          : 'bg-white/5 border-white/10 hover:border-[#9db4ff]/50'
                      }`}
                    >
                      <Info className="w-5 h-5 text-[#9db4ff]" />
                      <div className="text-center">
                        <div className="text-xs font-bold text-white">Genel</div>
                        <div className="text-xs text-gray-400">Bilgi</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Başlık</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Başlık girin..."
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#ffd4a3] transition-all"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Mesaj</label>
                  <textarea
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    placeholder="Mesaj girin..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-[#ffd4a3] transition-all resize-none"
                  />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Fotoğraf (Opsiyonel)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-gray-400 flex items-center gap-2 cursor-pointer hover:bg-white/15 transition-all"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-sm">
                        {formPhoto ? 'Fotoğraf seçildi' : 'Fotoğraf seç'}
                      </span>
                    </label>
                    {formPhoto && (
                      <div className="mt-2 relative">
                        <img 
                          src={formPhoto} 
                          alt="Preview" 
                          className="w-full h-32 object-cover rounded-xl"
                        />
                        <button
                          onClick={() => setFormPhoto('')}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#ffb3ba]/90 hover:bg-[#ffb3ba] flex items-center justify-center transition-all"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* End Date (only for temporary) */}
                {formType === 'temporary' && (
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-[#ffd4a3] transition-all"
                    />
                  </div>
                )}

                {/* Priority */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Öncelik Seviyesi</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormPriority('high')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                        formPriority === 'high' 
                          ? 'bg-[#ff4d4d]/20 border-[#ff4d4d] shadow-lg shadow-[#ff4d4d]/20' 
                          : 'bg-white/5 border-white/10 hover:border-[#ff4d4d]/50'
                      }`}
                    >
                      <Zap className="w-5 h-5 text-[#ff4d4d]" />
                      <div className="text-center">
                        <div className="text-xs font-bold text-white">Yüksek</div>
                        <div className="text-xs text-gray-400">🔴</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPriority('medium')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                        formPriority === 'medium' 
                          ? 'bg-[#ffd4a3]/20 border-[#ffd4a3] shadow-lg shadow-[#ffd4a3]/20' 
                          : 'bg-white/5 border-white/10 hover:border-[#ffd4a3]/50'
                      }`}
                    >
                      <Zap className="w-5 h-5 text-[#ffd4a3]" />
                      <div className="text-center">
                        <div className="text-xs font-bold text-white">Orta</div>
                        <div className="text-xs text-gray-400">🟡</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPriority('low')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 ${
                        formPriority === 'low' 
                          ? 'bg-[#a8e6cf]/20 border-[#a8e6cf] shadow-lg shadow-[#a8e6cf]/20' 
                          : 'bg-white/5 border-white/10 hover:border-[#a8e6cf]/50'
                      }`}
                    >
                      <Zap className="w-5 h-5 text-[#a8e6cf]" />
                      <div className="text-center">
                        <div className="text-xs font-bold text-white">Düşük</div>
                        <div className="text-xs text-gray-400">🔵</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-3 rounded-xl bg-[#9db4ff]/10 border border-[#9db4ff]/30">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#9db4ff] flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-300">
                      {formType === 'temporary' && (
                        <p><span className="font-bold text-[#a8e6cf]">Süreli Duyuru:</span> Sadece "Duyurular" sekmesinde görünür. Bitiş tarihinde otomatik silinir.</p>
                      )}
                      {formType === 'pinned' && (
                        <p><span className="font-bold text-[#ffd4a3]">Sabit Duyuru:</span> İlk 24 saat "Duyurular" + "Sabit Duyurular" sekmelerinde görünür. 24 saat sonra sadece "Sabit Duyurular" sekmesinde kalır.</p>
                      )}
                      {formType === 'info' && (
                        <p><span className="font-bold text-[#9db4ff]">Genel Bilgi:</span> İlk 24 saat "Duyurular" + "Genel Bilgiler" sekmelerinde görünür. 24 saat sonra sadece "Genel Bilgiler" sekmesinde kalır.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold transition-all active:scale-95"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveAnnouncement}
                    disabled={saving}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#0d4d2d] font-bold shadow-lg hover:shadow-[#a8e6cf]/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <><span className="w-4 h-4 border-2 border-[#0d4d2d]/40 border-t-[#0d4d2d] rounded-full animate-spin inline-block" /> Kaydediliyor...</>
                    ) : editingAnnouncement ? 'Güncelle' : 'Oluştur'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelDelete}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm backdrop-blur-xl bg-gradient-to-br from-[#2a2a3a] to-[#1a1a2e] rounded-3xl border border-white/20 shadow-2xl z-[51] p-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#ffb3ba]/20 border border-[#ffb3ba]/30 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-[#ffb3ba]" />
                </div>
                <h3 className="text-xl font-black text-white mb-2">Silmek İstediğinize Emin Misiniz?</h3>
                <p className="text-sm text-gray-400 mb-6">Bu işlem geri alınamaz.</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelDelete}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold transition-all active:scale-95"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={saving}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-br from-[#ffb3ba] to-[#ff8a8f] text-white font-bold shadow-lg hover:shadow-[#ffb3ba]/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Siliniyor...</>
                    ) : 'Sil'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      {['personel', 'operasyon', 'bekleyen'].includes(userRole) && (
        <NewBottomNav
          activeTab="home"
          onTabChange={onNavigate}
          userRole={userRole}
        />
      )}
    </div>
  );
}