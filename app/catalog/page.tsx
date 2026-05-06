import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFullCategoryTree } from "@/lib/queries";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { LANDINGS } from "@/lib/landings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Каталог металлопроката — Харланметалл",
  description:
    "Полный каталог металлопроката: сортовой прокат, листовой прокат, трубы, нержавеющая сталь, цветные металлы, инженерные системы. Оптом и в розницу.",
};

export default async function CatalogPage() {
  const categories = await getFullCategoryTree();

  return (
    <div>
      <Breadcrumbs items={[{ name: "Каталог" }]} />

      <h1 className="text-3xl font-bold text-foreground mb-2">
        Каталог металлопроката
      </h1>
      <p className="text-muted-foreground mb-8">
        Полный ассортимент металлопроката, труб, нержавеющей стали, цветных
        металлов и инженерных систем. Оптом и в розницу с доставкой по России.
      </p>

      {/* n005: featured landings block — bridge к готовым решениям над main grid */}
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

      <h2 className="text-2xl font-bold text-foreground mb-4">
        Категории каталога
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            href={`/catalog/${cat.slug}`}
            className="group bg-card border border-border rounded-lg p-5 hover:border-gold/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{cat.icon || "📦"}</span>
              <h2 className="text-lg font-bold text-foreground group-hover:text-gold transition-colors">
                {cat.name}
              </h2>
            </div>
            {cat.subcategories?.length > 0 && (
              <ul className="space-y-1">
                {cat.subcategories.slice(0, 5).map((sub: any) => (
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
    </div>
  );
}
