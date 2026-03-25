/**
 * company_kv.tsx — Multi-tenant KV wrapper
 *
 * Tüm KV anahtarlarına `{companyId}:` prefix'i ekler.
 * 'aspect' şirketi için, prefix'li anahtar bulunamazsa legacy (prefix'siz)
 * anahtara düşer (geriye dönük uyumluluk / migration öncesi güvenli geçiş).
 *
 * Kullanım:
 *   import { companyKvFor, getCompanyId } from "./company_kv.tsx";
 *   const cId  = getCompanyId(user);
 *   const ckv  = companyKvFor(cId);
 *   await ckv.get("mekan_abc");       // → kv.get("aspect:mekan_abc") w/ fallback
 *   await ckv.set("mekan_abc", data); // → kv.set("aspect:mekan_abc", data)
 */

import * as kv from "./kv_store.tsx";

// ── Loopback HTTP bağlantı sıfırlamalarına karşı retry helper ───────────────
async function kvRetry<T>(op: () => Promise<T>, attempts = 3, baseMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try { return await op(); } catch (err) {
      lastErr = err;
      const msg = String(err);
      const transient = msg.includes("connection reset") || msg.includes("Connection reset") ||
        msg.includes("connection error") || msg.includes("SendRequest") ||
        msg.includes("broken pipe") || msg.includes("ECONNRESET");
      if (!transient || i === attempts) throw err;
      await new Promise(r => setTimeout(r, baseMs * Math.pow(2, i - 1)));
    }
  }
  throw lastErr;
}

// Desteklenen şirketler
export const VALID_COMPANIES = ["aspect", "frame", "tetra"] as const;
export type CompanyId = (typeof VALID_COMPANIES)[number] | string;

/** JWT user'ından companyId çıkar; yoksa 'aspect' (legacy kullanıcılar) */
export const getCompanyId = (user: any): string => {
  const raw = user?.user_metadata?.company_id;
  return (typeof raw === "string" && raw.length > 0)
    ? raw.toLowerCase()
    : "aspect";
};

/**
 * Company-scoped KV client factory.
 * Her public metodun imzası orijinal kv_store ile birebir uyumlu.
 */
export const companyKvFor = (companyId: CompanyId) => {
  const cId     = (companyId || "aspect").toLowerCase();
  const isAspect = cId === "aspect";
  const p       = (key: string) => `${cId}:${key}`;

  return {
    /** Mevcut şirket kimliği */
    companyId: cId,

    /** Tekil okuma — aspect için legacy fallback */
    async get(key: string): Promise<any> {
      const val = await kv.get(p(key));
      // == null: hem null hem undefined için fallback yap (KV store hangisini döndürürse döndürsün)
      if (val == null && isAspect) {
        return kv.get(key); // legacy (prefix'siz) fallback
      }
      return val;
    },

    /** Tekil yazma — her zaman prefix'li */
    async set(key: string, val: any): Promise<void> {
      return kv.set(p(key), val);
    },

    /** Tekil silme — prefix'li anahtarı sil; aspect için legacy anahtarı da sil */
    async del(key: string): Promise<void> {
      await kv.del(p(key));
      if (isAspect) {
        // Legacy anahtarı da sil (migration öncesi kaydedilmiş olabilir; key yoksa no-op)
        await kv.del(key).catch(() => {/* sessizce geç */});
      }
    },

    /** Prefix ile çoklu okuma — aspect için legacy + prefixed MERGE */
    async getByPrefix(prefix: string): Promise<any[]> {
      const vals = await kvRetry(() => kv.getByPrefix(p(prefix)));
      if (!isAspect) return vals || [];

      // Aspect: her zaman iki seti birleştir (yeni prefix'li + eski legacy)
      // Böylece yeni kayıt eklense bile eski veriler kaybolmaz.
      const legacyVals = await kvRetry(() => kv.getByPrefix(prefix));
      if (!legacyVals || legacyVals.length === 0) return vals || [];
      if (!vals || vals.length === 0) return legacyVals;

      // Dedup: prefix'li kayıtlar önceliklidir.
      // Aynı kaydın legacy ve prefix'li versiyonu varsa legacy atlanır.
      // Birincil anahtar: id > mekanId+tarih > (aynı obje içermeyen)
      const fingerprint = (v: any): string | null => {
        if (!v || typeof v !== "object") return null;
        if (v.id)                        return `id:${v.id}`;
        if (v.mekanId && v.tarih)        return `mt:${v.mekanId}_${v.tarih}`;
        if (v.userId && v.kidemSeviye)   return `kidem:${v.userId}`;
        return null; // benzersiz anahtar yok — ekle (risk: duplicate ama daha iyi hata)
      };

      const seenKeys = new Set<string>(
        (vals as any[]).map(fingerprint).filter(Boolean) as string[]
      );
      const merged = [...vals];
      for (const leg of legacyVals as any[]) {
        const fp = fingerprint(leg);
        if (fp && seenKeys.has(fp)) continue; // prefix'li versiyonu var, atla
        merged.push(leg);
      }
      return merged;
    },

    /** Çoklu okuma — aspect için eksik anahtarlara legacy fallback */
    async mget(keys: string[]): Promise<any[]> {
      const prefixedVals: any[] = await kv.mget(keys.map(k => p(k)));
      if (!isAspect) return prefixedVals;
      // Aspect: null/undefined gelen indisler için legacy anahtarı dene
      return Promise.all(
        prefixedVals.map((v: any, i: number) =>
          v == null ? kv.get(keys[i]) : Promise.resolve(v)
        )
      );
    },

    /** Çoklu yazma — her zaman prefix'li */
    async mset(entries: [string, any][]): Promise<void> {
      return kv.mset(entries.map(([k, v]) => [p(k), v]));
    },

    /** Çoklu silme — prefix'li anahtarları sil; aspect için legacy anahtarları da sil */
    async mdel(keys: string[]): Promise<void> {
      await kv.mdel(keys.map(k => p(k)));
      if (isAspect) {
        await kv.mdel(keys).catch(() => {/* sessizce geç */});
      }
    },
  };
};

