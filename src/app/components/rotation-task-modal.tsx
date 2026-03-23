import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Clock, Users, Check, AlertCircle, Zap, Sparkles, Loader2, Info } from 'lucide-react';
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
  existingTasks?: Task[]; // çift atama kontrolü için
  onClose: () => void;
  onTaskSaved?: (task: Task) => void; // optimistik güncelleme için
  onRemoveDailyOnLeave?: (personnelIds: string[]) => void; // günlük izinden çıkar
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
  existingTasks,
  onClose,
  onTaskSaved,
  onRemoveDailyOnLeave,
}: RotationTaskModalProps) {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [locationIcon, setLocationIcon] = useState<string>('📍');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [gorevMap, setGorevMap] = useState<Record<string, 'fotograf-satis' | 'baski' | 'album'>>({});
  const [notes, setNotes] = useState<string>('');
  const [showWarning, setShowWarning] = useState<string>('');
  const [doubleAssignWarning, setDoubleAssignWarning] = useState<string>(''); // amber, kaydetmeyi engellemez
  const [taskType, setTaskType] = useState<'extra' | 'special'>('special');
  const [isSaving, setIsSaving] = useState(false);
  const [showDailyLeaveConfirm, setShowDailyLeaveConfirm] = useState<{
    show: boolean;
    personnelId: string;
    personnelName: string;
  }>({ show: false, personnelId: '', personnelName: '' });
  const [confirmedDailyLeaveIds, setConfirmedDailyLeaveIds] = useState<string[]>([]);
  const [showLegend, setShowLegend] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // INITIALIZATION
  // ==========================================

  useEffect(() => {
    if (editingTask) {
      if (modalType === 'regular_location') {
        setSelectedLocation(editingTask.location);
      } else {
        setCustomLocation(editingTask.location);
        setLocationIcon(editingTask.locationIcon);
        if (editingTask.taskType === 'extra' || editingTask.taskType === 'special') {
          setTaskType(editingTask.taskType);
        } else {
          setTaskType(editingTask.locationIcon === '⚡' ? 'special' : 'extra');
        }
      }
      setStartTime(editingTask.startTime);
      setEndTime(editingTask.endTime);
      // Edit modunda onaylı izinli personeli baştan listeden çıkar
      const filteredIds = editingTask.personnel
        .map(p => p.id)
        .filter(id => {
          const staff = staffMembers.find(s => s.id === id);
          if (!staff) return true;
          const isOnLeave =
            staff.status === 'on_leave' ||
            leaveRequests.some(
              leave =>
                leave.personnelId === staff.id &&
                leave.status === 'approved' &&
                new Date(selectedDate) >= new Date(leave.startDate) &&
                new Date(selectedDate) <= new Date(leave.endDate)
            );
          return !isOnLeave;
        });
      setSelectedPersonnel(filteredIds);
      // Mevcut görev atamalarını yükle
      const existingGorevMap: Record<string, 'fotograf-satis' | 'baski' | 'album'> = {};
      editingTask.personnel.forEach(p => {
        if (p.gorev) existingGorevMap[p.id] = p.gorev;
      });
      setGorevMap(existingGorevMap);
      setNotes(editingTask.notes || '');
    } else {
      if (preselectedLocation && modalType === 'regular_location') {
        setSelectedLocation(preselectedLocation);
      } else {
        setSelectedLocation('');
      }
      setCustomLocation('');
      setLocationIcon('📍');
      setStartTime('09:00');
      setEndTime('17:00');
      setSelectedPersonnel([]);
      setGorevMap({});
      setNotes('');
      setTaskType('special');
    }
    setShowWarning('');
    setDoubleAssignWarning('');
    setIsSaving(false);
    setConfirmedDailyLeaveIds([]);
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
    if (staff.status === 'on_leave') return true;
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
    const dailyOnLeaveList = dailyOnLeave[selectedDate] || [];
    return dailyOnLeaveList.includes(staff.id);
  };

  // Çakışan görevleri döndür (personel zaten başka göreve atanmış mı?)
  const getConflictingTasks = (staffId: string): Task[] => {
    if (!existingTasks) return [];
    return existingTasks.filter(task => {
      if (editingTask && task.id === editingTask.id) return false;
      return task.date === selectedDate && task.personnel.some(p => p.id === staffId);
    });
  };

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleTogglePersonnel = (personnelId: string, isDailyLeave: boolean = false) => {
    const staff = staffMembers.find(s => s.id === personnelId);
    if (!staff) return;

    if (isDailyLeave && !selectedPersonnel.includes(personnelId)) {
      setShowDailyLeaveConfirm({
        show: true,
        personnelId: staff.id,
        personnelName: staff.name,
      });
      return;
    }

    const isAlreadySelected = selectedPersonnel.includes(personnelId);

    // Çift atama kontrolü: ekleme yaparken mevcut task'lara bak
    if (!isAlreadySelected && existingTasks) {
      const conflictTask = existingTasks.find(task => {
        if (editingTask && task.id === editingTask.id) return false; // kendi task'ı hariç
        return (
          task.date === selectedDate &&
          task.personnel.some(p => p.id === personnelId)
        );
      });
      if (conflictTask) {
        setDoubleAssignWarning(
          `⚠️ ${staff.name} bugün zaten "${conflictTask.location}" görevinde — yine de eklenebilir`
        );
      } else {
        // Başka çakışma yoksa uyarıyı temizle
        setDoubleAssignWarning('');
      }
    }

    if (isAlreadySelected) {
      // Seçimi kaldırırken, kalan seçimlerde hâlâ çakışan var mı kontrol et
      const remaining = selectedPersonnel.filter(id => id !== personnelId);
      if (existingTasks && remaining.length > 0) {
        const stillConflict = existingTasks.some(task => {
          if (editingTask && task.id === editingTask.id) return false;
          return task.date === selectedDate && task.personnel.some(p => remaining.includes(p.id));
        });
        if (!stillConflict) setDoubleAssignWarning('');
      } else {
        setDoubleAssignWarning('');
      }
    }

    setSelectedPersonnel(prev =>
      isAlreadySelected
        ? prev.filter(id => id !== personnelId)
        : [...prev, personnelId]
    );
  };

  const handleConfirmDailyLeave = () => {
    const { personnelId } = showDailyLeaveConfirm;
    setSelectedPersonnel(prev => [...prev, personnelId]);
    setConfirmedDailyLeaveIds(prev => [...prev, personnelId]);
    setShowDailyLeaveConfirm({ show: false, personnelId: '', personnelName: '' });
  };

  const handleCancelDailyLeave = () => {
    setShowDailyLeaveConfirm({ show: false, personnelId: '', personnelName: '' });
  };

  const handleSave = async () => {
    setShowWarning('');
    setDoubleAssignWarning('');

    // ── Validation ──────────────────────────────────────────────
    if (selectedPersonnel.length === 0) {
      setShowWarning('En az bir personel seçmelisiniz!');
      return;
    }

    // ── İzinli personel kontrolü (kaydet sırasında çift kontrol) ──
    const onLeaveInSelection = selectedPersonnel.filter(id => {
      const staff = staffMembers.find(s => s.id === id);
      if (!staff) return false;
      return isPersonnelFixedOnLeave(staff);
    });
    if (onLeaveInSelection.length > 0) {
      const names = onLeaveInSelection
        .map(id => staffMembers.find(s => s.id === id)?.name || id)
        .join(', ');
      setShowWarning(`Onaylı izinli personel göreve atanamaz: ${names}`);
      // Seçimden çıkar
      setSelectedPersonnel(prev => prev.filter(id => !onLeaveInSelection.includes(id)));
      return;
    }

    // ── Çift görev kontrolü ─────────────────────────────────────
    // (Sadece anlık uyarı, kaydetmeyi engellemez — handleTogglePersonnel'da gösterilir)

    // ── Prepare data ────────────────────────────────────────────
    let personnel: Personnel[];
    try {
      personnel = selectedPersonnel.map(id => {
        const staff = staffMembers.find(s => s.id === id);
        if (!staff) throw new Error(`Personel bulunamadı: ${id}`);
        const gorev = selectedPersonnel.length > 1 ? gorevMap[id] : undefined;
        return { id: staff.id, name: staff.name, avatar: staff.avatar, role: staff.role, gorev };
      });
    } catch (err: any) {
      setShowWarning(err.message || 'Personel verisi hatası.');
      return;
    }

    let taskLocation: string;
    let taskLocationIcon: string;
    let taskTaskType: 'regular' | 'special';
    let actualTaskType: 'regular' | 'extra' | 'special';
    let taskStartTime: string;
    let taskEndTime: string;

    if (modalType === 'regular_location') {
      const location = locations.find(loc => loc.name === selectedLocation);
      taskLocation = selectedLocation;
      taskLocationIcon = location?.icon || '📍';
      taskTaskType = 'regular';
      actualTaskType = 'regular';
      taskStartTime = location?.workingHours?.start || startTime;
      taskEndTime = location?.workingHours?.end || endTime;
    } else {
      taskLocation = customLocation.trim();
      taskLocationIcon = taskType === 'extra' ? '📍' : '⚡';
      taskTaskType = 'special';
      actualTaskType = taskType;
      taskStartTime = startTime;
      taskEndTime = endTime;
    }

    // ── Save ─────────────────────────────────────────────────────
    setIsSaving(true);
    try {
      if (editingTask) {
        const updates = {
          personnel,
          location: taskLocation,
          locationIcon: taskLocationIcon,
          startTime: taskStartTime,
          endTime: taskEndTime,
          taskType: actualTaskType,
          notes: notes.trim(),
        };
        console.log('[TaskModal] updateTask:', editingTask.id, updates);
        await updateTask(editingTask.id, updates, accessToken);
        // Optimistik güncelleme: parent'a güncellenmiş task'ı ilet
        if (onTaskSaved) {
          onTaskSaved({ ...editingTask, ...updates });
        }
      } else {
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
        console.log('[TaskModal] saveTask:', newTask);
        await saveTask(newTask, accessToken);
        // Optimistik güncelleme: parent'a yeni task'ı ilet
        if (onTaskSaved) {
          onTaskSaved(newTask);
        }
      }

      // Başarılı kayıt sonrası — onaylanan günlük izinlileri listeden çıkar
      if (confirmedDailyLeaveIds.length > 0 && onRemoveDailyOnLeave) {
        onRemoveDailyOnLeave(confirmedDailyLeaveIds);
      }

      onClose();
    } catch (err: any) {
      console.error('[TaskModal] save error:', err);
      const msg = err?.message || 'Sunucu hatası oluştu.';
      setShowWarning(`Kayıt hatası: ${msg}`);
      setIsSaving(false);
    }
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
            <div className="flex items-center gap-2">
              {/* Legend Info Button */}
              <div className="relative" ref={legendRef}>
                <button
                  onMouseEnter={() => setShowLegend(true)}
                  onMouseLeave={() => setShowLegend(false)}
                  onClick={() => setShowLegend(v => !v)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
                  title="Renk Açıklamaları"
                >
                  <Info className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {showLegend && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-10 z-50 w-72 bg-[rgba(20,14,40,0.97)] border border-white/20 rounded-xl shadow-2xl p-3 backdrop-blur-xl"
                      onMouseEnter={() => setShowLegend(true)}
                      onMouseLeave={() => setShowLegend(false)}
                    >
                      <p className="text-xs font-bold text-gray-300 mb-2.5 uppercase tracking-wider">Renk Açıklamaları</p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 w-3 h-3 rounded-full bg-red-500 flex-shrink-0 ring-1 ring-red-400/50" />
                          <div>
                            <p className="text-sm text-white font-semibold leading-tight">Onaylı / Sabit İzin</p>
                            <p className="text-xs text-gray-400 mt-0.5">Seçilemez, göreve atanamaz</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 w-3 h-3 rounded-full bg-amber-400 flex-shrink-0 ring-1 ring-amber-400/50" />
                          <div>
                            <p className="text-sm text-white font-semibold leading-tight">Günlük İzin</p>
                            <p className="text-xs text-gray-400 mt-0.5">Seçilirse izni geri alınır, onay gerekir</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 w-3 h-3 rounded-full bg-orange-500 flex-shrink-0 ring-1 ring-orange-500/50" />
                          <div>
                            <p className="text-sm text-white font-semibold leading-tight">Çift Atama</p>
                            <p className="text-xs text-gray-400 mt-0.5">Başka göreve zaten atanmış — yine de eklenebilir</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={onClose}
                disabled={isSaving}
                className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
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
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-red-300">{showWarning}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Double Assign Warning Message */}
          <AnimatePresence>
            {doubleAssignWarning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-4 mt-3 p-2.5 bg-amber-500/20 border-2 border-amber-500/40 rounded-xl flex items-center gap-2"
              >
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-amber-300">{doubleAssignWarning}</span>
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
                    const conflictTasks = getConflictingTasks(staff.id);
                    const hasConflict = conflictTasks.length > 0;
                    return (
                      <button
                        key={staff.id}
                        onClick={() => {
                          if (isFixedOnLeave) return;
                          handleTogglePersonnel(staff.id, isDailyOnLeave);
                        }}
                        disabled={isFixedOnLeave || isSaving}
                        className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl transition-all ${
                          isFixedOnLeave
                            ? 'bg-red-500/40 text-gray-300 cursor-not-allowed opacity-70'
                            : isDailyOnLeave
                              ? isSelected
                                ? 'bg-amber-500 text-white active:scale-95'
                                : 'bg-amber-500/40 text-gray-200 hover:bg-amber-500/60 active:scale-95'
                              : hasConflict
                                ? isSelected
                                  ? 'bg-orange-500/70 text-white ring-1 ring-orange-400/60 active:scale-95'
                                  : 'bg-orange-500/30 text-gray-200 hover:bg-orange-500/45 active:scale-95'
                                : isSelected
                                  ? 'bg-[#9dd9ea] text-[#2d3748] font-semibold active:scale-95'
                                  : 'bg-white/10 text-gray-300 hover:bg-white/20 active:scale-95'
                        }`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {isSelected && !isFixedOnLeave && <Check className="w-4 h-4 flex-shrink-0" />}
                          <span className="text-sm truncate flex-1 text-left">{staff.name}</span>
                        </div>
                        {hasConflict && (
                          <div className="w-full pl-0">
                            <p className="text-[10px] leading-tight text-orange-200/90 truncate">
                              {conflictTasks.map(t => t.location).join(', ')}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Görev Ataması — 2+ kişide göster ── */}
              {selectedPersonnel.length > 1 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    🎭 Görev Ataması
                    <span className="ml-2 text-xs font-normal text-gray-500">(Prim hesaplaması için)</span>
                  </label>
                  <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
                    {selectedPersonnel.map(id => {
                      const staff = staffMembers.find(s => s.id === id);
                      if (!staff) return null;
                      const gorev = gorevMap[id];
                      return (
                        <div key={id} className="flex items-center gap-2">
                          <span className="text-sm shrink-0 w-5">{staff.avatar}</span>
                          <span className="text-xs text-white font-medium flex-1 truncate">{staff.name}</span>
                          <div className="flex gap-1 shrink-0">
                            {([
                              { key: 'fotograf-satis', label: '📸', title: 'Fotoğraf/Satış' },
                              { key: 'baski', label: '🖨️', title: 'Baskı' },
                              { key: 'album', label: '📒', title: 'Albüm' },
                            ] as const).map(g => (
                              <button
                                key={g.key}
                                type="button"
                                title={g.title}
                                onClick={() => setGorevMap(prev => ({ ...prev, [id]: g.key }))}
                                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all active:scale-95 ${
                                  gorev === g.key
                                    ? 'bg-[#9dd9ea]/25 border-2 border-[#9dd9ea]/60 scale-110'
                                    : 'bg-white/8 border border-white/15 opacity-50 hover:opacity-80'
                                }`}
                              >
                                {g.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-gray-500 mt-1">
                      📸 Fotoğrafçı/Satış · 🖨️ Baskı · 📒 Albüm — seçilmezse Fotoğraf primi uygulanır
                    </p>
                  </div>
                </div>
              )}

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
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 bg-gray-600/50 border-2 border-gray-500/30 text-gray-200 rounded-xl font-semibold hover:bg-gray-600/70 transition-all active:scale-95 disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    editingTask ? 'Güncelle' : 'Listeye Ekle'
                  )}
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