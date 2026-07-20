import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, AlertTriangle,
  ChevronDown, ChevronUp, Check, Banknote,
} from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { authHeaders, appendGhostParam } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background: 'rgba(0,0,0,0.65)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 16,
};

const fmtTL = (n: number) => `₺${(Number(n) || 0).toLocaleString('tr-TR')}`;
const trDate = (t: string) => {
  const [y, m, d] = (t || '').split('-');
  return y ? `${d}.${m}.${y}` : t;
};
const fmtZaman = (iso: string) => {
  try { return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

export interface AcikKaydi {
  id: string;
  personelId: string;
  personelAd: string;
  raporId: string;
  mekanId: string;
  mekanAdi: string;
  mekanEmoji: string;
  tarih: string;
  /** Personelin kendi görünümünde (acigim) sunucu bu alanları GÖNDERMEZ — ciro bilgisi gizli */
  beklenen?: { nakit: number; kart: number; iban: number };
  alinan?: { nakit: number; kart: number; iban: number };
  /** pozitif: açık (eksik), negatif: fazla */
  acik?: { nakit: number; kart: number; iban: number };
  acikToplam: number;
  kalanAcik: number;
  tahsilatlar: { tutar: number; alanId: string; alanAd: string; zaman: string }[];
  alanAd: string;
  zaman: string;
}

/** Tek açık kaydının satırı — Açık Takip (yönetici) ve Açıklarım (personel) ortak kullanır */
export function AcikSatir({ kayit, canTahsil, onTahsil, islemde }: {
  kayit: AcikKaydi;
  canTahsil?: boolean;
  onTahsil?: (acikId: string, tutar: number) => void;
  islemde?: boolean;
}) {
  const [tahsilAcik, setTahsilAcik] = useState(false);
  const [tutar, setTutar] = useState('');
  const fazla = kayit.acikToplam < 0;
  const kapali = !fazla && kayit.kalanAcik <= 0;

  // beklenen/alınan yoksa (personelin kendi görünümü) kalem kırılımı gösterilmez — sadece açık tutarı
  const kalemler = kayit.beklenen && kayit.alinan
    ? ([
        ['💵 Nakit', kayit.beklenen.nakit, kayit.alinan.nakit],
        ['💳 Kart', kayit.beklenen.kart, kayit.alinan.kart],
        ['🏦 IBAN', kayit.beklenen.iban, kayit.alinan.iban],
      ] as [string, number, number][]).filter(([, b, a]) => b !== a)
    : [];

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12, marginBottom: 8,
      background: fazla ? 'rgba(168,230,207,0.05)' : kapali ? 'rgba(255,255,255,0.03)' : 'rgba(248,113,113,0.06)',
      border: fazla ? '1px solid rgba(168,230,207,0.3)' : kapali ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(248,113,113,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
          {trDate(kayit.tarih)} · {kayit.mekanEmoji} {kayit.mekanAdi}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Teslim alan: {kayit.alanAd}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {fazla ? (
            <span style={{ fontSize: 13, fontWeight: 900, color: '#a8e6cf' }}>+{fmtTL(-kayit.acikToplam)} fazla</span>
          ) : kapali ? (
            <span style={{ fontSize: 12, fontWeight: 800, color: '#a8e6cf' }}>✓ Kapandı ({fmtTL(kayit.acikToplam)})</span>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#f87171' }}>⚠️ {fmtTL(kayit.kalanAcik)} açık</div>
              {kayit.kalanAcik !== kayit.acikToplam && (
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)' }}>ilk açık {fmtTL(kayit.acikToplam)}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Kalem kırılımı — sadece farklı olanlar */}
      {kalemler.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {kalemler.map(([etiket, b, a]) => (
            <div key={etiket} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,0.55)', padding: '1px 0' }}>
              <span>{etiket}</span>
              <span>beklenen {fmtTL(b)} → alınan {fmtTL(a)} <b style={{ color: b - a > 0 ? '#f87171' : '#a8e6cf' }}>({b - a > 0 ? `−${fmtTL(b - a)}` : `+${fmtTL(a - b)}`})</b></span>
            </div>
          ))}
        </div>
      )}

      {/* Tahsilat geçmişi */}
      {(kayit.tahsilatlar || []).length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(255,255,255,0.12)' }}>
          {kayit.tahsilatlar.map((t, i) => (
            <div key={i} style={{ fontSize: 10.5, color: '#a8e6cf', padding: '1px 0' }}>
              ✓ {fmtZaman(t.zaman)} · {fmtTL(t.tutar)} tahsil edildi ({t.alanAd})
            </div>
          ))}
        </div>
      )}

      {/* Tahsil Et */}
      {canTahsil && !fazla && kayit.kalanAcik > 0 && (
        tahsilAcik ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
            <input
              type="number"
              inputMode="numeric"
              value={tutar}
              onChange={e => setTutar(e.target.value)}
              placeholder={String(kayit.kalanAcik)}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 8, textAlign: 'right',
                background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: 14, fontWeight: 800, outline: 'none',
              }}
            />
            <button
              onClick={() => {
                const t = Math.round(Number(tutar || kayit.kalanAcik) || 0);
                if (t > 0 && onTahsil) { onTahsil(kayit.id, t); setTahsilAcik(false); setTutar(''); }
              }}
              disabled={islemde}
              style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(168,230,207,0.18)', border: '1px solid rgba(168,230,207,0.5)',
                color: '#a8e6cf', fontWeight: 800, fontSize: 12, opacity: islemde ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {islemde ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />} Kaydet
            </button>
            <button
              onClick={() => { setTahsilAcik(false); setTutar(''); }}
              style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setTahsilAcik(true)}
            style={{
              width: '100%', marginTop: 8, padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(168,230,207,0.1)', border: '1px solid rgba(168,230,207,0.4)',
              color: '#a8e6cf', fontWeight: 800, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Banknote size={13} /> Tahsil Et
          </button>
        )
      )}
    </div>
  );
}

