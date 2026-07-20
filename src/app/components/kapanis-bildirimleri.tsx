import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, Wallet, Settings2,
  ChevronDown, ChevronUp, Check, Save, Send,
} from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { authHeaders, appendGhostParam } from '../lib/api';
import { KapanisRaporDetay, teslimBekleyenler, type KapanisRapor, type KismiGiris } from './kapanis-bildirim-modal';

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

interface Kullanici { id: string; ad: string; rol: string; email: string; }
interface MekanItem { id: string; name: string; emoji: string; }
interface ConfigKisi { userId: string; ad: string; rol: string; scope: 'all' | string[]; bildirim?: boolean; teslimYetkisi?: boolean; }

interface Props {
  userName: string;
  userRole: string;
  accessToken: string;
  onNavigate: (tab: string) => void;
}

export function KapanisBildirimleri({ userRole, onNavigate }: Props) {
  const isYonetici = userRole === 'yonetici';

  /* ── Rapor listesi ── */
  const [raporlar, setRaporlar] = useState<KapanisRapor[]>([]);
  const [canTeslim, setCanTeslim] = useState(false);
  const [canDetay, setCanDetay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acikRapor, setAcikRapor] = useState<string | null>(null);
  const [islemde, setIslemde] = useState<string | null>(null);

  /* ── Yetki paneli (yönetici) ── */
  const [panelAcik, setPanelAcik] = useState(false);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [mekanlar, setMekanlar] = useState<MekanItem[]>([]);
  const [kisiler, setKisiler] = useState<ConfigKisi[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [testGonderiliyor, setTestGonderiliyor] = useState(false);
  const [testMsg, setTestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const yukleRaporlar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(appendGhostParam(`${API_BASE}/kapanis-bildirim/liste`), { headers });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Raporlar yüklenemedi');
      setRaporlar(d.raporlar || []);
      setCanTeslim(!!d.canTeslim);
      setCanDetay(!!d.canDetay);
    } catch (e: any) {
      setError(e.message || 'Ağ hatası');
    } finally {
      setLoading(false);
    }
  }, []);

  const yuklePanel = useCallback(async () => {
    if (!isYonetici) return;
    setPanelLoading(true);
    try {
      const headers = await authHeaders();
      const [kRes, mRes, cRes] = await Promise.all([
        fetch(appendGhostParam(`${API_BASE}/auth/kullanicilar`), { headers }),
        fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers }),
        fetch(appendGhostParam(`${API_BASE}/kapanis-bildirim/config`), { headers }),
      ]);
      if (kRes.ok) {
        const d = await kRes.json();
        setKullanicilar(d.kullanicilar || []);
      }
      if (mRes.ok) {
        const d = await mRes.json();
        setMekanlar((d.mekanlar || []).map((m: any) => ({ id: m.id, name: m.name, emoji: m.emoji || '🏪' })));
      }
      if (cRes.ok) {
        const d = await cRes.json();
        setKisiler(d.config?.kisiler || []);
      }
    } catch {} finally {
      setPanelLoading(false);
    }
  }, [isYonetici]);

  useEffect(() => { yukleRaporlar(); }, [yukleRaporlar]);
  useEffect(() => { if (panelAcik) yuklePanel(); }, [panelAcik, yuklePanel]);

  /* ── Yetki paneli işlemleri ── */
  const kisiBul = (userId: string) => kisiler.find(k => k.userId === userId);

  const kisiToggle = (u: Kullanici) => {
    setKaydedildi(false);
    setKisiler(prev => {
      const varMi = prev.find(k => k.userId === u.id);
      if (varMi) return prev.filter(k => k.userId !== u.id);
      // Varsayılan: sadece görüntüleme — popup ve teslim yetkisi kapalı
      return [...prev, { userId: u.id, ad: u.ad, rol: u.rol, scope: 'all' as const, bildirim: false, teslimYetkisi: false }];
    });
  };

  const kisiAyarToggle = (userId: string, alan: 'bildirim' | 'teslimYetkisi') => {
    setKaydedildi(false);
    setKisiler(prev => prev.map(k => k.userId === userId ? { ...k, [alan]: !k[alan] } : k));
  };

  const teslimYap = async (raporId: string, personelId: string, islem: 'teslim' | 'geri', kismi?: KismiGiris) => {
    if (islemde) return;
    setIslemde(`${raporId}:${personelId}`);
    try {
      const headers = await authHeaders();
      const res = await fetch(appendGhostParam(`${API_BASE}/kapanis-bildirim/teslim`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raporId, personelId, islem, kismi }),
      });
      const d = await res.json();
      if (res.ok && d.teslim) {
        setRaporlar(prev => prev.map(r => r.id === raporId ? { ...r, teslim: d.teslim } : r));
      }
    } catch {} finally {
      setIslemde(null);
    }
  };

  const scopeToggle = (userId: string, mekanId: string | 'all') => {
    setKaydedildi(false);
    setKisiler(prev => prev.map(k => {
      if (k.userId !== userId) return k;
      if (mekanId === 'all') return { ...k, scope: 'all' as const };
      const mevcut = k.scope === 'all' ? [] : [...k.scope];
      const yeni = mevcut.includes(mekanId)
        ? mevcut.filter(id => id !== mekanId)
        : [...mevcut, mekanId];
      return { ...k, scope: yeni };
    }));
  };

  const testGonder = async () => {
    setTestGonderiliyor(true);
    setTestMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(appendGhostParam(`${API_BASE}/kapanis-bildirim/test`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Test gönderilemedi');
      setTestMsg({ type: 'ok', text: `${d.adet} rapor gönderildi (${(d.mekanlar || []).join(', ')}) — popup en geç 20 sn içinde düşecek.` });
      yukleRaporlar();
    } catch (e: any) {
      setTestMsg({ type: 'err', text: e.message || 'Ağ hatası' });
    } finally {
      setTestGonderiliyor(false);
    }
  };

  const kaydet = async () => {
    setKaydediliyor(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(appendGhostParam(`${API_BASE}/kapanis-bildirim/config`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kisiler }),
      });
      if (res.ok) {
        setKaydedildi(true);
        setTimeout(() => setKaydedildi(false), 2500);
      }
    } catch {} finally {
      setKaydediliyor(false);
    }
  };

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
            <Wallet size={18} color="#fbbf24" /> Kapanış Bildirimleri
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Vardiya kapanış tahsilat raporları — son 30 gün</div>
        </div>
        <button
          onClick={yukleRaporlar}
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

      {/* ── Yetki paneli (yönetici) ── */}
      {isYonetici && (
        <div style={{ ...glass, marginBottom: 14, overflow: 'hidden' }}>
          <button
            onClick={() => setPanelAcik(p => !p)}
            style={{
              width: '100%', padding: '12px 14px', background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#c4b5fd' }}>
              <Settings2 size={15} /> Bildirim Yetkileri
              {kisiler.length > 0 && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(196,181,253,0.15)', color: '#c4b5fd' }}>
                  {kisiler.length} kişi
                </span>
              )}
            </span>
            {panelAcik ? <ChevronUp size={15} color="#c4b5fd" /> : <ChevronDown size={15} color="#c4b5fd" />}
          </button>

          {panelAcik && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '10px 0', lineHeight: 1.5 }}>
                Kişiyi işaretlersen bu sayfayı ve kapanış raporlarını <b style={{ color: 'rgba(255,255,255,0.75)' }}>görebilir</b> (seçtiğin mekanlarla sınırlı).
                Kapanışta <b style={{ color: 'rgba(255,255,255,0.75)' }}>popup bildirimi</b> ve <b style={{ color: 'rgba(255,255,255,0.75)' }}>teslim işaretleme</b> ayrı yetkilerdir — varsayılan kapalıdır.
              </div>

              {/* Test: dünün kapanışlarını kendine popup olarak gönder */}
              <button
                onClick={testGonder}
                disabled={testGonderiliyor}
                style={{
                  width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)',
                  color: '#fbbf24', fontWeight: 700, fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: testGonderiliyor ? 0.6 : 1,
                }}
              >
                {testGonderiliyor ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Dünün kapanışını test olarak bana gönder
              </button>
              {testMsg && (
                <div style={{
                  fontSize: 11, marginBottom: 10, padding: '8px 10px', borderRadius: 10, lineHeight: 1.4,
                  color: testMsg.type === 'ok' ? '#a8e6cf' : '#f87171',
                  background: testMsg.type === 'ok' ? 'rgba(168,230,207,0.1)' : 'rgba(248,113,113,0.1)',
                  border: testMsg.type === 'ok' ? '1px solid rgba(168,230,207,0.3)' : '1px solid rgba(248,113,113,0.3)',
                }}>
                  {testMsg.text}
                </div>
              )}

              {panelLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <Loader2 size={20} color="#c4b5fd" className="animate-spin" />
                </div>
              )}

              {!panelLoading && kullanicilar.map(u => {
                const kisi = kisiBul(u.id);
                const secili = !!kisi;
                return (
                  <div key={u.id} style={{
                    marginBottom: 8, padding: '10px 12px', borderRadius: 12,
                    background: secili ? 'rgba(196,181,253,0.08)' : 'rgba(255,255,255,0.03)',
                    border: secili ? '1px solid rgba(196,181,253,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <button
                      onClick={() => kisiToggle(u)}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                          border: secili ? 'none' : '1.5px solid rgba(255,255,255,0.3)',
                          background: secili ? '#a78bfa' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {secili && <Check size={12} color="#1a0a3c" strokeWidth={3} />}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{u.ad}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{u.rol}</span>
                      </span>
                    </button>

                    {secili && kisi && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => scopeToggle(u.id, 'all')}
                          style={{
                            padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: kisi.scope === 'all' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                            border: kisi.scope === 'all' ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.12)',
                            color: kisi.scope === 'all' ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                          }}
                        >
                          🌍 Tüm Mekanlar
                        </button>
                        {mekanlar.map(m => {
                          const aktif = kisi.scope !== 'all' && kisi.scope.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              onClick={() => scopeToggle(u.id, m.id)}
                              style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                background: aktif ? 'rgba(168,230,207,0.15)' : 'rgba(255,255,255,0.05)',
                                border: aktif ? '1px solid rgba(168,230,207,0.5)' : '1px solid rgba(255,255,255,0.12)',
                                color: aktif ? '#a8e6cf' : 'rgba(255,255,255,0.6)',
                              }}
                            >
                              {m.emoji} {m.name}
                            </button>
                          );
                        })}
                        {kisi.scope !== 'all' && kisi.scope.length === 0 && (
                          <span style={{ fontSize: 10, color: '#f87171', alignSelf: 'center' }}>Mekan seç ya da "Tüm Mekanlar"ı işaretle</span>
                        )}
                      </div>
                    )}

                    {secili && kisi && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {([
                          ['bildirim', '🔔 Kapanışta popup bildirimi alır', '#9dd9ea'],
                          ['teslimYetkisi', '💰 "Teslim Aldım" işaretleyebilir', '#fbbf24'],
                        ] as ['bildirim' | 'teslimYetkisi', string, string][]).map(([alan, etiket, renk]) => {
                          const aktif = !!kisi[alan];
                          return (
                            <button
                              key={alan}
                              onClick={() => kisiAyarToggle(u.id, alan)}
                              style={{
                                padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: aktif ? `${renk}26` : 'rgba(255,255,255,0.05)',
                                border: aktif ? `1px solid ${renk}80` : '1px solid rgba(255,255,255,0.12)',
                                color: aktif ? renk : 'rgba(255,255,255,0.5)',
                              }}
                            >
                              <span style={{
                                width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                                border: aktif ? 'none' : '1.5px solid rgba(255,255,255,0.3)',
                                background: aktif ? renk : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {aktif && <Check size={10} color="#1a0a3c" strokeWidth={3} />}
                              </span>
                              {etiket}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {!panelLoading && (
                <button
                  onClick={kaydet}
                  disabled={kaydediliyor}
                  style={{
                    width: '100%', marginTop: 6, padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
                    background: kaydedildi ? 'rgba(168,230,207,0.2)' : 'rgba(196,181,253,0.18)',
                    border: kaydedildi ? '1px solid rgba(168,230,207,0.5)' : '1px solid rgba(196,181,253,0.45)',
                    color: kaydedildi ? '#a8e6cf' : '#c4b5fd', fontWeight: 800, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: kaydediliyor ? 0.6 : 1,
                  }}
                >
                  {kaydediliyor ? <Loader2 size={14} className="animate-spin" /> : kaydedildi ? <Check size={14} /> : <Save size={14} />}
                  {kaydedildi ? 'Kaydedildi' : 'Yetkileri Kaydet'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Rapor listesi ── */}
      {error && (
        <div style={{ ...glass, padding: 16, textAlign: 'center', fontSize: 13, color: '#f87171' }}>
          {error}
        </div>
      )}

      {!error && !loading && raporlar.length === 0 && (
        <div style={{ ...glass, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Son 30 günde kapanış bildirimi yok.</div>
        </div>
      )}

      {/* Eksik teslimat özeti */}
      {(() => {
        const eksikler = raporlar.filter(r => teslimBekleyenler(r).length > 0);
        if (eksikler.length === 0) return null;
        const eksikNakit = eksikler.reduce((s, r) => s + teslimBekleyenler(r).reduce((x, p) => x + (p.nakitTL || 0), 0), 0);
        return (
          <div style={{
            padding: '12px 14px', borderRadius: 14, marginBottom: 12,
            background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.45)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#f87171' }}>
              ⚠️ {eksikler.length} raporda eksik teslimat — toplam {fmtTL(eksikNakit)} nakit alınmadı
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
              {eksikler.map(r => `${r.mekanEmoji} ${r.mekanAdi} (${trDate(r.tarih)})`).join(' · ')}
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {raporlar.map(r => {
          const acik = acikRapor === r.id;
          const nakitliler = (r.personeller || []).filter(p => (p.nakitTL || 0) > 0);
          const bekleyen = teslimBekleyenler(r);
          const alinanSayi = nakitliler.length - bekleyen.length;
          return (
            <div key={r.id} style={{ ...glass, overflow: 'hidden', ...(bekleyen.length > 0 ? { border: '1px solid rgba(251,191,36,0.35)' } : {}) }}>
              <button
                onClick={() => setAcikRapor(acik ? null : r.id)}
                style={{
                  width: '100%', padding: '12px 14px', background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.mekanEmoji} {r.mekanAdi}
                      {nakitliler.length > 0 && (
                        bekleyen.length === 0 ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#a8e6cf', marginLeft: 6 }}>✓ Teslim tamam</span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', marginLeft: 6 }}>💰 {alinanSayi}/{nakitliler.length} teslim</span>
                        )
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {trDate(r.tarih)}{r.kapanisSaat ? ` · ${r.kapanisSaat}` : ''}{r.kapanisYapanAd ? ` · ${r.kapanisYapanAd}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{fmtTL(r.toplamCiro)}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>💰 {fmtTL(r.nakitTL)} nakit</div>
                    </div>
                    {acik ? <ChevronUp size={14} color="rgba(255,255,255,0.5)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.5)" />}
                  </div>
                </div>
              </button>
              {acik && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                  <KapanisRaporDetay
                    rapor={r}
                    canTeslim={canTeslim}
                    canDetay={canDetay}
                    islemde={islemde?.startsWith(`${r.id}:`) ? islemde.split(':')[1] : null}
                    onTeslim={(pid, islem, kismi) => teslimYap(r.id, pid, islem, kismi)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
