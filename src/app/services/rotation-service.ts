/**
 * ROTATION SERVICE
 * Data layer for Rotation Management System
 * Supabase KV Store API entegrasyonu
 */

import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

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
  taskType: 'regular' | 'extra' | 'special';
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
  personnelRole?: UserRole;
  startDate: string;
  endDate: string;
  days: number;
  type: 'annual' | 'sick' | 'personal';
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  rejectedAt?: string;
}

export interface WorkHistoryRecord {
  date: string;
  type: 'work' | 'leave';
  location?: string;
  icon?: string;
  startTime?: string;
  endTime?: string;
  leaveType?: 'annual' | 'sick' | 'personal';
  reason?: string;
}

export interface Location {
  id: string;
  name: string;
  icon: string;
  color: string;
  workingHours?: {
    start: string;
    end: string;
  };
}

// ==========================================
// STAFF MEMBERS
// ==========================================

export const getStaffMembers = async (): Promise<StaffMember[]> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/personel`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      console.error('getStaffMembers error:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return (data.staffMembers || []) as StaffMember[];
  } catch (error) {
    console.error('Error loading staff members:', error);
    return [];
  }
};

// ==========================================
// LOCATIONS
// ==========================================

export const getLocations = async (): Promise<Location[]> => {
  try {
    const res = await fetch(`${API_BASE}/mekanlar`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      console.error('getLocations error:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    // Mekan yönetimi 'emoji' kullanır, rotasyon 'icon' kullanır
    return (data.mekanlar || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      icon: m.emoji,
      color: m.color || '#9dd9ea',
      workingHours: m.workingHours,
    })) as Location[];
  } catch (error) {
    console.error('Error loading locations:', error);
    return [];
  }
};

// ==========================================
// TASKS
// ==========================================

export const getTasks = async (): Promise<Task[]> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/gorevler`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      console.error('getTasks error:', res.status);
      return [];
    }
    const data = await res.json();
    return (data.tasks || []) as Task[];
  } catch (error) {
    console.error('Error loading tasks:', error);
    return [];
  }
};

export const saveTask = async (task: Task): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/gorevler`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(task),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('saveTask error:', err);
    }
  } catch (error) {
    console.error('Error saving task:', error);
  }
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/gorevler/${taskId}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('updateTask error:', err);
    }
  } catch (error) {
    console.error('Error updating task:', error);
  }
};

export const updateMultipleTasks = async (
  updates: Array<{ id: string; changes: Partial<Task> }>
): Promise<void> => {
  try {
    await Promise.all(updates.map(({ id, changes }) => updateTask(id, changes)));
  } catch (error) {
    console.error('Error updating multiple tasks:', error);
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/gorevler/${taskId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('deleteTask error:', err);
    }
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

// ==========================================
// LEAVE REQUESTS
// ==========================================

export const getLeaveRequests = async (): Promise<LeaveRequest[]> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/izinler`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      console.error('getLeaveRequests error:', res.status);
      return [];
    }
    const data = await res.json();
    return (data.leaveRequests || []) as LeaveRequest[];
  } catch (error) {
    console.error('Error loading leave requests:', error);
    return [];
  }
};

export const saveLeaveRequest = async (leave: LeaveRequest): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/izinler`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(leave),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('saveLeaveRequest error:', err);
    }
  } catch (error) {
    console.error('Error saving leave request:', error);
  }
};

export const updateLeaveStatus = async (
  leaveId: string,
  status: 'pending' | 'approved' | 'rejected'
): Promise<void> => {
  const updates: Partial<LeaveRequest> = { status };
  if (status === 'rejected') {
    (updates as any).rejectedAt = new Date().toISOString();
  }
  await updateLeaveRequest(leaveId, updates);
};

export const updateLeaveRequest = async (
  leaveId: string,
  updatedLeave: Partial<LeaveRequest>
): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/izinler/${leaveId}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(updatedLeave),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('updateLeaveRequest error:', err);
    }
  } catch (error) {
    console.error('Error updating leave request:', error);
  }
};

export const cleanupExpiredLeaveRequests = async (): Promise<void> => {
  try {
    const leaves = await getLeaveRequests();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toDelete = leaves.filter(leave => {
      if (leave.status === 'rejected' && leave.rejectedAt) {
        const rejectedDate = new Date(leave.rejectedAt);
        rejectedDate.setDate(rejectedDate.getDate() + 1);
        return today >= rejectedDate;
      } else if (leave.status === 'approved' || leave.status === 'pending') {
        const endDate = new Date(leave.endDate);
        endDate.setDate(endDate.getDate() + 1);
        return today >= endDate;
      }
      return false;
    });

    if (toDelete.length > 0) {
      const headers = await authHeaders();
      await Promise.all(
        toDelete.map(leave =>
          fetch(`${API_BASE}/rotasyon/izinler/${leave.id}`, {
            method: 'DELETE',
            headers,
          })
        )
      );
    }
  } catch (error) {
    console.error('Error cleaning up leave requests:', error);
  }
};

// ==========================================
// DAILY ON LEAVE
// ==========================================

export const getDailyOnLeave = async (): Promise<Record<string, string[]>> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/gunluk-izin`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      console.error('getDailyOnLeave error:', res.status);
      return {};
    }
    const data = await res.json();
    return (data.dailyOnLeave || {}) as Record<string, string[]>;
  } catch (error) {
    console.error('Error loading daily on leave:', error);
    return {};
  }
};

