import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getCategoryBySlug, getCategoryWithChildren,
  getProductBySlug, getProductPriceItemsCutoverAware, getProductSellerOffers, getRelatedProducts,
} from "@/lib/queries";
import CatalogView from "@/components/catalog/CatalogView";
import ProductDetailView from "@/components/catalog/ProductDetailView";
import EmptyCategoryLanding from "@/components/catalog/EmptyCategoryLanding";
import NavesView from "@/components/navesy/NavesView";
import NavesProductDetail from "@/components/navesy/NavesProductDetail";

/** ТЗ #031 / LAW navesy-ui-separate-from-metalloprokat — 5 immutable navesy L3 slugs. */
const NAVESY_SLUGS = new Set([
  "navesy-s-hozblokom",
  "navesy-dlya-avtomobilya",
  "navesy-dlya-parkovok",
  "navesy-besedka",
  "navesy-dlya-dachi",
]);
import Breadcrumbs from "@/components/seo/Breadcrumbs";

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

  // Look up parent + grandparent для breadcrumb chain
  const [grandparent, parent] = await Promise.all([
    getCategoryBySlug(params.category),
    getCategoryBySlug(params.subcategory),
  ]);

  const baseChain = [
    { name: "Каталог", href: "/catalog" },
    { name: grandparent?.name || params.category, href: `/catalog/${params.category}` },
    { name: parent?.name || params.subcategory, href: `/catalog/${params.category}/${params.subcategory}` },
  ];

  // 1. Check if slug is a category
  const category = await getCategoryBySlug(params.slug);

  if (category) {
    // Leaf category — show product list via CatalogView (or NavesView для navesy L3).
    const result = await getCategoryWithChildren(params.slug);
    if (result) {
      // ТЗ #031 navesy-ui-separate
      if (NAVESY_SLUGS.has(params.slug)) {
        return (
          <>
            <Breadcrumbs items={[...baseChain, { name: result.category.name }]} />
            <NavesView
              category={result.category}
              products={result.products as any}
              basePath={`/catalog/${params.category}/${params.subcategory}`}
              categorySlug={params.slug}
            />
          </>
        );
      }
      // Sergey 2026-05-09: empty category → SEO landing fallback.
      if (result.products.length === 0 && result.subcategories.length === 0) {
        return (
          <>
            <Breadcrumbs items={[...baseChain, { name: result.category.name }]} />
            <EmptyCategoryLanding category={result.category as any} />
          </>
        );
      }
      return (
        <>
          <Breadcrumbs items={[...baseChain, { name: result.category.name }]} />
          <CatalogView
            category={result.category}
            subcategories={result.subcategories}
            products={result.products}
            categorySlug={params.slug}
            productBasePath={`/catalog/${params.category}/${params.subcategory}/${params.slug}`}
          />
        </>
      );
    }
  }

  // 2. Check if slug is a product
  const product = await getProductBySlug(params.slug);
  if (product) {
    // ТЗ #031 — navesy product detail uses NavesProductDetail (subcategory contains navesy L3 slug).
    if (NAVESY_SLUGS.has(params.subcategory)) {
      return (
        <>
          <Breadcrumbs items={[...baseChain, { name: product.name }]} />
          <NavesProductDetail
            product={product as any}
            categoryHref={`/catalog/${params.category}/${params.subcategory}`}
            categoryName={parent?.name ?? params.subcategory}
          />
        </>
      );
    }

    const [priceItems, sellerOffers, related] = await Promise.all([
      getProductPriceItemsCutoverAware(product.id),
      getProductSellerOffers(product.id),
      getRelatedProducts(product.category_id, product.id, 6),
    ]);
    return (
      <>
        <Breadcrumbs items={[...baseChain, { name: product.name }]} />
        <ProductDetailView
          product={product}
          priceItems={priceItems}
          sellerOffers={sellerOffers}
          related={related}
          basePath={`/catalog/${params.category}/${params.subcategory}`}
        />
      </>
    );
  }

  return notFound();
}
