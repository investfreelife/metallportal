import Link from "next/link";
import { getCatalogPageData } from "@/lib/queries";
import CatalogSidebar from "@/components/catalog/CatalogSidebar";
import CatalogCategoryCard from "@/components/catalog/CatalogCategoryCard";

export const revalidate = 60;

export default async function CatalogPage() {
  const { categories } = await getCatalogPageData();

  return (
    <div className="bg-background min-h-screen">
      <div className="container-main py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Каталог</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground mb-2">Каталог продукции</h1>
        <p className="text-muted-foreground mb-8">
          Выберите категорию для просмотра ассортимента
        </p>

        <div className="flex gap-8">
          {/* Sidebar — desktop only */}
          <CatalogSidebar categories={categories} />

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Category cards — 2 col on desktop, 1 col on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {categories.map((cat: any) => (
                <CatalogCategoryCard
                  key={cat.id}
                  name={cat.name}
                  slug={cat.slug}
                  icon={cat.icon}
                  imageUrl={cat.image_url}
                  totalProducts={cat.totalProducts}
                  subcategories={cat.subcategories}
                />
              ))}
            </div>

            {categories.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg">Категории пока не добавлены</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
