/**
 * SuperAdminPanel — Multi-tenant şirket yönetimi
 * Sadece superadmin rolü erişebilir.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Users, ChevronRight, X,
  Loader2, CheckCircle, Eye, EyeOff,
  RefreshCw, UserPlus, Edit3, ArrowLeft, Shield, Globe,
  Building2, Clock, CheckCircle2, XCircle, Ghost, Trash2, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/* ─── Types ─── */
interface Company {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  status: 'active' | 'suspended';
  createdAt: string;
  userCount: number;
}

interface CompanyUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  last_sign_in: string;
}

interface CompanyApplication {
  id: string;
  companyName: string;
  companyCode: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  rejectedAt?: string;
}

interface Props {
  userName: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  onSwitchCompany?: (companyId: string | null, targetUserId?: string) => void | Promise<void>;
}

/* ─── Rol etiketleri ─── */
const ROLE_LABELS: Record<string, string> = {
  yonetici:   'Yönetici',
  'ust-mudur':'Üst Müdür',
  mudur:       'Müdür',
  operasyon:   'Operasyon',
  personel:    'Personel',
  idari:       'İdari Görevli',
  bekleyen:    'Bekleyen',
  superadmin:  'Yönetici',
};

const ROLE_COLORS: Record<string, string> = {
  yonetici:   '#a855f7',
  'ust-mudur':'#a855f7',
  mudur:       '#6366f1',
  operasyon:   '#fb923c',
  personel:    '#34d399',
  idari:       '#60a5fa',
  bekleyen:    '#9ca3af',
  superadmin:  '#fbbf24',
};

/* ─── Renk seçenekleri ─── */
const PRESET_COLORS = [
  '#a855f7', '#6366f1', '#3b82f6', '#06b6d4', '#9dd9ea',
  '#34d399', '#fbbf24', '#fb923c', '#f43f5e', '#d4b5f7',
];

/* ─── Glassmorphism yardımcısı ─── */
const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background:    'rgba(255,255,255,0.05)',
  border:        '1px solid rgba(255,255,255,0.10)',
  backdropFilter:'blur(20px)',
  borderRadius:  20,
  ...extra,
});

const glassCard = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  background:    `linear-gradient(135deg, ${color}12, ${color}06)`,
  border:        `1px solid ${color}30`,
  backdropFilter:'blur(20px)',
  borderRadius:  16,
  ...extra,
});

/* ─── Input ─── */
function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 13px', borderRadius: 12, fontSize: 14,
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

/* ─── Modal kabı ─── */
function Modal({ title, onClose, children, accentColor = '#a855f7' }: {
  title: string; onClose: () => void; children: React.ReactNode; accentColor?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: 'var(--app-bg, linear-gradient(170deg, #120830 0%, #1a0a3c 45%, #0f0620 100%))',
          borderRadius: '24px 24px 0 0',
          borderTop: `1px solid ${accentColor}30`,
          borderLeft: `1px solid rgba(255,255,255,0.08)`,
          borderRight: `1px solid rgba(255,255,255,0.08)`,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 28, borderRadius: 4, background: accentColor, boxShadow: `0 0 12px ${accentColor}70` }} />
          <p style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>{title}</p>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Aksiyon butonu ─── */
