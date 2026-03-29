import React, { useState, useEffect } from 'react';
import {
  Shield, UserCog, Users, User, Briefcase, UserPlus, Clock,
  List, ChevronDown, ChevronRight, UserCheck, Trash2, Edit2,
  X, CheckCircle, ArrowLeft, RefreshCw, AlertCircle, Medal,
  Copy, Link, Check,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase, SERVER_URL } from '../lib/supabase';
import { buildHeaders, appendGhostParam } from '../lib/api';

interface UserManagementProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken: string;
  userCompanyId?: string; // ← Yeni: çok kiracılı yapı için
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  last_sign_in: string | null;
  phone?: string;
}

type UserRole =
  | 'yonetici' | 'ust-mudur' | 'mudur'
  | 'operasyon' | 'personel' | 'idari' | 'bekleyen';

type ActiveTab = 'active' | 'pending' | 'staff-list';
type StaffListFilter = 'all' | 'only-active' | 'only-pending' | 'signed-in' | 'not-signed-in';

/* ── Referans: admin-dashboard glass stili ── */
const glass: React.CSSProperties = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         20,
};

const VIOLET  = '#a855f7';
const CYAN    = '#9dd9ea';
const PEACH   = '#ffd4a3';
const LAVEND  = '#d4b5f7';
const LBLUE   = '#a7c7e7';
const EMERALD = '#34d399';

const roleConfig = {
  yonetici:   { label: 'Yönetici',  emoji: '👑', color: '#a855f7', accent: 'rgba(168,85,247,0.18)',  border: 'rgba(168,85,247,0.40)',  glow: 'rgba(168,85,247,0.12)', headerBg: 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(139,92,246,0.12))' },
  'ust-mudur':{ label: 'Üst Müdür', emoji: '🏢', color: '#e879f9', accent: 'rgba(232,121,249,0.15)', border: 'rgba(232,121,249,0.35)', glow: 'rgba(232,121,249,0.10)', headerBg: 'linear-gradient(135deg,rgba(232,121,249,0.20),rgba(192,132,252,0.10))' },
  mudur:      { label: 'Müdür',     emoji: '💼', color: '#60a5fa', accent: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.35)',  glow: 'rgba(96,165,250,0.10)',  headerBg: 'linear-gradient(135deg,rgba(96,165,250,0.20),rgba(59,130,246,0.10))' },
  operasyon:  { label: 'Operasyon', emoji: '⚡', color: '#fb923c', accent: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.35)',  glow: 'rgba(251,146,60,0.10)',  headerBg: 'linear-gradient(135deg,rgba(251,146,60,0.20),rgba(234,88,12,0.10))' },
  personel:   { label: 'Personel',  emoji: '📸', color: '#34d399', accent: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.35)',  glow: 'rgba(52,211,153,0.10)',  headerBg: 'linear-gradient(135deg,rgba(52,211,153,0.20),rgba(16,185,129,0.10))' },
  idari:      { label: 'İdari',     emoji: '📋', color: '#fbbf24', accent: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  glow: 'rgba(251,191,36,0.10)',  headerBg: 'linear-gradient(135deg,rgba(251,191,36,0.20),rgba(245,158,11,0.10))' },
  bekleyen:   { label: 'Bekleyen',  emoji: '⏳', color: 'rgba(255,255,255,0.45)', accent: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)', glow: 'rgba(255,255,255,0.05)', headerBg: 'linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))' },
};

