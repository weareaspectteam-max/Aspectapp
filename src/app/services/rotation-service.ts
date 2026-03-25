/**
 * ROTATION SERVICE
 * Data layer for Rotation Management System
 * Supabase KV Store API entegrasyonu
 */

import { authHeaders, buildHeaders } from '../lib/api';
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
  gorev?: 'fotograf-satis' | 'baski' | 'album'; // Takım görev etiketi (2+ kişide)
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

export const getStaffMembers = async (token?: string): Promise<StaffMember[]> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/rotasyon/personel`, { headers });
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

export const getLocations = async (token?: string): Promise<Location[]> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/mekanlar`, { headers });
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

export const getTasks = async (token?: string): Promise<Task[]> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/rotasyon/gorevler`, { headers });
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

export const saveTask = async (task: Task, token?: string): Promise<void> => {
  const headers = token ? buildHeaders(token) : await authHeaders();
  const res = await fetch(`${API_BASE}/rotasyon/gorevler`, {
    method: 'POST',
    headers,
    body: JSON.stringify(task),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const message = err?.error || `HTTP ${res.status}`;
    console.error('saveTask error:', message);
    throw new Error(message);
  }
};

export const updateTask = async (taskId: string, updates: Partial<Task>, token?: string): Promise<void> => {
  const headers = token ? buildHeaders(token) : await authHeaders();
  const res = await fetch(`${API_BASE}/rotasyon/gorevler/${taskId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    const message = err?.error || `HTTP ${res.status}`;
    console.error('updateTask error:', message);
    throw new Error(message);
  }
};

export const updateMultipleTasks = async (
  updates: Array<{ id: string; changes: Partial<Task> }>,
  token?: string
): Promise<void> => {
  try {
    await Promise.all(updates.map(({ id, changes }) => updateTask(id, changes, token)));
  } catch (error) {
    console.error('Error updating multiple tasks:', error);
  }
};

export const deleteTask = async (taskId: string, token?: string): Promise<void> => {
  const headers = token ? buildHeaders(token) : await authHeaders();
  const res = await fetch(`${API_BASE}/rotasyon/gorevler/${taskId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err?.error || message;
    } catch {}
    console.error('deleteTask error:', message);
    throw new Error(message);
  }
};

// ==========================================
// LEAVE REQUESTS
// ==========================================

export const getLeaveRequests = async (token?: string): Promise<LeaveRequest[]> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/rotasyon/izinler`, { headers });
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

export const saveLeaveRequest = async (leave: LeaveRequest, token?: string): Promise<void> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/rotasyon/izinler`, {
      method: 'POST',
      headers,
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
  status: 'pending' | 'approved' | 'rejected',
  token?: string
): Promise<void> => {
  const updates: Partial<LeaveRequest> = { status };
  if (status === 'rejected') {
    (updates as any).rejectedAt = new Date().toISOString();
  }
  await updateLeaveRequest(leaveId, updates, token);
};

export const updateLeaveRequest = async (
  leaveId: string,
  updatedLeave: Partial<LeaveRequest>,
  token?: string
): Promise<void> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/rotasyon/izinler/${leaveId}`, {
      method: 'PUT',
      headers,
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

export const deleteLeaveRequest = async (leaveId: string, token?: string): Promise<boolean> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/rotasyon/izinler/${leaveId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      console.error('deleteLeaveRequest error:', res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting leave request:', error);
    return false;
  }
};

export const cleanupExpiredLeaveRequests = async (token?: string): Promise<void> => {
  try {
    const leaves = await getLeaveRequests(token);
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
      const headers = token ? buildHeaders(token) : await authHeaders();
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

export const getDailyOnLeave = async (token?: string): Promise<Record<string, string[]>> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/rotasyon/gunluk-izin`, { headers });
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

export const saveDailyOnLeave = async (dailyOnLeave: Record<string, string[]>, token?: string): Promise<void> => {
  try {
    const headers = token ? buildHeaders(token) : await authHeaders();
    const res = await fetch(`${API_BASE}/rotasyon/gunluk-izin`, {
      method: 'PUT',
      headers,
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