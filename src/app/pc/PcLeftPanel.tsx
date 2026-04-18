import { useEffect, useState } from 'react';
import { Users, Building2 } from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';
import type { UserRole } from '../components/login';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface Personel {
  id: string;
  name: string;
  mekan?: string;
  checkinZamani?: string;
  lateMin?: number;
  status: 'active' | 'late' | 'idle';
}

interface GlobalYonetici {
  userId: string;
  name: string;
  avatar: string;
  companyId: string;
  companyName: string;
}

interface Props {
  tumPersonel: Personel[];
  aktifSayi: number;
  toplamSayi: number;
  userRole: UserRole;
  isSuperAdmin?: boolean;
  onOpenDm?: (userId: string, name: string) => void;
  onOpenGlobalDm?: (userId: string, name: string, companyName: string) => void;
}

export function PcLeftPanel({ tumPersonel, aktifSayi, toplamSayi, userRole, isSuperAdmin, onOpenDm, onOpenGlobalDm }: Props) {
  const [yoneticiler, setYoneticiler] = useState<GlobalYonetici[]>([]);
  const showGlobal = userRole === 'yonetici' || isSuperAdmin;

  useEffect(() => {
    if (!showGlobal) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${SERVER}/global/yoneticiler`, { headers });
        if (res.ok && !cancelled) {
          const d = await res.json();
          setYoneticiler(d.yoneticiler || []);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [showGlobal]);
  return (
    <aside className="pc-sidebar pc-sidebar-left">
      <div className="pc-left-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} color="#9dd9ea" />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Personel</span>
        </div>
        <span style={{ fontSize: 11, color: '#9dd9ea', fontWeight: 700 }}>
          {aktifSayi} / {toplamSayi}
        </span>
      </div>
      <div className="pc-left-list">
        {tumPersonel.length === 0 ? (
          <div className="pc-empty" style={{ padding: 20 }}>Personel yok</div>
        ) : (
          tumPersonel.map(p => {
            const isActive = p.status === 'active';
            const isLate = p.status === 'late';
            const isIdle = p.status === 'idle';
            const dotColor = isActive ? '#34d399' : isLate ? '#fbbf24' : 'rgba(255,255,255,0.2)';
            const nameColor = isActive ? '#fff' : isLate ? '#fbbf24' : 'rgba(255,255,255,0.45)';
            const bg = isActive ? 'rgba(52,211,153,0.06)' : isLate ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)';
            const border = isActive ? 'rgba(52,211,153,0.15)' : isLate ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.05)';
            const clickable = !!onOpenDm;
            return (
              <div
                key={p.id}
                onClick={clickable ? () => onOpenDm!(p.id, p.name) : undefined}
                title={clickable ? `${p.name}'e mesaj gönder` : undefined}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: bg,
                  border: `1px solid ${border}`,
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={(e) => { if (clickable) e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { if (clickable) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: dotColor,
                    boxShadow: isIdle ? 'none' : `0 0 6px ${dotColor}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: nameColor }}>{p.name}</span>
                  {isLate && (p.lateMin ?? 0) > 0 && (
                    <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700, marginLeft: 'auto' }}>
                      +{p.lateMin}dk
                    </span>
                  )}
                </div>
                {!isIdle && p.mekan && (
                  <div style={{ fontSize: 10, color: isLate ? 'rgba(251,191,36,0.7)' : '#a8e6cf', marginLeft: 12, marginTop: 2 }}>📍 {p.mekan}</div>
                )}
                {!isIdle && p.checkinZamani && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginLeft: 12, marginTop: 1 }}>
                    🕐 {new Date(p.checkinZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* En altta — Şirket Yöneticileri (cross-company DM) */}
      {showGlobal && yoneticiler.length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          marginTop: 8, paddingTop: 10,
          display: 'flex', flexDirection: 'column', gap: 4,
          maxHeight: '40%', overflowY: 'auto',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 6px', fontSize: 10, fontWeight: 800, color: '#c5a8f5', letterSpacing: 1 }}>
            <Building2 size={11} />
            ŞİRKET YÖNETİCİLERİ
          </div>
          {yoneticiler.map(y => (
            <div
              key={y.userId}
              onClick={onOpenGlobalDm ? () => onOpenGlobalDm(y.userId, y.name, y.companyName) : undefined}
              title={`${y.name} → ${y.companyName} (mesaj gönder)`}
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                background: 'rgba(197,168,245,0.06)',
                border: '1px solid rgba(197,168,245,0.15)',
                cursor: onOpenGlobalDm ? 'pointer' : 'default',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => { if (onOpenGlobalDm) e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { if (onOpenGlobalDm) e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{y.avatar || '👤'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{y.name}</span>
              </div>
              <div style={{ fontSize: 9, color: '#c5a8f5', marginLeft: 18, marginTop: 2 }}>🏢 {y.companyName}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
