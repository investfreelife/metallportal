import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getCategoryBySlug, getCategoryWithChildren,
  getProductBySlug, getProductPriceItems, getRelatedProducts,
} from "@/lib/queries";
import CatalogView from "@/components/catalog/CatalogView";
import ProductDetailView from "@/components/catalog/ProductDetailView";

// W2-3: было `revalidate = 3600` (ISR-кеш на час). Категории info-fields
// (description / seo_text / gost_url / cta_*) могут редактироваться через
// админку — час задержки → пользователь видит старое наполнение. Сокращаем
// до 60 сек, что достаточно для UX, и не наказываем БД (~1 SELECT/мин на
// уникальную страницу).
export const revalidate = 60;

interface Props {
  params: { category: string; subcategory: string; slug: string };
}

// Slugs that have canonical pages at /catalog/[subcategory]/[slug]
const CANONICAL_REDIRECTS: Record<string, string> = {
  "navesy-besedka":          "/catalog/navesy/navesy-besedka",
  "navesy-dlya-dachi":       "/catalog/navesy/navesy-dlya-dachi",
  "navesy-dlya-avtomobilya": "/catalog/navesy/navesy-dlya-avtomobilya",
  "navesy-dlya-parkovok":    "/catalog/navesy/navesy-dlya-parkovok",
  "navesy-s-hozblokom":      "/catalog/navesy/navesy-s-hozblokom",
  "navesy-dlya-garazha":     "/catalog/navesy/navesy-dlya-garazha",
  "navesy-dlya-terrasy":     "/catalog/navesy/navesy-dlya-terrasy",
  "navesy-k-domu":           "/catalog/navesy/navesy-k-domu",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.slug);
  if (cat) return { title: `${cat.name} — купить в Москве | Харланметалл` };
  const product = await getProductBySlug(params.slug);
  if (!product) return { title: "Не найдено | Харланметалл" };
  const title = `${product.name} цена купить в Москве | Харланметалл`;
  const description = product.description
    ? product.description.slice(0, 155)
    : `${product.name} — купить оптом и в розницу в Москве.`;
  return { title, description };
}

export default async function SlugPage({ params }: Props) {
  // Redirect canonical navesy subcategory pages
  if (CANONICAL_REDIRECTS[params.slug]) {
    redirect(CANONICAL_REDIRECTS[params.slug]);
  }

  // 1. Check if slug is a category
  const category = await getCategoryBySlug(params.slug);

  if (category) {
    // Leaf category — show product list via CatalogView
    const result = await getCategoryWithChildren(params.slug);
    if (result) {
      return (
        <CatalogView
          category={result.category}
          subcategories={result.subcategories}
          products={result.products}
          categorySlug={params.slug}
          productBasePath={`/catalog/${params.category}/${params.subcategory}/${params.slug}`}
        />
      );
    }
  }

  // 2. Check if slug is a product
  const product = await getProductBySlug(params.slug);
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
        basePath={`/catalog/${params.category}/${params.subcategory}`}
      />
    );
  }

  return notFound();
}
