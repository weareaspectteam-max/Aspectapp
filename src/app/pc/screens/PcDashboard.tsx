import { useState } from 'react';
import { DollarSign, ShoppingBag, Camera, MapPin, AlertTriangle, Clock, RefreshCw, ChevronDown, Columns2, Square, Play, Pause, EyeOff } from 'lucide-react';
import { authHeaders, ghostParams } from '../../lib/api';
import { projectId } from '../../lib/supabase-info';
import { useCallback, useEffect } from 'react';
import type { PcDashboardData } from '../usePcDashboard';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

function formatTL(val: number): string {
  if (val >= 1_000_000) return `₺${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `₺${(val / 1_000).toFixed(1)}B`;
  return `₺${val.toLocaleString('tr-TR')}`;
}

// ─── Canlı Feed ───────────────────────────────────────────────
interface FeedItem {
  type: 'satis' | 'kare';
  id: string;
  timestamp: string;
  kaydeden?: string;
  mekanAdi: string;
  mekanEmoji: string;
  mekanColor?: string;
  items?: { product: string; quantity: number; dijital?: boolean }[];
  totalPrice?: number;
  discount?: number;
  finalPrice?: number;
  paymentMethod?: 'cash' | 'iban' | 'card';
  iptal?: boolean;
  gerekce?: string;
  photographerName?: string;
  frameCount?: number;
}

function FeedRow({ item }: { item: FeedItem }) {
  const mekanColor = item.mekanColor || '#9dd9ea';
  const time = new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  if (item.type === 'kare') {
    const kareColor = '#c5a8f5';
    return (
      <div style={{
        padding: '10px 12px 10px 14px', borderRadius: 8,
        background: `${kareColor}10`, border: `1px solid ${kareColor}30`, borderLeft: `3px solid ${kareColor}`,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Camera size={15} style={{ color: kareColor, flexShrink: 0 }} />
            <span style={{ color: kareColor, fontWeight: 700, fontSize: 15 }}>{item.frameCount} kare</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{time}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ color: mekanColor, fontWeight: 700 }}>{item.mekanEmoji} {item.mekanAdi}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{item.photographerName}</span>
        </div>
      </div>
    );
  }

  const payColor = item.paymentMethod === 'cash' ? '#34d399' : item.paymentMethod === 'card' ? '#60a5fa' : '#ffd4a3';
  const payLabel = item.paymentMethod === 'cash' ? 'NAKİT' : item.paymentMethod === 'card' ? 'KART' : item.paymentMethod === 'iban' ? 'IBAN' : '';
  const disc = item.discount || 0;
  const hasGerekce = !!item.gerekce;
  // İskonto / zam hesapla (mobildeki renk kodu ile)
  const originalPrice = disc !== 0 ? (item.finalPrice || 0) + disc : null;
  const discPct = originalPrice ? Math.round((Math.abs(disc) / originalPrice) * 100) : 0;
  const isZam = disc < 0;
  const discColor = isZam ? '#c5a8f5' : '#ffd4a3';
  const discSign = isZam ? '+' : '-';

  return (
    <div style={{
      padding: '10px 12px 10px 14px', borderRadius: 8,
      background: item.iptal ? 'rgba(248,113,113,0.08)' : `${mekanColor}10`,
      border: `1px solid ${item.iptal ? 'rgba(248,113,113,0.3)' : `${mekanColor}30`}`,
      borderLeft: `3px solid ${item.iptal ? '#f87171' : mekanColor}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.items?.map(i => (i.quantity > 1 ? `${i.quantity}× ` : '') + i.product).join(' + ') || '-'}
          </span>
          {item.iptal && <span style={{ fontSize: 11, color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', padding: '1px 6px', borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>İPTAL</span>}
          {hasGerekce && !item.iptal && <span style={{ fontSize: 11, color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', padding: '1px 6px', borderRadius: 3, fontWeight: 700, flexShrink: 0 }} title={item.gerekce}>GRK</span>}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{time}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ color: mekanColor, fontWeight: 700 }}>{item.mekanEmoji} {item.mekanAdi}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{item.kaydeden}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {disc !== 0 && (
            <span style={{ color: discColor, fontWeight: 700, fontSize: 11, background: `${discColor}15`, border: `1px solid ${discColor}40`, padding: '1px 6px', borderRadius: 4 }}>
              %{discPct} {discSign}₺{Math.abs(disc).toLocaleString('tr-TR')}
            </span>
          )}
          <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>₺{(item.finalPrice || 0).toLocaleString('tr-TR')}</span>
          {payLabel && <span style={{ fontSize: 11, color: payColor, border: `1px solid ${payColor}40`, padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>{payLabel}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Feed filter ───────────────────────────────────────────────
type FeedFilter = 'all' | 'satis' | 'kare' | string; // mekan:<id> formatında

function applyFilter(feed: FeedItem[], filter: FeedFilter): FeedItem[] {
  if (filter === 'all') return feed;
  if (filter === 'satis') return feed.filter(i => i.type === 'satis');
  if (filter === 'kare') return feed.filter(i => i.type === 'kare');
  if (filter.startsWith('mekan:')) {
    const id = filter.slice(6);
    return feed.filter(i => (i as any).mekanId === id || i.mekanAdi === id);
  }
  return feed;
}

function buildMekanOptions(feed: FeedItem[]): Array<{ value: string; label: string; emoji: string; color: string }> {
  const map = new Map<string, { value: string; label: string; emoji: string; color: string }>();
  for (const it of feed) {
    const id = (it as any).mekanId || it.mekanAdi;
    if (!map.has(id)) {
      map.set(id, {
        value: `mekan:${id}`,
        label: it.mekanAdi,
        emoji: it.mekanEmoji,
        color: it.mekanColor || '#9dd9ea',
      });
    }
  }
  return Array.from(map.values());
}

function FeedFilterDropdown({ value, onChange, mekanOptions }: { value: FeedFilter; onChange: (v: FeedFilter) => void; mekanOptions: Array<{ value: string; label: string; emoji: string; color: string }> }) {
  const [open, setOpen] = useState(false);
  const baseOptions = [
    { value: 'all',   label: 'Tümü',            color: '#fff' },
    { value: 'satis', label: 'Sadece Satışlar', color: '#a8e6cf' },
    { value: 'kare',  label: 'Sadece Kareler',  color: '#c5a8f5' },
  ];
  const currentLabel = (() => {
    if (value === 'all') return 'Tümü';
    if (value === 'satis') return 'Satışlar';
    if (value === 'kare') return 'Kareler';
    if (value.startsWith('mekan:')) {
      const opt = mekanOptions.find(m => m.value === value);
      return opt ? `${opt.emoji} ${opt.label}` : 'Mekan';
    }
    return 'Tümü';
  })();

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <span>{currentLabel}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'rgba(20, 15, 50, 0.98)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, padding: 4, zIndex: 20, minWidth: 180, maxHeight: 320, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {baseOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value as FeedFilter); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 10px',
                background: value === opt.value ? 'rgba(168,230,207,0.12)' : 'transparent',
                border: 'none', borderRadius: 5, color: opt.color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
          {mekanOptions.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />
          )}
          {mekanOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value as FeedFilter); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 10px',
                background: value === opt.value ? `${opt.color}20` : 'transparent',
                border: 'none', borderRadius: 5, color: opt.color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useCanliFeed(companyKey?: string) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/stok/canli-satis${ghostParams()}`, { headers });
      const data = await res.json();
      if (res.ok) setFeed(data.feed || data.satislar || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchFeed();
    // Dışarıdan tetikleme için global ref
    triggerFeedRefresh = fetchFeed;
    return () => { if (triggerFeedRefresh === fetchFeed) triggerFeedRefresh = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFeed, companyKey]);

  return { feed, loading };
}

function FeedList({ items, emptyText }: { items: FeedItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{emptyText}</div>;
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, minHeight: 0 }}>
      {items.slice(0, 80).map(item => <FeedRow key={item.id} item={item} />)}
    </div>
  );
}

function CanliFeedPanel({ split, companyKey }: { split: boolean; companyKey?: string }) {
  const { feed, loading } = useCanliFeed(companyKey);
  const [singleFilter, setSingleFilter] = useState<FeedFilter>('all');
  const [leftFilter, setLeftFilter] = useState<FeedFilter>('satis');
  const [rightFilter, setRightFilter] = useState<FeedFilter>('kare');

  const mekanOptions = buildMekanOptions(feed);

  if (loading && feed.length === 0) {
    return <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Yükleniyor...</div>;
  }

  const filterLabel = (f: FeedFilter): { text: string; color: string } => {
    if (f === 'all') return { text: 'Tümü', color: '#fff' };
    if (f === 'satis') return { text: 'Sadece Satışlar', color: '#a8e6cf' };
    if (f === 'kare') return { text: 'Sadece Kareler', color: '#c5a8f5' };
    if (f.startsWith('mekan:')) {
      const opt = mekanOptions.find(m => m.value === f);
      return opt ? { text: `${opt.emoji} ${opt.label}`, color: opt.color } : { text: 'Mekan', color: '#fff' };
    }
    return { text: 'Tümü', color: '#fff' };
  };

  const ColHeader = ({ filter, onChange }: { filter: FeedFilter; onChange: (v: FeedFilter) => void }) => {
    const lbl = filterLabel(filter);
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${lbl.color}30` }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: lbl.color, letterSpacing: -0.2 }}>{lbl.text}</span>
        <FeedFilterDropdown value={filter} onChange={onChange} mekanOptions={mekanOptions} />
      </div>
    );
  };

  if (!split) {
    return (
      <>
        <ColHeader filter={singleFilter} onChange={setSingleFilter} />
        <FeedList items={applyFilter(feed, singleFilter)} emptyText="Bu filtrede kayıt yok" />
      </>
    );
  }

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ColHeader filter={leftFilter} onChange={setLeftFilter} />
        <FeedList items={applyFilter(feed, leftFilter)} emptyText="Bu filtrede kayıt yok" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ColHeader filter={rightFilter} onChange={setRightFilter} />
        <FeedList items={applyFilter(feed, rightFilter)} emptyText="Bu filtrede kayıt yok" />
      </div>
    </div>
  );
}

