import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Minus, Wallet, ChevronDown, ChevronUp, Check, Loader2, History } from 'lucide-react';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
const POLL_MS = 20_000;

/** hamburger-menu menü görünürlüğü için senkron bayrak */
export const YETKILI_LS_KEY = 'aspect_kapanis_bildirim_yetkili';
/** Daha önce popup olarak gösterilmiş rapor ID'leri (yeniden tam ekran açılmasın) */
const SEEN_LS_KEY = 'aspect_kapanis_seen';

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

export interface TeslimKisi {
  alindi: boolean;
  alanId: string;
  alanAd: string;
  zaman: string;
}

export interface TeslimLog {
  islem: 'teslim' | 'geri';
  personelId: string;
  personelAd: string;
  tutar: number;
  yapanId: string;
  yapanAd: string;
  zaman: string;
}

export interface TeslimKaydi {
  raporId: string;
  kisiler: Record<string, TeslimKisi>;
  log: TeslimLog[];
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
  teslim?: TeslimKaydi | null;
}

const fmtTL = (n: number) => `₺${(Number(n) || 0).toLocaleString('tr-TR')}`;
const trDate = (t: string) => {
  const [y, m, d] = (t || '').split('-');
  return y ? `${d}.${m}.${y}` : t;
};
const fmtLogZaman = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

/* Ödeme tipi renkleri — satış ekranıyla aynı palet */
const RENK = {
  nakit: '#a8e6cf',
  kart: '#9dd9ea',
  iban: '#ffd4a3',
  amber: '#fbbf24',
};

/** Nakit teslimi bekleyen kişiler (nakit > 0 ve işaretlenmemiş) */
export const teslimBekleyenler = (rapor: KapanisRapor): KapanisRaporPersonel[] =>
  (rapor.personeller || []).filter(p => (p.nakitTL || 0) > 0 && !rapor.teslim?.kisiler?.[p.id]?.alindi);

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

interface DetayProps {
  rapor: KapanisRapor;
  canTeslim?: boolean;
  /** personelId ya da 'hepsi' */
  onTeslim?: (personelId: string, islem: 'teslim' | 'geri') => void;
  /** işlem sürerken personelId (buton spinner'ı) */
  islemde?: string | null;
}

