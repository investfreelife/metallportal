/**
 * ТЗ #047 Day 3-4: imageCdn helper for Yandex Cloud Object Storage migration.
 *
 * Feature-flagged via NEXT_PUBLIC_USE_YANDEX_CDN (default OFF — Supabase Storage
 * остаётся live до Day 6 cutover). Wraps image URLs from Supabase Storage path
 * to Yandex Cloud Object Storage equivalent path.
 *
 * Photos уже uploaded в YC bucket `harlansteel-images` на Day 3 (697/697 files,
 * mirror of Supabase Storage /product-images/).
 *
 * Cutover process (Day 6):
 * 1. Set NEXT_PUBLIC_USE_YANDEX_CDN=1 в Container Solution env
 * 2. Smoke test — image URLs should resolve к YC bucket
 * 3. After 24h stable — deactivate Supabase Storage bucket (keep as failover)
 *
 * Rollback: unset flag → URLs revert к Supabase Storage без redeploy.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const YANDEX_CDN = process.env.NEXT_PUBLIC_IMAGE_CDN_URL ?? null;
const USE_YANDEX_CDN = process.env.NEXT_PUBLIC_USE_YANDEX_CDN === "1";

const SUPABASE_PRODUCT_IMAGES_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/product-images/`
  : "";

// ТЗ #047 ADDENDUM 3 Step 20: legacy /site-images/ bucket (navesy + categories)
const SUPABASE_SITE_IMAGES_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/site-images/`
  : "";

/**
 * Rewrite a Supabase Storage public URL to Yandex CDN equivalent.
 *
 * Behaviour:
 * - If flag OFF or YANDEX_CDN not configured → return original URL unchanged
 * - If URL is не Supabase Storage path → return unchanged (3rd party images intact)
 * - If URL matches Supabase product-images prefix → swap to YC CDN
 *
 * Example:
 *   in:  https://tmz...supabase.co/storage/v1/object/public/product-images/krug-50.jpg
 *   out: https://harlansteel-images.storage.yandexcloud.net/product-images/krug-50.jpg
 *
 * Safe for null/undefined input.
 */
export function rewriteImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!USE_YANDEX_CDN || !YANDEX_CDN) return url;
  if (!SUPABASE_PRODUCT_IMAGES_PREFIX) return url;

  const base = YANDEX_CDN.replace(/\/$/, "");

  if (url.startsWith(SUPABASE_PRODUCT_IMAGES_PREFIX)) {
    const path = url.slice(SUPABASE_PRODUCT_IMAGES_PREFIX.length);
    return `${base}/product-images/${path}`;
  }

  // Step 20: site-images bucket (legacy navesy/category covers).
  if (SUPABASE_SITE_IMAGES_PREFIX && url.startsWith(SUPABASE_SITE_IMAGES_PREFIX)) {
    const path = url.slice(SUPABASE_SITE_IMAGES_PREFIX.length);
    // 2026-05-17 designer-upload fix: NEW designer uploads под `user-uploads/`
    // folder остаются на Supabase Storage — НЕ rewrite. YC bucket mirror у нас
    // только для legacy navesy/category covers (94 files mirrored на Day 3 #047).
    // Designer ставит фото через UI — Supabase upload работает (proven). Rewrite
    // на YC bucket dropped → photos accessible через Supabase, не 404.
    if (path.startsWith("user-uploads/")) return url;
    return `${base}/site-images/${path}`;
  }

  return url;
}

/**
 * Batch rewrite for arrays (image_urls field on products).
 */
export function rewriteImageUrls(
  urls: (string | null | undefined)[] | null | undefined,
): string[] {
  if (!urls) return [];
  return urls.map((u) => rewriteImageUrl(u)).filter((u) => u.length > 0);
}

/**
 * Helpers for debugging — exported only когда нужно.
 */
export const __cdn_debug = {
  enabled: USE_YANDEX_CDN,
  cdnBase: YANDEX_CDN,
  supabasePrefix: SUPABASE_PRODUCT_IMAGES_PREFIX,
};
