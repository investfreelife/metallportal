import Link from "next/link";
import { getFullCategoryTree } from "@/lib/queries";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { SECTION_METALLPROKAT, SECTION_META } from "@/lib/sections";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Каталог металлопроката — Харланметалл",
  description:
    "Полный каталог металлопроката: сортовой прокат, листовой прокат, трубы, нержавеющая сталь, цветные металлы, инженерные системы. Оптом и в розницу.",
};

/**
 * /catalog — main page металлопроката (raw materials).
 *
 * n006 cleanup: «Готовые решения под ключ» featured landings block REMOVED
 * → moved to /constructions/page.tsx. Categories tree filtered by
 * display_section='metallоprokat' (Иван #026), so «Готовые конструкции»
 * root tile не появляется.
 */
export default async function CatalogPage() {
  const categories = await getFullCategoryTree(SECTION_METALLPROKAT);
  const meta = SECTION_META[SECTION_METALLPROKAT];

  return (
    <div>
      <Breadcrumbs items={[{ name: "Каталог" }]} />

      <h1 className="text-3xl font-bold text-foreground mb-2">
        {meta.pageHeading}
      </h1>
      <p className="text-muted-foreground mb-8">{meta.pageDescription}</p>

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

      {/* Bridge к /constructions для пользователей которые искали готовые решения */}
      <div className="mt-12 p-5 bg-gradient-to-r from-gold/5 via-amber-500/5 to-gold/5 border border-gold/30 rounded-xl flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            🏗 Ищете готовое изделие под ключ?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Навесы, заборы, гаражи, здания, металлоконструкции — отдельный раздел.
          </p>
        </div>
        <Link
          href="/constructions"
          className="text-sm font-semibold text-foreground bg-gold hover:bg-yellow-400 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          Готовые изделия →
        </Link>
      </div>
    </div>
  );
}
