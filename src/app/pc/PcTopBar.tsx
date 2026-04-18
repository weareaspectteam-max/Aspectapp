import { useEffect, useState } from 'react';
import { LogOut, X } from 'lucide-react';
import type { UserRole } from '../components/login';
import { supabase } from '../lib/supabase';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  'yonetici': 'Yönetici',
  'ust-mudur': 'Üst Müdür',
  'mudur': 'Müdür',
};

interface Company {
  id: string;
  name: string;
  adminUserId?: string;
  ownerUserId?: string;
  users?: Array<{ id: string; role: string }>;
}

interface Props {
  userName: string;
  userRole: UserRole;
  userAvatar: string;
  isSuperAdmin: boolean;
  ghostCompanyId: string | null;
  ghostCompanyName: string | null;
  onSwitchCompany: (opts: { companyId: string | null; companyName?: string; targetUserId?: string }) => void;
}

export function PcTopBar({ userName, userRole, userAvatar, isSuperAdmin, ghostCompanyId, ghostCompanyName, onSwitchCompany }: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const headers = await authHeaders();
      const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
      const res = await fetch(`${SERVER}/superadmin/companies`, { headers });
      const data = await res.json();
      if (res.ok && Array.isArray(data.companies)) {
        setCompanies(data.companies);
      }
    } catch (e) {
      console.error('[PcTopBar] companies:', e);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Gizli kısayol: Ctrl+Shift+G → şirket seçici açar (sadece superadmin için)
  useEffect(() => {
    if (!isSuperAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        e.preventDefault();
        setShowDialog(v => !v);
        if (!showDialog && companies.length === 0) loadCompanies();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, showDialog, companies.length]);

  const pickTargetUserId = (c: Company): string | undefined => {
    if (c.adminUserId) return c.adminUserId;
    if (c.ownerUserId) return c.ownerUserId;
    const admin = (c.users || []).find(u => u.role === 'yonetici' || u.role === 'ust-mudur');
    return admin?.id;
  };

  return (
    <>
      <header className="pc-topbar">
        <div className="pc-topbar-left">
          <div className="pc-topbar-title">🏢 {ghostCompanyName || 'Aspect'}</div>
        </div>
        <div className="pc-topbar-right">
          <button className="pc-topbar-btn" onClick={handleLogout} title="Çıkış yap">
            <LogOut size={16} />
          </button>
          <div className="pc-topbar-user">
            <div className="pc-topbar-user-avatar">{userAvatar || '👤'}</div>
            <div>
              <div className="pc-topbar-user-name">{userName}</div>
              <div className="pc-topbar-user-role">{ROLE_LABEL[userRole] || userRole}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Gizli şirket seçici — sadece superadmin'in bildiği kısayolla (Ctrl+Shift+G) açılır */}
      {showDialog && isSuperAdmin && (
        <div
          onClick={() => setShowDialog(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', background: 'rgba(20, 15, 50, 0.98)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Şirket Seç</div>
              <button onClick={() => setShowDialog(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            {ghostCompanyId && (
              <button
                onClick={() => { onSwitchCompany({ companyId: null }); setShowDialog(false); }}
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}
              >
                Ghost moddan çık ({ghostCompanyName})
              </button>
            )}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {loadingCompanies && <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Yükleniyor...</div>}
              {!loadingCompanies && companies.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Şirket bulunamadı</div>
              )}
              {companies.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setShowDialog(false);
                    onSwitchCompany({ companyId: c.id, companyName: c.name, targetUserId: pickTargetUserId(c) });
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px',
                    background: ghostCompanyId === c.id ? 'rgba(197,168,245,0.15)' : 'rgba(255,255,255,0.04)',
                    border: ghostCompanyId === c.id ? '1px solid rgba(197,168,245,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <div>{c.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{c.id}</div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
              Ctrl+Shift+G ile aç/kapat
            </div>
          </div>
        </div>
      )}
    </>
  );
}