export function UserManagement({ userRole, accessToken, userCompanyId = 'aspect', onNavigate }: UserManagementProps) {
  const [users, setUsers]               = useState<UserData[]>([]);
  const [pendingUsers, setPendingUsers]  = useState<UserData[]>([]);
  const [activeTab, setActiveTab]        = useState<ActiveTab>('active');
  const [staffListFilter, setStaffListFilter] = useState<StaffListFilter>('all');
  const [expandedRoles, setExpandedRoles] = useState<Set<UserRole>>(new Set());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading]            = useState(true);
  const [error, setError]                = useState('');
  const [linkCopied, setLinkCopied]      = useState(false); // ← Yeni: kopyalama feedback

  const currentUserRole: UserRole = userRole as UserRole;

  // ── Kıdem ─────────────────────────────────────────────────────
  const KIDEM_ELIGIBLE_ROLES: UserRole[] = ['mudur', 'operasyon', 'personel'];
  const canViewKidem = ['yonetici', 'ust-mudur'].includes(currentUserRole);
  const canEditKidem = currentUserRole === 'yonetici';

  type KidemSeviye = 'kidemsiz' | 'kidemli' | 'kidemliPlus';
  interface KidemObj { userId: string; kidemSeviye: KidemSeviye; atanmaTarihi: string; atayanKisi: string; }

  const KIDEM_CONFIG: Record<KidemSeviye, { label: string; emoji: string; color: string; bg: string; border: string }> = {
    kidemsiz:   { label: 'Kıdemsiz',  emoji: '⚪', color: '#a7c7e7', bg: 'rgba(167,199,231,0.10)', border: 'rgba(167,199,231,0.25)' },
    kidemli:    { label: 'Kıdemli',   emoji: '🔵', color: '#9dd9ea', bg: 'rgba(157,217,234,0.10)', border: 'rgba(157,217,234,0.25)' },
    kidemliPlus:{ label: 'Kıdemli+',  emoji: '💜', color: '#d4b5f7', bg: 'rgba(212,181,247,0.12)', border: 'rgba(212,181,247,0.28)' },
  };

  const [kidemMap, setKidemMap] = useState<Record<string, KidemObj>>({});
  const [kidemSaving, setKidemSaving] = useState<Record<string, boolean>>({});

  // ── Hakediş Dahil ─────────────────────────────────────────────
  const HAKEDIS_ELIGIBLE_ROLES: UserRole[] = ['ust-mudur', 'mudur', 'operasyon', 'personel', 'idari'];
  const canViewHakedis = ['yonetici', 'ust-mudur'].includes(currentUserRole);
  const canEditHakedis = currentUserRole === 'yonetici';
  const [hakedisDahilSet, setHakedisDahilSet] = useState<Set<string>>(new Set());
  const [hakedisSaving, setHakedisSaving] = useState<Record<string, boolean>>({});

  const getCurrentUserEmail = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.email || '';
  };

  /* ── Veri yükleme ── */
  const loadUsers = async () => {
    setLoading(true); setError('');
    try {
      const headers = buildHeaders(accessToken);
      // Ghost mod desteği: appendGhostParam otomatik olarak ?company_id=X ekler
      const url = appendGhostParam(`${SERVER_URL}/users`);
      const res = await fetch(url, { headers });
      if (!res.ok) { const j = await res.json(); setError(j.error || 'Kullanıcılar yüklenemedi.'); return; }
      const { users: all } = await res.json();
      setUsers(all.filter((u: UserData) => u.role !== 'bekleyen'));
      setPendingUsers(all.filter((u: UserData) => u.role === 'bekleyen'));
    } catch (err) { setError(`Yükleme hatası: ${err}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, [userCompanyId]);

  /* ── Kıdem: yükle (sayfa açılışında) ── */
  useEffect(() => {
    if (canViewKidem) {
      fetch(`${SERVER_URL}/kidem/personel`, { headers: buildHeaders(accessToken) })
        .then(r => r.json())
        .then(data => {
          if (data.kidemler) {
            const map: Record<string, any> = {};
            data.kidemler.forEach((k: any) => { if (k?.userId) map[k.userId] = k; });
            setKidemMap(map);
          }
        })
        .catch(e => console.error('kidem yükleme hatası:', e));
    }
  }, [canViewKidem, accessToken]);

  /* ── Hakediş dahil: yükle (sayfa açılışında) ── */
  useEffect(() => {
    if (canViewHakedis) {
      fetch(`${SERVER_URL}/hakedis/dahil`, { headers: buildHeaders(accessToken) })
        .then(r => r.json())
        .then(data => {
          if (data.userIds) setHakedisDahilSet(new Set<string>(data.userIds));
        })
        .catch(e => console.error('hakediş dahil yükleme hatası:', e));
    }
  }, [canViewHakedis, accessToken]);

  /* ── Hakediş dahil toggle ── */
  const hakedisDahilRef = React.useRef(hakedisDahilSet);
  hakedisDahilRef.current = hakedisDahilSet;

  const handleToggleHakedis = async (userId: string) => {
    if (!canEditHakedis) return;
    setHakedisSaving(prev => ({ ...prev, [userId]: true }));
    try {
      const current = hakedisDahilRef.current;
      const isCurrentlyDahil = current.has(userId);
      const newSet = new Set(current);
      if (isCurrentlyDahil) newSet.delete(userId); else newSet.add(userId);
      const newIds = Array.from(newSet);

      const res = await fetch(`${SERVER_URL}/hakedis/dahil`, {
        method: 'POST',
        headers: buildHeaders(accessToken),
        body: JSON.stringify({ userIds: newIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hakediş güncellenemedi');
      setHakedisDahilSet(newSet);
      hakedisDahilRef.current = newSet;
      const userName = users.find(u => u.id === userId)?.full_name || '';
      setSuccessMessage(`💰 ${userName} → Hakediş ${!isCurrentlyDahil ? 'DAHİL' : 'HARİÇ'}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (e: any) {
      setSuccessMessage(`❌ ${e.message}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } finally {
      setHakedisSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  /* ── Kıdem ata ── */
  const handleAssignKidem = async (user: UserData, seviye: KidemSeviye) => {
    if (!canEditKidem) return;
    setKidemSaving(prev => ({ ...prev, [user.id]: true }));
    try {
      const res = await fetch(`${SERVER_URL}/kidem/personel/${user.id}`, {
        method: 'POST',
        headers: buildHeaders(accessToken),
        body: JSON.stringify({ kidemSeviye: seviye, personelAdi: user.full_name, personelRol: user.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kıdem atanamadı');
      setKidemMap(prev => ({ ...prev, [user.id]: data.kidem }));
      setSuccessMessage(`🎖️ ${user.full_name} → ${KIDEM_CONFIG[seviye].label}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (e: any) {
      setSuccessMessage(`❌ ${e.message}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } finally {
      setKidemSaving(prev => ({ ...prev, [user.id]: false }));
    }
  };

  /* ── Yetki kontrolleri ── */
  const canEditUser = (t: UserData): boolean => {
    if (['operasyon','idari','personel','bekleyen'].includes(currentUserRole)) return false;
    if (t.email === getCurrentUserEmail()) return false;
    if (currentUserRole === 'yonetici')  return t.role !== 'yonetici';
    if (currentUserRole === 'ust-mudur') return t.role !== 'yonetici' && t.role !== 'ust-mudur';
    if (currentUserRole === 'mudur')     return !['yonetici','ust-mudur','mudur'].includes(t.role);
    return false;
  };
  const canDeleteUser = (t: UserData): boolean => {
    if (currentUserRole === 'operasyon') return false;
    if (t.email === getCurrentUserEmail()) {
      if (currentUserRole === 'yonetici' || currentUserRole === 'mudur') return false;
      if (currentUserRole === 'ust-mudur') return true;
    }
    return canEditUser(t);
  };
  const getAssignableRoles = (): UserRole[] => {
    if (currentUserRole === 'yonetici')  return ['ust-mudur','mudur','operasyon','personel','idari','bekleyen'];
    if (currentUserRole === 'ust-mudur') return ['mudur','operasyon','personel','idari','bekleyen'];
    if (currentUserRole === 'mudur')     return ['operasyon','personel','idari','bekleyen'];
    return [];
  };

  /* ── Rol atama ── */
  const handleAssignRole = async (userId: string, newRole: UserRole) => {
    try {
      const headers = buildHeaders(accessToken);
      const res = await fetch(`${SERVER_URL}/auth/update-role`, {
        method: 'PUT', headers,
        body: JSON.stringify({ userId, role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) { setSuccessMessage(`❌ ${json.error}`); setTimeout(() => setSuccessMessage(''), 3000); return; }
      const fromPending = pendingUsers.some(u => u.id === userId);
      if (fromPending) {
        const pu = pendingUsers.find(u => u.id === userId)!;
        const updated = { ...pu, role: newRole };
        if (newRole === 'bekleyen') {
          setPendingUsers(prev => prev.map(u => u.id === userId ? updated : u));
        } else {
          setPendingUsers(prev => prev.filter(u => u.id !== userId));
          setUsers(prev => [...prev, updated]);
        }
        setSuccessMessage(`✅ ${pu.full_name} → ${roleConfig[newRole].label}`);
      } else {
        const eu = users.find(u => u.id === userId);
        if (eu) {
          if (newRole === 'bekleyen') {
            setUsers(prev => prev.filter(u => u.id !== userId));
            setPendingUsers(prev => [...prev, { ...eu, role: 'bekleyen' }]);
            setSuccessMessage(`⏸️ ${eu.full_name} bekleyen konumuna alındı`);
            setActiveTab('pending');
          } else {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            setSuccessMessage(`✅ ${eu.full_name} → ${roleConfig[newRole].label}`);
          }
        }
      }
    } catch (err) { setSuccessMessage(`❌ Rol güncellenemedi: ${err}`); }
    setEditingUserId(null);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  /* ── Kullanıcı silme ── */
  const handleDeleteUser = async (userId: string, userEmail: string, targetName: string) => {
    if (!confirm(`${targetName} (${userEmail}) kalıcı olarak silinsin mi?\nBu işlem geri alınamaz.`)) return;
    try {
      const res = await fetch(`${SERVER_URL}/users/${userId}`, { method: 'DELETE', headers: buildHeaders(accessToken) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Silinemedi.'); setTimeout(() => setError(''), 4000); return; }
      setUsers(prev => prev.filter(u => u.id !== userId));
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      setSuccessMessage(`🗑️ ${data.message}`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch { setError('Sunucuya bağlanılamadı.'); setTimeout(() => setError(''), 4000); }
  };

  const toggleRoleExpansion = (role: UserRole) => {
    const s = new Set(expandedRoles);
    s.has(role) ? s.delete(role) : s.add(role);
    setExpandedRoles(s);
  };

  const fmt = (ds: string, f: 'short' | 'long' = 'short') => {
    const d = new Date(ds);
    if (f === 'short') return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const groupBy = (list: UserData[]) => {
    const g: Record<string, UserData[]> = { yonetici: [], 'ust-mudur': [], mudur: [], operasyon: [], personel: [], idari: [], bekleyen: [] };
    list.forEach(u => {
      // superadmin rolü yonetici grubunda gösterilir; bilinmeyen roller yonetici'ye düşer
      const key = u.role === 'superadmin' ? 'yonetici' : u.role;
      if (!g[key]) g[key] = [];
      g[key].push(u);
    });
    return g as Record<UserRole, UserData[]>;
  };

  const getFiltered = () => {
    const sixH = Date.now() - 6 * 60 * 60 * 1000;
    const all = [...users, ...pendingUsers];
    switch (staffListFilter) {
      case 'only-active':   return users;
      case 'only-pending':  return pendingUsers;
      case 'signed-in':     return all.filter(u => u.last_sign_in);
      case 'not-signed-in': return all.filter(u => !u.last_sign_in || new Date(u.last_sign_in).getTime() < sixH);
      default:              return all;
    }
  };

  const groupedActive = groupBy(users);
  const groupedStaff  = groupBy(getFiltered());

  /* ─────────────── RENDER ─────────────── */
  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      <div className="px-4 pt-4 space-y-4">

        {/* ── Başlık ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => onNavigate('resource-management')}
                style={{ ...glass, padding: 10, borderRadius: 14, border: '1px solid rgba(168,85,247,0.25)' }}
              >
                <ArrowLeft className="w-4 h-4" style={{ color: VIOLET }} />
              </motion.button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-white">Kullanıcı Yönetimi</h1>
                  <span className="text-xl">👥</span>
                </div>
                <p className="text-xs" style={{ color: 'rgba(196,181,253,0.5)' }}>
                  Personel ve yöneticileri yönetin
                </p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={loadUsers}
              disabled={loading}
              style={{ ...glass, padding: 10, borderRadius: 14 }}
            >
              <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </motion.div>

        {/* ── Hata ── */}
        {error && !loading && (
          <div style={{ ...glass, padding: 12, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
            <button onClick={loadUsers} className="text-xs text-red-400 underline mt-2">Tekrar dene</button>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div style={{ ...glass, padding: 18, borderRadius: 18, border: `1px solid rgba(168,85,247,0.25)` }}>
              <RefreshCw className="w-6 h-6 animate-spin" style={{ color: VIOLET }} />
            </div>
            <p className="text-xs" style={{ color: 'rgba(196,181,253,0.5)' }}>Kullanıcılar yükleniyor...</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Başarı toast ── */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  style={{ ...glass, padding: '10px 14px', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <CheckCircle className="w-4 h-4 shrink-0" style={{ color: EMERALD }} />
                  <span className="text-sm font-semibold" style={{ color: EMERALD }}>{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Tab Seçim Kartları ── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="grid grid-cols-1 gap-3"
            >
              {/* Aktif Kullanıcılar */}
              {[
                { key: 'active' as ActiveTab,     label: 'Aktif Kullanıcılar', icon: UserCheck, count: users.length,                      color: CYAN,   accentBg: 'rgba(157,217,234,0.12)', accentBorder: 'rgba(157,217,234,0.30)', roles: ['yonetici','ust-mudur','mudur'] },
                { key: 'pending' as ActiveTab,    label: 'Bekleyen Kullanıcılar', icon: Clock,  count: pendingUsers.length,               color: PEACH,  accentBg: 'rgba(255,212,163,0.12)', accentBorder: 'rgba(255,212,163,0.30)', roles: ['yonetici','ust-mudur','mudur'] },
                { key: 'staff-list' as ActiveTab, label: 'Personel Listesi',   icon: List,      count: users.length + pendingUsers.length, color: LAVEND, accentBg: 'rgba(212,181,247,0.12)', accentBorder: 'rgba(212,181,247,0.30)', roles: null },
              ].map(tab => {
                if (tab.roles && !tab.roles.includes(currentUserRole)) return null;
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <motion.button
                    key={tab.key}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(tab.key)}
                    className="w-full text-left"
                    style={{
                      ...glass,
                      padding: '14px 16px',
                      background: isActive ? tab.accentBg : 'rgba(255,255,255,0.03)',
                      border: isActive ? `1px solid ${tab.accentBorder}` : '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      boxShadow: isActive ? `0 4px 24px ${tab.color}18` : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 38, height: 38, borderRadius: 12,
                        background: isActive ? `${tab.color}22` : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${isActive ? tab.color + '44' : 'rgba(255,255,255,0.08)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon style={{ width: 16, height: 16, color: isActive ? tab.color : 'rgba(255,255,255,0.3)' }} />
                      </div>
                      <span className="font-bold" style={{ fontSize: 14, color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                        {tab.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {tab.key === 'pending' && tab.count > 0 && (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: PEACH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#7c2d12' }}>!</span>
                        </div>
                      )}
                      <span className="text-xl font-black" style={{ color: isActive ? tab.color : 'rgba(255,255,255,0.35)' }}>
                        {tab.count}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>

            {/* ═══════════ AKTİF KULLANICILAR ═══════════ */}
            {activeTab === 'active' && (
              <div className="space-y-3">
                {(Object.keys(groupedActive) as UserRole[])
                  .filter(r => r !== 'bekleyen' && groupedActive[r].length > 0)
                  .map(role => {
                    const cfg = roleConfig[role];
                    const roleUsers = groupedActive[role];
                    return (
                      <motion.div
                        key={role}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        style={{ ...glass, padding: 16, border: `1px solid ${cfg.border}`, background: cfg.accent, boxShadow: `0 4px 24px ${cfg.color}10` }}
                      >
                        {/* Rol başlık */}
                        <div className="flex items-center gap-3 mb-3" style={{ background: cfg.headerBg, margin: -16, padding: '14px 16px', marginBottom: 12, borderRadius: '20px 20px 0 0', borderBottom: `1px solid ${cfg.border}` }}>
                          <div style={{
                            width: 42, height: 42, borderRadius: 12,
                            background: `${cfg.color}25`,
                            border: `1.5px solid ${cfg.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                            boxShadow: `0 0 16px ${cfg.glow}`,
                          }}>{cfg.emoji}</div>
                          <div>
                            <p className="font-black" style={{ fontSize: 15, color: cfg.color, textShadow: `0 0 20px ${cfg.color}80` }}>{cfg.label}</p>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{roleUsers.length} kullanıcı</p>
                          </div>
                          <div style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: 8, background: `${cfg.color}20`, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>{roleUsers.length}</span>
                          </div>
                        </div>

                        {/* Kullanıcı satırları */}
                        <div className="space-y-2">
                          {roleUsers.map(user => {
                            const canEdit   = canEditUser(user);
                            const canDelete = canDeleteUser(user);
                            const isEditing = editingUserId === user.id;
                            return (
                              <div key={user.id} style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: 12, padding: '10px 12px',
                              }}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white" style={{ fontSize: 13 }}>{user.full_name}</p>
                                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '2px 0 4px' }}>{user.email}</p>
                                    <div className="flex flex-wrap gap-2">
                                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>Kayıt: {fmt(user.created_at)}</span>
                                      {user.last_sign_in
                                        ? <span style={{ fontSize: 9, color: EMERALD }}>🟢 {fmt(user.last_sign_in)}</span>
                                        : <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>⚫ Hiç giriş yapmadı</span>}
                                      {/* Kıdem badge — yönetici ve üst-müdür görür */}
                                      {canViewKidem && KIDEM_ELIGIBLE_ROLES.includes(user.role) && kidemMap[user.id] && (
                                        <span style={{
                                          fontSize: 8, padding: '1px 5px', borderRadius: 5, fontWeight: 800,
                                          background: KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].bg,
                                          border: `1px solid ${KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].border}`,
                                          color: KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].color,
                                        }}>
                                          {KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].emoji} {KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].label}
                                        </span>
                                      )}
                                      {canViewKidem && KIDEM_ELIGIBLE_ROLES.includes(user.role) && !kidemMap[user.id] && (
                                        <span style={{
                                          fontSize: 8, padding: '1px 5px', borderRadius: 5, fontWeight: 700,
                                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                          color: 'rgba(255,255,255,0.2)',
                                        }}>
                                          🎖️ Kıdem yok
                                        </span>
                                      )}
                                      {/* Hakediş dahil badge */}
                                      {canViewHakedis && HAKEDIS_ELIGIBLE_ROLES.includes(user.role) && (
                                        <span style={{
                                          fontSize: 8, padding: '1px 5px', borderRadius: 5, fontWeight: 800,
                                          background: hakedisDahilSet.has(user.id) ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.10)',
                                          border: `1px solid ${hakedisDahilSet.has(user.id) ? 'rgba(52,211,153,0.30)' : 'rgba(239,68,68,0.25)'}`,
                                          color: hakedisDahilSet.has(user.id) ? '#34d399' : '#ef4444',
                                        }}>
                                          {hakedisDahilSet.has(user.id) ? '💰 Hakediş Dahil' : '⛔ Hakediş Hariç'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {currentUserRole !== 'operasyon' && (
                                    <div className="flex gap-1.5 shrink-0 ml-2">
                                      {canEdit && (
                                        <motion.button whileTap={{ scale: 0.9 }}
                                          onClick={() => setEditingUserId(isEditing ? null : user.id)}
                                          style={{
                                            width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                                            background: isEditing ? 'rgba(255,255,255,0.07)' : 'rgba(168,85,247,0.15)',
                                            border: isEditing ? '1px solid rgba(255,255,255,0.12)' : `1px solid rgba(168,85,247,0.35)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          }}>
                                          {isEditing
                                            ? <X style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.4)' }} />
                                            : <Edit2 style={{ width: 13, height: 13, color: VIOLET }} />}
                                        </motion.button>
                                      )}
                                      {canDelete && (
                                        <motion.button whileTap={{ scale: 0.9 }}
                                          onClick={() => handleDeleteUser(user.id, user.email, user.full_name)}
                                          style={{
                                            width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                                            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          }}>
                                          <Trash2 style={{ width: 13, height: 13, color: '#f87171' }} />
                                        </motion.button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Rol atama paneli */}
                                <AnimatePresence>
                                  {isEditing && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}
                                    >
                                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(168,85,247,0.15)' }}>
                                        <p style={{ fontSize: 9, color: 'rgba(196,181,253,0.5)', marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                          Rol Ata
                                        </p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                          {getAssignableRoles().map(ar => {
                                            const ac = roleConfig[ar];
                                            return (
                                              <motion.button key={ar} whileTap={{ scale: 0.95 }}
                                                onClick={() => handleAssignRole(user.id, ar)}
                                                style={{
                                                  padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
                                                  background: ac.accent, border: `1px solid ${ac.border}`,
                                                  color: ac.color, fontSize: 10, fontWeight: 700, textAlign: 'center',
                                                }}>
                                                {ac.emoji} {ac.label}
                                              </motion.button>
                                            );
                                          })}
                                        </div>

                                        {/* ── Kıdem Ata — rol gridinin ALTINDA ayrı bölüm ── */}
                                        {canViewKidem && KIDEM_ELIGIBLE_ROLES.includes(user.role) && (
                                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(157,217,234,0.12)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                              <Medal style={{ width: 11, height: 11, color: '#9dd9ea' }} />
                                              <p style={{ fontSize: 9, color: 'rgba(157,217,234,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                                                Kıdem Ata
                                              </p>
                                              {kidemMap[user.id] && (
                                                <span style={{
                                                  fontSize: 8, padding: '1px 6px', borderRadius: 6, fontWeight: 800, marginLeft: 'auto',
                                                  background: KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].bg,
                                                  border: `1px solid ${KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].border}`,
                                                  color: KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].color,
                                                }}>
                                                  {KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].emoji} Mevcut: {KIDEM_CONFIG[kidemMap[user.id].kidemSeviye].label}
                                                </span>
                                              )}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                              {(['kidemsiz', 'kidemli', 'kidemliPlus'] as KidemSeviye[]).map(sev => {
                                                const kc = KIDEM_CONFIG[sev];
                                                const isSelected = kidemMap[user.id]?.kidemSeviye === sev;
                                                const isSaving = kidemSaving[user.id];
                                                return (
                                                  <motion.button
                                                    key={sev}
                                                    whileTap={{ scale: canEditKidem ? 0.95 : 1 }}
                                                    onClick={() => canEditKidem && handleAssignKidem(user, sev)}
                                                    disabled={!canEditKidem || isSaving}
                                                    style={{
                                                      padding: '8px 4px', borderRadius: 8, textAlign: 'center',
                                                      cursor: canEditKidem ? 'pointer' : 'not-allowed',
                                                      background: isSelected ? kc.bg : 'rgba(255,255,255,0.04)',
                                                      border: isSelected ? `1.5px solid ${kc.border}` : '1px solid rgba(255,255,255,0.08)',
                                                      color: isSelected ? kc.color : 'rgba(255,255,255,0.35)',
                                                      fontSize: 10, fontWeight: isSelected ? 800 : 600,
                                                      opacity: isSaving ? 0.6 : 1,
                                                      boxShadow: isSelected ? `0 0 8px ${kc.color}30` : 'none',
                                                    }}>
                                                    <div style={{ fontSize: 14, marginBottom: 2 }}>{kc.emoji}</div>
                                                    <div>{kc.label}</div>
                                                    {isSelected && <div style={{ fontSize: 7, marginTop: 1, opacity: 0.7 }}>✓ Aktif</div>}
                                                  </motion.button>
                                                );
                                              })}
                                            </div>
                                            {!canEditKidem && (
                                              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 5, textAlign: 'center' }}>
                                                🔒 Kıdem ataması yalnızca yönetici yapabilir
                                              </p>
                                            )}
                                            {kidemMap[user.id]?.atanmaTarihi && (
                                              <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)', marginTop: 5, textAlign: 'right' }}>
                                                🕐 {new Date(kidemMap[user.id].atanmaTarihi).toLocaleDateString('tr-TR')} — {kidemMap[user.id].atayanKisi}
                                              </p>
                                            )}
                                          </div>
                                        )}

                                        {/* ── Hakediş Dahil/Hariç Toggle ── */}
                                        {canViewHakedis && HAKEDIS_ELIGIBLE_ROLES.includes(user.role) && (
                                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(52,211,153,0.12)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                              <Briefcase style={{ width: 11, height: 11, color: '#34d399' }} />
                                              <p style={{ fontSize: 9, color: 'rgba(52,211,153,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                                                Hakediş Durumu
                                              </p>
                                            </div>
                                            <button
                                              onClick={() => { console.log('HAKEDIS CLICK', user.id, canEditHakedis); if (canEditHakedis) handleToggleHakedis(user.id); }}
                                              style={{
                                                width: '100%', padding: '10px 14px', borderRadius: 10,
                                                cursor: canEditHakedis ? 'pointer' : 'not-allowed',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                background: hakedisDahilSet.has(user.id)
                                                  ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.08)',
                                                border: `1.5px solid ${hakedisDahilSet.has(user.id)
                                                  ? 'rgba(52,211,153,0.30)' : 'rgba(239,68,68,0.20)'}`,
                                                opacity: hakedisSaving[user.id] ? 0.6 : 1,
                                              }}>
                                              <span style={{
                                                fontSize: 12, fontWeight: 800,
                                                color: hakedisDahilSet.has(user.id) ? '#34d399' : '#ef4444',
                                              }}>
                                                {hakedisDahilSet.has(user.id) ? '💰 Hakediş\'e Dahil' : '⛔ Hakediş\'e Dahil Değil'}
                                              </span>
                                              <div style={{
                                                width: 40, height: 22, borderRadius: 11, padding: 2,
                                                background: hakedisDahilSet.has(user.id)
                                                  ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.15)',
                                                transition: 'background 0.2s',
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: hakedisDahilSet.has(user.id) ? 'flex-end' : 'flex-start',
                                              }}>
                                                <div style={{
                                                  width: 18, height: 18, borderRadius: 9,
                                                  background: hakedisDahilSet.has(user.id) ? '#34d399' : 'rgba(255,255,255,0.3)',
                                                  boxShadow: hakedisDahilSet.has(user.id) ? '0 0 6px rgba(52,211,153,0.4)' : 'none',
                                                  transition: 'all 0.2s',
                                                }} />
                                              </div>
                                            </button>
                                            {!canEditHakedis && (
                                              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 5, textAlign: 'center' }}>
                                                🔒 Hakediş ayarı yalnızca yönetici yapabilir
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            )}

            {/* ═══════════ BEKLEYEN KULLANICILAR ═══════════ */}
            {activeTab === 'pending' && (
              <div className="space-y-3">
                {pendingUsers.length === 0 && (
                  <div className="flex flex-col items-center py-16 gap-4">
                    <div style={{ ...glass, padding: 20, borderRadius: 18, border: `1px solid ${PEACH}22` }}>
                      <UserPlus style={{ width: 32, height: 32, color: 'rgba(255,255,255,0.2)' }} />
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Bekleyen kullanıcı yok</p>
                  </div>
                )}
                {pendingUsers.map(user => {
                  const canEdit   = canEditUser(user);
                  const canDelete = canDeleteUser(user);
                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      style={{ ...glass, padding: 16, background: 'rgba(255,212,163,0.07)', border: '1px solid rgba(255,212,163,0.22)', boxShadow: `0 4px 24px ${PEACH}10` }}
                    >
                      <div className="flex gap-3 items-start">
                        <div style={{
                          width: 48, height: 48, borderRadius: 14, flexShrink: 0, fontSize: 22,
                          background: 'rgba(255,212,163,0.12)', border: '1px solid rgba(255,212,163,0.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>👤</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white" style={{ fontSize: 14 }}>{user.full_name}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0' }}>{user.email}</p>
                          {user.phone && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>📱 {user.phone}</p>}
                          <p style={{ fontSize: 10, color: PEACH, marginTop: 3 }}>⏰ {fmt(user.created_at, 'long')}</p>
                        </div>
                      </div>
                      {currentUserRole !== 'operasyon' && canEdit && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,212,163,0.15)' }}>
                          <p style={{ fontSize: 9, color: 'rgba(196,181,253,0.5)', marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Rol Ata</p>
                          <div className="grid grid-cols-3 gap-1.5 mb-2">
                            {getAssignableRoles().filter(r => r !== 'bekleyen').map(ar => {
                              const ac = roleConfig[ar];
                              return (
                                <motion.button key={ar} whileTap={{ scale: 0.95 }}
                                  onClick={() => handleAssignRole(user.id, ar)}
                                  style={{ padding: '8px 4px', borderRadius: 8, cursor: 'pointer', background: ac.accent, border: `1px solid ${ac.border}`, color: ac.color, fontSize: 10, fontWeight: 700, textAlign: 'center' }}>
                                  {ac.emoji} {ac.label}
                                </motion.button>
                              );
                            })}
                          </div>
                          {canDelete && (
                            <motion.button whileTap={{ scale: 0.97 }}
                              onClick={() => handleDeleteUser(user.id, user.email, user.full_name)}
                              className="w-full flex items-center justify-center gap-2"
                              style={{ padding: '9px', borderRadius: 10, cursor: 'pointer', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171', fontSize: 12, fontWeight: 600 }}>
                              <Trash2 style={{ width: 13, height: 13 }} /> Kullanıcıyı Sil
                            </motion.button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ═══════════ PERSONEL LİSTESİ ═══════════ */}
            {activeTab === 'staff-list' && (
              <div className="space-y-3">
                {/* Filtre Butonları */}
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'all' as StaffListFilter,         label: `🌐 Tümü (${users.length + pendingUsers.length})` },
                    { key: 'only-active' as StaffListFilter,  label: `✅ Aktifler (${users.length})` },
                    { key: 'only-pending' as StaffListFilter, label: `⏳ Bekleyenler (${pendingUsers.length})` },
                    { key: 'signed-in' as StaffListFilter,    label: '🟢 Giriş Yapmış' },
                    { key: 'not-signed-in' as StaffListFilter,label: '⚫ Son 6 Saat Yok' },
                  ] as const).map(fb => {
                    const isActive = staffListFilter === fb.key;
                    return (
                      <motion.button key={fb.key} whileTap={{ scale: 0.95 }} onClick={() => setStaffListFilter(fb.key)}
                        style={{
                          padding: '6px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          background: isActive ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.05)',
                          border: isActive ? `1px solid ${VIOLET}55` : '1px solid rgba(255,255,255,0.08)',
                          color: isActive ? LAVEND : 'rgba(255,255,255,0.4)',
                          whiteSpace: 'nowrap',
                        }}>
                        {fb.label}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Accordion Rol Grupları */}
                {(Object.keys(groupedStaff) as UserRole[])
                  .filter(r => groupedStaff[r].length > 0)
                  .map(role => {
                    const cfg = roleConfig[role];
                    const roleUsers = groupedStaff[role];
                    const isExpanded = expandedRoles.has(role);
                    return (
                      <div key={role} style={{ ...glass, overflow: 'hidden', border: `1px solid ${isExpanded ? cfg.border : 'rgba(255,255,255,0.08)'}` }}>
                        <button onClick={() => toggleRoleExpansion(role)} className="w-full flex items-center justify-between"
                          style={{ padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <div className="flex items-center gap-3">
                            <div style={{
                              width: 36, height: 36, borderRadius: 10, fontSize: 18,
                              background: isExpanded ? cfg.accent : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${isExpanded ? cfg.border : 'rgba(255,255,255,0.08)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{cfg.emoji}</div>
                            <div className="text-left">
                              <p className="font-bold" style={{ fontSize: 13, color: isExpanded ? cfg.color : '#fff', margin: 0 }}>{cfg.label}</p>
                              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0, marginTop: 1 }}>{roleUsers.length} kişi</p>
                            </div>
                          </div>
                          {isExpanded
                            ? <ChevronDown style={{ width: 15, height: 15, color: cfg.color }} />
                            : <ChevronRight style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.3)' }} />}
                        </button>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}
                            >
                              <div style={{ borderTop: `1px solid ${cfg.border}`, padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {roleUsers.map((user, i) => (
                                  <div key={user.id} style={{
                                    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 10, padding: '9px 12px', display: 'flex', gap: 10, alignItems: 'flex-start',
                                  }}>
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontWeight: 700, minWidth: 16, marginTop: 2 }}>{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-white" style={{ fontSize: 13, margin: 0 }}>{user.full_name}</p>
                                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>{user.email}</p>
                                      {user.last_sign_in
                                        ? <p style={{ fontSize: 9, color: EMERALD, margin: '3px 0 0' }}>🟢 {fmt(user.last_sign_in, 'long')}</p>
                                        : <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', margin: '3px 0 0' }}>⚫ Hiç giriş yapmadı</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ── Yetki Bilgi Kartı ── */}
            {currentUserRole === 'yonetici' && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              style={{ ...glass, padding: 16, border: '1px solid rgba(168,85,247,0.20)', background: 'rgba(168,85,247,0.06)' }}
            >
              <div className="flex gap-3 items-start">
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0, fontSize: 18,
                  background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.30)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>🛡️</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-bold text-white" style={{ fontSize: 13 }}>Yetki Sistemi</p>
                    <span style={{ fontSize: 9, fontWeight: 700, color: VIOLET, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.30)', borderRadius: 6, padding: '2px 6px', letterSpacing: '0.06em' }}>
                      SADECE YÖNETİCİ
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { color: VIOLET,  label: '👑 Yönetici',  desc: 'Admin hariç herkese müdahale edebilir' },
                      { color: LAVEND,  label: '🏢 Üst Müdür', desc: 'Admin & Üst Müdür hariç herkese' },
                      { color: LBLUE,   label: '💼 Müdür',     desc: 'Yönetici kadrosu hariç herkese' },
                      { color: 'rgba(255,255,255,0.3)', label: '👁️ Diğerleri', desc: 'Sadece görüntüleme yetkisi' },
                    ].map(item => (
                      <div key={item.label} className="flex gap-2">
                        <span style={{ fontSize: 11, color: item.color, fontWeight: 700, flexShrink: 0 }}>{item.label}:</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
            )}

            {/* ── Personel / Operasyon bilgi notu ── */}
            {(currentUserRole === 'personel' || currentUserRole === 'operasyon') && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              style={{ ...glass, padding: 14, border: '1px solid rgba(157,217,234,0.18)', background: 'rgba(157,217,234,0.05)' }}
            >
              <div className="flex gap-3 items-center">
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0, fontSize: 16,
                  background: 'rgba(157,217,234,0.12)', border: '1px solid rgba(157,217,234,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>👁️</div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                  Bu sayfada yalnızca <span style={{ color: CYAN, fontWeight: 700 }}>Personel Listesi</span>'ni görüntüleyebilirsiniz. Düzenleme ve yönetim yetkiniz bulunmamaktadır.
                </p>
              </div>
            </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}