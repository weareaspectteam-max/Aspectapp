import { Trash2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { VardiyaKayit } from './types';
import { formatTarih, tl } from './helpers';

export function SilmeOnayDialog({
  v, yukleniyor, onOnayla, onIptal,
}: {
  v: VardiyaKayit;
  yukleniyor: boolean;
  onOnayla: () => void;
  onIptal: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onIptal(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(30,15,50,0.97)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 20, padding: '20px 20px 24px',
        }}
      >
        {/* İkon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
            <Trash2 className="w-5 h-5" style={{ color: '#f87171' }} />
          </div>
          <div>
            <p className="text-white font-black" style={{ fontSize: 15 }}>Vardiyayı Sil</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Bu işlem geri alınamaz</p>
          </div>
        </div>

        {/* Kart önizleme */}
        <div className="flex items-center gap-2.5 mb-4 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 22 }}>{v.mekanEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate" style={{ fontSize: 13 }}>{v.mekan}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              {formatTarih(v.tarih)} · {v.acilisSaat}–{v.kapanisSaat}
            </p>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>{tl(v.toplamCiro)}</span>
        </div>

        {/* Uyarı metni */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 18 }}>
          Bu vardiyaya ait tüm satış, stok, kare ve yazıcı verileri kalıcı olarak silinecektir. Tüm raporlardan düşer.
        </p>

        {/* Butonlar */}
        <div className="flex gap-2">
          <button
            onClick={onIptal}
            disabled={yukleniyor}
            className="flex-1 py-3 rounded-2xl text-white/60 font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13 }}
          >
            İptal
          </button>
          <button
            onClick={onOnayla}
            disabled={yukleniyor}
            className="flex-1 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2"
            style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', fontSize: 13 }}
          >
            {yukleniyor
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Trash2 className="w-4 h-4" /> Evet, Sil</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
