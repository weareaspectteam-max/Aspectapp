import { useEffect } from 'react';

interface ResourceManagementProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

/**
 * ResourceManagement — İşletme İstatistikleri ile aynı içeriğe sahipti.
 * Artık "isletme-istatistikleri" sayfasına otomatik yönlendirir.
 */
export function ResourceManagement({ onNavigate }: ResourceManagementProps) {
  useEffect(() => {
    onNavigate('isletme-istatistikleri');
  }, []);
  return null;
}