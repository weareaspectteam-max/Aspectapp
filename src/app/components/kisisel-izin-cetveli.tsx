/**
 * KisiselIzinCetveli — Kişisel İzin Çizelgesi
 * Kullanıcının kendi izin geçmişini ay bazlı gösteren sayfa.
 * Bu ay ve bir önceki ay görüntülenebilir (daha eskiye ve ileriye gidilemez).
 * 3 kaynak: status === 'on_leave', onaylı rotation_leave_, rotation_daily_onleave
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getLeaveRequests,
  getDailyOnLeave,
  getStaffMembers,
  deleteLeaveRequest,
  type LeaveRequest,
} from '../services/rotation-service';
import type { UserRole } from './login';

// ─── Types ────────────────────────────────────────────────────────────────────

type DayStatus = 'work' | 'approved_leave' | 'daily_leave' | 'status_leave' | 'pending' | 'future' | 'empty';

interface DayData {
  date: string; // YYYY-MM-DD
  dayNum: number;
  status: DayStatus;
  leaveType?: 'annual' | 'sick' | 'personal';
  source?: 'approved_request' | 'daily' | 'status';
  leaveId?: string;
  notes?: string;
}

interface MonthData {
  year: number;
  month: number; // 0-indexed
  days: DayData[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface KisiselIzinCetveliProps {
  userName: string;
  userId: string;
  userRole: UserRole;
  accessToken?: string;
  onBack: () => void;
  onNavigate?: (tab: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const TR_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayStr(): string {
  // Türkiye saati (UTC+3) ile bugünün tarihini al
  const d = new Date();
  const trOffset = 3 * 60; // dakika
  const local = new Date(d.getTime() + (trOffset - d.getTimezoneOffset()) * 60000);
  return local.toISOString().split('T')[0];
}

// Ayın ilk gününün ISO haftanın günü (0=Pzt, 6=Paz)
function firstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay(); // 0=Sun
  return (d + 6) % 7; // Pazartesi = 0
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KisiselIzinCetveli({ userName, userId, userRole: _userRole, accessToken, onBack, onNavigate }: KisiselIzinCetveliProps) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;

  // Başlangıç: bu ay
  const [viewYear, setViewYear] = useState(thisYear);
  const [viewMonth, setViewMonth] = useState(thisMonth);

  const [loading, setLoading] = useState(true);
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Navigasyon sınırları
  const isCurrentMonth = viewYear === thisYear && viewMonth === thisMonth;
  const isPrevMonth = viewYear === prevYear && viewMonth === prevMonth;
  const canGoBack = !isPrevMonth; // en fazla 1 ay geri
  const canGoForward = !isCurrentMonth; // en fazla bu ay

  const goBack = () => {
    if (!canGoBack) return;
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };

  const goForward = () => {
    if (!canGoForward) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leaves, dailyOnLeave, staffMembers] = await Promise.all([
        getLeaveRequests(accessToken),
        getDailyOnLeave(accessToken),
        getStaffMembers(accessToken),
      ]);

      const today = todayStr();
      const staffMember = staffMembers.find(s => s.id === userId);
      const isStatusOnLeave = staffMember?.status === 'on_leave';

      // Kullanıcıya ait izin talepleri
      const matchLeave = (l: LeaveRequest) => {
        if (userId && l.personnelId === userId) return true;
        const nameLower = l.personnelName.toLowerCase().trim();
        const userLower = userName.toLowerCase().trim();
        return nameLower === userLower ||
          (nameLower.split(' ')[0] === userLower.split(' ')[0] &&
           nameLower.split(' ').pop() === userLower.split(' ').pop());
      };

      const myLeaves      = leaves.filter(matchLeave);
      const approvedLeaves = myLeaves.filter(l => l.status === 'approved');
      const pendingLeaves  = myLeaves.filter(l => l.status === 'pending');

      const totalDays = daysInMonth(viewYear, viewMonth);
      const days: DayData[] = [];

      for (let d = 1; d <= totalDays; d++) {
        const dateStr = toDateStr(viewYear, viewMonth, d);
        const isFuture = dateStr > today;
        const isToday = dateStr === today;

        if (isFuture) {
          // Gelecek: bekleyen varsa göster, yoksa boş
          const pendingLeave = pendingLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
          days.push({
            date: dateStr, dayNum: d,
            status: pendingLeave ? 'pending' : 'future',
            leaveType: pendingLeave?.type,
            leaveId: pendingLeave?.id,
            notes: pendingLeave?.notes,
          });
          continue;
        }

        // Geçmiş veya bugün

        // Kaynak 1: Onaylı izin talebi
        const approvedLeave = approvedLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
        if (approvedLeave) {
          days.push({
            date: dateStr, dayNum: d,
            status: 'approved_leave',
            leaveType: approvedLeave.type,
            source: 'approved_request',
            leaveId: approvedLeave.id,
            notes: approvedLeave.notes,
          });
          continue;
        }

        // Kaynak 2: Günlük manuel izin
        const inDaily = Array.isArray(dailyOnLeave[dateStr]) && dailyOnLeave[dateStr].includes(userId);
        if (inDaily) {
          days.push({
            date: dateStr, dayNum: d,
            status: 'daily_leave',
            source: 'daily',
          });
          continue;
        }

        // Kaynak 3: status === 'on_leave' — sadece bugün için güvenilir
        if (isToday && isStatusOnLeave) {
          days.push({
            date: dateStr, dayNum: d,
            status: 'status_leave',
            source: 'status',
          });
          continue;
        }

        // Bekleyen izin talebi (bugün veya geçmiş — henüz yanıt verilmemiş)
        const pendingLeave = pendingLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
        if (pendingLeave) {
          days.push({
            date: dateStr, dayNum: d,
            status: 'pending',
            leaveType: pendingLeave.type,
            leaveId: pendingLeave.id,
            notes: pendingLeave.notes,
          });
          continue;
        }

        days.push({ date: dateStr, dayNum: d, status: 'work' });
      }

      setMonthData({ year: viewYear, month: viewMonth, days });
    } catch (err) {
      console.error('KisiselIzinCetveli load error:', err);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth, userId, userName, accessToken]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCancelPending = async (leaveId: string) => {
    setDeletingId(leaveId);
    const ok = await deleteLeaveRequest(leaveId);
    if (ok) { await loadData(); setSelectedDay(null); }
    setDeletingId(null);
  };

  // Özet istatistikler
  const stats = monthData ? (() => {
    const today = todayStr();
    const pastAndToday = monthData.days.filter(d => d.date <= today);
    const approved = pastAndToday.filter(d => d.status === 'approved_leave' || d.status === 'daily_leave' || d.status === 'status_leave').length;
    const work = pastAndToday.filter(d => d.status === 'work').length;
    const pending = monthData.days.filter(d => d.status === 'pending').length;
    return { approved, work, pending };
  })() : { approved: 0, work: 0, pending: 0 };

  function getDayStyle(d: DayData): { bg: string; text: string; border: string; dot?: string } {
    const today = todayStr();
    const isToday = d.date === today;
    switch (d.status) {
      case 'approved_leave':
        return {
          bg: d.leaveType === 'annual' ? 'bg-blue-500/25' : d.leaveType === 'sick' ? 'bg-red-500/25' : 'bg-amber-500/25',
          text: d.leaveType === 'annual' ? 'text-blue-200' : d.leaveType === 'sick' ? 'text-red-200' : 'text-amber-200',
          border: isToday ? 'ring-2 ring-violet-400' : d.leaveType === 'annual' ? 'border border-blue-500/30' : d.leaveType === 'sick' ? 'border border-red-500/30' : 'border border-amber-500/30',
          dot: d.leaveType === 'annual' ? 'bg-blue-400' : d.leaveType === 'sick' ? 'bg-red-400' : 'bg-amber-400',
        };
      case 'daily_leave':
        return { bg: 'bg-teal-500/20', text: 'text-teal-200', border: isToday ? 'ring-2 ring-violet-400' : 'border border-teal-500/30', dot: 'bg-teal-400' };
      case 'status_leave':
        return { bg: 'bg-amber-500/20', text: 'text-amber-200', border: isToday ? 'ring-2 ring-violet-400' : 'border border-amber-500/30', dot: 'bg-amber-400' };
      case 'pending':
        return { bg: 'bg-amber-500/12', text: 'text-amber-300/70', border: isToday ? 'ring-2 ring-violet-400' : 'border border-amber-500/20 border-dashed', dot: 'bg-amber-400/60' };
      case 'future':
        return { bg: 'bg-transparent', text: 'text-white/20', border: 'border border-white/5' };
      default: // work
        return {
          bg: isToday ? 'bg-violet-500/20' : 'bg-white/5',
          text: isToday ? 'text-violet-200' : 'text-white/60',
          border: isToday ? 'ring-2 ring-violet-400' : 'border border-white/8',
        };
    }
  }

  const leaveTypeLabel: Record<string, string> = {
    annual: 'Yıllık İzin', sick: 'Hastalık İzni', personal: 'Mazeret İzni',
  };
  const leaveTypeIcon: Record<string, string> = {
    annual: '🏖️', sick: '🤒', personal: '📋',
  };
  const sourceLabel: Record<string, string> = {
    approved_request: 'Onaylı İzin Talebi',
    daily: 'Günlük Manuel İzin',
    status: 'Sabit İzin Statüsü',
  };

  const firstOffset = monthData ? firstDayOfWeek(monthData.year, monthData.month) : 0;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(10,5,30,0.88)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Kişisel</p>
          <h1 className="text-sm font-black text-white tracking-tight">İzin Çizelgesi</h1>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 pb-28">

        {/* ── Ay Navigasyonu ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-25"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>

          <div className="text-center">
            <p className="text-base font-black text-white">
              {TR_MONTHS[viewMonth]} {viewYear}
            </p>
            {isCurrentMonth && (
              <span className="text-[9px] text-violet-400/70 font-semibold uppercase tracking-widest">Bu Ay</span>
            )}
            {isPrevMonth && (
              <span className="text-[9px] text-white/30 font-semibold uppercase tracking-widest">Geçen Ay</span>
            )}
          </div>

          <button
            onClick={goForward}
            disabled={!canGoForward}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-25"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ChevronRight className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* ── Özet istatistikler ── */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Çalışma', value: stats.work, color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
              { label: 'İzin', value: stats.approved, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
              { label: 'Bekleyen', value: stats.pending, color: stats.pending > 0 ? 'text-amber-300' : 'text-white/25', bg: stats.pending > 0 ? 'bg-amber-500/10' : 'bg-white/5', border: stats.pending > 0 ? 'border-amber-500/20' : 'border-white/8' },
            ].map(item => (
              <div key={item.label} className={`rounded-2xl py-3 px-2 flex flex-col items-center gap-1 border ${item.bg} ${item.border}`}>
                <span className={`text-xl font-black leading-none ${item.color}`}>{item.value}</span>
                <span className="text-[9px] text-white/40 text-center leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Takvim ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : monthData ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${viewYear}-${viewMonth}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Haftanın günleri başlıkları */}
              <div className="grid grid-cols-7 mb-1.5">
                {TR_DAYS_SHORT.map(d => (
                  <div key={d} className="text-center text-[9px] text-white/30 font-semibold uppercase py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Günler grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Boş offsetler */}
                {Array.from({ length: firstOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {monthData.days.map(day => {
                  const style = getDayStyle(day);
                  const isSelected = selectedDay?.date === day.date;
                  return (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`
                        aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5
                        transition-all active:scale-90 relative
                        ${style.bg} ${style.text} ${style.border}
                        ${isSelected ? 'scale-95 ring-2 ring-white/50' : ''}
                        ${day.status === 'future' ? 'cursor-default' : 'cursor-pointer'}
                      `}
                    >
                      <span className="text-[11px] font-bold leading-none">{day.dayNum}</span>
                      {style.dot && day.status !== 'work' && day.status !== 'future' && (
                        <div className={`w-1 h-1 rounded-full ${style.dot}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}

        {/* ── Renk Açıklaması ── */}
        {!loading && (
          <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 space-y-2">
            <p className="text-[9px] text-white/30 uppercase tracking-widest font-semibold mb-2">Açıklama</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { color: 'bg-blue-500/60',    label: 'Yıllık İzin' },
                { color: 'bg-red-500/60',     label: 'Hastalık İzni' },
                { color: 'bg-amber-500/60',   label: 'Mazeret İzni' },
                { color: 'bg-teal-500/60',    label: 'Günlük İzin' },
                { color: 'bg-amber-400/30 border border-amber-500/30 border-dashed', label: 'Bekliyor' },
                { color: 'bg-white/10',       label: 'Çalışma Günü' },
                { color: 'bg-violet-500/25 ring-2 ring-violet-400', label: 'Bugün' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-md flex-shrink-0 ${item.color}`} />
                  <span className="text-[10px] text-white/50">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Seçili Gün Detay ── */}
        <AnimatePresence>
          {selectedDay && selectedDay.status !== 'future' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl border border-white/12 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}
            >
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-white/35 uppercase tracking-widest font-semibold">
                    {new Date(selectedDay.date).toLocaleDateString('tr-TR', { weekday: 'long' })}
                  </p>
                  <p className="text-sm font-bold text-white">
                    {new Date(selectedDay.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/8 text-white/50 hover:bg-white/15 transition-colors text-sm"
                >✕</button>
              </div>

              <div className="px-4 py-3 space-y-2">
                {selectedDay.status === 'work' && (
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💼</span>
                    <div>
                      <p className="text-sm font-semibold text-white/80">Çalışma Günü</p>
                      <p className="text-[10px] text-white/40">Normal mesai</p>
                    </div>
                  </div>
                )}

                {(selectedDay.status === 'approved_leave' || selectedDay.status === 'daily_leave' || selectedDay.status === 'status_leave') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {selectedDay.status === 'approved_leave' ? leaveTypeIcon[selectedDay.leaveType ?? 'annual'] : selectedDay.status === 'daily_leave' ? '🗓️' : '🏖️'}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white/80">
                          {selectedDay.status === 'approved_leave'
                            ? leaveTypeLabel[selectedDay.leaveType ?? 'annual']
                            : selectedDay.status === 'daily_leave'
                            ? 'Günlük Manuel İzin'
                            : 'Mazeret İzni'}
                        </p>
                        <p className="text-[10px] text-white/40">
                          {selectedDay.source ? sourceLabel[selectedDay.source] : ''}
                        </p>
                      </div>
                    </div>
                    {/* Kaynak badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">✓ Onaylanmış</span>
                    </div>
                    {selectedDay.notes && selectedDay.notes !== 'SKIP' && (
                      <p className="text-xs text-white/50 italic">"{selectedDay.notes}"</p>
                    )}
                  </div>
                )}

                {selectedDay.status === 'pending' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{selectedDay.leaveType ? leaveTypeIcon[selectedDay.leaveType] : '📅'}</span>
                      <div>
                        <p className="text-sm font-semibold text-white/80">
                          {selectedDay.leaveType ? leaveTypeLabel[selectedDay.leaveType] : 'İzin Talebi'}
                        </p>
                        <p className="text-[10px] text-amber-400/70">Onay Bekleniyor ⏳</p>
                      </div>
                    </div>
                    {selectedDay.notes && selectedDay.notes !== 'SKIP' && (
                      <p className="text-xs text-white/50 italic">"{selectedDay.notes}"</p>
                    )}
                    {selectedDay.leaveId && (
                      <button
                        onClick={() => handleCancelPending(selectedDay.leaveId!)}
                        disabled={deletingId === selectedDay.leaveId}
                        className="w-full py-2.5 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-red-500/18 transition-colors disabled:opacity-40"
                      >
                        {deletingId === selectedDay.leaveId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : '❌ Talebi İptal Et'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Not ── */}
        {!loading && (
          <p className="text-[9px] text-white/20 text-center leading-relaxed">
            * Yalnızca bu ay ve bir önceki ay görüntülenebilir.<br />
            Geçmiş günler için günlük manuel izinler de kayıtlara yansır.
          </p>
        )}
      </div>
    </div>
  );
}