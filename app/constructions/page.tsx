import Link from "next/link";
import type { Metadata } from "next";
import { getFullCategoryTree } from "@/lib/queries";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

/**
 * c025: /constructions — отдельный раздел сайта для готовых изделий
 * (Навесы, Гаражи, Здания из сэндвич-панелей, Заборы, etc.) Это
 * НЕ металлопрокат — отдельный display_section в БД («constructions»),
 * sibling к /catalog (display_section='metallоprokat').
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Готовые конструкции — Харланметалл",
  description:
    "Навесы, гаражи, здания из сэндвич-панелей, заборы и металлоконструкции под заказ. Изготовление и монтаж по всей России.",
};

export default async function ConstructionsPage() {
  const categories = await getFullCategoryTree("constructions");

  return (
    <div className="bg-background min-h-screen">
      <div className="container-main py-8">
        <Breadcrumbs items={[{ name: "Готовые конструкции" }]} />

        <h1 className="text-3xl font-bold text-foreground mb-2">
          Готовые конструкции
        </h1>
        <p className="text-muted-foreground mb-8">
          Навесы, гаражи, заборы, здания из сэндвич-панелей и металлоконструкции
          под заказ — изготавливаем из собственного металлопроката, монтируем
          по всей России.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              href={`/catalog/${cat.slug}`}
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
    </div>
  );
}