/**
 * Mevcut aspect legacy verisini `aspect:` prefix'i ile kopyalar (migrate eder).
 * Orijinal prefix'siz anahtarlar SİLİNMEZ — güvenli, geri dönüşlü.
 *
 * Dönüş: migrate edilen anahtar sayısı
 */
export const migrateLegacyToAspect = async (
  prefixesToMigrate: string[]
): Promise<{ migrated: number; skipped: number; errors: string[] }> => {
  let migrated = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const prefix of prefixesToMigrate) {
    try {
      // prefix'siz legacy kayıtları getir
      const legacyItems: any[] = await kvRetry(() => kv.getByPrefix(prefix)) || [];

      for (const item of legacyItems) {
        try {
          // item bir obje, id/key alanı varsa bul
          // KV'de her obje ayrı bir key'de — getByPrefix tüm objeleri döner
          // Orijinal key'i bilmiyoruz; item._kvKey veya id üzerinden key'i yeniden oluşturuyoruz
          // Strateji: aspect: prefix'li getByPrefix çalıştır, hangi key'ler eksik bul
          // Basit: aspect:prefix altında yok ise yaz
          const srcItems: any[] = await kvRetry(() => kv.getByPrefix(prefix)) || [];
          const dstItems: any[] = await kvRetry(() => kv.getByPrefix(`aspect:${prefix}`)) || [];

          // KV'nin id alanı varsa eşleştir
          const dstIds = new Set(dstItems.map((d: any) => d?.id || d?.key).filter(Boolean));

          for (const src of srcItems) {
            const id = src?.id || src?.key;
            if (!id) continue;
            if (dstIds.has(id)) { skipped++; continue; }
            // Kaynak key'i yeniden türet: prefix + id
            const srcKey = `${prefix}${id}`;
            const dstKey = `aspect:${prefix}${id}`;
            const existing = await kv.get(dstKey);
            if (existing !== null) { skipped++; continue; }
            await kv.set(dstKey, src);
            migrated++;
          }
          break; // her prefix için tek döngü yeterli
        } catch (e) {
          errors.push(`item error: ${e}`);
        }
      }
    } catch (e) {
      errors.push(`prefix "${prefix}" error: ${e}`);
    }
  }

  return { migrated, skipped, errors };
};