import Link from "next/link";
import type { Metadata } from "next";
import { getFullCategoryTree } from "@/lib/queries";
import { SECTION_CONSTRUCTIONS, SECTION_META } from "@/lib/sections";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

// n010: revalidate 3600 → 60 (faster ISR refresh во время battle-mode iterations).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Готовые изделия из металла под ключ — Харланметалл",
  description:
    "Производство и монтаж под ключ: навесы, заборы, гаражи, здания из сэндвич-панелей, металлоконструкции и художественные изделия из металла. Гарантия 10 лет.",
  alternates: { canonical: "/constructions" },
};

/**
 * /constructions — root entry для готовых изделий.
 *
 * n010 simplified per Sergey: «не надо дополнительных секций, каталог в том
 * же разделе что и навесы». Убрал отдельный «Готовые решения» landing-cards
 * блок (был в n006 / n007). Сейчас единая category cards grid (6 cards:
 * Навесы / Заборы / Гаражи / Здания / Конструкции / Изделия).
 *
 * Каждая карточка ведёт на /constructions/{slug}, где:
 *   - Если есть products (Навесы — 137) → product list view
 *   - Если empty (5 остальных) → embedded landing-style content
 *   (см. app/constructions/[category]/page.tsx)
 */
export default async function ConstructionsPage() {
  const categories = await getFullCategoryTree(SECTION_CONSTRUCTIONS);
  const meta = SECTION_META[SECTION_CONSTRUCTIONS];

  // categories[0] — root «Готовые изделия» с children = L2.
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

      {subcategories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {subcategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/constructions/${cat.slug}`}
              className="group bg-card border border-border rounded-lg p-5 hover:border-gold/50 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{cat.icon || "🏗"}</span>
                <h2 className="text-lg font-bold text-foreground group-hover:text-gold transition-colors">
                  {cat.name}
                </h2>
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
      )}

      {/* Bridge к /catalog для DIY-сегмента */}
      <div className="mt-12 p-5 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-blue-500/5 border border-blue-500/20 rounded-xl flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-foreground">
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
