import { useState, useEffect } from 'react';
import { X, Calendar, User, FileText, AlertCircle } from 'lucide-react';
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
  currentUserId?: string; // Current logged-in user ID
  userName?: string; // Current logged-in user name
  editingLeave?: LeaveRequest | null;
  onClose: () => void;
}

export function RotationLeaveModal({
  isOpen,
  staffMembers,
  userRole,
  currentUserId = '',
  userName = '',
  editingLeave = null,
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

  // Permission checks
  const showStaffSelector = shouldShowStaffSelector(userRole);
  const availableStaff = getAvailableStaffForLeave(userRole, staffMembers);

  // Auto-select current user for personel/idari roles
  useEffect(() => {
    if (!showStaffSelector && !editingLeave) {
      if (currentUserId) {
        // 1️⃣ Önce doğrudan ID eşleşmesi dene
        const foundById = staffMembers.find(s => s.id === currentUserId);
        if (foundById) {
          setPersonnelId(currentUserId);
          return;
        }
        
        // 2️⃣ ID eşleşmedi - isim bazlı ara
        if (userName) {
          const foundByName = staffMembers.find(s => s.name === userName);
          if (foundByName) {
            setPersonnelId(foundByName.id);
            return;
          }
        }
        
        // 3️⃣ İsim de eşleşmedi - rol bazlı ilk kullanıcıyı seç
        const foundByRole = staffMembers.find(s => s.role === userRole);
        if (foundByRole) {
          setPersonnelId(foundByRole.id);
          return;
        }
      } else if (staffMembers.length > 0) {
        // currentUserId yoksa rol bazlı bul
        const currentUser = staffMembers.find(s => s.role === userRole);
        if (currentUser) {
          setPersonnelId(currentUser.id);
        }
      }
    }
  }, [showStaffSelector, editingLeave, currentUserId, staffMembers, userRole, userName]);

  // Gün sayısını hesapla
  const calculateDays = () => {
    if (!startDate) return 0;
    
    const start = new Date(startDate);
    const end = durationType === 'single' ? start : (endDate ? new Date(endDate) : start);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return diffDays;
  };

  const handleSave = () => {
    // Validation
    if (!personnelId) {
      setShowWarning('Personel seçiniz!');
      return;
    }

    if (!startDate) {
      setShowWarning('Tarih seçiniz!');
      return;
    }

    if (durationType === 'multiple' && !endDate) {
      setShowWarning('Bitiş tarihi giriniz!');
      return;
    }

    const start = new Date(startDate);
    const end = durationType === 'single' ? start : new Date(endDate);

    if (end < start) {
      setShowWarning('Bitiş tarihi başlangıç tarihinden önce olamaz!');
      return;
    }

    // Calculate days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days

    // Get personnel info
    const personnel = staffMembers.find(s => s.id === personnelId);
    
    if (!personnel) {
      setShowWarning('Personel bulunamadı!');
      return;
    }

    if (editingLeave) {
      // UPDATE mode - düzenleme yapılıyor
      const updatedLeave: Partial<LeaveRequest> = {
        personnelId: personnel.id,
        personnelName: personnel.name,
        personnelAvatar: personnel.avatar,
        personnelRole: personnel.role,
        startDate,
        endDate: durationType === 'single' ? startDate : endDate,
        days: diffDays,
        type: leaveType,
        notes: notes.trim(),
        status: 'pending', // Status pending'e döner (tekrar onaylanmalı)
      };

      updateLeaveRequest(editingLeave.id, updatedLeave);
    } else {
      // CREATE mode - yeni izin talebi oluşturuluyor
      const newLeave: LeaveRequest = {
        id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        personnelId: personnel.id,
        personnelName: personnel.name,
        personnelAvatar: personnel.avatar,
        personnelRole: personnel.role,
        startDate,
        endDate: durationType === 'single' ? startDate : endDate,
        days: diffDays,
        type: leaveType,
        notes: notes.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      saveLeaveRequest(newLeave);
    }

    // Reset form
    setPersonnelId('');
    setDurationType('single');
    setStartDate('');
    setEndDate('');
    setLeaveType('personal');
    setNotes('');
    setShowWarning('');

    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[120]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-white/20 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              {editingLeave ? '✏️ İzin Talebini Düzenle' : '🏖️ İzin Talebi Oluştur'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Warning Message */}
          <AnimatePresence>
            {showWarning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 bg-red-500/20 border-2 border-red-500/40 rounded-xl flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm font-semibold text-red-300">{showWarning}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <div className="space-y-5">
            {/* Personnel Selection - Only for authorized roles */}
            {showStaffSelector ? (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Personel Seçimi *
                </label>
                <select
                  value={personnelId}
                  onChange={(e) => setPersonnelId(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea] appearance-none"
                >
                  <option value="" className="bg-gray-800">Personel Seçiniz</option>
                  {availableStaff.map((staff) => (
                    <option key={staff.id} value={staff.id} className="bg-gray-800">
                      {staff.avatar} {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              // Hidden field for personel/idari - shows selected user
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  İzin Talebi
                </label>
                <div className="px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-gray-400">
                  {personnelId ? (
                    <>
                      {staffMembers.find(s => s.id === personnelId)?.avatar}{' '}
                      {staffMembers.find(s => s.id === personnelId)?.name || userName}
                    </>
                  ) : (
                    <>👤 {userName || 'Kendim için'}</>
                  )}
                </div>
              </div>
            )}

            {/* Duration Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                İzin Süresi *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setDurationType('single');
                    setEndDate('');
                  }}
                  className={`py-2 px-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    durationType === 'single'
                      ? 'bg-[#9dd9ea] text-[#2d3748]'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  📅 1 Günlük
                </button>
                <button
                  onClick={() => setDurationType('multiple')}
                  className={`py-2 px-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    durationType === 'multiple'
                      ? 'bg-[#9dd9ea] text-[#2d3748]'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  📅📅 Birden Fazla Gün
                </button>
              </div>
            </div>

            {/* Date Selection - Single or Range */}
            {durationType === 'single' ? (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  İzin Tarihi *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Başlangıç *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Bitiş *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea]"
                  />
                </div>
              </div>
            )}

            {/* Days Count Display */}
            {startDate && (
              <div className="text-center py-2 px-4 bg-[#9dd9ea]/20 border-2 border-[#9dd9ea]/40 rounded-xl">
                <span className="text-[#9dd9ea] font-bold text-lg">
                  📅 {calculateDays()} günlük izin
                </span>
              </div>
            )}

            {/* Leave Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                İzin Tipi *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setLeaveType('annual')}
                  className={`py-2 px-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    leaveType === 'annual'
                      ? 'bg-[#9dd9ea] text-[#2d3748]'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  Yıllık
                </button>
                <button
                  onClick={() => setLeaveType('sick')}
                  className={`py-2 px-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    leaveType === 'sick'
                      ? 'bg-[#9dd9ea] text-[#2d3748]'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  Hastalık
                </button>
                <button
                  onClick={() => setLeaveType('personal')}
                  className={`py-2 px-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    leaveType === 'personal'
                      ? 'bg-[#9dd9ea] text-[#2d3748]'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  Kişisel
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Notlar (Opsiyonel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="İzin talebi ile ilgili notlar..."
                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#9dd9ea] resize-none"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-600/50 border-2 border-gray-500/30 text-gray-200 rounded-xl font-semibold hover:bg-gray-600/70 transition-all active:scale-95"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
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