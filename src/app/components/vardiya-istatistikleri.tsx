/**
 * VardiyaIstatistikleri — Yönetici/Müdür için aylık personel vardiya istatistikleri
 * Veri kaynağı: GET /vardiya/istatistikler?ay=YYYY-MM
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Clock, AlertTriangle, CheckCircle2, Bell, Users, TrendingUp, Trash2, Calendar,
} from 'lucide-react';
import { buildHeaders, getToken, appendGhostParam } from '../lib/api';
import { projectId } from '../lib/supabase-info';
import type { UserRole } from './login';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/* ── Glassmorphism ── */
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};

/* ── Türkiye saati yardımcısı ── */
function trNow() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const names = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                 'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  return `${names[parseInt(m) - 1]} ${y}`;
}

function prevMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return monthKey(d);
}

function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return monthKey(d);
}

/* ── Gecikme rengi ── */
function lateColor(gecGiris: number, toplamVardiya: number): string {
  if (toplamVardiya === 0) return 'rgba(255,255,255,0.25)';
  const pct = gecGiris / toplamVardiya;
  if (pct === 0) return '#4ade80';
  if (pct < 0.2) return '#ffd4a3';
  return '#f87171';
}

/* ── Dakika format ── */
function fmtMin(min: number): string {
  if (!min || min <= 0) return '—';
  if (min < 60) return `${min}dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}sa ${m}dk` : `${h}sa`;
}

interface PersonelStat {
  userId: string;
  name: string;
  role: string;
  toplamVardiya: number;
  toplamCheckout: number;
  gecGiris: number;
  gecBildirim: number;
  toplamGecDk: number;
  ortGecDk: number;
}

