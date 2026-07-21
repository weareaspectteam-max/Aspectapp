import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Wallet, ChevronDown, ChevronUp, Check, Loader2, History, FileText } from 'lucide-react';
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
  kismi?: boolean;
  alinan?: { nakit: number; kart: number; iban: number };
  /** pozitif: açık (eksik), negatif: fazla */
  acik?: { nakit: number; kart: number; iban: number; toplam: number };
}

export interface TeslimLog {
  islem: 'teslim' | 'geri';
  personelId: string;
  personelAd: string;
  tutar: number;
  kismi?: boolean;
  alinanToplam?: number;
  acikToplam?: number;
  yapanId: string;
  yapanAd: string;
  zaman: string;
}

export interface KismiGiris { nakit: number; kart: number; iban: number; }

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

export interface GunToplayici {
  ad: string;
  /** fiilen topladığı nakit (kısmi aldıysa aldığı kadar) — gün gün birikir */
  toplanan: number;
  detay: { raporId: string; personelId: string; personelAd: string; mekanAdi: string; mekanEmoji: string; tutar: number; zaman: string }[];
  teslim?: { alindi: boolean; alanId: string; alanAd: string; zaman: string; alinanTutar: number; acikTutar: number };
}

export interface GunKaydi {
  tarih: string;
  toplayicilar: Record<string, GunToplayici>;
  kapandi: boolean;
  log: any[];
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

/* Kısmi giriş — kasa numpad'iyle aynı davranış: cihaz klavyesi yok, binlik ayraçlı tam TL */
const padParse = (s: string) => parseInt(String(s).replace(/\D/g, '') || '0', 10);
const padApply = (cur: string, k: string) => {
  const d = String(cur).replace(/\D/g, '');
  let nd: string;
  if (k === 'C') nd = '';
  else if (k === '⌫') nd = d.slice(0, -1);
  else { if (d.length >= 9) return cur; nd = d + k; }
  return nd ? Number(nd).toLocaleString('tr-TR') : '';
};
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

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
  /** personelId ya da 'hepsi'; kismi verilirse kısmi teslim */
  onTeslim?: (personelId: string, islem: 'teslim' | 'geri', kismi?: KismiGiris) => void;
  /** işlem sürerken personelId (buton spinner'ı) */
  islemde?: string | null;
  /** Popup modu: teslim alınanlar listeden düşer, sadece bekleyenler görünür (geri alma geçmiş listesinden) */
  sadeceBekleyen?: boolean;
  /** Rapor Detayı (ciro, ürün dökümü) — sadece yönetici + üst müdür (sunucu da veriyi başkasına göndermez) */
  canDetay?: boolean;
}

/**
 * Rapor gövdesi — TAHSİLAT ÖNCELİKLİ düzen.
 * Üstte: kimden ne alınacak + Teslim/Kısmi düğmeleri (gömülü değil, direkt görünür).
 * Ürün dökümü, ciro özeti vb. "Rapor Detayı" bölümünde isteğe bağlı açılır.
 * Popup ve geçmiş listesi aynı bileşeni kullanır.
 */
