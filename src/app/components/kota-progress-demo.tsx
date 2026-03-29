import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Camera, Clock, ChevronLeft, Check, Zap, Trophy, Info } from 'lucide-react';

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};

function formatTL(val: number): string {
  if (val >= 1_000_000) return `₺${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `₺${(val / 1_000).toFixed(0)}B`;
  return `₺${val.toLocaleString('tr-TR')}`;
}

// ── Kota kademeleri tanımı ──
interface KotaKademe {
  hedef: number;      // ₺ hedef
  label: string;      // "1. Kademe"
  primTek: number;    // 1 kişi primi
  primCoklu: number;  // çoklu kişi primi
  color: string;      // kademe rengi
  glow: string;
  emoji: string;
}

const KADEMELER: KotaKademe[] = [
  { hedef: 10_000, label: '1. Kademe', primTek: 500,   primCoklu: 300,  color: '#60a5fa', glow: 'rgba(96,165,250,',  emoji: '🥉' },
  { hedef: 20_000, label: '2. Kademe', primTek: 1_000, primCoklu: 600,  color: '#a855f7', glow: 'rgba(168,85,247,',  emoji: '🥈' },
  { hedef: 30_000, label: '3. Kademe', primTek: 2_000, primCoklu: 1_200, color: '#fbbf24', glow: 'rgba(251,191,36,', emoji: '🥇' },
];

const MAX_KOTA = KADEMELER[KADEMELER.length - 1].hedef;

// ── Çok kademeli progress bar ──
function MultiTierBar({ ciro, compact = false }: { ciro: number; compact?: boolean }) {
  const barWidth = Math.min(ciro / MAX_KOTA, 1.08); // max biraz aşabilir

  // Her kademe için durum hesapla
  const kademeDurumlari = KADEMELER.map(k => ({
    ...k,
    pos: k.hedef / MAX_KOTA,           // bar üzerindeki konumu (0-1)
    achieved: ciro >= k.hedef,
    pct: Math.min(ciro / k.hedef, 1),
  }));

  // Mevcut aktif kademe rengi (hangi bölgedeyiz)
  const aktifKademe = [...kademeDurumlari].reverse().find(k => ciro >= k.hedef * 0.5);
  const barColor = ciro >= MAX_KOTA ? '#fbbf24'
    : ciro >= KADEMELER[1].hedef * 0.5 ? '#a855f7'
    : ciro >= KADEMELER[0].hedef * 0.5 ? '#60a5fa'
    : '#f87171';

  return (
    <div style={{ marginTop: compact ? 6 : 12 }}>
      {/* Bar wrapper */}
      <div style={{ position: 'relative' }}>
        {/* Checkpoint etiketleri (üstte) — sadece full modda */}
        {!compact && (
          <div style={{ display: 'flex', marginBottom: 6 }}>
            {kademeDurumlari.map((k) => (
              <div
                key={k.hedef}
                style={{
                  position: 'absolute',
                  left: `${k.pos * 100}%`,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  color: k.achieved ? k.color : 'rgba(255,255,255,0.3)',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.4s ease',
                }}>
                  {formatTL(k.hedef)}
                </span>
              </div>
            ))}
            <div style={{ height: 14 }} /> {/* spacer */}
          </div>
        )}

        {/* Ana bar */}
        <div style={{
          height: compact ? 4 : 7,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'visible',
        }}>
          {/* Dolu kısım */}
          <motion.div
            animate={{ width: `${Math.min(barWidth * 100, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              height: '100%',
              borderRadius: 99,
              background: ciro >= MAX_KOTA
                ? 'linear-gradient(90deg, #60a5fa, #a855f7, #fbbf24)'
                : ciro >= KADEMELER[1].hedef
                ? 'linear-gradient(90deg, #60a5fa, #a855f7)'
                : barColor,
              boxShadow: `0 0 10px ${barColor}80`,
              transition: 'background 0.5s ease, box-shadow 0.5s ease',
            }}
          />

          {/* Checkpoint noktaları */}
          {kademeDurumlari.map((k) => (
            <div
              key={k.hedef}
              style={{
                position: 'absolute',
                top: '50%',
                left: `${k.pos * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: compact ? 8 : 14,
                height: compact ? 8 : 14,
                borderRadius: '50%',
                background: k.achieved ? k.color : 'rgba(255,255,255,0.12)',
                border: k.achieved ? `2px solid ${k.color}` : '2px solid rgba(255,255,255,0.2)',
                boxShadow: k.achieved ? `0 0 10px ${k.glow}0.7), 0 0 20px ${k.glow}0.3)` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.4s ease',
                zIndex: 2,
              }}
            >
              {!compact && k.achieved && (
                <Check style={{ width: 7, height: 7, color: 'white', strokeWidth: 3 }} />
              )}
              {!compact && !k.achieved && (
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Kademe etiketleri (altta) — sadece full modda */}
        {!compact && (
          <div style={{ position: 'relative', height: 20, marginTop: 4 }}>
            {kademeDurumlari.map((k) => (
              <div
                key={k.hedef}
                style={{
                  position: 'absolute',
                  left: `${k.pos * 100}%`,
                  transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 8, color: k.achieved ? k.color : 'rgba(255,255,255,0.25)', fontWeight: 700, transition: 'color 0.4s ease' }}>
                  {k.achieved ? '✓' : k.emoji}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compact mod için kısa bilgi */}
      {compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          {kademeDurumlari.map((k) => (
            <span key={k.hedef} style={{
              fontSize: 8, fontWeight: 700,
              color: k.achieved ? k.color : 'rgba(255,255,255,0.2)',
              transition: 'color 0.4s ease',
            }}>
              {k.achieved ? `✓${formatTL(k.hedef)}` : formatTL(k.hedef)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Prim rozet kartları ──
function PrimBadges({ ciro, personelSayisi }: { ciro: number; personelSayisi: number }) {
  const coklu = personelSayisi > 1;
  const kazanilanlar = KADEMELER.filter(k => ciro >= k.hedef);

  if (kazanilanlar.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginTop: 10 }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {kazanilanlar.map((k) => (
            <motion.div
              key={k.hedef}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 10,
                background: `${k.glow}0.12)`,
                border: `1px solid ${k.glow}0.4)`,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 14 }}>{k.emoji}</div>
              <div style={{ color: k.color, fontSize: 8, fontWeight: 800, marginTop: 2 }}>{k.label}</div>
              <div style={{ color: 'white', fontSize: 11, fontWeight: 900 }}>
                {formatTL(coklu ? k.primCoklu : k.primTek)}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8 }}>
                {coklu ? 'kişi başı' : 'tek kişi'}
              </div>
            </motion.div>
          ))}
          {/* Henüz kazanılmamış kademeler (silik) */}
          {KADEMELER.filter(k => ciro < k.hedef).map((k) => (
            <div
              key={k.hedef}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                textAlign: 'center', opacity: 0.5,
              }}
            >
              <div style={{ fontSize: 14, filter: 'grayscale(1)' }}>{k.emoji}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: 800, marginTop: 2 }}>{k.label}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 900 }}>{formatTL(k.hedef)}</div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8 }}>hedef</div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Açık Vardiyalar'daki gerçek kart önizlemesi (D varyantı) ──
function AcikVardiyaKartD({ ciro }: { ciro: number }) {
  const enYuksekKademe = [...KADEMELER].reverse().find(k => ciro >= k.hedef);
  const sonrakiKademe = KADEMELER.find(k => ciro < k.hedef);

  // D varyantı: arka plan rengi + border glow
  let cardBg = 'rgba(255,255,255,0.04)';
  let cardBorder = '1px solid rgba(255,255,255,0.08)';
  let cardShadow = 'none';

  if (enYuksekKademe) {
    const g = enYuksekKademe.glow;
    cardBg = `${g}0.07)`;
    cardBorder = `1px solid ${g}0.5)`;
    cardShadow = `0 0 16px ${g}0.25), 0 0 32px ${g}0.10)`;
  } else if (sonrakiKademe) {
    const pct = ciro / sonrakiKademe.hedef;
    if (pct > 0.5) {
      cardBg = 'rgba(96,165,250,0.04)';
      cardBorder = '1px solid rgba(96,165,250,0.2)';
    }
  }

  return (
    <div
      style={{
        borderRadius: 14,
        background: cardBg,
        border: cardBorder,
        boxShadow: cardShadow,
        overflow: 'hidden',
        padding: '10px 12px',
        transition: 'all 0.5s ease',
        position: 'relative',
      }}
    >
      {/* Prim rozeti — en yüksek kazanılan kademe */}
      {enYuksekKademe && (
        <motion.div
          key={enYuksekKademe.hedef}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            position: 'absolute', top: 7, right: 7,
            background: `${enYuksekKademe.glow}0.2)`,
            border: `1px solid ${enYuksekKademe.glow}0.5)`,
            borderRadius: 8, padding: '2px 7px',
            display: 'flex', alignItems: 'center', gap: 3,
          }}
        >
          <Zap className="w-2.5 h-2.5" style={{ color: enYuksekKademe.color }} />
          <span style={{ color: enYuksekKademe.color, fontSize: 9, fontWeight: 800 }}>
            {enYuksekKademe.emoji} PRİM!
          </span>
        </motion.div>
      )}

      {/* Kart satırı */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'rgba(157,217,234,0.15)',
          border: '1px solid rgba(157,217,234,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>🐟</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'white', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Balık Hali</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
              <ShoppingBag className="w-2.5 h-2.5" />12 ürün
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Camera className="w-2.5 h-2.5" />48 kare
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock className="w-2.5 h-2.5" />09:15
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ color: '#34d399', fontSize: 13, fontWeight: 900 }}>{formatTL(ciro)}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399' }} className="animate-pulse" />
            <span style={{ color: 'rgba(52,211,153,0.6)', fontSize: 10 }}>Açık</span>
          </div>
        </div>
      </div>

      {/* Çok kademeli progress bar (compact) */}
      <MultiTierBar ciro={ciro} compact={true} />
    </div>
  );
}

interface KotaProgressDemoProps {
  onBack: () => void;
}

export function KotaProgressDemo({ onBack }: KotaProgressDemoProps) {
  const [ciro, setCiro] = useState(6000);
  const [personelSayisi, setPersonelSayisi] = useState(1);

  const sonrakiKademe = KADEMELER.find(k => ciro < k.hedef);
  const enYuksekKademe = [...KADEMELER].reverse().find(k => ciro >= k.hedef);
  const kazanilanSayisi = KADEMELER.filter(k => ciro >= k.hedef).length;

  return (
    <div className="min-h-screen pb-32" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      <div className="px-4 pt-4 space-y-4">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button
            onClick={onBack}
            style={{ ...glass, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ChevronLeft className="w-4 h-4 text-white/60" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white">Çok Kademeli Kota</h1>
            <p className="text-xs" style={{ color: 'rgba(196,181,253,0.5)' }}>Slider ile kademeleri geç ve görüntüle</p>
          </div>
        </motion.div>

        {/* ── %120 açıklaması ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          style={{
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 14, padding: '10px 14px',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}
        >
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 1.5 }}>
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>Önceki demoda %120 neydi? </span>
            Sadece "kota aşıldı" halini göstermek içindi. Gerçekte ciro ne kadar giderse gitsin bar 3. kademe dolunca tamamdır — üzerine çıkabilir, progress bar bunu göstermez. Yeni sistemde zaten üst sınır yok, kademeler aşıldıkça prim birikir.
          </p>
        </motion.div>

        {/* ── Slider & Kontroller ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          style={{ ...glass, padding: 18 }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-white">Ciro Simülasyonu</p>
            <motion.div
              key={enYuksekKademe?.label ?? 'none'}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                background: enYuksekKademe ? `${enYuksekKademe.glow}0.15)` : 'rgba(255,255,255,0.08)',
                border: `1px solid ${enYuksekKademe ? `${enYuksekKademe.glow}0.4)` : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 12, padding: '5px 12px',
                color: enYuksekKademe ? enYuksekKademe.color : 'rgba(255,255,255,0.5)',
                fontSize: 15, fontWeight: 900,
                transition: 'all 0.4s ease',
              }}
            >
              {formatTL(ciro)}
            </motion.div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={35000}
            step={500}
            value={ciro}
            onChange={e => setCiro(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: enYuksekKademe?.color ?? '#60a5fa',
              cursor: 'pointer',
            }}
          />

          {/* Kademe işaretleri altında */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>₺0</span>
            {KADEMELER.map(k => (
              <span key={k.hedef} style={{
                color: ciro >= k.hedef ? k.color : 'rgba(255,255,255,0.25)',
                fontSize: 9, fontWeight: 700, transition: 'color 0.3s',
              }}>
                {formatTL(k.hedef)}
              </span>
            ))}
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>₺35B+</span>
          </div>

          {/* Personel sayısı toggle */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8 }}>Mekan personel sayısı (primi etkiler):</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setPersonelSayisi(n)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 10, fontSize: 12, fontWeight: 800,
                    background: personelSayisi === n ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.05)',
                    border: personelSayisi === n ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    color: personelSayisi === n ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {n} kişi
                </button>
              ))}
            </div>
            {personelSayisi > 1 && (
              <p style={{ color: 'rgba(255,200,100,0.6)', fontSize: 10, marginTop: 6 }}>
                ⚠️ Çoklu kişi → prim miktarı düşük ama herkes alır
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Büyük Multi-tier Bar Görünümü ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ ...glass, padding: 18 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4" style={{ color: '#fbbf24' }} />
            <p className="text-sm font-bold text-white">Kota Kademeleri</p>
            {kazanilanSayisi > 0 && (
              <motion.span
                key={kazanilanSayisi}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 99,
                  background: 'rgba(52,211,153,0.15)',
                  border: '1px solid rgba(52,211,153,0.3)',
                  color: '#34d399', fontWeight: 800,
                }}
              >
                {kazanilanSayisi} kademe aşıldı
              </motion.span>
            )}
          </div>

          {/* Büyük bar */}
          <MultiTierBar ciro={ciro} compact={false} />

          {/* Sonraki hedef bilgisi */}
          <div style={{ marginTop: 14 }}>
            {sonrakiKademe ? (
              <div style={{
                padding: '10px 12px', borderRadius: 12,
                background: `${sonrakiKademe.glow}0.08)`,
                border: `1px solid ${sonrakiKademe.glow}0.2)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                    {sonrakiKademe.label} için
                  </span>
                  <span style={{ color: sonrakiKademe.color, fontSize: 11, fontWeight: 800 }}>
                    {formatTL(sonrakiKademe.hedef - ciro)} daha
                  </span>
                </div>
                <div style={{ marginTop: 6, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${Math.min((ciro / sonrakiKademe.hedef) * 100, 100)}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ height: '100%', background: sonrakiKademe.color, borderRadius: 99 }}
                  />
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4 }}>
                  Prim: {formatTL(personelSayisi > 1 ? sonrakiKademe.primCoklu : sonrakiKademe.primTek)} / kişi
                </p>
              </div>
            ) : (
              <div style={{
                padding: '10px 12px', borderRadius: 12,
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.3)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 18 }}>🏆</span>
                <div>
                  <p style={{ color: '#fbbf24', fontSize: 12, fontWeight: 800 }}>Tüm kotalar aşıldı!</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Maksimum prim seviyesine ulaşıldı</p>
                </div>
              </div>
            )}
          </div>

          {/* Prim badge'leri */}
          <PrimBadges ciro={ciro} personelSayisi={personelSayisi} />
        </motion.div>

        {/* ── Açık Vardiyalar'daki gerçek görünüm (D varyantı) ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ ...glass, padding: 16 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-sm font-bold text-white">Canlı Durum kartında görünüm</p>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 10 }}>
            Dashboard → "Açık Vardiyalar" alanındaki kart tam böyle görünecek (D varyantı):
          </p>
          <AcikVardiyaKartD ciro={ciro} />
        </motion.div>

        {/* ── Kademe tablosu ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ ...glass, padding: 16 }}
        >
          <p className="text-sm font-bold text-white mb-3">Prim Tablosu</p>
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '8px 12px', background: 'rgba(255,255,255,0.06)', gap: 4 }}>
              {['Kademe', 'Hedef', '1 Kişi', 'Çoklu'].map(h => (
                <span key={h} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</span>
              ))}
            </div>
            {KADEMELER.map((k, i) => {
              const achieved = ciro >= k.hedef;
              return (
                <div
                  key={k.hedef}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    padding: '10px 12px', gap: 4,
                    background: achieved ? `${k.glow}0.08)` : 'transparent',
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    transition: 'background 0.4s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>{k.emoji}</span>
                    <span style={{ color: achieved ? k.color : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }}>{k.label}</span>
                  </div>
                  <span style={{ color: achieved ? k.color : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 800 }}>{formatTL(k.hedef)}</span>
                  <span style={{ color: achieved ? '#34d399' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: achieved ? 800 : 400 }}>{formatTL(k.primTek)}</span>
                  <span style={{ color: achieved ? '#60a5fa' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: achieved ? 800 : 400 }}>{formatTL(k.primCoklu)}</span>
                </div>
              );
            })}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, marginTop: 8 }}>
            * Çoklu: mekanda birden fazla personel varsa kişi başı prim
          </p>
        </motion.div>

      </div>
    </div>
  );
}