/** Rapor detay gövdesi — popup ve geçmiş listesi aynı bileşeni kullanır */
export function KapanisRaporDetay({ rapor, canTeslim = false, onTeslim, islemde = null }: DetayProps) {
  const [logAcik, setLogAcik] = useState(false);
  const teslim = rapor.teslim;
  const bekleyen = teslimBekleyenler(rapor);
  const kalanNakit = bekleyen.reduce((s, p) => s + (p.nakitTL || 0), 0);
  const teslimVar = !!teslim && Object.keys(teslim.kisiler || {}).length > 0;

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
        background: kalanNakit === 0 && rapor.nakitTL > 0 ? 'rgba(168,230,207,0.12)' : 'rgba(251,191,36,0.12)',
        border: kalanNakit === 0 && rapor.nakitTL > 0 ? '1.5px solid rgba(168,230,207,0.5)' : '1.5px solid rgba(251,191,36,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: kalanNakit === 0 && rapor.nakitTL > 0 ? RENK.nakit : RENK.amber, letterSpacing: 0.5 }}>
            {kalanNakit === 0 && rapor.nakitTL > 0 ? '✅ TÜM NAKİT TESLİM ALINDI' : '💰 ELDEN ALINACAK NAKİT'}
          </span>
          <span style={{ fontSize: 20, fontWeight: 900, color: kalanNakit === 0 && rapor.nakitTL > 0 ? RENK.nakit : RENK.amber }}>
            {fmtTL(rapor.nakitTL)}
          </span>
        </div>
        {teslimVar && kalanNakit > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: RENK.amber, marginTop: 4, textAlign: 'right' }}>
            Kalan: {fmtTL(kalanNakit)}
          </div>
        )}
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
        {rapor.personeller.map(p => {
          const kayit = teslim?.kisiler?.[p.id];
          const alindi = !!kayit?.alindi;
          const busy = islemde === p.id;
          return (
            <div key={p.id} style={{
              padding: '10px 12px', borderRadius: 12,
              background: alindi ? 'rgba(168,230,207,0.06)' : 'rgba(255,255,255,0.05)',
              border: alindi ? '1px solid rgba(168,230,207,0.35)' : '1px solid rgba(255,255,255,0.1)',
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

              {/* Teslim durumu / düğmesi — sadece nakiti olanlar */}
              {p.nakitTL > 0 && (
                alindi ? (
                  <button
                    onClick={() => canTeslim && onTeslim && onTeslim(p.id, 'geri')}
                    disabled={!canTeslim || busy}
                    title={canTeslim ? 'Geri almak için tekrar dokun' : undefined}
                    style={{
                      width: '100%', marginTop: 8, padding: '9px 10px', borderRadius: 10,
                      background: 'rgba(168,230,207,0.2)', border: '1.5px solid rgba(168,230,207,0.55)',
                      color: RENK.nakit, fontWeight: 800, fontSize: 12,
                      cursor: canTeslim ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
                    Teslim Alındı · {kayit?.alanAd}{kayit?.zaman ? ` · ${fmtLogZaman(kayit.zaman)}` : ''}
                  </button>
                ) : canTeslim ? (
                  <button
                    onClick={() => onTeslim && onTeslim(p.id, 'teslim')}
                    disabled={busy}
                    style={{
                      width: '100%', marginTop: 8, padding: '9px 10px', borderRadius: 10,
                      background: 'rgba(251,191,36,0.12)', border: '1.5px solid rgba(251,191,36,0.5)',
                      color: RENK.amber, fontWeight: 800, fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
                    Teslim Aldım · {fmtTL(p.nakitTL)}
                  </button>
                ) : (
                  <div style={{
                    marginTop: 8, padding: '7px 10px', borderRadius: 10, textAlign: 'center',
                    background: 'rgba(251,191,36,0.06)', border: '1px dashed rgba(251,191,36,0.35)',
                    color: 'rgba(251,191,36,0.8)', fontWeight: 700, fontSize: 11,
                  }}>
                    ⏳ Teslim bekliyor
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Hepsini teslim aldım */}
      {canTeslim && bekleyen.length > 1 && (
        <button
          onClick={() => onTeslim && onTeslim('hepsi', 'teslim')}
          disabled={islemde === 'hepsi'}
          style={{
            width: '100%', marginTop: 10, padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
            background: 'rgba(168,230,207,0.15)', border: '1.5px solid rgba(168,230,207,0.5)',
            color: RENK.nakit, fontWeight: 800, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: islemde === 'hepsi' ? 0.6 : 1,
          }}
        >
          {islemde === 'hepsi' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
          Hepsini Teslim Aldım · {fmtTL(kalanNakit)}
        </button>
      )}

      {/* Teslim geçmişi (log) */}
      {(teslim?.log?.length || 0) > 0 && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setLogAcik(a => !a)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <History size={12} /> Teslim Geçmişi ({teslim!.log.length})
            {logAcik ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {logAcik && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[...teslim!.log].reverse().map((l, i) => (
                <div key={i} style={{ fontSize: 10.5, color: l.islem === 'geri' ? '#f87171' : 'rgba(255,255,255,0.65)', padding: '2px 0', lineHeight: 1.4 }}>
                  <b style={{ color: 'rgba(255,255,255,0.85)' }}>{fmtLogZaman(l.zaman)}</b>
                  {' · '}
                  {l.islem === 'teslim'
                    ? <>{l.yapanAd}, <b>{l.personelAd}</b>'den {fmtTL(l.tutar)} teslim aldı</>
                    : <>{l.yapanAd}, <b>{l.personelAd}</b> işaretini geri aldı</>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
 * Her mekanın kapanışı kendi zamanında düşer — yeni kapanan mekan açık gelir,
 * teslimi bitmemiş önceki mekanlar aynı popup'ta kapalı kart olarak birikir.
 * X / küçült → sağ altta rozet; rozet tüm nakit teslimleri bitene kadar kalır.
 */
export function KapanisBildirimModal({ isLoggedIn }: Props) {
  const [raporlar, setRaporlar] = useState<KapanisRapor[]>([]);
  const [canTeslim, setCanTeslim] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [acikRapor, setAcikRapor] = useState<string | null>(null);
  const [islemde, setIslemde] = useState<string | null>(null); // `${raporId}:${personelId|hepsi}`
  const minimizedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  minimizedRef.current = minimized;

  const seenOku = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_LS_KEY) || '[]')); } catch { return new Set(); }
  };
  const seenYaz = (ids: Set<string>) => {
    try { localStorage.setItem(SEEN_LS_KEY, JSON.stringify([...ids].slice(-100))); } catch {}
  };

  const kontrol = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/kapanis-bildirim/durum${ghostParams()}`, { headers });
      if (!res.ok) return;
      const d = await res.json();
      try { localStorage.setItem(YETKILI_LS_KEY, d.yetkili ? '1' : '0'); } catch {}
      setCanTeslim(!!d.canTeslim);
      const gelen: KapanisRapor[] = d.bekleyenler || [];

      // Yeni (hiç gösterilmemiş) rapor var mı? → popup'ı aç, o kartı genişlet
      const seen = seenOku();
      const yeniler = gelen.filter(r => !seen.has(r.id));
      if (yeniler.length > 0) {
        yeniler.forEach(r => seen.add(r.id));
        seenYaz(seen);
        setMinimized(false);
        setAcikRapor(yeniler[yeniler.length - 1].id); // en son kapanan mekan açık gelir
      }

      setRaporlar(prev => {
        const gelenMap = new Map(gelen.map(r => [r.id, r]));
        if (minimizedRef.current && yeniler.length === 0) return gelen; // küçükken tam senkron
        // Popup açıkken: mevcutları güncelle (tamamlananlar görünür kalsın), yenileri ekle
        const guncel = prev.map(r => gelenMap.get(r.id) || r);
        const eklenecek = gelen.filter(r => !prev.some(p => p.id === r.id));
        return [...guncel, ...eklenecek];
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setRaporlar([]); return; }
    kontrol();
    pollRef.current = setInterval(kontrol, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isLoggedIn, kontrol]);

  /** Küçült: teslimi bitmiş/nakitsiz raporları okundu yap ve listeden düşür */
  const kucult = async () => {
    const bitenler = raporlar.filter(r => teslimBekleyenler(r).length === 0);
    setMinimized(true);
    setRaporlar(prev => prev.filter(r => teslimBekleyenler(r).length > 0));
    if (bitenler.length > 0) {
      try {
        const headers = await authHeaders();
        for (const r of bitenler) {
          fetch(`${SERVER}/kapanis-bildirim/okundu${ghostParams()}`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raporId: r.id }),
          }).catch(() => {});
        }
      } catch {}
    }
  };

  const teslimYap = async (raporId: string, personelId: string, islem: 'teslim' | 'geri') => {
    const key = `${raporId}:${personelId}`;
    if (islemde) return;
    setIslemde(key);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/kapanis-bildirim/teslim${ghostParams()}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raporId, personelId, islem }),
      });
      const d = await res.json();
      if (res.ok && d.teslim) {
        setRaporlar(prev => prev.map(r => r.id === raporId ? { ...r, teslim: d.teslim } : r));
      }
    } catch {} finally {
      setIslemde(null);
    }
  };

  if (raporlar.length === 0) return null;

  const toplamBekleyenKisi = raporlar.reduce((s, r) => s + teslimBekleyenler(r).length, 0);
  const toplamKalanNakit = raporlar.reduce((s, r) => s + teslimBekleyenler(r).reduce((x, p) => x + (p.nakitTL || 0), 0), 0);

  /* ── Küçültülmüş: sağ altta rozet ── */
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', right: 12, bottom: 96, zIndex: 9997,
          padding: '10px 14px', borderRadius: 999, cursor: 'pointer',
          background: 'rgba(30, 10, 40, 0.97)', border: '2px solid rgba(251,191,36,0.6)',
          boxShadow: '0 6px 24px rgba(251,191,36,0.35)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}
      >
        <Wallet size={16} color={RENK.amber} />
        <span style={{ fontSize: 13, fontWeight: 900, color: RENK.amber }}>
          {toplamBekleyenKisi > 0 ? `${toplamBekleyenKisi} teslim · ${fmtTL(toplamKalanNakit)}` : '🔔'}
        </span>
      </button>
    );
  }

  /* ── Açık popup ── */
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={18} color={RENK.amber} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: RENK.amber, letterSpacing: 0.5 }}>
                VARDİYA KAPANIŞLARI
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                {toplamBekleyenKisi > 0
                  ? `${toplamBekleyenKisi} kişiden ${fmtTL(toplamKalanNakit)} nakit teslim bekleniyor`
                  : 'Tüm teslimler tamam'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
            <button
              onClick={kucult}
              title="Küçült"
              style={{
                background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Minus size={14} />
            </button>
            <button
              onClick={kucult}
              style={{
                background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body — mekan kartları (akordeon) */}
        <div style={{ padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {raporlar.map(r => {
            const acik = acikRapor === r.id;
            const bekleyen = teslimBekleyenler(r);
            const kalanNakit = bekleyen.reduce((s, p) => s + (p.nakitTL || 0), 0);
            const tamam = bekleyen.length === 0;
            return (
              <div key={r.id} style={{
                borderRadius: 14, overflow: 'hidden',
                background: 'rgba(255,255,255,0.04)',
                border: acik ? '1.5px solid rgba(251,191,36,0.45)' : '1px solid rgba(255,255,255,0.1)',
              }}>
                <button
                  onClick={() => setAcikRapor(acik ? null : r.id)}
                  style={{
                    width: '100%', padding: '11px 12px', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.mekanEmoji} {r.mekanAdi}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                        {trDate(r.tarih)}{r.kapanisSaat ? ` · ${r.kapanisSaat}` : ''}{r.kapanisYapanAd ? ` · ${r.kapanisYapanAd}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {tamam ? (
                        <span style={{ fontSize: 11, fontWeight: 800, color: RENK.nakit }}>✓ Tamam</span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 900, color: RENK.amber }}>💰 {fmtTL(kalanNakit)}</span>
                      )}
                      {acik ? <ChevronUp size={14} color="rgba(255,255,255,0.5)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.5)" />}
                    </div>
                  </div>
                </button>
                {acik && (
                  <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                    <KapanisRaporDetay
                      rapor={r}
                      canTeslim={canTeslim}
                      islemde={islemde?.startsWith(`${r.id}:`) ? islemde.split(':')[1] : null}
                      onTeslim={(pid, islem) => teslimYap(r.id, pid, islem)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