interface Props {
  userName: string;
  userRole: UserRole;
  accessToken?: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function VardiyaIstatistikleri({ userName, userRole, accessToken, onNavigate }: Props) {
  const [ay, setAy] = useState(() => monthKey(trNow()));
  const [stats, setStats] = useState<PersonelStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ── Geç giriş sıfırla state ── */
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thisMonthStart = `${today.slice(0, 7)}-01`;
  const [showSifirlaModal, setShowSifirlaModal] = useState(false);
  const [sifirlaFilterKey, setSifirlaFilterKey] = useState<'bugun' | 'bu-ay' | 'ozel'>('bu-ay');
  const [sifirlaBaslangic, setSifirlaBaslangic] = useState(thisMonthStart);
  const [sifirlasBitis, setSifirlasBitis] = useState(today);
  const [sifirlaYukleniyor, setSifirlaYukleniyor] = useState(false);
  const [sifirlaHata, setSifirlaHata] = useState('');
  const [sifirlaBasarili, setSifirlaBasarili] = useState('');

  const isYonetici = ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari'].includes(userRole);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = accessToken || await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/istatistikler?ay=${ay}`), {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Veri alınamadı.');
        return;
      }
      setStats(data.stats || []);
    } catch (e) {
      console.error('[VardiyaIstatistikleri] fetch error:', e);
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  }, [ay, accessToken]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleGecGirisSifirla = async () => {
    setSifirlaYukleniyor(true);
    setSifirlaHata('');
    setSifirlaBasarili('');
    try {
      const token = accessToken || await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/gec-giris-sifirla`), {
        method: 'POST',
        headers: { ...buildHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ baslangic: sifirlaBaslangic, bitis: sifirlasBitis }),
      });
      const data = await res.json();
      if (!res.ok) { setSifirlaHata(data.error || 'Sıfırlama başarısız.'); return; }
      setSifirlaBasarili(`${data.sifirlanenCheckin} geç giriş, ${data.silinenNotice} bildirim temizlendi.`);
      setShowSifirlaModal(false);
      await fetchStats();
    } catch (e) {
      setSifirlaHata('Sunucuya ulaşılamadı.');
    } finally {
      setSifirlaYukleniyor(false);
    }
  };

  /* ── Yetki kontrolü ── */
  if (!isYonetici) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '0 24px' }}>
        <div style={{ ...glass, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <p style={{ color: 'white', fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Erişim Kısıtlı</p>
          <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13 }}>Bu sayfa yalnızca yöneticilere açıktır.</p>
          <button onClick={() => onNavigate('isletme-istatistikleri')} style={{
            marginTop: 20, padding: '10px 24px', borderRadius: 12, border: 'none',
            background: 'rgba(255,255,255,0.10)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>Geri Dön</button>
        </div>
      </div>
    );
  }

  /* ── Özet metrikler ── */
  const totalVardiya = stats.reduce((s, p) => s + p.toplamVardiya, 0);
  const totalGec = stats.reduce((s, p) => s + p.gecGiris, 0);
  const totalBildirim = stats.reduce((s, p) => s + p.gecBildirim, 0);
  const avgOrt = stats.length > 0
    ? Math.round(stats.reduce((s, p) => s + p.ortGecDk, 0) / stats.filter(p => p.toplamVardiya > 0).length || 0)
    : 0;

  const currentMonthKey = monthKey(trNow());
  const isCurrentMonth = ay === currentMonthKey;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 112, paddingTop: 16 }}>

      {/* ── Başlık ── */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => onNavigate('isletme-istatistikleri')} style={{
            width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <ArrowLeft style={{ width: 16, height: 16, color: 'white' }} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'white', margin: 0 }}>Vardiya İstatistikleri</h1>
              <span style={{ fontSize: 20 }}>⏱️</span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(var(--app-accent-rgb),0.5)', margin: 0 }}>
              {userName} · Personel bazlı aylık giriş/çıkış takibi
            </p>
          </div>
          {userRole === 'yonetici' && (
            <button
              onClick={() => { setSifirlaHata(''); setSifirlaBasarili(''); setShowSifirlaModal(true); }}
              style={{
                width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}
              title="Geç Giriş Sıfırla"
            >
              <Trash2 style={{ width: 16, height: 16, color: '#f87171' }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Ay Seçici ── */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div style={{ ...glass, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setAy(prev => prevMonth(prev))}
            style={{
              width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <ChevronLeft style={{ width: 16, height: 16, color: 'white' }} />
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>{monthLabel(ay)}</div>
            {isCurrentMonth && (
              <div style={{ fontSize: 10, color: '#9dd9ea', fontWeight: 700, marginTop: 2 }}>● Cari Ay</div>
            )}
          </div>

          <button
            onClick={() => setAy(prev => nextMonth(prev))}
            disabled={isCurrentMonth}
            style={{
              width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.10)',
              background: isCurrentMonth ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isCurrentMonth ? 'not-allowed' : 'pointer',
              opacity: isCurrentMonth ? 0.35 : 1,
            }}
          >
            <ChevronRight style={{ width: 16, height: 16, color: 'white' }} />
          </button>
        </div>
      </div>

      {/* ── Özet Kartlar ── */}
      {!loading && !error && stats.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: Users,         label: 'Toplam Vardiya',  value: totalVardiya,  color: '#9dd9ea' },
              { icon: AlertTriangle, label: 'Geç Giriş',       value: totalGec,      color: '#f87171' },
              { icon: Bell,          label: 'Geç Bildirim',    value: totalBildirim, color: '#ffd4a3' },
              { icon: Clock,         label: 'Ort. Gecikme',    value: fmtMin(avgOrt),color: '#d4b5f7' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{
                ...glass,
                padding: '14px 14px',
                borderColor: `${color}33`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon style={{ width: 14, height: 14, color }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── İçerik ── */}
      <div style={{ padding: '0 16px' }}>

        {/* Yükleniyor */}
        {loading && (
          <div style={{ ...glass, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 style={{ width: 24, height: 24, color: '#9dd9ea', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>Veriler yükleniyor…</span>
          </div>
        )}

        {/* Hata */}
        {!loading && error && (
          <div style={{ ...glass, padding: 32, textAlign: 'center' }}>
            <AlertTriangle style={{ width: 32, height: 32, color: '#f87171', margin: '0 auto 12px' }} />
            <p style={{ color: '#f87171', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{error}</p>
            <button onClick={fetchStats} style={{
              display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
              padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              <RefreshCw style={{ width: 12, height: 12 }} />Tekrar Dene
            </button>
          </div>
        )}

        {/* Boş */}
        {!loading && !error && stats.length === 0 && (
          <div style={{ ...glass, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: 14 }}>
              {monthLabel(ay)} için kayıt bulunamadı
            </p>
            <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: 12, marginTop: 6 }}>
              Bu ayda henüz check-in verisi yok
            </p>
          </div>
        )}

        {/* Personel Tablosu */}
        {!loading && !error && stats.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Başlık satırı */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px 56px',
              gap: 8, padding: '0 14px',
            }}>
              {['Personel', 'Vardiya', 'Geç', 'Bildr.', 'Ort.Gec.'].map(h => (
                <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.30)', textAlign: h === 'Personel' ? 'left' : 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
              ))}
            </div>

            {/* Sıralama: en çok geç girenden başla */}
            {[...stats]
              .sort((a, b) => b.gecGiris - a.gecGiris)
              .map((p, idx) => {
                const color = lateColor(p.gecGiris, p.toplamVardiya);
                const tamamlanmaPct = p.toplamVardiya > 0
                  ? Math.round((p.toplamCheckout / p.toplamVardiya) * 100)
                  : 0;
                return (
                  <div key={p.userId} style={{
                    ...glass,
                    padding: '14px',
                    borderColor: p.gecGiris > 0 ? `rgba(248,113,113,0.18)` : 'rgba(255,255,255,0.08)',
                  }}>
                    {/* Üst satır */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px 56px', gap: 8, alignItems: 'center' }}>

                      {/* İsim */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                          background: `${color}22`, border: `1px solid ${color}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 900, color,
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                            {p.role === 'personel' ? 'Personel' : p.role === 'operasyon' ? 'Operasyon' : 'İdari'}
                          </div>
                        </div>
                      </div>

                      {/* Vardiya */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#9dd9ea' }}>{p.toplamVardiya}</div>
                      </div>

                      {/* Geç giriş */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: p.gecGiris > 0 ? '#f87171' : '#4ade80' }}>
                          {p.gecGiris}
                        </div>
                      </div>

                      {/* Bildirim */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: p.gecBildirim > 0 ? '#ffd4a3' : 'rgba(255,255,255,0.30)' }}>
                          {p.gecBildirim}
                        </div>
                      </div>

                      {/* Ortalama gecikme */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: p.ortGecDk > 0 ? '#d4b5f7' : 'rgba(255,255,255,0.25)' }}>
                          {fmtMin(p.ortGecDk)}
                        </div>
                      </div>
                    </div>

                    {/* Alt sat��r: tamamlanma barı + ek bilgi */}
                    {p.toplamVardiya > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', fontWeight: 600 }}>
                            Tamamlanan çıkışlar
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: tamamlanmaPct === 100 ? '#4ade80' : 'rgba(255,255,255,0.40)' }}>
                            {p.toplamCheckout}/{p.toplamVardiya}
                          </span>
                        </div>
                        <div style={{ height: 4, borderRadius: 9999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${tamamlanmaPct}%`, height: '100%', borderRadius: 9999,
                            background: tamamlanmaPct === 100 ? '#4ade80' : '#9dd9ea',
                            transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                          }} />
                        </div>

                        {/* Geç toplamı göster */}
                        {p.toplamGecDk > 0 && (
                          <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <AlertTriangle style={{ width: 10, height: 10, color: '#f87171', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                              Bu ay toplam <span style={{ color: '#f87171', fontWeight: 800 }}>{fmtMin(p.toplamGecDk)}</span> geç giriş
                            </span>
                          </div>
                        )}
                        {p.toplamGecDk === 0 && p.toplamVardiya > 0 && (
                          <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <CheckCircle2 style={{ width: 10, height: 10, color: '#4ade80', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: 'rgba(74,222,128,0.60)' }}>Bu ay hiç geç giriş yok 🎉</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Yenile butonu */}
            <button onClick={fetchStats} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 4,
            }}>
              <RefreshCw style={{ width: 13, height: 13 }} />
              Yenile
            </button>
          </div>
        )}
      </div>

      {/* ── Başarı Banner ── */}
      {sifirlaBasarili && (
        <div style={{
          position: 'fixed', bottom: 112, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, padding: '10px 20px', borderRadius: 16,
          background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)',
          backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', gap: 8,
          color: '#6ee7b7', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          ✅ {sifirlaBasarili}
        </div>
      )}

      {/* ── Geç Giriş Sıfırla Modal ── */}
      {showSifirlaModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            width: '100%', maxWidth: 360, borderRadius: 24, padding: 24,
            background: 'rgba(15,8,35,0.97)', border: '1px solid rgba(239,68,68,0.35)',
            backdropFilter: 'blur(24px)', display: 'flex', flexDirection: 'column', gap: 20,
          }}>
            {/* İkon + Başlık */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 style={{ width: 28, height: 28, color: '#f87171' }} />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'white', margin: 0 }}>Geç Giriş Kayıtlarını Sıfırla</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                Seçilen tarih aralığındaki <span style={{ color: '#f87171', fontWeight: 600 }}>geç giriş</span> ve <span style={{ color: '#f87171', fontWeight: 600 }}>geç bildirim</span> kayıtları silinecek. Bu işlem geri alınamaz.
              </p>
            </div>

            {/* Tarih seçimi */}
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar style={{ width: 12, height: 12 }} /> Tarih Aralığı
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['bugun', 'bu-ay', 'ozel'] as const).map(k => (
                  <button
                    key={k}
                    onClick={() => {
                      setSifirlaFilterKey(k);
                      if (k === 'bugun') { setSifirlaBaslangic(today); setSifirlasBitis(today); }
                      if (k === 'bu-ay') { setSifirlaBaslangic(thisMonthStart); setSifirlasBitis(today); }
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      background: sifirlaFilterKey === k ? 'var(--app-accent, #a855f7)' : 'rgba(255,255,255,0.10)',
                      color: sifirlaFilterKey === k ? 'white' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {k === 'bugun' ? 'Bugün' : k === 'bu-ay' ? 'Bu Ay' : 'Özel'}
                  </button>
                ))}
              </div>
              {sifirlaFilterKey === 'ozel' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input type="date" value={sifirlaBaslangic}
                    onChange={e => setSifirlaBaslangic(e.target.value)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 10, padding: '8px 10px', color: 'white', fontSize: 12 }} />
                  <input type="date" value={sifirlasBitis}
                    onChange={e => setSifirlasBitis(e.target.value)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 10, padding: '8px 10px', color: 'white', fontSize: 12 }} />
                </div>
              )}
            </div>

            {/* Hata */}
            {sifirlaHata && (
              <div style={{ borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} /> {sifirlaHata}
              </div>
            )}

            {/* Butonlar */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowSifirlaModal(false)}
                disabled={sifirlaYukleniyor}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 13, fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                }}
              >
                İptal
              </button>
              <button
                onClick={handleGecGirisSifirla}
                disabled={sifirlaYukleniyor}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 14, fontSize: 13, fontWeight: 800,
                  border: '1px solid rgba(239,68,68,0.5)', cursor: sifirlaYukleniyor ? 'not-allowed' : 'pointer',
                  background: sifirlaYukleniyor ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.7)',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {sifirlaYukleniyor
                  ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 0.8s linear infinite' }} /> Sıfırlanıyor...</>
                  : <><Trash2 style={{ width: 14, height: 14 }} /> Evet, Sıfırla</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}