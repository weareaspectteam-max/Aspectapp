import type { UserRole } from '../components/login';
import { supabase } from '../lib/supabase';

const ALLOWED: UserRole[] = ['yonetici', 'ust-mudur', 'mudur'];

export function PcGuard({ userRole, children }: { userRole: UserRole; children: React.ReactNode }) {
  if (!ALLOWED.includes(userRole)) {
    return (
      <div className="pc-guard-denied">
        <div style={{ fontSize: 42 }}>🖥️</div>
        <div className="pc-guard-denied-title">Bu panel masaüstü yöneticiler için</div>
        <div className="pc-guard-denied-msg">
          Rolün bu paneli görüntülemek için yeterli değil. Lütfen mobil uygulamadan devam et.
        </div>
        <button className="pc-guard-denied-btn" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}>
          Çıkış yap
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
