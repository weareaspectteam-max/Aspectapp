import { useState, useEffect } from 'react';
import { X, Calendar, User, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  saveLeaveRequest,
  updateLeaveRequest,
  shouldShowStaffSelector,
  getAvailableStaffForLeave,
  type StaffMember,
  type LeaveRequest,
  type UserRole,
} from '../services/rotation-service';

interface RotationLeaveModalProps {
  isOpen: boolean;
  staffMembers: StaffMember[];
  userRole: UserRole;
  currentUserId?: string;
  userName?: string;
  editingLeave?: LeaveRequest | null;
  accessToken: string;
  onClose: () => void;
}

export function RotationLeaveModal({
  isOpen,
  staffMembers,
  userRole,
  currentUserId = '',
  userName = '',
  editingLeave = null,
  accessToken,
  onClose,
}: RotationLeaveModalProps) {
  const [personnelId, setPersonnelId] = useState<string>(editingLeave?.personnelId || '');
  const [durationType, setDurationType] = useState<'single' | 'multiple'>(() => {
    if (!editingLeave) return 'single';
    return editingLeave.startDate === editingLeave.endDate ? 'single' : 'multiple';
  });
  const [startDate, setStartDate] = useState<string>(editingLeave?.startDate || '');
  const [endDate, setEndDate] = useState<string>(editingLeave?.endDate || '');
  const [leaveType, setLeaveType] = useState<'annual' | 'sick' | 'personal'>(editingLeave?.type || 'personal');
  const [notes, setNotes] = useState<string>(editingLeave?.notes || '');
  const [showWarning, setShowWarning] = useState<string>('');

  const showStaffSelector = shouldShowStaffSelector(userRole);
  const availableStaff = getAvailableStaffForLeave(userRole, staffMembers);

  useEffect(() => {
    if (!showStaffSelector && !editingLeave) {
      if (currentUserId) {
        const foundById = staffMembers.find(s => s.id === currentUserId);
        if (foundById) { setPersonnelId(currentUserId); return; }
        if (userName) {
          const foundByName = staffMembers.find(s => s.name === userName);
          if (foundByName) { setPersonnelId(foundByName.id); return; }
        }
        const foundByRole = staffMembers.find(s => s.role === userRole);
        if (foundByRole) { setPersonnelId(foundByRole.id); return; }
      } else if (staffMembers.length > 0) {
        const currentUser = staffMembers.find(s => s.role === userRole);
        if (currentUser) setPersonnelId(currentUser.id);
      }
    }
  }, [showStaffSelector, editingLeave, currentUserId, staffMembers, userRole, userName]);

  const calculateDays = () => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const end = durationType === 'single' ? start : (endDate ? new Date(endDate) : start);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleSave = async () => {
    if (!personnelId) { setShowWarning('Personel seçiniz!'); return; }
    if (!startDate) { setShowWarning('Tarih seçiniz!'); return; }
    if (durationType === 'multiple' && !endDate) { setShowWarning('Bitiş tarihi giriniz!'); return; }

    const start = new Date(startDate);
    const end = durationType === 'single' ? start : new Date(endDate);
    if (end < start) { setShowWarning('Bitiş tarihi başlangıç tarihinden önce olamaz!'); return; }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const personnel = staffMembers.find(s => s.id === personnelId);
    if (!personnel) { setShowWarning('Personel bulunamadı!'); return; }

    if (editingLeave) {
      await updateLeaveRequest(editingLeave.id, {
        personnelId: personnel.id, personnelName: personnel.name,
        personnelAvatar: personnel.avatar, personnelRole: personnel.role,
        startDate, endDate: durationType === 'single' ? startDate : endDate,
        days: diffDays, type: leaveType, notes: notes.trim(), status: 'pending',
      }, accessToken);
    } else {
      await saveLeaveRequest({
        id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        personnelId: personnel.id, personnelName: personnel.name,
        personnelAvatar: personnel.avatar, personnelRole: personnel.role,
        startDate, endDate: durationType === 'single' ? startDate : endDate,
        days: diffDays, type: leaveType, notes: notes.trim(),
        status: 'pending', createdAt: new Date().toISOString(),
      }, accessToken);
    }

    setPersonnelId(''); setDurationType('single'); setStartDate('');
    setEndDate(''); setLeaveType('personal'); setNotes(''); setShowWarning('');
    onClose();
  };

  if (!isOpen) return null;

  // Ortak input sınıfı
  const inputCls = 'w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/25 focus:bg-white/8 transition-all placeholder-white/25';
  const labelCls = 'flex items-center gap-1.5 text-[11px] font-semibold text-white/45 uppercase tracking-wide mb-1.5';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-[120]"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          onClick={e => e.stopPropagation()}
          className="w-full sm:max-w-sm bg-[rgba(10,5,30,0.96)] border border-white/12 rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
          style={{ backdropFilter: 'blur(24px)' }}
        >
          {/* Üstte çekme çubuğu (sadece mobil) */}
          <div className="flex justify-center pt-3 pb-0 sm:hidden">
            <div className="w-10 h-1 bg-white/15 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center">
                <span className="text-lg">{editingLeave ? '✏️' : '🏖️'}</span>
              </div>
              <div>
                <h2 className="text-sm font-black text-white leading-tight">
                  {editingLeave ? 'İzin Talebini Düzenle' : 'İzin Talebi Oluştur'}
                </h2>
                <p className="text-[10px] text-white/35 leading-tight">Vardiya yönetimi</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/8 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Uyarı */}
            <AnimatePresence>
              {showWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 px-3 py-2.5 bg-red-500/12 border border-red-500/25 rounded-xl"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-red-300">{showWarning}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Personel Seçimi */}
            {showStaffSelector ? (
              <div>
                <label className={labelCls}>
                  <User className="w-3 h-3" /> Personel Seçimi *
                </label>
                <select
                  value={personnelId}
                  onChange={e => setPersonnelId(e.target.value)}
                  className={inputCls + ' appearance-none'}
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="" style={{ background: '#0a051e' }}>Personel Seçiniz</option>
                  {availableStaff.map(staff => (
                    <option key={staff.id} value={staff.id} style={{ background: '#0a051e' }}>
                      {staff.avatar} {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className={labelCls}>
                  <User className="w-3 h-3" /> Personel Seçimi
                </label>
                <div className="px-3 py-2.5 bg-white/4 border border-white/8 rounded-xl text-sm text-white/50">
                  {personnelId ? (
                    <>{staffMembers.find(s => s.id === personnelId)?.avatar}{' '}
                    {staffMembers.find(s => s.id === personnelId)?.name || userName}</>
                  ) : (
                    <>👤 {userName || 'Kendim için'}</>
                  )}
                </div>
              </div>
            )}

            {/* İzin Süresi */}
            <div>
              <label className={labelCls}>
                <Calendar className="w-3 h-3" /> İzin Süresi *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setDurationType('single'); setEndDate(''); }}
                  className={`py-2.5 px-2 rounded-xl font-semibold text-xs transition-all active:scale-95 border ${
                    durationType === 'single'
                      ? 'bg-white/15 border-white/25 text-white'
                      : 'bg-white/4 border-white/8 text-white/45 hover:bg-white/8 hover:text-white/70'
                  }`}
                >
                  📅 1 Günlük
                </button>
                <button
                  onClick={() => setDurationType('multiple')}
                  className={`py-2.5 px-2 rounded-xl font-semibold text-xs transition-all active:scale-95 border ${
                    durationType === 'multiple'
                      ? 'bg-white/15 border-white/25 text-white'
                      : 'bg-white/4 border-white/8 text-white/45 hover:bg-white/8 hover:text-white/70'
                  }`}
                >
                  📅📅 Birden Fazla Gün
                </button>
              </div>
            </div>

            {/* Tarih Seçimi */}
            {durationType === 'single' ? (
              <div>
                <label className={labelCls}>
                  <Calendar className="w-3 h-3" /> İzin Tarihi *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className={inputCls}
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>
                    <Calendar className="w-3 h-3" /> Başlangıç *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-white/25 transition-all"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <Calendar className="w-3 h-3" /> Bitiş *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-white/25 transition-all"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            )}

            {/* Gün Sayısı */}
            {startDate && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 py-2 px-4 bg-white/5 border border-white/10 rounded-xl"
              >
                <CheckCircle className="w-3.5 h-3.5 text-white/40" />
                <span className="text-sm font-bold text-white/70">
                  {calculateDays()} günlük izin
                </span>
              </motion.div>
            )}

            {/* İzin Tipi */}
            <div>
              <label className={labelCls}>
                <FileText className="w-3 h-3" /> İzin Tipi *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['annual', 'sick', 'personal'] as const).map(type => {
                  const labels = { annual: '🏖️ Yıllık', sick: '🤒 Hastalık', personal: '🎯 Kişisel' };
                  return (
                    <button
                      key={type}
                      onClick={() => setLeaveType(type)}
                      className={`py-2.5 rounded-xl font-semibold text-xs transition-all active:scale-95 border ${
                        leaveType === type
                          ? 'bg-white/15 border-white/25 text-white'
                          : 'bg-white/4 border-white/8 text-white/45 hover:bg-white/8 hover:text-white/70'
                      }`}
                    >
                      {labels[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notlar */}
            <div>
              <label className={labelCls}>
                Notlar (Opsiyonel)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="İzin talebi ile ilgili notlar..."
                className={inputCls + ' resize-none'}
                rows={3}
              />
            </div>

            {/* Aksiyon Butonları */}
            <div className="flex gap-2 pt-1 pb-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 border border-white/10 text-white/55 rounded-xl font-semibold text-sm hover:bg-white/10 hover:text-white/75 transition-all active:scale-95"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-white/12 border border-white/20 text-white font-bold text-sm rounded-xl hover:bg-white/18 transition-all active:scale-95"
              >
                İlet
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
