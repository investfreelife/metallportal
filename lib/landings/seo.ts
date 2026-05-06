import type { Metadata } from "next";
import type { LandingConfig } from "./types";

/**
 * Генерация Next.js Metadata для landing page.
 *
 * Используется в `app/landing/[slug]/page.tsx` через
 * `generateMetadata()`. Title подставляется в template из root
 * layout (`%s | Харланметалл`) — так что в `seo.title` уже не
 * добавляем «| Харланметалл», иначе будет дубль.
 */
export function buildLandingMetadata(landing: LandingConfig): Metadata {
  const url = `/landing/${landing.slug}`;
  return {
    title: landing.seo.title,
    description: landing.seo.description,
    keywords: landing.seo.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: landing.seo.ogTitle ?? landing.seo.title,
      description: landing.seo.description,
      url,
      type: "website",
      // OG image — using global default из app/opengraph-image.tsx (m002).
      // Per-page custom — m004+ candidate (city-specific OG позже).
    },
  };
}
