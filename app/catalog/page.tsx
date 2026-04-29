import Link from "next/link";
import { getFullCategoryTree } from "@/lib/queries";
import type { Metadata } from "next";

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
      <nav className="text-sm text-muted-foreground mb-4">
        <Link href="/" className="hover:text-gold transition-colors">
          Главная
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Каталог</span>
      </nav>

      <h1 className="text-3xl font-bold text-foreground mb-2">
        Каталог металлопроката
      </h1>
      <p className="text-muted-foreground mb-8">
        Полный ассортимент металлопроката, труб, нержавеющей стали, цветных
        металлов и инженерных систем. Оптом и в розницу с доставкой по России.
      </p>

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