export function KapanisRaporDetay({ rapor, canTeslim = false, onTeslim, islemde = null, sadeceBekleyen = false, canDetay = false }: DetayProps) {
  const [logAcik, setLogAcik] = useState(false);
  const [raporDetayAcik, setRaporDetayAcik] = useState(false);
  const [kismiPid, setKismiPid] = useState<string | null>(null);
  const [kismiAlan, setKismiAlan] = useState<'nakit' | 'kart' | 'iban'>('nakit');
  const [kismiVals, setKismiVals] = useState<{ nakit: string; kart: string; iban: string }>({ nakit: '', kart: '', iban: '' });
  const [kismiOnay, setKismiOnay] = useState(false);

  const kismiBaslat = (p: KapanisRaporPersonel) => {
    setKismiPid(p.id);
    setKismiOnay(false);
    setKismiAlan((p.nakitTL || 0) > 0 ? 'nakit' : (p.krediTL || 0) > 0 ? 'kart' : 'iban');
    setKismiVals({
      nakit: (p.nakitTL || 0).toLocaleString('tr-TR'),
      kart: (p.krediTL || 0).toLocaleString('tr-TR'),
      iban: (p.ibanTL || 0).toLocaleString('tr-TR'),
    });
  };
  const kismiKaydet = (p: KapanisRaporPersonel) => {
    if (!onTeslim) return;
    onTeslim(p.id, 'teslim', {
      nakit: padParse(kismiVals.nakit),
      kart: padParse(kismiVals.kart),
      iban: padParse(kismiVals.iban),
    });
    setKismiPid(null);
  };

  const teslim = rapor.teslim;
  const bekleyen = teslimBekleyenler(rapor);
  const kalanNakit = bekleyen.reduce((s, p) => s + (p.nakitTL || 0), 0);
  const nakitliler = (rapor.personeller || []).filter(p => (p.nakitTL || 0) > 0);
  const tamamMi = nakitliler.length > 0 && bekleyen.length === 0;

  return (
    <div>
      {/* ── 1. Elden alınacak banner ── */}
      <div style={{
        padding: '10px 14px', borderRadius: 12, marginBottom: 10,
        background: tamamMi ? 'rgba(168,230,207,0.12)' : 'rgba(251,191,36,0.12)',
        border: tamamMi ? '1.5px solid rgba(168,230,207,0.5)' : '1.5px solid rgba(251,191,36,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: tamamMi ? RENK.nakit : RENK.amber, letterSpacing: 0.5 }}>
          {tamamMi ? '✅ TÜM NAKİT TESLİM ALINDI' : nakitliler.length === 0 ? '💳 ELDEN ALINACAK NAKİT YOK' : '💰 ALINACAK NAKİT'}
        </span>
        <span style={{ fontSize: 19, fontWeight: 900, color: tamamMi ? RENK.nakit : RENK.amber }}>
          {fmtTL(tamamMi ? rapor.nakitTL : kalanNakit)}
        </span>
      </div>

      {/* ── 2. Tahsilat listesi — kişi + para + düğmeler, direkt görünür ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(sadeceBekleyen ? nakitliler.filter(p => !teslim?.kisiler?.[p.id]?.alindi) : nakitliler).map(p => {
          const kayit = teslim?.kisiler?.[p.id];
          const alindi = !!kayit?.alindi;
          const busy = islemde === p.id;
          const acikT = kayit?.acik?.toplam || 0;

          return (
            <div key={p.id} style={{
              padding: '8px 10px', borderRadius: 12,
              background: alindi ? 'rgba(168,230,207,0.07)' : 'rgba(255,255,255,0.05)',
              border: alindi
                ? (acikT > 0 ? '1px solid rgba(248,113,113,0.45)' : '1px solid rgba(168,230,207,0.4)')
                : '1px solid rgba(255,255,255,0.12)',
            }}>
              {/* Satır: isim + elden alınacak nakit */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  👤 {p.ad}
                </span>
                <span style={{ fontSize: 15, fontWeight: 900, color: alindi ? RENK.nakit : RENK.amber, flexShrink: 0 }}>
                  {fmtTL(p.nakitTL)}
                </span>
              </div>
              {/* Üç kalem de görünür — teslim öncesi tam tablo */}
              <div style={{ display: 'flex', gap: 10, fontSize: 10, marginTop: 3 }}>
                <span style={{ color: RENK.nakit, fontWeight: 700 }}>💵 {fmtTL(p.nakitTL)}</span>
                <span style={{ color: p.krediTL > 0 ? RENK.kart : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>💳 {fmtTL(p.krediTL)}</span>
                <span style={{ color: p.ibanTL > 0 ? RENK.iban : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>🏦 {fmtTL(p.ibanTL)}</span>
              </div>

              {/* Satır: durum / düğmeler */}
              {alindi ? (
                <button
                  onClick={() => canTeslim && onTeslim && onTeslim(p.id, 'geri')}
                  disabled={!canTeslim || busy}
                  title={canTeslim ? 'Geri almak için tekrar dokun' : undefined}
                  style={{
                    width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 9,
                    background: acikT > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(168,230,207,0.18)',
                    border: 'none',
                    color: acikT > 0 ? '#f87171' : RENK.nakit, fontWeight: 800, fontSize: 11.5,
                    cursor: canTeslim ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                  Alındı{acikT > 0 ? ` · ⚠️ ${fmtTL(acikT)} açık` : acikT < 0 ? ` · +${fmtTL(-acikT)} fazla` : ''} · {kayit?.alanAd}{kayit?.zaman ? ` · ${fmtLogZaman(kayit.zaman)}` : ''}
                </button>
              ) : !canTeslim ? (
                <div style={{
                  marginTop: 6, padding: '6px 10px', borderRadius: 9, textAlign: 'center',
                  background: 'rgba(251,191,36,0.06)', border: '1px dashed rgba(251,191,36,0.35)',
                  color: 'rgba(251,191,36,0.8)', fontWeight: 700, fontSize: 11,
                }}>
                  ⏳ Teslim bekliyor
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={() => onTeslim && onTeslim(p.id, 'teslim')}
                    disabled={busy}
                    style={{
                      flex: 2, padding: '9px 10px', borderRadius: 9,
                      background: 'rgba(251,191,36,0.15)', border: '1.5px solid rgba(251,191,36,0.55)',
                      color: RENK.amber, fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
                    Teslim Aldım
                  </button>
                  <button
                    onClick={() => kismiBaslat(p)}
                    disabled={busy}
                    title="Eksik/fazla aldıysan tutarları ayrı ayrı gir"
                    style={{
                      flex: 1, padding: '9px 8px', borderRadius: 9,
                      background: 'rgba(248,113,113,0.08)', border: '1.5px solid rgba(248,113,113,0.4)',
                      color: '#f87171', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ➗ Kısmi
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {nakitliler.length === 0 && rapor.personeller.length > 0 && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', padding: '6px 0', textAlign: 'center' }}>
          Tüm satışlar kart/IBAN — elden tahsil edilecek nakit yok.
        </div>
      )}
      {rapor.personeller.length === 0 && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: 10, textAlign: 'center' }}>
          Bu vardiyada satış kaydı yok.
        </div>
      )}

      {/* ── Kısmi teslim penceresi — ekranın üstünde ayrı açılır (gömülmez, klavye kapatmaz) ── */}
      {kismiPid && (() => {
        const p = rapor.personeller.find(x => x.id === kismiPid);
        if (!p) return null;
        const beklenenK = { nakit: p.nakitTL || 0, kart: p.krediTL || 0, iban: p.ibanTL || 0 };
        const girilen = {
          nakit: padParse(kismiVals.nakit),
          kart: padParse(kismiVals.kart),
          iban: padParse(kismiVals.iban),
        };
        const fark = (beklenenK.nakit - girilen.nakit) + (beklenenK.kart - girilen.kart) + (beklenenK.iban - girilen.iban);
        const busy = islemde === p.id;
        return createPortal(
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10002,
            background: 'rgba(15,5,30,0.88)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '44px 16px 16px', overflowY: 'auto',
          }}>
            <div style={{
              width: '100%', maxWidth: 370,
              background: 'rgba(30,10,40,0.99)', border: '2px solid rgba(251,191,36,0.55)',
              borderRadius: 18, padding: '14px 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: RENK.amber, letterSpacing: 0.5 }}>➗ KISMİ TESLİM — 👤 {p.ad}</span>
                <button
                  onClick={() => setKismiPid(null)}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                    width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <X size={13} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10, lineHeight: 1.4 }}>
                Sadece eksik/fazla verilen kalemi değiştir — dokunmadığın kalem tam sayılır ✓
              </div>
              {([
                ['nakit', '💵 Nakit', beklenenK.nakit],
                ['kart', '💳 Kart', beklenenK.kart],
                ['iban', '🏦 IBAN', beklenenK.iban],
              ] as ['nakit' | 'kart' | 'iban', string, number][]).filter(([, , b]) => b > 0).map(([alan, etiket, b]) => (
                <div key={alan} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', flex: 1, lineHeight: 1.3 }}>
                    {etiket}
                    <span style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>beklenen {fmtTL(b)}</span>
                  </span>
                  {girilen[alan] === b
                    ? <b style={{ fontSize: 10, color: RENK.nakit, flexShrink: 0 }}>✓ tam</b>
                    : <b style={{ fontSize: 10, color: girilen[alan] < b ? '#f87171' : RENK.nakit, flexShrink: 0 }}>{girilen[alan] < b ? `−${fmtTL(b - girilen[alan])}` : `+${fmtTL(girilen[alan] - b)}`}</b>}
                  <button
                    onClick={() => setKismiAlan(alan)}
                    style={{
                      width: 110, padding: '9px 10px', borderRadius: 10, textAlign: 'right', cursor: 'pointer',
                      background: 'rgba(0,0,0,0.4)',
                      border: kismiAlan === alan ? '2px solid rgba(251,191,36,0.9)' : '1.5px solid rgba(255,255,255,0.15)',
                      boxShadow: kismiAlan === alan ? '0 0 12px rgba(251,191,36,0.3)' : 'none',
                      color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0,
                    }}
                  >
                    {kismiVals[alan] || '0'}
                  </button>
                </div>
              ))}

              {/* Numpad — kasadaki gibi, cihaz klavyesi yok */}
              {!kismiOnay && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '10px 0' }}>
                {PAD_KEYS.map(k => (
                  <button
                    key={k}
                    onClick={() => setKismiVals(v => ({ ...v, [kismiAlan]: padApply(v[kismiAlan], k) }))}
                    style={{
                      padding: '13px 0', borderRadius: 10, cursor: 'pointer',
                      background: k === 'C' ? 'rgba(248,113,113,0.12)' : k === '⌫' ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: k === 'C' ? '#f87171' : k === '⌫' ? RENK.amber : '#fff',
                      fontSize: 18, fontWeight: 800,
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>}
              <div style={{
                fontSize: 13, fontWeight: 900, textAlign: 'center', padding: '8px 0', marginBottom: 8,
                borderRadius: 10,
                background: fark > 0 ? 'rgba(248,113,113,0.1)' : fark < 0 ? 'rgba(168,230,207,0.08)' : 'rgba(255,255,255,0.04)',
                color: fark > 0 ? '#f87171' : fark < 0 ? RENK.nakit : 'rgba(255,255,255,0.5)',
              }}>
                {fark > 0 ? `⚠️ Açık: ${fmtTL(fark)}` : fark < 0 ? `Fazla: ${fmtTL(-fark)}` : 'Fark yok — tam teslim'}
              </div>
              {kismiOnay ? (
                /* Açık/fazla onayı — kaydetmeden önce son soru */
                <div style={{
                  padding: 12, borderRadius: 12,
                  background: fark > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(168,230,207,0.08)',
                  border: fark > 0 ? '1.5px solid rgba(248,113,113,0.55)' : '1.5px solid rgba(168,230,207,0.5)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.6, marginBottom: 10 }}>
                    ⚠️ <b>{p.ad}</b> için{' '}
                    {fark > 0
                      ? <b style={{ color: '#f87171' }}>{fmtTL(fark)} AÇIK</b>
                      : <b style={{ color: RENK.nakit }}>{fmtTL(-fark)} FAZLA</b>}{' '}
                    kaydedilecek.
                    <br />Onaylıyor musun?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => kismiKaydet(p)}
                      disabled={busy}
                      style={{
                        flex: 1, padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                        background: 'rgba(168,230,207,0.2)', border: '1.5px solid rgba(168,230,207,0.55)',
                        color: RENK.nakit, fontWeight: 800, fontSize: 13, opacity: busy ? 0.6 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} Onayla ve Kaydet
                    </button>
                    <button
                      onClick={() => setKismiOnay(false)}
                      style={{
                        padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13,
                      }}
                    >
                      Geri
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => (fark !== 0 ? setKismiOnay(true) : kismiKaydet(p))}
                    disabled={busy}
                    style={{
                      flex: 1, padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(168,230,207,0.18)', border: '1.5px solid rgba(168,230,207,0.5)',
                      color: RENK.nakit, fontWeight: 800, fontSize: 13, opacity: busy ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} Kaydet
                  </button>
                  <button
                    onClick={() => setKismiPid(null)}
                    style={{
                      padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13,
                    }}
                  >
                    Vazgeç
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ── 3. Hepsini teslim aldım ── */}
      {canTeslim && bekleyen.length > 1 && (
        <button
          onClick={() => onTeslim && onTeslim('hepsi', 'teslim')}
          disabled={islemde === 'hepsi'}
          style={{
            width: '100%', marginTop: 8, padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
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

      {/* ── 4. Rapor Detayı — sadece yönetici + üst müdür ── */}
      {canDetay && <>
      <button
        onClick={() => setRaporDetayAcik(a => !a)}
        style={{
          width: '100%', marginTop: 8, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
          background: 'rgba(157,217,234,0.07)', border: '1px solid rgba(157,217,234,0.3)',
          color: RENK.kart, fontWeight: 700, fontSize: 11.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <FileText size={12} /> Rapor Detayı — ciro {fmtTL(rapor.toplamCiro)}
        {raporDetayAcik ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {raporDetayAcik && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            <OzetChip label="Toplam Ciro" value={fmtTL(rapor.toplamCiro)} />
            <OzetChip label="Satılan Foto" value={rapor.satilanFotograf} />
            <OzetChip label="İade" value={rapor.toplamIade} />
            <OzetChip label="Çıkış" value={rapor.toplamCikis} />
            {rapor.musteriSayisi > 0 && <OzetChip label="Müşteri" value={rapor.musteriSayisi} />}
            {rapor.toplamIskonto > 0 && <OzetChip label="İskonto" value={fmtTL(rapor.toplamIskonto)} />}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {([
              ['💵 Nakit', rapor.nakitTL, RENK.nakit],
              ['💳 Kart', rapor.krediTL, RENK.kart],
              ['🏦 IBAN', rapor.ibanTL, RENK.iban],
            ] as [string, number, string][]).map(([label, tutar, renk]) => (
              <div key={label} style={{
                flex: 1, padding: '7px 8px', borderRadius: 10, textAlign: 'center',
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${renk}40`,
              }}>
                <div style={{ fontSize: 10, color: renk, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 800 }}>{fmtTL(tutar)}</div>
              </div>
            ))}
          </div>
          {/* Kişi bazlı satış dökümü */}
          {rapor.personeller.map(p => (
            <div key={p.id} style={{
              padding: '8px 10px', borderRadius: 10, marginBottom: 6,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>👤 {p.ad}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{fmtTL(p.toplamTL)}</span>
              </div>
              {p.satirlar.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,0.55)', padding: '1px 0' }}>
                  <span>{s.adet}× {s.urun}</span>
                  <span>{fmtTL(s.toplamTL)}</span>
                </div>
              ))}
              {p.iskontoTL > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#f87171', padding: '1px 0' }}>
                  <span>İskonto</span>
                  <span>−{fmtTL(p.iskontoTL)}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, fontSize: 10, marginTop: 3 }}>
                <span style={{ color: RENK.nakit, fontWeight: 700 }}>💵 {fmtTL(p.nakitTL)}</span>
                <span style={{ color: RENK.kart, fontWeight: 700 }}>💳 {fmtTL(p.krediTL)}</span>
                <span style={{ color: RENK.iban, fontWeight: 700 }}>🏦 {fmtTL(p.ibanTL)}</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
            Kart ve IBAN ödemeleri şirket hesabına gider — bilgi amaçlıdır, elden tahsil edilmez.
          </div>
        </div>
      )}
      </>}

      {/* ── 5. Teslim geçmişi (log) ── */}
      {(teslim?.log?.length || 0) > 0 && (
        <div style={{ marginTop: 8 }}>
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
                    ? l.kismi
                      ? <>{l.yapanAd}, <b>{l.personelAd}</b>'den {fmtTL(l.alinanToplam || 0)} teslim aldı{(l.acikToplam || 0) > 0 ? <b style={{ color: '#f87171' }}> ({fmtTL(l.acikToplam!)} açık)</b> : (l.acikToplam || 0) < 0 ? <b style={{ color: '#a8e6cf' }}> (+{fmtTL(-l.acikToplam!)} fazla)</b> : null}</>
                      : <>{l.yapanAd}, <b>{l.personelAd}</b>'den {fmtTL(l.tutar)} teslim aldı</>
                    : <>{l.yapanAd}, <b>{l.personelAd}</b> işaretini geri aldı</>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
  const [canDetay, setCanDetay] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [acikRapor, setAcikRapor] = useState<string | null>(null);
  const [islemde, setIslemde] = useState<string | null>(null); // `${raporId}:${personelId|hepsi}`
  /* ── Gün Kapatma (mor, sol rozet) ── */
  const [canGunKapatma, setCanGunKapatma] = useState(false);
  const [gunler, setGunler] = useState<GunKaydi[]>([]);
  const [morOpen, setMorOpen] = useState(false);
  const [morKismi, setMorKismi] = useState<{ tarih: string; tid: string; ad: string; beklenen: number } | null>(null);
  const [morKismiVal, setMorKismiVal] = useState('');
  const [morKismiOnay, setMorKismiOnay] = useState(false);
  const [morKapatOnay, setMorKapatOnay] = useState<string | null>(null);
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
      try { localStorage.setItem('aspect_tedarikci_yetkili', d.tedarikciYetkili ? '1' : '0'); } catch {}
      setCanTeslim(!!d.canTeslim);
      setCanDetay(!!d.canDetay);
      setCanGunKapatma(!!d.canGunKapatma);
      setGunler(d.gunler || []);
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

      // Tam senkron: başka bir yetkili teslimleri tamamladıysa rapor sunucudan silinmiştir
      // → buradaki popup'tan da düşer (herkes aynı anda görür)
      setRaporlar(gelen);
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

  const teslimYap = async (raporId: string, personelId: string, islem: 'teslim' | 'geri', kismi?: KismiGiris) => {
    const key = `${raporId}:${personelId}`;
    if (islemde) return;
    setIslemde(key);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/kapanis-bildirim/teslim${ghostParams()}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raporId, personelId, islem, kismi }),
      });
      const d = await res.json();
      if (res.ok && d.teslim) {
        if (d.tamamlandi && islem === 'teslim') {
          // Raporun tüm teslimleri bitti — popup'tan düşür (sunucu herkesin bekleyenini zaten sildi)
          setRaporlar(prev => prev.filter(r => r.id !== raporId));
        } else {
          setRaporlar(prev => prev.map(r => r.id === raporId ? { ...r, teslim: d.teslim } : r));
        }
      }
    } catch {} finally {
      setIslemde(null);
    }
  };

  const gunTeslim = async (tarih: string, toplayiciId: string, islem: 'teslim' | 'geri', alinanTutar?: number) => {
    const key = `gun:${tarih}:${toplayiciId}`;
    if (islemde) return;
    setIslemde(key);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/kapanis-bildirim/gun-teslim${ghostParams()}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarih, toplayiciId, islem, alinan: alinanTutar }),
      });
      const d = await res.json();
      if (res.ok && d.gun) {
        setGunler(prev => prev.map(g => g.tarih === tarih ? d.gun : g));
      }
    } catch {} finally {
      setIslemde(null);
    }
  };

  const gunKapat = async (tarih: string) => {
    if (islemde) return;
    setIslemde(`gunkapat:${tarih}`);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/kapanis-bildirim/gun-kapat${ghostParams()}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarih }),
      });
      if (res.ok) {
        setGunler(prev => prev.filter(g => g.tarih !== tarih));
        setMorKapatOnay(null);
      }
    } catch {} finally {
      setIslemde(null);
    }
  };

  const toplamBekleyenKisi = raporlar.reduce((s, r) => s + teslimBekleyenler(r).length, 0);
  const toplamKalanNakit = raporlar.reduce((s, r) => s + teslimBekleyenler(r).reduce((x, p) => x + (p.nakitTL || 0), 0), 0);

  const gunBekleyenList = (g: GunKaydi) => Object.entries(g.toplayicilar || {}).filter(([, t]) => (t.toplanan || 0) > 0 && !t.teslim?.alindi);
  const morToplamKisi = gunler.reduce((s, g) => s + gunBekleyenList(g).length, 0);
  const morToplamTutar = gunler.reduce((s, g) => s + gunBekleyenList(g).reduce((x, [, t]) => x + (t.toplanan || 0), 0), 0);
  const morGoster = canGunKapatma && gunler.length > 0;

  if (raporlar.length === 0 && !morGoster) return null;

  /* ── SARI (sağ): personelden toplama ── */
  const amberEl = raporlar.length === 0 ? null : minimized ? (
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
  ) : (
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
                      canDetay={canDetay}
                      islemde={islemde?.startsWith(`${r.id}:`) ? islemde.split(':')[1] : null}
                      onTeslim={(pid, islem, kismi) => teslimYap(r.id, pid, islem, kismi)}
                      sadeceBekleyen
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

  /* ── MOR (sol): gün kapatma — toplayıcılardan teslim + günü kapat ── */
  const morEl = !morGoster ? null : !morOpen ? (
    <button
      onClick={() => setMorOpen(true)}
      style={{
        position: 'fixed', left: 12, bottom: 96, zIndex: 9997,
        padding: '10px 14px', borderRadius: 999, cursor: 'pointer',
        background: 'rgba(20, 10, 40, 0.97)', border: '2px solid rgba(167,139,250,0.65)',
        boxShadow: '0 6px 24px rgba(167,139,250,0.35)',
        display: 'flex', alignItems: 'center', gap: 7,
      }}
    >
      <span style={{ fontSize: 14 }}>🌙</span>
      <span style={{ fontSize: 13, fontWeight: 900, color: '#c4b5fd' }}>
        {morToplamKisi > 0 ? `${morToplamKisi} teslim · ${fmtTL(morToplamTutar)}` : '✓ Hazır'}
      </span>
    </button>
  ) : (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(15, 5, 30, 0.92)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 440, maxHeight: '88vh',
        background: 'rgba(24, 12, 44, 0.98)', border: '2px solid rgba(167,139,250,0.55)',
        borderRadius: 20, boxShadow: '0 20px 80px rgba(167,139,250,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid rgba(167,139,250,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(167,139,250,0.08)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#c4b5fd', letterSpacing: 0.5 }}>🌙 GÜN KAPATMA</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
              {morToplamKisi > 0
                ? `${morToplamKisi} toplayıcıdan ${fmtTL(morToplamTutar)} teslim bekleniyor`
                : 'Tüm teslimler hazır — günleri kapatabilirsin'}
            </div>
          </div>
          <button
            onClick={() => { setMorOpen(false); setMorKapatOnay(null); }}
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body — açık günler, gün gün birikir */}
        <div style={{ padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {gunler.map(g => {
            const bekleyenT = gunBekleyenList(g);
            const rows = Object.entries(g.toplayicilar || {}).filter(([, t]) => (t.toplanan || 0) > 0 || t.teslim);
            const kapatOnayda = morKapatOnay === g.tarih;
            return (
              <div key={g.tarih} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.25)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>📅 {trDate(g.tarih)}</span>
                  {bekleyenT.length > 0
                    ? <span style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd' }}>💰 {fmtTL(bekleyenT.reduce((s, [, t]) => s + (t.toplanan || 0), 0))} bekliyor</span>
                    : <span style={{ fontSize: 11, fontWeight: 800, color: RENK.nakit }}>✓ Hazır</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rows.map(([tid, t]) => {
                    const alindi = !!t.teslim?.alindi;
                    const acikT = t.teslim?.acikTutar || 0;
                    const busy = islemde === `gun:${g.tarih}:${tid}`;
                    return (
                      <div key={tid} style={{
                        padding: '8px 10px', borderRadius: 12,
                        background: alindi ? 'rgba(168,230,207,0.07)' : 'rgba(255,255,255,0.05)',
                        border: alindi
                          ? (acikT > 0 ? '1px solid rgba(248,113,113,0.45)' : '1px solid rgba(168,230,207,0.4)')
                          : '1px solid rgba(255,255,255,0.12)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>👤 {t.ad}</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: alindi ? RENK.nakit : '#c4b5fd' }}>{fmtTL(t.toplanan || 0)}</span>
                        </div>
                        {alindi ? (
                          <button
                            onClick={() => gunTeslim(g.tarih, tid, 'geri')}
                            disabled={busy}
                            title="Geri almak için dokun"
                            style={{
                              width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 9,
                              background: acikT > 0 ? 'rgba(248,113,113,0.12)' : 'rgba(168,230,207,0.18)',
                              border: 'none', color: acikT > 0 ? '#f87171' : RENK.nakit,
                              fontWeight: 800, fontSize: 11.5, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap',
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                            Alındı{acikT > 0 ? ` · ⚠️ ${fmtTL(acikT)} açık` : acikT < 0 ? ` · +${fmtTL(-acikT)} fazla` : ''} · {t.teslim?.alanAd}{t.teslim?.zaman ? ` · ${fmtLogZaman(t.teslim.zaman)}` : ''}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button
                              onClick={() => gunTeslim(g.tarih, tid, 'teslim')}
                              disabled={busy}
                              style={{
                                flex: 2, padding: '9px 10px', borderRadius: 9,
                                background: 'rgba(167,139,250,0.15)', border: '1.5px solid rgba(167,139,250,0.55)',
                                color: '#c4b5fd', fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
                              Teslim Aldım
                            </button>
                            <button
                              onClick={() => { setMorKismi({ tarih: g.tarih, tid, ad: t.ad, beklenen: t.toplanan || 0 }); setMorKismiVal((t.toplanan || 0).toLocaleString('tr-TR')); setMorKismiOnay(false); }}
                              disabled={busy}
                              style={{
                                flex: 1, padding: '9px 8px', borderRadius: 9,
                                background: 'rgba(248,113,113,0.08)', border: '1.5px solid rgba(248,113,113,0.4)',
                                color: '#f87171', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              ➗ Kısmi
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Günü Kapat */}
                {kapatOnayda ? (
                  <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(167,139,250,0.1)', border: '1.5px solid rgba(167,139,250,0.55)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 10 }}>
                      🌙 {trDate(g.tarih)} günü kapatılacak. Onaylıyor musun?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => gunKapat(g.tarih)}
                        disabled={islemde === `gunkapat:${g.tarih}`}
                        style={{
                          flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                          background: 'rgba(167,139,250,0.25)', border: '1.5px solid rgba(167,139,250,0.6)',
                          color: '#e9d5ff', fontWeight: 800, fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          opacity: islemde === `gunkapat:${g.tarih}` ? 0.6 : 1,
                        }}
                      >
                        {islemde === `gunkapat:${g.tarih}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
                        Onayla ve Kapat
                      </button>
                      <button
                        onClick={() => setMorKapatOnay(null)}
                        style={{
                          padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                          color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13,
                        }}
                      >
                        Geri
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => bekleyenT.length === 0 && setMorKapatOnay(g.tarih)}
                    disabled={bekleyenT.length > 0}
                    style={{
                      width: '100%', marginTop: 8, padding: '11px 12px', borderRadius: 12,
                      cursor: bekleyenT.length > 0 ? 'default' : 'pointer',
                      background: bekleyenT.length > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(167,139,250,0.2)',
                      border: bekleyenT.length > 0 ? '1px dashed rgba(255,255,255,0.15)' : '1.5px solid rgba(167,139,250,0.6)',
                      color: bekleyenT.length > 0 ? 'rgba(255,255,255,0.35)' : '#e9d5ff',
                      fontWeight: 800, fontSize: 13,
                    }}
                  >
                    {bekleyenT.length > 0 ? `🌙 Günü Kapat — önce ${bekleyenT.length} teslim al` : '🌙 Günü Kapat'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ── Mor kısmi teslim penceresi (numpad) ── */
  const morKismiEl = !morKismi ? null : (() => {
    const girilenM = padParse(morKismiVal);
    const farkM = morKismi.beklenen - girilenM;
    const busyM = islemde === `gun:${morKismi.tarih}:${morKismi.tid}`;
    const morKismiKaydet = () => {
      gunTeslim(morKismi.tarih, morKismi.tid, 'teslim', girilenM);
      setMorKismi(null);
    };
    return createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10002,
        background: 'rgba(15,5,30,0.88)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '44px 16px 16px', overflowY: 'auto',
      }}>
        <div style={{
          width: '100%', maxWidth: 370,
          background: 'rgba(24,12,44,0.99)', border: '2px solid rgba(167,139,250,0.6)',
          borderRadius: 18, padding: '14px 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd', letterSpacing: 0.5 }}>➗ KISMİ TESLİM — 👤 {morKismi.ad}</span>
            <button
              onClick={() => setMorKismi(null)}
              style={{
                background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
                width: 28, height: 28, borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <X size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', flex: 1 }}>
              💵 Alınan
              <span style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>teslim etmeli {fmtTL(morKismi.beklenen)}</span>
            </span>
            <div style={{
              width: 130, padding: '9px 10px', borderRadius: 10, textAlign: 'right',
              background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(167,139,250,0.7)',
              color: '#fff', fontSize: 16, fontWeight: 800,
            }}>
              {morKismiVal || '0'}
            </div>
          </div>
          {!morKismiOnay && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '10px 0' }}>
            {PAD_KEYS.map(k => (
              <button
                key={k}
                onClick={() => setMorKismiVal(v => padApply(v, k))}
                style={{
                  padding: '13px 0', borderRadius: 10, cursor: 'pointer',
                  background: k === 'C' ? 'rgba(248,113,113,0.12)' : k === '⌫' ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: k === 'C' ? '#f87171' : k === '⌫' ? '#c4b5fd' : '#fff',
                  fontSize: 18, fontWeight: 800,
                }}
              >
                {k}
              </button>
            ))}
          </div>}
          <div style={{
            fontSize: 13, fontWeight: 900, textAlign: 'center', padding: '8px 0', marginBottom: 8, borderRadius: 10,
            background: farkM > 0 ? 'rgba(248,113,113,0.1)' : farkM < 0 ? 'rgba(168,230,207,0.08)' : 'rgba(255,255,255,0.04)',
            color: farkM > 0 ? '#f87171' : farkM < 0 ? RENK.nakit : 'rgba(255,255,255,0.5)',
          }}>
            {farkM > 0 ? `⚠️ Açık: ${fmtTL(farkM)}` : farkM < 0 ? `Fazla: ${fmtTL(-farkM)}` : 'Fark yok — tam teslim'}
          </div>
          {morKismiOnay ? (
            <div style={{
              padding: 12, borderRadius: 12,
              background: farkM > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(168,230,207,0.08)',
              border: farkM > 0 ? '1.5px solid rgba(248,113,113,0.55)' : '1.5px solid rgba(168,230,207,0.5)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.6, marginBottom: 10 }}>
                ⚠️ <b>{morKismi.ad}</b> için{' '}
                {farkM > 0
                  ? <b style={{ color: '#f87171' }}>{fmtTL(farkM)} AÇIK</b>
                  : <b style={{ color: RENK.nakit }}>{fmtTL(-farkM)} FAZLA</b>}{' '}
                kaydedilecek.
                <br />Onaylıyor musun?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={morKismiKaydet}
                  disabled={busyM}
                  style={{
                    flex: 1, padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(168,230,207,0.2)', border: '1.5px solid rgba(168,230,207,0.55)',
                    color: RENK.nakit, fontWeight: 800, fontSize: 13, opacity: busyM ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Check size={13} strokeWidth={3} /> Onayla ve Kaydet
                </button>
                <button
                  onClick={() => setMorKismiOnay(false)}
                  style={{
                    padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13,
                  }}
                >
                  Geri
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => (farkM !== 0 ? setMorKismiOnay(true) : morKismiKaydet())}
                disabled={busyM}
                style={{
                  flex: 1, padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(168,230,207,0.18)', border: '1.5px solid rgba(168,230,207,0.5)',
                  color: RENK.nakit, fontWeight: 800, fontSize: 13, opacity: busyM ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Check size={13} strokeWidth={3} /> Kaydet
              </button>
              <button
                onClick={() => setMorKismi(null)}
                style={{
                  padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13,
                }}
              >
                Vazgeç
              </button>
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  })();

  return (<>{amberEl}{morEl}{morKismiEl}</>);
}
