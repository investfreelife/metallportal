import { SITE_URL, SITE_NAME } from "@/lib/site";
import { CONTACT_PHONE_TEL, CONTACT_EMAIL } from "@/lib/contact";

/**
 * Site-wide JSON-LD schemas — рендерятся в `<body>` через `app/layout.tsx`.
 *
 * Включают:
 * - **WebSite + SearchAction** — для Google Sitelinks Search Box (Yandex
 *   тоже учитывает). target указывает на существующий `/search?q=...` route.
 * - **LocalBusiness** — bizinfo для SERP knowledge panel + Я.Справочник.
 *   Использует `lib/contact.ts` constants — Сергей подменит placeholder
 *   значения на реальные одним commit'ом, schema автообновится.
 *
 * Component — server (без `use client`), генерирует JSON inline и вставляет
 * через `dangerouslySetInnerHTML`. SSR гарантирует наличие в HTML до hydration.
 */

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#localbusiness`,
  name: SITE_NAME,
  url: SITE_URL,
  telephone: CONTACT_PHONE_TEL,
  email: CONTACT_EMAIL,
  // Адрес — placeholder из ТЗ (Москва, ул. Промышленная, 15). Сергей уточнит
  // реальный → обновляется constants в `lib/contact.ts` или прямо тут.
  address: {
    "@type": "PostalAddress",
    streetAddress: "ул. Промышленная, 15",
    addressLocality: "Москва",
    addressRegion: "Москва",
    postalCode: "115054",
    addressCountry: "RU",
  },
  // Рабочие часы — те же что в Footer NAP (Пн–Пт 9:00–18:00).
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
  ],
  priceRange: "₽₽-₽₽₽",
  areaServed: {
    "@type": "Country",
    name: "Россия",
  },
};

export default function SiteSchemas() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
    </>
  );
}
