import { useState, useMemo, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import type { UserRole } from '../components/login';
import { PcRightSidebar } from './PcRightSidebar';
import { PcLeftPanel } from './PcLeftPanel';
import { PcTopBar } from './PcTopBar';
import { PcDashboard, type CenterView } from './screens/PcDashboard';
import { PcMesajlar } from './screens/PcMesajlar';
import { PcPlaceholder } from './screens/PcPlaceholder';
import { PcLiveFeed } from './screens/PcLiveFeed';
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
  companyKey?: string,
): React.ReactNode {
  const keyStr = String(key);
  const title = WINDOW_REGISTRY[keyStr]?.title || keyStr;
  if (keyStr === 'dashboard-win') {
    return <PcDashboard data={sharedData} loading={loading} lastRefresh={lastRefresh} onRefresh={refresh} />;
  }
  if (keyStr === 'messaging') {
    return <PcMesajlar userId={userId} />;
  }
  if (keyStr === 'live-feed' || keyStr.startsWith('live-feed:')) {
    return <PcLiveFeed companyKey={companyKey} />;
  }
  if (keyStr.startsWith('gdm:')) {
    // global dm format: gdm:<userId>:<userName>:<companyName>
    const parts = keyStr.split(':');
    const targetId = parts[1];
    return <PcDmPopup targetUserId={targetId} userId={userId} globalMode />;
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
  const { windows, openWindow, closeWindow, focusWindow, moveWindow, resizeWindow } = useWindowManager();
  const companyKey = ghostCompanyId || 'self';
  const { data, loading, lastRefresh, refresh } = usePcDashboard(accessToken, companyKey);
  const [centerView, setCenterView] = useState<CenterView>('feed');
  const [locked, setLocked] = useState<boolean>(() => {
    try { return localStorage.getItem('pc-locked') === '1'; } catch { return false; }
  });
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockAttempts, setUnlockAttempts] = useState(0);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [justSucceeded, setJustSucceeded] = useState(false);
  const [wrongFlashKey, setWrongFlashKey] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  // Mouse parallax handler
  useEffect(() => {
    if (!locked) return;
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setMousePos({ x: (e.clientX - cx) / cx, y: (e.clientY - cy) / cy });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [locked]);

  // Yıldız tozu — sabit array (her render yeniden oluşmasın)
  const stars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 14,
      duration: 12 + Math.random() * 10,
      size: 1 + Math.random() * 2.5,
      twinkleDelay: Math.random() * 3,
    })), []);

  const companyDisplayName = (ghostCompanyName || 'Aspect').toUpperCase();
  const companyChars = useMemo(() => companyDisplayName.split(''), [companyDisplayName]);

  type MascotMood = 'idle' | 'typing' | 'wrong1' | 'wrong2' | 'goodbye' | 'happy';
  const mood: MascotMood =
    justSucceeded ? 'happy'
    : unlockAttempts >= 3 ? 'goodbye'
    : unlockAttempts === 2 ? 'wrong2'
    : unlockAttempts === 1 ? 'wrong1'
    : unlockPassword.length > 0 ? 'typing'
    : 'idle';

  const MASCOT_MAP: Record<MascotMood, { emoji: string; text: string; anim: string }> = {
    idle:    { emoji: '😺', text: `Merhaba ${userName.split(' ')[0]}, şifreni girer misin?`, anim: 'pc-mascot-bounce 2.4s ease-in-out infinite' },
    typing:  { emoji: '😼', text: 'Görmüyorum, söz!',                                          anim: 'pc-mascot-bounce 2.4s ease-in-out infinite' },
    wrong1:  { emoji: '😾', text: 'Yanlış! 2 hakkın kaldı',                                    anim: 'pc-mascot-angry 0.5s ease-in-out' },
    wrong2:  { emoji: '🙀', text: 'Sen kimsin?! Doğru gir, tek hakkın!',                       anim: 'pc-mascot-angry 0.5s ease-in-out' },
    goodbye: { emoji: '😿', text: 'Hoşçakal...',                                               anim: 'none' },
    happy:   { emoji: '😻', text: `Hoş geldin, ${userName.split(' ')[0]}!`,                    anim: 'pc-mascot-happy 0.8s ease-out' },
  };
  const mascot = MASCOT_MAP[mood];

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
        setWrongFlashKey(k => k + 1);
        if (nextAttempts >= 3) {
          setUnlockError('');
          setTimeout(async () => {
            try { localStorage.removeItem('pc-locked'); } catch {}
            await supabase.auth.signOut();
            window.location.href = '/';
          }, 1800);
        } else {
          setUnlockError('');
        }
      } else {
        setJustSucceeded(true);
        setUnlockError('');
        try { localStorage.removeItem('pc-locked'); } catch {}
        setTimeout(() => {
          setLocked(false);
          setUnlockPassword('');
          setUnlockAttempts(0);
          setJustSucceeded(false);
        }, 1100);
      }
    } catch (e: any) {
      setUnlockError('Doğrulama hatası: ' + (e.message || 'bilinmiyor'));
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleLock = () => {
    setLocked(true);
    try { localStorage.setItem('pc-locked', '1'); } catch {}
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
            userRole={userRole}
            isSuperAdmin={isSuperAdmin}
            onOpenDm={(targetId, name) => {
              const dmKey = `dm:${targetId}:${name}`;
              openWindow(dmKey, 'left', { title: `💬 ${name}` });
            }}
            onOpenGlobalDm={(targetId, name, companyName) => {
              const dmKey = `gdm:${targetId}:${name}:${companyName}`;
              openWindow(dmKey, 'left', { title: `🏢 ${name} (${companyName})` });
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
              ghostCompanyName={ghostCompanyName}
              onExitGhost={ghostCompanyId ? () => onSwitchCompany({ companyId: null }) : undefined}
              centerView={centerView}
              onCenterViewChange={setCenterView}
            />
          </main>
          <PcRightSidebar
            activeCenterView={centerView}
            onOpen={(k) => {
              // Canlı Feed: her tıklamada yeni pencere (multi-instance)
              if (k === 'live-feed') {
                const uniqueKey = `live-feed:${Date.now()}`;
                openWindow(uniqueKey, 'right', { title: '📡 Canlı Feed', defaultWidth: 520, defaultHeight: 640 });
              } else if (k === 'rotation') {
                // Dashboard'a in-place yönlendir (popup açma)
                setCenterView('rotasyon-atama');
              } else {
                openWindow(k, 'right');
              }
            }}
            onLogout={handleLogout}
          />
        </div>
        {/* Kilit overlay — sinematik animasyonlar + panda maskotu */}
        {locked && (
          <div
            ref={overlayRef}
            style={{
              position: 'fixed', inset: 0, zIndex: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(10, 5, 30, 0.92)', backdropFilter: 'blur(24px)',
              padding: 24, overflow: 'hidden',
              animation: justSucceeded
                ? 'pc-lock-success-out 0.6s ease-in 0.4s forwards'
                : 'pc-lock-fadein 0.4s ease-out',
            }}
          >
            {/* Flash katmanı — yanlış/doğru anında renk patlar, overlay'in kendisi remount olmaz */}
            <div
              key={`flash-${wrongFlashKey}-${justSucceeded ? 'ok' : ''}`}
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                animation: justSucceeded ? 'pc-flash-green 1s ease-out' : (wrongFlashKey > 0 ? 'pc-flash-red 0.8s ease-out' : 'none'),
              }}
            />
            {/* AURORA arkaplan — 3 yumuşak gradient bant */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{
                position: 'absolute', top: '10%', left: '5%', width: '60vw', height: '50vh',
                background: 'radial-gradient(ellipse at center, rgba(168,230,207,0.22) 0%, transparent 60%)',
                filter: 'blur(40px)',
                animation: 'pc-aurora-1 18s ease-in-out infinite',
                transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -15}px)`,
                transition: 'transform 0.4s ease-out',
              }} />
              <div style={{
                position: 'absolute', top: '40%', right: '5%', width: '55vw', height: '45vh',
                background: 'radial-gradient(ellipse at center, rgba(197,168,245,0.2) 0%, transparent 60%)',
                filter: 'blur(48px)',
                animation: 'pc-aurora-2 22s ease-in-out infinite',
                transform: `translate(${mousePos.x * -30}px, ${mousePos.y * -20}px)`,
                transition: 'transform 0.4s ease-out',
              }} />
              <div style={{
                position: 'absolute', bottom: '5%', left: '30%', width: '50vw', height: '40vh',
                background: 'radial-gradient(ellipse at center, rgba(157,217,234,0.18) 0%, transparent 60%)',
                filter: 'blur(36px)',
                animation: 'pc-aurora-3 26s ease-in-out infinite',
                transform: `translate(${mousePos.x * -15}px, ${mousePos.y * -25}px)`,
                transition: 'transform 0.4s ease-out',
              }} />
            </div>

            {/* YILDIZ TOZU */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              {stars.map(s => (
                <div
                  key={s.id}
                  style={{
                    position: 'absolute',
                    left: `${s.left}%`,
                    width: s.size, height: s.size,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.85)',
                    boxShadow: '0 0 4px rgba(255,255,255,0.7)',
                    animation: `pc-star-rise ${s.duration}s linear ${s.delay}s infinite, pc-star-twinkle 2.5s ease-in-out ${s.twinkleDelay}s infinite`,
                  }}
                />
              ))}
            </div>

            {/* ANA İÇERİK — 2 sütun (sol: form, sağ: maskot) */}
            <div style={{
              position: 'relative', zIndex: 2,
              display: 'flex', alignItems: 'center', gap: 60,
              transform: `translate(${mousePos.x * 6}px, ${mousePos.y * 4}px)`,
              transition: 'transform 0.3s ease-out',
            }}>

              {/* SOL — Logo + Lock + Form */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, minWidth: 320 }}>
                {/* Şirket logosu — harf harf giriş + gradient akma */}
                <div style={{ textAlign: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 0 }}>
                    {companyChars.map((ch, i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-block',
                          fontSize: 60, fontWeight: 900, letterSpacing: -1.5,
                          background: 'linear-gradient(90deg, #a8e6cf 0%, #9dd9ea 25%, #c5a8f5 50%, #f9a8d4 75%, #a8e6cf 100%)',
                          backgroundSize: '300% 100%',
                          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text', color: 'transparent',
                          lineHeight: 1,
                          opacity: 0,
                          animation: `pc-logo-char-in 0.5s ease-out ${i * 80}ms forwards, pc-logo-flow 6s ease-in-out ${500 + i * 80}ms infinite`,
                        }}
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                    letterSpacing: 4, marginTop: 8, textTransform: 'uppercase',
                    opacity: 0,
                    animation: `pc-logo-char-in 0.5s ease-out ${companyChars.length * 80 + 100}ms forwards`,
                  }}>
                    Operasyon Paneli
                  </div>
                </div>

                {/* Kilit + 4 orbital nokta */}
                <div style={{ position: 'relative', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute', top: '50%', left: '50%',
                        width: 8, height: 8, marginTop: -4, marginLeft: -4,
                        borderRadius: '50%',
                        background: '#a8e6cf',
                        boxShadow: '0 0 8px #a8e6cf',
                        animation: `pc-orbit 4s linear ${i * -1}s infinite`,
                      }}
                    />
                  ))}
                  <Lock size={42} color="#a8e6cf" style={{ animation: 'pc-lock-breath 2.4s ease-in-out infinite', position: 'relative', zIndex: 1 }} />
                </div>

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
                  disabled={unlockLoading || unlockAttempts >= 3 || justSucceeded}
                  key={`input-${wrongFlashKey}`}
                  style={{
                    width: 300, padding: '12px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${wrongFlashKey > 0 && !justSucceeded ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 10, color: '#fff', fontSize: 14,
                    outline: 'none',
                    animation: wrongFlashKey > 0 ? 'pc-shake 0.4s ease-in-out' : undefined,
                    transition: 'border-color 0.2s',
                  }}
                />
                {unlockError && (
                  <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                    {unlockError}
                  </div>
                )}
                <button
                  onClick={handleUnlock}
                  disabled={unlockLoading || !unlockPassword || unlockAttempts >= 3 || justSucceeded}
                  style={{
                    padding: '10px 28px',
                    background: 'rgba(168,230,207,0.15)',
                    border: '1px solid rgba(168,230,207,0.3)',
                    borderRadius: 10, color: '#a8e6cf', fontSize: 13, fontWeight: 700,
                    cursor: unlockLoading ? 'not-allowed' : 'pointer',
                    opacity: (unlockLoading || !unlockPassword || unlockAttempts >= 3 || justSucceeded) ? 0.5 : 1,
                  }}
                >
                  {justSucceeded ? '✓ Açılıyor...' : unlockLoading ? 'Doğrulanıyor...' : '🔓 Kilidi Aç'}
                </button>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                  3 hatalı denemede otomatik çıkış yapılır
                </div>
              </div>

              {/* SAĞ — Panda maskotu + speech bubble */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minWidth: 240 }}>
                <div
                  style={{
                    fontSize: 110, lineHeight: 1,
                    animation: mascot.anim,
                    animationFillMode: 'both',
                    filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.4))',
                  }}
                  key={`mascot-${mood}-${wrongFlashKey}`}
                >
                  {mascot.emoji}
                </div>
                <div
                  key={`bubble-${mood}-${wrongFlashKey}`}
                  style={{
                    position: 'relative',
                    background: mood === 'wrong1' || mood === 'wrong2' ? 'rgba(248,113,113,0.15)'
                      : mood === 'goodbye' ? 'rgba(255,255,255,0.06)'
                      : mood === 'happy' ? 'rgba(52,211,153,0.18)'
                      : 'rgba(168,230,207,0.12)',
                    border: `1px solid ${
                      mood === 'wrong1' || mood === 'wrong2' ? 'rgba(248,113,113,0.4)'
                      : mood === 'happy' ? 'rgba(52,211,153,0.45)'
                      : 'rgba(168,230,207,0.3)'
                    }`,
                    color: mood === 'wrong1' || mood === 'wrong2' ? '#fca5a5'
                      : mood === 'happy' ? '#a8e6cf'
                      : mood === 'goodbye' ? 'rgba(255,255,255,0.7)'
                      : '#fff',
                    padding: '10px 16px',
                    borderRadius: 14,
                    fontSize: 13, fontWeight: 700,
                    maxWidth: 240, textAlign: 'center',
                    animation: 'pc-bubble-in 0.35s ease-out',
                  }}
                >
                  {/* Konuşma balonu kuyruğu — yukarı (panda'ya) */}
                  <div style={{
                    position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                    width: 12, height: 12,
                    background: 'inherit',
                    borderTop: '1px solid', borderLeft: '1px solid',
                    borderColor: 'inherit',
                  }} />
                  {mascot.text}
                </div>
              </div>

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
              onResize={(nw, nh) => resizeWindow(w.key, nw, nh)}
            >
              {renderWindowContent(w.key, data, refresh, loading, lastRefresh, userId, companyKey)}
            </PcWindow>
          );
        })}
      </div>
    </div>
  );
}
