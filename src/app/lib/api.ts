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
import { publicAnonKey } from '/utils/supabase/info';

/**
 * Supabase session'dan güncel access token'ı döndürür.
 * Session yoksa boş string döner (public endpoint'ler için güvenli).
 */
export const getToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? '';
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
  return headers;
};

/**
 * Token'ı session'dan okuyup hazır header nesnesi döndürür.
 * Protected endpoint çağrılarında doğrudan kullanılabilir.
 */
export const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  return buildHeaders(token);
};
