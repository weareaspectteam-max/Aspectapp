import { Users } from 'lucide-react';

interface Personel {
  id: string;
  name: string;
  mekan?: string;
  checkinZamani?: string;
  lateMin?: number;
  status: 'active' | 'late' | 'idle';
}

interface Props {
  tumPersonel: Personel[];
  aktifSayi: number;
  toplamSayi: number;
  onOpenDm?: (userId: string, name: string) => void;
}

export function PcLeftPanel({ tumPersonel, aktifSayi, toplamSayi, onOpenDm }: Props) {
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
    </aside>
  );
}
