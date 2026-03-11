import { useState, useEffect } from 'react';
import { X, MapPin, Clock, Users, Check, AlertCircle, Zap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  saveTask,
  updateTask,
  type Task,
  type StaffMember,
  type Location,
  type LeaveRequest,
  type Personnel,
} from '../services/rotation-service';

interface RotationTaskModalProps {
  isOpen: boolean;
  modalType: 'regular_location' | 'extra_special';
  editingTask: Task | null;
  selectedDate: string;
  locations: Location[];
  staffMembers: StaffMember[];
  onLeavePersonnel: StaffMember[];
  leaveRequests: LeaveRequest[];
  dailyOnLeave: Record<string, string[]>;
  preselectedLocation?: string;
  accessToken: string;
  onClose: () => void;
}

export function RotationTaskModal({
  isOpen,
  modalType,
  editingTask,
  selectedDate,
  locations,
  staffMembers,
  onLeavePersonnel,
  leaveRequests,
  dailyOnLeave,
  preselectedLocation = '',
  accessToken,
  onClose,
}: RotationTaskModalProps) {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [locationIcon, setLocationIcon] = useState<string>('📍');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [showWarning, setShowWarning] = useState<string>('');
  const [taskType, setTaskType] = useState<'extra' | 'special'>('special');
  const [showDailyLeaveConfirm, setShowDailyLeaveConfirm] = useState<{
    show: boolean;
    personnelId: string;
    personnelName: string;
  }>({ show: false, personnelId: '', personnelName: '' });

  // ==========================================
  // INITIALIZATION
  // ==========================================

  useEffect(() => {
    if (editingTask) {
      // Populate form with editing task data
      if (modalType === 'regular_location') {
        setSelectedLocation(editingTask.location);
      } else {
        setCustomLocation(editingTask.location);
        setLocationIcon(editingTask.locationIcon);
        // ✅ Set taskType from existing task (extra veya special)
        if (editingTask.taskType === 'extra' || editingTask.taskType === 'special') {
          setTaskType(editingTask.taskType);
        } else {
          // Fallback: ikon'a göre belirle
          setTaskType(editingTask.locationIcon === '⚡' ? 'special' : 'extra');
        }
      }
      setStartTime(editingTask.startTime);
      setEndTime(editingTask.endTime);
      setSelectedPersonnel(editingTask.personnel.map(p => p.id));
      setNotes(editingTask.notes || '');
    } else {
      // Reset form for new task
      if (preselectedLocation && modalType === 'regular_location') {
        setSelectedLocation(preselectedLocation); // ✅ Auto-select location
      } else {
        setSelectedLocation('');
      }
      setCustomLocation('');
      setLocationIcon('📍');
      setStartTime('09:00');
      setEndTime('17:00');
      setSelectedPersonnel([]);
      setNotes('');
      setTaskType('special'); // Default to 'special'
    }
    setShowWarning('');
  }, [editingTask, modalType, isOpen, preselectedLocation]);

  // Auto-set working hours when location is selected
  useEffect(() => {
    if (modalType === 'regular_location' && selectedLocation) {
      const location = locations.find(loc => loc.name === selectedLocation);
      if (location && location.workingHours && !editingTask) {
        setStartTime(location.workingHours.start);
        setEndTime(location.workingHours.end);
      }
    }
  }, [selectedLocation, locations, modalType, editingTask]);

  // ==========================================
  // STAFF ON-LEAVE CHECK (3-LAYER PROTECTION)
  // ==========================================

  const isPersonnelFixedOnLeave = (staff: StaffMember): boolean => {
    // PROTECTION 1: Fixed on-leave status
    if (staff.status === 'on_leave') return true;

    // PROTECTION 2: Approved leave requests (treated as fixed leave)
    const approvedLeave = leaveRequests.find(
      leave =>
        leave.personnelId === staff.id &&
        leave.status === 'approved' &&
        new Date(selectedDate) >= new Date(leave.startDate) &&
        new Date(selectedDate) <= new Date(leave.endDate)
    );
    
    return !!approvedLeave;
  };

  const isPersonnelDailyOnLeave = (staff: StaffMember): boolean => {
    // Daily on-leave (can be called if needed, but with warning)
    const dailyOnLeaveList = dailyOnLeave[selectedDate] || [];
    return dailyOnLeaveList.includes(staff.id);
  };

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleTogglePersonnel = (personnelId: string, isDailyLeave: boolean = false) => {
    const staff = staffMembers.find(s => s.id === personnelId);
    if (!staff) return;

    // If daily leave, show confirmation dialog
    if (isDailyLeave && !selectedPersonnel.includes(personnelId)) {
      setShowDailyLeaveConfirm({
        show: true,
        personnelId: staff.id,
        personnelName: staff.name,
      });
      return;
    }

    // Toggle selection
    setSelectedPersonnel(prev =>
      prev.includes(personnelId)
        ? prev.filter(id => id !== personnelId)
        : [...prev, personnelId]
    );
  };

  const handleConfirmDailyLeave = () => {
    const { personnelId } = showDailyLeaveConfirm;
    setSelectedPersonnel(prev => [...prev, personnelId]);
    setShowDailyLeaveConfirm({ show: false, personnelId: '', personnelName: '' });
  };

  const handleCancelDailyLeave = () => {
    setShowDailyLeaveConfirm({ show: false, personnelId: '', personnelName: '' });
  };

  const handleSave = async () => {
    // Validation
    if (selectedPersonnel.length === 0) {
      setShowWarning('En az bir personel seçmelisiniz!');
      return;
    }

    // For regular_location modal, validate selectedLocation instead
    if (modalType === 'regular_location') {
      if (!selectedLocation.trim()) {
        setShowWarning('Mekan seçiniz!');
        return;
      }
    } else {
      if (!customLocation.trim()) {
        setShowWarning('Lokasyon giriniz!');
        return;
      }
    }

    // Prepare personnel data
    const personnel: Personnel[] = selectedPersonnel.map(id => {
      const staff = staffMembers.find(s => s.id === id)!;
      return {
        id: staff.id,
        name: staff.name,
        avatar: staff.avatar,
        role: staff.role,
      };
    });

    // Determine location, icon, and type based on modalType
    let taskLocation: string;
    let taskLocationIcon: string;
    let taskTaskType: 'regular' | 'special';
    let actualTaskType: 'regular' | 'extra' | 'special'; // Yeni field: Gerçek görev tipi
    let taskStartTime: string;
    let taskEndTime: string;

    if (modalType === 'regular_location') {
      // Regular location from Mekan Management
      const location = locations.find(loc => loc.name === selectedLocation);
      taskLocation = selectedLocation;
      taskLocationIcon = location?.icon || '📍';
      taskTaskType = 'regular';
      actualTaskType = 'regular'; // Sabit görev
      // ✅ Get working hours from location
      taskStartTime = location?.workingHours?.start || '09:00';
      taskEndTime = location?.workingHours?.end || '17:00';
    } else {
      // Extra/Special task
      taskLocation = customLocation.trim();
      taskLocationIcon = taskType === 'extra' ? '📍' : '⚡';
      taskTaskType = 'special'; // Both extra and special are saved as 'special' type
      actualTaskType = taskType; // 'extra' veya 'special'
      taskStartTime = startTime;
      taskEndTime = endTime;
    }

    if (editingTask) {
      // Update existing task
      await updateTask(editingTask.id, {
        personnel,
        location: taskLocation,
        locationIcon: taskLocationIcon,
        startTime: taskStartTime,
        endTime: taskEndTime,
        taskType: actualTaskType,
        notes: notes.trim(),
      }, accessToken);
    } else {
      // Create new task
      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        personnel,
        location: taskLocation,
        locationIcon: taskLocationIcon,
        startTime: taskStartTime,
        endTime: taskEndTime,
        type: taskTaskType,
        taskType: actualTaskType,
        notes: notes.trim(),
        status: 'draft',
        date: selectedDate,
      };
      await saveTask(newTask, accessToken);
    }

    onClose();
  };

  if (!isOpen) return null;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 z-[120]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-white/20 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 pb-3 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white">
              {editingTask ? '✏️ Görevi Düzenle' : '➕ Yeni Görev Ekle'}
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
                className="mx-4 mt-3 p-2.5 bg-red-500/20 border-2 border-red-500/40 rounded-xl flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm font-semibold text-red-300">{showWarning}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-5">
              {/* Task Type Selection - ONLY for extra_special modal */}
              {modalType === 'extra_special' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Görev Tipi *
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Extra Task */}
                    <button
                      onClick={() => setTaskType('extra')}
                      className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                        taskType === 'extra'
                          ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/30 border-2 border-pink-400'
                          : 'bg-white/5 border-2 border-white/20 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      Ekstra İş
                    </button>

                    {/* Special Task */}
                    <button
                      onClick={() => setTaskType('special')}
                      className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                        taskType === 'special'
                          ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
                          : 'bg-white/5 border-2 border-white/20 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      Özel Görev
                    </button>
                  </div>
                </div>
              )}

              {/* Personnel Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Personel Seçimi * ({selectedPersonnel.length} seçildi)
                </label>
                
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-white/5 rounded-xl border-2 border-white/10">
                  {staffMembers.map((staff) => {
                    const isSelected = selectedPersonnel.includes(staff.id);
                    const isFixedOnLeave = isPersonnelFixedOnLeave(staff);
                    const isDailyOnLeave = isPersonnelDailyOnLeave(staff);
                    
                    return (
                      <button
                        key={staff.id}
                        onClick={() => {
                          if (isFixedOnLeave) return; // Sabit izinli - tıklanamaz
                          handleTogglePersonnel(staff.id, isDailyOnLeave);
                        }}
                        disabled={isFixedOnLeave}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                          isFixedOnLeave
                            ? 'bg-red-500/40 text-gray-300 cursor-not-allowed opacity-70'
                            : isDailyOnLeave
                              ? isSelected
                                ? 'bg-amber-500 text-white active:scale-95'
                                : 'bg-amber-500/40 text-gray-200 hover:bg-amber-500/60 active:scale-95'
                              : isSelected
                                ? 'bg-[#9dd9ea] text-[#2d3748] font-semibold active:scale-95'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20 active:scale-95'
                        }`}
                      >
                        {/* Check icon - only when selected */}
                        {isSelected && !isFixedOnLeave && <Check className="w-4 h-4" />}
                        
                        {/* Name */}
                        <span className="text-sm truncate flex-1">{staff.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location Input - ONLY for extra_special */}
              {modalType === 'extra_special' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Mekan *
                  </label>
                  
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="Görev lokasyonunu giriniz..."
                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#9dd9ea]"
                  />
                </div>
              )}

              {/* Time Range - ONLY for extra_special */}
              {modalType === 'extra_special' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Başlangıç *
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Bitiş *
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea]"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Notlar (Opsiyonel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Görev ile ilgili notlar ekleyebilirsiniz..."
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#9dd9ea] resize-none"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 pb-1">
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
                  {editingTask ? 'Güncelle' : 'Listeye Ekle'}
                </button>
              </div>
            </div>
          </div>

          {/* Daily Leave Confirmation Modal */}
          <AnimatePresence>
            {showDailyLeaveConfirm.show && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[130]"
                onClick={handleCancelDailyLeave}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-gradient-to-br from-amber-900 to-amber-950 border-2 border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                >
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-amber-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Günlük İzinli Personel
                    </h3>
                    <p className="text-amber-200 text-lg">
                      <span className="font-bold">{showDailyLeaveConfirm.personnelName}</span> günlük izinli!
                    </p>
                    <p className="text-amber-300/80 text-sm mt-2">
                      Yine de göreve eklemek istiyor musunuz?
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelDailyLeave}
                      className="flex-1 py-3 px-4 bg-gray-600/50 border-2 border-gray-500/30 text-gray-200 rounded-xl font-semibold hover:bg-gray-600/70 transition-all active:scale-95"
                    >
                      Hayır, İptal
                    </button>
                    <button
                      onClick={handleConfirmDailyLeave}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
                    >
                      Evet, Ekle
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}