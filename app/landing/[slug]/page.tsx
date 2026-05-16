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
import LandingPainSolution from "@/components/landings/LandingPainSolution";
import LandingTestimonials from "@/components/landings/LandingTestimonials";
import LandingTrust from "@/components/landings/LandingTrust";
import LandingLeadMagnet from "@/components/landings/LandingLeadMagnet";
import LandingMidCTA from "@/components/landings/LandingMidCTA";

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
        ctaSecondary={landing.hero.ctaSecondary}
        trustStrip={landing.hero.trustStrip}
        heroImageSrc={landing.hero.heroImageSrc}
      />
      {landing.painSolution && <LandingPainSolution {...landing.painSolution} />}
      <LandingBenefits items={landing.benefits} />
      {landing.additionalCTAs?.find((c) => c.placement === "after_benefits") && (
        <LandingMidCTA
          {...landing.additionalCTAs.find((c) => c.placement === "after_benefits")!}
        />
      )}
      {landing.calculator.enabled && (
        <LandingCalculator config={landing.calculator} slug={landing.slug} />
      )}
      {landing.additionalCTAs?.find((c) => c.placement === "after_calculator") && (
        <LandingMidCTA
          {...landing.additionalCTAs.find((c) => c.placement === "after_calculator")!}
        />
      )}
      <LandingProcess steps={landing.process} />
      <LandingCases items={landing.cases} />
      {landing.additionalCTAs?.find((c) => c.placement === "after_cases") && (
        <LandingMidCTA
          {...landing.additionalCTAs.find((c) => c.placement === "after_cases")!}
        />
      )}
      {landing.testimonials && landing.testimonials.length > 0 && (
        <LandingTestimonials
          testimonials={landing.testimonials}
          aggregateRating={landing.trustBadges?.aggregateRating}
        />
      )}
      {landing.trustBadges && (
        <LandingTrust
          legal={landing.trustBadges.legal}
          guarantee={landing.trustBadges.guarantee}
          standards={landing.trustBadges.standards}
          objectsCompleted={landing.trustBadges.objectsCompleted}
        />
      )}
      <LandingFAQ items={landing.faq} />
      {landing.additionalCTAs?.find((c) => c.placement === "after_faq") && (
        <LandingMidCTA
          {...landing.additionalCTAs.find((c) => c.placement === "after_faq")!}
        />
      )}
      {landing.leadMagnet && <LandingLeadMagnet {...landing.leadMagnet} />}
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
