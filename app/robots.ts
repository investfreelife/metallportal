import { MetadataRoute } from "next";
import { SITE_URL, SITE_HOST } from "@/lib/site";

/**
 * Dynamic robots.txt — домен берётся из env, чтобы preview-окружения
 * не указывали бот на production sitemap. Static `public/robots.txt`
 * удалён в пользу этого route (Next.js перебивает static при наличии
 * `app/robots.ts`).
 *
 * Note: `Disallow: /*?` из старого static-файла убран — он блокировал
 * индексацию query-string-страниц целиком (фильтры каталога). Для
 * Yandex query-параметры schunkованы через Clean-param на уровне
 * Webmaster (UI) — managed вне репо.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/api/", "/_next/", "/admin/", "/account/", "/cart"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: "Yandex", allow: "/", disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_HOST,
  };
}
