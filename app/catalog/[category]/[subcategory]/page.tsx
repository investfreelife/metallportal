import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getCategoryBySlug, getSubcategories, getCategoryWithChildren,
  getProductBySlug, getProductPriceItems, getRelatedProducts, getProductCounts, sumCounts,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import CatalogView from "@/components/catalog/CatalogView";
import CatalogCategoryCard from "@/components/catalog/CatalogCategoryCard";
import ProductDetailView from "@/components/catalog/ProductDetailView";

export const revalidate = 60;

interface Props {
  params: { category: string; subcategory: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.subcategory);
  if (cat) return { title: `${cat.name} — купить в Москве | МеталлПортал` };
  const product = await getProductBySlug(params.subcategory);
  if (!product) return { title: "Не найдено | МеталлПортал" };
  return { title: `${product.name} цена купить в Москве | МеталлПортал` };
}

const DEDICATED_PAGES: Record<string, string> = {
  navesy: "/catalog/navesy",
  kozyrki: "/catalog/kozyrki",
};

export default async function SubcategoryPage({ params }: Props) {
  if (DEDICATED_PAGES[params.subcategory]) {
    redirect(DEDICATED_PAGES[params.subcategory]);
  }

  // Look up parent category for breadcrumbs
  const parentCategory = await getCategoryBySlug(params.category);

  // 1. Check if subcategory is a category slug
  const category = await getCategoryBySlug(params.subcategory);

  if (category) {
    const subcategories = await getSubcategories(category.id);

    // Has children → show cards
    if (subcategories.length > 0) {
      const [counts, { data: allCats }] = await Promise.all([
        getProductCounts(),
        supabase.from("categories").select("id, parent_id").eq("is_active", true),
      ]);
      const catList = allCats ?? [];
      const enriched = subcategories
        .map((sub: any) => ({
          ...sub,
          totalProducts: sumCounts(sub.id, catList, counts),
          subcategories: [],
        }));

      return (
        <div>
          <nav className="text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
            <span className="mx-2">/</span>
            <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
            <span className="mx-2">/</span>
            <Link href={`/catalog/${params.category}`} className="hover:text-gold transition-colors">
              {parentCategory?.name || params.category}
            </Link>
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
                basePath={`/catalog/${params.category}/${params.subcategory}`}
              />
            ))}
          </div>
        </div>
      );
    }

    // Leaf category → show product list
    const result = await getCategoryWithChildren(params.subcategory);
    if (result) {
      return (
        <CatalogView
          category={result.category}
          subcategories={result.subcategories}
          products={result.products}
          categorySlug={params.subcategory}
          productBasePath={`/catalog/${params.category}/${params.subcategory}`}
        />
      );
    }
  }

  // 2. Check if subcategory is a product slug
  const product = await getProductBySlug(params.subcategory);
  if (product) {
    const [priceItems, related] = await Promise.all([
      getProductPriceItems(product.id),
      getRelatedProducts(product.category_id, product.id, 6),
    ]);
    return (
      <ProductDetailView
        product={product}
        priceItems={priceItems}
        related={related}
        basePath={`/catalog/${params.category}`}
      />
    );
  }

  return notFound();
}
