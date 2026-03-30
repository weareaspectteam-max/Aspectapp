import { Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { VardiyaKayit, FiltreProps } from '../types';
import { FiltrePaneli } from '../filtre-paneli';
import { OzetKart } from '../ozet-kart';
import { VardiyaDetay } from '../vardiya-detay';

interface VardiyaTabProps extends FiltreProps {
  raporlar: VardiyaKayit[];
  loading: boolean;
  error: string | null;
  secili: VardiyaKayit | null;
  setSeciliId: (id: string | null) => void;
  canDelete: boolean;
  setSilOnayV: (v: VardiyaKayit | null) => void;
  fetchOncekiGun: () => void;
  enEskiTarih: string;
}

export function VardiyaTab({
  raporlar, loading, error, secili, setSeciliId,
  canDelete, setSilOnayV, fetchOncekiGun, enEskiTarih,
  ...filtreProps
}: VardiyaTabProps) {
  return (
    <div className="px-4 pb-8">
      <AnimatePresence mode="wait">
        {/* Liste */}
        {!secili && (
          <motion.div key="liste" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            <FiltrePaneli {...filtreProps} />

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Vardiyalar yükleniyor…</p>
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <p style={{ fontSize: 13, color: '#f87171', fontWeight: 600, textAlign: 'center' }}>{error}</p>
                <button
                  onClick={filtreProps.onAra}
                  className="px-4 py-2 rounded-xl text-white/70 text-sm"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Tekrar Dene
                </button>
              </div>
            )}

            {!loading && !error && raporlar.length === 0 && (
              <div className="text-center py-16">
                <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Bu tarih aralığında kapanmış vardiya bulunamadı.</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Tarih aralığını genişletmeyi deneyin.</p>
              </div>
            )}

            {!loading && !error && raporlar.map(v => (
              <OzetKart
                key={v.id}
                v={v}
                onClick={() => setSeciliId(v.id)}
                canDelete={canDelete}
                onSilTalep={setSilOnayV}
              />
            ))}

            {/* Önceki Gün */}
            {!loading && !error && raporlar.length >= 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={fetchOncekiGun}
                disabled={loading}
                className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 mt-1"
                style={{
                  background: 'rgba(167,139,250,0.08)',
                  border: '1px solid rgba(167,139,250,0.2)',
                }}
              >
                <ChevronDown style={{ width: 14, height: 14, color: '#a78bfa' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>
                  Önceki Gün
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>
                  ({(() => { const d = new Date(enEskiTarih + 'T00:00:00'); d.setDate(d.getDate() - 1); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; })()})
                </span>
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Detay */}
        {secili && (
          <motion.div key={secili.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22 }}>
            <VardiyaDetay v={secili} onBack={() => setSeciliId(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