// ─── Rotasyon ───────────────────────────────────────────────
interface Task {
  id: string;
  location: string;
  locationIcon: string;
  date: string;
  status: string;
  personnel: { id: string; name: string }[];
}

function todayTR() {
  const trMs = Date.now() + 3 * 60 * 60 * 1000;
  const trHour = new Date(trMs).getUTCHours();
  if (trHour < 7) return new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return new Date(trMs).toISOString().split('T')[0];
}

function RotasyonPanel({ aktifPersonel }: { aktifPersonel: { name: string; mekan?: string; checkinZamani?: string }[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE}/rotasyon/gorevler${ghostParams()}`, { headers });
        const data = await res.json();
        if (res.ok && !cancelled) {
          const today = todayTR();
          const filtered = (data.tasks || []).filter((t: Task) => t.date === today && t.status !== 'cancelled');
          setTasks(filtered);
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Yükleniyor...</div>;
  if (tasks.length === 0) return <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Bugün için rotasyon yok</div>;

  const byLocation: Record<string, { location: string; icon: string; personnel: { id: string; name: string }[] }> = {};
  for (const t of tasks) {
    const key = t.location;
    if (!byLocation[key]) byLocation[key] = { location: t.location, icon: t.locationIcon || '📍', personnel: [] };
    for (const p of (t.personnel || [])) {
      if (!byLocation[key].personnel.find(x => x.id === p.id)) byLocation[key].personnel.push(p);
    }
  }

  const checkedInNames = new Set((aktifPersonel || []).map(p => p.name.toLowerCase().trim()));

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, minHeight: 0 }}>
      {Object.values(byLocation).map(loc => (
        <div key={loc.location} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#fff' }}>
            <span>{loc.icon}</span>
            <span>{loc.location}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>· {loc.personnel.length} kişi</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {loc.personnel.map(p => {
              const isIn = checkedInNames.has(p.name.toLowerCase().trim());
              const info = (aktifPersonel || []).find(x => x.name.toLowerCase().trim() === p.name.toLowerCase().trim());
              const time = info?.checkinZamani ? new Date(info.checkinZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px', borderRadius: 6, fontSize: 11,
                  background: isIn ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isIn ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: isIn ? '#a8e6cf' : 'rgba(255,255,255,0.7)',
                }}>
                  {isIn && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />}
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  {isIn && <span style={{ fontSize: 9, color: 'rgba(52,211,153,0.8)' }}>içeride {time}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────
type CenterView = 'feed' | 'rotasyon';

interface PcDashboardProps {
  data: PcDashboardData | null;
  loading: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
  onLockScreen?: () => void;
  companyKey?: string;
}

// Canlı feed ref — dashboard yenile butonuna basınca feed de yenilensin
let triggerFeedRefresh: (() => void) | null = null;

export function PcDashboard({ data, loading, lastRefresh, onRefresh, onLockScreen, companyKey }: PcDashboardProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const handleRefreshAll = () => {
    onRefresh();
    if (triggerFeedRefresh) triggerFeedRefresh();
  };

  // Otomatik yenileme (15 sn) — kullanıcı toggle ile açar
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      onRefresh();
      if (triggerFeedRefresh) triggerFeedRefresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, onRefresh]);
  const [centerView, setCenterView] = useState<CenterView>('feed');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [feedSplit, setFeedSplit] = useState(false);

  const anomali = data?.anomaliSayisi ?? 0;
  const gecGiris = data?.gecGirisSayisi ?? 0;
  const viewLabel = centerView === 'feed' ? 'Canlı Feed' : 'Rotasyon Bilgileri';

  return (
    <>
      <div className="pc-dash-header">
        <div>
          <div className="pc-dash-title">Dashboard</div>
          <div className="pc-dash-sub">
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
            {lastRefresh && ` · ${lastRefresh.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onLockScreen && (
            <button
              onClick={onLockScreen}
              title="Ekranı gizle (PC başından kalkınca)"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'rgba(255,180,50,0.1)',
                border: '1px solid rgba(255,180,50,0.3)',
                borderRadius: 8, color: '#fbbf24',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <EyeOff size={12} />
              Gizle
            </button>
          )}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? 'Otomatik yenileme aktif (15sn)' : 'Otomatik yenilemeyi başlat'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: autoRefresh ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${autoRefresh ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              color: autoRefresh ? '#34d399' : 'rgba(255,255,255,0.7)',
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
            {autoRefresh ? 'Oto · 15sn' : 'Otomatik'}
            {autoRefresh && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', marginLeft: 2 }} />}
          </button>
          <button onClick={handleRefreshAll} disabled={loading} title="Sayfayı yenile"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: 'rgba(168,230,207,0.12)',
              border: '1px solid rgba(168,230,207,0.3)',
              borderRadius: 8,
              color: '#a8e6cf',
              fontSize: 12, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}>
            <RefreshCw size={13} style={loading ? { animation: 'pc-spin 0.8s linear infinite' } : undefined} />
            Yenile
          </button>
        </div>
      </div>

      {/* Üst 3 kart */}
      <div className="pc-stat-grid">
        <div className="pc-stat-card">
          <div className="pc-stat-card-row">
            <div className="pc-stat-card-icon" style={{ background: 'rgba(168,230,207,0.15)', border: '1px solid rgba(168,230,207,0.3)' }}>
              <DollarSign size={16} color="#a8e6cf" />
            </div>
            <div>
              <div className="pc-stat-card-label">Toplam Ciro</div>
              <div className="pc-stat-card-value">{loading && !data ? '—' : formatTL(data?.toplamCiro ?? 0)}</div>
            </div>
          </div>
        </div>
        <div className="pc-stat-card">
          <div className="pc-stat-card-row">
            <div className="pc-stat-card-icon" style={{ background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.3)' }}>
              <ShoppingBag size={16} color="#9dd9ea" />
            </div>
            <div>
              <div className="pc-stat-card-label">Satış Adedi</div>
              <div className="pc-stat-card-value">{loading && !data ? '—' : (data?.toplamAdet ?? 0).toLocaleString('tr-TR')}</div>
            </div>
          </div>
        </div>
        <div className="pc-stat-card">
          <div className="pc-stat-card-row">
            <div className="pc-stat-card-icon" style={{ background: 'rgba(197,168,245,0.15)', border: '1px solid rgba(197,168,245,0.3)' }}>
              <Camera size={16} color="#c5a8f5" />
            </div>
            <div>
              <div className="pc-stat-card-label">Toplam Kare</div>
              <div className="pc-stat-card-value">{loading && !data ? '—' : (data?.toplamKare ?? 0).toLocaleString('tr-TR')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Orta: Canlı Feed (dropdown'lu) + Mekan Ciro */}
      <div className="pc-middle-row">
        <div className="pc-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginBottom: 8, position: 'relative' }}>
            {centerView === 'feed' && (
              <button
                onClick={() => setFeedSplit(v => !v)}
                title={feedSplit ? 'Tek sütuna al' : '3 sütuna böl'}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: feedSplit ? 'rgba(168,230,207,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${feedSplit ? 'rgba(168,230,207,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: feedSplit ? '#a8e6cf' : 'rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                {feedSplit ? <Square size={13} /> : <Columns2 size={13} />}
              </button>
            )}
            <button
              onClick={() => setDropdownOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}
            >
              <span>{viewLabel}</span>
              <ChevronDown size={12} />
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'rgba(20, 15, 50, 0.98)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, padding: 4, zIndex: 10, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {[
                  { k: 'feed' as const, label: 'Canlı Feed' },
                  { k: 'rotasyon' as const, label: 'Rotasyon Bilgileri' },
                ].map(opt => (
                  <button
                    key={opt.k}
                    onClick={() => { setCenterView(opt.k); setDropdownOpen(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 10px',
                      background: centerView === opt.k ? 'rgba(168,230,207,0.12)' : 'transparent',
                      border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {centerView === 'feed' && <CanliFeedPanel split={feedSplit} companyKey={companyKey} />}
          {centerView === 'rotasyon' && <RotasyonPanel aktifPersonel={data?.aktifPersonelDetay ?? []} />}
        </div>

        {/* Sağ: Mekanlar — kart formatı, aktif/aktif değil ayrımlı */}
        <div className="pc-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 800, color: '#fff' }}>
            Günlük Mekan Özet Raporu <span style={{ fontSize: 10, color: '#34d399', marginLeft: 6 }}>(Canlı)</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.mekanCiroList ?? []).length === 0 ? (
              <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>mekan yok</div>
            ) : (() => {
              const all = data?.mekanCiroList ?? [];
              const aktif = all.filter(m => m.acik);
              const pasif = all.filter(m => !m.acik);
              const renderCard = (m: typeof all[0]) => (
                <div key={m.id} style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: m.acik ? (m.color + '10') : 'rgba(255,255,255,0.02)',
                  border: '1px solid ' + (m.acik ? (m.color + '30') : 'rgba(255,255,255,0.06)'),
                  borderLeft: '3px solid ' + (m.acik ? m.color : 'rgba(255,255,255,0.15)'),
                  opacity: m.acik ? 1 : 0.55,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{m.emoji}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: m.acik ? m.color : 'rgba(255,255,255,0.6)', letterSpacing: -0.2 }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{m.adet} satış</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                    {/* Sol: KARE büyük */}
                    <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 6px' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: 0.5 }}>KARE</span>
                      <span style={{ fontSize: 24, fontWeight: 900, color: (m.kare || 0) > 0 ? '#c5a8f5' : 'rgba(255,255,255,0.35)', lineHeight: 1.1 }}>
                        {(m.kare || 0).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    {/* Dikey ayırıcı */}
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 8px' }} />
                    {/* Sağ: CİRO + İSKONTO */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>CİRO</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#a8e6cf' }}>{formatTL(m.ciro)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>İSKONTO</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: (m.iskonto || 0) > 0 ? '#ffd4a3' : 'rgba(255,255,255,0.35)' }}>
                          {(m.iskonto || 0) > 0 ? `-${formatTL(m.iskonto || 0)}` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
              return (
                <>
                  {aktif.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 4px', fontSize: 9, fontWeight: 800, color: '#34d399', letterSpacing: 1 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                      AKTİF
                      <span style={{ flex: 1, height: 1, background: 'rgba(52,211,153,0.2)' }} />
                    </div>
                  )}
                  {aktif.map(renderCard)}
                  {pasif.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px 4px', fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>
                      AKTİF DEĞİL
                      <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    </div>
                  )}
                  {pasif.map(renderCard)}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Alt: sadece 3 mini kart (Mekan Ciro yukarı taşındı) */}
      <div className="pc-mini-row pc-mini-row-3col">
        <div className="pc-mini-card" style={{ borderColor: 'rgba(168,230,207,0.25)' }}>
          <div className="pc-mini-card-label"><MapPin size={12} color="#a8e6cf" /> Aktif Mekan</div>
          <div className="pc-mini-card-value" style={{ color: '#a8e6cf' }}>
            {data?.aktifMekanSayisi ?? 0} <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>/ {data?.toplamMekanSayisi ?? 0}</span>
          </div>
        </div>
        <div className="pc-mini-card" style={{ borderColor: anomali > 0 ? 'rgba(248,113,113,0.3)' : undefined }}>
          <div className="pc-mini-card-label"><AlertTriangle size={12} color={anomali > 0 ? '#f87171' : 'rgba(255,255,255,0.5)'} /> Anomali</div>
          <div className="pc-mini-card-value" style={{ color: anomali > 0 ? '#f87171' : '#fff' }}>{anomali}</div>
          <div className="pc-mini-card-hint">{anomali > 0 ? 'dikkat' : 'yok'}</div>
        </div>
        <div className="pc-mini-card" style={{ borderColor: gecGiris > 0 ? 'rgba(255,180,50,0.3)' : undefined }}>
          <div className="pc-mini-card-label"><Clock size={12} color={gecGiris > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)'} /> Geç Giriş</div>
          <div className="pc-mini-card-value" style={{ color: gecGiris > 0 ? '#fbbf24' : '#fff' }}>{gecGiris}</div>
          <div className="pc-mini-card-hint">{gecGiris > 0 ? 'bugün' : 'yok'}</div>
        </div>
      </div>
    </>
  );
}
