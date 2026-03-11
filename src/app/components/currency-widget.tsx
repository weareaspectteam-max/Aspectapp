import { useState, useEffect } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

export function CurrencyWidget() {
  const [exchangeRates, setExchangeRates] = useState<{ USD: number; EUR: number; GBP: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'GBP' | null>(null);
  const [tryAmount, setTryAmount] = useState('');

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER_URL}/maliyetler`, { headers });
      if (res.ok) {
        const data = await res.json();
        const r = data.exchangeRates;
        if (r && r.EUR && r.USD && r.GBP) {
          setExchangeRates({ USD: Number(r.USD), EUR: Number(r.EUR), GBP: Number(r.GBP) });
        }
      }
    } catch (err) {
      console.error('CurrencyWidget load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateForeignCurrency = () => {
    if (!selectedCurrency || !tryAmount || !exchangeRates) return '0.00';
    const amount = parseFloat(tryAmount) || 0;
    const rate = exchangeRates[selectedCurrency];
    return (amount / rate).toFixed(2);
  };

  return (
    <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl p-3 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">💱</span>
          <h3 className="text-xs font-bold text-white">Güncel Kurlar & Çevirici</h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#a8e6cf]">
          <div className="w-1.5 h-1.5 bg-[#a8e6cf] rounded-full animate-pulse"></div>
          <span className="text-[10px]">{loading ? 'Yükleniyor' : 'Canlı'}</span>
        </div>
      </div>

      {/* Currency Rates */}
      {loading ? (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="w-5 h-5 text-[#a8e6cf] animate-spin" />
        </div>
      ) : exchangeRates ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {/* Dollar */}
            <button
              onClick={() => setSelectedCurrency(selectedCurrency === 'USD' ? null : 'USD')}
              className={`bg-white/5 rounded-lg p-2 text-center transition-all active:scale-95 ${
                selectedCurrency === 'USD' ? 'ring-2 ring-[#a8e6cf] bg-[#a8e6cf]/10' : 'hover:bg-white/10'
              }`}
            >
              <div className="text-[10px] text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                <span>🇺🇸</span><span>USD</span>
              </div>
              <div className="text-sm font-bold text-[#a8e6cf]">₺{exchangeRates.USD.toFixed(2)}</div>
              <div className="text-[10px] text-[#a8e6cf] flex items-center justify-center gap-0.5 mt-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>Maliyetler</span>
              </div>
            </button>

            {/* Euro */}
            <button
              onClick={() => setSelectedCurrency(selectedCurrency === 'EUR' ? null : 'EUR')}
              className={`bg-white/5 rounded-lg p-2 text-center transition-all active:scale-95 ${
                selectedCurrency === 'EUR' ? 'ring-2 ring-[#9dd9ea] bg-[#9dd9ea]/10' : 'hover:bg-white/10'
              }`}
            >
              <div className="text-[10px] text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                <span>🇪🇺</span><span>EUR</span>
              </div>
              <div className="text-sm font-bold text-[#9dd9ea]">₺{exchangeRates.EUR.toFixed(2)}</div>
              <div className="text-[10px] text-[#a8e6cf] flex items-center justify-center gap-0.5 mt-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>Maliyetler</span>
              </div>
            </button>

            {/* Pound */}
            <button
              onClick={() => setSelectedCurrency(selectedCurrency === 'GBP' ? null : 'GBP')}
              className={`bg-white/5 rounded-lg p-2 text-center transition-all active:scale-95 ${
                selectedCurrency === 'GBP' ? 'ring-2 ring-[#ffd4a3] bg-[#ffd4a3]/10' : 'hover:bg-white/10'
              }`}
            >
              <div className="text-[10px] text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                <span>🇬🇧</span><span>GBP</span>
              </div>
              <div className="text-sm font-bold text-[#ffd4a3]">₺{exchangeRates.GBP.toFixed(2)}</div>
              <div className="text-[10px] text-[#a8e6cf] flex items-center justify-center gap-0.5 mt-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>Maliyetler</span>
              </div>
            </button>
          </div>

          {/* Currency Converter */}
          {selectedCurrency && (
            <div className="space-y-2 border-t border-white/10 pt-3 mt-3 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🔄</span>
                <span className="text-[10px] font-semibold text-white">Para Çevirici</span>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="number"
                    value={tryAmount}
                    onChange={(e) => setTryAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#a8e6cf] transition-all pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₺</div>
                </div>
                <div className="flex justify-center">
                  <div className="text-gray-500 text-xs">↓</div>
                </div>
                <div className="relative">
                  <div className="w-full px-3 py-2 bg-gradient-to-br from-[#a8e6cf]/20 to-[#9dd9ea]/20 border border-[#a8e6cf]/30 rounded-lg">
                    <div className="text-lg font-bold text-white">{calculateForeignCurrency()}</div>
                  </div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a8e6cf]">
                    {selectedCurrency}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-gray-500 text-center">
                1 {selectedCurrency} = ₺{exchangeRates[selectedCurrency].toFixed(2)}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-3">
          <p className="text-[10px] text-gray-500">Kurlar yüklenemedi</p>
          <button onClick={loadRates} className="text-[10px] text-[#a8e6cf] underline mt-1">Tekrar dene</button>
        </div>
      )}
    </div>
  );
}
