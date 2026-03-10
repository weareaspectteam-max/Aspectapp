/**
 * ROTATION SERVICE
 * Data layer for Rotation Management System
 * 
 * ŞİMDİ: LocalStorage (Mock Data)
 * GELECEK: Supabase / API entegrasyonu
 */

// ==========================================
// INTERFACES
// ==========================================

export interface Task {
  id: string;
  personnel: Personnel[];
  location: string;
  locationIcon: string;
  startTime: string;
  endTime: string;
  type: 'regular' | 'special';
  taskType: 'regular' | 'extra' | 'special'; // Görev tipi: Sabit Görev (yeşil) | Ekstra İş (pembe) | Özel Görev (mor)
  notes?: string;
  status: 'draft' | 'sent' | 'revised' | 'cancelled';
  date: string;
  sentAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  revisedAt?: string;
  revisionCount?: number;
}

export interface Personnel {
  id: string;
  name: string;
  avatar: string;
  role: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari';
}

export type UserRole = 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';

export interface StaffMember {
  id: string;
  name: string;
  avatar: string;
  role: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari';
  status: 'active' | 'on_leave';
}

export interface LeaveRequest {
  id: string;
  personnelId: string;
  personnelName: string;
  personnelAvatar: string;
  personnelRole?: UserRole; // Add role to leave request
  startDate: string;
  endDate: string;
  days: number;
  type: 'annual' | 'sick' | 'personal';
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  rejectedAt?: string; // Reddedilme tarihi
}

export interface WorkHistoryRecord {
  date: string;
  type: 'work' | 'leave';
  // For type: 'work'
  location?: string;
  icon?: string;
  startTime?: string;
  endTime?: string;
  // For type: 'leave'
  leaveType?: 'annual' | 'sick' | 'personal';
  reason?: string;
}

export interface Location {
  id: string;
  name: string;
  icon: string;
  workingHours?: {
    start: string;
    end: string;
  };
}

// ==========================================
// LOCALSTORAGE KEYS
// ==========================================

const STORAGE_KEYS = {
  TASKS: 'aspect_rotation_tasks',
  LEAVE_REQUESTS: 'aspect_rotation_leave_requests',
  DAILY_ON_LEAVE: 'aspect_rotation_daily_on_leave',
  WORK_HISTORY: 'aspect_rotation_work_history',
  USERS: 'aspect_users', // From User Management
  LOCATIONS: 'aspect_locations', // From Mekan Management
} as const;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Generate random emoji avatar
 */
const getRandomAvatar = (): string => {
  const avatars = ['👨', '👩', '🧑', '👨‍💼', '👩‍💼', '🧑‍💼', '👨‍🔧', '👩‍🔧', '👨‍💻', '👩‍💻'];
  return avatars[Math.floor(Math.random() * avatars.length)];
};

/**
 * Generate 60-day work history for a user
 */
const generateWorkHistory = (userId: string, locations: Location[]): WorkHistoryRecord[] => {
  const history: WorkHistoryRecord[] = [];
  const today = new Date('2026-03-07'); // Current date
  
  // Generate for last 60 days (March, February, January)
  for (let i = 0; i < 60; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // 85% work days, 15% leave days
    const isLeave = Math.random() < 0.15;
    
    if (isLeave) {
      const leaveTypes: Array<'annual' | 'sick' | 'personal'> = ['annual', 'sick', 'personal'];
      const leaveType = leaveTypes[Math.floor(Math.random() * leaveTypes.length)];
      const reasons: Record<string, string> = {
        annual: 'Yıllık İzin',
        sick: 'Hastalık İzni',
        personal: 'Kişisel İzin',
      };
      
      history.push({
        date: dateStr,
        type: 'leave',
        leaveType,
        reason: reasons[leaveType],
      });
    } else {
      // Random location
      const location = locations[Math.floor(Math.random() * locations.length)];
      const workStart = location.workingHours?.start || '09:00';
      const workEnd = location.workingHours?.end || '17:00';
      
      history.push({
        date: dateStr,
        type: 'work',
        location: location.name,
        icon: location.icon,
        startTime: workStart,
        endTime: workEnd,
      });
    }
  }
  
  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// ==========================================
// STAFF MEMBERS
// ==========================================

/**
 * Get all staff members from User Management
 * Converts User Management format to Rotation format
 */
export const getStaffMembers = (): StaffMember[] => {
  try {
    let usersData = localStorage.getItem(STORAGE_KEYS.USERS);
    
    // If no users in localStorage, initialize with demo data
    if (!usersData) {
      const demoUsers = generateDemoUsers();
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(demoUsers));
      usersData = JSON.stringify(demoUsers);
    }
    
    const users = JSON.parse(usersData);
    
    // Filter out 'bekleyen' role and convert to StaffMember format
    return users
      .filter((user: any) => user.role !== 'bekleyen')
      .map((user: any) => ({
        id: user.id,
        name: user.full_name,
        avatar: getRandomAvatar(),
        role: user.role,
        status: 'active' as const, // Default all to active
      }));
  } catch (error) {
    console.error('Error loading staff members:', error);
    return [];
  }
};

