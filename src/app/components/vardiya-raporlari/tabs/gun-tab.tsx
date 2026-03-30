import { useState } from 'react';
import {
  ChevronLeft, ChevronUp, ChevronDown, Loader2, AlertCircle,
  AlertTriangle, TrendingUp, FileSpreadsheet, FileText, PrinterIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatTarih, tl, API_BASE } from '../helpers';
import { getToken, appendGhostParam } from '../../../lib/api';
import { publicAnonKey } from '../../../lib/supabase-info';

export interface GunTabProps {
  gunListe: any[];
  setGunListe: React.Dispatch<React.SetStateAction<any[]>>;
  gunLoading: boolean;
  setGunLoading: (v: boolean) => void;
  gunError: string | null;
  gunSecili: string | null;
  setGunSecili: (v: string | null) => void;
  gunDetay: any;
  setGunDetay: (v: any) => void;
  gunDetayLoading: boolean;
  gunMekanAcik: Set<string>;
  setGunMekanAcik: React.Dispatch<React.SetStateAction<Set<string>>>;
  gunGorunenAdet: number;
  setGunGorunenAdet: React.Dispatch<React.SetStateAction<number>>;
  gunTarihBas: string;
  setGunTarihBas: (v: string) => void;
  gunTarihBit: string;
  setGunTarihBit: (v: string) => void;
  fetchGunListesi: (bas: string, bit: string) => void;
  fetchGunDetay: (tarih: string) => void;
  handleGunExcel: () => void;
  handleGunPDF: () => void;
}

