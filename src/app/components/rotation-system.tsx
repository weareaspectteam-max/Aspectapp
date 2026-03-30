import { useState, useEffect } from 'react';
import {
  Users, MapPin, Send, Calendar, Clock, Plus, X, Check,
  ChevronRight, Edit2, Trash2, CheckCircle, XCircle,
  AlertCircle, CheckSquare, Square, CalendarX, FileText,
  RefreshCw, Repeat, Zap, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import {
  getStaffMembers,
  getLocations,
  getTasks,
  getLeaveRequests,
  getDailyOnLeave,
  getWorkHistory,
  updateTask,
  updateMultipleTasks,
  deleteTask,
  saveDailyOnLeave,
  updateLeaveStatus,
  sendMessageToRotationChannel,
  formatRotationMessage,
  formatRevisionMessage,
  formatCancelMessage,
  formatOnLeaveMessage,
  formatStandbyMessage,
  canEditLeaveRequest,
  canApproveRejectLeave,
  cleanupExpiredLeaveRequests,
  type Task,
  type StaffMember,
  type LeaveRequest,
  type Location,
  type Personnel,
  type UserRole,
} from '../services/rotation-service';
import { RotationTaskModal } from './rotation-task-modal';
import { RotationLeaveModal } from './rotation-leave-modal';
import { localDateStr, toLocalDateStr } from '../lib/date';


interface RotationSystemProps {
  userName: string;
  userRole: UserRole;
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

type ActiveTab = 'plan' | 'assigned' | 'leaves';
type ModalType = 'regular_location' | 'extra_special';
type HistoryFilter = 'week' | 'month' | '2months';

// Zaman farkı hesaplama utility
const getTimeAgo = (timestamp?: string): string => {
  if (!timestamp) return '';
  
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dk önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  return `${diffDays} gün önce`;
};

export function RotationSystem({ userName, userRole, accessToken, onLogout, onNavigate }: RotationSystemProps) {
  // ==========================================
  // STATE
  // ==========================================
  const [activeTab, setActiveTab] = useState<ActiveTab>(userRole === 'personel' ? 'assigned' : 'plan');
  const [selectedDate, setSelectedDate] = useState<string>(localDateStr());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('regular_location');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingTask, setCancellingTask] = useState<Task | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [selectedOnLeave, setSelectedOnLeave] = useState<string[]>([]);
  const [selectedStandby, setSelectedStandby] = useState<string[]>([]);
  const [visibleTaskCount, setVisibleTaskCount] = useState(30);
  const [showPersonalHistory, setShowPersonalHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('month');
  const [preselectedLocation, setPreselectedLocation] = useState<string>('');
  const [editingLeaveRequest, setEditingLeaveRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Data from service
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [dailyOnLeave, setDailyOnLeave] = useState<Record<string, string[]>>({});

  // ==========================================
  // LOAD DATA
  // ==========================================
  useEffect(() => {
    // Mevcut kullanıcı ID'sini al
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setCurrentUserId(session.user.id);
    });
    loadData();
  }, []);

  // İzin listesi yüklenince süresi dolmuşları temizle (fire-and-forget)
  useEffect(() => {
    if (leaveRequests.length > 0) {
      cleanupExpiredLeaveRequests(accessToken);
    }
  }, [leaveRequests.length]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staff, locs, taskList, leaveList, dailyLeave] = await Promise.all([
        getStaffMembers(accessToken),
        getLocations(accessToken),
        getTasks(accessToken),
        getLeaveRequests(accessToken),
        getDailyOnLeave(accessToken),
      ]);
      setStaffMembers(staff);
      setLocations(locs);
      setTasks(taskList);
      setLeaveRequests(leaveList);
      setDailyOnLeave(dailyLeave);
    } catch (err) {
      console.error('loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh tasks when needed
  const refreshTasks = async () => {
    try {
      const taskList = await getTasks(accessToken);
      console.log('[refreshTasks] fetched:', taskList.length, 'tasks');
      setTasks(taskList);
    } catch (err) {
      console.error('[refreshTasks] error:', err);
      // Sessizce başarısız ol — optimistik güncelleme zaten çalıştı
    }
  };

  // Refresh leave requests when needed
  const refreshLeaveRequests = async () => {
    const leaveList = await getLeaveRequests(accessToken);
    setLeaveRequests(leaveList);
  };

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Get current user ID - Supabase session'dan
  const getCurrentUserId = (): string => {
    return currentUserId;
  };

  // 📋 GÖREV PLANLA SEKMESİ: Seçili tarihe ait tüm görevleri göster
  const todayTasks = tasks.filter(t => t.date === selectedDate);
  
  const getLocationTasks = () => {
    return todayTasks.filter(t => 
      locations.some(loc => loc.name === t.location) && t.type === 'regular'
    );
  };

  const getExtraSpecialTasks = () => {
    return todayTasks.filter(t => 
      (!locations.some(loc => loc.name === t.location) && t.type === 'regular') ||
      t.type === 'special' ||
      t.type === 'extra'
    );
  };

  const getOnLeavePersonnel = (): StaffMember[] => {
    const onLeaveIds = dailyOnLeave[selectedDate] || [];
    return staffMembers.filter(s => {
      if (s.role === 'yonetici') return false; // yönetici izin listesinde görünmez
      // 1. Onaylı izin (status kalıcı veya rotation_leave_ onaylı — ikisi aynı kavram)
      if (s.status === 'on_leave') return true;
      const hasApprovedLeave = leaveRequests.some(
        leave =>
          leave.personnelId === s.id &&
          leave.status === 'approved' &&
          new Date(selectedDate) >= new Date(leave.startDate) &&
          new Date(selectedDate) <= new Date(leave.endDate)
      );
      if (hasApprovedLeave) return true;
      // 2. Günlük manuel işaretleme
      if (onLeaveIds.includes(s.id)) return true;
      return false;
    });
  };

  const getStandbyPersonnel = (): StaffMember[] => {
    const taskPersonnelIds = new Set<string>();
    todayTasks.forEach(task => {
      if (task.status !== 'cancelled') {
        task.personnel.forEach(p => taskPersonnelIds.add(p.id));
      }
    });

    const onLeavePersonnel = getOnLeavePersonnel();
    const onLeaveIds = new Set(onLeavePersonnel.map(p => p.id));

    return staffMembers.filter(s => 
      s.role !== 'yonetici' &&
      s.status === 'active' && 
      !taskPersonnelIds.has(s.id) && 
      !onLeaveIds.has(s.id)
    );
  };

  // Get date range for date selector
  const getDateRange = (): string[] => {
    const dates: string[] = [];
    const today = new Date(selectedDate);
    
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      // Türkiye lokal tarihi (UTC değil) — gece yarısı 00:00–02:59 UTC arası kayma önlendi
      dates.push(toLocalDateStr(date));
    }
    
    return dates;
  };

  const dateRange = getDateRange();

  // Format date display
  const formatDateDisplay = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    
    const day = d.getDate();
    const month = d.toLocaleDateString('tr-TR', { month: 'long' });
    const weekday = d.toLocaleDateString('tr-TR', { weekday: 'long' });
    const isToday = d.getTime() === today.getTime();
    
    return { day, month, weekday, isToday };
  };

  // Change date
  const changeDate = (offset: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offset);
    setSelectedDate(toLocalDateStr(current));
  };

  const goToToday = () => {
    setSelectedDate(localDateStr());
  };

  // Görev simgesi
  const getGorevIcon = (gorev?: string): string => {
    if (gorev === 'fotograf-satis') return '📸';
    if (gorev === 'baski') return '🖨️';
    if (gorev === 'album') return '📒';
    if (gorev === 'gozlemci') return '👁️';
    return '';
  };

  // Get time period icon
  const getTimePeriodIcon = (startTime: string): string => {
    const hour = parseInt(startTime.split(':')[0]);
    if (hour >= 6 && hour < 12) return '🌅';
    if (hour >= 12 && hour < 18) return '☀️';
    if (hour >= 18 && hour < 22) return '🌆';
    return '🌙';
  };

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleOpenTaskModal = (type: ModalType, task?: Task, locationName?: string) => {
    setModalType(type);
    setEditingTask(task || null);
    setPreselectedLocation(locationName || '');
    setShowTaskModal(true);
  };

  const handleCloseTaskModal = () => {
    setShowTaskModal(false);
    setEditingTask(null);
    setPreselectedLocation('');
    // Sunucudan senkronize et (arka planda)
    refreshTasks();
  };

  // Optimistik güncelleme: task modal'dan kaydedilir kaydedilmez local state'e ekle/güncelle
  const handleTaskSaved = (savedTask: Task) => {
    console.log('[handleTaskSaved] optimistic update:', savedTask.id, savedTask.date, savedTask.type);
    setTasks(prev => {
      const exists = prev.some(t => t.id === savedTask.id);
      if (exists) {
        return prev.map(t => t.id === savedTask.id ? savedTask : t);
      } else {
        return [...prev, savedTask];
      }
    });
  };

  const handleOpenCancelModal = (task: Task) => {
    setCancellingTask(task);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelTask = async () => {
    if (!cancellingTask || !cancelReason.trim()) return;

    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    await updateTask(cancellingTask.id, {
      status: 'cancelled',
      cancelledAt: currentTime,
      cancelReason: cancelReason,
    }, accessToken);

    const message = formatCancelMessage({ ...cancellingTask, cancelReason });
    sendMessageToRotationChannel(message);

    setNotificationMessage('Görev iptal edildi ❌');
    setShowSuccessNotification(true);
    setTimeout(() => setShowSuccessNotification(false), 3000);

    setShowCancelModal(false);
    setCancellingTask(null);
    setCancelReason('');
    refreshTasks();
  };

  const handleReactivateTask = async (task: Task) => {
    const currentTime = new Date().toISOString();

    await updateTask(task.id, {
      status: 'revised',
      cancelledAt: undefined,
      cancelReason: undefined,
      revisedAt: currentTime,
      revisionCount: (task.revisionCount || 0) + 1,
    }, accessToken);

    const message = formatRevisionMessage(task);
    sendMessageToRotationChannel(message);

    setNotificationMessage('Görev yeniden aktif edildi 🔄');
    setShowSuccessNotification(true);
    setTimeout(() => setShowSuccessNotification(false), 3000);

    refreshTasks();
  };

  const handleEditTask = async (task: Task) => {
    if (task.status === 'sent') {
      const currentTime = new Date().toISOString();
      await updateTask(task.id, {
        status: 'revised',
        revisedAt: currentTime,
        revisionCount: (task.revisionCount || 0) + 1,
      }, accessToken);
      refreshTasks();
    }

    handleOpenTaskModal(task.type === 'regular' ? 'regular_location' : 'extra_special', task);
  };

  const handleRemoveTask = async (taskId: string) => {
    if (confirm('Bu görevi silmek istediğinize emin misiniz?')) {
      // Optimistik silme: görev anında listeden çıkar
      setTasks(prev => prev.filter(t => t.id !== taskId));
      try {
        await deleteTask(taskId, accessToken);
        setNotificationMessage('Görev silindi 🗑️');
        setShowSuccessNotification(true);
        setTimeout(() => setShowSuccessNotification(false), 3000);
        // Sunucuyla senkronize et (arka planda)
        refreshTasks();
      } catch (err: any) {
        console.error('[handleRemoveTask] deleteTask hatası:', err);
        // Silme başarısız → görevi geri yükle
        refreshTasks();
        setNotificationMessage(`Görev silinemedi ❌ ${err?.message || ''}`);
        setShowSuccessNotification(true);
        setTimeout(() => setShowSuccessNotification(false), 4000);
      }
    }
  };

  // ==========================================
  // SEND TASKS
  // ==========================================

  const handleSendTasks = async (sendAll: boolean) => {
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const sendableTasks = todayTasks.filter(t => t.status === 'draft' || t.status === 'revised');
    const tasksToSendIds = sendAll ? sendableTasks.map(t => t.id) : selectedTasks;

    const onLeavePersonnel = getOnLeavePersonnel();
    const standbyPersonnel = getStandbyPersonnel();

    const onLeaveToSend = sendAll ? onLeavePersonnel.map(p => p.id) : selectedOnLeave;
    const standbyToSend = sendAll ? standbyPersonnel.map(p => p.id) : selectedStandby;

    const updates = tasksToSendIds.map(taskId => {
      const task = sendableTasks.find(t => t.id === taskId);
      if (!task) return null;

      return {
        id: taskId,
        changes: {
          status: 'sent' as const,
          sentAt: currentTime,
        }
      };
    }).filter(Boolean) as { id: string; changes: Partial<Task> }[];

    if (updates.length > 0) {
      await updateMultipleTasks(updates, accessToken);
    }
    
    // Send messages
    const tasksToSend = sendableTasks.filter(t => tasksToSendIds.includes(t.id));
    
    // Send rotation message for all tasks at once
    if (tasksToSend.length > 0) {
      const updatedTasks = tasksToSend.map(t => ({ ...t, status: 'sent' as const, sentAt: currentTime }));
      const message = formatRotationMessage(updatedTasks, selectedDate);
      sendMessageToRotationChannel(message);
    }
    
    // Send on-leave messages
    if (onLeaveToSend.length > 0) {
      const onLeaveToSendPersonnel = onLeavePersonnel.filter(p => onLeaveToSend.includes(p.id));
      onLeaveToSendPersonnel.forEach(person => {
        const message = formatOnLeaveMessage(person, selectedDate);
        sendMessageToRotationChannel(message);
      });
    }
    
    // Send standby messages
    if (standbyToSend.length > 0) {
      const standbyToSendPersonnel = standbyPersonnel.filter(p => standbyToSend.includes(p.id));
      const message = formatStandbyMessage(standbyToSendPersonnel, selectedDate);
      sendMessageToRotationChannel(message);
    }
    
    // Show success notification
    const totalSent = tasksToSendIds.length + onLeaveToSend.length + standbyToSend.length;
    setNotificationMessage(`${totalSent} görev gönderildi! ✅`);
    setShowSuccessNotification(true);
    setTimeout(() => setShowSuccessNotification(false), 3000);
    
    // Clear selections
    setSelectedTasks([]);
    setSelectedOnLeave([]);
    setSelectedStandby([]);
    
    refreshTasks();
  };

  // ==========================================
  // SELECTION HANDLERS
  // ==========================================

  const handleToggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleToggleOnLeaveSelection = (personnelId: string) => {
    setSelectedOnLeave(prev =>
      prev.includes(personnelId) ? prev.filter(id => id !== personnelId) : [...prev, personnelId]
    );
  };

  const handleToggleStandbySelection = (personnelId: string) => {
    setSelectedStandby(prev =>
      prev.includes(personnelId) ? prev.filter(id => id !== personnelId) : [...prev, personnelId]
    );
  };

  const isOnayliIzinHelper = (personId: string, personStatus: string): boolean => {
    if (personStatus === 'on_leave') return true;
    return leaveRequests.some(
      leave =>
        leave.personnelId === personId &&
        leave.status === 'approved' &&
        new Date(selectedDate) >= new Date(leave.startDate) &&
        new Date(selectedDate) <= new Date(leave.endDate)
    );
  };

  const handleSelectAllOnLeave = () => {
    const onLeavePersonnel = getOnLeavePersonnel();
    const selectableOnLeave = onLeavePersonnel.filter(p => !isOnayliIzinHelper(p.id, p.status));
    setSelectedOnLeave(selectableOnLeave.map(p => p.id));
  };

  const handleClearOnLeaveSelection = () => {
    setSelectedOnLeave([]);
  };

  const handleSelectAllStandby = () => {
    const standbyPersonnel = getStandbyPersonnel();
    setSelectedStandby(standbyPersonnel.map(p => p.id));
  };

  const handleClearStandbySelection = () => {
    setSelectedStandby([]);
  };

  const handleClearAllSelections = () => {
    setSelectedTasks([]);
    setSelectedOnLeave([]);
    setSelectedStandby([]);
  };

  const handleRemoveOnLeave = async (personnelId: string) => {
    const updatedOnLeave = { ...dailyOnLeave };
    if (updatedOnLeave[selectedDate]) {
      updatedOnLeave[selectedDate] = updatedOnLeave[selectedDate].filter(id => id !== personnelId);
      if (updatedOnLeave[selectedDate].length === 0) {
        delete updatedOnLeave[selectedDate];
      }
    }
    setDailyOnLeave(updatedOnLeave);
    await saveDailyOnLeave(updatedOnLeave, accessToken);
  };

  // Görev modalından onaylanan günlük izinlileri listeden çıkar
  const handleTaskConfirmedDailyLeave = async (personnelIds: string[]) => {
    const updatedOnLeave = { ...dailyOnLeave };
    if (updatedOnLeave[selectedDate]) {
      updatedOnLeave[selectedDate] = updatedOnLeave[selectedDate].filter(
        id => !personnelIds.includes(id)
      );
      if (updatedOnLeave[selectedDate].length === 0) {
        delete updatedOnLeave[selectedDate];
      }
    }
    setDailyOnLeave(updatedOnLeave);
    await saveDailyOnLeave(updatedOnLeave, accessToken);
  };

  const handleMoveOnLeaveToStandby = async (personnelIds: string[]) => {
    const updatedOnLeave = { ...dailyOnLeave };

    if (updatedOnLeave[selectedDate]) {
      updatedOnLeave[selectedDate] = updatedOnLeave[selectedDate].filter(id => !personnelIds.includes(id));

      if (updatedOnLeave[selectedDate].length === 0) {
        delete updatedOnLeave[selectedDate];
      }
    }

    setDailyOnLeave(updatedOnLeave);
    await saveDailyOnLeave(updatedOnLeave, accessToken);
    setSelectedOnLeave([]);
    
    setNotificationMessage(`${personnelIds.length} personel beklemeye alındı ⏳`);
    setShowSuccessNotification(true);
    setTimeout(() => setShowSuccessNotification(false), 3000);
  };

  const handleMoveAllOnLeaveToStandby = () => {
    const onLeavePersonnel = getOnLeavePersonnel();
    const dailyOnLeaveIds = onLeavePersonnel.filter(p => !isOnayliIzinHelper(p.id, p.status)).map(p => p.id);
    
    if (dailyOnLeaveIds.length === 0) {
      setNotificationMessage('Beklemeye alınacak izinli personel yok 🤷‍♂️');
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 3000);
      return;
    }
    
    handleMoveOnLeaveToStandby(dailyOnLeaveIds);
  };

  // ==========================================
  // MOVE STANDBY TO ON-LEAVE
  // ==========================================
  
  const handleMoveStandbyToOnLeave = async (personnelIds: string[]) => {
    // ✅ İzinli yapılacak personellerin o tarihte görevi var mı kontrol et
    const tasksOnDate = tasks.filter(task => task.date === selectedDate);
    const personnelWithTasks: string[] = [];
    
    personnelIds.forEach(personnelId => {
      const hasTask = tasksOnDate.some(task => 
        task.personnel.some(p => p.id === personnelId) &&
        task.status !== 'cancelled'
      );
      
      if (hasTask) {
        const personnel = staffMembers.find(s => s.id === personnelId);
        if (personnel) {
          personnelWithTasks.push(personnel.name);
        }
      }
    });
    
    // Eğer görevli personel varsa, uyarı göster ve işlemi iptal et
    if (personnelWithTasks.length > 0) {
      setNotificationMessage(
        `❌ ${personnelWithTasks.join(', ')} personelinin bu tarihte görevi var! Önce görevden çıkarın.`
      );
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 5000);
      return;
    }
    
    const updatedOnLeave = { ...dailyOnLeave };
    if (!updatedOnLeave[selectedDate]) {
      updatedOnLeave[selectedDate] = [];
    }
    
    personnelIds.forEach(id => {
      if (!updatedOnLeave[selectedDate].includes(id)) {
        updatedOnLeave[selectedDate].push(id);
      }
    });
    
    setDailyOnLeave(updatedOnLeave);
    await saveDailyOnLeave(updatedOnLeave, accessToken);
    setSelectedStandby([]);

    setNotificationMessage('Personel izinli olarak atandı 🏖️');
    setShowSuccessNotification(true);
    setTimeout(() => setShowSuccessNotification(false), 3000);
  };

  const handleMoveAllStandbyToOnLeave = () => {
    const standbyPersonnel = getStandbyPersonnel();
    handleMoveStandbyToOnLeave(standbyPersonnel.map(p => p.id));
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const onLeavePersonnel = getOnLeavePersonnel();
  const standbyPersonnel = getStandbyPersonnel();
  const locationTasks = getLocationTasks();
  const extraSpecialTasks = getExtraSpecialTasks();

  const totalSelections = selectedTasks.length + selectedOnLeave.length + selectedStandby.length;
  const sendableTasks = todayTasks.filter(t => t.status === 'draft' || t.status === 'revised');
  const totalSendable = sendableTasks.length + onLeavePersonnel.length + standbyPersonnel.length;

  // Get status colors for location cards
  const getStatusColors = (task?: Task) => {
    if (!task) return 'bg-white/10 border-white/20';
    
    // ⚪ GRİ - Tarihi geçmiş görevler (tüm kart gri/soluk)
    const taskDate = new Date(task.date);
    const today = new Date();
    taskDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (taskDate < today) {
      return 'bg-slate-500/10 border-slate-400/30 opacity-60';
    }
    
    // DRAFT ve REVISED durumu için TURUNCU (henüz gönderilmemiş)
    if (task.status === 'draft' || task.status === 'revised') {
      return 'bg-orange-500/10 border-orange-500/30';
    }
    
    // CANCELLED durumu için KIRMIZI
    if (task.status === 'cancelled') {
      return 'bg-red-500/10 border-red-500/40';
    }
    
    // SENT durumu için taskType'a göre renk
    if (task.taskType === 'special') {
      // 🟣 MOR - Özel Görev
      return 'bg-ta/10 border-ta/30';
    } else if (task.taskType === 'extra') {
      // 🩷 PEMBE - Ekstra İş
      return 'bg-pink-500/10 border-pink-500/30';
    } else {
      // 🟢 YEŞİL - Sabit Görev
      return 'bg-green-500/10 border-green-500/30';
    }
  };

  // Get status colors for extra tasks
  const getExtraTaskStatusColors = (task: Task) => {
    // ⚪ GRİ - Tarihi geçmiş görevler (tüm kart gri/soluk)
    const taskDate = new Date(task.date);
    const today = new Date();
    taskDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (taskDate < today) {
      return 'bg-slate-500/10 border-slate-400/30 opacity-60';
    }
    
    // DRAFT ve REVISED durumu için TURUNCU (henüz gönderilmemiş)
    if (task.status === 'draft' || task.status === 'revised') {
      return 'bg-orange-500/10 border-orange-500/30';
    }
    
    // CANCELLED durumu için KIRMIZI
    if (task.status === 'cancelled') {
      return 'bg-red-500/10 border-red-500/40';
    }
    
    // SENT durumu için taskType'a göre renk
    if (task.taskType === 'special') {
      // 🟣 MOR - Özel Görev
      return 'bg-ta/10 border-ta/30';
    } else if (task.taskType === 'extra') {
      // 🩷 PEMBE - Ekstra İş
      return 'bg-pink-500/10 border-pink-500/30';
    } else {
      // 🟢 YEŞİL - Sabit Görev (fallback)
      return 'bg-green-500/10 border-green-500/30';
    }
  };

  // Get border color for assigned tab cards
  const getBorderColor = (task: Task): string => {
    // ⚪ GRİ - Tarihi geçmiş görevler (bugünden önceki görevler)
    const taskDate = new Date(task.date);
    const today = new Date();
    taskDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (taskDate < today) return 'border-l-slate-400';
    
    if (task.status === 'cancelled') return 'border-l-red-500';
    
    // DRAFT ve REVISED durumu için TURUNCU
    if (task.status === 'draft' || task.status === 'revised') return 'border-l-orange-500';
    
    // Check if personnel is on leave (sabit durum + rotation_leave_ + günlük)
    const onLeavePersonnelIds = new Set(getOnLeavePersonnel().map(p => p.id));
    const hasOnLeave = task.personnel.some(p => onLeavePersonnelIds.has(p.id));
    if (hasOnLeave) return 'border-l-rose-400';
    
    // Check if task has standby personnel
    const standbyIds = standbyPersonnel.map(p => p.id);
    const hasStandby = task.personnel.some(p => standbyIds.includes(p.id));
    if (hasStandby) return 'border-l-yellow-400';
    
    // ✅ YENİ: taskType field'ına göre renk seç
    if (task.taskType === 'special') return 'border-l-ta'; // 🟣 MOR - Özel Görev
    if (task.taskType === 'extra') return 'border-l-pink-500'; // 🩷 PEMBE - Ekstra İş
    if (task.taskType === 'regular') return 'border-l-green-500'; // 🟢 YEŞİL - Sabit Görev
    
    // Fallback (eski görevler için)
    if (task.type === 'special') return 'border-l-ta';
    return 'border-l-green-500';
  };

  // Get work history
  const personalHistory = getWorkHistory(getCurrentUserId(), historyFilter);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #120830 50%, #1a0a3c 100%))' }}>
      {/* Tab Buttons — tüm roller için, global header altında sticky */}
      <div className="sticky top-[64px] z-[4] backdrop-blur-xl border-b border-white/15 px-6 py-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
        <div className="flex gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10">
          {userRole !== 'personel' && (
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'plan'
                  ? 'bg-white/12 border border-white/20 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              📋 Görev Planla
            </button>
          )}
          <button
            onClick={() => setActiveTab('assigned')}
            className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === 'assigned'
                ? 'bg-white/12 border border-white/20 text-white shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            📨 Rotasyonlar
          </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'leaves'
                  ? 'bg-white/12 border border-white/20 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              🏖️ İzinler
            </button>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* PLAN TAB */}
        {activeTab === 'plan' && userRole !== 'personel' && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="px-6 py-6 relative z-0"
          >
            {/* Tarih Seçici */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => changeDate(-1)}
                  className="px-3 py-2 bg-white/8 hover:bg-white/15 rounded-xl border border-white/15 text-white/80 text-xs font-semibold transition-all active:scale-95"
                >
                  ◀ Dün
                </button>
                <button
                  onClick={goToToday}
                  className="flex-1 px-4 py-2 bg-white/8 hover:bg-white/14 rounded-xl text-white/80 text-xs font-bold transition-all active:scale-95 border border-white/12"
                >
                  Bugün
                </button>
                <button
                  onClick={() => changeDate(1)}
                  className="px-3 py-2 bg-white/8 hover:bg-white/15 rounded-xl border border-white/15 text-white/80 text-xs font-semibold transition-all active:scale-95"
                >
                  Yarın ▶
                </button>
              </div>

              {/* Tarih Input */}
              <div className="flex items-center gap-2 bg-white/5 rounded-xl p-3 border border-white/10">
                <Calendar className="w-5 h-5 text-ta" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm font-semibold outline-none"
                />
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Sabit Lokasyon Kartları */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  📍 Sabit Mekanlar
                </h2>
              </div>

              <div className="space-y-3">
                {locations.map((location) => {
                  const locationTask = todayTasks.find(t => t.location === location.name && t.type === 'regular');
                  
                  return (
                    <motion.div
                      key={location.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`backdrop-blur-xl rounded-2xl border-2 overflow-visible relative ${getStatusColors(locationTask)}`}
                    >
                      {/* REVİZE BADGE - SAĞ ÜST */}
                      {locationTask && (locationTask.status === 'sent' || locationTask.status === 'revised' || locationTask.status === 'cancelled') && locationTask.revisionCount && locationTask.revisionCount > 0 && (
                        <div className="absolute -top-3 -right-3 flex flex-col items-center gap-1.5 z-10">
                          <div className="flex flex-col items-center justify-center px-4 py-2.5 bg-amber-600/90 border-2 border-amber-500 rounded-3xl shadow-lg min-w-[64px]">
                            <span className="text-xs text-white font-medium leading-tight">Revize</span>
                            <span className="text-xl text-white font-bold leading-tight">{locationTask.revisionCount}x</span>
                          </div>
                          {locationTask.revisedAt && (
                            <span className="text-[9px] text-white/70 font-medium">{getTimeAgo(locationTask.revisedAt)}</span>
                          )}
                        </div>
                      )}
                      
                      <div className="p-4">
                        {/* SATIR 1: Checkbox + Icon + Name + Time + Status */}
                        <div className="flex items-center gap-2 mb-3">
                          {locationTask && (locationTask.status === 'draft' || locationTask.status === 'revised') && (
                            <button
                              onClick={() => handleToggleTaskSelection(locationTask.id)}
                              className="flex-shrink-0"
                            >
                              {selectedTasks.includes(locationTask.id) ? (
                                <CheckSquare className="w-5 h-5 text-[#a8e6cf]" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                          )}
                          
                          <span className="text-xl">{location.icon}</span>
                          <span className="font-bold text-white text-sm">{location.name}</span>
                          
                          {locationTask && (
                            <>
                              <span className="text-gray-400 text-xs mx-1">•</span>
                              <span className="text-sm">🕐</span>
                              <span className="text-green-400 text-xs font-semibold">
                                {locationTask.startTime}-{locationTask.endTime}
                              </span>
                              
                              {locationTask.status === 'sent' && (
                                <span className="px-2 py-0.5 bg-green-500/30 text-green-200 text-[10px] font-bold rounded">
                                  ✅ GÖNDERİLDİ
                                </span>
                              )}
                              {locationTask.status === 'cancelled' && (
                                <span className="px-2 py-0.5 bg-red-500/30 text-red-200 text-[10px] font-bold rounded">
                                  ❌ İPTAL
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* SATIR 2: Task Type + Sent Time */}
                        {locationTask && (
                          <div className="flex items-center gap-1.5 ml-7 mb-2">
                            <span className="text-xs">📌</span>
                            <span className="text-gray-300 text-xs">Düzenli İş</span>
                            {editingTask?.id === locationTask.id ? (
                              <>
                                <span className="text-gray-400 text-xs mx-1">|</span>
                                <span className="text-amber-300 text-xs font-semibold animate-pulse">
                                  ✏️ Düzenleniyor...
                                </span>
                              </>
                            ) : (locationTask.status === 'sent' || locationTask.status === 'revised' || locationTask.status === 'cancelled') && (
                              <>
                                <span className="text-gray-400 text-xs mx-1">|</span>
                                <span className="text-gray-300 text-xs">
                                  Gönderim Saati: {locationTask.status === 'sent' ? locationTask.sentAt : locationTask.status === 'revised' ? locationTask.revisedAt : locationTask.cancelledAt}
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {/* PERSONEL KUTUSU */}
                        {locationTask && (
                          <>
                            <div className="bg-white/10 rounded-xl p-2.5 mb-3">
                              <div className="text-xs font-semibold text-gray-400 mb-2">
                                👥 Personel ({locationTask.personnel.length}):
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {locationTask.personnel.map((person) => {
                                  const staff = staffMembers.find(s => s.id === person.id);
                                  const gorevIcon = locationTask.personnel.length > 1 ? getGorevIcon(person.gorev) : '';
                                  return (
                                    <div key={person.id} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white">
                                      <span>{person.avatar}</span>
                                      <span className="font-medium">{person.name}</span>
                                      {gorevIcon && <span title={person.gorev}>{gorevIcon}</span>}
                                      {(() => {
                                        if (!staff) return null;
                                        const isOnLeave =
                                          staff.status === 'on_leave' ||
                                          (dailyOnLeave[selectedDate] || []).includes(staff.id) ||
                                          leaveRequests.some(
                                            leave =>
                                              leave.personnelId === staff.id &&
                                              leave.status === 'approved' &&
                                              new Date(selectedDate) >= new Date(leave.startDate) &&
                                              new Date(selectedDate) <= new Date(leave.endDate)
                                          );
                                        return isOnLeave ? (
                                          <span className="text-[9px] bg-orange-500/30 text-orange-200 px-1 py-0.5 rounded font-bold">İZİN</span>
                                        ) : null;
                                      })()}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {locationTask.notes && (
                              <div className="text-xs text-gray-300 bg-white/10 rounded-lg px-3 py-2 mb-3">
                                📝 {locationTask.notes}
                              </div>
                            )}
                            
                            {locationTask.status === 'cancelled' && locationTask.cancelReason && (
                              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
                                ❌ İptal Sebebi: {locationTask.cancelReason}
                              </div>
                            )}
                          </>
                        )}

                        {/* BUTONLAR */}
                        <div className="flex items-center gap-2">
                          {locationTask ? (
                            <>
                              {(locationTask.status === 'draft' || locationTask.status === 'revised') && (
                                <>
                                  <button
                                    onClick={() => handleEditTask(locationTask)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded-lg text-blue-300 text-xs font-semibold transition-all active:scale-95"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Düzenle
                                  </button>
                                  <button
                                    onClick={() => handleRemoveTask(locationTask.id)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 text-xs font-semibold transition-all active:scale-95"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Sil
                                  </button>
                                  {locationTask.status === 'draft' && (
                                    <button
                                      onClick={() => {
                                        if (!selectedTasks.includes(locationTask.id)) {
                                          // Seçili değilse → Sadece seç
                                          setSelectedTasks([...selectedTasks, locationTask.id]);
                                        } else {
                                          // Zaten seçiliyse → Tümünü gönder
                                          handleSendTasks(false);
                                        }
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-300 text-xs font-semibold transition-all active:scale-95"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      Gönder
                                    </button>
                                  )}
                                  {locationTask.status === 'revised' && (
                                    <button
                                      onClick={() => {
                                        if (!selectedTasks.includes(locationTask.id)) {
                                          // Seçili değilse → Sadece seç
                                          setSelectedTasks([...selectedTasks, locationTask.id]);
                                        } else {
                                          // Zaten seçiliyse → Tümünü gönder
                                          handleSendTasks(false);
                                        }
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-300 text-xs font-semibold transition-all active:scale-95"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      Gönder
                                    </button>
                                  )}
                                </>
                              )}
                              
                              {locationTask.status === 'sent' && (
                                <>
                                  <button
                                    onClick={() => handleEditTask(locationTask)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded-lg text-blue-300 text-xs font-semibold transition-all active:scale-95"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Düzenle
                                  </button>
                                  <button
                                    onClick={() => handleOpenCancelModal(locationTask)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 text-xs font-semibold transition-all active:scale-95"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    İptal
                                  </button>
                                </>
                              )}
                              
                              {locationTask.status === 'cancelled' && (
                                <>
                                  <button
                                    onClick={() => handleReactivateTask(locationTask)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-300 text-xs font-semibold transition-all active:scale-95"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Reaktive Et
                                  </button>
                                  <button
                                    onClick={() => handleRemoveTask(locationTask.id)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 text-xs font-semibold transition-all active:scale-95"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Sil
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenTaskModal('regular_location', undefined, location.name)}
                              className="flex-1 flex items-center justify-center gap-2 bg-white/8 border border-white/15 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-white/14 transition-all active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                              Görev Oluştur
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Gönder Butonları */}
            {sendableTasks.length > 0 && (
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => {
                    if (selectedTasks.length === sendableTasks.length) {
                      setSelectedTasks([]);
                    } else {
                      setSelectedTasks(sendableTasks.map(t => t.id));
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white/80 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                >
                  {selectedTasks.length === sendableTasks.length ? (
                    <>
                      <Square className="w-4 h-4" />
                      Seçimi Temizle
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      Tümünü Seç ({sendableTasks.length})
                    </>
                  )}
                </button>
                
                <div className="space-y-2">
                  {totalSelections > 0 && (
                    <button
                      onClick={handleClearAllSelections}
                      className="w-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white/80 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                    >
                      <Square className="w-4 h-4" />
                      Seçimi Temizle
                    </button>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSendTasks(false)}
                      disabled={totalSelections === 0}
                      className="flex-1 flex items-center justify-center gap-2 bg-white/8 border border-white/15 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-white/14 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Seçili ({totalSelections})
                    </button>
                    
                    <button
                      onClick={() => handleSendTasks(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-4 py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                      Tümü ({totalSendable})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ekstra & Özel Görevler */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  ⚡ Ekstra & Özel Görevler
                </h2>
              </div>
              
              {extraSpecialTasks.length > 0 && (
                <div className="space-y-3 mb-3">
                  {extraSpecialTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`backdrop-blur-xl rounded-2xl border-2 overflow-visible relative ${getExtraTaskStatusColors(task)}`}
                    >
                      {/* REVİZE BADGE */}
                      {(task.status === 'sent' || task.status === 'revised' || task.status === 'cancelled') && task.revisionCount && task.revisionCount > 0 && (
                        <div className="absolute -top-3 -right-3 flex flex-col items-center gap-1.5 z-10">
                          <div className="flex flex-col items-center justify-center px-4 py-2.5 bg-amber-600/90 border-2 border-amber-500 rounded-3xl shadow-lg min-w-[64px]">
                            <span className="text-xs text-white font-medium leading-tight">Revize</span>
                            <span className="text-xl text-white font-bold leading-tight">{task.revisionCount}x</span>
                          </div>
                          {task.revisedAt && (
                            <span className="text-[9px] text-white/70 font-medium">{getTimeAgo(task.revisedAt)}</span>
                          )}
                        </div>
                      )}
                      
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          {(task.status === 'draft' || task.status === 'revised') && (
                            <button
                              onClick={() => handleToggleTaskSelection(task.id)}
                              className="flex-shrink-0"
                            >
                              {selectedTasks.includes(task.id) ? (
                                <CheckSquare className="w-5 h-5 text-[#a8e6cf]" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                          )}
                          
                          <span className="text-xl">{task.locationIcon}</span>
                          <span className="font-bold text-white text-sm">{task.location}</span>
                          <span className="text-gray-400 text-xs mx-1">•</span>
                          <span className="text-sm">🕐</span>
                          <span className="text-green-400 text-xs font-semibold">
                            {task.startTime}-{task.endTime}
                          </span>
                          
                          {task.status === 'sent' && (
                            <span className="px-2 py-0.5 bg-green-500/30 text-green-200 text-[10px] font-bold rounded">
                              ✅ GÖNDERİLDİ
                            </span>
                          )}
                          {task.status === 'cancelled' && (
                            <span className="px-2 py-0.5 bg-red-500/30 text-red-200 text-[10px] font-bold rounded">
                              ❌ İPTAL
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5 ml-7 mb-2">
                          <span className="text-xs">{task.taskType === 'special' ? '⭐' : task.taskType === 'extra' ? '📍' : '📌'}</span>
                          <span className="text-gray-300 text-xs">{task.taskType === 'special' ? 'Özel Görev' : task.taskType === 'extra' ? 'Ekstra İş' : 'Sabit Görev'}</span>
                          {editingTask?.id === task.id ? (
                            <>
                              <span className="text-gray-400 text-xs mx-1">|</span>
                              <span className="text-amber-300 text-xs font-semibold animate-pulse">
                                ✏️ Düzenleniyor...
                              </span>
                            </>
                          ) : (task.status === 'sent' || task.status === 'revised' || task.status === 'cancelled') && (
                            <>
                              <span className="text-gray-400 text-xs mx-1">|</span>
                              <span className="text-gray-300 text-xs">
                                Gönderim Saati: {task.status === 'sent' ? task.sentAt : task.status === 'revised' ? task.revisedAt : task.cancelledAt}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="bg-white/10 rounded-xl p-2.5 mb-3">
                          <div className="text-xs font-semibold text-gray-400 mb-2">
                            👥 Personel ({task.personnel.length}):
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {task.personnel.map((person) => {
                              const gi = task.personnel.length > 1 ? getGorevIcon(person.gorev) : '';
                              return (
                                <div key={person.id} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white">
                                  <span>{person.avatar}</span>
                                  <span className="font-medium">{person.name}</span>
                                  {gi && <span title={person.gorev}>{gi}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {task.notes && (
                          <div className="text-xs text-gray-300 bg-white/10 rounded-lg px-3 py-2 mb-3">
                            📝 {task.notes}
                          </div>
                        )}
                        
                        {task.status === 'cancelled' && task.cancelReason && (
                          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
                            ❌ İptal Sebebi: {task.cancelReason}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {(task.status === 'draft' || task.status === 'revised') && (
                            <>
                              <button
                                onClick={() => handleEditTask(task)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded-lg text-blue-300 text-xs font-semibold transition-all active:scale-95"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Düzenle
                              </button>
                              <button
                                onClick={() => handleRemoveTask(task.id)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 text-xs font-semibold transition-all active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Sil
                              </button>
                              <button
                                onClick={() => {
                                  if (!selectedTasks.includes(task.id)) {
                                    // Seçili değilse → Sadece seç
                                    setSelectedTasks([...selectedTasks, task.id]);
                                  } else {
                                    // Zaten seçiliyse → Tümünü gönder
                                    handleSendTasks(false);
                                  }
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-300 text-xs font-semibold transition-all active:scale-95"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Gönder
                              </button>
                            </>
                          )}
                          
                          {task.status === 'sent' && (
                            <>
                              <button
                                onClick={() => handleEditTask(task)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded-lg text-blue-300 text-xs font-semibold transition-all active:scale-95"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Düzenle
                              </button>
                              <button
                                onClick={() => handleOpenCancelModal(task)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 text-xs font-semibold transition-all active:scale-95"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                İptal
                              </button>
                            </>
                          )}
                          
                          {task.status === 'cancelled' && (
                            <>
                              <button
                                onClick={() => handleReactivateTask(task)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-300 text-xs font-semibold transition-all active:scale-95"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Reaktive Et
                              </button>
                              <button
                                onClick={() => handleRemoveTask(task.id)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-300 text-xs font-semibold transition-all active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              
              <button
                onClick={() => handleOpenTaskModal('extra_special')}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-pink-500/80 to-fuchsia-600/80 hover:from-pink-500 hover:to-fuchsia-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Ekstra Görev Ekle
              </button>
            </div>

            {/* İzinli Personel */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  🏖️ İzinli Personel ({onLeavePersonnel.length})
                </h2>
              </div>

              <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-4 min-h-[80px]">
                {/* BUTONLAR - ALT ALTA */}
                <div className="flex flex-col gap-2 mb-4">
                  <button
                    onClick={() => {
                      if (selectedOnLeave.length > 0) {
                        handleMoveOnLeaveToStandby(selectedOnLeave);
                      }
                    }}
                    disabled={selectedOnLeave.length === 0}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-xs transition-all active:scale-95 ${
                      selectedOnLeave.length > 0
                        ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
                        : 'bg-white/4 border border-white/8 text-white/25 cursor-not-allowed'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Seçili Personelleri Beklemeye Al</span>
                  </button>


                </div>

                {/* PERSONEL LİSTESİ */}
                {onLeavePersonnel.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-gray-400">
                        👥 Bugün izinli olanlar:
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const selectableOnLeave = onLeavePersonnel.filter(p => !isOnayliIzinHelper(p.id, p.status));
                            if (selectedOnLeave.length === selectableOnLeave.length) {
                              setSelectedOnLeave([]);
                            } else {
                              setSelectedOnLeave(selectableOnLeave.map(p => p.id));
                            }
                          }}
                          className="text-xs text-white/50 hover:text-white/80 transition-all whitespace-nowrap px-2 py-1 rounded bg-white/6 hover:bg-white/12 border border-white/12"
                        >
                          {selectedOnLeave.length === onLeavePersonnel.filter(p => !isOnayliIzinHelper(p.id, p.status)).length ? 'Temizle' : 'Tümünü Seç'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {onLeavePersonnel.map((person) => {
                        const isOnayliIzin = isOnayliIzinHelper(person.id, person.status);
                        const isDailyLeave = !isOnayliIzin && (dailyOnLeave[selectedDate] || []).includes(person.id);
                        
                        return (
                          <div key={person.id} className="relative">
                            {isOnayliIzin ? (
                              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-gray-300">
                                <span>{person.avatar}</span>
                                <span>{person.name}</span>
                                <span className="text-[9px] bg-green-700 text-white px-1 py-0.5 rounded font-bold">ONAYLANMIŞ</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleToggleOnLeaveSelection(person.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                  selectedOnLeave.includes(person.id)
                                    ? 'bg-orange-500/30 border-2 border-orange-400 text-white'
                                    : 'bg-white/10 border border-white/20 text-gray-300'
                                }`}
                              >
                                {selectedOnLeave.includes(person.id) ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                                <span>{person.avatar}</span>
                                <span>{person.name}</span>
                                {isDailyLeave && (
                                  <span className="text-[9px] bg-red-600 text-white px-1 py-0.5 rounded font-bold">GÜNLÜK</span>
                                )}
                              </button>
                            )}
                            
                            {isDailyLeave && (
                              <button
                                onClick={() => handleRemoveOnLeave(person.id)}
                                className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-lg"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-4">
                    Bugün izinli personel yok
                  </div>
                )}
              </div>
            </div>

            {/* Beklemede Personel */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  ⏳ Beklemede ({standbyPersonnel.length})
                </h2>
              </div>

              <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-4 min-h-[80px]">
                {/* BUTONLAR - EN ÜSTTE YAN YANA */}
                <div className="flex flex-col gap-2 mb-4">
                  <button
                    onClick={() => {
                      if (selectedStandby.length > 0) {
                        handleMoveStandbyToOnLeave(selectedStandby);
                      }
                    }}
                    disabled={selectedStandby.length === 0}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-xs transition-all active:scale-95 ${
                      selectedStandby.length > 0
                        ? 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
                        : 'bg-white/4 border border-white/8 text-white/25 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Seçili Personelleri İzinli Ata</span>
                  </button>


                </div>

                {/* PERSONEL LİSTESİ */}
                {standbyPersonnel.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-2 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-white/40">
                          👥 Göreve atanmamış personel:
                        </div>
                        <button
                          onClick={() => {
                            if (selectedStandby.length === standbyPersonnel.length) {
                              setSelectedStandby([]);
                            } else {
                              setSelectedStandby(standbyPersonnel.map(p => p.id));
                            }
                          }}
                          className="text-xs text-white/50 hover:text-white/80 transition-all whitespace-nowrap px-2 py-1 rounded bg-white/6 hover:bg-white/12 border border-white/12"
                        >
                          {selectedStandby.length === standbyPersonnel.length ? 'Temizle' : 'Tümünü Seç'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {standbyPersonnel.map((person) => (
                          <button
                            key={person.id}
                            onClick={() => handleToggleStandbySelection(person.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              selectedStandby.includes(person.id)
                                ? 'bg-amber-500/20 border border-amber-400/50 text-amber-200'
                                : 'bg-white/6 border border-white/12 text-white/60 hover:border-white/20'
                            }`}
                          >
                            {selectedStandby.includes(person.id) ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                            <span>{person.avatar}</span>
                            <span>{person.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-4">
                    Beklemedeki personel yok
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ASSIGNED TAB */}
        {activeTab === 'assigned' && (
          <motion.div
            key="assigned"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="px-6 py-6 relative z-0 overflow-visible"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">
                📨 Gönderilen Rotasyonlar
              </h2>
            </div>

            {/* Aktif rotasyonlar üstte — İzinli+Beklemede sonra — Geçmiş Rotasyonlar en altta */}
            {(() => {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              yesterday.setHours(0, 0, 0, 0);

              const isTaskPast = (task: Task): boolean => {
                // Sadece TARİH karşılaştırması kullan.
                // Saat karşılaştırması kaldırıldı: bugün oluşturulan/gönderilen rotasyonlar
                // endTime geçmiş olsa bile "Aktif Rotasyonlar" bölümünde kalır.
                // Bir görev yalnızca tarihi bugünden önceyse "Geçmiş Rotasyon" sayılır.
                const td = new Date(task.date); td.setHours(0,0,0,0);
                const tod = new Date(); tod.setHours(0,0,0,0);
                return td < tod;
              };

              const allSent = tasks.filter(t =>
                (t.status === 'sent' || t.status === 'revised' || t.status === 'cancelled') &&
                (() => { const d = new Date(t.date); d.setHours(0,0,0,0); return d >= yesterday; })()
              );

              const activeTasks = allSent
                .filter(t => !isTaskPast(t))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, visibleTaskCount);

              const pastTasks = allSent
                .filter(t => isTaskPast(t))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              const todayOnLeave = getOnLeavePersonnel();
              const todayStandby = getStandbyPersonnel();

              const renderTaskCard = (task: Task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`backdrop-blur-xl rounded-2xl border-2 overflow-visible border-l-4 relative ${getStatusColors(task)} ${getBorderColor(task)}`}
                >
                  <div className="absolute -top-3 -left-3 z-20">
                    <div className="flex items-center justify-center px-3 py-1.5 bg-[rgba(0,0,0,0.85)] border border-white/15 rounded-xl backdrop-blur-sm">
                      <span className="text-[10px] text-white/80 font-bold">
                        {new Date(task.date).getDate()} {new Date(task.date).toLocaleDateString('tr-TR', { month: 'long' })} {new Date(task.date).toLocaleDateString('tr-TR', { weekday: 'long' })}
                      </span>
                    </div>
                  </div>
                  <div className="absolute right-4 top-4 pointer-events-none z-0">
                    {task.taskType === 'regular' && <Repeat className="w-20 h-20 text-green-500/10" />}
                    {task.taskType === 'extra' && <Zap className="w-20 h-20 text-pink-500/10" />}
                    {task.taskType === 'special' && <Star className="w-20 h-20 text-ta/10" />}
                  </div>
                  {task.revisionCount && task.revisionCount > 0 && (
                    <div className="absolute -top-3 -right-3 flex flex-col items-center gap-1.5 z-10">
                      <div className="flex flex-col items-center justify-center px-4 py-2.5 bg-amber-600/90 border-2 border-amber-500 rounded-3xl shadow-lg min-w-[64px]">
                        <span className="text-xs text-white font-medium leading-tight">Revize</span>
                        <span className="text-xl text-white font-bold leading-tight">{task.revisionCount}x</span>
                      </div>
                      {task.revisedAt && (
                        <span className="text-[9px] text-white/70 font-medium">{getTimeAgo(task.revisedAt)}</span>
                      )}
                    </div>
                  )}
                  <div className="p-4 pt-3 relative z-10">
                    <div className="flex items-start gap-3">
                      {task.status === 'sent' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />}
                      {task.status === 'revised' && <RefreshCw className="w-5 h-5 text-orange-400 flex-shrink-0 mt-1" />}
                      {task.status === 'cancelled' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <span className="text-base">{getTimePeriodIcon(task.startTime)}</span>
                          <span className="text-gray-600 mx-1">|</span>
                          <span className="text-base">{task.locationIcon}</span>
                          <span className="font-bold text-white">{task.location}</span>
                          <span className="text-gray-400 mx-1">•</span>
                          <span className="text-base">🕐</span>
                          <span className="text-green-400 font-semibold">{task.startTime}-{task.endTime}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs ml-8 mb-2">
                          <span>{task.taskType === 'special' ? '⭐' : task.taskType === 'extra' ? '📍' : '📌'}</span>
                          <span className="text-gray-300">{task.taskType === 'special' ? 'Özel Görev' : task.taskType === 'extra' ? 'Ekstra İş' : 'Sabit Görev'}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-gray-300">
                            Gönderim: {task.status === 'sent' ? task.sentAt : task.status === 'revised' ? task.revisedAt : task.cancelledAt}
                          </span>
                        </div>
                        {userRole === 'personel' && task.personnel.length > 1 && (() => {
                          const myEntry = task.personnel.find(p => p.id === currentUserId);
                          const myGorevIcon = myEntry?.gorev ? getGorevIcon(myEntry.gorev) : '';
                          if (!myGorevIcon) return null;
                          const gorevLabels: Record<string, string> = { 'fotograf-satis': 'Fotoğraf / Satış', 'baski': 'Baskı', 'album': 'Albüm' };
                          return (
                            <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl"
                              style={{ background: 'rgba(157,217,234,0.12)', border: '1px solid rgba(157,217,234,0.3)' }}>
                              <span className="text-base">{myGorevIcon}</span>
                              <span className="text-xs font-bold" style={{ color: '#9dd9ea' }}>
                                Bugünkü görevin: {gorevLabels[myEntry!.gorev!] || myEntry!.gorev}
                              </span>
                            </div>
                          );
                        })()}
                        <div className="bg-white/10 rounded-xl p-2.5 mb-3">
                          <div className="text-xs font-semibold text-gray-400 mb-2">👥 Personel ({task.personnel.length}):</div>
                          <div className="flex flex-wrap gap-1.5">
                            {task.personnel.map((person) => {
                              const gi = task.personnel.length > 1 ? getGorevIcon(person.gorev) : '';
                              return (
                                <div key={person.id} className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 text-xs text-white">
                                  <span>{person.avatar}</span>
                                  <span className="flex-1 truncate">{person.name}</span>
                                  {gi && <span title={person.gorev}>{gi}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {task.notes && (
                          <div className="text-xs mt-2 bg-white/10 rounded-lg px-2 py-1 text-gray-300">
                            📝 {task.notes}
                          </div>
                        )}
                        {task.status === 'cancelled' && task.cancelReason && (
                          <div className="text-xs mt-2 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 text-red-300">
                            ❌ İptal Sebebi: {task.cancelReason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );

              return (
                <>
                  {/* ── AKTİF ROTASYONLAR ── */}
                  <div className="space-y-4 overflow-visible mb-4">
                    {activeTasks.map(task => renderTaskCard(task))}
                  </div>

                  {activeTasks.length === 0 && pastTasks.length === 0 && (
                    <div className="text-center py-12 text-white/30 text-sm">
                      Henüz gönderilen rotasyon yok
                    </div>
                  )}

                  {/* ── İZİNLİ PERSONEL KARTI ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="backdrop-blur-xl rounded-2xl border-2 overflow-visible border-l-4 border-l-cyan-400 relative bg-cyan-500/10 border-cyan-500/40 mb-4"
                  >
                    <div className="absolute right-4 top-4 pointer-events-none z-0">
                      <CalendarX className="w-24 h-24 text-cyan-400/10" />
                    </div>
                    <div className="p-4 relative z-10">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-xs mb-2">
                            <span className="text-base">🏖️</span>
                            <span className="font-bold text-white">Bugün İzinli Personel</span>
                            <span className="px-2 py-0.5 bg-orange-500/30 text-orange-200 text-[10px] font-bold rounded ml-1">Dinamik</span>
                          </div>
                          <div className="bg-white/10 rounded-xl p-2.5">
                            <div className="text-xs font-semibold text-gray-400 mb-2">👥 Personel ({todayOnLeave.length}):</div>
                            {todayOnLeave.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {todayOnLeave.map((person) => (
                                  <div key={person.id} className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 text-xs text-white">
                                    <span>{person.avatar}</span>
                                    <span>{person.name}</span>
                                    {person.status === 'on_leave' && (
                                      <span className="text-[9px] bg-orange-500/30 text-orange-200 px-1 py-0.5 rounded font-bold">İZİN</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 text-center py-2">Bugün izinli personel yok</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* ── BEKLEMEDE PERSONEL KARTI ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="backdrop-blur-xl rounded-2xl border-2 overflow-visible border-l-4 border-l-yellow-400 relative bg-yellow-500/10 border-yellow-500/40 mb-6"
                  >
                    <div className="absolute right-4 top-4 pointer-events-none z-0">
                      <Clock className="w-24 h-24 text-yellow-400/10" />
                    </div>
                    <div className="p-4 relative z-10">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-xs mb-2">
                            <span className="text-base">⏳</span>
                            <span className="font-bold text-white">Rotasyona Atanabilirsiniz — Haber Bekleyin</span>
                            <span className="px-2 py-0.5 bg-yellow-500/30 text-yellow-200 text-[10px] font-bold rounded ml-1">Dinamik</span>
                          </div>
                          <div className="bg-white/10 rounded-xl p-2.5">
                            <div className="text-xs font-semibold text-gray-400 mb-2">👥 Personel ({todayStandby.length}):</div>
                            {todayStandby.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {todayStandby.map((person) => (
                                  <div key={person.id} className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 text-xs text-white">
                                    <span>{person.avatar}</span>
                                    <span>{person.name}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 text-center py-2">Beklemedeki personel yok</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* ── GEÇMİŞ ROTASYONLAR ── */}
                  {pastTasks.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 my-2 mb-5">
                        <div className="h-px flex-1 bg-white/6" />
                        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/6">
                          <FileText className="w-4 h-4 text-white/20 flex-shrink-0" />
                          <span className="text-sm font-black tracking-[0.2em] text-white/20 uppercase">
                            Geçmiş Rotasyonlar
                          </span>
                          <span className="text-[11px] font-bold text-white/15 bg-white/5 px-2 py-0.5 rounded-full">
                            {pastTasks.length}
                          </span>
                        </div>
                        <div className="h-px flex-1 bg-white/6" />
                      </div>

                      <div className="space-y-4 overflow-visible">
                        {pastTasks.map(task => renderTaskCard(task))}
                      </div>
                    </>
                  )}

                  {/* Daha Fazla Göster */}
                  {allSent.filter(t => !isTaskPast(t)).length > visibleTaskCount && (
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={() => setVisibleTaskCount(prev => prev + 10)}
                        className="flex items-center gap-2 bg-white/8 border border-white/15 text-white/80 px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/14 transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        Daha Fazla +10
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </motion.div>
        )}

        {/* LEAVES TAB */}
        {activeTab === 'leaves' && (
          <motion.div
            key="leaves"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="px-6 py-6 relative z-0"
          >
            {/* ── İZİN TALEPLERI HEADER ── */}
            <div className="mb-5">
              {/* Başlık + Sayaç */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">🏖️</span>
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white leading-tight">İzin Talepleri</h2>
                    <p className="text-[11px] text-white/35 leading-tight">Vardiya izin yönetimi</p>
                  </div>
                </div>
                <div className="flex items-center justify-center min-w-[36px] h-9 px-3 rounded-xl bg-white/6 border border-white/10">
                  <span className="text-sm font-black text-white/70">{leaveRequests.length}</span>
                </div>
              </div>

              {/* Aksiyon Butonları */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPersonalHistory(!showPersonalHistory)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                    showPersonalHistory
                      ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200'
                      : 'bg-white/6 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Geçmişim
                </button>
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs bg-white/6 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  İzin Ekle
                </button>
              </div>
            </div>

            {/* Geçmiş Accordion */}
            <AnimatePresence>
              {showPersonalHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="backdrop-blur-xl bg-white/10 rounded-2xl border-2 border-white/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        📅 Çalışma Geçmişim
                        <span className="text-xs bg-white/20 px-2 py-1 rounded-lg">
                          {personalHistory.length} kayıt
                        </span>
                      </h3>
                      
                      {/* Filtre Butonları */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setHistoryFilter('week')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                            historyFilter === 'week'
                              ? 'bg-white/12 border border-white/18 text-white'
                              : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                          }`}
                        >
                          Bu Hafta
                        </button>
                        <button
                          onClick={() => setHistoryFilter('month')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                            historyFilter === 'month'
                              ? 'bg-white/12 border border-white/18 text-white'
                              : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                          }`}
                        >
                          Bu Ay
                        </button>
                        <button
                          onClick={() => setHistoryFilter('2months')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                            historyFilter === '2months'
                              ? 'bg-white/12 border border-white/18 text-white'
                              : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                          }`}
                        >
                          Son 2 Ay
                        </button>
                      </div>
                    </div>
                    
                    {/* Geçmiş Listesi */}
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {personalHistory.map((record, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center justify-between p-2 rounded-lg transition-all ${
                            record.type === 'work' 
                              ? 'bg-blue-500/10 hover:bg-blue-500/20' 
                              : 'bg-orange-500/10 hover:bg-orange-500/20'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="text-xs text-gray-400 font-mono w-20">
                              {new Date(record.date).getDate()} {new Date(record.date).toLocaleDateString('tr-TR', { month: 'long' })}
                            </div>
                            
                            {record.type === 'work' ? (
                              <>
                                <div className="text-base">{record.icon}</div>
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-white">{record.location}</div>
                                </div>
                                <div className="text-xs text-gray-400 font-mono">
                                  {record.time}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-base">🏖️</div>
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-white">{record.leaveType}</div>
                                </div>
                                <div className="text-xs text-orange-400 font-semibold">
                                  İzin
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* İzin Talepleri */}
            <div className="space-y-3">
              {leaveRequests
                // Personel rolü: Sadece kendi taleplerini görür
                .filter(request => {
                  if (userRole === 'personel') {
                    return request.personnelId === getCurrentUserId();
                  }
                  // Diğer roller: Tüm talepleri görür
                  return true;
                })
                .map((request) => {
                // İzin tipi Türkçeleştirme
                const leaveTypeLabels = {
                  annual: '🏖️ Yıllık İzin',
                  sick: '🤒 Hastalık İzni',
                  personal: '🎯 Özel İzin'
                };

                // Get personnel role from staffMembers
                const personnel = staffMembers.find(s => s.id === request.personnelId);
                const targetRole = personnel?.role || 'personel';

                // Permission checks
                const canEdit = canEditLeaveRequest(userRole, targetRole);
                const canApproveReject = canApproveRejectLeave(userRole, targetRole, request.days);

                return (
                  <div 
                    key={request.id} 
                    className={`group relative backdrop-blur-xl rounded-2xl border-2 overflow-hidden transition-all ${
                      request.status === 'pending'
                        ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/20'
                        : request.status === 'approved'
                          ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/20'
                          : 'bg-gradient-to-br from-red-500/10 to-rose-500/10 border-red-500/30 hover:border-red-400/50 hover:shadow-lg hover:shadow-red-500/20'
                    }`}
                  >
                    {/* Status Indicator */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${
                      request.status === 'pending'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                        : request.status === 'approved'
                          ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                          : 'bg-gradient-to-r from-red-400 to-rose-400'
                    }`}></div>
                    
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            request.status === 'pending'
                              ? 'bg-gradient-to-br from-amber-400/20 to-orange-400/20 border-amber-400/30'
                              : request.status === 'approved'
                                ? 'bg-gradient-to-br from-green-400/20 to-emerald-400/20 border-green-400/30'
                                : 'bg-gradient-to-br from-red-400/20 to-rose-400/20 border-red-400/30'
                          }`}>
                            <span className="text-2xl">{request.personnelAvatar}</span>
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{request.personnelName}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              <span className={
                                request.status === 'pending' ? 'text-amber-400' :
                                request.status === 'approved' ? 'text-green-400' : 'text-red-400'
                              }>
                                {leaveTypeLabels[request.type].split(' ')[0]}
                              </span>
                              <span>{leaveTypeLabels[request.type].split(' ').slice(1).join(' ')}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`text-lg font-black ${
                            request.status === 'pending' ? 'text-amber-300' :
                            request.status === 'approved' ? 'text-green-300' : 'text-red-300'
                          }`}>{request.days}</div>
                          <div className="text-[10px] text-gray-500 -mt-0.5">GÜN</div>
                        </div>
                      </div>

                      {/* Date Range */}
                      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex-1 text-center">
                          <div className="text-[10px] text-gray-500 uppercase mb-0.5">Başlangıç</div>
                          <div className="text-xs font-bold text-white">{request.startDate}</div>
                        </div>
                        <div className="text-gray-600">→</div>
                        <div className="flex-1 text-center">
                          <div className="text-[10px] text-gray-500 uppercase mb-0.5">Bitiş</div>
                          <div className="text-xs font-bold text-white">{request.endDate}</div>
                        </div>
                      </div>

                      {/* Notes */}
                      {request.notes && (
                        <div className="text-xs text-gray-300 bg-white/5 rounded-lg px-3 py-2 mb-3 border border-white/5">
                          💬 {request.notes}
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className="flex items-center justify-center mb-3">
                        {request.status === 'approved' && (
                          <span className="px-3 py-1.5 bg-green-500/30 text-green-200 text-xs font-bold rounded-lg border border-green-500/40">
                            ✅ Onaylandı
                          </span>
                        )}
                        {request.status === 'pending' && (
                          <span className="px-3 py-1.5 bg-amber-500/30 text-amber-200 text-xs font-bold rounded-lg border border-amber-500/40">
                            ⏳ Beklemede
                          </span>
                        )}
                        {request.status === 'rejected' && (
                          <span className="px-3 py-1.5 bg-red-500/30 text-red-200 text-xs font-bold rounded-lg border border-red-500/40">
                            ❌ Reddedildi
                          </span>
                        )}
                      </div>

                      {/* Düzenle + Onay/Red Butonları - Pending için */}
                      {request.status === 'pending' && (canEdit || canApproveReject) && (
                        <div className="space-y-2">
                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingLeaveRequest(request);
                                setShowLeaveModal(true);
                              }}
                              className="w-full py-2.5 bg-blue-500/20 border border-blue-500/40 text-blue-200 rounded-xl font-bold text-xs hover:bg-blue-500/30 transition-all active:scale-95 group-hover:shadow-md"
                            >
                              🔄 Düzenle
                            </button>
                          )}
                          {canApproveReject && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={async () => {
                                  await updateLeaveStatus(request.id, 'rejected', accessToken);
                                  refreshLeaveRequests();
                                }}
                                className="flex items-center justify-center gap-1.5 py-2.5 bg-red-500/20 border border-red-500/40 text-red-200 rounded-xl font-bold text-xs hover:bg-red-500/30 transition-all active:scale-95 group-hover:shadow-md"
                              >
                                <span className="text-base">×</span>
                                <span>Reddet</span>
                              </button>
                              <button
                                onClick={async () => {
                                  await updateLeaveStatus(request.id, 'approved', accessToken);
                                  refreshLeaveRequests();
                                }}
                                className="flex items-center justify-center gap-1.5 py-2.5 bg-green-500/20 border border-green-500/40 text-green-200 rounded-xl font-bold text-xs hover:bg-green-500/30 transition-all active:scale-95 group-hover:shadow-md"
                              >
                                <span>✓</span>
                                <span>Onayla</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Düzenle Butonu - Approved/Rejected için */}
                      {(request.status === 'approved' || request.status === 'rejected') && canEdit && (
                        <button
                          onClick={() => {
                            setEditingLeaveRequest(request);
                            setShowLeaveModal(true);
                          }}
                          className="w-full py-2.5 bg-blue-500/20 border border-blue-500/40 text-blue-200 rounded-xl font-bold text-xs hover:bg-blue-500/30 transition-all active:scale-95 group-hover:shadow-md"
                        >
                          🔄 Düzenle
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {leaveRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🏖️</div>
                  <div className="text-gray-400 text-sm">
                    Henüz izin talebi yok
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Notification */}
      <AnimatePresence>
        {showSuccessNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-white/20 z-[90]"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6" />
              <span className="font-semibold">{notificationMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && cancellingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[90]"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-[#0f0825] to-[#1a0a3c] border-2 border-white/15 rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Görevi İptal Et</h3>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-300 mb-2">
                  <span className="font-semibold">{cancellingTask.locationIcon} {cancellingTask.location}</span>
                </p>
                <p className="text-sm text-gray-400">
                  {cancellingTask.startTime} - {cancellingTask.endTime}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  İptal Nedeni *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="İptal nedenini giriniz..."
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#9dd9ea] resize-none"
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3 px-4 bg-white/8 border border-white/15 text-white/80 rounded-xl font-semibold hover:bg-white/15 transition-all active:scale-95"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleCancelTask}
                  disabled={!cancelReason.trim()}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  İptali Onayla
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Modal */}
      {showTaskModal && (
        <RotationTaskModal
          isOpen={showTaskModal}
          modalType={modalType}
          editingTask={editingTask}
          selectedDate={selectedDate}
          locations={locations}
          staffMembers={staffMembers.filter(s => s.role !== 'yonetici')}
          onLeavePersonnel={onLeavePersonnel}
          leaveRequests={leaveRequests}
          dailyOnLeave={dailyOnLeave}
          preselectedLocation={preselectedLocation}
          accessToken={accessToken}
          existingTasks={tasks}
          onClose={handleCloseTaskModal}
          onTaskSaved={handleTaskSaved}
          onRemoveDailyOnLeave={handleTaskConfirmedDailyLeave}
        />
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <RotationLeaveModal
          isOpen={showLeaveModal}
          staffMembers={staffMembers}
          userRole={userRole}
          currentUserId={getCurrentUserId()}
          userName={userName}
          editingLeave={editingLeaveRequest}
          accessToken={accessToken}
          onClose={() => {
            setShowLeaveModal(false);
            setEditingLeaveRequest(null); // Reset editing state
            loadData(); // Refresh data
          }}
        />
      )}
    </div>
  );
}