/**
 * Generate demo users for initial setup
 */
const generateDemoUsers = () => {
  return [
    // 1 Admin
    { id: 'user-1', email: 'admin@aspectops.com', full_name: 'Ahmet Yıldırım', role: 'yonetici', created_at: '2024-01-01T10:00:00Z', last_sign_in: '2024-03-05T09:00:00Z', phone: '+90 555 100 1001' },
    // 2 Üst Müdür
    { id: 'user-2', email: 'mehmet@aspectops.com', full_name: 'Mehmet Kaya', role: 'ust-mudur', created_at: '2024-01-10T10:00:00Z', last_sign_in: '2024-03-04T08:30:00Z', phone: '+90 555 100 1002' },
    { id: 'user-3', email: 'ayse@aspectops.com', full_name: 'Ayşe Demir', role: 'ust-mudur', created_at: '2024-01-15T10:00:00Z', last_sign_in: '2024-03-03T10:15:00Z', phone: '+90 555 100 1003' },
    // 3 Müdür
    { id: 'user-4', email: 'ali@aspectops.com', full_name: 'Ali Çelik', role: 'mudur', created_at: '2024-02-01T10:00:00Z', last_sign_in: '2024-03-02T09:45:00Z', phone: '+90 555 100 1004' },
    { id: 'user-5', email: 'zeynep@aspectops.com', full_name: 'Zeynep Arslan', role: 'mudur', created_at: '2024-02-05T10:00:00Z', last_sign_in: '2024-03-01T11:20:00Z', phone: '+90 555 100 1005' },
    { id: 'user-6', email: 'can@aspectops.com', full_name: 'Can Öztürk', role: 'mudur', created_at: '2024-02-10T10:00:00Z', last_sign_in: '2024-02-28T14:30:00Z', phone: '+90 555 100 1006' },
    // 4 Operasyon
    { id: 'user-7', email: 'selin@aspectops.com', full_name: 'Selin Yılmaz', role: 'operasyon', created_at: '2024-02-15T10:00:00Z', last_sign_in: '2024-02-27T08:00:00Z', phone: '+90 555 100 1007' },
    { id: 'user-8', email: 'burak@aspectops.com', full_name: 'Burak Kurt', role: 'operasyon', created_at: '2024-02-20T10:00:00Z', last_sign_in: '2024-02-26T09:30:00Z', phone: '+90 555 100 1008' },
    { id: 'user-9', email: 'elif@aspectops.com', full_name: 'Elif Aydın', role: 'operasyon', created_at: '2024-02-25T10:00:00Z', last_sign_in: '2024-02-25T10:45:00Z', phone: '+90 555 100 1009' },
    { id: 'user-10', email: 'emre@aspectops.com', full_name: 'Emre Şahin', role: 'operasyon', created_at: '2024-03-01T10:00:00Z', last_sign_in: '2024-02-24T13:15:00Z', phone: '+90 555 100 1010' },
    // 5 İdari
    { id: 'user-11', email: 'deniz@aspectops.com', full_name: 'Deniz Koç', role: 'idari', created_at: '2024-01-20T10:00:00Z', last_sign_in: '2024-02-23T15:00:00Z', phone: '+90 555 100 1011' },
    { id: 'user-12', email: 'merve@aspectops.com', full_name: 'Merve Aksoy', role: 'idari', created_at: '2024-01-25T10:00:00Z', last_sign_in: '2024-02-22T11:30:00Z', phone: '+90 555 100 1012' },
    { id: 'user-13', email: 'onur@aspectops.com', full_name: 'Onur Güneş', role: 'idari', created_at: '2024-01-30T10:00:00Z', last_sign_in: '2024-02-21T09:00:00Z', phone: '+90 555 100 1013' },
    { id: 'user-14', email: 'beste@aspectops.com', full_name: 'Beste Kılıç', role: 'idari', created_at: '2024-02-03T10:00:00Z', last_sign_in: '2024-02-20T14:20:00Z', phone: '+90 555 100 1014' },
    { id: 'user-15', email: 'kaan@aspectops.com', full_name: 'Kaan Özkan', role: 'idari', created_at: '2024-02-08T10:00:00Z', last_sign_in: '2024-02-19T10:10:00Z', phone: '+90 555 100 1015' },
    // 10 Personel
    { id: 'user-16', email: 'gizem@aspectops.com', full_name: 'Gizem Acar', role: 'personel', created_at: '2024-02-12T10:00:00Z', last_sign_in: '2024-02-18T08:45:00Z', phone: '+90 555 100 1016' },
    { id: 'user-17', email: 'berk@aspectops.com', full_name: 'Berk Polat', role: 'personel', created_at: '2024-02-14T10:00:00Z', last_sign_in: '2024-02-17T12:00:00Z', phone: '+90 555 100 1017' },
    { id: 'user-18', email: 'nisa@aspectops.com', full_name: 'Nisa Erdoğan', role: 'personel', created_at: '2024-02-16T10:00:00Z', last_sign_in: '2024-02-16T09:30:00Z', phone: '+90 555 100 1018' },
    { id: 'user-19', email: 'ege@aspectops.com', full_name: 'Ege Yavuz', role: 'personel', created_at: '2024-02-18T10:00:00Z', last_sign_in: '2024-02-15T11:15:00Z', phone: '+90 555 100 1019' },
    { id: 'user-20', email: 'simge@aspectops.com', full_name: 'Simge Çakır', role: 'personel', created_at: '2024-02-20T10:00:00Z', last_sign_in: '2024-02-14T13:45:00Z', phone: '+90 555 100 1020' },
    { id: 'user-21', email: 'murat@aspectops.com', full_name: 'Murat Tunç', role: 'personel', created_at: '2024-02-22T10:00:00Z', last_sign_in: '2024-02-13T10:00:00Z', phone: '+90 555 100 1021' },
  ];
};

