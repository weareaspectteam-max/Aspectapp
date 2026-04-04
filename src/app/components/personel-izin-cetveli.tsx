/**
 * PersonelIzinCetveli — Aylık Personel İzin / Çalışma Çizelgesi
 * Satırlar: personel, Sütunlar: günler (1–31)
 * Hücreler sadece renk, tıklayınca detay popup açılır.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, X, Search, Users,
  Calendar, Clock, MapPin, AlertCircle, CheckCircle,
  Loader2, RefreshCw, HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getStaffMembers,
  getTasks,
  getLeaveRequests,
  getDailyOnLeave,
  type StaffMember,
  type Task,
  type LeaveRequest,
  type UserRole,
} from '../services/rotation-service';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

type CellStatus = 'work' | 'approved_leave' | 'daily_leave' | 'pending_leave' | 'unassigned' | 'empty';

interface CellData {
  status: CellStatus;
  // work
  locationName?: string;
  locationIcon?: string;
  startTime?: string;
  endTime?: string;
  taskType?: string;
  // leave
  leaveType?: 'annual' | 'sick' | 'personal';
  leaveSource?: 'status' | 'approved_request' | 'daily';
  leaveNotes?: string;
  // pending
  pendingLeaveType?: 'annual' | 'sick' | 'personal';
  pendingNotes?: string;
}

interface PopupInfo {
  staff: StaffMember;
  date: string; // YYYY-MM-DD
  cell: CellData;
  rect: DOMRect;
}

interface PersonelIzinCetveliProps {
  userName: string;
  userRole: UserRole;
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Yıllık İzin',
  sick: 'Sağlık İzni',
  personal: 'Kişisel İzin',
};

/** YYYY-MM-DD → Date (yerel saat, sıfır offset) */
const parseDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Date → YYYY-MM-DD */
const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** İzin talebinin belirli bir tarihi kapsayıp kapsamadığını kontrol et */
const leaveCoversDate = (leave: LeaveRequest, dateStr: string): boolean => {
  const d = parseDate(dateStr);
  const start = parseDate(leave.startDate);
  const end = parseDate(leave.endDate);
  return d >= start && d <= end;
};

/** Lokasyon adından kısaltma */
const abbrev = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

const toTitleCase = (str: string): string =>
  str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const STATUS_COLORS: Record<CellStatus, { bg: string; border: string; label: string }> = {
  work:           { bg: '#22c55e',  border: '#16a34a', label: 'Çalışıyor'    },
  approved_leave: { bg: '#ef4444',  border: '#dc2626', label: 'Onaylı İzin'  },
  daily_leave:    { bg: '#f97316',  border: '#ea580c', label: 'Günlük İzin'  },
  pending_leave:  { bg: '#eab308',  border: '#ca8a04', label: 'Bekleyen İzin'},
  unassigned:     { bg: '#3b82f6',  border: '#2563eb', label: 'Kayıtsız'     },
  empty:          { bg: 'transparent', border: 'transparent', label: 'Veri Yok' },
};

// ─────────────────────────────────────────
// Legend
// ─────────────────────────────────────────

