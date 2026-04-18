import { useState } from 'react';
import { Lock } from 'lucide-react';
import type { UserRole } from '../components/login';
import { PcRightSidebar } from './PcRightSidebar';
import { PcLeftPanel } from './PcLeftPanel';
import { PcTopBar } from './PcTopBar';
import { PcDashboard } from './screens/PcDashboard';
import { PcMesajlar } from './screens/PcMesajlar';
import { PcPlaceholder } from './screens/PcPlaceholder';
import { PcDmPopup } from './PcDmPopup';
import { PcWindow } from './PcWindow';
import { useWindowManager, WINDOW_REGISTRY, type WindowKey } from './pc-windows';
import { usePcDashboard } from './usePcDashboard';
import { supabase } from '../lib/supabase';

interface Props {
  userName: string;
  userId: string;
  userRole: UserRole;
  userAvatar: string;
  accessToken: string;
  isSuperAdmin: boolean;
  ghostCompanyId: string | null;
  ghostCompanyName: string | null;
  onSwitchCompany: (opts: { companyId: string | null; companyName?: string; targetUserId?: string }) => void;
}

function renderWindowContent(
  key: WindowKey,
  sharedData: any,
  refresh: () => void,
  loading: boolean,
  lastRefresh: Date | null,
  userId: string,
): React.ReactNode {
  const keyStr = String(key);
  const title = WINDOW_REGISTRY[keyStr]?.title || keyStr;
  if (keyStr === 'dashboard-win') {
    return <PcDashboard data={sharedData} loading={loading} lastRefresh={lastRefresh} onRefresh={refresh} />;
  }
  if (keyStr === 'messaging') {
    return <PcMesajlar userId={userId} />;
  }
  if (keyStr.startsWith('dm:')) {
    // format: dm:<userId>:<userName>
    const parts = keyStr.split(':');
    const targetId = parts[1];
    return <PcDmPopup targetUserId={targetId} userId={userId} />;
  }
  return <PcPlaceholder title={title} />;
}

