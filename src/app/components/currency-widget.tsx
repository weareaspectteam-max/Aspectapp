import { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/** Retry yardımcısı — TypeError (network) hatalarında tekrar dener */
async function fetchWithRetry(
  input: string,
  init: RequestInit,
  retries = 3,
  delayMs = 800,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(input, init);
    } catch (err: any) {
      lastErr = err;
      if (err?.name === 'AbortError') throw err;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export function CurrencyWidget() {
  const [exchangeRates, setExchangeRates] = useState<{ USD: number; EUR: number; GBP: number } | null>(null);
  const [trend, setTrend] = useState<{ USD: number; EUR: number; GBP: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>('');
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'GBP' | null>(null);
  const [tryAmount, setTryAmount] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    loadRates(false, controller.signal);
    const interval = setInterval(() => loadRates(true, controller.signal), 10 * 60 * 1000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const loadRates = async (silent = false, externalSignal?: AbortSignal) => {
    if (!silent) setLoading(true);
    try {
      const headers = await authHeaders();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);

      // Eğer dışarıdan bir signal varsa (unmount), onu dinle
      const signal = externalSignal
        ? (() => {
            const merged = new AbortController();
            externalSignal.addEventListener('abort', () => merged.abort());
            controller.signal.addEventListener('abort', () => merged.abort());
            return merged.signal;
          })()
        : controller.signal;

      let res: Response;
      try {
        res = await fetchWithRetry(`${SERVER_URL}/doviz/canli`, { headers, signal });
      } finally {
        clearTimeout(timer);
      }
      if (res.ok) {
        const data = await res.json();
        if (data.rates) {
          setExchangeRates({ USD: Number(data.rates.USD), EUR: Number(data.rates.EUR), GBP: Number(data.rates.GBP) });
          setTrend(data.trend ?? null);
          setSource(data.source || 'live');
          setFetchedAt(data.fetchedAt || Date.now());
        }
      } else {
        console.error('CurrencyWidget fetch failed:', res.status);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // Beklenen iptal — hata loglamaya gerek yok
      console.error('CurrencyWidget load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateForeignCurrency = () => {
    if (!selectedCurrency || !tryAmount || !exchangeRates) return '0.00';
    const amount = parseFloat(tryAmount) || 0;
    return (amount / exchangeRates[selectedCurrency]).toFixed(2);
  };

  const lastUpdateLabel = () => {
    if (!fetchedAt) return '';
    const diff = Math.floor((Date.now() - fetchedAt) / 60000);
    if (diff < 1) return 'az önce';
    if (diff < 60) return `${diff} dk önce`;
    return `${Math.floor(diff / 60)} sa önce`;
  };

  const trendLabel = (code: 'USD' | 'EUR' | 'GBP') => {
    if (!trend) return null;
    const val = trend[code];
    if (val === 0 || isNaN(val)) return null;
    const up = val > 0;
    const abs = Math.abs(val);
    const text = abs < 0.01 ? '<0.01%' : `${abs.toFixed(2)}%`;
    return { up, text };
  };

  const CURRENCIES = [
    { code: 'USD' as const, flag: '🇺🇸', color: '#a8e6cf', ring: 'ring-[#a8e6cf]', bg: 'bg-[#a8e6cf]/10' },
    { code: 'EUR' as const, flag: '🇪🇺', color: '#9dd9ea', ring: 'ring-[#9dd9ea]', bg: 'bg-[#9dd9ea]/10' },
    { code: 'GBP' as const, flag: '🇬🇧', color: '#ffd4a3', ring: 'ring-[#ffd4a3]', bg: 'bg-[#ffd4a3]/10' },
  ];

  return (
    <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl p-3 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">💱</span>
          <h3 className="text-xs font-bold text-white">Güncel Kurlar & Çevirici</h3>
        </div>
        <div className="flex items-center gap-2">
          {fetchedAt && (
            <span className="text-[9px] text-white/30">{lastUpdateLabel()}</span>
          )}
          <button onClick={() => loadRates(false)} disabled={loading} className="w-5 h-5 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors active:scale-90">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : source === 'live' ? 'bg-[#a8e6cf] animate-pulse' : 'bg-[#a8e6cf]'}`} />
            <span className="text-[10px] text-gray-400">{loading ? 'Yükleniyor' : source === 'live' ? 'Canlı' : source === 'cache' ? 'Önbellek' : 'Manuel'}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="w-5 h-5 text-[#a8e6cf] animate-spin" />
        </div>
      ) : exchangeRates ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {CURRENCIES.map(c => {
              const t = trendLabel(c.code);
              const isSelected = selectedCurrency === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => setSelectedCurrency(isSelected ? null : c.code)}
                  className={`bg-white/5 rounded-lg p-2 text-center transition-all active:scale-95 ${isSelected ? `ring-2 ${c.ring} ${c.bg}` : 'hover:bg-white/10'}`}
                >
                  <div className="text-[10px] text-gray-400 mb-0.5 flex items-center justify-center gap-1">
                    <span>{c.flag}</span><span>{c.code}</span>
                  </div>
                  <div className="text-sm font-bold" style={{ color: c.color }}>
                    ₺{exchangeRates[c.code].toFixed(2)}
                  </div>
                  {t ? (
                    <div className={`text-[9px] flex items-center justify-center gap-0.5 mt-0.5 font-semibold ${t.up ? 'text-[#a8e6cf]' : 'text-[#ffb3ba]'}`}>
                      <span>{t.up ? '↑' : '↓'}</span>
                      <span>{t.text}</span>
                    </div>
                  ) : (
                    <div className="text-[9px] text-white/20 mt-0.5">1 {c.code}</div>
                  )}
                </button>
              );
            })}
          </div>

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
          <button onClick={() => loadRates(false)} className="text-[10px] text-[#a8e6cf] underline mt-1">Tekrar dene</button>
        </div>
      )}
    </div>
  );
}