/**
 * PersonelIzinTalebi
 * Personel kendi izin taleplerini buradan gönderir.
 * Talepler doğrudan rotation-service'e (KV store) kaydedilir;
 * yönetici rotasyon sayfasının "İzinler" sekmesinde görür ve onaylar/reddeder.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Plus, Calendar, FileText, Clock,
  CheckCircle, XCircle, AlertCircle, Trash2, Send,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import {
  getStaffMembers,
  getLeaveRequests,
  saveLeaveRequest,
  deleteLeaveRequest,
  type StaffMember,
  type LeaveRequest,
  type UserRole,
} from '../services/rotation-service';
import { supabase } from '../lib/supabase';

/* ──────────────── Types ──────────────── */
interface Props {
  userName: string;
  userRole: UserRole;
  accessToken: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
}

type LeaveType = 'annual' | 'sick' | 'personal';
type DurationType = 'single' | 'multiple';

const LEAVE_TYPE_META: Record<LeaveType, { label: string; icon: string; color: string }> = {
  annual:   { label: 'Yıllık İzin',   icon: '🏖️', color: '#34d399' },
  sick:     { label: 'Hastalık İzni', icon: '🤒', color: '#fb923c' },
  personal: { label: 'Özel İzin',     icon: '🎯', color: '#a78bfa' },
};

/* ──────────────── Helper ──────────────── */
const today = () => new Date().toISOString().split('T')[0];

function calcDays(start: string, end: string, type: DurationType) {
  if (!start) return 0;
  const s = new Date(start);
  const e = type === 'single' ? s : (end ? new Date(end) : s);
  return Math.ceil(Math.abs(e.getTime() - s.getTime()) / 86400000) + 1;
}

