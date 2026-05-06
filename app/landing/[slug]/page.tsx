import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLanding, LANDINGS } from "@/lib/landings";
import { buildLandingMetadata } from "@/lib/landings/seo";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import LandingHero from "@/components/landings/LandingHero";
import LandingBenefits from "@/components/landings/LandingBenefits";
import LandingCalculator from "@/components/landings/LandingCalculator";
import LandingProcess from "@/components/landings/LandingProcess";
import LandingCases from "@/components/landings/LandingCases";
import LandingCTABlock from "@/components/landings/LandingCTABlock";
import LandingFAQ from "@/components/landings/LandingFAQ";
import LandingSchemas from "@/components/landings/LandingSchemas";
import RelatedCategoriesSection from "@/components/landings/RelatedCategoriesSection";

interface Props {
  params: { slug: string };
}

/** Только slug'и из config registry → unknown → 404. */
export const dynamicParams = false;

/** ISR — пересобираем pages раз в час. Content редко меняется. */
export const revalidate = 3600;

export async function generateStaticParams() {
  return Object.keys(LANDINGS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const landing = getLanding(params.slug);
  if (!landing) return { title: "Не найдено" };
  return buildLandingMetadata(landing);
}

export default async function LandingPage({ params }: Props) {
  const landing = getLanding(params.slug);
  if (!landing) return notFound();

  return (
    <main className="bg-background min-h-screen">
      <div className="container-main pt-4">
        <Breadcrumbs items={[{ name: landing.hero.h1 }]} />
      </div>
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
      {/* n005: «Из чего делаем» — bridge к каталогу для DIY-сегмента
          (показываем материалы которые landing использует, ссылки в catalog).
          Если linked categories нет в DB — section возвращает null. */}
      <RelatedCategoriesSection landingSlug={landing.slug} />
      <LandingCTABlock
        slug={landing.slug}
        title={landing.cta.title}
        subtitle={landing.cta.subtitle}
        formFields={landing.cta.formFields}
      />
      <LandingSchemas landing={landing} />
    </main>
  );
}