// ==========================================
// LOCATIONS
// ==========================================

/**
 * Get all locations from Mekan Management
 */
export const getLocations = (): Location[] => {
  try {
    const locationsData = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    
    // If no locations exist, return empty array
    if (!locationsData) {
      return [];
    }
    
    const locations = JSON.parse(locationsData);
    return locations.map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      icon: loc.emoji || loc.icon || '📍', // Map emoji to icon
      workingHours: loc.workingHours || { start: '09:00', end: '17:00' },
    }));
  } catch (error) {
    console.error('Error loading locations:', error);
    return [];
  }
};

// ==========================================
// TASKS
// ==========================================

/**
 * Get all tasks
 */
export const getTasks = (): Task[] => {
  try {
    const tasksData = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!tasksData) return [];
    const tasks = JSON.parse(tasksData);
    
    // ✅ MIGRATION: Add taskType to existing tasks that don't have it
    const migratedTasks = tasks.map((task: any) => {
      if (!task.taskType) {
        // Determine taskType based on existing data
        if (task.type === 'regular') {
          return { ...task, taskType: 'regular' };
        } else if (task.type === 'special') {
          // Check icon to differentiate between extra and special
          if (task.locationIcon === '⚡') {
            return { ...task, taskType: 'special' };
          } else {
            return { ...task, taskType: 'extra' };
          }
        }
      }
      return task;
    });
    
    // Save migrated tasks back to localStorage
    if (JSON.stringify(tasks) !== JSON.stringify(migratedTasks)) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(migratedTasks));
    }
    
    return migratedTasks;
  } catch (error) {
    console.error('Error loading tasks:', error);
    return [];
  }
};

/**
 * Save a new task
 */
export const saveTask = (task: Task): void => {
  try {
    const tasks = getTasks();
    tasks.push(task);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (error) {
    console.error('Error saving task:', error);
  }
};

/**
 * Update an existing task
 */
export const updateTask = (taskId: string, updates: Partial<Task>): void => {
  try {
    const tasks = getTasks();
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    );
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updatedTasks));
  } catch (error) {
    console.error('Error updating task:', error);
  }
};

/**
 * Update multiple tasks
 */
export const updateMultipleTasks = (updates: Array<{ id: string; changes: Partial<Task> }>): void => {
  try {
    const tasks = getTasks();
    const updatedTasks = tasks.map(task => {
      const update = updates.find(u => u.id === task.id);
      return update ? { ...task, ...update.changes } : task;
    });
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(updatedTasks));
  } catch (error) {
    console.error('Error updating multiple tasks:', error);
  }
};

