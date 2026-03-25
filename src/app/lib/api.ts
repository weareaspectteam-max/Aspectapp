/**
 * Merkezi API yardımcıları
 *
 * İki header stratejisi:
 *   Authorization: Bearer <publicAnonKey>  → Supabase gateway HS256 doğrulaması
 *   X-Access-Token: <userJWT>              → Sunucu tarafında ES256 getUser() doğrulaması
 *
 * Bu ikisi birbirinin yerine GEÇMEZ:
 *   - Gateway yalnızca Authorization'a bakar
 *   - verifyToken() yalnızca X-Access-Token'a bakar
 */

import { supabase } from './supabase';
import { publicAnonKey } from './supabase-info';

/**
 * Modül-düzeyinde token cache.
 * App.tsx her token değişikliğinde setAuthToken() ile günceller.
 */
let _cachedToken = '';

/**
 * Superadmin ghost modu için aktif şirket.
 * null = kendi şirketi (ghost mod kapalı).
 * App.tsx her ghost geçişinde setGhostCompanyId() ile günceller.
 */
let _ghostCompanyId: string | null = null;

export const setGhostCompanyId = (id: string | null) => {
  _ghostCompanyId = id;
};

export const getGhostCompanyId = () => _ghostCompanyId;

/**
 * Ghost modda aktif şirketin query string parametresini döndürür.
 * Ghost mod aktif değilse boş string döner.
 * Kullanım: fetch(`${API_BASE}/endpoint${ghostParams()}`, { headers })
 * Ekstra parametre de birleştirilebilir: ghostParams({ date: '2024-01-01' })
 */
export const ghostParams = (extra?: Record<string, string>): string => {
  const params: Record<string, string> = { ...(extra || {}) };
  if (_ghostCompanyId) params['company_id'] = _ghostCompanyId;
  const qs = new URLSearchParams(params).toString();
  return qs ? `?${qs}` : '';
};

/**
 * Verilen URL'e ghost company_id parametresini akıllıca ekler.
 * - URL'de zaten `?` varsa `&company_id=X` ekler
 * - URL'de `?` yoksa `?company_id=X` ekler
 * - Ghost mod aktif değilse URL'yi olduğu gibi döndürür
 *
 * Kullanım:
 *   fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers })
 *   fetch(appendGhostParam(`${API_BASE}/endpoint?${params}`), { headers })
 */
export const appendGhostParam = (url: string): string => {
  if (!_ghostCompanyId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}company_id=${encodeURIComponent(_ghostCompanyId)}`;
};

/** sessionStorage anahtarı — HMR sonrası modül sıfırlanmasına karşı kalıcı yedek */
const SS_KEY = 'aspect_access_token';

export const setAuthToken = (token: string) => {
  _cachedToken = token;
  try {
    if (token) {
      sessionStorage.setItem(SS_KEY, token);
    } else {
      sessionStorage.removeItem(SS_KEY);
    }
  } catch {
    // sessionStorage erişilemez (gizli mod vb.)
  }
};

/**
 * Güncel access token'ı döndürür — üç katmanlı fallback:
 *  1. supabase.auth.getSession() → her zaman taze, auto-refresh destekli
 *  2. _cachedToken              → login sonrası senkron olarak set edilir
 *  3. sessionStorage            → HMR modül sıfırlanmasına karşı kalıcı yedek
 */
export const getToken = async (): Promise<string> => {
  // 1. Supabase session — taze + otomatik yenileme
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      _cachedToken = session.access_token;
      try { sessionStorage.setItem(SS_KEY, session.access_token); } catch {}
      return session.access_token;
    }
  } catch {
    // getSession hata verirse sonraki adıma geç
  }

  // 2. Bellekteki cache
  if (_cachedToken) return _cachedToken;

  // 3. sessionStorage yedek (HMR sonrası modül sıfırlanmasına dayanır)
  try {
    const stored = sessionStorage.getItem(SS_KEY);
    if (stored) return stored;
  } catch {}

  console.warn('[api] getToken: token bulunamadı — X-Access-Token gönderilmeyecek.');
  return '';
};

/**
 * Dual-header nesnesini oluşturur.
 * - userToken verilirse X-Access-Token eklenir (protected endpoint'ler)
 * - verilmezse sadece gateway header'ı eklenir (public endpoint'ler)
 */
export const buildHeaders = (userToken?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
  };
  if (userToken) {
    headers['X-Access-Token'] = userToken;
  }
  // X-Ghost-Company CORS uyumluluğu için query param olarak kullanılır, header'a eklenmez
  return headers;
};

/**
 * Token'ı okuyup hazır header nesnesi döndürür.
 * Protected endpoint çağrılarında doğrudan kullanılabilir.
 */
export const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  if (!token) {
    console.warn('[api] authHeaders: token boş! X-Access-Token gönderilmeyecek.');
  }
  return buildHeaders(token);
};