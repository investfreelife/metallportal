import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getRelatedLandings } from "@/lib/landings/queries";
import { SECTION_CONSTRUCTIONS, SECTION_META } from "@/lib/sections";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
} from "@/lib/contact";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

interface Props {
  params: { category: string; subcategory: string };
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // `display_section` отсутствует в lib/database.types.ts (regenerate — отдельный
  // hygiene task), поэтому supabase-js typing returns `never`. Cast inline.
  const { data: cat } = (await (supabase as any)
    .from("categories")
    .select("name, description")
    .eq("slug", params.subcategory)
    .eq("display_section", SECTION_CONSTRUCTIONS)
    .eq("is_active", true)
    .maybeSingle()) as { data: { name: string; description: string | null } | null };

  if (!cat) return { title: "Не найдено" };
  return {
    title: `${cat.name} под ключ — Харланметалл`,
    description:
      cat.description ??
      `${cat.name} — производство и монтаж под ключ. Гарантия 10 лет, доставка по Москве и МО.`,
    alternates: {
      canonical: `/constructions/${params.category}/${params.subcategory}`,
    },
  };
}

/**
 * /constructions/[category]/[subcategory] — L3 готовых изделий (Заборы Сварные /
 * Навесы Беседки / etc.). Same focused conversion UX как L2:
 *  - Primary linked landing CTA prominent
 *  - Products grid если direct attached
 *  - Empty state с phone + back-link к L2
 *
 * `display_section='constructions'` lookup идёт по `subcategory.slug` (всё дерево
 * под gotovye-konstruktsii унаследует section).
 */
export default async function ConstructionSubcategoryPage({ params }: Props) {
  // Lookup parent + subcategory. Untyped (display_section не в database.types).
  const [{ data: parent }, { data: subcategory }] = (await Promise.all([
    (supabase as any)
      .from("categories")
      .select("name, slug")
      .eq("slug", params.category)
      .eq("display_section", SECTION_CONSTRUCTIONS)
      .eq("is_active", true)
      .maybeSingle(),
    (supabase as any)
      .from("categories")
      .select("*")
      .eq("slug", params.subcategory)
      .eq("display_section", SECTION_CONSTRUCTIONS)
      .eq("is_active", true)
      .maybeSingle(),
  ])) as [
    { data: { name: string; slug: string } | null },
    {
      data: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
      } | null;
    },
  ];

  if (!subcategory) notFound();

  const [linkedLandings, { data: products }] = await Promise.all([
    getRelatedLandings(subcategory.id),
    (supabase as any)
      .from("products")
      .select("id, name, slug, image_url")
      .eq("category_id", subcategory.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(50) as Promise<{
        data: Array<{ id: string; name: string; slug: string; image_url: string | null }> | null;
      }>,
  ]);

  const primaryLanding =
    linkedLandings.find((l) => l.linkType === "primary") ?? linkedLandings[0];
  const sectionMeta = SECTION_META[SECTION_CONSTRUCTIONS];

  return (
    <div>
      <Breadcrumbs
        items={[
          { name: sectionMeta.label, href: sectionMeta.href },
          {
            name: parent?.name ?? params.category,
            href: `/constructions/${params.category}`,
          },
          { name: subcategory.name },
        ]}
      />

      <h1 className="text-3xl font-bold text-foreground mb-2">
        {subcategory.name}
      </h1>
      {subcategory.description && (
        <p className="text-muted-foreground mb-8 max-w-3xl">
          {subcategory.description}
        </p>
      )}

      {/* Primary landing CTA */}
      {primaryLanding && (
        <section className="my-8 p-6 md:p-8 bg-gradient-to-br from-gold/15 via-amber-500/10 to-gold/5 border border-gold/40 rounded-2xl">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-3xl">🏗</span>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-foreground">
                {primaryLanding.config.hero.h1}
              </h2>
              <p className="text-muted-foreground text-sm md:text-base mt-2 max-w-2xl">
                {primaryLanding.config.hero.subtitle}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              href={`/landing/${primaryLanding.slug}`}
              className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-colors"
            >
              {primaryLanding.config.hero.ctaPrimary}
              <ArrowRight size={18} />
            </Link>
            <a
              href={`tel:${CONTACT_PHONE_TEL}`}
              className="inline-flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-semibold px-5 py-3 rounded-lg transition-colors"
            >
              <Phone size={18} className="text-gold" />
              {CONTACT_PHONE_DISPLAY}
            </a>
          </div>
        </section>
      )}

      {/* Products list если есть */}
      {products && products.length > 0 && (
        <section className="my-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Доступные модели
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => (
              <article
                key={p.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-gold/40 hover:shadow-md transition-all"
              >
                {p.image_url && (
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-semibold text-foreground text-base">
                    {p.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-3">
                    Уточните цену и наличие у менеджера
                  </p>
                  <a
                    href={`tel:${CONTACT_PHONE_TEL}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-gold text-sm font-semibold"
                  >
                    <Phone size={14} />
                    {CONTACT_PHONE_DISPLAY}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {(!products || products.length === 0) && !primaryLanding && (
        <section className="my-16 text-center bg-card/50 border border-border rounded-2xl p-10">
          <span className="text-5xl mb-4 block">📞</span>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Делаем под индивидуальный проект
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            В этой подкатегории нет типовых моделей в каталоге — все изделия
            производятся под ваши размеры и пожелания. Обсудите задачу с менеджером.
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
              href={`/constructions/${params.category}`}
              className="inline-flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-semibold px-5 py-3 rounded-lg transition-colors"
            >
              ← Все {parent?.name?.toLowerCase() ?? "изделия"}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