/* ──────────────── Component ──────────────── */
export function PersonelIzinTalebi({ userName, userRole, accessToken, onNavigate, onLogout }: Props) {
  /* ── Auth ── */
  const [currentUserId, setCurrentUserId] = useState('');
  const [myStaff, setMyStaff]             = useState<StaffMember | null>(null);

  /* ── Data ── */
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading]       = useState(true);

  /* ── Form ── */
  const [showForm, setShowForm]           = useState(false);
  const [leaveType, setLeaveType]         = useState<LeaveType>('personal');
  const [durType, setDurType]             = useState<DurationType>('single');
  const [startDate, setStartDate]         = useState(today());
  const [endDate, setEndDate]             = useState(today());
  const [notes, setNotes]                 = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [formErr, setFormErr]             = useState('');
  const [successMsg, setSuccessMsg]       = useState('');

  /* ── Load ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setCurrentUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    loadData();
  }, [accessToken]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staff, leaves] = await Promise.all([
        getStaffMembers(accessToken),
        getLeaveRequests(accessToken),
      ]);
      // Mevcut kullanıcıyı bul
      const session = await supabase.auth.getSession();
      const uid = session.data.session?.user?.id || '';
      if (uid) setCurrentUserId(uid);

      const me = staff.find(s => s.id === uid) || staff.find(s => s.name === userName);
      setMyStaff(me || null);

      const mine = leaves.filter(l =>
        me ? l.personnelId === me.id : l.personnelName === userName
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMyRequests(mine);
    } catch (e) {
      console.error('PersonelIzinTalebi loadData error:', e);
    } finally {
      setLoading(false);
    }
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!startDate) { setFormErr('Lütfen tarih seçin.'); return; }
    if (durType === 'multiple' && !endDate) { setFormErr('Bitiş tarihi gerekli.'); return; }
    if (durType === 'multiple' && endDate < startDate) { setFormErr('Bitiş tarihi başlangıçtan önce olamaz.'); return; }
    if (!myStaff) { setFormErr('Personel bilgisi bulunamadı. Lütfen tekrar giriş yapın.'); return; }

    setFormErr('');
    setSubmitting(true);
    try {
      const days = calcDays(startDate, endDate, durType);
      const finalEnd = durType === 'single' ? startDate : endDate;

      await saveLeaveRequest({
        id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        personnelId:     myStaff.id,
        personnelName:   myStaff.name,
        personnelAvatar: myStaff.avatar,
        personnelRole:   myStaff.role,
        startDate,
        endDate: finalEnd,
        days,
        type: leaveType,
        notes: notes.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }, accessToken);

      setSuccessMsg('Talebiniz iletildi! Yöneticiniz onaylayınca bilgilendirileceksiniz. ✅');
      setTimeout(() => setSuccessMsg(''), 4000);

      // Reset form
      setShowForm(false);
      setLeaveType('personal');
      setDurType('single');
      setStartDate(today());
      setEndDate(today());
      setNotes('');

      await loadData();
    } catch (e) {
      console.error('İzin talebi gönderilemedi:', e);
      setFormErr('Bir hata oluştu, lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete (sadece pending) ── */
  const handleDelete = async (id: string) => {
    if (!confirm('Bu talebi geri çekmek istediğinize emin misiniz?')) return;
    await deleteLeaveRequest(id, accessToken);
    await loadData();
    setSuccessMsg('Talep geri çekildi.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  /* ─────────── Shared style tokens ─────────── */
  const card = {
    background:    'rgba(255,255,255,0.05)',
    backdropFilter:'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius:  20,
    border:        '1px solid rgba(255,255,255,0.1)',
  } as React.CSSProperties;

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties;

  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: 6,
    display: 'block',
  };

  /* ─────────────────── Render ─────────────────── */
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 55%, #0d0a2e 100%))',
      paddingBottom: 100,
    }}>

      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,5,30,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => onNavigate('rotation')}
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>
              İzin Talebi
            </h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              Rotasyon sistemine iletilir • Yönetici onaylar
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={{
              padding: '4px 10px',
              background: 'rgba(167,139,250,0.15)',
              border: '1px solid rgba(167,139,250,0.3)',
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 700,
              color: '#a78bfa',
            }}>
              🏖️ {myRequests.length} talep
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Başarı bildirimi ── */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(52,211,153,0.18), rgba(52,211,153,0.08))',
                border: '1px solid rgba(52,211,153,0.35)',
                borderRadius: 16,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <CheckCircle style={{ width: 18, height: 18, color: '#34d399', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#a7f3d0', fontWeight: 600 }}>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bilgi kartı ── */}
        <div style={{ ...card, padding: '14px 16px', borderLeft: '3px solid #a78bfa' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle style={{ width: 16, height: 16, color: '#a78bfa', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#e9d5ff', margin: '0 0 3px' }}>
                Nasıl çalışır?
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
                Gönderdiğiniz talep <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Rotasyon → İzinler</strong> sekmesine düşer.
                Yöneticiniz orada onaylar veya reddeder. Sonucu bu sayfada görebilirsiniz.
              </p>
            </div>
          </div>
        </div>

        {/* ── Yeni Talep Butonu / Form Toggle ── */}
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: showForm
              ? 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.1))'
              : 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(167,139,250,0.06))',
            border: showForm
              ? '1px solid rgba(167,139,250,0.5)'
              : '1px solid rgba(167,139,250,0.25)',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'rgba(167,139,250,0.25)',
            border: '1px solid rgba(167,139,250,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {showForm
              ? <ChevronUp style={{ width: 18, height: 18, color: '#a78bfa' }} />
              : <Plus style={{ width: 18, height: 18, color: '#a78bfa' }} />
            }
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#e9d5ff', margin: 0 }}>
              {showForm ? 'Formu Kapat' : 'Yeni İzin Talebi Oluştur'}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(167,139,250,0.6)', margin: 0 }}>
              {showForm ? 'İptal et' : 'Yıllık, hastalık veya özel izin'}
            </p>
          </div>
        </button>

        {/* ── Form ── */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ ...card, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* İzin Türü */}
                <div>
                  <span style={labelStyle}>İzin Türü</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(Object.entries(LEAVE_TYPE_META) as [LeaveType, typeof LEAVE_TYPE_META[LeaveType]][]).map(([key, meta]) => (
                      <button
                        key={key}
                        onClick={() => setLeaveType(key)}
                        style={{
                          flex: 1,
                          padding: '10px 6px',
                          borderRadius: 14,
                          border: leaveType === key
                            ? `1px solid ${meta.color}60`
                            : '1px solid rgba(255,255,255,0.1)',
                          background: leaveType === key
                            ? `${meta.color}18`
                            : 'rgba(255,255,255,0.04)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          cursor: 'pointer', transition: 'all 0.18s',
                          boxShadow: leaveType === key ? `0 0 12px ${meta.color}25` : 'none',
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{meta.icon}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                          color: leaveType === key ? meta.color : 'rgba(255,255,255,0.4)',
                          textAlign: 'center', lineHeight: 1.3,
                        }}>
                          {meta.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Süre Tipi */}
                <div>
                  <span style={labelStyle}>Süre</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['single', 'multiple'] as DurationType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setDurType(t)}
                        style={{
                          flex: 1, padding: '10px',
                          borderRadius: 12,
                          border: durType === t
                            ? '1px solid rgba(167,139,250,0.5)'
                            : '1px solid rgba(255,255,255,0.1)',
                          background: durType === t
                            ? 'rgba(167,139,250,0.15)'
                            : 'rgba(255,255,255,0.04)',
                          color: durType === t ? '#e9d5ff' : 'rgba(255,255,255,0.4)',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t === 'single' ? '📅 Tek Gün' : '📆 Çok Gün'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tarih(ler) */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <span style={labelStyle}>Başlangıç</span>
                    <input
                      type="date"
                      value={startDate}
                      min={today()}
                      onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                      style={inputStyle}
                    />
                  </div>
                  {durType === 'multiple' && (
                    <div style={{ flex: 1 }}>
                      <span style={labelStyle}>Bitiş</span>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={e => setEndDate(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  )}
                </div>

                {/* Gün sayısı badge */}
                {startDate && (
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(52,211,153,0.1)',
                    border: '1px solid rgba(52,211,153,0.25)',
                    borderRadius: 10,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Calendar style={{ width: 14, height: 14, color: '#34d399' }} />
                    <span style={{ fontSize: 12, color: '#a7f3d0', fontWeight: 700 }}>
                      Toplam: {calcDays(startDate, endDate, durType)} gün
                    </span>
                  </div>
                )}

                {/* Notlar */}
                <div>
                  <span style={labelStyle}>Açıklama (isteğe bağlı)</span>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="İzin talebinizle ilgili not ekleyin..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                  />
                </div>

                {/* Hata */}
                {formErr && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 12,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <XCircle style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#fca5a5' }}>{formErr}</span>
                  </div>
                )}

                {/* Gönder */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 16,
                    background: submitting
                      ? 'rgba(167,139,250,0.2)'
                      : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 14, fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: submitting ? 'none' : '0 4px 20px rgba(168,85,247,0.4)',
                    transition: 'all 0.2s',
                  }}
                >
                  {submitting
                    ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Gönderiliyor...</>
                    : <><Send style={{ width: 16, height: 16 }} /> Talebi Gönder</>
                  }
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Taleplerim ── */}
        <div>
          {/* Başlık */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <div style={{
              height: 1, flex: 1,
              background: 'linear-gradient(to right, rgba(167,139,250,0.4), transparent)',
            }} />
            <span style={{
              fontSize: 10, fontWeight: 800, color: '#a78bfa',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              background: 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.28)',
              borderRadius: 20, padding: '3px 10px',
            }}>
              Taleplerim
            </span>
            <div style={{
              height: 1, flex: 1,
              background: 'linear-gradient(to left, rgba(167,139,250,0.4), transparent)',
            }} />
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)' }}>
              <Loader2 style={{ width: 24, height: 24, margin: '0 auto 8px' }} className="animate-spin" />
              <p style={{ fontSize: 13 }}>Yükleniyor...</p>
            </div>
          )}

          {/* Empty */}
          {!loading && myRequests.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏖️</div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                Henüz izin talebiniz yok
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                Yukarıdaki butona tıklayarak talep oluşturun
              </p>
            </div>
          )}

          {/* Requests list */}
          {!loading && myRequests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myRequests.map(req => {
                const meta = LEAVE_TYPE_META[req.type];
                const isPending  = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';

                const statusColor = isApproved ? '#34d399' : isPending ? '#fbbf24' : '#f87171';
                const statusLabel = isApproved ? '✅ Onaylandı' : isPending ? '⏳ Beklemede' : '❌ Reddedildi';

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      ...card,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {/* Üst renk çizgisi */}
                    <div style={{
                      height: 3,
                      background: `linear-gradient(to right, ${statusColor}, transparent)`,
                    }} />

                    <div style={{ padding: '14px 16px' }}>
                      {/* Üst satır: tür + gün + durum */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: `${meta.color}18`,
                            border: `1px solid ${meta.color}35`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20, flexShrink: 0,
                          }}>
                            {meta.icon}
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>
                              {meta.label}
                            </p>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                              <Clock style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                              {new Date(req.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 22, fontWeight: 900, color: statusColor, lineHeight: 1 }}>
                            {req.days}
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>GÜN</div>
                        </div>
                      </div>

                      {/* Tarih aralığı */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        marginBottom: 10,
                      }}>
                        <Calendar style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                          {req.startDate}
                          {req.startDate !== req.endDate && <> → {req.endDate}</>}
                        </span>
                      </div>

                      {/* Notlar */}
                      {req.notes && (
                        <div style={{
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 10,
                          marginBottom: 10,
                          display: 'flex', alignItems: 'flex-start', gap: 6,
                        }}>
                          <FileText style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: 1 }} />
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                            {req.notes}
                          </span>
                        </div>
                      )}

                      {/* Durum badge + sil butonu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: `${statusColor}15`,
                          border: `1px solid ${statusColor}35`,
                          borderRadius: 10,
                          textAlign: 'center',
                          fontSize: 12, fontWeight: 700, color: statusColor,
                        }}>
                          {statusLabel}
                        </div>

                        {/* Beklemedekini geri çek */}
                        {isPending && (
                          <button
                            onClick={() => handleDelete(req.id)}
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.25)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', flexShrink: 0,
                            }}
                            title="Talebi geri çek"
                          >
                            <Trash2 style={{ width: 14, height: 14, color: '#f87171' }} />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
