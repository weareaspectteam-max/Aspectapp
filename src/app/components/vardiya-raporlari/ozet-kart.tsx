import { Trash2, TrendingUp, AlertTriangle, AlertCircle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { VardiyaKayit } from './types';
import { formatTarih, tl } from './helpers';

export function OzetKart({
  v, onClick, canDelete, onSilTalep,
}: {
  v: VardiyaKayit;
  onClick: () => void;
  canDelete: boolean;
  onSilTalep: (v: VardiyaKayit) => void;
}) {
  const iskOran = v.toplamIskonto > 0 && v.toplamCiro > 0
    ? ((v.toplamIskonto / (v.toplamCiro + v.toplamIskonto)) * 100).toFixed(1)
    : null;

  const oT = v.nakitToplamTL + v.ibanToplamTL + v.krediToplamTL;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full rounded-2xl text-left transition-all"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: v.anomaliler.length > 0 ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden', cursor: 'pointer', marginBottom: 10,
        position: 'relative',
      }}
    >
      {/* Silme butonu — sadece yönetici */}
      {canDelete && (
        <button
          onClick={e => { e.stopPropagation(); onSilTalep(v); }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', zIndex: 2 }}
        >
          <Trash2 style={{ width: 12, height: 12, color: '#f87171' }} />
        </button>
      )}

      {/* Üst bant — mekan + bilgi + ciro */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5" style={{ paddingRight: canDelete ? 28 : 0 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{v.mekanEmoji}</span>
            <p className="text-[14px] font-black text-white leading-tight">{v.mekan}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {formatTarih(v.tarih)} · {v.acilisSaat}–{v.kapanisSaat}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0" style={{ paddingRight: canDelete ? 30 : 0 }}>
          <p className="text-[18px] font-black leading-tight" style={{ color: 'var(--app-accent, #a855f7)' }}>
            {tl(v.toplamCiro)}
          </p>
        </div>
      </div>

      {/* Ödeme dağılımı çubuğu */}
      {oT > 0 && (
        <div className="px-4 pb-2">
          <div className="flex rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
            {v.nakitToplamTL > 0 && <div style={{ width: `${(v.nakitToplamTL / oT) * 100}%`, background: '#34d399' }} />}
            {v.ibanToplamTL > 0 && <div style={{ width: `${(v.ibanToplamTL / oT) * 100}%`, background: '#60a5fa' }} />}
            {v.krediToplamTL > 0 && <div style={{ width: `${(v.krediToplamTL / oT) * 100}%`, background: '#f472b6' }} />}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {v.nakitToplamTL > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-semibold" style={{ color: 'rgba(52,211,153,0.6)' }}>Nakit</span>
                <span className="text-[9px] font-bold" style={{ color: '#34d399' }}>{tl(v.nakitToplamTL)}</span>
              </div>
            )}
            {v.ibanToplamTL > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-semibold" style={{ color: 'rgba(96,165,250,0.6)' }}>IBAN</span>
                <span className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>{tl(v.ibanToplamTL)}</span>
              </div>
            )}
            {v.krediToplamTL > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-semibold" style={{ color: 'rgba(244,114,182,0.6)' }}>Kredi Kartı</span>
                <span className="text-[9px] font-bold" style={{ color: '#f472b6' }}>{tl(v.krediToplamTL)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kâr/Zarar + İskonto + Anomali + Geç Giriş */}
      {(() => {
        const toplamMaliyet = (v.albumMaliyeti || 0) + (v.baskiMaliyeti || 0) + (v.personelMaasGideri || 0) + (v.mekanGunlukKira || 0);
        const karZarar = v.toplamCiro - toplamMaliyet;
        const karMi = karZarar >= 0;
        const marj = v.toplamCiro > 0 ? Math.round((karZarar / v.toplamCiro) * 100) : 0;
        const brut = v.toplamCiro + v.toplamIskonto;
        const iskYuzde = brut > 0 ? Math.round((v.toplamIskonto / brut) * 100) : 0;
        return (
          <div className="flex items-center justify-between px-4 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{ background: karMi ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${karMi ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                <TrendingUp style={{ width: 10, height: 10, color: karMi ? '#34d399' : '#f87171' }} />
                <span className="text-[10px] font-bold" style={{ color: karMi ? '#34d399' : '#f87171' }}>
                  {tl(karZarar)}
                </span>
                <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{
                  background: karMi ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                  color: karMi ? '#34d399' : '#f87171',
                }}>%{Math.abs(marj)}</span>
              </div>

              {v.toplamIskonto > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.18)' }}>
                  <span className="text-[10px] font-semibold" style={{ color: 'rgba(251,146,60,0.7)' }}>İsk</span>
                  <span className="text-[10px] font-bold" style={{ color: '#fb923c' }}>-{tl(v.toplamIskonto)}</span>
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(251,146,60,0.15)', color: '#fbbf24' }}>%{iskYuzde}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {v.anomaliler.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
                  <AlertTriangle style={{ width: 9, height: 9, color: '#f87171' }} />
                  <span className="text-[9px] font-bold" style={{ color: '#f87171' }}>{v.anomaliler.length}</span>
                </div>
              )}
              {(v as any).gecGirisSayisi > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
                  <AlertCircle style={{ width: 9, height: 9, color: '#fbbf24' }} />
                  <span className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>{(v as any).gecGirisSayisi}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Alt bant — personeller + ok */}
      {v.personeller.length > 0 && (() => {
        const toplamKare = v.personeller.reduce((s, pp) => s + pp.kare, 0);
        return (
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
              {v.personeller.map(p => {
                const ciroYuzde = v.toplamCiro > 0 ? (p.toplamTL / v.toplamCiro) * 100 : 0;
                const kareYuzde = toplamKare > 0 ? (p.kare / toplamKare) * 100 : 0;
                const mekanKatkisi = Math.round(ciroYuzde * 0.60 + kareYuzde * 0.40);
                return (
                  <span key={p.id} className="text-[9px] font-semibold px-2 py-0.5 rounded-full truncate"
                    style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)', color: 'rgba(255,255,255,0.5)', maxWidth: 120 }}>
                    {p.avatar} {p.ad.split(' ')[0]} <span style={{ color: '#818cf8', fontWeight: 700 }}>%{mekanKatkisi}</span>
                  </span>
                );
              })}
            </div>
            <ChevronRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
          </div>
        );
      })()}
    </motion.div>
  );
}