export function GunTab({
  gunListe, setGunListe,
  gunLoading, setGunLoading,
  gunError,
  gunSecili, setGunSecili,
  gunDetay, setGunDetay,
  gunDetayLoading,
  gunMekanAcik, setGunMekanAcik,
  gunGorunenAdet, setGunGorunenAdet,
  gunTarihBas, setGunTarihBas,
  gunTarihBit, setGunTarihBit,
  fetchGunListesi, fetchGunDetay,
  handleGunExcel, handleGunPDF,
}: GunTabProps) {
  const [anomaliAcik, setAnomaliAcik] = useState(false);
  return (
    <div className="px-4 pb-8">
      {/* Tarih aralığı filtresi */}
      {!gunSecili && (
        <div className="flex items-center gap-2 mb-4">
          <input type="date" value={gunTarihBas} onChange={e => setGunTarihBas(e.target.value)}
            className="flex-1 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
          <span className="text-white/30 text-xs">{'\u2014'}</span>
          <input type="date" value={gunTarihBit} onChange={e => setGunTarihBit(e.target.value)}
            className="flex-1 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
          <button onClick={() => fetchGunListesi(gunTarihBas, gunTarihBit)}
            className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
            style={{ background: 'rgba(var(--app-accent-rgb),0.2)', border: '1px solid rgba(var(--app-accent-rgb),0.4)', color: 'var(--app-accent, #a855f7)' }}>
            Ara
          </button>
        </div>
      )}
      {!gunSecili && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => {
            const d = new Date();
            const bas = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
            const bit = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            setGunTarihBas(bas);
            setGunTarihBit(bit);
            fetchGunListesi(bas, bit);
          }}
            className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}>
            Bu Ay
          </button>
          <button onClick={() => {
            const d = new Date();
            const gun = d.getDay();
            const fark = gun === 0 ? 6 : gun - 1;
            d.setDate(d.getDate() - fark - 7);
            const bas = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            d.setDate(d.getDate() + 6);
            const bit = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            setGunTarihBas(bas);
            setGunTarihBit(bit);
            fetchGunListesi(bas, bit);
          }}
            className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
            {'\u00D6'}nceki Hafta
          </button>
          <button onClick={() => {
            const d = new Date();
            const gun = d.getDay();
            const fark = gun === 0 ? 6 : gun - 1;
            d.setDate(d.getDate() - fark);
            const bas = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            d.setDate(d.getDate() + 6);
            const bit = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            setGunTarihBas(bas);
            setGunTarihBit(bit);
            fetchGunListesi(bas, bit);
          }}
            className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
            Bu Hafta
          </button>
        </div>
      )}

      {/* Geri butonu (detay modunda) */}
      {gunSecili && (
        <button onClick={() => { setGunSecili(null); setGunDetay(null); }}
          className="flex items-center gap-2 mb-4 text-xs font-bold active:scale-95"
          style={{ color: 'var(--app-accent, #a855f7)' }}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Listeye D{'\u00F6'}n
        </button>
      )}

      {/* Yükleniyor */}
      {gunLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-ta animate-spin" />
        </div>
      )}

      {/* Hata */}
      {gunError && !gunLoading && (
        <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 text-sm font-bold">{gunError}</p>
        </div>
      )}

      {/* Boş */}
      {!gunLoading && !gunError && gunListe.length === 0 && !gunSecili && (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-white/40 text-sm font-bold">G{'\u00FC'}n raporu i{'\u00E7'}in "Ara" butonuna t{'\u0131'}klay{'\u0131'}n</p>
        </div>
      )}

      {/* ── GÜN LİSTESİ (kartlar) ── */}
      {!gunSecili && !gunLoading && gunListe.length > 0 && (
        <div className="space-y-3">
          {gunListe.slice(0, gunGorunenAdet).map((g: any) => {
            const karZarar = g.karZarar || 0;
            const karPositif = karZarar >= 0;
            const karRenk = karPositif ? '#34d399' : '#f87171';
            const ciro = g.toplamCiro || 0;
            const nakit = g.nakitToplam || 0;
            const iban = g.ibanToplam || 0;
            const kredi = g.krediToplam || 0;
            const odemeToplam = nakit + iban + kredi;
            return (
              <motion.button key={g.tarih}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setGunSecili(g.tarih); fetchGunDetay(g.tarih); }}
                className="w-full rounded-2xl text-left transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>

                {/* Üst bant — tarih + ciro */}
                <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                  <div>
                    <p className="text-[14px] font-black text-white leading-tight">{formatTarih(g.tarih)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {g.toplamMekan} mekan
                      </span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                      <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {g.toplamSatisAdet} satis
                      </span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                      <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {g.toplamKare} kare{g.iadeFotograf > 0 && <span style={{ color: 'rgba(248,113,113,0.5)' }}> ({g.iadeFotograf} iade)</span>}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[18px] font-black leading-tight" style={{ color: 'var(--app-accent, #a855f7)' }}>
                      {tl(ciro)}
                    </p>
                  </div>
                </div>

                {/* Ödeme dağılımı çubuğu */}
                {odemeToplam > 0 && (
                  <div className="px-4 pb-2">
                    <div className="flex rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                      {nakit > 0 && <div style={{ width: `${(nakit / odemeToplam) * 100}%`, background: '#34d399' }} />}
                      {iban > 0 && <div style={{ width: `${(iban / odemeToplam) * 100}%`, background: '#60a5fa' }} />}
                      {kredi > 0 && <div style={{ width: `${(kredi / odemeToplam) * 100}%`, background: '#f472b6' }} />}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      {nakit > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-semibold" style={{ color: 'rgba(52,211,153,0.6)' }}>Nakit</span>
                          <span className="text-[9px] font-bold" style={{ color: '#34d399' }}>{tl(nakit)}</span>
                        </div>
                      )}
                      {iban > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-semibold" style={{ color: 'rgba(96,165,250,0.6)' }}>IBAN</span>
                          <span className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>{tl(iban)}</span>
                        </div>
                      )}
                      {kredi > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-semibold" style={{ color: 'rgba(244,114,182,0.6)' }}>Kredi Kart{'\u0131'}</span>
                          <span className="text-[9px] font-bold" style={{ color: '#f472b6' }}>{tl(kredi)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Kar/Zarar + İskonto | Anomali + Geç Giriş */}
                <div className="flex items-center justify-between px-4 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                      style={{ background: karPositif ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${karPositif ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                      <TrendingUp style={{ width: 10, height: 10, color: karRenk }} />
                      <span className="text-[10px] font-bold" style={{ color: karRenk }}>
                        {tl(karZarar)}
                      </span>
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{
                        background: karPositif ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                        color: karRenk,
                      }}>%{g.karMarji || 0}</span>
                    </div>

                    {g.toplamIskonto > 0 && (() => {
                      const brut = (g.toplamCiro || 0) + g.toplamIskonto;
                      const iskYuzde = brut > 0 ? Math.round((g.toplamIskonto / brut) * 100) : 0;
                      return (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.18)' }}>
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(251,146,60,0.7)' }}>Isk</span>
                          <span className="text-[10px] font-bold" style={{ color: '#fb923c' }}>-{tl(g.toplamIskonto)}</span>
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(251,146,60,0.15)', color: '#fbbf24' }}>%{iskYuzde}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {(g.anomaliSayisi > 0 || g.gecGirisSayisi > 0) && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {g.anomaliSayisi > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
                          <AlertTriangle style={{ width: 9, height: 9, color: '#f87171' }} />
                          <span className="text-[9px] font-bold" style={{ color: '#f87171' }}>{g.anomaliSayisi} anomali</span>
                        </div>
                      )}

                      {g.gecGirisSayisi > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
                          <AlertCircle style={{ width: 9, height: 9, color: '#fbbf24' }} />
                          <span className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>{g.gecGirisSayisi} ge{'\u00E7'} giri{'\u015F'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Alt bant — mekanlar + açılır detay */}
                <button
                  onClick={(e) => { e.stopPropagation(); setGunMekanAcik(prev => { const n = new Set(prev); if (n.has(g.tarih)) n.delete(g.tarih); else n.add(g.tarih); return n; }); }}
                  className="flex items-center justify-between w-full px-4 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                  <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
                    {(g.mekanlar || []).slice(0, 5).map((m: string, i: number) => (
                      <span key={i} className="text-[9px] font-semibold px-2 py-0.5 rounded-full truncate"
                        style={{ background: 'rgba(var(--app-accent-rgb),0.08)', border: '1px solid rgba(var(--app-accent-rgb),0.15)', color: 'rgba(255,255,255,0.5)', maxWidth: 100 }}>
                        {m}
                      </span>
                    ))}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {gunMekanAcik.has(g.tarih) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {/* Açılır mekan detayı */}
                {gunMekanAcik.has(g.tarih) && (g.mekanDetay || []).length > 0 && (
                  <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {(g.mekanDetay || []).map((m: any) => {
                        const mKarMi = (m.karZarar || 0) >= 0;
                        return (
                          <div key={m.mekanId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 12, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.mekanEmoji || '\uD83D\uDCCD'} {m.mekanAd}</span>
                            <span style={{ textAlign: 'right', minWidth: 70 }}>
                              <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.5)', fontWeight: 600 }}>Gider </span>
                              <span style={{ color: 'rgba(239,68,68,0.7)', fontSize: 11, fontWeight: 700 }}>-{tl(m.gider)}</span>
                            </span>
                            <span style={{ textAlign: 'right', minWidth: 75 }}>
                              <span style={{ fontSize: 10, color: mKarMi ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)', fontWeight: 600 }}>K{'\u00E2'}r </span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: mKarMi ? '#34d399' : '#f87171' }}>{mKarMi ? '+' : ''}{tl(m.karZarar)}</span>
                            </span>
                            <span style={{ textAlign: 'right', minWidth: 70 }}>
                              <span style={{ fontSize: 10, color: 'rgba(var(--app-accent-rgb),0.5)', fontWeight: 600 }}>Ciro </span>
                              <span style={{ color: 'var(--app-accent, #a855f7)', fontSize: 12, fontWeight: 800 }}>{tl(m.ciro)}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })}

          {/* Önceki Hafta */}
          {!gunLoading && gunListe.length >= 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                const d = new Date(gunTarihBas + 'T00:00:00');
                d.setDate(d.getDate() - 7);
                const yeniBas = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const yeniBit = new Date(gunTarihBas + 'T00:00:00');
                yeniBit.setDate(yeniBit.getDate() - 1);
                const yeniBitStr = `${yeniBit.getFullYear()}-${String(yeniBit.getMonth()+1).padStart(2,'0')}-${String(yeniBit.getDate()).padStart(2,'0')}`;
                // Önceki haftanın verilerini mevcut listeye ekle
                (async () => {
                  setGunLoading(true);
                  try {
                    const token = await getToken();
                    const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/gun-raporu?baslangic=${yeniBas}&bitis=${yeniBitStr}`), {
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
                    });
                    const data = await res.json();
                    if (res.ok && data.gunler) {
                      setGunListe(prev => [...prev, ...data.gunler]);
                      setGunGorunenAdet(prev => prev + data.gunler.length);
                    }
                    setGunTarihBas(yeniBas);
                  } catch (e) { console.error('\u00D6nceki hafta hata:', e); }
                  finally { setGunLoading(false); }
                })();
              }}
              disabled={gunLoading}
              className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 mt-1"
              style={{ background: 'rgba(var(--app-accent-rgb),0.08)', border: '1px solid rgba(var(--app-accent-rgb),0.15)' }}
            >
              <ChevronDown style={{ width: 14, height: 14, color: 'var(--app-accent, #a855f7)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-accent, #a855f7)' }}>
                {'\u00D6'}nceki Hafta
              </span>
            </motion.button>
          )}
        </div>
      )}

      {/* ── GÜN DETAYI (tek gün seçildiğinde) ── */}
      {gunSecili && (
        <div>
          {gunDetayLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 text-ta animate-spin" />
            </div>
          )}
          {!gunDetayLoading && gunDetay && !gunDetay.bos && (
            <div className="space-y-3">
              {/* Anomaliler */}
              {(gunDetay.anomaliler || []).length > 0 && (() => {
                const anomSayisi = gunDetay.anomaliler.length;
                const stokSayisi = gunDetay.anomaliler.filter((a: any) => a.tip !== 'yazici').length;
                const yaziciSayisi = gunDetay.anomaliler.filter((a: any) => a.tip === 'yazici').length;
                const ozet = [stokSayisi > 0 && `${stokSayisi} stok`, yaziciSayisi > 0 && `${yaziciSayisi} yaz\u0131c\u0131`].filter(Boolean).join(', ');
                return (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)' }}>
                    <button
                      onClick={() => setAnomaliAcik(!anomaliAcik)}
                      className="w-full flex items-center justify-between px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#fb923c' }} />
                        <span className="text-[11px] font-bold" style={{ color: '#fb923c' }}>{anomSayisi} Anomali</span>
                        <span className="text-[9px] font-semibold" style={{ color: 'rgba(251,146,60,0.5)' }}>({ozet})</span>
                      </div>
                      {anomaliAcik
                        ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'rgba(251,146,60,0.5)' }} />
                        : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(251,146,60,0.5)' }} />
                      }
                    </button>
                    {anomaliAcik && (
                      <div style={{ borderTop: '1px solid rgba(251,146,60,0.15)' }}>
                        {gunDetay.anomaliler.map((a: any, i: number) => (
                          <div key={i} className="flex items-start gap-2.5 px-3 py-2">
                            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#fb923c' }} />
                            <div>
                              <p className="text-[10px] font-bold" style={{ color: '#fb923c' }}>
                                {a.mekanEmoji} {a.mekan} {'\u2014'} {a.tip === 'acilis' ? 'Stok' : a.tip === 'yazici' ? 'Yaz\u0131c\u0131' : 'Stok'}
                              </p>
                              {a.aciklama && (
                                <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{a.aciklama}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Günlük Ciro & Kâr/Zarar ── */}
              {(() => {
                const oz = gunDetay.ozet || {};
                const mal = gunDetay.maliyet || {};
                const odemeler: any[] = gunDetay.odemeler || [];
                const nakit = odemeler.find((o: any) => o.yontem === 'cash')?.ciro || 0;
                const iban = odemeler.find((o: any) => o.yontem === 'iban')?.ciro || 0;
                const kredi = odemeler.find((o: any) => o.yontem === 'card')?.ciro || 0;
                const toplamIsk = oz.toplamIskonto || 0;
                const brutCiro = (oz.toplamCiro || 0) + toplamIsk;
                const iskYuzde = brutCiro > 0 ? Math.round((toplamIsk / brutCiro) * 100) : 0;
                return (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.14)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {'\u2197'} G{'\u00FC'}nl{'\u00FC'}k Ciro & K{'\u00E2'}r/Zarar
                    </p>

                    {/* Nakit / IBAN / Kredi */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Nakit', val: nakit, color: '#34d399' },
                        { label: 'IBAN', val: iban, color: '#60a5fa' },
                        { label: 'Kredi', val: kredi, color: '#f472b6' },
                      ].map(t => (
                        <div key={t.label} className="rounded-xl p-2.5 text-center" style={{ background: `${t.color}10`, border: `1px solid ${t.color}20` }}>
                          <p className="text-[9px] font-bold mb-1" style={{ color: t.color }}>{t.label}</p>
                          <p className="text-[14px] font-black" style={{ color: 'rgba(255,255,255,0.9)' }}>{'\u20BA'}{Math.round(t.val).toLocaleString('tr-TR')}</p>
                        </div>
                      ))}
                    </div>

                    {/* İskonto */}
                    {toplamIsk > 0 && (
                      <div className="flex items-center justify-between mb-2 rounded-lg px-3 py-1.5" style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)' }}>
                        <span className="text-[11px] font-semibold" style={{ color: 'rgba(251,146,60,0.7)' }}>Toplam {'\u0130'}skonto</span>
                        <span className="text-[13px] font-black" style={{ color: '#fb923c' }}>
                          -{'\u20BA'}{toplamIsk.toLocaleString('tr-TR')} <span className="text-[10px]" style={{ opacity: 0.7 }}>%{iskYuzde}</span>
                        </span>
                      </div>
                    )}

                    {/* Toplam Ciro */}
                    <div className="flex items-center justify-between rounded-lg px-3 py-2.5 mb-3" style={{ background: 'rgba(var(--app-accent-rgb),0.1)', border: '1px solid rgba(var(--app-accent-rgb),0.25)' }}>
                      <span className="text-[13px] font-black" style={{ color: 'rgba(255,255,255,0.7)' }}>Toplam Ciro</span>
                      <span className="text-[19px] font-black" style={{ color: 'var(--app-accent, #a855f7)' }}>{'\u20BA'}{(oz.toplamCiro || 0).toLocaleString('tr-TR')}</span>
                    </div>

                    {/* Maliyet kırılımı */}
                    {(mal.toplamGider || 0) > 0 && (
                      <>
                        <div className="rounded-lg px-3 py-2.5 mb-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {(mal.albumMaliyeti || 0) > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Alb{'\u00FC'}m Maliyeti</span>
                              <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{(mal.albumMaliyeti || 0).toLocaleString('tr-TR')}</span>
                            </div>
                          )}
                          {(mal.baskiMaliyeti || 0) > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Bask{'\u0131'} Maliyeti</span>
                              <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{(mal.baskiMaliyeti || 0).toLocaleString('tr-TR')}</span>
                            </div>
                          )}
                          {(mal.primGideri || 0) > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Hakedi{'\u015F'} Gideri</span>
                              <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{(mal.primGideri || 0).toLocaleString('tr-TR')}</span>
                            </div>
                          )}
                          {(mal.maasGideri || 0) > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Personel Maa{'\u015F'}lar{'\u0131'}</span>
                              <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{(mal.maasGideri || 0).toLocaleString('tr-TR')}</span>
                            </div>
                          )}
                          {(mal.kiraGideri || 0) > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Mekan Kiras{'\u0131'} (g{'\u00FC'}nl{'\u00FC'}k)</span>
                              <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{(mal.kiraGideri || 0).toLocaleString('tr-TR')}</span>
                            </div>
                          )}
                        </div>

                        {/* Toplam Maliyet */}
                        <div className="flex items-center justify-between rounded-lg px-3 py-2 mb-2" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                          <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>Toplam Maliyet</span>
                          <span className="text-[15px] font-black" style={{ color: '#f87171' }}>-{'\u20BA'}{(mal.toplamGider || 0).toLocaleString('tr-TR')}</span>
                        </div>

                        {/* Brüt Kâr */}
                        <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{
                          background: (mal.karZarar || 0) >= 0 ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
                          border: `1px solid ${(mal.karZarar || 0) >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
                        }}>
                          <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>Br{'\u00FC'}t K{'\u00E2'}r</span>
                          <span className="text-[15px] font-black" style={{ color: (mal.karZarar || 0) >= 0 ? '#34d399' : '#f87171' }}>
                            {'\u20BA'}{(mal.karZarar || 0).toLocaleString('tr-TR')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Baskı Özeti */}
              {(gunDetay.ozet?.toplamBasilanFotograf || 0) > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-white">{'\uD83D\uDDA8\uFE0F'} Bask{'\u0131'} {'\u00D6'}zeti</p>
                    <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {(() => {
                        const mekanlar = gunDetay.mekanlar || [];
                        const yarim = mekanlar.filter((m: any) => (m.printType || 'yarim') === 'yarim').length;
                        const tam = mekanlar.filter((m: any) => m.printType === 'tam').length;
                        const boyStr = tam === 0 ? 'Yar\u0131m Boy' : yarim === 0 ? 'Tam Boy' : `${yarim} Yar\u0131m \u00B7 ${tam} Tam`;
                        const kagitlar = [...new Set(mekanlar.map((m: any) => m.paperName).filter(Boolean))] as string[];
                        const kagitStr = kagitlar.length === 0 ? '' : kagitlar.length === 1 ? ` \u00B7 ${kagitlar[0]}` : ` \u00B7 ${kagitlar.length} farkl\u0131 ka\u011F\u0131t`;
                        return boyStr + kagitStr;
                      })()}
                    </p>
                  </div>
                  {(() => {
                    const mekanlar = gunDetay.mekanlar || [];
                    const yarimBasilan = mekanlar.filter((m: any) => (m.printType || 'yarim') === 'yarim').reduce((s: number, m: any) => s + (m.basilanFotograf || 0), 0);
                    const tamBasilan = mekanlar.filter((m: any) => m.printType === 'tam').reduce((s: number, m: any) => s + (m.basilanFotograf || 0), 0);
                    const karisik = yarimBasilan > 0 && tamBasilan > 0;
                    const boyLabel = tamBasilan === 0 ? 'yar\u0131m boy' : yarimBasilan === 0 ? 'tam boy' : '';
                    return (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(157,217,234,0.07)', border: '1px solid rgba(157,217,234,0.15)' }}>
                          <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Toplam Bas{'\u0131'}lan</p>
                          <p className="text-base font-black" style={{ color: '#9dd9ea' }}>{gunDetay.ozet.toplamBasilanFotograf}</p>
                          {karisik ? (
                            <p className="text-[8px]" style={{ color: 'rgba(157,217,234,0.5)' }}>{yarimBasilan} yar{'\u0131'}m {'\u00B7'} {tamBasilan} tam</p>
                          ) : (
                            <p className="text-[9px]" style={{ color: 'rgba(157,217,234,0.5)' }}>{boyLabel} kare</p>
                          )}
                        </div>
                        <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)' }}>
                          <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Sat{'\u0131'}lan</p>
                          <p className="text-base font-black" style={{ color: '#4ade80' }}>{gunDetay.ozet.toplamSatilanFotograf || 0}</p>
                          <p className="text-[9px]" style={{ color: 'rgba(74,222,128,0.5)' }}>kare</p>
                        </div>
                        <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.15)' }}>
                          <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{'\u0130'}ade</p>
                          <p className="text-base font-black" style={{ color: '#f87171' }}>{gunDetay.ozet.toplamIadeFotograf || 0}</p>
                          <p className="text-[9px]" style={{ color: 'rgba(248,113,113,0.5)' }}>kare</p>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(157,217,234,0.07)', border: '1px solid rgba(157,217,234,0.15)' }}>
                      <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Kullan{'\u0131'}lan Bask{'\u0131'}</p>
                      <p className="text-base font-black" style={{ color: '#9dd9ea' }}>{gunDetay.ozet.toplamKullanilanBaski || 0}</p>
                      <p className="text-[9px]" style={{ color: 'rgba(157,217,234,0.5)' }}>tam boy bask{'\u0131'}</p>
                    </div>
                    <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Ka{'\u011F\u0131'}t Tipi</p>
                      <p className="text-sm font-black" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {(() => {
                          const kagitlar = [...new Set((gunDetay.mekanlar || []).map((m: any) => m.paperName).filter(Boolean))] as string[];
                          if (kagitlar.length === 0) return '\u2014';
                          if (kagitlar.length === 1) return kagitlar[0];
                          return `${kagitlar.length} farkl\u0131 ka\u011F\u0131t`;
                        })()}
                      </p>
                    </div>
                    <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(167,199,231,0.07)', border: '1px solid rgba(167,199,231,0.15)' }}>
                      <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Personel {'\u00C7'}ekimi</p>
                      <p className="text-base font-black" style={{ color: '#a7c7e7' }}>{gunDetay.ozet.toplamKare || 0}</p>
                      <p className="text-[9px]" style={{ color: 'rgba(167,199,231,0.5)' }}>kare</p>
                    </div>
                  </div>
                  {(gunDetay.maliyet?.baskiMaliyeti || 0) > 0 && (
                    <div className="flex items-center justify-between rounded-lg p-2.5" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                      <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Toplam Bask{'\u0131'} Maliyeti</span>
                      <span className="text-[15px] font-black" style={{ color: '#f87171' }}>-{'\u20BA'}{(gunDetay.maliyet.baskiMaliyeti || 0).toLocaleString('tr-TR')}</span>
                    </div>
                  )}
                </div>
              )}


              {/* Albüm */}
              {(gunDetay.albumler || []).length > 0 && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Alb{'\u00FC'}m</p>
                    <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {(() => {
                        const mekanlar = gunDetay.mekanlar || [];
                        const yarim = mekanlar.filter((m: any) => (m.printType || 'yarim') === 'yarim').length;
                        const tam = mekanlar.filter((m: any) => m.printType === 'tam').length;
                        if (tam === 0) return 'Yar\u0131m Boy';
                        if (yarim === 0) return 'Tam Boy';
                        return `${yarim} Yar\u0131m \u00B7 ${tam} Tam`;
                      })()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(gunDetay.albumler || []).map((a: any) => (
                      <div key={a.tip} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{a.tip}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{'\u00D7'}{a.adet}</span>
                      </div>
                    ))}
                  </div>
                  {(gunDetay.maliyet?.albumMaliyeti || 0) > 0 && (
                    <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                      <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Alb{'\u00FC'}m Maliyeti</span>
                      <span className="text-[15px] font-black" style={{ color: '#f87171' }}>-{'\u20BA'}{(gunDetay.maliyet.albumMaliyeti || 0).toLocaleString('tr-TR')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Mekan Sıralaması */}
              {(gunDetay.mekanlar || []).length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-black text-white mb-2">{'\uD83D\uDCCD'} Mekan S{'\u0131'}ralamas{'\u0131'}</p>
                  <div className="space-y-2">
                    {(gunDetay.mekanlar || []).map((m: any, i: number) => (
                      <div key={m.id} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <span className="text-xs font-black w-5 text-center" style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                        <span className="text-sm">{m.emoji}</span>
                        <span className="text-xs font-bold text-white flex-1 truncate">{m.name}</span>
                        <span className="text-xs font-black" style={{ color: '#34d399' }}>{'\u20BA'}{(m.ciro || 0).toLocaleString('tr-TR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personel */}
              {(gunDetay.personeller || []).length > 0 && (() => {
                // Anomali olan mekanları bul
                const anomaliMekanlar = new Set((gunDetay.anomaliler || []).map((a: any) => a.mekan));
                return (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-xs font-black text-white mb-2">{'\uD83D\uDC64'} Personel Performans{'\u0131'}</p>
                    <div className="space-y-2">
                      {(gunDetay.personeller || []).map((p: any, i: number) => {
                        const personelAnomali = (p.mekanlar || []).some((m: string) => anomaliMekanlar.has(m));
                        return (
                          <div key={p.id} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <span className="text-xs font-black w-5 text-center" style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-white truncate">{p.ad}</p>
                                {p.gecGiris && (
                                  <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {'\u26A0\uFE0F'} Ge{'\u00E7'} {p.gecGirisDk > 0 ? `${p.gecGirisDk}dk` : ''}
                                  </span>
                                )}
                                {personelAnomali && (
                                  <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 4, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {'\u26A0\uFE0F'} Anomali
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {p.satisAdet} sat{'\u0131\u015F'} {'\u00B7'} {p.kare} kare
                              </p>
                            </div>
                            <p className="text-xs font-black" style={{ color: '#34d399' }}>{'\u20BA'}{(p.ciro || 0).toLocaleString('tr-TR')}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}



              {/* Dışa Aktar */}
              <div style={{ marginTop: 6, marginBottom: 24 }}>
                <p className="text-center text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>D{'\u0131\u015F'}a Aktar</p>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => window.print()}
                    className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <PrinterIcon style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.4)' }} />
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>Yazd{'\u0131'}r</span>
                  </button>
                  <button onClick={handleGunExcel}
                    className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                    style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <FileSpreadsheet style={{ width: 18, height: 18, color: '#34d399' }} />
                    <span className="text-[10px] font-bold" style={{ color: '#34d399' }}>Excel</span>
                  </button>
                  <button onClick={handleGunPDF}
                    className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                    style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <FileText style={{ width: 18, height: 18, color: '#f87171' }} />
                    <span className="text-[10px] font-bold" style={{ color: '#f87171' }}>PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
