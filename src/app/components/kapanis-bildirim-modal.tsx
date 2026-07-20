import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Wallet } from 'lucide-react';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
const POLL_MS = 20_000;

/** hamburger-menu menü görünürlüğü için senkron bayrak */
export const YETKILI_LS_KEY = 'aspect_kapanis_bildirim_yetkili';

export interface KapanisRaporPersonel {
  id: string;
  ad: string;
  nakitTL: number;
  ibanTL: number;
  krediTL: number;
  toplamTL: number;
  iskontoTL: number;
  satirlar: { urun: string; adet: number; toplamTL: number }[];
}

export interface KapanisRapor {
  id: string;
  mekanId: string;
  mekanAdi: string;
  mekanEmoji: string;
  tarih: string;
  acilisSaat: string | null;
  kapanisSaat: string | null;
  kapanisYapanAd: string;
  toplamCiro: number;
  nakitTL: number;
  ibanTL: number;
  krediTL: number;
  toplamIskonto: number;
  toplamIade: number;
  toplamCikis: number;
  satilanFotograf: number;
  musteriSayisi: number;
  personeller: KapanisRaporPersonel[];
  createdAt: string;
}

const fmtTL = (n: number) => `₺${(Number(n) || 0).toLocaleString('tr-TR')}`;
const trDate = (t: string) => {
  const [y, m, d] = (t || '').split('-');
  return y ? `${d}.${m}.${y}` : t;
};

/* Ödeme tipi renkleri — satış ekranıyla aynı palet */
const RENK = {
  nakit: '#a8e6cf',
  kart: '#9dd9ea',
  iban: '#ffd4a3',
  amber: '#fbbf24',
};

function OzetChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      flex: '1 1 30%', minWidth: 80, padding: '8px 10px', borderRadius: 10,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, color: '#fff', fontWeight: 800 }}>{value}</div>
    </div>
  );
}

