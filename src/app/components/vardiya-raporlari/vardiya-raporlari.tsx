/**
 * VardiyaRaporlari — Yönetici/Müdür, kapanışı tamamlanmış vardiya raporları
 * Gerçek veri: GET /vardiya/raporlar  |  DELETE /vardiya/sil
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { publicAnonKey } from '../../lib/supabase-info';
import { getToken, appendGhostParam } from '../../lib/api';
import { bizDateStr } from '../../lib/date';

import type { VardiyaKayit, Props } from './types';
import { API_BASE } from './helpers';
import { SilmeOnayDialog } from './silme-onay-dialog';
import { VardiyaTab } from './tabs/vardiya-tab';
import { GunTab } from './tabs/gun-tab';
import { AyTab } from './tabs/ay-tab';
import { handleGunExcel } from './gun-export-excel';
import { handleGunPDF } from './gun-export-pdf';

export function VardiyaRaporlari({ userName, userRole, onLogout, onNavigate }: Props) {
  const [aktifSekme, setAktifSekme] = useState<'vardiya' | 'gun' | 'ay'>('vardiya');
  const [raporlar, setRaporlar] = useState<VardiyaKayit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seciliId, setSeciliId] = useState<string | null>(null);

  // Gün raporu state — varsayılan: bu hafta pazartesi-pazar
  const [gunTarihBas, setGunTarihBas] = useState(() => {
    const d = new Date();
    const gun = d.getDay();
    const fark = gun === 0 ? 6 : gun - 1;
    d.setDate(d.getDate() - fark);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [gunTarihBit, setGunTarihBit] = useState(() => {
    const d = new Date();
    const gun = d.getDay();
    const fark = gun === 0 ? 0 : 7 - gun;
    d.setDate(d.getDate() + fark);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const GUN_SAYFA_BOYUTU = 7;
  const [gunListe, setGunListe] = useState<any[]>([]);
  const [gunGorunenAdet, setGunGorunenAdet] = useState(GUN_SAYFA_BOYUTU);
  const [gunSecili, setGunSecili] = useState<string | null>(null);
  const [gunDetay, setGunDetay] = useState<any>(null);
  const [gunLoading, setGunLoading] = useState(false);
  const [gunError, setGunError] = useState<string | null>(null);
  const [gunDetayLoading, setGunDetayLoading] = useState(false);
  const [gunMekanAcik, setGunMekanAcik] = useState<Set<string>>(new Set());
  const [aySecili, setAySecili] = useState<any>(null);

  // Ay bazlı state
  const [aySeciliYil, setAySeciliYil] = useState(() => new Date().getFullYear());
  const [ayData, setAyData] = useState<any[]>([]);
  const [ayLoading, setAyLoading] = useState(false);
  const [ayAcik, setAyAcik] = useState<Set<string>>(new Set());

  // Silme
  const [silOnayV, setSilOnayV] = useState<VardiyaKayit | null>(null);
  const [silYukleniyor, setSilYukleniyor] = useState(false);
  const canDelete = userRole === 'yonetici';

  // Filtreler
  const [filtreMekan, setFiltreMekan] = useState('');
  const [filtreTarihBas, setFiltreTarihBas] = useState(() => bizDateStr());
  const [filtreTarihBit, setFiltreTarihBit] = useState(() => bizDateStr());
  const [enEskiTarih, setEnEskiTarih] = useState(() => bizDateStr());

  const mekanlar = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of raporlar) map[r.mekanId] = r.mekan;
    return Object.entries(map).map(([id, ad]) => ({ id, ad }));
  }, [raporlar]);

  /* ─── Fetch: Vardiya ─── */
  const fetchRaporlar = useCallback(async (bas: string, bit: string, mkId: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (bas) params.set('baslangic', bas);
      if (bit) params.set('bitis', bit);
      if (mkId) params.set('mekanId', mkId);
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/raporlar?${params.toString()}`), {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `HTTP ${res.status}`); return; }
      setRaporlar(data.raporlar || []);
    } catch (e) {
      console.error('[VardiyaRaporlari] fetch error:', e);
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRaporlar(filtreTarihBas, filtreTarihBit, filtreMekan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAra = () => fetchRaporlar(filtreTarihBas, filtreTarihBit, filtreMekan);

  const fetchOncekiGun = useCallback(async () => {
    const d = new Date(enEskiTarih + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const oncekiGun = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      params.set('baslangic', oncekiGun);
      params.set('bitis', oncekiGun);
      if (filtreMekan) params.set('mekanId', filtreMekan);
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/raporlar?${params.toString()}`), {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
      });
      const data = await res.json();
      if (res.ok && data.raporlar) {
        setRaporlar(prev => [...prev, ...data.raporlar]);
      }
      setEnEskiTarih(oncekiGun);
    } catch (e) {
      console.error('[VardiyaRaporlari] onceki gun hata:', e);
    } finally {
      setLoading(false);
    }
  }, [enEskiTarih, filtreMekan]);

  const handleReset = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const bas = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const bit = bizDateStr();
    setFiltreMekan('');
    setFiltreTarihBas(bas);
    setFiltreTarihBit(bit);
    fetchRaporlar(bas, bit, '');
  };

  const handleSil = async () => {
    if (!silOnayV) return;
    setSilYukleniyor(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/vardiya/sil`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
        body: JSON.stringify({ mekanId: silOnayV.mekanId, tarih: silOnayV.tarih }),
      });
      const data = await res.json();
      if (!res.ok) { console.error('[VardiyaRaporlari] silme hatası:', data.error); alert(`Silme hatası: ${data.error}`); return; }
      setRaporlar(prev => prev.filter(r => r.id !== silOnayV.id));
      setSilOnayV(null);
    } catch (e) {
      console.error('[VardiyaRaporlari] silme fetch error:', e);
      alert('Sunucuya bağlanılamadı.');
    } finally {
      setSilYukleniyor(false);
    }
  };

  /* ─── Fetch: Gün ─── */
  const fetchGunListesi = useCallback(async (bas: string, bit: string) => {
    setGunLoading(true);
    setGunError(null);
    setGunSecili(null);
    setGunDetay(null);
    setGunGorunenAdet(GUN_SAYFA_BOYUTU);
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/gun-raporu?baslangic=${bas}&bitis=${bit}`), {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
      });
      const data = await res.json();
      if (!res.ok) { setGunError(data.error || `HTTP ${res.status}`); return; }
      setGunListe(data.gunler || []);
    } catch (e) {
      setGunError('Sunucuya bağlanılamadı.');
    } finally {
      setGunLoading(false);
    }
  }, []);

  const fetchGunDetay = useCallback(async (tarih: string) => {
    setGunDetayLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/gun-raporu?tarih=${tarih}`), {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
      });
      const data = await res.json();
      if (res.ok) setGunDetay(data);
    } catch (e) { /* ignore */ }
    finally { setGunDetayLoading(false); }
  }, []);

  /* ─── Fetch: Ay ─── */
  const fetchAyRaporu = useCallback(async (yil?: number) => {
    setAyLoading(true);
    try {
      const y = yil || aySeciliYil;
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/ay-raporu?yil=${y}`), {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hata');
      setAyData(data.aylar || []);
    } catch (e) {
      console.error('Ay raporu hata:', e);
    } finally {
      setAyLoading(false);
    }
  }, [aySeciliYil]);

  const secili = raporlar.find(r => r.id === seciliId) ?? null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-white font-black" style={{ fontSize: 18 }}>Vardiya Raporları</h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {aktifSekme === 'gun' ? (gunSecili ? `Gün Detayı — ${gunSecili}` : `Gün Raporu — ${gunListe.length} gün`) : secili ? secili.mekan : loading ? 'Yükleniyor…' : `${raporlar.length} kapanmış vardiya`}
          </p>
        </div>
        {!secili && (
          <button
            onClick={aktifSekme === 'gun' ? () => { if (gunSecili) fetchGunDetay(gunSecili); else fetchGunListesi(gunTarihBas, gunTarihBit); } : handleAra}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}
          >
            <RefreshCw className={`w-4 h-4 text-violet-400 ${(aktifSekme === 'gun' ? gunLoading : loading) ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Sekme Seçici */}
      {!secili && (
        <div className="px-4 pb-3">
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {([['vardiya', 'Vardiya Bazlı'], ['gun', 'Gün Bazlı'], ['ay', 'Ay Bazlı']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setAktifSekme(key); if (key === 'gun' && gunListe.length === 0) fetchGunListesi(gunTarihBas, gunTarihBit); if (key === 'ay' && ayData.length === 0) fetchAyRaporu(); }}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: aktifSekme === key ? 'rgba(167,139,250,0.25)' : 'transparent',
                  color: aktifSekme === key ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                  border: aktifSekme === key ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
                }}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ════ AY BAZLI ════ */}
      {aktifSekme === 'ay' && !secili && (
        <AyTab
          ayData={ayData} ayLoading={ayLoading}
          aySecili={aySecili} setAySecili={setAySecili}
          aySeciliYil={aySeciliYil} setAySeciliYil={setAySeciliYil}
          ayAcik={ayAcik} setAyAcik={setAyAcik}
          fetchAyRaporu={fetchAyRaporu}
        />
      )}

      {/* ════ GÜN BAZLI ════ */}
      {aktifSekme === 'gun' && !secili && (
        <GunTab
          gunListe={gunListe} setGunListe={setGunListe}
          gunLoading={gunLoading} setGunLoading={setGunLoading}
          gunError={gunError}
          gunSecili={gunSecili} setGunSecili={setGunSecili}
          gunDetay={gunDetay} setGunDetay={setGunDetay}
          gunDetayLoading={gunDetayLoading}
          gunMekanAcik={gunMekanAcik} setGunMekanAcik={setGunMekanAcik}
          gunGorunenAdet={gunGorunenAdet} setGunGorunenAdet={setGunGorunenAdet}
          gunTarihBas={gunTarihBas} setGunTarihBas={setGunTarihBas}
          gunTarihBit={gunTarihBit} setGunTarihBit={setGunTarihBit}
          fetchGunListesi={fetchGunListesi} fetchGunDetay={fetchGunDetay}
          handleGunExcel={() => handleGunExcel(gunDetay, gunSecili)}
          handleGunPDF={() => handleGunPDF(gunDetay, gunSecili)}
        />
      )}

      {/* ════ VARDİYA BAZLI ════ */}
      {aktifSekme === 'vardiya' && (
        <VardiyaTab
          raporlar={raporlar} loading={loading} error={error}
          secili={secili} setSeciliId={setSeciliId}
          canDelete={canDelete} setSilOnayV={setSilOnayV}
          fetchOncekiGun={fetchOncekiGun} enEskiTarih={enEskiTarih}
          filtreMekan={filtreMekan} setFiltreMekan={setFiltreMekan}
          filtreTarihBas={filtreTarihBas} setFiltreTarihBas={setFiltreTarihBas}
          filtreTarihBit={filtreTarihBit} setFiltreTarihBit={setFiltreTarihBit}
          mekanlar={mekanlar}
          onReset={handleReset} onAra={handleAra}
        />
      )}

      {/* Silme Onay Dialog */}
      <AnimatePresence>
        {silOnayV && (
          <SilmeOnayDialog
            v={silOnayV}
            yukleniyor={silYukleniyor}
            onOnayla={handleSil}
            onIptal={() => { if (!silYukleniyor) setSilOnayV(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
