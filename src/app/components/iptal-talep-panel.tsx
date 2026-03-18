/**
 * IptalTalepPanel — Global, ekrandan bağımsız yönetici onay paneli
 *
 * ReactDOM.createPortal ile document.body'ye render edilir.
 * Böylece parent'ın transform/overflow/stacking-context'inden tamamen
 * bağımsız olur → iOS Safari dahil tüm cihazlarda düzgün görünür.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { buildHeaders, getToken } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
const POLL_INTERVAL = 5000;

interface Props {
  accessToken: string;
  userRole: string;
}

export function IptalTalepPanel({ accessToken, userRole }: Props) {
  const isYonetici = ['yonetici', 'ust-mudur', 'mudur', 'operasyon'].includes(userRole);

  const [talepleri, setTalepleri] = useState<any[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [kararVeriliyor, setKararVeriliyor] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Portal hedefi — daima document.body
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isYonetici || !accessToken) return;

    let abortController: AbortController | null = null;
    let destroyed = false;

    const fetchBekleyen = async () => {
      // Çevrimdışıysa deneme yapma
      if (!navigator.onLine) return;

      try {
        const token = accessToken || await getToken();
        if (!token || destroyed) return;

        abortController = new AbortController();
        const hdr = buildHeaders(token);
        const res = await fetch(`${API_BASE}/stok/iptal-bekleyen`, {
          headers: hdr,
          signal: abortController.signal,
        });

        if (destroyed) return;

        if (res.ok) {
          const data = await res.json();
          setTalepleri(data.talepleri || []);
        } else {
          const body = await res.json().catch(() => ({}));
          console.warn('[IptalTalepPanel] fetchBekleyen non-ok:', res.status, body?.error ?? body);
        }
      } catch (err: any) {
        // AbortError: component unmount veya effect temizleme — normal, loglama
        if (err?.name === 'AbortError') return;
        // Çevrimdışı veya geçici ağ hatası — sessiz geç
        if (!navigator.onLine) return;
        console.warn('[IptalTalepPanel] fetchBekleyen hata:', err);
      }
    };

    fetchBekleyen();
    pollRef.current = setInterval(fetchBekleyen, POLL_INTERVAL);

    return () => {
      destroyed = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (abortController) abortController.abort();
    };
  }, [isYonetici, accessToken]);

  // Panel kapansın talep bitince
  useEffect(() => {
    if (talepleri.length === 0) setShowPanel(false);
  }, [talepleri.length]);

  // ── Karar ver ────────────────────────────────────────────────────────
  const handleKarar = async (approvalId: string, karar: 'onaylandi' | 'reddedildi') => {
    setKararVeriliyor(approvalId);
    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE}/stok/satis-iptal-karar/${approvalId}`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({ karar }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Karar gönderilemedi.');
        return;
      }
      setTalepleri(prev => prev.filter(t => t.approvalId !== approvalId));
    } catch (err) {
      console.error('[IptalTalepPanel] handleKarar:', err);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setKararVeriliyor(null);
    }
  };

  if (!isYonetici || !mounted) return null;

  // ──────────────────────────────────────────────────────────────────────
  // Portal UI — body'ye render → parent transform'larından bağımsız
  // ──────────────────────────────────────────────────────────────────────
  const ui = (
    <>
      {/* iOS Safari'de motion scale animasyonu takılabiliyor → native CSS keyframe */}
      <style>{`
        @keyframes iptal-badge-pop {
          0%   { transform: scale(0) translateZ(0); opacity: 0; }
          70%  { transform: scale(1.15) translateZ(0); opacity: 1; }
          100% { transform: scale(1) translateZ(0); opacity: 1; }
        }
        @keyframes iptal-badge-pulse {
          0%, 100% { box-shadow: 0 0 0 5px rgba(220,38,38,0.2), 0 8px 28px rgba(220,38,38,0.55); }
          50%       { box-shadow: 0 0 0 9px rgba(220,38,38,0.1), 0 8px 32px rgba(220,38,38,0.7); }
        }
      `}</style>

      {/* ── Floating Badge — motion YOK, native CSS kullanıyor ── */}
      {talepleri.length > 0 && !showPanel && (
        <button
          key={`badge-${talepleri.length}`}
          onClick={() => setShowPanel(true)}
          style={{
            position: 'fixed',
            bottom: 100,
            right: 18,
            zIndex: 9999,
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)',
            border: '2px solid rgba(248,113,113,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            // Native CSS animasyonları — iOS Safari'de motion'dan çok daha güvenilir
            animation: 'iptal-badge-pop 0.42s cubic-bezier(0.175,0.885,0.32,1.275) both, iptal-badge-pulse 2.2s ease-in-out 0.5s infinite',
            // Stacking context ve GPU katmanı
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            willChange: 'transform, box-shadow',
          }}
        >
          <span style={{ fontSize: 23, lineHeight: 1, pointerEvents: 'none' }}>🚨</span>
          {/* Sayı rozeti */}
          <span style={{
            position: 'absolute',
            top: -6,
            right: -6,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            background: '#ffffff',
            border: '2.5px solid #0a051e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 900,
            color: '#dc2626',
            padding: '0 4px',
            lineHeight: 1,
          }}>
            {talepleri.length}
          </span>
        </button>
      )}

      {/* ── Talep Paneli ── */}
      <AnimatePresence>
        {showPanel && (
          <>
            {/* Overlay */}
            <motion.div
              key="iptal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPanel(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(3px)',
                WebkitBackdropFilter: 'blur(3px)',
              }}
            />

            {/* Panel kutusu */}
            <motion.div
              key="iptal-panel"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              style={{
                position: 'fixed',
                bottom: 88,
                left: 12,
                right: 12,
                width: 'auto',
                maxWidth: 456,
                margin: '0 auto',
                zIndex: 9999,
                background: 'rgba(8,4,20,0.98)',
                border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: 26,
                padding: '20px 18px 24px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
                maxHeight: '70vh',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {/* Başlık */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 16 }}>
                <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🚨</span>
                  <span style={{ color:'#f87171', fontWeight: 900, fontSize: 15 }}>
                    Onay Bekleyen İptal Talepleri
                  </span>
                  <span style={{
                    background:'rgba(220,38,38,0.22)', color:'#f87171',
                    borderRadius: 8, padding:'2px 8px', fontSize: 12, fontWeight: 800,
                  }}>
                    {talepleri.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  style={{
                    width: 30, height: 30, borderRadius: 10, border:'none',
                    background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.55)',
                    cursor:'pointer', display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize: 16, flexShrink: 0,
                  }}
                >✕</button>
              </div>

              {/* Talep kartları */}
              {talepleri.map((talep: any) => {
                const elapsed = Math.floor(
                  (Date.now() - new Date(talep.requestedAt).getTime()) / 1000
                );
                const kalan  = Math.max(0, 180 - elapsed);
                const mm     = Math.floor(kalan / 60);
                const ss     = String(kalan % 60).padStart(2, '0');
                const kalanStr = kalan > 0 ? `${mm}:${ss}` : 'Süresi doldu';
                const isLoading = kararVeriliyor === talep.approvalId;
                const expired   = kalan === 0;

                // Satış detayları
                const items: any[] = talep.items || [];
                const finalPrice: number = talep.finalPrice ?? 0;
                const discount: number = talep.discount ?? 0;
                const odemeYontemi =
                  talep.paymentMethod === 'cash' ? '💵 Nakit' :
                  talep.paymentMethod === 'card' ? '💳 Kart' :
                  talep.paymentMethod === 'iban' ? '🏦 IBAN' :
                  talep.paymentMethod || '';

                return (
                  <div
                    key={talep.approvalId}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: expired
                        ? '1px solid rgba(248,113,113,0.2)'
                        : '1px solid rgba(157,217,234,0.13)',
                      borderRadius: 18,
                      padding: '14px 14px 12px',
                      marginBottom: 10,
                    }}
                  >
                    {/* Üst satır: kişi + süre */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color:'white', fontWeight: 800, fontSize: 13, marginBottom: 2,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          👤 {talep.requestedByName || 'Bilinmiyor'}
                        </p>
                        {talep.kaydeden && talep.kaydeden !== talep.requestedByName && (
                          <p style={{ color:'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 2 }}>
                            🛒 Satışı yapan: {talep.kaydeden}
                          </p>
                        )}
                        {talep.mekanAdi && (
                          <p style={{ color:'rgba(157,217,234,0.7)', fontSize: 11, marginBottom: 2 }}>
                            📍 {talep.mekanAdi}
                          </p>
                        )}
                        {talep.satisSaati && (
                          <p style={{ color:'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 2 }}>
                            ⏰ {talep.tarih} — {talep.satisSaati}
                          </p>
                        )}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 4, flexShrink: 0, marginLeft: 10 }}>
                        <span style={{
                          color: kalan > 60 ? '#9dd9ea' : kalan > 0 ? '#ffd4a3' : '#f87171',
                          fontWeight: 700, fontSize: 12, fontVariantNumeric:'tabular-nums',
                        }}>
                          ⏱ {kalanStr}
                        </span>
                        {expired && (
                          <span style={{
                            background: 'rgba(220,38,38,0.18)', color: '#fca5a5',
                            fontSize: 9, fontWeight: 700, borderRadius: 6,
                            padding: '2px 6px', border: '1px solid rgba(220,38,38,0.3)',
                          }}>
                            Karar ver
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ürün listesi */}
                    {items.length > 0 && (
                      <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 10,
                        padding: '8px 10px',
                        marginBottom: 8,
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        {items.map((item: any, i: number) => (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: i < items.length - 1 ? 4 : 0,
                          }}>
                            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                              {item.product} <span style={{ color:'rgba(255,255,255,0.4)' }}>×{item.quantity}</span>
                            </span>
                            <span style={{ color: '#ffd4a3', fontSize: 12, fontWeight: 700 }}>
                              {(item.quantity * item.unitPrice).toLocaleString('tr-TR')} ₺
                            </span>
                          </div>
                        ))}
                        {/* Toplam + indirim + ödeme */}
                        <div style={{
                          marginTop: 6, paddingTop: 6,
                          borderTop: '1px solid rgba(255,255,255,0.07)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4,
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                            {odemeYontemi && (
                              <span style={{
                                background: 'rgba(157,217,234,0.12)', color: '#9dd9ea',
                                fontSize: 11, fontWeight: 700, borderRadius: 7, padding: '2px 7px',
                              }}>
                                {odemeYontemi}
                              </span>
                            )}
                            {discount > 0 && (
                              <span style={{
                                background: 'rgba(212,181,247,0.12)', color: '#d4b5f7',
                                fontSize: 11, fontWeight: 700, borderRadius: 7, padding: '2px 7px',
                              }}>
                                −{discount.toLocaleString('tr-TR')} ₺ indirim
                              </span>
                            )}
                          </div>
                          <span style={{ color: '#4ade80', fontWeight: 900, fontSize: 14 }}>
                            {finalPrice.toLocaleString('tr-TR')} ₺
                          </span>
                        </div>
                      </div>
                    )}

                    {/* İptal sebebi */}
                    <p style={{
                      color:'rgba(255,212,163,0.8)', fontSize: 12,
                      marginBottom: 10, wordBreak:'break-word',
                      background: 'rgba(255,212,163,0.06)', borderRadius: 8,
                      padding: '5px 9px',
                    }}>
                      📝 {talep.neden || '(sebep belirtilmedi)'}
                    </p>

                    {/* Butonlar */}
                    <div style={{ display:'flex', gap: 8 }}>
                      <button
                        disabled={isLoading}
                        onClick={() => handleKarar(talep.approvalId, 'onaylandi')}
                        style={{
                          flex: 1, padding:'11px 0', borderRadius: 12, border:'none',
                          background: isLoading ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.22)',
                          color: isLoading ? 'rgba(74,222,128,0.45)' : '#4ade80',
                          fontWeight: 800, fontSize: 14,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          transition:'all 0.18s',
                        }}
                      >
                        {isLoading ? '⏳' : '✅ Onayla'}
                      </button>
                      <button
                        disabled={isLoading}
                        onClick={() => handleKarar(talep.approvalId, 'reddedildi')}
                        style={{
                          flex: 1, padding:'11px 0', borderRadius: 12, border:'none',
                          background: isLoading ? 'rgba(220,38,38,0.06)' : 'rgba(220,38,38,0.22)',
                          color: isLoading ? 'rgba(248,113,113,0.4)' : '#f87171',
                          fontWeight: 800, fontSize: 14,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          transition:'all 0.18s',
                        }}
                      >
                        {isLoading ? '⏳' : '❌ Reddet'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );

  // Portal: doğrudan document.body'ye render et
  return createPortal(ui, document.body);
}