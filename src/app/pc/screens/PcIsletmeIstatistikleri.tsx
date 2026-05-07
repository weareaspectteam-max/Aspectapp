import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { IsletmeIstatistikleri } from '../../components/isletme-istatistikleri';
import { SatisRaporu } from '../../components/satis-raporu';
import { AnomaliPanosu } from '../../components/anomali-panosu';
import { IndirimIstatistik } from '../../components/indirim-istatistik';
import { VardiyaIstatistikleri } from '../../components/vardiya-istatistikleri';
import { KareIstatistik } from '../../components/kare-istatistik';
import { MekanIstatistikleri } from '../../components/mekan-istatistikleri';
import type { UserRole } from '../../components/login';

interface Props {
  userName: string;
  userRole: UserRole;
  accessToken: string;
}

type Sub = 'satis-raporu' | 'anomali-panosu' | 'indirim-istatistik' | 'vardiya-istatistikleri' | 'kare-istatistik' | 'mekan-istatistikleri';

const SUB_TITLES: Record<Sub, string> = {
  'satis-raporu': 'Satış İstatistikleri',
  'anomali-panosu': 'Anomali İstatistikleri',
  'indirim-istatistik': 'İndirim İstatistikleri',
  'vardiya-istatistikleri': 'Vardiya İstatistikleri',
  'kare-istatistik': 'Personel Performans',
  'mekan-istatistikleri': 'Mekan İstatistikleri',
};

export function PcIsletmeIstatistikleri({ userName, userRole, accessToken }: Props) {
  const [subScreen, setSubScreen] = useState<Sub | null>(null);

  const handleNavigate = (tab: string) => {
    if (['satis-raporu', 'anomali-panosu', 'indirim-istatistik', 'vardiya-istatistikleri', 'kare-istatistik', 'mekan-istatistikleri'].includes(tab)) {
      setSubScreen(tab as Sub);
    } else {
      // Tanımsız tab → hub'a dön
      setSubScreen(null);
    }
  };

  const wrapStyle: React.CSSProperties = {
    height: '100%', overflowY: 'auto', overflowX: 'hidden',
    display: 'flex', flexDirection: 'column',
  };

  if (!subScreen) {
    return (
      <div style={wrapStyle}>
        <IsletmeIstatistikleri
          userName={userName}
          userRole={userRole}
          onLogout={() => {}}
          onNavigate={handleNavigate}
        />
      </div>
    );
  }

  const BackBar = (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(255,255,255,0.04)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', gap: 10,
      flexShrink: 0,
    }}>
      <button
        onClick={() => setSubScreen(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
          background: 'rgba(168,230,207,0.12)',
          border: '1px solid rgba(168,230,207,0.3)',
          borderRadius: 7, color: '#a8e6cf', fontSize: 12, fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <ChevronLeft size={13} /> İşletme İstatistikleri
      </button>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{SUB_TITLES[subScreen]}</span>
    </div>
  );

  const commonProps = { userName, userRole, accessToken, onLogout: () => {}, onNavigate: handleNavigate };

  return (
    <div style={wrapStyle}>
      {BackBar}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {subScreen === 'satis-raporu' && <SatisRaporu {...commonProps} />}
        {subScreen === 'anomali-panosu' && <AnomaliPanosu {...commonProps} />}
        {subScreen === 'indirim-istatistik' && <IndirimIstatistik {...commonProps} />}
        {subScreen === 'vardiya-istatistikleri' && <VardiyaIstatistikleri {...commonProps} />}
        {subScreen === 'kare-istatistik' && <KareIstatistik {...commonProps} />}
        {subScreen === 'mekan-istatistikleri' && <MekanIstatistikleri {...commonProps} />}
      </div>
    </div>
  );
}