/**
 * Delete a task
 */
export const deleteTask = (taskId: string): void => {
  try {
    const tasks = getTasks();
    const filteredTasks = tasks.filter(task => task.id !== taskId);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filteredTasks));
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

// ==========================================
// LEAVE REQUESTS
// ==========================================

/**
 * Get all leave requests
 */
export const getLeaveRequests = (): LeaveRequest[] => {
  try {
    const leaveData = localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS);
    if (!leaveData) return [];
    return JSON.parse(leaveData);
  } catch (error) {
    console.error('Error loading leave requests:', error);
    return [];
  }
};

/**
 * Save a new leave request
 */
export const saveLeaveRequest = (leave: LeaveRequest): void => {
  try {
    const leaves = getLeaveRequests();
    leaves.push(leave);
    localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(leaves));
  } catch (error) {
    console.error('Error saving leave request:', error);
  }
};

/**
 * Update leave request status
 */
export const updateLeaveStatus = (leaveId: string, status: 'pending' | 'approved' | 'rejected'): void => {
  try {
    const leaves = getLeaveRequests();
    const updatedLeaves = leaves.map(leave => {
      if (leave.id === leaveId) {
        const updated = { ...leave, status };
        // Reddedildiğinde otomatik tarih ekle
        if (status === 'rejected') {
          updated.rejectedAt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatında
        }
        return updated;
      }
      return leave;
    });
    localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(updatedLeaves));
  } catch (error) {
    console.error('Error updating leave status:', error);
  }
};

/**
 * Update leave request (full update - for editing)
 */
export const updateLeaveRequest = (leaveId: string, updatedLeave: Partial<LeaveRequest>): void => {
  try {
    const leaves = getLeaveRequests();
    const updatedLeaves = leaves.map(leave =>
      leave.id === leaveId ? { ...leave, ...updatedLeave } : leave
    );
    localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(updatedLeaves));
  } catch (error) {
    console.error('Error updating leave request:', error);
  }
};

/**
 * Otomatik İzin Kartı Temizleme Sistemi
 * 
 * Kurallar:
 * 1. Onaylanan/Bekleyen izinler: Bitiş tarihi + 1 gün geçtiyse → SİL
 * 2. Reddedilen izinler: Reddedilme tarihi + 1 gün geçtiyse → SİL
 */
export const cleanupExpiredLeaveRequests = (): void => {
  try {
    const leaves = getLeaveRequests();
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zamanı sıfırla, sadece tarih karşılaştırması
    
    const filteredLeaves = leaves.filter(leave => {
      // Reddedilen izinler için
      if (leave.status === 'rejected' && leave.rejectedAt) {
        const rejectedDate = new Date(leave.rejectedAt);
        rejectedDate.setDate(rejectedDate.getDate() + 1); // +1 gün
        rejectedDate.setHours(0, 0, 0, 0);
        
        // Reddedilme tarihinden 1 gün geçtiyse SİL
        if (today >= rejectedDate) {
          console.log(`🗑️ Silindi (Rejected): ${leave.personnelName} - ${leave.rejectedAt}`);
          return false; // Kartı sil
        }
      }
      
      // Onaylanan ve Bekleyen izinler için
      if (leave.status === 'approved' || leave.status === 'pending') {
        const endDate = new Date(leave.endDate);
        endDate.setDate(endDate.getDate() + 1); // +1 gün
        endDate.setHours(0, 0, 0, 0);
        
        // Bitiş tarihinden 1 gün geçtiyse SİL
        if (today >= endDate) {
          console.log(`🗑️ Silindi (${leave.status}): ${leave.personnelName} - ${leave.endDate}`);
          return false; // Kartı sil
        }
      }
      
      return true; // Kartı koru
    });
    
    // Eğer değişiklik varsa localStorage'ı güncelle
    if (filteredLeaves.length !== leaves.length) {
      localStorage.setItem(STORAGE_KEYS.LEAVE_REQUESTS, JSON.stringify(filteredLeaves));
      console.log(`✅ İzin kartları temizlendi: ${leaves.length - filteredLeaves.length} kart silindi`);
    }
  } catch (error) {
    console.error('Error cleaning up leave requests:', error);
  }
};

// ==========================================
// DAILY ON LEAVE
// ==========================================

/**
 * Get daily on-leave personnel
 * Returns object: { '2026-03-07': ['user-1', 'user-2'], ... }
 */