function Legend() {
  const items: CellStatus[] = ['work', 'approved_leave', 'daily_leave', 'pending_leave', 'unassigned'];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-4">
      {items.map(s => (
        <div key={s} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ background: STATUS_COLORS[s].bg }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
            {STATUS_COLORS[s].label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Cell Component (memoized)
// ─────────────────────────────────────────

const Cell = React.memo(function Cell({
  cell,
  onClick,
}: {
  cell: CellData;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const color = STATUS_COLORS[cell.status];
  const isEmpty = cell.status === 'empty';

  return (
    <button
      onClick={isEmpty ? undefined : onClick}
      className="w-full h-full flex items-center justify-center rounded-sm transition-opacity"
      style={{
        width: 26,
        height: 22,
        background: isEmpty ? 'rgba(255,255,255,0.04)' : color.bg,
        border: `1px solid ${isEmpty ? 'rgba(255,255,255,0.08)' : color.border}`,
        cursor: isEmpty ? 'default' : 'pointer',
        opacity: 1,
      }}
    />
  );
});

// ─────────────────────────────────────────
// Popup Component
// ─────────────────────────────────────────

function CellPopup({
  info,
  onClose,
}: {
  info: PopupInfo;
  onClose: () => void;
}) {
  const { staff, date, cell } = info;
  const dateObj = parseDate(date);
  const dayName = DAYS_TR[dateObj.getDay()];
  const dayNum = dateObj.getDate();
  const monthName = MONTHS_TR[dateObj.getMonth()];
  const color = STATUS_COLORS[cell.status];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9990] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-sm mx-4 mb-8 rounded-2xl overflow-hidden"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--app-bg, linear-gradient(170deg, #1a0a3c 0%, #120830 100%))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 pt-4 pb-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="text-xl w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {staff.avatar}
              </div>
              <div>
                <p className="text-white font-bold text-sm">{toTitleCase(staff.name)}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                  {dayName}, {dayNum} {monthName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4 space-y-3">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1 rounded-full text-white font-bold"
                style={{ fontSize: 11, background: color.bg, letterSpacing: '0.04em' }}
              >
                {color.label.toUpperCase()}
              </div>
            </div>

            {/* Work detail */}
            {cell.status === 'work' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                  <span className="text-white text-sm font-semibold">
                    {cell.locationIcon} {cell.locationName}
                  </span>
                </div>
                {cell.startTime && cell.endTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                      {cell.startTime} – {cell.endTime}
                    </span>
                  </div>
                )}
                {cell.taskType && (
                  <div className="flex items-center gap-2">
                    <div
                      className="px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: 10,
                        background: cell.taskType === 'special' ? 'rgba(var(--app-accent-rgb),0.2)' : 'rgba(99,102,241,0.2)',
                        color: cell.taskType === 'special' ? 'var(--app-accent, #a855f7)' : '#818cf8',
                        border: `1px solid ${cell.taskType === 'special' ? 'rgba(var(--app-accent-rgb),0.3)' : 'rgba(99,102,241,0.3)'}`,
                      }}
                    >
                      {cell.taskType === 'special' ? 'Özel Görev' : cell.taskType === 'extra' ? 'Ekstra' : 'Normal Rotasyon'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Approved leave detail */}
            {cell.status === 'approved_leave' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    {cell.leaveSource === 'status'
                      ? 'Personelin sabit izin statüsü aktif'
                      : cell.leaveSource === 'approved_request'
                        ? 'Onaylı izin talebi'
                        : 'Onaylı izin'}
                  </span>
                </div>
                {cell.leaveType && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                      {LEAVE_TYPE_LABELS[cell.leaveType] ?? cell.leaveType}
                    </span>
                  </div>
                )}
                {cell.leaveNotes && (
                  <p
                    className="rounded-xl px-3 py-2"
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.45)',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    {cell.leaveNotes}
                  </p>
                )}
              </div>
            )}

            {/* Unassigned detail */}
            {cell.status === 'unassigned' && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                  O gün rotasyon oluşturulmuş ancak bu personel hiçbir göreve atanmamış
                </span>
              </div>
            )}

            {/* Daily leave detail */}
            {cell.status === 'daily_leave' && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f97316' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                  Günlük manuel izin (rotasyon planından eklendi)
                </span>
              </div>
            )}

            {/* Pending leave detail */}
            {cell.status === 'pending_leave' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#eab308' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                    Onay bekleyen izin talebi
                  </span>
                </div>
                {cell.pendingLeaveType && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                      {LEAVE_TYPE_LABELS[cell.pendingLeaveType] ?? cell.pendingLeaveType}
                    </span>
                  </div>
                )}
                {cell.pendingNotes && (
                  <p
                    className="rounded-xl px-3 py-2"
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.45)',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    {cell.pendingNotes}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

export function PersonelIzinCetveli({
  userName,
  userRole,
  accessToken,
  onLogout,
  onNavigate,
}: PersonelIzinCetveliProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Raw data
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [dailyOnLeave, setDailyOnLeave] = useState<Record<string, string[]>>({});

  // Scroll ref for table
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // ── Veri çekme ──────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, l, d] = await Promise.all([
        getStaffMembers(accessToken),
        getTasks(accessToken),
        getLeaveRequests(accessToken),
        getDailyOnLeave(accessToken),
      ]);
      setStaffList(s);
      setTasks(t);
      setLeaveRequests(l);
      setDailyOnLeave(d);
    } catch (err) {
      console.error('İzin cetveli veri hatası:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Ay navigasyonu ───────────────────────
  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // ── Ay günleri ───────────────────────────
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);

  const dayColumns = useMemo<Array<{ day: number; dateStr: string; dayOfWeek: number }>>(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return {
        day: i + 1,
        dateStr: toISO(d),
        dayOfWeek: d.getDay(),
      };
    });
  }, [year, month, daysInMonth]);

  // ── Filtrelenmiş personel ────────────────
  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const active = staffList.filter(s => s.role !== 'yonetici');
    if (!q) return active;
    return active.filter(s => s.name.toLowerCase().includes(q));
  }, [staffList, searchQuery]);

  // ── Görevleri tarihe göre indeksle ──────
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (!task.date) return;
      const [ty, tm] = task.date.split('-').map(Number);
      if (ty !== year || tm - 1 !== month) return;
      if (task.status === 'cancelled') return;
      if (!map[task.date]) map[task.date] = [];
      map[task.date].push(task);
    });
    return map;
  }, [tasks, year, month]);

  // ── İzin taleplerini personele göre indeksle ──
  const leaveByPersonnel = useMemo(() => {
    const map: Record<string, LeaveRequest[]> = {};
    leaveRequests.forEach(leave => {
      if (!map[leave.personnelId]) map[leave.personnelId] = [];
      map[leave.personnelId].push(leave);
    });
    return map;
  }, [leaveRequests]);

  // ── Günlük izinleri tarihe göre indeksle ──
  // dailyOnLeave: { "2026-03-13": ["staffId1", "staffId2"] }
  const dailyByDate = useMemo(() => dailyOnLeave, [dailyOnLeave]);

  // ── Hücre hesaplama ──────────────────────
  const computeCell = useCallback((
    staff: StaffMember,
    dateStr: string,
  ): CellData => {
    // 1. Görev var mı?
    const dayTasks = tasksByDate[dateStr] || [];
    const myTask = dayTasks.find(t =>
      t.personnel.some(p => p.id === staff.id)
    );
    if (myTask) {
      return {
        status: 'work',
        locationName: myTask.location,
        locationIcon: myTask.locationIcon,
        startTime: myTask.startTime,
        endTime: myTask.endTime,
        taskType: myTask.taskType,
      };
    }

    // 2. Onaylı izin: status === 'on_leave'
    if (staff.status === 'on_leave') {
      return {
        status: 'approved_leave',
        leaveSource: 'status',
      };
    }

    // 3. Onaylı izin talebi
    const myLeaves = leaveByPersonnel[staff.id] || [];
    const approvedLeave = myLeaves.find(l =>
      l.status === 'approved' && leaveCoversDate(l, dateStr)
    );
    if (approvedLeave) {
      return {
        status: 'approved_leave',
        leaveSource: 'approved_request',
        leaveType: approvedLeave.type,
        leaveNotes: approvedLeave.notes,
      };
    }

    // 4. Günlük izin
    const dayDailyIds = dailyByDate[dateStr] || [];
    if (dayDailyIds.includes(staff.id)) {
      return { status: 'daily_leave', leaveSource: 'daily' };
    }

    // 5. Bekleyen izin talebi
    const pendingLeave = myLeaves.find(l =>
      l.status === 'pending' && leaveCoversDate(l, dateStr)
    );
    if (pendingLeave) {
      return {
        status: 'pending_leave',
        pendingLeaveType: pendingLeave.type,
        pendingNotes: pendingLeave.notes,
      };
    }

    // 6. O gün rotasyon oluşturulmuş ama bu kişi atanmamış → Kayıtsız
    if (dayTasks.length > 0) {
      return { status: 'unassigned' };
    }

    return { status: 'empty' };
  }, [tasksByDate, leaveByPersonnel, dailyByDate]);

  // ── Matris (memo ile) ────────────────────
  const matrix = useMemo(() => {
    return filteredStaff.map(staff => ({
      staff,
      cells: dayColumns.map(col => computeCell(staff, col.dateStr)),
    }));
  }, [filteredStaff, dayColumns, computeCell]);

  // ── Özet hesaplama ───────────────────────
  const summaries = useMemo(() => {
    return matrix.map(row => {
      let work = 0, leave = 0, pending = 0, unassigned = 0;
      row.cells.forEach(c => {
        if (c.status === 'work') work++;
        else if (c.status === 'approved_leave' || c.status === 'daily_leave') leave++;
        else if (c.status === 'pending_leave') pending++;
        else if (c.status === 'unassigned') unassigned++;
      });
      return { work, leave, pending, unassigned };
    });
  }, [matrix]);

  // ── Popup handler ────────────────────────
  const handleCellClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    staff: StaffMember,
    dateStr: string,
    cell: CellData,
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopup({ staff, date: dateStr, cell, rect });
  };

  // ── Bugünün tarihi ──────────────────────
  const todayStr = toISO(today);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--app-bg, linear-gradient(170deg, #0f0620 0%, #1a0a3c 50%, #0a0515 100%))' }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-4 pt-10 pb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => onNavigate('business-panel')}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-black text-lg tracking-tight leading-none">
              İzin Çizelgesi
            </h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              Aylık personel izin ve çalışma görünümü
            </p>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 8px rgba(251,191,36,0.2)' }}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {loading
              ? <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
              : <RefreshCw className="w-4 h-4 text-white/50" />
            }
          </button>
        </div>

        {/* Ay gezgini */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft className="w-4 h-4 text-white/60" />
          </button>
          <span className="text-white font-bold text-base">
            {MONTHS_TR[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ChevronRight className="w-4 h-4 text-white/60" />
          </button>
        </div>
      </div>

      {/* ── Arama ── */}
      <div className="flex-shrink-0 px-4 py-2.5">
        <div
          className="flex items-center gap-2 rounded-xl px-3"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            height: 38,
          }}
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0 text-white/35" />
          <input
            type="text"
            placeholder="Personel ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-white placeholder-white/30"
            style={{ fontSize: 13 }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X className="w-3.5 h-3.5 text-white/35" />
            </button>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex-shrink-0 pb-2">
        <Legend />
      </div>

      {/* ── Table area ── */}
      {loading && staffList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-ta animate-spin" />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Yükleniyor...</span>
          </div>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Users className="w-10 h-10 text-white/15" />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              {searchQuery ? 'Arama sonucu bulunamadı' : 'Personel bulunamadı'}
            </span>
          </div>
        </div>
      ) : (
        <div
          ref={tableScrollRef}
          className="flex-1 overflow-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <table
            style={{
              borderCollapse: 'separate',
              borderSpacing: 0,
              minWidth: 'max-content',
              width: '100%',
            }}
          >
            {/* ── Thead ── */}
            <thead>
              <tr>
                {/* İsim kolonu başlığı — sticky sol */}
                <th
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 30,
                    background: 'var(--app-bg, linear-gradient(170deg, #120830 0%, #1a0a3c 100%))',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    padding: '6px 10px',
                    minWidth: 120,
                    textAlign: 'left',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.06em' }}>
                      PERSONEL
                    </span>
                  </div>
                </th>

                {/* Gün sütunları */}
                {dayColumns.map(col => {
                  const isToday = col.dateStr === todayStr;
                  const isWeekend = col.dayOfWeek === 0 || col.dayOfWeek === 6;
                  return (
                    <th
                      key={col.dateStr}
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 20,
                        background: isToday
                          ? 'rgba(var(--app-accent-rgb),0.15)'
                          : 'linear-gradient(170deg, #120830 0%, #1a0a3c 100%)',
                        borderBottom: `1px solid ${isToday ? 'rgba(var(--app-accent-rgb),0.4)' : 'rgba(255,255,255,0.07)'}`,
                        padding: '4px 2px',
                        minWidth: 30,
                        width: 30,
                        textAlign: 'center',
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <span
                          style={{
                            fontSize: 9,
                            color: isWeekend
                              ? 'rgba(248,113,113,0.7)'
                              : 'rgba(255,255,255,0.3)',
                            lineHeight: 1,
                            marginBottom: 1,
                          }}
                        >
                          {DAYS_TR[col.dayOfWeek]}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: isToday ? 800 : 600,
                            color: isToday ? 'var(--app-accent, #a855f7)' : isWeekend ? 'rgba(248,113,113,0.8)' : 'rgba(255,255,255,0.6)',
                            lineHeight: 1,
                          }}
                        >
                          {col.day}
                        </span>
                      </div>
                    </th>
                  );
                })}

                {/* Özet kolonu başlığı */}
                <th
                  style={{
                    position: 'sticky',
                    right: 0,
                    zIndex: 30,
                    background: 'var(--app-bg, linear-gradient(170deg, #120830 0%, #1a0a3c 100%))',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    padding: '6px 8px',
                    minWidth: 72,
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.05em' }}>
                    ÖZET
                  </span>
                </th>
              </tr>
            </thead>

            {/* ── Tbody ── */}
            <tbody>
              {matrix.map((row, rowIdx) => {
                const summary = summaries[rowIdx];
                const isEven = rowIdx % 2 === 0;
                return (
                  <tr key={row.staff.id}>
                    {/* İsim hücresi — sticky sol */}
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        background: isEven
                          ? 'rgba(15,6,32,0.97)'
                          : 'rgba(26,10,60,0.97)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        borderRight: '1px solid rgba(255,255,255,0.08)',
                        padding: '5px 10px',
                        minWidth: 120,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{row.staff.avatar}</span>
                        <div className="min-w-0">
                          <p
                            className="truncate font-semibold text-white"
                            style={{ fontSize: 11, maxWidth: 84 }}
                          >
                            {toTitleCase(row.staff.name)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Hücre sütunları */}
                    {row.cells.map((cell, colIdx) => {
                      const col = dayColumns[colIdx];
                      const isToday = col.dateStr === todayStr;
                      const isWeekend = col.dayOfWeek === 0 || col.dayOfWeek === 6;
                      return (
                        <td
                          key={col.dateStr}
                          style={{
                            background: isToday
                              ? 'rgba(var(--app-accent-rgb),0.07)'
                              : isEven
                                ? 'rgba(15,6,32,0.6)'
                                : 'rgba(26,10,60,0.6)',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            padding: '3px 2px',
                            textAlign: 'center',
                          }}
                        >
                          <Cell
                            cell={cell}
                            onClick={e => handleCellClick(e, row.staff, col.dateStr, cell)}
                          />
                        </td>
                      );
                    })}

                    {/* Özet hücresi — sticky sağ */}
                    <td
                      style={{
                        position: 'sticky',
                        right: 0,
                        zIndex: 10,
                        background: isEven
                          ? 'rgba(15,6,32,0.97)'
                          : 'rgba(26,10,60,0.97)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        borderLeft: '1px solid rgba(255,255,255,0.08)',
                        padding: '3px 6px',
                        minWidth: 72,
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
                          <span style={{ fontSize: 10, color: '#86efac', fontWeight: 700, minWidth: 14, textAlign: 'right' }}>
                            {summary.work}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                          <span style={{ fontSize: 10, color: '#fca5a5', fontWeight: 700, minWidth: 14, textAlign: 'right' }}>
                            {summary.leave}
                          </span>
                        </div>
                        {summary.unassigned > 0 && (
                          <div className="flex items-center justify-between gap-1">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#3b82f6' }} />
                            <span style={{ fontSize: 10, color: '#93c5fd', fontWeight: 700, minWidth: 14, textAlign: 'right' }}>
                              {summary.unassigned}
                            </span>
                          </div>
                        )}
                        {summary.pending > 0 && (
                          <div className="flex items-center justify-between gap-1">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#eab308' }} />
                            <span style={{ fontSize: 10, color: '#fde047', fontWeight: 700, minWidth: 14, textAlign: 'right' }}>
                              {summary.pending}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Personel sayısı ── */}
      <div
        className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
          {filteredStaff.length} personel · {daysInMonth} gün
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
          {MONTHS_TR[month]} {year}
        </span>
      </div>

      {/* ── Detay Popup ── */}
      {popup && (
        <CellPopup
          info={popup}
          onClose={() => setPopup(null)}
        />
      )}

      {/* ── Rehber Modal ── */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setShowGuide(false)}>
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-ta" /> İzin Çizelgesi Rehberi
                </h3>
                <button onClick={() => setShowGuide(false)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="p-4 space-y-4 text-[12px] leading-relaxed text-white/70">

                <div>
                  <h4 className="text-[13px] font-bold text-white mb-1.5">📅 Genel Bakış</h4>
                  <p>Bu sayfa, tüm personelin aylık izin ve çalışma durumunu tek ekranda gösterir.</p>
                  <p className="mt-1">• Satırlar: personel listesi</p>
                  <p>• Sütunlar: ayın günleri (1–31)</p>
                  <p>• Her hücre bir <span className="text-ta font-semibold">renk kodu</span> ile o günün durumunu gösterir</p>
                  <p>• Sağ taraftaki <span className="text-ta font-semibold">ÖZET</span> sütununda personelin o ayki toplam izin ve çalışma sayısı yer alır</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">🎨 Renk Kodları</h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: '#22c55e' }} />
                      <span><span className="text-emerald-400 font-semibold">Yeşil — Çalışıyor:</span> O gün rotasyonda göreve atanmış</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: '#ef4444' }} />
                      <span><span className="text-red-400 font-semibold">Kırmızı — Onaylı İzin:</span> İzin talebi onaylanmış</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: '#f97316' }} />
                      <span><span className="text-orange-400 font-semibold">Turuncu — Günlük İzin:</span> Yönetici tarafından o güne izinli işaretlenmiş</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: '#eab308' }} />
                      <span><span className="text-yellow-400 font-semibold">Sarı — Bekleyen İzin:</span> İzin talebi henüz onaylanmamış</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: '#3b82f6' }} />
                      <span><span className="text-blue-400 font-semibold">Mavi — Kayıtsız:</span> Ne görev atanmış ne izin var — rotasyon dışı</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">👆 Hücreye Tıklama</h4>
                  <p>Herhangi bir renkli hücreye tıkladığınızda detay popup'ı açılır:</p>
                  <p className="mt-1">• <span className="text-emerald-400 font-semibold">Yeşil hücre:</span> Hangi mekan, saat aralığı, görev tipi</p>
                  <p>• <span className="text-red-400 font-semibold">Kırmızı/Turuncu:</span> İzin türü (yıllık, sağlık, kişisel) ve varsa not</p>
                  <p>• <span className="text-yellow-400 font-semibold">Sarı:</span> Bekleyen izin talebi detayı</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">🔍 Arama & Navigasyon</h4>
                  <p>• Üstteki arama kutusundan personel adına göre filtreleme yapabilirsiniz</p>
                  <p>• <span className="text-ta font-semibold">← →</span> oklarıyla aylar arasında geçiş yapabilirsiniz</p>
                  <p>• Bugünkü gün sütunu <span className="text-amber-400 font-semibold">vurgulanmış</span> olarak gösterilir</p>
                  <p>• Tablo yatay kaydırılabilir — parmağınızla sola/sağa kaydırın</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">⚡ İpuçları</h4>
                  <p>• <span className="text-blue-400 font-semibold">Mavi</span> hücre çok olan personel rotasyona yeterince dahil edilmemiş demektir</p>
                  <p>• Bir personelin <span className="text-red-400 font-semibold">kırmızı</span> günleri fazlaysa izin hakkını kontrol edin</p>
                  <p>• Hafta sonları dahil tüm günler gösterilir — çalışma planını buna göre değerlendirin</p>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}