import { getFullCategoryTree } from "@/lib/queries";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import { CatalogFiltersProvider } from "@/contexts/CatalogFiltersContext";
import { SECTION_METALLPROKAT, SECTION_META } from "@/lib/sections";

/**
 * /catalog/* shared layout. Sidebar показывает ТОЛЬКО metallоprokat-section
 * categories (per Иван #026 display_section column). «Готовые изделия» —
 * separate /constructions/* route с своим layout (mirror).
 */
export default async function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getFullCategoryTree(SECTION_METALLPROKAT);
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