function Btn({ label, color = '#a855f7', onClick, loading = false, icon, secondary = false, danger = false }: {
  label: string; color?: string; onClick: () => void; loading?: boolean;
  icon?: React.ReactNode; secondary?: boolean; danger?: boolean;
}) {
  const bg = danger ? 'rgba(239,68,68,0.15)' : secondary ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg, ${color}80, ${color}50)`;
  const border = danger ? '1px solid rgba(239,68,68,0.35)' : secondary ? '1px solid rgba(255,255,255,0.12)' : `1px solid ${color}60`;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '11px 18px', borderRadius: 12, border, background: bg,
        color: danger ? '#f87171' : '#fff', fontWeight: 700, fontSize: 13,
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
        width: '100%', boxSizing: 'border-box', transition: 'all 0.15s',
        boxShadow: secondary || danger ? 'none' : `0 4px 18px ${color}30`,
      }}
    >
      {loading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ══════════════════════════════════════════════════════════ */
export function SuperAdminPanel({ userName, onNavigate, onLogout, onSwitchCompany }: Props) {
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Görünüm
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selected, setSelected] = useState<Company | null>(null);

  // Panel sekme
  const [panelTab, setPanelTab] = useState<'companies' | 'applications'>('companies');

  // Başvurular
  const [applications, setApplications] = useState<CompanyApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appActionLoading, setAppActionLoading] = useState<string | null>(null);

  // Modal'lar
  const [showCreate,        setShowCreate]        = useState(false);
  const [showEdit,          setShowEdit]          = useState(false);
  const [showAddUser,       setShowAddUser]       = useState(false);
  const [showUsers,         setShowUsers]         = useState(false);
  const [showMigrate,       setShowMigrate]       = useState(false);
  const [showDeleteCompany, setShowDeleteCompany] = useState(false);
  const [deleteCompanyLoading, setDeleteCompanyLoading] = useState(false);

  const [confirmDeleteText, setConfirmDeleteText] = useState('');

  // Şirket kullanıcıları
  const [companyUsers,   setCompanyUsers]   = useState<CompanyUser[]>([]);

  // Gizli geçiş: şirket adına 6x tıklama
  const [jumpTapCount, setJumpTapCount] = useState(0);
  const jumpTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleJumpTap = async (company: Company) => {
    if (!onSwitchCompany) return;
    const next = jumpTapCount + 1;
    if (next >= 6) {
      setJumpTapCount(0);
      if (jumpTapTimer.current) clearTimeout(jumpTapTimer.current);
      const yonetici = companyUsers.find(u => u.role === 'yonetici');
      await onSwitchCompany(company.id, yonetici?.id);
      onNavigate('dashboard');
      return;
    }
    setJumpTapCount(next);
    if (jumpTapTimer.current) clearTimeout(jumpTapTimer.current);
    jumpTapTimer.current = setTimeout(() => setJumpTapCount(0), 2000);
  };
  const [usersLoading,   setUsersLoading]   = useState(false);

  // Migration
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [migrateResult,  setMigrateResult]  = useState<any>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Şirketleri yükle ── */
  const loadCompanies = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res  = await fetch(`${SERVER}/superadmin/companies`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Şirketler yüklenemedi');
      setCompanies(data.companies || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Başvuruları yükle ── */
  const loadApplications = async () => {
    setAppsLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/superadmin/applications`, { headers });
      const data = await res.json();
      if (res.ok) {
        setApplications(data.applications || []);
      } else {
        setApplications([]);
      }
    } catch (_) {
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);
  useEffect(() => {
    if (panelTab === 'applications') loadApplications();
  }, [panelTab]);

  /* ── Başvuru onayla / reddet ── */
  const handleApplicationAction = async (appId: string, action: 'approve' | 'reject') => {
    setAppActionLoading(appId + action);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/superadmin/applications/${appId}/${action}`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(action === 'approve' ? '✅ Başvuru onaylandı, şirket oluşturuldu!' : '❌ Başvuru reddedildi.');
        loadApplications();
        if (action === 'approve') loadCompanies();
      } else {
        showToast('⚠️ ' + (data.error || 'İşlem başarısız'), false);
      }
    } catch (e: any) {
      showToast('⚠️ ' + e.message, false);
    } finally {
      setAppActionLoading(null);
    }
  };

  /* ── Başvuru sil ── */
  const handleDeleteApplication = async (appId: string) => {
    setAppActionLoading(appId + 'delete');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/superadmin/applications/${appId}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        showToast('🗑️ Başvuru silindi.');
        loadApplications();
      } else {
        showToast('⚠️ ' + (data.error || 'Silinemedi'), false);
      }
    } catch (e: any) {
      showToast('⚠️ ' + e.message, false);
    } finally {
      setAppActionLoading(null);
    }
  };

  /* ── Şirketi tamamen sil ── */
  const handleDeleteCompany = async () => {
    if (!selected) return;
    setDeleteCompanyLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/superadmin/companies/${selected.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🗑️ ${selected.name} silindi. ${data.deletedUsers} kullanıcı kaldırıldı.`);
        setShowDeleteCompany(false);
        setConfirmDeleteText('');
        setView('list');
        setSelected(null);
        loadCompanies();
      } else {
        showToast('⚠️ ' + (data.error || 'Silinemedi'), false);
      }
    } catch (e: any) {
      showToast('⚠️ ' + e.message, false);
    } finally {
      setDeleteCompanyLoading(false);
    }
  };

  /* ── Şirket kullanıcılarını yükle ── */
  const loadCompanyUsers = async (companyId: string) => {
    setUsersLoading(true);
    setCompanyUsers([]);
    try {
      const headers = await authHeaders();
      const res  = await fetch(`${SERVER}/superadmin/companies/${companyId}/users`, { headers });
      const data = await res.json();
      if (res.ok) setCompanyUsers(data.users || []);
    } catch (_) {}
    setUsersLoading(false);
  };

  /* ── Detay ekranı ── */
  const openDetail = (company: Company) => {
    setSelected(company);
    setView('detail');
    loadCompanyUsers(company.id);
  };

  /* ─────────────────────────────────────────── */
  /* YENİ ŞİRKET FORMU                          */
  /* ─────────────────────────────────────────── */
  function CreateCompanyForm({ onClose }: { onClose: () => void }) {
    const [id,   setId]   = useState('');
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState('🏢');
    const [color, setColor] = useState('#a855f7');
    const [desc,  setDesc]  = useState('');
    const [saving, setSaving] = useState(false);
    const [err,    setErr]    = useState('');

    const save = async () => {
      if (!id.trim() || !name.trim()) { setErr('Company ID ve isim zorunludur.'); return; }
      setSaving(true); setErr('');
      try {
        const headers = await authHeaders();
        const res  = await fetch(`${SERVER}/superadmin/companies`, {
          method: 'POST', headers,
          body: JSON.stringify({ id: id.trim(), name: name.trim(), emoji, color, description: desc }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(`✅ ${name} şirketi oluşturuldu!`);
        await loadCompanies();
        onClose();
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <>
        <Field label="COMPANY ID (benzersiz, küçük harf)" value={id} onChange={setId} placeholder="ornek-sirket" />
        <Field label="ŞİRKET ADI" value={name} onChange={setName} placeholder="Örnek Şirket A.Ş." />

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>EMOJİ</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['🏢','✦','🖼','🔷','📸','🎯','⭐','🌟','💎','🏆'].map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                style={{ width: 36, height: 36, fontSize: 18, borderRadius: 10, cursor: 'pointer',
                  background: emoji === e ? 'rgba(var(--app-accent-rgb),0.25)' : 'rgba(255,255,255,0.06)',
                  border: emoji === e ? '1px solid var(--app-accent, #a855f7)' : '1px solid rgba(255,255,255,0.12)' }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>TEMA RENGİ</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: color === c ? `0 0 10px ${c}` : 'none' }} />
            ))}
          </div>
        </div>

        <Field label="AÇIKLAMA (opsiyonel)" value={desc} onChange={setDesc} placeholder="Şirket hakkında kısa açıklama" />

        {err && (
          <div style={{ padding: '10px 13px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>⚠️ {err}</p>
          </div>
        )}
        <Btn label={saving ? 'Oluşturuluyor…' : 'Şirketi Oluştur'} color={color} onClick={save} loading={saving}
          icon={<Plus style={{ width: 14, height: 14 }} />} />
      </>
    );
  }

  /* ─────────────────────────────────────────── */
  /* ŞİRKET DÜZENLE FORMU                       */
  /* ─────────────────────────────────────────── */
  function EditCompanyForm({ company, onClose }: { company: Company; onClose: () => void }) {
    const [name,   setName]   = useState(company.name);
    const [emoji,  setEmoji]  = useState(company.emoji);
    const [color,  setColor]  = useState(company.color);
    const [desc,   setDesc]   = useState(company.description);
    const [status, setStatus] = useState(company.status);
    const [saving, setSaving] = useState(false);
    const [err,    setErr]    = useState('');

    const save = async () => {
      setSaving(true); setErr('');
      try {
        const headers = await authHeaders();
        const res  = await fetch(`${SERVER}/superadmin/companies/${company.id}`, {
          method: 'PUT', headers,
          body: JSON.stringify({ name, emoji, color, description: desc, status }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(`✅ ${name} güncellendi!`);
        await loadCompanies();
        setSelected(prev => prev ? { ...prev, name, emoji, color, description: desc, status } : prev);
        onClose();
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <>
        <Field label="ŞİRKET ADI" value={name} onChange={setName} />

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>EMOJİ</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['🏢','✦','🖼','🔷','📸','🎯','⭐','🌟','💎','🏆'].map(e => (
              <button key={e} onClick={() => setEmoji(e)}
                style={{ width: 36, height: 36, fontSize: 18, borderRadius: 10, cursor: 'pointer',
                  background: emoji === e ? 'rgba(var(--app-accent-rgb),0.25)' : 'rgba(255,255,255,0.06)',
                  border: emoji === e ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.12)' }}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>TEMA RENGİ</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: color === c ? `0 0 10px ${c}` : 'none' }} />
            ))}
          </div>
        </div>

        <Field label="AÇIKLAMA" value={desc} onChange={setDesc} />

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>DURUM</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['active', 'suspended'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                style={{
                  flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                  background: status === s ? (s === 'active' ? 'rgba(52,211,153,0.20)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.05)',
                  border: status === s ? (s === 'active' ? '1px solid rgba(52,211,153,0.50)' : '1px solid rgba(239,68,68,0.40)') : '1px solid rgba(255,255,255,0.10)',
                  color: status === s ? (s === 'active' ? '#34d399' : '#f87171') : 'rgba(255,255,255,0.45)',
                }}>
                {s === 'active' ? '✅ Aktif' : '🔴 Askıya Alındı'}
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div style={{ padding: '10px 13px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>⚠️ {err}</p>
          </div>
        )}
        <Btn label={saving ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'} color={color} onClick={save} loading={saving}
          icon={<CheckCircle style={{ width: 14, height: 14 }} />} />
      </>
    );
  }

  /* ─────────────────────────────────────────── */
  /* KULLANICI EKLE FORMU                       */
  /* ─────────────────────────────────────────── */
  function AddUserForm({ company, onClose }: { company: Company; onClose: () => void }) {
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [name,     setName]     = useState('');
    const [phone,    setPhone]    = useState('');
    const [role,     setRole]     = useState('yonetici');
    const [showPw,   setShowPw]   = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [err,      setErr]      = useState('');

    const save = async () => {
      if (!email || !password || !name) { setErr('E-posta, şifre ve ad soyad zorunludur.'); return; }
      if (password.length < 6) { setErr('Şifre en az 6 karakter olmalıdır.'); return; }
      setSaving(true); setErr('');
      try {
        const headers = await authHeaders();
        const res  = await fetch(`${SERVER}/superadmin/companies/${company.id}/create-admin`, {
          method: 'POST', headers,
          body: JSON.stringify({ email, password, full_name: name, phone, role }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(`✅ ${name} (${ROLE_LABELS[role]}) oluşturuldu!`);
        loadCompanyUsers(company.id);
        await loadCompanies();
        onClose();
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setSaving(false);
      }
    };

    const allRoles = ['yonetici','ust-mudur','mudur','operasyon','idari','personel'];

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '10px 13px', borderRadius: 12, background: `${company.color}12`, border: `1px solid ${company.color}30` }}>
          <span style={{ fontSize: 22 }}>{company.emoji}</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>{company.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: company.color }}>{company.id}</p>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>ROL</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allRoles.map(r => {
              const rc = ROLE_COLORS[r] || '#a855f7';
              const isActive = role === r;
              return (
                <button key={r} onClick={() => setRole(r)}
                  style={{
                    padding: '6px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: isActive ? `${rc}25` : 'rgba(255,255,255,0.05)',
                    border: isActive ? `1px solid ${rc}60` : '1px solid rgba(255,255,255,0.10)',
                    color: isActive ? rc : 'rgba(255,255,255,0.45)',
                    boxShadow: isActive ? `0 0 8px ${rc}30` : 'none',
                  }}>
                  {ROLE_LABELS[r]}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="AD SOYAD" value={name}  onChange={setName}  placeholder="Ali Veli" />
        <Field label="E-POSTA"  value={email} onChange={setEmail} placeholder="ali@sirket.com" />

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>ŞİFRE</label>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              style={{ width: '100%', padding: '10px 40px 10px 13px', borderRadius: 12, fontSize: 14,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={() => setShowPw(p => !p)} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>
              {showPw ? <EyeOff style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }} />
                      : <Eye    style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }} />}
            </button>
          </div>
        </div>

        <Field label="TELEFON (opsiyonel)" value={phone} onChange={setPhone} placeholder="+90 555 000 0000" />

        {err && (
          <div style={{ padding: '10px 13px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>⚠️ {err}</p>
          </div>
        )}
        <Btn label={saving ? 'Oluşturuluyor…' : 'Kullanıcıyı Oluştur'} color={company.color} onClick={save} loading={saving}
          icon={<UserPlus style={{ width: 14, height: 14 }} />} />
      </>
    );
  }

  /* ─────────────────────────────────────────── */
  /* ŞİRKET LİSTESİ + SEKMELER                 */
  /* ─────────────────────────────────────────── */
  const renderList = () => (
    <div style={{ paddingBottom: 100 }}>
      {/* Başlık */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(251,191,36,0.40)' }}>
            <Globe style={{ width: 18, height: 18, color: '#fff' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Şirket Yönetimi</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(251,191,36,0.70)' }}>Multi-Tenant Kontrol Paneli</p>
          </div>
        </div>

        {/* Özet istatistik */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
          {[
            { label: 'Şirket',    val: companies.length, color: '#fbbf24' },
            { label: 'Aktif',     val: companies.filter(c => c.status === 'active').length, color: '#34d399' },
            { label: 'Kullanıcı', val: companies.reduce((s, c) => s + (c.userCount || 0), 0), color: '#9dd9ea' },
          ].map(s => (
            <div key={s.label} style={{ ...glassCard(s.color), padding: '12px 10px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</p>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sekmeler ── */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 4, gap: 4 }}>
          <button
            onClick={() => setPanelTab('companies')}
            style={{
              flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: panelTab === 'companies' ? 'linear-gradient(135deg, rgba(251,191,36,0.30), rgba(245,158,11,0.20))' : 'transparent',
              border: panelTab === 'companies' ? '1px solid rgba(251,191,36,0.45)' : '1px solid transparent',
              color: panelTab === 'companies' ? '#fbbf24' : 'rgba(255,255,255,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Building2 style={{ width: 13, height: 13 }} />
            Şirketler
          </button>
          <button
            onClick={() => setPanelTab('applications')}
            style={{
              flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: panelTab === 'applications' ? 'linear-gradient(135deg, rgba(167,199,231,0.30), rgba(167,199,231,0.15))' : 'transparent',
              border: panelTab === 'applications' ? '1px solid rgba(167,199,231,0.45)' : '1px solid transparent',
              color: panelTab === 'applications' ? '#a7c7e7' : 'rgba(255,255,255,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              position: 'relative',
            }}
          >
            <Clock style={{ width: 13, height: 13 }} />
            Başvurular
            {applications.filter(a => a.status === 'pending').length > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 8,
                minWidth: 16, height: 16, borderRadius: 8,
                background: '#ef4444', color: '#fff',
                fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>
                {applications.filter(a => a.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Şirketler ── */}
      {panelTab === 'companies' && (
        <>
          <div style={{ padding: '0 20px 12px' }}>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, cursor: 'pointer', fontWeight: 700, fontSize: 14,
                background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.15))',
                border: '1px solid rgba(251,191,36,0.45)',
                color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 20px rgba(251,191,36,0.20)',
              }}>
              <Plus style={{ width: 16, height: 16 }} />
              Yeni Şirket Oluştur
            </button>
          </div>

          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <Loader2 style={{ width: 28, height: 28, color: '#fbbf24' }} className="animate-spin" />
              </div>
            ) : error ? (
              <div style={{ ...glassCard('#ef4444'), padding: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>⚠️ {error}</p>
              </div>
            ) : companies.map(company => (
              <motion.div
                key={company.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => openDetail(company)}
                style={{ ...glassCard(company.color), padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: `${company.color}20`, border: `1px solid ${company.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: `0 0 12px ${company.color}25` }}>
                  {company.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.name}</p>
                    {company.status === 'suspended' && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 6, padding: '1px 5px' }}>ASKIDA</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: company.color, fontWeight: 600, background: `${company.color}15`, borderRadius: 6, padding: '1px 6px', border: `1px solid ${company.color}30` }}>{company.id}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)' }}>👥 {company.userCount} kullanıcı</span>
                  </div>
                  {company.description && (
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.40)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.description}</p>
                  )}
                </div>
                <ChevronRight style={{ width: 16, height: 16, color: `${company.color}60`, flexShrink: 0 }} />
              </motion.div>
            ))}
          </div>


        </>
      )}

      {/* ── Başvurular ── */}
      {panelTab === 'applications' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {appsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <Loader2 style={{ width: 24, height: 24, color: '#a7c7e7' }} className="animate-spin" />
            </div>
          ) : applications.length === 0 ? (
            <div style={{ ...glass(), padding: 28, textAlign: 'center', marginTop: 8 }}>
              <p style={{ margin: 0, fontSize: 30 }}>📋</p>
              <p style={{ margin: '10px 0 4px', fontSize: 14, fontWeight: 700, color: '#fff' }}>Bekleyen Başvuru Yok</p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                Şirketler <span style={{ color: '#a7c7e7' }}>/apply</span> sayfasından başvuru yapabilir.
              </p>
            </div>
          ) : (
            applications.map(app => {
              const isPending = app.status === 'pending';
              const statusColor = isPending ? '#fbbf24' : app.status === 'approved' ? '#34d399' : '#ef4444';
              const statusLabel = isPending ? 'Bekliyor' : app.status === 'approved' ? 'Onaylandı' : 'Reddedildi';
              return (
                <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ ...glassCard(statusColor), padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' }}>{app.companyName}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#a7c7e7', background: 'rgba(167,199,231,0.15)', border: '1px solid rgba(167,199,231,0.30)', borderRadius: 6, padding: '1px 7px' }}>
                          Kod: {app.companyCode}
                        </span>
                        {app.sector && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{app.sector}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 800, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}35`, borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>
                      {statusLabel}
                    </span>
                  </div>

                  {app.description && (
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{app.description}</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12 }}>
                    {app.contactEmail && <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>📧 {app.contactEmail}</p>}
                    {app.contactPhone && <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>📞 {app.contactPhone}</p>}
                    {app.adminName && <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>👑 Yönetici: {app.adminName} ({app.adminEmail})</p>}
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.30)' }}>
                      🕐 {new Date(app.submittedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {isPending ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: 8 }}>
                      <button
                        onClick={() => handleApplicationAction(app.id, 'approve')}
                        disabled={!!appActionLoading}
                        style={{ padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.45)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: appActionLoading === app.id + 'approve' ? 0.6 : 1 }}
                      >
                        {appActionLoading === app.id + 'approve' ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <CheckCircle2 style={{ width: 13, height: 13 }} />}
                        Onayla
                      </button>
                      <button
                        onClick={() => handleApplicationAction(app.id, 'reject')}
                        disabled={!!appActionLoading}
                        style={{ padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: 'rgba(239,68,68,0.13)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: appActionLoading === app.id + 'reject' ? 0.6 : 1 }}
                      >
                        {appActionLoading === app.id + 'reject' ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <XCircle style={{ width: 13, height: 13 }} />}
                        Reddet
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Bu başvuruyu kalıcı olarak silmek istediğinize emin misiniz?')) handleDeleteApplication(app.id); }}
                        disabled={!!appActionLoading}
                        style={{ padding: '10px', borderRadius: 10, cursor: 'pointer', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: appActionLoading === app.id + 'delete' ? 0.6 : 1 }}
                      >
                        {appActionLoading === app.id + 'delete' ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Trash2 style={{ width: 13, height: 13 }} />}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { if (window.confirm('Bu başvuruyu kalıcı olarak silmek istediğinize emin misiniz?')) handleDeleteApplication(app.id); }}
                        disabled={!!appActionLoading}
                        style={{ padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 11, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', display: 'flex', alignItems: 'center', gap: 5, opacity: appActionLoading === app.id + 'delete' ? 0.6 : 1 }}
                      >
                        {appActionLoading === app.id + 'delete' ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <Trash2 style={{ width: 11, height: 11 }} />}
                        Sil
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}

          <button onClick={loadApplications}
            style={{ width: '100%', padding: '11px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <RefreshCw style={{ width: 13, height: 13 }} />
            Yenile
          </button>
        </div>
      )}
    </div>
  );

  /* ─────────────────────────────────────────── */
  /* ŞİRKET DETAY GÖRÜNÜMü                     */
  /* ─────────────────────────────────────────── */
  const renderDetail = () => {
    if (!selected) return null;
    const c = selected;

    return (
      <div style={{ paddingBottom: 100 }}>
        {/* Üst bar */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => setView('list')}
            style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft style={{ width: 16, height: 16, color: '#fff' }} />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>{c.emoji} {c.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: c.color }}>{c.id}</p>
          </div>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.status === 'active' ? '#34d399' : '#ef4444', boxShadow: `0 0 8px ${c.status === 'active' ? '#34d399' : '#ef4444'}` }} />
        </div>

        {/* Header kart */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ ...glassCard(c.color), padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Kullanıcı',   val: c.userCount || 0, icon: '👥', color: c.color },
                { label: 'Durum', val: c.status === 'active' ? 'Aktif' : 'Askıda', icon: c.status === 'active' ? '✅' : '🔴', color: c.status === 'active' ? '#34d399' : '#ef4444' },
                { label: 'Oluşturulma', val: c.createdAt ? new Date(c.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—', icon: '📅', color: 'rgba(255,255,255,0.5)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 18 }}>{s.icon}</p>
                  <p style={{ margin: '4px 0 1px', fontSize: 13, fontWeight: 700, color: s.color }}>{s.val}</p>
                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.40)' }}>{s.label}</p>
                </div>
              ))}
            </div>
            {c.description && (
              <p style={{ margin: '12px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.50)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                {c.description}
              </p>
            )}
          </div>
        </div>

        {/* Aksiyon butonları */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => setShowAddUser(true)} style={{
              padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: `linear-gradient(135deg, ${c.color}30, ${c.color}15)`,
              border: `1px solid ${c.color}50`, color: c.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <UserPlus style={{ width: 14, height: 14 }} /> Kullanıcı Ekle
            </button>
            <button onClick={() => setShowUsers(true)} style={{
              padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.70)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Users style={{ width: 14, height: 14 }} /> Kullanıcıları Gör
            </button>
          </div>
          <button onClick={() => setShowEdit(true)} style={{
            padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Edit3 style={{ width: 14, height: 14 }} /> Şirket Ayarlarını Düzenle
          </button>

          {/* ── Tehlike Bölgesi ── */}
          <div style={{ marginTop: 8, padding: '14px 16px', borderRadius: 14, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: 'rgba(239,68,68,0.70)', letterSpacing: '0.08em' }}>
              ⚠️ TEHLİKE BÖLGESİ
            </p>
            <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}>
              Şirketi sildiğinizde tüm kullanıcılar, mekanlar, primler ve şirkete ait tüm veriler <strong style={{ color: '#f87171' }}>kalıcı olarak</strong> silinir. Bu işlem geri alınamaz.
            </p>
            <button
              onClick={() => { setConfirmDeleteText(''); setShowDeleteCompany(true); }}
              style={{
                width: '100%', padding: '11px', borderRadius: 11, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.40)',
                color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Trash2 style={{ width: 14, height: 14 }} /> Şirketi Kalıcı Olarak Sil
            </button>
          </div>
        </div>

        {/* Kullanıcı listesi (inline) */}
        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 700, letterSpacing: '0.10em' }}>
            KULLANICILAR ({companyUsers.length})
          </p>
          {usersLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Loader2 style={{ width: 22, height: 22, color: c.color }} className="animate-spin" />
            </div>
          ) : companyUsers.length === 0 ? (
            <div style={{ ...glass(), padding: '20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 24 }}>👤</p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>Henüz kullanıcı yok</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>İlk yöneticiyi oluşturmak için "Kullanıcı Ekle"ye tıklayın</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {companyUsers.map(u => {
                const rc = ROLE_COLORS[u.role] || '#9ca3af';
                return (
                  <div key={u.id} style={{ ...glassCard(rc, { padding: '12px 14px' }), display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      onClick={() => u.role === 'yonetici' ? handleJumpTap(c) : undefined}
                      style={{ width: 34, height: 34, borderRadius: 10, background: `${rc}20`, border: `1px solid ${rc}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, cursor: u.role === 'yonetici' ? 'pointer' : 'default' }}>
                      {u.role === 'yonetici' ? '👑' : u.role === 'personel' ? '📸' : u.role === 'idari' ? '📋' : '💼'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || '—'}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.40)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: rc, background: `${rc}18`, border: `1px solid ${rc}35`, borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────── */
  /* RENDER                                     */
  /* ─────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
              zIndex: 10001, maxWidth: 340, width: '90%',
              background: toast.ok ? 'linear-gradient(135deg, rgba(52,211,153,0.25), rgba(52,211,153,0.12))' : 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(239,68,68,0.12))',
              border: toast.ok ? '1px solid rgba(52,211,153,0.45)' : '1px solid rgba(239,68,68,0.40)',
              borderRadius: 14, padding: '12px 18px', backdropFilter: 'blur(20px)',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', textAlign: 'center' }}>{toast.msg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Süper Yönetici bandı */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(251,191,36,0.15), rgba(251,191,36,0.08), rgba(251,191,36,0.15))',
        borderBottom: '1px solid rgba(251,191,36,0.35)',
        padding: '5px 20px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Shield style={{ width: 11, height: 11, color: '#fbbf24' }} />
        <span style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.15em' }}>
          ⚡ İŞLETME KONTROL PANELİ
        </span>
      </div>

      {/* İçerik */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, x: view === 'detail' ? 30 : -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: view === 'detail' ? -30 : 30 }}
          transition={{ duration: 0.18 }}
        >
          {view === 'list' ? renderList() : renderDetail()}
        </motion.div>
      </AnimatePresence>

      {/* ── Modaller ── */}
      <AnimatePresence>
        {showCreate && (
          <Modal title="Yeni Şirket Oluştur" onClose={() => setShowCreate(false)} accentColor="#fbbf24">
            <CreateCompanyForm onClose={() => setShowCreate(false)} />
          </Modal>
        )}
        {showEdit && selected && (
          <Modal title="Şirket Düzenle" onClose={() => setShowEdit(false)} accentColor={selected.color}>
            <EditCompanyForm company={selected} onClose={() => setShowEdit(false)} />
          </Modal>
        )}
        {showAddUser && selected && (
          <Modal title="Kullanıcı Oluştur" onClose={() => setShowAddUser(false)} accentColor={selected.color}>
            <AddUserForm company={selected} onClose={() => setShowAddUser(false)} />
          </Modal>
        )}
        {showDeleteCompany && selected && (
          <Modal title="Şirketi Sil" onClose={() => { setShowDeleteCompany(false); setConfirmDeleteText(''); }} accentColor="#ef4444">
            <div style={{ marginBottom: 16, padding: '14px', borderRadius: 14, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <AlertTriangle style={{ width: 20, height: 20, color: '#f87171', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f87171' }}>Bu işlem geri alınamaz!</p>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>
                <strong style={{ color: '#fff' }}>{selected.name}</strong> şirketine ait şunlar kalıcı olarak silinecek:
              </p>
              <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', fontSize: 11, color: 'rgba(255,255,255,0.50)', lineHeight: 2 }}>
                <li>Tüm kullanıcı hesapları (<strong style={{ color: '#fbbf24' }}>{selected.userCount} kullanıcı</strong>)</li>
                <li>Tüm mekan, prim, satış ve operasyon verileri</li>
                <li>Şirket profili ve tüm KV kayıtları</li>
              </ul>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                ONAYLAMAK İÇİN ŞİRKET KODUNU GİRİN: <span style={{ color: '#f87171' }}>{selected.id}</span>
              </label>
              <input
                type="text"
                value={confirmDeleteText}
                onChange={e => setConfirmDeleteText(e.target.value)}
                placeholder={selected.id}
                style={{
                  width: '100%', padding: '11px 13px', borderRadius: 12, fontSize: 14,
                  background: 'rgba(239,68,68,0.08)', border: `1px solid ${confirmDeleteText === selected.id ? 'rgba(239,68,68,0.60)' : 'rgba(255,255,255,0.12)'}`,
                  color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
                }}
              />
            </div>
            <button
              onClick={handleDeleteCompany}
              disabled={confirmDeleteText !== selected.id || deleteCompanyLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, cursor: confirmDeleteText !== selected.id ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 13,
                background: confirmDeleteText === selected.id ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.04)',
                border: confirmDeleteText === selected.id ? '1px solid rgba(239,68,68,0.55)' : '1px solid rgba(255,255,255,0.08)',
                color: confirmDeleteText === selected.id ? '#f87171' : 'rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                opacity: deleteCompanyLoading ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              {deleteCompanyLoading
                ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Siliniyor…</>
                : <><Trash2 style={{ width: 14, height: 14 }} /> Şirketi Kalıcı Olarak Sil</>
              }
            </button>
          </Modal>
        )}
        {showMigrate && (
          <Modal title="Legacy Migration" onClose={() => setShowMigrate(false)} accentColor="#f59e0b">
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
                Mevcut prefix'siz Aspect verisini <code style={{ color: '#fbbf24', fontSize: 12 }}>aspect:</code> prefix'i ile kopyalar.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}>
                ✅ İdempotent — iki kez çalıştırılabilir, orijinal veriler silinmez.<br />
                ⚠️ Büyük veri setlerinde zaman alabilir.
              </p>
            </div>
            {migrateResult && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.30)', marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#34d399', fontWeight: 700 }}>✅ {migrateResult.message}</p>
                {migrateResult.errors?.length > 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f87171' }}>⚠️ {migrateResult.errors.length} hata — console'a bakın</p>
                )}
              </div>
            )}
            <Btn
              label={migrateLoading ? 'Migration çalışıyor…' : 'Migration\'ı Başlat'}
              color="#f59e0b"
              loading={migrateLoading}
              icon={<RefreshCw style={{ width: 14, height: 14 }} />}
              onClick={async () => {
                setMigrateLoading(true);
                setMigrateResult(null);
                try {
                  const headers = await authHeaders();
                  const res = await fetch(`${SERVER}/admin/migrate-legacy`, { method: 'POST', headers });
                  const data = await res.json();
                  setMigrateResult(data);
                  if (res.ok) showToast('✅ Migration tamamlandı!');
                  else showToast('⚠️ Migration hatası: ' + data.error, false);
                } catch (e: any) {
                  showToast('⚠️ ' + e.message, false);
                } finally {
                  setMigrateLoading(false);
                }
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
