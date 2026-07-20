import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { authHeaders, appendGhostParam } from '../lib/api';
import { AcikSatir, type AcikKaydi } from './acik-panel';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background: 'rgba(0,0,0,0.65)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 16,
};

const fmtTL = (n: number) => `₺${(Number(n) || 0).toLocaleString('tr-TR')}`;

interface Props {
  userName: string;
  userRole: string;
  accessToken: string;
  onNavigate: (tab: string) => void;
}

/** Açıklarım — her personel YALNIZCA kendi açık/fazla kayıtlarını görür (salt görüntüleme) */
export function AcikTakip({ onNavigate }: Props) {
  const [acikler, setAcikler] = useState<AcikKaydi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const yukle = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(appendGhostParam(`${API_BASE}/kapanis-bildirim/acigim`), { headers });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Kayıtlar yüklenemedi');
      setAcikler(d.acikler || []);
    } catch (e: any) {
      setError(e.message || 'Ağ hatası');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const toplamAcik = acikler.reduce((s, a) => s + (a.kalanAcik || 0), 0);
  const toplamFazla = acikler.reduce((s, a) => s + Math.max(0, -(a.acikToplam || 0)), 0);

  return (
    <div style={{ padding: '16px 14px 100px', minHeight: '100vh' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => onNavigate('dashboard')}
          style={{
            width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#fbbf24" /> Açık Takip
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Teslimat açıkların — sadece kendi kayıtlarını görürsün</div>
        </div>
        <button
          onClick={yukle}
          disabled={loading}
          style={{
            width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>

      {/* Toplam */}
      <div style={{
        ...glass, padding: '14px 16px', marginBottom: 14, textAlign: 'center',
        border: toplamAcik > 0 ? '1.5px solid rgba(248,113,113,0.5)' : '1px solid rgba(168,230,207,0.35)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 }}>TOPLAM AÇIĞIN</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: toplamAcik > 0 ? '#f87171' : '#a8e6cf' }}>
          {toplamAcik > 0 ? fmtTL(toplamAcik) : '₺0 🎉'}
        </div>
        {toplamFazla > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a8e6cf', marginTop: 2 }}>+{fmtTL(toplamFazla)} fazla verdin</div>
        )}
      </div>

      {error && (
        <div style={{ ...glass, padding: 16, textAlign: 'center', fontSize: 13, color: '#f87171' }}>{error}</div>
      )}

      {!error && !loading && acikler.length === 0 && (
        <div style={{ ...glass, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Hiç açık kaydın yok — tüm teslimatların tam.</div>
        </div>
      )}

      {/* Gün gün kayıtlar — salt görüntüleme, tahsilat yetkili kişilerce girilir */}
      <div>
        {acikler.map(k => (
          <AcikSatir key={k.id} kayit={k} />
        ))}
      </div>
    </div>
  );
}