export const saveDailyOnLeave = async (dailyOnLeave: Record<string, string[]>): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE}/rotasyon/gunluk-izin`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ dailyOnLeave }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('saveDailyOnLeave error:', err);
    }
  } catch (error) {
    console.error('Error saving daily on leave:', error);
  }
};

// ==========================================
// WORK HISTORY (gelecek entegrasyon)
// ==========================================

export const getWorkHistory = (_userId: string, _filter?: string): WorkHistoryRecord[] => {
  return [];
};

export const addWorkHistoryRecord = (_userId: string, _record: WorkHistoryRecord): void => {
  // Gelecekte API entegrasyonu yapılacak
};

// ==========================================
// MESSAGE FORMATTING
// ==========================================

export const sendMessageToRotationChannel = (message: string): void => {
  console.log('📤 ROTASYON MESAJI GÖNDERİLDİ:');
  console.log(message);
  console.log('-----------------------------------');
};

export const formatRotationMessage = (tasks: Task[], date: string): string => {
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
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

export const formatCancelMessage = (task: Task): string => {
  const dateObj = new Date(task.date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

  let message = `❌ **GÖREV İPTAL EDİLDİ** - ${dateStr}\n\n`;
  message += `${task.locationIcon} **${task.location}**\n`;
  message += `🕐 ${task.startTime}-${task.endTime}\n`;
  message += `❗ İptal Nedeni: ${task.cancelReason}\n`;

  return message;
};

export const formatOnLeaveMessage = (
  personnel: StaffMember[] | StaffMember,
  date: string
): string => {
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

  const personnelArray = Array.isArray(personnel) ? personnel : [personnel];

  let message = `🏖️ **İZİNLİ PERSONEL** - ${dateStr}\n\n`;
  personnelArray.forEach(person => {
    message += `   • ${person.avatar} ${person.name}\n`;
  });

  return message;
};

export const formatStandbyMessage = (
  personnel: StaffMember[] | StaffMember,
  date: string
): string => {
  const dateObj = new Date(date);
  const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

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

export const canEditLeaveRequest = (userRole: UserRole, targetRole: UserRole): boolean => {
  const userLevel = getRoleLevel(userRole);
  const targetLevel = getRoleLevel(targetRole);

  if (['operasyon', 'personel', 'idari'].includes(userRole)) {
    return false;
  }

  return userLevel > targetLevel;
};

export const canApproveRejectLeave = (
  userRole: UserRole,
  targetRole: UserRole,
  leaveDays: number
): boolean => {
  const userLevel = getRoleLevel(userRole);
  const targetLevel = getRoleLevel(targetRole);

  if (['personel', 'idari'].includes(userRole)) {
    return false;
  }

  if (userRole === 'operasyon') {
    return leaveDays === 1;
  }

  return userLevel > targetLevel;
};

export const getAvailableStaffForLeave = (
  userRole: UserRole,
  staffList: StaffMember[]
): StaffMember[] => {
  if (['personel', 'idari'].includes(userRole)) {
    return [];
  }

  const userLevel = getRoleLevel(userRole);

  return staffList.filter(staff => {
    const staffLevel = getRoleLevel(staff.role);
    return staffLevel < userLevel;
  });
};

export const shouldShowStaffSelector = (userRole: UserRole): boolean => {
  return !['personel', 'idari'].includes(userRole);
};