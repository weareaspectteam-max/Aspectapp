import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './supabase-info';

// Singleton Supabase client - frontend tarafında kullanılacak
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      persistSession: true,       // Session'ı localStorage'da tut
      autoRefreshToken: true,     // Token otomatik yenilensin
      detectSessionInUrl: true,   // URL'den session oku (email confirm vb.)
    },
  }
);

export const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;