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
    .maybeSingle()) as { data: { name: string; description: string | null } | null };

  if (!cat) return { title: "Не найдено" };
  return {
    title: `${cat.name} под ключ — Харланметалл`,
    description:
      cat.description ??
      `${cat.name} — производство и монтаж под ключ. Гарантия 10 лет, доставка по Москве и МО.`,
    alternates: { canonical: `/constructions/${params.category}` },
  };
}

/**
 * /constructions/[category] — L2 готовых изделий (Гаражи / Навесы / Заборы /
 * Здания / Конструкции / Изделия). Focused conversion UI:
 *   1. Primary linked landing CTA prominent (junction `landing_category_links`)
 *   2. L3 children grid (если есть — для Заборов / Навесов)
 *   3. Empty state с phone CTA если категория без content
 *
 * `display_section='constructions'` в WHERE — guarantee that мы не рендерим
 * metallоprokat L1 случайно.
 */
export default async function ConstructionCategoryPage({ params }: Props) {
  // Untyped — display_section не в database.types (cast inline, see generateMetadata above)
  const { data: category } = (await (supabase as any)
    .from("categories")
    .select("*")
    .eq("slug", params.category)
    .eq("display_section", SECTION_CONSTRUCTIONS)
    .eq("is_active", true)
    .maybeSingle()) as { data: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
    } | null };

  if (!category) notFound();

  const [linkedLandings, { data: children }] = await Promise.all([
    getRelatedLandings(category.id),
    (supabase as any)
      .from("categories")
      .select("id, name, slug, icon")
      .eq("parent_id", category.id)
      .eq("is_active", true)
      .order("sort_order") as Promise<{
        data: Array<{ id: string; name: string; slug: string; icon: string | null }> | null;
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
          { name: category.name },
        ]}
      />

      <h1 className="text-3xl font-bold text-foreground mb-2">
        {category.name}
      </h1>
      {category.description && (
        <p className="text-muted-foreground mb-8 max-w-3xl">
          {category.description}
        </p>
      )}

      {/* Primary linked landing — prominent conversion CTA */}
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

      {/* L3 children grid (Заборы → Сварные/Секционные/Противоподкопные;
          Навесы → Беседки/Авто/Парковок/etc) */}
      {children && children.length > 0 && (
        <section className="my-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Подкатегории
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/constructions/${params.category}/${child.slug}`}
                className="group bg-card border border-border rounded-xl p-5 hover:border-gold/50 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{child.icon || "📐"}</span>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-gold transition-colors">
                    {child.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-gold text-sm font-semibold mt-3">
                  Подробнее
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Other linked landings (если есть >1) — secondary CTAs */}
      {linkedLandings.length > 1 && (
        <section className="my-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            Связанные готовые решения
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {linkedLandings
              .filter((l) => l.slug !== primaryLanding?.slug)
              .map((l) => (
                <Link
                  key={l.slug}
                  href={`/landing/${l.slug}`}
                  className="group bg-card border border-border rounded-xl p-5 hover:border-gold/50 hover:shadow-md transition-all"
                >
                  <h3 className="text-base font-bold text-foreground group-hover:text-gold transition-colors leading-snug">
                    {l.displayLabel}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {l.config.hero.subtitle}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-gold text-sm font-semibold">
                    Подробнее
                    <ArrowRight size={14} />
                  </div>
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* Empty state — нет children, нет linked landings, нет products */}
      {(!children || children.length === 0) && linkedLandings.length === 0 && (
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
      )}

      {/* Bridge link к /catalog */}
      <div className="mt-12 p-5 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-blue-500/5 border border-blue-500/20 rounded-xl flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-foreground">
            📦 Хотите купить материалы и сделать самостоятельно?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Полный каталог металлопроката — трубы, арматура, лист.
          </p>
        </div>
        <Link
          href="/catalog"
          className="text-sm font-semibold text-foreground border border-border hover:border-gold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          В каталог металлопроката →
        </Link>
      </div>
    </div>
  );
}
