import { useState } from 'react';
import { SlidersHorizontal, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { FiltreProps } from './types';

export function FiltrePaneli({
  filtreMekan, setFiltreMekan,
  filtreTarihBas, setFiltreTarihBas,
  filtreTarihBit, setFiltreTarihBit,
  mekanlar, onReset, onAra,
}: FiltreProps) {
  const [acik, setAcik] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '7px 10px', fontSize: 12, color: 'rgba(255,255,255,0.85)', outline: 'none',
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
      <button onClick={() => setAcik(!acik)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span className="text-white/70 font-semibold" style={{ fontSize: 12 }}>Filtre & Tarih Aralığı</span>
        </div>
        {acik ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>

      <AnimatePresence>
        {acik && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-white/40 mb-1" style={{ fontSize: 10 }}>Başlangıç</p>
                  <input type="date" value={filtreTarihBas} onChange={e => setFiltreTarihBas(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <p className="text-white/40 mb-1" style={{ fontSize: 10 }}>Bitiş</p>
                  <input type="date" value={filtreTarihBit} onChange={e => setFiltreTarihBit(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <p className="text-white/40 mb-1" style={{ fontSize: 10 }}>Mekan</p>
                <select value={filtreMekan} onChange={e => setFiltreMekan(e.target.value)} style={inputStyle}>
                  <option value="">Tüm Mekanlar</option>
                  {mekanlar.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onAra}
                  className="flex-1 py-2 rounded-xl text-white font-bold"
                  style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.4)', fontSize: 12 }}
                >
                  Ara
                </button>
                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-3 text-white/40 hover:text-white/60 transition-colors"
                  style={{ fontSize: 11 }}
                >
                  <RefreshCw className="w-3 h-3" /> Sıfırla
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
