import { useState } from 'react';
import {
  ChevronLeft, ChevronUp, ChevronDown,
  AlertCircle, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { tl } from '../helpers';

export interface AyTabProps {
  ayData: any[];
  ayLoading: boolean;
  aySecili: any;
  setAySecili: (v: any) => void;
  aySeciliYil: number;
  setAySeciliYil: (v: number) => void;
  ayAcik: Set<string>;
  setAyAcik: React.Dispatch<React.SetStateAction<Set<string>>>;
  fetchAyRaporu: (yil?: number) => void;
}

export function AyTab({
  ayData, ayLoading, aySecili, setAySecili,
  aySeciliYil, setAySeciliYil,
  ayAcik, setAyAcik, fetchAyRaporu,
}: AyTabProps) {
  const [ayAnomaliAcik, setAyAnomaliAcik] = useState(false);
  return (
    <>
      {/* ════ AY BAZLI RAPOR — DETAY ════ */}
      {aySecili && (
        <div className="px-4 pb-8">
          {/* Geri butonu + Ay ba{'\u015F'}l{'\u0131\u011F\u0131'} */}
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setAySecili(null)}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <ChevronLeft style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.5)' }} />
            </button>
            <div>
              <p className="text-base font-black text-white">{aySecili.label}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {aySecili.gunSayisi} g{'\u00FC'}n {'\u00B7'} {aySecili.toplamSatis} sat{'\u0131\u015F'} {'\u00B7'} {aySecili.toplamKare} kare
              </p>
            </div>
          </div>

          <div className="space-y-3">

            {/* ── Ayl{'\u0131'}k Ciro & K{'\u00E2'}r/Zarar ── */}
            {(() => {
              const ekGelirTotal = (aySecili.mekanDetay || []).reduce((s: number, m: any) => s + (m.ekGelir || 0), 0);
              const nakit = aySecili.nakitToplam + ekGelirTotal;
              const iban = aySecili.ibanToplam || 0;
              const kredi = aySecili.krediToplam || 0;
              const toplamIsk = aySecili.toplamIskonto || 0;
              const brutCiro = (aySecili.toplamCiro || 0) + toplamIsk;
              const iskYuzde = brutCiro > 0 ? Math.round((toplamIsk / brutCiro) * 100) : 0;
              const baskiMal = aySecili.toplamBaskiMaliyet || 0;
              const albumMal = aySecili.albumMaliyet || 0;
              const maasMal = aySecili.maasGideri || 0;
              const hakedisMal = aySecili.hakedisGideri || 0;
              const kiraMal = aySecili.kiraMaliyeti || 0;
              const toplamGider = aySecili.toplamGider || 0;
              const karZarar = aySecili.karZarar || 0;
              return (
                <div className="rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.14)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {'\u2197'} Ayl{'\u0131'}k Ciro & K{'\u00E2'}r/Zarar
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

                  {/* {'\u0130'}skonto */}
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
                    <span className="text-[19px] font-black" style={{ color: 'var(--app-accent, #a855f7)' }}>{'\u20BA'}{(aySecili.toplamCiro || 0).toLocaleString('tr-TR')}</span>
                  </div>

                  {/* Maliyet k{'\u0131'}r{'\u0131'}l{'\u0131'}m{'\u0131'} */}
                  {toplamGider > 0 && (
                    <>
                      <div className="rounded-lg px-3 py-2.5 mb-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {albumMal > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Alb{'\u00FC'}m Maliyeti</span>
                            <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{albumMal.toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                        {baskiMal > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Bask{'\u0131'} Maliyeti</span>
                            <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{baskiMal.toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                        {hakedisMal > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Hakedi{'\u015F'} Gideri</span>
                            <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{hakedisMal.toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                        {maasMal > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Personel Maa{'\u015F'}lar{'\u0131'}</span>
                            <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{maasMal.toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                        {kiraMal > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Mekan Kiras{'\u0131'}</span>
                            <span className="text-[12px] font-bold" style={{ color: '#f87171' }}>-{'\u20BA'}{kiraMal.toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                      </div>

                      {/* Toplam Maliyet */}
                      <div className="flex items-center justify-between rounded-lg px-3 py-2 mb-2" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                        <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>Toplam Maliyet</span>
                        <span className="text-[15px] font-black" style={{ color: '#f87171' }}>-{'\u20BA'}{toplamGider.toLocaleString('tr-TR')}</span>
                      </div>

                      {/* Br{'\u00FC'}t K{'\u00E2'}r */}
                      <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{
                        background: karZarar >= 0 ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
                        border: `1px solid ${karZarar >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
                      }}>
                        <span className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>Br{'\u00FC'}t K{'\u00E2'}r</span>
                        <span className="text-[15px] font-black" style={{ color: karZarar >= 0 ? '#34d399' : '#f87171' }}>
                          {'\u20BA'}{karZarar.toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* ── Bask{'\u0131'} {'\u00D6'}zeti ── */}
            {(aySecili.toplamBasilan || 0) > 0 && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black text-white">{'\uD83D\uDDA8\uFE0F'} Bask{'\u0131'} {'\u00D6'}zeti</p>
                  <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {(() => {
                      const mekanlar = aySecili.mekanDetay || [];
                      const yarim = mekanlar.filter((m: any) => (m.baskiBoyutu || 'yarim') === 'yarim').length;
                      const tam = mekanlar.filter((m: any) => m.baskiBoyutu === 'tam').length;
                      const boyStr = tam === 0 ? 'Yar\u0131m Boy' : yarim === 0 ? 'Tam Boy' : `${yarim} Yar\u0131m \u00B7 ${tam} Tam`;
                      const kagitlar = [...new Set(mekanlar.map((m: any) => m.baskiKagitAdi).filter(Boolean))] as string[];
                      const kagitStr = kagitlar.length === 0 ? '' : kagitlar.length === 1 ? ` \u00B7 ${kagitlar[0]}` : ` \u00B7 ${kagitlar.length} farkl\u0131 ka\u011F\u0131t`;
                      return boyStr + kagitStr;
                    })()}
                  </p>
                </div>

                {/* Toplam Bas{'\u0131'}lan / Sat{'\u0131'}lan / {'\u0130'}ade */}
                {(() => {
                  const mekanlar = aySecili.mekanDetay || [];
                  const yarimBasilan = mekanlar.filter((m: any) => (m.baskiBoyutu || 'yarim') === 'yarim').reduce((s: number, m: any) => s + (m.baskiAdet || 0), 0);
                  const tamBasilan = mekanlar.filter((m: any) => m.baskiBoyutu === 'tam').reduce((s: number, m: any) => s + (m.baskiAdet || 0), 0);
                  const karisik = yarimBasilan > 0 && tamBasilan > 0;
                  const boyLabel = tamBasilan === 0 ? 'yar\u0131m boy kare' : yarimBasilan === 0 ? 'tam boy kare' : '';
                  return (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(157,217,234,0.07)', border: '1px solid rgba(157,217,234,0.15)' }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Toplam Bas{'\u0131'}lan</p>
                    <p className="text-base font-black" style={{ color: '#9dd9ea' }}>{(aySecili.toplamBasilan || 0).toLocaleString('tr-TR')}</p>
                    {karisik ? (
                      <p className="text-[8px]" style={{ color: 'rgba(157,217,234,0.5)' }}>{yarimBasilan} yar{'\u0131'}m {'\u00B7'} {tamBasilan} tam</p>
                    ) : (
                      <p className="text-[9px]" style={{ color: 'rgba(157,217,234,0.5)' }}>{boyLabel}</p>
                    )}
                  </div>
                  <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.15)' }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Sat{'\u0131'}lan</p>
                    <p className="text-base font-black" style={{ color: '#4ade80' }}>{(aySecili.toplamSatilanFotograf || 0).toLocaleString('tr-TR')}</p>
                    <p className="text-[9px]" style={{ color: 'rgba(74,222,128,0.5)' }}>kare</p>
                  </div>
                  <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.15)' }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{'\u0130'}ade</p>
                    <p className="text-base font-black" style={{ color: '#f87171' }}>{(aySecili.toplamIadeFotograf || 0).toLocaleString('tr-TR')}</p>
                    <p className="text-[9px]" style={{ color: 'rgba(248,113,113,0.5)' }}>kare</p>
                  </div>
                </div>
                  );
                })()}

                {/* Kullan{'\u0131'}lan Bask{'\u0131'} / Ka{'\u011F\u0131'}t Tipi / Personel {'\u00C7'}ekimi */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(157,217,234,0.07)', border: '1px solid rgba(157,217,234,0.15)' }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Kullan{'\u0131'}lan Bask{'\u0131'}</p>
                    <p className="text-base font-black" style={{ color: '#9dd9ea' }}>{(aySecili.toplamKullanilanBaski || 0).toLocaleString('tr-TR')}</p>
                    <p className="text-[9px]" style={{ color: 'rgba(157,217,234,0.5)' }}>tam boy bask{'\u0131'}</p>
                  </div>
                  <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Ka{'\u011F\u0131'}t Tipi</p>
                    <p className="text-sm font-black" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {(() => {
                        const kagitlar = [...new Set((aySecili.mekanDetay || []).map((m: any) => m.baskiKagitAdi).filter(Boolean))] as string[];
                        if (kagitlar.length === 0) return '\u2014';
                        if (kagitlar.length === 1) return kagitlar[0];
                        return `${kagitlar.length} farkl\u0131 ka\u011F\u0131t`;
                      })()}
                    </p>
                  </div>
                  <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(167,199,231,0.07)', border: '1px solid rgba(167,199,231,0.15)' }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Personel {'\u00C7'}ekimi</p>
                    <p className="text-base font-black" style={{ color: '#a7c7e7' }}>{(aySecili.toplamKare || 0).toLocaleString('tr-TR')}</p>
                    <p className="text-[9px]" style={{ color: 'rgba(167,199,231,0.5)' }}>kare</p>
                  </div>
                </div>

                {/* Toplam Bask{'\u0131'} Maliyeti */}
                {(aySecili.toplamBaskiMaliyet || 0) > 0 && (
                  <div className="flex items-center justify-between rounded-lg p-2.5" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                    <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Toplam Bask{'\u0131'} Maliyeti</span>
                    <span className="text-[15px] font-black" style={{ color: '#f87171' }}>-{'\u20BA'}{(aySecili.toplamBaskiMaliyet || 0).toLocaleString('tr-TR')}</span>
                  </div>
                )}

              </div>
            )}

            {/* ── Alb{'\u00FC'}m ── */}
            {(aySecili.albumler || []).length > 0 && (
              <div className="rounded-xl p-4 mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Sat{'\u0131'}lan Da{'\u011F\u0131'}l{'\u0131'}m{'\u0131'} ve Alb{'\u00FC'}m Maliyeti</p>
                  <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {(() => {
                      const mekanlar = aySecili.mekanDetay || [];
                      const yarim = mekanlar.filter((m: any) => (m.baskiBoyutu || 'yarim') === 'yarim').length;
                      const tam = mekanlar.filter((m: any) => m.baskiBoyutu === 'tam').length;
                      if (tam === 0) return 'Yar\u0131m Boy';
                      if (yarim === 0) return 'Tam Boy';
                      return `${yarim} Yar\u0131m \u00B7 ${tam} Tam`;
                    })()}
                  </p>
                </div>
                {(() => {
                  const albumler = [...(aySecili.albumler || [])].sort((a: any, b: any) => {
                    const sA = parseInt(String(a.tip).match(/^(\d+)/)?.[1] || '999');
                    const sB = parseInt(String(b.tip).match(/^(\d+)/)?.[1] || '999');
                    return sA - sB;
                  });
                  const maxAdet = Math.max(...albumler.map((a: any) => a.adet), 1);
                  const toplamAdet = albumler.reduce((s: number, a: any) => s + a.adet, 0);
                  return (
                    <>
                      <div className="space-y-1.5 mb-3">
                        {albumler.map((a: any) => {
                          const oran = maxAdet > 0 ? (a.adet / maxAdet) * 100 : 0;
                          const yuzde = toplamAdet > 0 ? Math.round((a.adet / toplamAdet) * 100) : 0;
                          return (
                            <div key={a.tip} className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.5)', minWidth: 70, maxWidth: 90 }}>{a.tip}</span>
                              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.05)' }}>
                                <div style={{ width: `${oran}%`, height: '100%', background: 'linear-gradient(90deg, rgba(var(--app-accent-rgb),0.6), rgba(var(--app-accent-rgb),0.3))', borderRadius: 99 }} />
                              </div>
                              <span className="text-[11px] font-black" style={{ color: 'var(--app-accent, #a855f7)', minWidth: 24, textAlign: 'right' }}>{a.adet}</span>
                              <span className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.25)', minWidth: 28, textAlign: 'right' }}>%{yuzde}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[9px] mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <span>Toplam {toplamAdet} adet</span>
                      </div>
                    </>
                  );
                })()}
                {(aySecili.albumMaliyet || 0) > 0 && (
                  <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                    <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Alb{'\u00FC'}m Maliyeti</span>
                    <span className="text-[15px] font-black" style={{ color: '#f87171' }}>-{'\u20BA'}{(aySecili.albumMaliyet || 0).toLocaleString('tr-TR')}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Mekan Detay{'\u0131'} (a{'\u00E7\u0131'}l{'\u0131'}r) ── */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-black text-white px-3 pt-3 pb-2">{'\uD83D\uDCCD'} Mekan S{'\u0131'}ralamas{'\u0131'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {(aySecili.mekanDetay || []).sort((a: any, b: any) => b.ciro - a.ciro).map((m: any, mi: number) => {
                  const mKarMi = (m.karZarar || 0) >= 0;
                  const mekanAcikMi = ayAcik.has(`detay_${m.mekanId}`);
                  const mAlbumler = [...(m.albumler || [])].sort((a: any, b: any) => {
                    const sA = parseInt(String(a.tip).match(/^(\d+)/)?.[1] || '999');
                    const sB = parseInt(String(b.tip).match(/^(\d+)/)?.[1] || '999');
                    return sA - sB;
                  });
                  const mMaxAdet = Math.max(...mAlbumler.map((a: any) => a.adet), 1);
                  const mTopAdet = mAlbumler.reduce((s: number, a: any) => s + a.adet, 0);
                  return (
                    <div key={m.mekanId} style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                      {/* Mekan ba{'\u015F'}l{'\u0131'}k sat{'\u0131'}r{'\u0131'} */}
                      <button
                        onClick={() => setAyAcik(prev => { const n = new Set(prev); const k = `detay_${m.mekanId}`; if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                        className="w-full text-left px-3 py-2.5 active:scale-[0.99] transition-all"
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.mekanEmoji || '\uD83D\uDCCD'} {m.mekanAd}</span>
                            {(m.vardiyaSayisi || 0) > 0 && (
                              <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(var(--app-accent-rgb),0.12)', border: '1px solid rgba(var(--app-accent-rgb),0.25)', color: 'var(--app-accent, #a855f7)', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {m.vardiyaSayisi} vardiya
                              </span>
                            )}
                            {(m.gecGirisSayisi || 0) > 0 && (
                              <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {m.gecGirisSayisi} ge{'\u00E7'} giri{'\u015F'}
                              </span>
                            )}
                          </span>
                          <span style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 9, color: mKarMi ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)', fontWeight: 600 }}>K{'\u00E2'}r </span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: mKarMi ? '#34d399' : '#f87171' }}>{mKarMi ? '+' : ''}{tl(m.karZarar)}</span>
                          </span>
                          <span style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 9, color: 'rgba(var(--app-accent-rgb),0.5)', fontWeight: 600 }}>Ciro </span>
                            <span style={{ color: 'var(--app-accent, #a855f7)', fontSize: 12, fontWeight: 800 }}>{tl(m.ciro)}</span>
                          </span>
                          {mekanAcikMi
                            ? <ChevronUp className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
                            : <ChevronDown className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
                          }
                        </div>
                        {/* Kapal{'\u0131'} {'\u00F6'}zet */}
                        {!mekanAcikMi && (
                          <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>
                            {m.satis} sat{'\u0131\u015F'}
                            {mTopAdet > 0 && ` \u00B7 ${mTopAdet} \u00FCr\u00FCn`}
                            {(m.baskiAdet || 0) > 0 && ` \u00B7 ${m.baskiAdet} bask\u0131`}
                            {(m.baskiBoyutu || 'yarim') === 'tam' ? ' \u00B7 Tam Boy' : ' \u00B7 Yar\u0131m Boy'}
                          </p>
                        )}
                      </button>

                      {/* A{'\u00E7\u0131'}k detay */}
                      {mekanAcikMi && (
                        <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid rgba(var(--app-accent-rgb),0.25)', background: 'rgba(var(--app-accent-rgb),0.07)' }}>

                          {/* {'\u00DC'}r{'\u00FC'}n Da{'\u011F\u0131'}l{'\u0131'}m{'\u0131'} */}
                          {mAlbumler.length > 0 && (
                            <div className="pt-2">
                              <div className="text-center mb-2">
                                <p className="text-[9px] font-bold" style={{ color: 'rgba(var(--app-accent-rgb),0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'\uD83D\uDCE6'} {'\u00DC'}r{'\u00FC'}n Da{'\u011F\u0131'}l{'\u0131'}m{'\u0131'}</p>
                                <div style={{ height: 1, background: 'rgba(var(--app-accent-rgb),0.2)', marginTop: 4 }} />
                              </div>
                              <div className="space-y-1">
                                {mAlbumler.map((a: any) => {
                                  const oran = mMaxAdet > 0 ? (a.adet / mMaxAdet) * 100 : 0;
                                  return (
                                    <div key={a.tip} className="flex items-center gap-2">
                                      <span className="text-[9px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.45)', minWidth: 60, maxWidth: 80 }}>{a.tip}</span>
                                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.05)' }}>
                                        <div style={{ width: `${oran}%`, height: '100%', background: 'linear-gradient(90deg, rgba(var(--app-accent-rgb),0.5), rgba(var(--app-accent-rgb),0.25))', borderRadius: 99 }} />
                                      </div>
                                      <span className="text-[10px] font-bold" style={{ color: 'var(--app-accent, #a855f7)', minWidth: 20, textAlign: 'right' }}>{a.adet}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Bask{'\u0131'} Detay{'\u0131'} */}
                          {(m.baskiAdet || 0) > 0 && (
                            <div>
                              <div style={{ height: 2, background: 'rgba(157,217,234,0.25)', borderRadius: 1, marginBottom: 8 }} />
                              <div className="text-center mb-2">
                                <p className="text-[9px] font-bold" style={{ color: 'rgba(157,217,234,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'\uD83D\uDDA8\uFE0F'} Bask{'\u0131'} Detay{'\u0131'}</p>
                                <div style={{ height: 1, background: 'rgba(157,217,234,0.2)', marginTop: 4 }} />
                              </div>
                              <div className="flex items-center gap-3 text-[10px] mb-1.5">
                                <span style={{ color: '#9dd9ea' }}>{m.baskiAdet} bas{'\u0131'}lan</span>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{(m.baskiBoyutu || 'yarim') === 'tam' ? 'Tam Boy' : 'Yar\u0131m Boy'}</span>
                                {m.baskiKagitAdi && <span style={{ color: 'rgba(255,255,255,0.3)' }}>{m.baskiKagitAdi}</span>}
                              </div>
                              {/* Yaz{'\u0131'}c{'\u0131'}lar */}
                              {(m.yazicilar || []).map((yz: any, yi: number) => (
                                <div key={yi} className="flex items-center justify-between text-[9px] py-0.5">
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    {[yz.marka, yz.model].filter(Boolean).join(' ') || yz.kagitAdi}
                                    {yz.seriNo && ` - ${yz.seriNo}`}
                                  </span>
                                  <span className="font-bold" style={{ color: '#fb923c' }}>-{tl(yz.maliyet)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Gider K{'\u0131'}r{'\u0131'}l{'\u0131'}m{'\u0131'} */}
                          <div>
                            <div style={{ height: 2, background: 'rgba(248,113,113,0.25)', borderRadius: 1, marginBottom: 8 }} />
                            <div className="text-center mb-2">
                              <p className="text-[9px] font-bold" style={{ color: 'rgba(248,113,113,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{'\uD83D\uDCCA'} Gider K{'\u0131'}r{'\u0131'}l{'\u0131'}m{'\u0131'}</p>
                              <div style={{ height: 1, background: 'rgba(248,113,113,0.2)', marginTop: 4 }} />
                            </div>
                            <div className="space-y-1">
                              {(m.albumMaliyet || 0) > 0 && (
                                <div className="flex items-center justify-between text-[10px]">
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Alb{'\u00FC'}m</span>
                                  <span className="font-bold" style={{ color: '#f87171' }}>-{tl(m.albumMaliyet)}</span>
                                </div>
                              )}
                              {(m.baskiMaliyet || 0) > 0 && (
                                <div className="flex items-center justify-between text-[10px]">
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Bask{'\u0131'}</span>
                                  <span className="font-bold" style={{ color: '#f87171' }}>-{tl(m.baskiMaliyet)}</span>
                                </div>
                              )}
                              {(m.hakedisMaliyet || 0) > 0 && (
                                <div className="flex items-center justify-between text-[10px]">
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Hakedi{'\u015F'}</span>
                                  <span className="font-bold" style={{ color: '#f87171' }}>-{tl(m.hakedisMaliyet)}</span>
                                </div>
                              )}
                              {(m.maasMaliyet || 0) > 0 && (
                                <div className="flex items-center justify-between text-[10px]">
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Personel Maa{'\u015F'}</span>
                                  <span className="font-bold" style={{ color: '#f87171' }}>-{tl(m.maasMaliyet)}</span>
                                </div>
                              )}
                              {(m.kiraMaliyet || 0) > 0 && (
                                <div className="flex items-center justify-between text-[10px]">
                                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Kira</span>
                                  <span className="font-bold" style={{ color: '#f87171' }}>-{tl(m.kiraMaliyet)}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-[10px] pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <span className="font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Toplam Gider</span>
                                <span className="font-bold" style={{ color: '#f87171' }}>-{tl(m.gider)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Anomali + Ge{'\u00E7'} Giri{'\u015F'} */}
            {aySecili.anomaliSayisi > 0 && (
              <div className="rounded-xl overflow-hidden mt-3" style={{ border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)' }}>
                <button
                  onClick={() => setAyAnomaliAcik(!ayAnomaliAcik)}
                  className="w-full flex items-center justify-between px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#fb923c' }} />
                    <span className="text-[11px] font-bold" style={{ color: '#fb923c' }}>
                      {aySecili.anomaliSayisi} Anomali
                    </span>
                  </div>
                  {ayAnomaliAcik
                    ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'rgba(251,146,60,0.5)' }} />
                    : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(251,146,60,0.5)' }} />
                  }
                </button>
                {ayAnomaliAcik && (
                  <div style={{ borderTop: '1px solid rgba(251,146,60,0.15)' }}>
                    {(aySecili.anomaliler || []).map((a: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5 px-3 py-2">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: '#fb923c' }} />
                        <div>
                          <p className="text-[10px] font-bold" style={{ color: '#fb923c' }}>
                            {a.mekanEmoji} {a.mekan} {'\u2014'} {a.tarih} {'\u2014'} {a.tip === 'acilis' ? 'Stok' : a.tip === 'yazici' ? 'Yaz\u0131c\u0131' : 'Stok'}
                          </p>
                          {a.aciklama && (
                            <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{a.aciklama}</p>
                          )}
                          {(a.personeller || []).length > 0 && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className="text-[8px]" style={{ color: 'rgba(248,113,113,0.5)' }}>Puan alan:</span>
                              {(a.personeller || []).map((p: string, pi: number) => (
                                <span key={pi} className="text-[8px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Personel Listesi */}
            {(aySecili.personeller || []).length > 0 && (
              <div className="rounded-xl p-3 mt-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-black text-white mb-3">{'\uD83D\uDC64'} Personel Performans{'\u0131'}</p>
                <div className="space-y-2">
                  {(aySecili.personeller || []).map((p: any) => (
                    <div key={p.id} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-bold text-white">{p.ad}</span>
                        <span className="text-[13px] font-black" style={{ color: '#34d399' }}>{tl(p.ciro)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(var(--app-accent-rgb),0.12)', border: '1px solid rgba(var(--app-accent-rgb),0.25)', color: 'var(--app-accent, #a855f7)', fontWeight: 700 }}>
                          {p.vardiyaSayisi} vardiya
                        </span>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(157,217,234,0.12)', border: '1px solid rgba(157,217,234,0.25)', color: '#9dd9ea', fontWeight: 700 }}>
                          {p.kare} kare
                        </span>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', fontWeight: 700 }}>
                          {p.satisAdet} sat{'\u0131\u015F'}
                        </span>
                        {p.hakedis > 0 && (
                          <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', fontWeight: 700 }}>
                            Hakedi{'\u015F'} {tl(p.hakedis)}
                          </span>
                        )}
                        {p.izinGun > 0 && (
                          <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontWeight: 700 }}>
                            {p.izinGun} g{'\u00FC'}n izin
                          </span>
                        )}
                        {p.gecGirisSayisi > 0 && (
                          <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', fontWeight: 700 }}>
                            {p.gecGirisSayisi} ge{'\u00E7'} giri{'\u015F'}
                          </span>
                        )}
                        {p.anomaliSayisi > 0 && (
                          <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontWeight: 700 }}>
                            {p.anomaliSayisi} anomali
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ AY BAZLI RAPOR — LİSTE ════ */}
      {!aySecili && (
        <div className="px-4 pb-8">
          {/* Yıl seçici */}
          <div className="flex items-center gap-2 mb-4">
            {[new Date().getFullYear() - 1, new Date().getFullYear()].map(y => (
              <button key={y} onClick={() => { setAySeciliYil(y); fetchAyRaporu(y); }}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: aySeciliYil === y ? 'rgba(var(--app-accent-rgb),0.25)' : 'rgba(255,255,255,0.05)',
                  border: aySeciliYil === y ? '1px solid rgba(var(--app-accent-rgb),0.4)' : '1px solid rgba(255,255,255,0.1)',
                  color: aySeciliYil === y ? 'var(--app-accent, #a855f7)' : 'rgba(255,255,255,0.4)',
                }}>
                {y}
              </button>
            ))}
          </div>

          {ayLoading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-ta/30 border-t-ta rounded-full animate-spin" />
            </div>
          )}

          {!ayLoading && ayData.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 32 }}>Bu yıl için veri yok</p>
          )}

          {!ayLoading && ayData.length > 0 && (
            <div className="space-y-3">
              {/* Ay kartları — gün bazlı tasarımla aynı */}
              {ayData.map((ay: any) => {
                const karPositif = (ay.karZarar || 0) >= 0;
                const karRenk = karPositif ? '#34d399' : '#f87171';
                const ayEkGelir = (ay.mekanDetay || []).reduce((s: number, m: any) => s + (m.ekGelir || 0), 0);
                const satisCiro = ay.toplamCiro - ayEkGelir;
                const nakitWithEkGelir = ay.nakitToplam + ayEkGelir;
                const odemeToplam = nakitWithEkGelir + ay.ibanToplam + ay.krediToplam;
                const acik = ayAcik.has(ay.ay);
                const mekanList = (ay.mekanDetay || []).sort((a: any, b: any) => b.ciro - a.ciro);

                return (
                  <div key={ay.ay} className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>

                    {/* Üst bant — ay + ciro — tıklayınca detaya gir */}
                    <div className="flex items-center justify-between px-4 pt-3.5 pb-2 cursor-pointer" onClick={() => setAySecili(ay)}>
                      <div>
                        <p className="text-[14px] font-black text-white leading-tight">{ay.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {ay.gunSayisi} gün
                          </span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {ay.toplamSatis} satış
                          </span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {ay.toplamKare} kare
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[18px] font-black leading-tight" style={{ color: 'var(--app-accent, #a855f7)' }}>
                          {tl(ay.toplamCiro)}
                        </p>
                        {ayEkGelir > 0 && (
                          <p className="text-[9px] mt-0.5" style={{ color: 'rgba(52,211,153,0.5)' }}>
                            {tl(satisCiro)} satış + {tl(ayEkGelir)} ek gelir
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ödeme dağılımı çubuğu */}
                    {odemeToplam > 0 && (
                      <div className="px-4 pb-2">
                        <div className="flex rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                          {nakitWithEkGelir > 0 && <div style={{ width: `${(nakitWithEkGelir / odemeToplam) * 100}%`, background: '#34d399' }} />}
                          {ay.ibanToplam > 0 && <div style={{ width: `${(ay.ibanToplam / odemeToplam) * 100}%`, background: '#60a5fa' }} />}
                          {ay.krediToplam > 0 && <div style={{ width: `${(ay.krediToplam / odemeToplam) * 100}%`, background: '#f472b6' }} />}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {nakitWithEkGelir > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-semibold" style={{ color: 'rgba(52,211,153,0.6)' }}>Nakit</span>
                              <span className="text-[9px] font-bold" style={{ color: '#34d399' }}>{tl(nakitWithEkGelir)}</span>
                            </div>
                          )}
                          {ay.ibanToplam > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-semibold" style={{ color: 'rgba(96,165,250,0.6)' }}>IBAN</span>
                              <span className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>{tl(ay.ibanToplam)}</span>
                            </div>
                          )}
                          {ay.krediToplam > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-semibold" style={{ color: 'rgba(244,114,182,0.6)' }}>Kredi Kartı</span>
                              <span className="text-[9px] font-bold" style={{ color: '#f472b6' }}>{tl(ay.krediToplam)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Kâr/Zarar + İskonto | Anomali + Geç Giriş */}
                    <div className="flex items-center justify-between px-4 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                          style={{ background: karPositif ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${karPositif ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                          <TrendingUp style={{ width: 10, height: 10, color: karRenk }} />
                          <span className="text-[10px] font-bold" style={{ color: karRenk }}>
                            {tl(ay.karZarar)}
                          </span>
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{
                            background: karPositif ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                            color: karRenk,
                          }}>%{ay.karMarji || 0}</span>
                        </div>

                        {ay.toplamIskonto > 0 && (() => {
                          const brut = ay.toplamCiro + ay.toplamIskonto;
                          const iskYuzde = brut > 0 ? Math.round((ay.toplamIskonto / brut) * 100) : 0;
                          return (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.18)' }}>
                              <span className="text-[10px] font-semibold" style={{ color: 'rgba(251,146,60,0.7)' }}>İsk</span>
                              <span className="text-[10px] font-bold" style={{ color: '#fb923c' }}>-{tl(ay.toplamIskonto)}</span>
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(251,146,60,0.15)', color: '#fbbf24' }}>%{iskYuzde}</span>
                            </div>
                          );
                        })()}
                      </div>

                      {(ay.anomaliSayisi > 0 || ay.gecGirisSayisi > 0) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {ay.anomaliSayisi > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
                              <AlertTriangle style={{ width: 9, height: 9, color: '#f87171' }} />
                              <span className="text-[9px] font-bold" style={{ color: '#f87171' }}>{ay.anomaliSayisi}</span>
                            </div>
                          )}
                          {ay.gecGirisSayisi > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
                              <AlertCircle style={{ width: 9, height: 9, color: '#fbbf24' }} />
                              <span className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>{ay.gecGirisSayisi}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Alt bant — mekanlar + açılır detay */}
                    <button
                      onClick={() => setAyAcik(prev => { const n = new Set(prev); if (n.has(ay.ay)) n.delete(ay.ay); else n.add(ay.ay); return n; })}
                      className="flex items-center justify-between w-full px-4 py-2.5"
                      style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', border: 'none' }}>
                      <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
                        {(ay.mekanLabels || []).slice(0, 5).map((m: string, i: number) => (
                          <span key={i} className="text-[9px] font-semibold px-2 py-0.5 rounded-full truncate"
                            style={{ background: 'rgba(var(--app-accent-rgb),0.08)', border: '1px solid rgba(var(--app-accent-rgb),0.15)', color: 'rgba(255,255,255,0.5)', maxWidth: 100 }}>
                            {m}
                          </span>
                        ))}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {acik ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </button>

                    {/* Açılır mekan detayı */}
                    {acik && (
                      <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {mekanList.map((m: any) => {
                            const mKarMi = (m.karZarar || 0) >= 0;
                            return (
                              <div key={m.mekanId || m.mekanAd} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 12, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.mekanEmoji || '📍'} {m.mekanAd || m.ad}</span>
                                <span style={{ textAlign: 'right', minWidth: 70 }}>
                                  <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.5)', fontWeight: 600 }}>Gider </span>
                                  <span style={{ color: 'rgba(239,68,68,0.7)', fontSize: 11, fontWeight: 700 }}>-{tl(m.gider)}</span>
                                </span>
                                <span style={{ textAlign: 'right', minWidth: 75 }}>
                                  <span style={{ fontSize: 10, color: mKarMi ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)', fontWeight: 600 }}>Kâr </span>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
