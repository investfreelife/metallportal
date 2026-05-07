import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCategoryWithChildren } from "@/lib/queries";
import {
  SECTION_CONSTRUCTIONS,
  SECTION_META,
  CONSTRUCTION_CATEGORY_TO_LANDING,
} from "@/lib/sections";
import { LANDINGS } from "@/lib/landings";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
} from "@/lib/contact";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import CatalogView from "@/components/catalog/CatalogView";
import LandingHero from "@/components/landings/LandingHero";
import LandingBenefits from "@/components/landings/LandingBenefits";
import LandingCalculator from "@/components/landings/LandingCalculator";
import LandingProcess from "@/components/landings/LandingProcess";
import LandingCases from "@/components/landings/LandingCases";
import LandingFAQ from "@/components/landings/LandingFAQ";
import LandingCTABlock from "@/components/landings/LandingCTABlock";
import LandingSchemas from "@/components/landings/LandingSchemas";

interface Props {
  params: { category: string };
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // display_section не в lib/database.types.ts (regenerate hygiene task) — cast inline.
  const { data: cat } = (await (supabase as any)
    .from("categories")
    .select("name, description")
    .eq("slug", params.category)
    .eq("display_section", SECTION_CONSTRUCTIONS)
    .eq("is_active", true)
    .maybeSingle()) as {
    data: { name: string; description: string | null } | null;
  };

  // Если category — empty + есть mapped landing → используем landing's SEO для targeting.
  const landingSlug = CONSTRUCTION_CATEGORY_TO_LANDING[params.category];
  const landing = landingSlug ? LANDINGS[landingSlug] : null;

  if (!cat) return { title: "Не найдено" };
  return {
    title: landing?.seo.title ?? `${cat.name} под ключ — Харланметалл`,
    description:
      landing?.seo.description ??
      cat.description ??
      `${cat.name} — производство и монтаж под ключ. Гарантия 10 лет, доставка по Москве и МО.`,
    keywords: landing?.seo.keywords,
    alternates: { canonical: `/constructions/${params.category}` },
  };
}

/**
 * /constructions/[category] — n010 redesign:
 *   1. Если у category subtree есть products (Навесы — 137) → product list через
 *      `<CatalogView>` (тот же UX как `/catalog/.../page.tsx`).
 *   2. Если empty (zabory/garazhi/zdaniya/konstruktsii/izdeliya — 0 products)
 *      → embed full landing template (Hero + Benefits + Calculator + Process +
 *      Cases + FAQ + CTA + Schemas) inside /constructions namespace.
 *   3. Fallback empty state с phone CTA — если категория без products и без
 *      mapped landing.
 *
 * `display_section='constructions'` в WHERE — guarantee against metallоprokat
 * categories accidentally landing here (например / category .slug shared).
 *
 * Sergey clarified: «не надо дополнительных секций, каталог в том же разделе
 * что и навесы». «Под ключ» = это **внутри** category page (hero copy +
 * conversion CTA), не отдельный landing-cards block.
 */
export default async function ConstructionCategoryPage({ params }: Props) {
  // Verify category существует и в constructions section.
  const { data: categoryRow } = (await (supabase as any)
    .from("categories")
    .select("id, name, slug, description")
    .eq("slug", params.category)
    .eq("display_section", SECTION_CONSTRUCTIONS)
    .eq("is_active", true)
    .maybeSingle()) as {
    data: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
    } | null;
  };

  if (!categoryRow) notFound();

  const sectionMeta = SECTION_META[SECTION_CONSTRUCTIONS];
  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { name: sectionMeta.label, href: sectionMeta.href },
        { name: categoryRow.name },
      ]}
    />
  );

  // BRANCH 1 — products в subtree → product list view (same как /catalog/...).
  const result = await getCategoryWithChildren(params.category);
  if (result && result.products.length > 0) {
    return (
      <>
        {breadcrumbs}
        <CatalogView
          category={result.category}
          subcategories={result.subcategories}
          products={result.products}
          categorySlug={params.category}
          productBasePath={`/constructions/${params.category}`}
          defaultView="cards"
        />
      </>
    );
  }

  // BRANCH 2 — empty category, есть mapped landing → embed landing template.
  const landingSlug = CONSTRUCTION_CATEGORY_TO_LANDING[params.category];
  const landing = landingSlug ? LANDINGS[landingSlug] : null;

  if (landing) {
    return (
      <>
        {breadcrumbs}
        <LandingHero
          slug={landing.slug}
          h1={landing.hero.h1}
          subtitle={landing.hero.subtitle}
          ctaPrimary={landing.hero.ctaPrimary}
          heroImageSrc={landing.hero.heroImageSrc}
        />
        <LandingBenefits items={landing.benefits} />
        {landing.calculator.enabled && (
          <LandingCalculator config={landing.calculator} slug={landing.slug} />
        )}
        <LandingProcess steps={landing.process} />
        <LandingCases items={landing.cases} />
        <LandingFAQ items={landing.faq} />
        <LandingCTABlock
          slug={landing.slug}
          title={landing.cta.title}
          subtitle={landing.cta.subtitle}
          formFields={landing.cta.formFields}
        />
        <LandingSchemas landing={landing} />
      </>
    );
  }

  // BRANCH 3 — empty + no mapping → fallback с phone CTA.
  return (
    <>
      {breadcrumbs}
      <h1 className="text-3xl font-bold text-foreground mb-2">
        {categoryRow.name}
      </h1>
      {categoryRow.description && (
        <p className="text-muted-foreground mb-8 max-w-3xl">
          {categoryRow.description}
        </p>
      )}
      <section className="my-16 text-center bg-card/50 border border-border rounded-2xl p-10">
        <span className="text-5xl mb-4 block">📞</span>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Уточните детали у менеджера
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          В этой категории мы делаем индивидуальные проекты — позвоните или
          оставьте заявку, обсудим вашу задачу.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href={`tel:${CONTACT_PHONE_TEL}`}
            className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-colors"
          >
            <Phone size={18} />
            {CONTACT_PHONE_DISPLAY}
          </a>
          <Link
            href="/contacts"
            className="inline-flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-semibold px-5 py-3 rounded-lg transition-colors"
          >
            Все контакты
          </Link>
        </div>
      </section>
    </>
  );
}