export const getDailyOnLeave = (): Record<string, string[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DAILY_ON_LEAVE);
    if (!data) return {};
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading daily on leave:', error);
    return {};
  }
};

/**
 * Save daily on-leave personnel
 */
export const saveDailyOnLeave = (dailyOnLeave: Record<string, string[]>): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_ON_LEAVE, JSON.stringify(dailyOnLeave));
  } catch (error) {
    console.error('Error saving daily on leave:', error);
  }
};

// ==========================================
// WORK HISTORY
// ==========================================

/**
 * Get work history for a user
 */
export const getWorkHistory = (userId: string): WorkHistoryRecord[] => {
  try {
    const historyData = localStorage.getItem(`${STORAGE_KEYS.WORK_HISTORY}_${userId}`);
    
    if (!historyData) {
      // Generate initial 60-day history
      const locations = getLocations();
      if (locations.length === 0) return [];
      
      const history = generateWorkHistory(userId, locations);
      localStorage.setItem(`${STORAGE_KEYS.WORK_HISTORY}_${userId}`, JSON.stringify(history));
      return history;
    }
    
    return JSON.parse(historyData);
  } catch (error) {
    console.error('Error loading work history:', error);
    return [];
  }
};

/**
 * Add a work record to history
 */
export const addWorkHistoryRecord = (userId: string, record: WorkHistoryRecord): void => {
  try {
    const history = getWorkHistory(userId);
    history.unshift(record); // Add to beginning (newest first)
    localStorage.setItem(`${STORAGE_KEYS.WORK_HISTORY}_${userId}`, JSON.stringify(history));
  } catch (error) {
    console.error('Error adding work history record:', error);
  }
};

// ==========================================
// MESSAGE FORMATTING (MOCK)
// ==========================================

/**
 * Send message to rotation channel (MOCK - console.log)
 */
export const sendMessageToRotationChannel = (message: string): void => {
  console.log('📤 ROTASYON MESAJI GÖNDERİLDİ:');
  console.log(message);
  console.log('-----------------------------------');
};

/**
 * Format daily rotation message
 */
export const formatRotationMessage = (tasks: Task[], date: string): string => {
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric', 
    weekday: 'long' 
  });
  
  let message = `📋 **GÜNLÜK ROTASYON** - ${dateStr}\n\n`;
  
  tasks.forEach(task => {
    const taskType = task.type === 'special' ? '⚡' : '📌';
    message += `${taskType} ${task.locationIcon} **${task.location}**\n`;
    message += `   🕐 ${task.startTime}-${task.endTime}\n`;
    message += `   👥 Personel:\n`;
    task.personnel.forEach(person => {
      message += `      • ${person.avatar} ${person.name}\n`;
    });
    if (task.notes) message += `   📝 ${task.notes}\n`;
    message += '\n';
  });
  
  message += '✅ Görevler gönderildi. İyi çalışmalar!';
  return message;
};

/**
 * Format revision message
 */
