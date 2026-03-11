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
import { StaffTopBar } from './staff-top-bar';

interface RotationSystemProps {
  userName: string;
  userRole: UserRole;
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

export function RotationSystem({ userName, userRole, onLogout, onNavigate }: RotationSystemProps) {
  // ==========================================
  // STATE
  // ==========================================
  const [activeTab, setActiveTab] = useState<ActiveTab>(userRole === 'personel' ? 'assigned' : 'plan');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
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
      cleanupExpiredLeaveRequests();
    }
  }, [leaveRequests.length]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staff, locs, taskList, leaveList, dailyLeave] = await Promise.all([
        getStaffMembers(),
        getLocations(),
        getTasks(),
        getLeaveRequests(),
        getDailyOnLeave(),
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
    const taskList = await getTasks();
    setTasks(taskList);
  };

  // Refresh leave requests when needed
  const refreshLeaveRequests = async () => {
    const leaveList = await getLeaveRequests();
    setLeaveRequests(leaveList);
  };

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  // Get current user ID - Supabase session'dan
  const getCurrentUserId = (): string => {
    return currentUserId;
  };

  // 📋 GÖREV PLANLA SEKMESI: Sadece bugün ve gelecek görevleri göster
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayTasks = tasks.filter(t => {
    const taskDate = new Date(t.date);
    taskDate.setHours(0, 0, 0, 0);
    return t.date === selectedDate && taskDate >= today;
  });
  
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
    return staffMembers.filter(s => 
      s.status === 'on_leave' || onLeaveIds.includes(s.id)
    );
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
      dates.push(date.toISOString().split('T')[0]);
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
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
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
    refreshTasks();
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
    });

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
    });

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
      });
      refreshTasks();
    }

    handleOpenTaskModal(task.type === 'regular' ? 'regular_location' : 'extra_special', task);
  };

  const handleRemoveTask = async (taskId: string) => {
    if (confirm('Bu görevi silmek istediğinize emin misiniz?')) {
      await deleteTask(taskId);
      refreshTasks();

      setNotificationMessage('Görev silindi 🗑️');
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 3000);
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
      await updateMultipleTasks(updates);
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

  const handleSelectAllOnLeave = () => {
    const onLeavePersonnel = getOnLeavePersonnel();
    const selectableOnLeave = onLeavePersonnel.filter(p => p.status !== 'on_leave');
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
    await saveDailyOnLeave(updatedOnLeave);
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
    await saveDailyOnLeave(updatedOnLeave);
    setSelectedOnLeave([]);
    
    setNotificationMessage(`${personnelIds.length} personel beklemeye alındı ⏳`);
    setShowSuccessNotification(true);
    setTimeout(() => setShowSuccessNotification(false), 3000);
  };

  const handleMoveAllOnLeaveToStandby = () => {
    const onLeavePersonnel = getOnLeavePersonnel();
    const dailyOnLeaveIds = onLeavePersonnel.filter(p => p.status !== 'on_leave').map(p => p.id);
    
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
    await saveDailyOnLeave(updatedOnLeave);
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
      return 'bg-purple-500/10 border-purple-500/30';
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
      return 'bg-purple-500/10 border-purple-500/30';
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
    
    // Check if personnel is on leave
    const hasOnLeave = task.personnel.some(p => {
      const staff = staffMembers.find(s => s.id === p.id);
      return staff?.status === 'on_leave';
    });
    if (hasOnLeave) return 'border-l-rose-400';
    
    // Check if task has standby personnel
    const standbyIds = standbyPersonnel.map(p => p.id);
    const hasStandby = task.personnel.some(p => standbyIds.includes(p.id));
    if (hasStandby) return 'border-l-yellow-400';
    
    // ✅ YENİ: taskType field'ına göre renk seç
    if (task.taskType === 'special') return 'border-l-purple-500'; // 🟣 MOR - Özel Görev
    if (task.taskType === 'extra') return 'border-l-pink-500'; // 🩷 PEMBE - Ekstra İş
    if (task.taskType === 'regular') return 'border-l-green-500'; // 🟢 YEŞİL - Sabit Görev
    
    // Fallback (eski görevler için)
    if (task.type === 'special') return 'border-l-purple-500';
    return 'border-l-green-500';
  };

  // Get work history
  const personalHistory = getWorkHistory(getCurrentUserId(), historyFilter);

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">
      {/* Staff Top Bar - Only for personel role */}
      {userRole === 'personel' && (
        <StaffTopBar
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />
      )}

      {/* Header - Only show for non-staff roles */}
      {userRole !== 'personel' && (
        <div className="sticky top-0 z-[5] backdrop-blur-xl bg-white/10 border-b border-white/20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-[#2d3748]" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">Rotasyon Yönetimi</h1>
                <p className="text-xs text-gray-400">
                  {activeTab === 'plan' ? 'Günlük görev planlama' : 
                   activeTab === 'assigned' ? 'Gönderilen rotasyonlar' : 
                   'İzin talepleri'}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Butonları */}
          <div className="flex gap-2 bg-white/10 p-1.5 rounded-xl border border-white/20">
            {userRole !== 'personel' && (
              <button
                onClick={() => setActiveTab('plan')}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                  activeTab === 'plan'
                    ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                📋 Görev Planla
              </button>
            )}
            <button
              onClick={() => setActiveTab('assigned')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'assigned'
                  ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📨 Rotasyonlar
            </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'leaves'
                  ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🏖️ İzinler
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Tab Buttons for Staff - Below StaffTopBar */}
      {userRole === 'personel' && (
        <div className="sticky top-[72px] z-[4] backdrop-blur-xl bg-white/10 border-b border-white/20 px-6 py-4">
          <div className="flex gap-2 bg-white/10 p-1.5 rounded-xl border border-white/20">
            <button
              onClick={() => setActiveTab('assigned')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'assigned'
                  ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📨 Rotasyonlar
            </button>
            <button
              onClick={() => setActiveTab('leaves')}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'leaves'
                  ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🏖️ İzinler
            </button>
          </div>
        </div>
      )}

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
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 text-white text-xs font-semibold transition-all active:scale-95"
                >
                  ◀ Dün
                </button>
                <button
                  onClick={goToToday}
                  className="flex-1 px-4 py-2 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] hover:from-[#8dd9ea] hover:to-[#6ec8dd] rounded-xl text-[#2d3748] text-xs font-bold transition-all active:scale-95"
                >
                  Bugün
                </button>
                <button
                  onClick={() => changeDate(1)}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 text-white text-xs font-semibold transition-all active:scale-95"
                >
                  Yarın ▶
                </button>
              </div>

              {/* Tarih Input */}
              <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3 border border-white/20">
                <Calendar className="w-5 h-5 text-[#9dd9ea]" />
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
                                  return (
                                    <div key={person.id} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white">
                                      <span>{person.avatar}</span>
                                      <span className="font-medium">{person.name}</span>
                                      {staff?.status === 'on_leave' && (
                                        <span className="text-[9px] bg-orange-500/30 text-orange-200 px-1 py-0.5 rounded font-bold">İZİN</span>
                                      )}
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
                              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
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
                  className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
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
                      className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                    >
                      <Square className="w-4 h-4" />
                      Seçimi Temizle
                    </button>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSendTasks(false)}
                      disabled={totalSelections === 0}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] px-4 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Seçili ({totalSelections})
                    </button>
                    
                    <button
                      onClick={() => handleSendTasks(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] px-4 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95"
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
                            {task.personnel.map((person) => (
                              <div key={person.id} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white">
                                <span>{person.avatar}</span>
                                <span className="font-medium">{person.name}</span>
                              </div>
                            ))}
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
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95"
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

              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border-2 border-white/20 p-4 min-h-[80px]">
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
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-600'
                        : 'bg-cyan-500/30 text-cyan-300 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Seçili Personelleri Beklemeye Al</span>
                  </button>

                  <button
                    onClick={handleMoveAllOnLeaveToStandby}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-xs transition-all border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Tümünü Beklemeye Al</span>
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
                            const selectableOnLeave = onLeavePersonnel.filter(p => p.status !== 'on_leave');
                            if (selectedOnLeave.length === selectableOnLeave.length) {
                              setSelectedOnLeave([]);
                            } else {
                              setSelectedOnLeave(selectableOnLeave.map(p => p.id));
                            }
                          }}
                          className="text-xs text-[#9dd9ea] hover:text-white transition-all whitespace-nowrap px-2 py-1 rounded"
                        >
                          {selectedOnLeave.length === onLeavePersonnel.filter(p => p.status !== 'on_leave').length ? 'Temizle' : 'Tümünü Seç'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {onLeavePersonnel.map((person) => {
                        const isDefaultLeave = person.status === 'on_leave';
                        const isDailyLeave = !isDefaultLeave && (dailyOnLeave[selectedDate] || []).includes(person.id);
                        
                        return (
                          <div key={person.id} className="relative">
                            {!isDefaultLeave ? (
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
                            ) : (
                              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-gray-300">
                                <span>{person.avatar}</span>
                                <span>{person.name}</span>
                                <span className="text-[9px] bg-blue-600 text-white px-1 py-0.5 rounded font-bold">SABİT</span>
                              </div>
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

              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border-2 border-white/20 p-4 min-h-[80px]">
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
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl'
                        : 'bg-orange-500/30 text-orange-300 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Seçili Personelleri İzinli Ata</span>
                  </button>

                  <button
                    onClick={handleMoveAllStandbyToOnLeave}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-xs transition-all border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Tümünü İzinli Ata</span>
                  </button>
                </div>

                {/* PERSONEL LİSTESİ */}
                {standbyPersonnel.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-gray-400">
                        👥 Göreve atanmamış personel:
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (selectedStandby.length === standbyPersonnel.length) {
                              setSelectedStandby([]);
                            } else {
                              setSelectedStandby(standbyPersonnel.map(p => p.id));
                            }
                          }}
                          className="text-xs text-[#9dd9ea] hover:text-white transition-all whitespace-nowrap px-2 py-1 rounded"
                        >
                          {selectedStandby.length === standbyPersonnel.length ? 'Temizle' : 'Tümünü Seç'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {standbyPersonnel.map((person) => (
                        <button
                          key={person.id}
                          onClick={() => handleToggleStandbySelection(person.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            selectedStandby.includes(person.id)
                              ? 'bg-amber-500/30 border-2 border-amber-400 text-white'
                              : 'bg-white/10 border border-white/20 text-gray-300'
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

            {/* Group tasks by date */}
            {(() => {
              // 🔄 ROTASYONLAR SEKMESI: Dün, bugün ve gelecek görevleri göster (2+ gün öncesini gösterme)
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              yesterday.setHours(0, 0, 0, 0);
              
              const sentTasks = tasks
                .filter(t => {
                  if (!(t.status === 'sent' || t.status === 'revised' || t.status === 'cancelled')) return false;
                  
                  const taskDate = new Date(t.date);
                  taskDate.setHours(0, 0, 0, 0);
                  
                  return taskDate >= yesterday; // Dün (T-1) ve sonrası
                })
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, visibleTaskCount);

              const groupedByDate: Record<string, Task[]> = {};
              sentTasks.forEach(task => {
                if (!groupedByDate[task.date]) {
                  groupedByDate[task.date] = [];
                }
                groupedByDate[task.date].push(task);
              });
              
              // Add on-leave and standby personnel cards for today
              const today = new Date().toISOString().split('T')[0];
              const todayOnLeave = getOnLeavePersonnel();
              const todayStandby = getStandbyPersonnel();

              return Object.entries(groupedByDate).map(([date, dateTasks]) => {
                const d = new Date(date);
                const formattedDate = `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'long' })} ${d.toLocaleDateString('tr-TR', { weekday: 'long' })}`;

                return (
                  <div key={date} className="mb-6 overflow-visible">
                    {/* Tarih Başlığı */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-white/20" />
                      <div className="text-sm font-bold text-white px-3 py-1.5 bg-white/10 rounded-lg border border-white/20">
                        {formattedDate}
                      </div>
                      <div className="h-px flex-1 bg-white/20" />
                    </div>

                    {/* Görev Kartları */}
                    <div className="space-y-3 overflow-visible">
                      {dateTasks.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`backdrop-blur-xl rounded-2xl border-2 overflow-visible border-l-4 relative ${getStatusColors(task)} ${getBorderColor(task)}`}
                        >
                          {/* 🗓️ TARİH BADGE - KARTTIN DIŞINDA ÜST SOL */}
                          <div className="absolute -top-3 -left-3 z-20">
                            <div className="flex items-center justify-center px-3 py-1.5 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] border-2 border-white/30 rounded-xl shadow-lg">
                              <span className="text-[10px] text-[#2d3748] font-bold">
                                {new Date(task.date).getDate()} {new Date(task.date).toLocaleDateString('tr-TR', { month: 'long' })} {new Date(task.date).toLocaleDateString('tr-TR', { weekday: 'long' })}
                              </span>
                            </div>
                          </div>

                          {/* 🎨 WATERMARK İKON - SAĞ ÜST (GÖREV TİPİNE GÖRE) */}
                          <div className="absolute right-4 top-4 pointer-events-none z-0">
                            {task.taskType === 'regular' && <Repeat className="w-20 h-20 text-green-500/10" />}
                            {task.taskType === 'extra' && <Zap className="w-20 h-20 text-pink-500/10" />}
                            {task.taskType === 'special' && <Star className="w-20 h-20 text-purple-500/10" />}
                          </div>

                          {/* REVİZE BADGE - SAĞ ÜST */}
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
                              {/* DURUM İKONU */}
                              {task.status === 'sent' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />}
                              {task.status === 'revised' && <RefreshCw className="w-5 h-5 text-orange-400 flex-shrink-0 mt-1" />}
                              {task.status === 'cancelled' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />}
                              
                              <div className="flex-1">
                                {/* SATIR 1: Zaman + Mekan + Saat */}
                                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                  <span className="text-base">{getTimePeriodIcon(task.startTime)}</span>
                                  <span className="text-gray-600 mx-1">|</span>
                                  <span className="text-base">{task.locationIcon}</span>
                                  <span className="font-bold text-white">{task.location}</span>
                                  <span className="text-gray-400 mx-1">•</span>
                                  <span className="text-base">🕐</span>
                                  <span className="text-green-400 font-semibold">{task.startTime}-{task.endTime}</span>
                                </div>

                                {/* SATIR 2: Görev Tipi */}
                                <div className="flex items-center gap-1.5 text-xs ml-8 mb-2">
                                  <span>{task.taskType === 'special' ? '⭐' : task.taskType === 'extra' ? '📍' : '📌'}</span>
                                  <span className="text-gray-300">{task.taskType === 'special' ? 'Özel Görev' : task.taskType === 'extra' ? 'Ekstra İş' : 'Sabit Görev'}</span>
                                  <span className="text-gray-400 mx-1">|</span>
                                  <span className="text-gray-300">
                                    Gönderim Saati: {task.status === 'sent' ? task.sentAt : task.status === 'revised' ? task.revisedAt : task.cancelledAt}
                                  </span>
                                </div>

                                {/* PERSONEL LİSTESİ */}
                                <div className="bg-white/10 rounded-xl p-2.5 mb-3">
                                  <div className="text-xs font-semibold text-gray-400 mb-2">👥 Personel ({task.personnel.length}):</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {task.personnel.map((person) => (
                                      <div key={person.id} className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 text-xs text-white relative group">
                                        <span>{person.avatar}</span>
                                        <span className="flex-1 truncate">{person.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* NOTLAR */}
                                {task.notes && (
                                  <div className="text-xs mt-2 bg-white/10 rounded-lg px-2 py-1 text-gray-300">
                                    📝 {task.notes}
                                  </div>
                                )}
                                
                                {/* İPTAL SEBEBİ */}
                                {task.status === 'cancelled' && task.cancelReason && (
                                  <div className="text-xs mt-2 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 text-red-300">
                                    ❌ İptal Sebebi: {task.cancelReason}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* İzinli Personel Kartı (sadece bugün için) */}
                      {date === today && (
                        <motion.div
                          key="on-leave-card"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="backdrop-blur-xl rounded-2xl border-2 overflow-visible border-l-4 border-l-cyan-400 relative bg-cyan-500/10 border-cyan-500/40"
                        >
                          {/* 🗓️ TARİH BADGE - KARTTIN DIŞINDA ÜST SOL */}
                          <div className="absolute -top-3 -left-3 z-20">
                            <div className="flex items-center justify-center px-3 py-1.5 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] border-2 border-white/30 rounded-xl shadow-lg">
                              <span className="text-[10px] text-[#2d3748] font-bold">
                                {new Date(date).getDate()} {new Date(date).toLocaleDateString('tr-TR', { month: 'long' })} {new Date(date).toLocaleDateString('tr-TR', { weekday: 'long' })}
                              </span>
                            </div>
                          </div>

                          {/* 🎨 WATERMARK İKON - SAĞ ÜST */}
                          <div className="absolute right-4 top-4 pointer-events-none z-0">
                            <CalendarX className="w-24 h-24 text-cyan-400/10" />
                          </div>
                          
                          <div className="p-4 pt-10 relative z-10">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                  <span className="text-base">🏖️</span>
                                  <span className="text-gray-600 mx-1">|</span>
                                  <span className="font-bold text-white">Bugün İzinli Personel</span>
                                  <span className="text-gray-400 mx-1">•</span>
                                  <span className="text-base">🕐</span>
                                  <span className="text-green-400 font-semibold">00:00-23:59</span>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs ml-8 mb-2">
                                  <span>📋</span>
                                  <span className="text-gray-300">İzinli Listesi</span>
                                  <span className="text-gray-400 mx-1">|</span>
                                  <span className="px-2 py-0.5 bg-orange-500/30 text-orange-200 text-[10px] font-bold rounded">Dinamik Güncelleme</span>
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
                                    <div className="text-xs text-gray-400 text-center py-2">
                                      Bugün izinli personel yok
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Beklemede Personel Kartı (sadece bugün için) */}
                      {date === today && (
                        <motion.div
                          key="standby-card"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="backdrop-blur-xl rounded-2xl border-2 overflow-visible border-l-4 border-l-yellow-400 relative bg-yellow-500/10 border-yellow-500/40"
                        >
                          {/* 🗓️ TARİH BADGE - KARTTIN DIŞINDA ÜST SOL */}
                          <div className="absolute -top-3 -left-3 z-20">
                            <div className="flex items-center justify-center px-3 py-1.5 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] border-2 border-white/30 rounded-xl shadow-lg">
                              <span className="text-[10px] text-[#2d3748] font-bold">
                                {new Date(date).getDate()} {new Date(date).toLocaleDateString('tr-TR', { month: 'long' })} {new Date(date).toLocaleDateString('tr-TR', { weekday: 'long' })}
                              </span>
                            </div>
                          </div>

                          {/* 🎨 WATERMARK İKON - SAĞ ÜST */}
                          <div className="absolute right-4 top-4 pointer-events-none z-0">
                            <Clock className="w-24 h-24 text-yellow-400/10" />
                          </div>
                          
                          <div className="p-4 pt-10 relative z-10">
                            <div className="flex items-start gap-3">
                              <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                  <span className="text-base">⏳</span>
                                  <span className="text-gray-600 mx-1">|</span>
                                  <span className="font-bold text-white">Rotasyona Atanabilirsiniz Lütfen Haber Bekleyin</span>
                                  <span className="text-gray-400 mx-1">•</span>
                                  <span className="text-base">🕐</span>
                                  <span className="text-green-400 font-semibold">00:00-23:59</span>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs ml-8 mb-2">
                                  <span>⏳</span>
                                  <span className="text-gray-300">Bekleme Listesi</span>
                                  <span className="text-gray-400 mx-1">|</span>
                                  <span className="px-2 py-0.5 bg-yellow-500/30 text-yellow-200 text-[10px] font-bold rounded">Dinamik Güncelleme</span>
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
                                    <div className="text-xs text-gray-400 text-center py-2">
                                      Beklemedeki personel yok
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Daha Fazla Göster */}
            {tasks.filter(t => t.status === 'sent' || t.status === 'revised' || t.status === 'cancelled').length > visibleTaskCount && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => setVisibleTaskCount(prev => prev + 10)}
                  className="flex items-center gap-2 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Daha Fazla +10
                </button>
              </div>
            )}
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                🏖️ İzin Talepleri
                <span className="text-xs bg-white/20 px-2 py-1 rounded-lg">{leaveRequests.length}</span>
              </h2>
              
              <div className="flex items-center gap-2">
                {/* Geçmişim Butonu */}
                <button
                  onClick={() => setShowPersonalHistory(!showPersonalHistory)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all active:scale-95 ${
                    showPersonalHistory 
                      ? 'bg-gradient-to-br from-[#ffd89b] to-[#ffb347] text-[#2d3748]' 
                      : 'bg-white/10 text-white border-2 border-white/20'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  📊 Geçmişim
                </button>
                
                {/* İzin Ekle Butonu */}
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="flex items-center gap-1.5 bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] px-3 py-2 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
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
                              ? 'bg-[#9dd9ea] text-[#2d3748]'
                              : 'bg-white/10 text-gray-400 hover:bg-white/20'
                          }`}
                        >
                          Bu Hafta
                        </button>
                        <button
                          onClick={() => setHistoryFilter('month')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                            historyFilter === 'month'
                              ? 'bg-[#9dd9ea] text-[#2d3748]'
                              : 'bg-white/10 text-gray-400 hover:bg-white/20'
                          }`}
                        >
                          Bu Ay
                        </button>
                        <button
                          onClick={() => setHistoryFilter('2months')}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                            historyFilter === '2months'
                              ? 'bg-[#9dd9ea] text-[#2d3748]'
                              : 'bg-white/10 text-gray-400 hover:bg-white/20'
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
                                  await updateLeaveStatus(request.id, 'rejected');
                                  refreshLeaveRequests();
                                }}
                                className="flex items-center justify-center gap-1.5 py-2.5 bg-red-500/20 border border-red-500/40 text-red-200 rounded-xl font-bold text-xs hover:bg-red-500/30 transition-all active:scale-95 group-hover:shadow-md"
                              >
                                <span className="text-base">×</span>
                                <span>Reddet</span>
                              </button>
                              <button
                                onClick={async () => {
                                  await updateLeaveStatus(request.id, 'approved');
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-white/20 rounded-2xl p-6 max-w-md w-full"
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
                  className="flex-1 py-3 px-4 bg-gray-600/50 border-2 border-gray-500/30 text-gray-200 rounded-xl font-semibold hover:bg-gray-600/70 transition-all active:scale-95"
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
          staffMembers={staffMembers}
          onLeavePersonnel={onLeavePersonnel}
          leaveRequests={leaveRequests}
          dailyOnLeave={dailyOnLeave}
          preselectedLocation={preselectedLocation}
          onClose={handleCloseTaskModal}
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