export function PcLayout({ userName, userId, userRole, userAvatar, accessToken, isSuperAdmin, ghostCompanyId, ghostCompanyName, onSwitchCompany }: Props) {
  const { windows, openWindow, closeWindow, focusWindow, moveWindow } = useWindowManager();
  const companyKey = ghostCompanyId || 'self';
  const { data, loading, lastRefresh, refresh } = usePcDashboard(accessToken, companyKey);
  const [locked, setLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockAttempts, setUnlockAttempts] = useState(0);
  const [unlockLoading, setUnlockLoading] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleUnlock = async () => {
    if (!unlockPassword) {
      setUnlockError('Şifre girin');
      return;
    }
    setUnlockLoading(true);
    setUnlockError('');
    try {
      // Mevcut kullanıcının emailini al
      const { data: sess } = await supabase.auth.getSession();
      const email = sess.session?.user?.email;
      if (!email) {
        setUnlockError('Oturum bulunamadı');
        setUnlockLoading(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: unlockPassword });
      if (error) {
        const nextAttempts = unlockAttempts + 1;
        setUnlockAttempts(nextAttempts);
        setUnlockPassword('');
        if (nextAttempts >= 3) {
          setUnlockError('3 hatalı deneme — çıkış yapılıyor...');
          setTimeout(async () => {
            await supabase.auth.signOut();
            window.location.href = '/';
          }, 1200);
        } else {
          setUnlockError(`Yanlış şifre (${nextAttempts}/3)`);
        }
      } else {
        setLocked(false);
        setUnlockPassword('');
        setUnlockError('');
        setUnlockAttempts(0);
      }
    } catch (e: any) {
      setUnlockError('Doğrulama hatası: ' + (e.message || 'bilinmiyor'));
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleLock = () => {
    setLocked(true);
    setUnlockPassword('');
    setUnlockError('');
    setUnlockAttempts(0);
  };

  return (
    <div className="pc-root">
      <div className="pc-small-screen-warning">
        <div style={{ fontSize: 42 }}>📱</div>
        <h2>Ekran çok küçük</h2>
        <p>Bu panel 1280px ve üstü ekranlar için tasarlandı. Lütfen bilgisayarından aç, ya da mobil uygulamayı kullan.</p>
      </div>
      <div className="pc-layout">
        <div className="pc-topbar-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 }}>
          <div style={{ flex: 1 }}>
            <PcTopBar
              userName={userName}
              userRole={userRole}
              userAvatar={userAvatar}
              isSuperAdmin={isSuperAdmin}
              ghostCompanyId={ghostCompanyId}
              ghostCompanyName={ghostCompanyName}
              onSwitchCompany={onSwitchCompany}
            />
          </div>
        </div>
        <div style={{ filter: locked ? 'blur(12px)' : undefined, pointerEvents: locked ? 'none' : 'auto', userSelect: locked ? 'none' : 'auto', display: 'contents' }}>
          <PcLeftPanel
            tumPersonel={data?.tumPersonelDetay ?? []}
            aktifSayi={data?.aktifPersonelSayisi ?? 0}
            toplamSayi={data?.toplamPersonelSayisi ?? 0}
            onOpenDm={(targetId, name) => {
              const dmKey = `dm:${targetId}:${name}`;
              openWindow(dmKey, 'left', { title: `💬 ${name}` });
            }}
          />
          <main className="pc-main">
            <PcDashboard
              data={data}
              loading={loading}
              lastRefresh={lastRefresh}
              onRefresh={refresh}
              onLockScreen={handleLock}
              companyKey={companyKey}
            />
          </main>
          <PcRightSidebar onOpen={(k) => openWindow(k, 'right')} onLogout={handleLogout} />
        </div>
        {/* Kilit overlay — şifre sorar */}
        {locked && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(10, 5, 30, 0.92)', backdropFilter: 'blur(24px)',
              flexDirection: 'column', gap: 18, padding: 24,
            }}
          >
            {/* Şirket markası */}
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{
                fontSize: 56, fontWeight: 900, letterSpacing: -1.5,
                background: 'linear-gradient(135deg, #a8e6cf 0%, #9dd9ea 50%, #c5a8f5 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', color: 'transparent',
                lineHeight: 1,
              }}>
                {(ghostCompanyName || 'Aspect').toUpperCase()}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                letterSpacing: 4, marginTop: 6, textTransform: 'uppercase',
              }}>
                Operasyon Paneli
              </div>
            </div>
            <Lock size={42} color="#a8e6cf" style={{ marginTop: 8 }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Ekran Gizli</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 320 }}>
              Göstermek için <b>{userName}</b> şifrenizi girin.
            </div>
            <input
              type="password"
              autoFocus
              value={unlockPassword}
              onChange={e => { setUnlockPassword(e.target.value); setUnlockError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
              placeholder="Şifre"
              disabled={unlockLoading}
              style={{
                width: 300, padding: '12px 14px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, color: '#fff', fontSize: 14,
                outline: 'none',
              }}
            />
            {unlockError && (
              <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                {unlockError}
              </div>
            )}
            <button
              onClick={handleUnlock}
              disabled={unlockLoading || !unlockPassword}
              style={{
                padding: '10px 28px',
                background: 'rgba(168,230,207,0.15)',
                border: '1px solid rgba(168,230,207,0.3)',
                borderRadius: 10, color: '#a8e6cf', fontSize: 13, fontWeight: 700,
                cursor: unlockLoading ? 'not-allowed' : 'pointer',
                opacity: unlockLoading || !unlockPassword ? 0.5 : 1,
              }}
            >
              {unlockLoading ? 'Doğrulanıyor...' : '🔓 Kilidi Aç'}
            </button>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
              3 hatalı denemede otomatik çıkış yapılır
            </div>
          </div>
        )}

        {/* Floating pencereler */}
        {windows.map(w => {
          const info = WINDOW_REGISTRY[String(w.key)];
          return (
            <PcWindow
              key={String(w.key)}
              title={w.title || info?.title || String(w.key)}
              x={w.x}
              y={w.y}
              w={w.w}
              h={w.h}
              z={w.z}
              onClose={() => closeWindow(w.key)}
              onFocus={() => focusWindow(w.key)}
              onMove={(nx, ny) => moveWindow(w.key, nx, ny)}
            >
              {renderWindowContent(w.key, data, refresh, loading, lastRefresh, userId)}
            </PcWindow>
          );
        })}
      </div>
    </div>
  );
}
