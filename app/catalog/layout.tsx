import { getFullCategoryTree } from "@/lib/queries";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import { CatalogFiltersProvider } from "@/contexts/CatalogFiltersContext";
import { SECTION_METALLPROKAT, SECTION_CONSTRUCTIONS, SECTION_META } from "@/lib/sections";

/**
 * /catalog/* shared layout. Sidebar показывает metallоprokat L1 + appends
 * «Готовые изделия» (constructions section) тоже — per Sergey directive
 * 2026-05-07 «в левое меню добавь готовые изделия».
 * Constructions L1 cards routes ведут к /landing/{slug} через junction primary
 * (см. CatalogCategoryCard.landingSlug + landing_category_links.link_type).
 */
export default async function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [metallTree, constructionsTree] = await Promise.all([
    getFullCategoryTree(SECTION_METALLPROKAT),
    getFullCategoryTree(SECTION_CONSTRUCTIONS),
  ]);
  // «Готовые изделия» наверху sidebar — consistency с top nav order (Sergey 2026-05-08).
  const categories = [...constructionsTree, ...metallTree];
  const meta = SECTION_META[SECTION_METALLPROKAT];

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
