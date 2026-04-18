import { useEffect, useMemo, useState, useCallback } from 'react';
import { Save, Trash2, Search, MapPin, Clock, Users, Check, AlertCircle, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react';
import {
  getStaffMembers, getLocations, getTasks, saveTask, updateTask, deleteTask,
  getDailyOnLeave, getLeaveRequests,
  type Task, type StaffMember, type Location, type LeaveRequest, type Personnel,
} from '../../services/rotation-service';

function todayTR(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', { weekday: 'long' });
}

function relTime(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 0) return '';
  if (diff < 60) return 'şimdi';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

function firstName(full: string): string {
  return full.split(' ')[0] || full;
}

function isFixedOnLeave(personId: string, leaveRequests: LeaveRequest[], date: string): boolean {
  return leaveRequests.some(lr =>
    lr.status === 'approved' &&
    lr.personnelId === personId &&
    date >= lr.startDate && date <= lr.endDate
  );
}

function isDailyOnLeave(personId: string, dailyOnLeave: Record<string, string[]>, date: string): boolean {
  return (dailyOnLeave[date] || []).includes(personId);
}

function isDoubleAssigned(personId: string, tasks: Task[], date: string, excludeTaskId?: string): boolean {
  return tasks.some(t =>
    t.id !== excludeTaskId &&
    t.date === date &&
    t.status !== 'cancelled' &&
    t.personnel.some(p => p.id === personId)
  );
}

const TASK_TYPES = [
  { value: 'regular' as const, label: 'Normal' },
  { value: 'extra' as const,   label: 'Ekstra' },
  { value: 'special' as const, label: 'Özel'   },
];

const navBtnStyle: React.CSSProperties = {
  width: 28, height: 28,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
};

interface Props {
  companyKey?: string;
}

export function PcRotasyonAtama({ companyKey: _companyKey }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(todayTR());
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyOnLeave, setDailyOnLeave] = useState<Record<string, string[]>>({});
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formMode, setFormMode] = useState<'closed' | 'new' | 'edit'>('closed');

  // Form state
  const [formLocationId, setFormLocationId] = useState<string>('');
  const [formStart, setFormStart] = useState<string>('09:00');
  const [formEnd, setFormEnd] = useState<string>('18:00');
  const [formPersonnel, setFormPersonnel] = useState<Personnel[]>([]);
  const [formTaskType, setFormTaskType] = useState<'regular' | 'extra' | 'special'>('regular');
  const [formNotes, setFormNotes] = useState<string>('');
  const [searchPersonel, setSearchPersonel] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, t, dol, lr] = await Promise.all([
        getStaffMembers(),
        getLocations(),
        getTasks(),
        getDailyOnLeave(),
        getLeaveRequests(),
      ]);
      setStaffMembers(s);
      setLocations(l);
      setTasks(t);
      setDailyOnLeave(dol);
      setLeaveRequests(lr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const todaysTasks = useMemo(() => {
    return tasks.filter(t => t.date === selectedDate && t.status !== 'cancelled');
  }, [tasks, selectedDate]);

  const tasksByMekan = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks.filter(x => x.date === selectedDate && x.status !== 'cancelled')) {
      m.set(t.location, (m.get(t.location) || 0) + 1);
    }
    return m;
  }, [tasks, selectedDate]);

  const dayLoad = useMemo(() => {
    const dayTasks = tasks.filter(t => t.date === selectedDate && t.status !== 'cancelled');
    const tasksCount = dayTasks.length;
    const assignedIds = new Set<string>();
    let assignmentsCount = 0;
    for (const t of dayTasks) {
      for (const p of t.personnel) {
        assignmentsCount++;
        assignedIds.add(p.id);
      }
    }
    const onLeaveIds = new Set<string>();
    for (const lr of leaveRequests) {
      if (lr.status === 'approved' && selectedDate >= lr.startDate && selectedDate <= lr.endDate) onLeaveIds.add(lr.personnelId);
    }
    for (const id of (dailyOnLeave[selectedDate] || [])) onLeaveIds.add(id);
    const idleCount = staffMembers.filter(s => s.role !== 'idari' && !assignedIds.has(s.id) && !onLeaveIds.has(s.id)).length;
    return { tasksCount, assignmentsCount, idleCount };
  }, [tasks, selectedDate, staffMembers, leaveRequests, dailyOnLeave]);

  const filteredStaff = useMemo(() => {
    const q = searchPersonel.trim().toLowerCase();
    return staffMembers
      .filter(s => s.role !== 'idari') // idari rotasyona dahil değil
      .filter(s => !q || s.name.toLowerCase().includes(q));
  }, [staffMembers, searchPersonel]);

  const openNewForm = (locId?: string) => {
    setEditingTask(null);
    setFormMode('new');
    const loc = locId ? locations.find(l => l.id === locId) : undefined;
    setFormLocationId(locId || '');
    setFormStart(loc?.workingHours?.start || '09:00');
    setFormEnd(loc?.workingHours?.end || '18:00');
    setFormPersonnel([]);
    setFormTaskType('regular');
    setFormNotes('');
    setSearchPersonel('');
    setErr('');
  };

  const openEditForm = (task: Task) => {
    setEditingTask(task);
    setFormMode('edit');
    const loc = locations.find(l => l.name === task.location);
    setFormLocationId(loc?.id || '');
    setFormStart(task.startTime);
    setFormEnd(task.endTime);
    setFormPersonnel(task.personnel);
    setFormTaskType(task.taskType);
    setFormNotes(task.notes || '');
    setSearchPersonel('');
    setErr('');
  };

  const closeForm = () => {
    setFormMode('closed');
    setEditingTask(null);
    setErr('');
  };

  const togglePersonnel = (s: StaffMember) => {
    if (isFixedOnLeave(s.id, leaveRequests, selectedDate)) return;
    setFormPersonnel(prev => {
      const exists = prev.find(p => p.id === s.id);
      if (exists) return prev.filter(p => p.id !== s.id);
      return [...prev, { id: s.id, name: s.name, avatar: s.avatar, role: s.role }];
    });
  };

  const handleSave = async () => {
    setErr('');
    if (!formLocationId) { setErr('Mekan seç'); return; }
    if (formPersonnel.length === 0) { setErr('En az 1 personel seç'); return; }
    const loc = locations.find(l => l.id === formLocationId);
    if (!loc) { setErr('Mekan bulunamadı'); return; }

    setSaving(true);
    try {
      if (formMode === 'edit' && editingTask) {
        await updateTask(editingTask.id, {
          location: loc.name, locationIcon: loc.icon,
          startTime: formStart, endTime: formEnd,
          personnel: formPersonnel,
          taskType: formTaskType,
          notes: formNotes,
          status: editingTask.status === 'sent' ? 'revised' : 'sent',
        });
      } else {
        const newTask: Task = {
          id: crypto.randomUUID(),
          date: selectedDate,
          location: loc.name,
          locationIcon: loc.icon,
          startTime: formStart, endTime: formEnd,
          personnel: formPersonnel,
          type: formTaskType === 'special' ? 'special' : 'regular',
          taskType: formTaskType,
          notes: formNotes,
          status: 'sent',
        };
        await saveTask(newTask);
      }
      await loadAll();
      closeForm();
    } catch (e: any) {
      setErr(e.message || 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTask) return;
    if (!confirm(`"${editingTask.location}" görevini silmek istediğine emin misin?`)) return;
    setSaving(true);
    try {
      await deleteTask(editingTask.id);
      await loadAll();
      closeForm();
    } catch (e: any) {
      setErr(e.message || 'Silme hatası');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '150px 1fr 360px 320px', gap: 8, minHeight: 0 }}>
      {/* SOL — Hızlı mekan launcher: tıkla = o mekan için form aç */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,255,255,0.4)', padding: '4px 6px' }}>
          MEKAN ATA
        </div>
        {locations.map(loc => {
          const count = tasksByMekan.get(loc.name) || 0;
          const isEmpty = count === 0;
          return (
            <button
              key={loc.id}
              onClick={() => openNewForm(loc.id)}
              title={isEmpty ? 'Atanmamış — tıkla ve oluştur' : `${count} görev — tıkla ve yeni ekle`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 8,
                background: isEmpty ? 'rgba(248,113,113,0.08)' : `${loc.color}10`,
                border: `1px solid ${isEmpty ? 'rgba(248,113,113,0.3)' : `${loc.color}30`}`,
                color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 13 }}>{loc.icon}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
              {isEmpty ? (
                <span title="Atama yok" style={{ fontSize: 11, color: '#f87171', fontWeight: 800 }}>❗</span>
              ) : (
                <span style={{
                  fontSize: 10, color: loc.color, fontWeight: 800,
                  background: `${loc.color}25`, padding: '1px 6px', borderRadius: 4, border: `1px solid ${loc.color}40`,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ORTA — Görev listesi + tarih header */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            title="Önceki gün"
            style={navBtnStyle}
          >
            <ChevronLeft size={14} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, outline: 'none',
              colorScheme: 'dark',
            }}
          />
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            title="Sonraki gün"
            style={navBtnStyle}
          >
            <ChevronRight size={14} />
          </button>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginLeft: 2 }}>
            {dayName(selectedDate)}
          </span>
          {selectedDate !== todayTR() && (
            <button
              onClick={() => setSelectedDate(todayTR())}
              style={{
                padding: '5px 10px',
                background: 'rgba(157,217,234,0.1)',
                border: '1px solid rgba(157,217,234,0.3)',
                borderRadius: 6, color: '#9dd9ea', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Bugüne dön
            </button>
          )}
          {/* Yük özeti — Faz 2 #8 */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 700 }}>
            <span title="Bugünkü görev sayısı" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: 'rgba(168,230,207,0.12)', border: '1px solid rgba(168,230,207,0.3)', borderRadius: 5, color: '#a8e6cf' }}>
              📋 {dayLoad.tasksCount} görev
            </span>
            <span title="Toplam atanmış personel (tekrarlar dahil)" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: 'rgba(157,217,234,0.12)', border: '1px solid rgba(157,217,234,0.3)', borderRadius: 5, color: '#9dd9ea' }}>
              👥 {dayLoad.assignmentsCount} atama
            </span>
            <span title="Henüz atanmamış personel (izinliler hariç)" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 5, color: '#fbbf24' }}>
              💤 {dayLoad.idleCount} boşta
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Yükleniyor…</div>
          ) : todaysTasks.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 12, flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 28 }}>📭</div>
              <div>Bu gün için görev yok</div>
              <button
                onClick={() => openNewForm()}
                style={{ padding: '5px 10px', background: 'rgba(168,230,207,0.12)', border: '1px solid rgba(168,230,207,0.3)', borderRadius: 6, color: '#a8e6cf', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                + İlk görevi oluştur
              </button>
            </div>
          ) : (
            <>
              {/* Inline + Yeni Görev */}
              <button
                onClick={() => openNewForm()}
                style={{
                  padding: '6px 10px', borderRadius: 8,
                  background: 'rgba(168,230,207,0.08)',
                  border: '1px dashed rgba(168,230,207,0.3)',
                  color: '#a8e6cf', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                + Görev Ekle
              </button>
              {todaysTasks.map(task => {
                const loc = locations.find(l => l.name === task.location);
                const color = loc?.color || '#9dd9ea';
                const isSelected = editingTask?.id === task.id;
                const conflictPersonel = task.personnel.filter(p => isDoubleAssigned(p.id, tasks, selectedDate, task.id));
                const hasConflict = conflictPersonel.length > 0;
                const statusIcon = task.status === 'sent' ? '✓' : task.status === 'revised' ? '🔄' : '◯';
                const statusColor = task.status === 'sent' ? '#a8e6cf' : task.status === 'revised' ? '#fbbf24' : 'rgba(255,255,255,0.5)';
                const statusLabel = task.status === 'sent' ? 'Gönderildi' : task.status === 'revised' ? 'Revize edildi' : 'Taslak';
                const metaTime = task.revisedAt || task.sentAt;
                return (
                  <button
                    key={task.id}
                    onClick={() => openEditForm(task)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px', borderRadius: 9,
                      background: isSelected ? `${color}20` : `${color}10`,
                      border: `1px solid ${isSelected ? `${color}60` : `${color}30`}`,
                      borderLeft: `3px solid ${color}`,
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {hasConflict && <span title={`Çakışma: ${conflictPersonel.map(p => p.name).join(', ')}`}>⚠️</span>}
                      <span style={{ fontSize: 13 }}>{task.locationIcon}</span>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>{task.location}</span>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>· {task.startTime}–{task.endTime} · {task.personnel.length} kişi</span>
                      <span title={statusLabel + (metaTime ? ` · ${relTime(metaTime)}` : '')}
                        style={{ marginLeft: 'auto', fontSize: 11, color: statusColor, fontWeight: 800 }}>
                        {statusIcon}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {task.personnel.map(p => {
                        const isConflict = conflictPersonel.find(c => c.id === p.id);
                        return (
                          <span
                            key={p.id}
                            title={p.name + (isConflict ? ' · çakışma' : '')}
                            style={{
                              fontSize: 10, padding: '1px 6px',
                              background: isConflict ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.06)',
                              border: `1px solid ${isConflict ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.1)'}`,
                              borderRadius: 4, color: isConflict ? '#fb923c' : '#fff',
                              display: 'inline-flex', alignItems: 'center', gap: 2,
                            }}
                          >
                            <span>{p.avatar}</span>
                            {firstName(p.name)}
                          </span>
                        );
                      })}
                    </div>
                    {(task.notes || metaTime) && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 1 }}>
                        {task.notes ? (
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>📝 {task.notes}</span>
                        ) : <span />}
                        {metaTime && (
                          <span style={{ fontSize: 9, color: statusColor, opacity: 0.7 }}>{relTime(metaTime)}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* SAĞ — Form panel */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, overflowY: 'auto' }}>
        {formMode === 'closed' ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>✏️</div>
            <div>Görev seç veya<br/>yeni görev oluştur</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 0.3 }}>
                {formMode === 'new' ? '➕ YENİ GÖREV' : '✏️ GÖREV DÜZENLE'}
              </div>
              <button
                onClick={closeForm}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', padding: 0 }}
                title="Kapat"
              >×</button>
            </div>

            {/* Mekan */}
            <div>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MapPin size={10} /> MEKAN
              </label>
              <select
                value={formLocationId}
                onChange={e => {
                  const newId = e.target.value;
                  setFormLocationId(newId);
                  const loc = locations.find(l => l.id === newId);
                  if (loc?.workingHours) {
                    setFormStart(loc.workingHours.start);
                    setFormEnd(loc.workingHours.end);
                  }
                }}
                style={{
                  width: '100%', padding: '8px 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, outline: 'none',
                }}
              >
                <option value="" style={{ background: '#1a1530' }}>— seç —</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id} style={{ background: '#1a1530' }}>{l.icon} {l.name}</option>
                ))}
              </select>
              {formLocationId && (() => {
                const loc = locations.find(l => l.id === formLocationId);
                if (!loc) return null;
                const yesterday = shiftDate(selectedDate, -1);
                const yTask = tasks.find(t => t.location === loc.name && t.date === yesterday && t.status !== 'cancelled');
                if (!yTask) return null;
                return (
                  <button
                    onClick={() => {
                      setFormPersonnel(yTask.personnel);
                      setFormStart(yTask.startTime);
                      setFormEnd(yTask.endTime);
                      if (yTask.notes) setFormNotes(yTask.notes);
                    }}
                    title={`Dünkü ${loc.name} görevini kopyala (${yTask.personnel.length} kişi)`}
                    style={{
                      width: '100%', marginTop: 4, padding: '5px 8px',
                      background: 'rgba(197,168,245,0.12)',
                      border: '1px dashed rgba(197,168,245,0.35)',
                      borderRadius: 6, color: '#c5a8f5', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}
                  >
                    <Wand2 size={11} /> Dünkü kadrodan doldur ({yTask.personnel.length} kişi)
                  </button>
                );
              })()}
            </div>

            {/* Saat + tip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <Clock size={10} /> BAŞLANGIÇ
                </label>
                <input type="time" value={formStart} onChange={e => setFormStart(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none', colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <Clock size={10} /> BİTİŞ
                </label>
                <input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none', colorScheme: 'dark' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 4, display: 'block' }}>TİP</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {TASK_TYPES.map(tt => (
                  <button
                    key={tt.value}
                    onClick={() => setFormTaskType(tt.value)}
                    style={{
                      flex: 1, padding: '6px',
                      background: formTaskType === tt.value ? 'rgba(168,230,207,0.18)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${formTaskType === tt.value ? 'rgba(168,230,207,0.4)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 6, color: formTaskType === tt.value ? '#a8e6cf' : 'rgba(255,255,255,0.7)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {tt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seçili Personel (picker sağ sütunda) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={10} /> SEÇİLİ PERSONEL ({formPersonnel.length})
              </label>
              {formPersonnel.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, textAlign: 'center' }}>
                  Sağdaki listeden personel seç →
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {formPersonnel.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePersonnel({ id: p.id, name: p.name, avatar: p.avatar, role: p.role, status: 'active' } as StaffMember)}
                      title="Kaldır"
                      style={{
                        fontSize: 11, padding: '4px 8px',
                        background: 'rgba(168,230,207,0.18)',
                        border: '1px solid rgba(168,230,207,0.4)',
                        borderRadius: 6, color: '#a8e6cf', fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <span>{p.avatar}</span>
                      {firstName(p.name)}
                      <span style={{ opacity: 0.6, marginLeft: 2 }}>×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notlar */}
            <div>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 4, display: 'block' }}>NOT (opsiyonel)</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Personele iletilecek not..."
                style={{
                  width: '100%', padding: '6px 8px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, color: '#fff', fontSize: 11, outline: 'none',
                  resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </div>

            {err && <div style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>{err}</div>}

            <div style={{ display: 'flex', gap: 6 }}>
              {formMode === 'edit' && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(248,113,113,0.12)',
                    border: '1px solid rgba(248,113,113,0.3)',
                    borderRadius: 8, color: '#f87171', fontSize: 11, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  title="Sil"
                >
                  <Trash2 size={12} />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1, padding: '8px',
                  background: 'rgba(168,230,207,0.2)',
                  border: '1px solid rgba(168,230,207,0.45)',
                  borderRadius: 8, color: '#a8e6cf', fontSize: 12, fontWeight: 800,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <Save size={12} />
                {saving ? 'Kaydediliyor...' : (formMode === 'edit' ? 'Güncelle & Bildir' : 'Kaydet & Gönder')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 4. SÜTUN — PERSONEL SEÇİCİ */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={11} color="#a8e6cf" /> PERSONEL
          </div>
          {formMode !== 'closed' && (
            <span style={{ fontSize: 10, color: '#a8e6cf', fontWeight: 800, padding: '2px 7px', background: 'rgba(168,230,207,0.15)', border: '1px solid rgba(168,230,207,0.3)', borderRadius: 4 }}>
              {formPersonnel.length} seçili
            </span>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
          <input
            value={searchPersonel}
            onChange={e => setSearchPersonel(e.target.value)}
            placeholder="Personel ara..."
            style={{
              width: '100%', padding: '7px 8px 7px 26px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, color: '#fff', fontSize: 11, outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 2 }}>
          {formMode === 'closed' ? (
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, padding: '12px 8px', textAlign: 'center', fontStyle: 'italic' }}>
              Görev seçince seçim aktif olur
            </div>
          ) : null}
          {filteredStaff.map(s => {
            const fixed = isFixedOnLeave(s.id, leaveRequests, selectedDate);
            const daily = !fixed && isDailyOnLeave(s.id, dailyOnLeave, selectedDate);
            const dbl = !fixed && isDoubleAssigned(s.id, tasks, selectedDate, editingTask?.id);
            const selected = !!formPersonnel.find(p => p.id === s.id);
            const disabled = fixed || formMode === 'closed';
            let bg = 'rgba(255,255,255,0.03)';
            let border = 'rgba(255,255,255,0.08)';
            let textColor = '#fff';
            let badge = '';
            let badgeColor = '';
            if (fixed) { bg = 'rgba(248,113,113,0.1)'; border = 'rgba(248,113,113,0.3)'; textColor = '#f87171'; badge = 'İZİNLİ'; badgeColor = '#f87171'; }
            else if (daily) { bg = 'rgba(251,191,36,0.08)'; border = 'rgba(251,191,36,0.25)'; textColor = '#fbbf24'; badge = 'günlük izin'; badgeColor = '#fbbf24'; }
            else if (dbl && !selected) { bg = 'rgba(251,146,60,0.08)'; border = 'rgba(251,146,60,0.3)'; textColor = '#fb923c'; badge = 'çakışma'; badgeColor = '#fb923c'; }
            if (selected) { bg = 'rgba(168,230,207,0.2)'; border = 'rgba(168,230,207,0.5)'; textColor = '#a8e6cf'; badge = 'SEÇİLİ'; badgeColor = '#a8e6cf'; }
            return (
              <button
                key={s.id}
                onClick={() => !disabled && togglePersonnel(s)}
                disabled={disabled}
                title={fixed ? 'Onaylı izinde' : daily ? 'Günlük izinde' : dbl ? 'Çakışma: başka göreve atanmış' : ''}
                style={{
                  padding: '7px 9px', borderRadius: 7,
                  background: bg, border: `1px solid ${border}`,
                  color: textColor, fontSize: 11, fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: formMode === 'closed' ? 0.4 : (fixed ? 0.55 : 1),
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0,
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{s.avatar}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, gap: 1 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', fontSize: 11, fontWeight: 700 }}>{s.name}</span>
                  <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 500 }}>{s.role}</span>
                </div>
                {selected && <Check size={12} />}
                {!selected && (fixed || daily || dbl) && <AlertCircle size={10} />}
                {badge && (
                  <span style={{ fontSize: 8, color: badgeColor, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 0 }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