export const formatRevisionMessage = (task: Task): string => {
  const dateObj = new Date(task.date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  
  let message = `🔄 **REVİZE EDİLDİ** - ${dateStr}\n\n`;
  message += `${task.locationIcon} **${task.location}**\n`;
  message += `🕐 ${task.startTime}-${task.endTime}\n`;
  message += `👥 Personel:\n`;
  task.personnel.forEach(person => {
    message += `   • ${person.avatar} ${person.name}\n`;
  });
  if (task.notes) message += `📝 ${task.notes}\n`;
  
  return message;
};

/**
 * Format cancellation message
 */
export const formatCancelMessage = (task: Task): string => {
  const dateObj = new Date(task.date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  
  let message = `❌ **GÖREV İPTAL EDİLDİ** - ${dateStr}\n\n`;
  message += `${task.locationIcon} **${task.location}**\n`;
  message += `🕐 ${task.startTime}-${task.endTime}\n`;
  message += `❗ İptal Nedeni: ${task.cancelReason}\n`;
  
  return message;
};

/**
 * Format on-leave message
 */
export const formatOnLeaveMessage = (personnel: StaffMember[] | StaffMember, date: string): string => {
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  
  // ✅ FIX: Handle both array and single object
  const personnelArray = Array.isArray(personnel) ? personnel : [personnel];
  
  let message = `🏖️ **İZİNLİ PERSONEL** - ${dateStr}\n\n`;
  personnelArray.forEach(person => {
    message += `   • ${person.avatar} ${person.name}\n`;
  });
  
  return message;
};

/**
 * Format standby message
 */
export const formatStandbyMessage = (personnel: StaffMember[] | StaffMember, date: string): string => {
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  
  // ✅ FIX: Handle both array and single object
  const personnelArray = Array.isArray(personnel) ? personnel : [personnel];
  
  let message = `⏳ **BEKLEMEDE OLAN PERSONEL** - ${dateStr}\n\n`;
  personnelArray.forEach(person => {
    message += `   • ${person.avatar} ${person.name}\n`;
  });
  
  return message;
};

// ==========================================
// PERMISSION / AUTHORIZATION SYSTEM
// ==========================================

/**
 * Get role hierarchy level (higher number = more authority)
 */
const getRoleLevel = (role: UserRole): number => {
  const levels: Record<UserRole, number> = {
    'yonetici': 6,
    'ust-mudur': 5,
    'mudur': 4,
    'operasyon': 3,
    'idari': 2,
    'personel': 1,
    'bekleyen': 0,
  };
  return levels[role] || 0;
};

/**
 * Check if user can edit a leave request
 * 
 * Rules:
 * - Yönetici: Can edit everyone's leave
 * - Üst Müdür: Can edit everyone EXCEPT Yönetici
 * - Müdür: Can edit everyone EXCEPT Yönetici and Üst Müdür
 * - Operasyon: Cannot edit any leave
 * - Personel/İdari: Cannot edit any leave (except their own through modal)
 */
export const canEditLeaveRequest = (userRole: UserRole, targetRole: UserRole): boolean => {
  const userLevel = getRoleLevel(userRole);
  const targetLevel = getRoleLevel(targetRole);
  
  // Operasyon, Personel, İdari cannot edit
  if (['operasyon', 'personel', 'idari'].includes(userRole)) {
    return false;
  }
  
  // User can only edit if their level is higher than target
  return userLevel > targetLevel;
};

/**
 * Check if user can approve/reject a leave request
 * 
 * Rules:
 * - Yönetici: Can approve/reject everyone
 * - Üst Müdür: Can approve/reject everyone EXCEPT Yönetici
 * - Müdür: Can approve/reject everyone EXCEPT Yönetici and Üst Müdür
 * - Operasyon: Can ONLY approve/reject 1-day leaves
 * - Personel/İdari: Cannot approve/reject
 */
export const canApproveRejectLeave = (
  userRole: UserRole, 
  targetRole: UserRole, 
  leaveDays: number
): boolean => {
  const userLevel = getRoleLevel(userRole);
  const targetLevel = getRoleLevel(targetRole);
  
  // Personel and İdari cannot approve/reject
  if (['personel', 'idari'].includes(userRole)) {
    return false;
  }
  
  // Operasyon can only approve/reject 1-day leaves
  if (userRole === 'operasyon') {
    return leaveDays === 1;
  }
  
  // Manager roles can approve/reject if their level is higher than target
  return userLevel > targetLevel;
};

/**
 * Get available staff for leave request based on user role
 * Filters staff list based on who the user can give leave to
 * 
 * Rules:
 * - Yönetici: Can see everyone
 * - Üst Müdür: Cannot see Yönetici
 * - Müdür: Cannot see Yönetici and Üst Müdür
 * - Operasyon: Can see everyone (but can only approve 1-day)
 * - Personel/İdari: Cannot see list (returns empty)
 */
export const getAvailableStaffForLeave = (userRole: UserRole, staffList: StaffMember[]): StaffMember[] => {
  // Personel and İdari cannot see staff list
  if (['personel', 'idari'].includes(userRole)) {
    return [];
  }
  
  const userLevel = getRoleLevel(userRole);
  
  // Filter staff based on hierarchy
  return staffList.filter(staff => {
    const staffLevel = getRoleLevel(staff.role);
    return staffLevel < userLevel;
  });
};

/**
 * Check if user should see staff selector in leave modal
 */
export const shouldShowStaffSelector = (userRole: UserRole): boolean => {
  return !['personel', 'idari'].includes(userRole);
};

// ==========================================
// FUTURE: API/SUPABASE IMPLEMENTATIONS
// ==========================================

/*
// Example Supabase implementation:

import { supabase } from '../lib/supabase';

export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('rotation_tasks')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const saveTask = async (task: Task): Promise<void> => {
  const { error } = await supabase
    .from('rotation_tasks')
    .insert(task);
  
  if (error) throw error;
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  const { error } = await supabase
    .from('rotation_tasks')
    .update(updates)
    .eq('id', taskId);
  
  if (error) throw error;
};

// Similar implementations for other functions...
*/