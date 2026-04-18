import { getFullCategoryTree } from "@/lib/queries";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import { CatalogFiltersProvider } from "@/contexts/CatalogFiltersContext";

export default async function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getFullCategoryTree();

  return (
    <div className="bg-background min-h-screen">
      <CatalogFiltersProvider>
        <div className="container-main py-8">
          <div className="flex gap-8">
            <CatalogSidebar categories={categories} />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </div>
      </CatalogFiltersProvider>
    </div>
  );
}
