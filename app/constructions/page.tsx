import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getFullCategoryTree } from "@/lib/queries";
import { LANDINGS } from "@/lib/landings";
import { SECTION_CONSTRUCTIONS, SECTION_META } from "@/lib/sections";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Готовые изделия из металла под ключ — Харланметалл",
  description:
    "Производство и монтаж под ключ: навесы, заборы, гаражи, здания из сэндвич-панелей, металлоконструкции и художественные изделия из металла. Гарантия 10 лет.",
  alternates: { canonical: "/constructions" },
};

/**
 * /constructions — main entry point для готовых изделий (was в /catalog before n006).
 *
 * Структура:
 *  1. Featured landings block (6 cards) — moved сюда из /catalog/page.tsx.
 *  2. Categories grid — root constructions categories (gotovye-konstruktsii
 *     subtree: garazhi, navesy, zabory, etc).
 *  3. Bridge link к /catalog для DIY-сегмента.
 */
export default async function ConstructionsPage() {
  const categories = await getFullCategoryTree(SECTION_CONSTRUCTIONS);
  const meta = SECTION_META[SECTION_CONSTRUCTIONS];

  // categories[0] — это root «Готовые изделия» с children = L2 (garazhi, navesy, ...).
  // Используем его children как primary grid items.
  const root = categories[0];
  const subcategories = (root?.subcategories ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    totalProducts: number;
    subcategories: Array<{ id: string; name: string; slug: string }>;
  }>;

  return (
    <div>
      <Breadcrumbs items={[{ name: meta.label }]} />

      <h1 className="text-3xl font-bold text-foreground mb-2">
        {meta.pageHeading}
      </h1>
      <p className="text-muted-foreground mb-8">{meta.pageDescription}</p>

      {/* MOVED FROM /catalog (n005 → n006): featured landings block */}
      <section className="mb-12">
        <div className="mb-5 flex items-start gap-3">
          <span className="text-3xl">🏗</span>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Готовые решения под ключ
            </h2>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Закажите готовый забор, гараж, конструкцию — наша команда сделает
              с гарантией 10 лет. Не нужно подбирать материалы самостоятельно.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(LANDINGS).map((landing) => (
            <Link
              key={landing.slug}
              href={`/landing/${landing.slug}`}
              className="group block bg-card border border-border rounded-xl overflow-hidden hover:border-gold/50 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="relative h-36 bg-gradient-to-br from-gold/15 via-gold/5 to-muted overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={landing.hero.heroImageSrc}
                  alt={landing.hero.h1}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="text-base font-bold text-foreground group-hover:text-gold transition-colors leading-snug">
                  {landing.hero.h1}
                </h3>
                <div className="mt-3 flex items-center gap-1.5 text-gold text-xs font-semibold">
                  Подробнее
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Categories grid — L2 sub of «Готовые изделия» (Гаражи, Навесы, Заборы, etc). */}
      {subcategories.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Категории готовых изделий
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {subcategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/constructions/${cat.slug}`}
                className="group bg-card border border-border rounded-lg p-5 hover:border-gold/50 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{cat.icon || "🏗"}</span>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-gold transition-colors">
                    {cat.name}
                  </h3>
                </div>
                {cat.subcategories?.length > 0 && (
                  <ul className="space-y-1">
                    {cat.subcategories.slice(0, 5).map((sub) => (
                      <li
                        key={sub.id}
                        className="text-sm text-muted-foreground truncate"
                      >
                        {sub.name}
                      </li>
                    ))}
                    {cat.subcategories.length > 5 && (
                      <li className="text-sm text-gold">
                        ещё {cat.subcategories.length - 5}…
                      </li>
                    )}
                  </ul>
                )}
                {cat.totalProducts > 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {cat.totalProducts} позиций
                  </p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Bridge к /catalog для DIY-сегмента */}
      <div className="mt-12 p-5 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-blue-500/5 border border-blue-500/20 rounded-xl flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            📦 Хотите купить материалы и сделать самостоятельно?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Полный каталог металлопроката — трубы, арматура, лист, профильная труба.
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