/** Rapor detay gövdesi — popup ve geçmiş listesi aynı bileşeni kullanır */
export function KapanisRaporDetay({ rapor }: { rapor: KapanisRapor }) {
  return (
    <div>
      {/* Vardiya özeti */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <OzetChip label="Toplam Ciro" value={fmtTL(rapor.toplamCiro)} />
        <OzetChip label="Satılan Foto" value={rapor.satilanFotograf} />
        <OzetChip label="İade" value={rapor.toplamIade} />
        <OzetChip label="Çıkış" value={rapor.toplamCikis} />
        {rapor.musteriSayisi > 0 && <OzetChip label="Müşteri" value={rapor.musteriSayisi} />}
        {rapor.toplamIskonto > 0 && <OzetChip label="İskonto" value={fmtTL(rapor.toplamIskonto)} />}
      </div>

      {/* Ödeme kırılımı */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {([
          ['💵 Nakit', rapor.nakitTL, RENK.nakit],
          ['💳 Kart', rapor.krediTL, RENK.kart],
          ['🏦 IBAN', rapor.ibanTL, RENK.iban],
        ] as [string, number, string][]).map(([label, tutar, renk]) => (
          <div key={label} style={{
            flex: 1, padding: '8px 10px', borderRadius: 10, textAlign: 'center',
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${renk}40`,
          }}>
            <div style={{ fontSize: 10, color: renk, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 800 }}>{fmtTL(tutar)}</div>
          </div>
        ))}
      </div>

      {/* Elden alınacak banner — sadece nakit; kart ve IBAN bankaya gider */}
      <div style={{
        padding: '12px 14px', borderRadius: 12, marginBottom: 12,
        background: 'rgba(251,191,36,0.12)', border: '1.5px solid rgba(251,191,36,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: RENK.amber, letterSpacing: 0.5 }}>
          💰 ELDEN ALINACAK NAKİT
        </span>
        <span style={{ fontSize: 20, fontWeight: 900, color: RENK.amber }}>{fmtTL(rapor.nakitTL)}</span>
      </div>

      {/* Kişi bazlı tahsilat */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: 0.5 }}>
        KİMDEN NE ALINACAK
      </div>
      {rapor.personeller.length === 0 && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: 10, textAlign: 'center' }}>
          Bu vardiyada satış kaydı yok.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rapor.personeller.map(p => (
          <div key={p.id} style={{
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>👤 {p.ad}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Toplam satış: <b style={{ color: '#fff' }}>{fmtTL(p.toplamTL)}</b></span>
            </div>

            {/* Ürün satırları */}
            {p.satirlar.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {p.satirlar.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.6)', padding: '1px 0' }}>
                    <span>{s.adet}× {s.urun}</span>
                    <span>{fmtTL(s.toplamTL)}</span>
                  </div>
                ))}
                {p.iskontoTL > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#f87171', padding: '1px 0' }}>
                    <span>İskonto</span>
                    <span>−{fmtTL(p.iskontoTL)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Ödeme kırılımı — nakit vurgulu */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{
                flex: 1.4, padding: '6px 8px', borderRadius: 8,
                background: p.nakitTL > 0 ? 'rgba(168,230,207,0.14)' : 'rgba(255,255,255,0.03)',
                border: p.nakitTL > 0 ? `1.5px solid ${RENK.nakit}70` : '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: p.nakitTL > 0 ? RENK.nakit : 'rgba(255,255,255,0.35)' }}>ELDEN ALINACAK</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: p.nakitTL > 0 ? RENK.nakit : 'rgba(255,255,255,0.35)' }}>{fmtTL(p.nakitTL)}</div>
              </div>
              <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: RENK.kart }}>💳 Kart</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.krediTL > 0 ? '#fff' : 'rgba(255,255,255,0.35)' }}>{fmtTL(p.krediTL)}</div>
              </div>
              <div style={{ flex: 1, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: RENK.iban }}>🏦 IBAN</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.ibanTL > 0 ? '#fff' : 'rgba(255,255,255,0.35)' }}>{fmtTL(p.ibanTL)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 10, lineHeight: 1.5 }}>
        Kart ve IBAN ödemeleri şirket hesabına gider — bilgi amaçlıdır, elden tahsil edilmez.
      </div>
    </div>
  );
}

interface Props {
  isLoggedIn: boolean;
}

/**
 * Vardiya kapanış bildirimi popup'ı.
 * Yetkili kişilere kapanış anında düşer; X'e basmadan kapanmaz.
 * Birden fazla kapanış varsa sırayla gösterilir.
 */
export function KapanisBildirimModal({ isLoggedIn }: Props) {
  const [kuyruk, setKuyruk] = useState<KapanisRapor[]>([]);
  const [kapatiliyor, setKapatiliyor] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const kontrol = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/kapanis-bildirim/durum${ghostParams()}`, { headers });
      if (!res.ok) return;
      const d = await res.json();
      try { localStorage.setItem(YETKILI_LS_KEY, d.yetkili ? '1' : '0'); } catch {}
      const gelen: KapanisRapor[] = d.bekleyenler || [];
      setKuyruk(prev => {
        // Görüntülenen sırayı koru; yeni gelenleri sona ekle, okunanları çıkar
        const gelenIds = new Set(gelen.map(r => r.id));
        const kalan = prev.filter(r => gelenIds.has(r.id));
        const mevcutIds = new Set(kalan.map(r => r.id));
        const yeni = gelen.filter(r => !mevcutIds.has(r.id));
        return [...kalan, ...yeni];
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setKuyruk([]); return; }
    kontrol();
    pollRef.current = setInterval(kontrol, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isLoggedIn, kontrol]);

  const aktif = kuyruk[0] || null;

  const kapat = async () => {
    if (!aktif || kapatiliyor) return;
    setKapatiliyor(true);
    try {
      const headers = await authHeaders();
      await fetch(`${SERVER}/kapanis-bildirim/okundu${ghostParams()}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raporId: aktif.id }),
      });
    } catch {}
    setKuyruk(prev => prev.filter(r => r.id !== aktif.id));
    setKapatiliyor(false);
  };

  if (!aktif) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(15, 5, 30, 0.92)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 440, maxHeight: '88vh',
        background: 'rgba(30, 10, 40, 0.98)', border: '2px solid rgba(251,191,36,0.5)',
        borderRadius: 20, boxShadow: '0 20px 80px rgba(251,191,36,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid rgba(251,191,36,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(251,191,36,0.08)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Wallet size={18} color={RENK.amber} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: RENK.amber, letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {aktif.mekanEmoji} {aktif.mekanAdi} — VARDİYA KAPANDI
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                {trDate(aktif.tarih)}
                {aktif.acilisSaat && aktif.kapanisSaat ? ` · ${aktif.acilisSaat}–${aktif.kapanisSaat}` : aktif.kapanisSaat ? ` · ${aktif.kapanisSaat}` : ''}
                {aktif.kapanisYapanAd ? ` · ${aktif.kapanisYapanAd}` : ''}
              </div>
            </div>
          </div>
          <button
            onClick={kapat}
            disabled={kapatiliyor}
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: kapatiliyor ? 0.5 : 1, marginLeft: 8,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body — kaydırılabilir */}
        <div style={{ padding: '14px 16px', overflowY: 'auto' }}>
          <KapanisRaporDetay rapor={aktif} />
        </div>

        {/* Footer — kuyrukta başka rapor varsa göster */}
        {kuyruk.length > 1 && (
          <div style={{
            padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', flexShrink: 0,
          }}>
            +{kuyruk.length - 1} kapanış bildirimi daha var — kapatınca gösterilecek
          </div>
        )}
      </div>
    </div>
  );
}