interface Props {
  userName: string;
  userRole: string;
  accessToken: string;
  onNavigate: (tab: string) => void;
}

/** Açık Takip — yönetici + üst müdür: TÜM personelin açık/eksik/fazla kayıtları */
export function AcikPanel({ onNavigate }: Props) {
  const [acikler, setAcikler] = useState<AcikKaydi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acikPersonel, setAcikPersonel] = useState<string | null>(null);
  const [islemde, setIslemde] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(appendGhostParam(`${API_BASE}/kapanis-bildirim/acik`), { headers });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Açıklar yüklenemedi');
      setAcikler(d.acikler || []);
    } catch (e: any) {
      setError(e.message || 'Ağ hatası');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const tahsil = async (acikId: string, tutar: number) => {
    if (islemde) return;
    setIslemde(acikId);
    try {
      const headers = await authHeaders();
      const res = await fetch(appendGhostParam(`${API_BASE}/kapanis-bildirim/acik-tahsil`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ acikId, tutar }),
      });
      const d = await res.json();
      if (res.ok && d.kayit) {
        setAcikler(prev => prev.map(a => a.id === d.kayit.id ? d.kayit : a));
      }
    } catch {} finally {
      setIslemde(null);
    }
  };

  /* Personel bazlı gruplama */
  const gruplar = acikler.reduce<Record<string, { ad: string; kayitlar: AcikKaydi[] }>>((acc, a) => {
    if (!acc[a.personelId]) acc[a.personelId] = { ad: a.personelAd, kayitlar: [] };
    acc[a.personelId].kayitlar.push(a);
    return acc;
  }, {});
  const grupList = Object.entries(gruplar)
    .map(([pid, g]) => ({
      pid,
      ad: g.ad,
      kayitlar: g.kayitlar,
      kalanAcik: g.kayitlar.reduce((s, k) => s + (k.kalanAcik || 0), 0),
      fazla: g.kayitlar.reduce((s, k) => s + Math.max(0, -(k.acikToplam || 0)), 0),
    }))
    .sort((a, b) => b.kalanAcik - a.kalanAcik);

  const toplamAcik = grupList.reduce((s, g) => s + g.kalanAcik, 0);
  const toplamFazla = grupList.reduce((s, g) => s + g.fazla, 0);
  const acigiOlanlar = grupList.filter(g => g.kalanAcik > 0).length;

  return (
    <div style={{ padding: '16px 14px 100px', minHeight: '100vh' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => onNavigate('dashboard')}
          style={{
            width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#f87171" /> Açık Takip
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Teslimat açıkları, eksik ve fazlalar — personel bazlı</div>
        </div>
        <button
          onClick={yukle}
          disabled={loading}
          style={{
            width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>

      {/* Özet */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ ...glass, flex: 1.4, padding: '12px 14px', border: '1px solid rgba(248,113,113,0.4)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171' }}>🔴 TOPLAM AÇIK</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: toplamAcik > 0 ? '#f87171' : '#a8e6cf' }}>{fmtTL(toplamAcik)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{acigiOlanlar} personelde açık var</div>
        </div>
        <div style={{ ...glass, flex: 1, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a8e6cf' }}>FAZLA VERİLEN</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#fff' }}>{fmtTL(toplamFazla)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>bilgi amaçlı</div>
        </div>
      </div>

      {error && (
        <div style={{ ...glass, padding: 16, textAlign: 'center', fontSize: 13, color: '#f87171' }}>{error}</div>
      )}

      {!error && !loading && grupList.length === 0 && (
        <div style={{ ...glass, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Hiç açık kaydı yok — tüm teslimatlar tam.</div>
        </div>
      )}

      {/* Personel kartları */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {grupList.map(g => {
          const acik = acikPersonel === g.pid;
          return (
            <div key={g.pid} style={{ ...glass, overflow: 'hidden', ...(g.kalanAcik > 0 ? { border: '1px solid rgba(248,113,113,0.4)' } : {}) }}>
              <button
                onClick={() => setAcikPersonel(acik ? null : g.pid)}
                style={{ width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                    👤 {g.ad}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>{g.kayitlar.length} kayıt</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      {g.kalanAcik > 0 ? (
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#f87171' }}>⚠️ {fmtTL(g.kalanAcik)}</div>
                      ) : (
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#a8e6cf' }}>✓ Açık yok</div>
                      )}
                      {g.fazla > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#a8e6cf' }}>+{fmtTL(g.fazla)} fazla</div>}
                    </div>
                    {acik ? <ChevronUp size={14} color="rgba(255,255,255,0.5)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.5)" />}
                  </div>
                </div>
              </button>
              {acik && (
                <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                  {g.kayitlar.map(k => (
                    <AcikSatir
                      key={k.id}
                      kayit={k}
                      canTahsil
                      onTahsil={tahsil}
                      islemde={islemde === k.id}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
