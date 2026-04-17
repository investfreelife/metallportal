import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getSubcategories, getCategoryWithChildren, getProductCounts, sumCounts } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import CatalogView from "@/components/catalog/CatalogView";
import CatalogCategoryCard from "@/components/catalog/CatalogCategoryCard";

export const revalidate = 60;

interface Props {
  params: { category: string };
}

export default async function CategoryPage({ params }: Props) {
  const category = await getCategoryBySlug(params.category);
  if (!category) return notFound();

  const subcategories = await getSubcategories(category.id);

  // If category has subcategories → show cards
  if (subcategories.length > 0) {
    const [counts, { data: allCats }] = await Promise.all([
      getProductCounts(),
      supabase.from("categories").select("id, parent_id").eq("is_active", true),
    ]);
    const catList = allCats ?? [];

    // For each subcategory, get its children (Level 3) with recursive counts
    const enriched = await Promise.all(
      subcategories.map(async (sub: any) => {
        const children = await getSubcategories(sub.id);
        return {
          ...sub,
          totalProducts: sumCounts(sub.id, catList, counts),
          subcategories: children.map((c: any) => ({
            ...c,
            totalProducts: sumCounts(c.id, catList, counts),
            productCount: counts[c.id] || 0,
          })),
        };
      })
    );

    return (
      <div>
        <nav className="text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
          <span className="mx-2">/</span>
          <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{category.name}</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground mb-2">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground mb-8">{category.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {enriched.filter((sub: any) => sub.totalProducts > 0).map((sub: any) => (
            <CatalogCategoryCard
              key={sub.id}
              name={sub.name}
              slug={sub.slug}
              icon={sub.icon}
              imageUrl={sub.image_url}
              totalProducts={sub.totalProducts}
              subcategories={sub.subcategories}
              basePath={`/catalog/${params.category}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Leaf category — show product list
  const result = await getCategoryWithChildren(params.category);
  if (!result) return notFound();

  return (
    <CatalogView
      category={result.category}
      subcategories={result.subcategories}
      products={result.products}
      categorySlug={params.category}
      productBasePath={`/catalog/${params.category}`}
    />
  );
}
