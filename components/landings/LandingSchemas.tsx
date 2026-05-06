import { SITE_URL, SITE_NAME } from "@/lib/site";
import { CONTACT_PHONE_TEL } from "@/lib/contact";
import type { LandingConfig } from "@/lib/landings";

/**
 * JSON-LD schemas для landing page:
 *  - Service или Product (зависит от `landing.schemaType`)
 *  - FAQPage (если есть FAQ)
 *
 * BreadcrumbList отдельно — рендерится через global `<Breadcrumbs />`.
 * LocalBusiness уже global из m002 `<SiteSchemas />` в layout.tsx.
 */
export default function LandingSchemas({ landing }: { landing: LandingConfig }) {
  const url = `${SITE_URL}/landing/${landing.slug}`;

  // Service / Product root JSON-LD
  const serviceSchema =
    landing.schemaType === "Service"
      ? {
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: landing.hero.h1,
          name: landing.seo.title,
          description: landing.seo.description,
          provider: {
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL,
            telephone: CONTACT_PHONE_TEL,
          },
          areaServed: { "@type": "Country", name: "Россия" },
          url,
        }
      : {
          "@context": "https://schema.org",
          "@type": "Product",
          name: landing.hero.h1,
          description: landing.seo.description,
          brand: { "@type": "Brand", name: SITE_NAME },
          url,
        };

  const faqSchema = landing.faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: landing.faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.answer,
          },
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
    </>
  );
}
