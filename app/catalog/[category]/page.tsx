import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getSubcategories, getCategoryWithChildren, getProductCounts } from "@/lib/queries";
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
    const counts = await getProductCounts();

    // For each subcategory, get its children (Level 3)
    const enriched = await Promise.all(
      subcategories.map(async (sub: any) => {
        const children = await getSubcategories(sub.id);
        const childCounts = children.reduce((acc: number, c: any) => acc + (counts[c.id] || 0), 0);
        return {
          ...sub,
          totalProducts: (counts[sub.id] || 0) + childCounts,
          subcategories: children.map((c: any) => ({
            ...c,
            totalProducts: counts[c.id] || 0,
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
          {enriched.map((sub: any) => (
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
