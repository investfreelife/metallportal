import { getFullCategoryTree } from "@/lib/queries";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import { CatalogFiltersProvider } from "@/contexts/CatalogFiltersContext";
import { SECTION_CONSTRUCTIONS, SECTION_METALLPROKAT, SECTION_META } from "@/lib/sections";

/**
 * /constructions/* shared layout — mirror /catalog/layout.tsx. Per Sergey
 * 2026-05-08 «должен быть единый каталог! и на сайте и в меню!» sidebar
 * показывает constructions L1 + metalloprokat L1 (same tree как /catalog).
 *
 * Header link «Готовые изделия» → /constructions.
 */
export default async function ConstructionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [constructionsTree, metallTree] = await Promise.all([
    getFullCategoryTree(SECTION_CONSTRUCTIONS),
    getFullCategoryTree(SECTION_METALLPROKAT),
  ]);
  const categories = [...constructionsTree, ...metallTree];
  const meta = SECTION_META[SECTION_CONSTRUCTIONS];

  return (
    <div className="bg-background min-h-screen">
      <CatalogFiltersProvider>
        <div className="container-main py-8">
          <div className="flex gap-8">
            <CatalogSidebar
              categories={categories}
              headerLabel={meta.label}
              headerHref={meta.href}
            />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </div>
      </CatalogFiltersProvider>
    </div>
  );
}
