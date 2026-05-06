import { getFullCategoryTree } from "@/lib/queries";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import { CatalogFiltersProvider } from "@/contexts/CatalogFiltersContext";
import { SECTION_CONSTRUCTIONS, SECTION_META } from "@/lib/sections";

/**
 * /constructions/* shared layout — mirror /catalog/layout.tsx, но sidebar
 * показывает ТОЛЬКО constructions-section categories (Иван #026
 * display_section). Header link «Готовые изделия» → /constructions.
 *
 * Сами sub-routes `/constructions/garazhi`, `/constructions/zabory/*` и т.д.
 * проброшены через next.config.js rewrites на existing `/catalog/gotovye-
 * konstruktsii/*` routing — без duplicate `[category]/[subcategory]` файлов.
 */
export default async function ConstructionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getFullCategoryTree(SECTION_CONSTRUCTIONS);
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
