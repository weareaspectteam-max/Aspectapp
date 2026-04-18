import { useCallback, useEffect, useState } from 'react';
import { buildHeaders, ghostParams, getToken } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

export interface PcDashboardData {
  tarih: string;
  toplamCiro: number;
  toplamAdet: number;
  toplamKare: number;
  toplamBasilan?: number;
  toplamIadeFoto?: number;
  anomaliSayisi: number;
  aktifMekanSayisi: number;
  toplamMekanSayisi: number;
  aktifPersonelSayisi?: number;
  toplamPersonelSayisi?: number;
  gecGirisSayisi?: number;
  aktifPersonelDetay?: { name: string; mekan?: string; checkinZamani?: string }[];
  tumPersonelDetay?: { id: string; name: string; mekan?: string; checkinZamani?: string; lateMin?: number; status: 'active' | 'late' | 'idle' }[];
  mekanCiroList: { id: string; name: string; emoji: string; color: string; ciro: number; iskonto?: number; adet: number; kare?: number; acik?: boolean; urunDagilimi?: { tip: string; adet: number }[] }[];
  albumDagilimi?: { tip: string; adet: number }[];
  odemeDagilimi?: { nakit: number; kart: number; iban: number };
  dunCiroSaatlik?: number;
  dunCiroGunluk?: number;
  genelStok?: { albumToplam: number; ribon: number; paspartu: number };
}

export function usePcDashboard(accessToken: string, companyKey?: string) {
  const [data, setData] = useState<PcDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = accessToken || await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/manager/dashboard-summary${ghostParams()}`, { headers: buildHeaders(token) });
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
    // Otomatik refresh kaldırıldı — kullanıcı yenile butonuyla manuel yenilesin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, companyKey]);

  return { data, loading, lastRefresh, refresh: fetchData };
}
