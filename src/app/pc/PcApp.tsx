import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setAuthToken, setGhostCompanyId as setGhostCompanyIdInApi } from '../lib/api';
import { Login } from '../components/login';
import type { UserRole } from '../components/login';
import { PcLayout } from './PcLayout';
import { PcGuard } from './PcGuard';
import { UrgentMessageModal } from '../components/urgent-message-modal';
import './pc.css';

export type { PcScreen } from './pc-types';

interface AuthState {
  loggedIn: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  userAvatar: string;
  accessToken: string;
  isSuperAdmin: boolean;
  originalToken: string;     // ghost öncesi kendi token'ı
  ghostCompanyId: string | null;
  ghostCompanyName: string | null;
}

const initialAuth: AuthState = {
  loggedIn: false,
  userId: '',
  userName: '',
  userEmail: '',
  userRole: 'personel',
  userAvatar: '👨‍💼',
  accessToken: '',
  isSuperAdmin: false,
  originalToken: '',
  ghostCompanyId: null,
  ghostCompanyName: null,
};

function applyUser(user: any, token: string): AuthState {
  const rawRole: string = (user.user_metadata?.role as string) || 'bekleyen';
  const isSA = rawRole === 'superadmin';
  const role: UserRole = isSA ? 'yonetici' : (rawRole as UserRole);
  return {
    loggedIn: true,
    userId: user.id,
    userName: user.user_metadata?.full_name || user.email || '',
    userEmail: user.email || '',
    userRole: role,
    userAvatar: user.user_metadata?.avatar || '👨‍💼',
    accessToken: token,
    isSuperAdmin: isSA,
    originalToken: '',
    ghostCompanyId: null,
    ghostCompanyName: null,
  };
}

export function PcApp() {
  const [auth, setAuth] = useState<AuthState>(initialAuth);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Fresh metadata için getUser() — getSession bayat user_metadata dönebilir
          let userToUse = session.user;
          try {
            const { data: { user: freshUser } } = await supabase.auth.getUser();
            if (freshUser) userToUse = freshUser;
          } catch {}
          const next = applyUser(userToUse, session.access_token);
          setAuth(next);
          setAuthToken(next.accessToken);
        }
      } catch {}
      finally { setLoading(false); }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setAuth(initialAuth);
        setAuthToken('');
      } else if (session.user) {
        const next = applyUser(session.user, session.access_token);
        setAuth(prev => {
          const keepGhost = !!prev.ghostCompanyId;
          const merged: AuthState = {
            ...next,
            ghostCompanyId: prev.ghostCompanyId,
            ghostCompanyName: prev.ghostCompanyName,
            originalToken: keepGhost ? prev.originalToken : '',
            accessToken: keepGhost ? prev.accessToken : session.access_token,
          };
          setAuthToken(merged.accessToken);
          return merged;
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="pc-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="pc-loading" />
      </div>
    );
  }

  if (!auth.loggedIn) {
    return (
      <div className="pc-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <Login
            onLogin={(role, name, userId, accessToken, avatar, email) => {
              setAuth({ loggedIn: true, userId, userName: name, userEmail: email, userRole: role, userAvatar: avatar || '👨‍💼', accessToken });
              setAuthToken(accessToken);
            }}
          />
        </div>
      </div>
    );
  }

  const switchCompany = async (opts: { companyId: string | null; companyName?: string; targetUserId?: string }) => {
    const { companyId, companyName, targetUserId } = opts;
    if (!companyId) {
      // Ghost'tan çık
      if (auth.originalToken) {
        setAuth(prev => ({ ...prev, accessToken: prev.originalToken, originalToken: '', ghostCompanyId: null, ghostCompanyName: null }));
        setAuthToken(auth.originalToken);
      } else {
        setAuth(prev => ({ ...prev, ghostCompanyId: null, ghostCompanyName: null }));
      }
      setGhostCompanyIdInApi(null);
      return;
    }
    let newToken = auth.accessToken;
    let originalToSave = auth.originalToken;
    if (targetUserId) {
      try {
        const { authHeaders } = await import('../lib/api');
        const headers = await authHeaders();
        const SERVER = `https://${(await import('../lib/supabase-info')).projectId}.supabase.co/functions/v1/make-server-4da0b637`;
        const res = await fetch(`${SERVER}/superadmin/ghost-token`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ targetUserId }),
        });
        const data = await res.json();
        if (res.ok && data.access_token) {
          originalToSave = originalToSave || auth.accessToken;
          newToken = data.access_token;
          setAuthToken(newToken);
        }
      } catch (e) {
        console.error('[PcApp] switch:', e);
      }
    }
    setGhostCompanyIdInApi(companyId);
    setAuth(prev => ({ ...prev, accessToken: newToken, originalToken: originalToSave, ghostCompanyId: companyId, ghostCompanyName: companyName || companyId }));
  };

  return (
    <div className="pc-root">
      <PcGuard userRole={auth.userRole}>
        <PcLayout
          userName={auth.userName}
          userId={auth.userId}
          userRole={auth.userRole}
          userAvatar={auth.userAvatar}
          accessToken={auth.accessToken}
          isSuperAdmin={auth.isSuperAdmin}
          ghostCompanyId={auth.ghostCompanyId}
          ghostCompanyName={auth.ghostCompanyName}
          onSwitchCompany={switchCompany}
        />
      </PcGuard>
      <UrgentMessageModal isLoggedIn={auth.loggedIn} />
    </div>
  );
}
