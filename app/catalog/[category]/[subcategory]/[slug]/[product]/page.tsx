import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getProductPriceItems, getRelatedProducts } from "@/lib/queries";
import ProductDetailView from "@/components/catalog/ProductDetailView";

export const revalidate = 3600;

interface Props {
  params: { category: string; subcategory: string; slug: string; product: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.product);
  if (!product) return { title: "Товар не найден | Харланметалл" };
  const title = `${product.name} цена купить в Москве | Харланметалл`;
  const description = product.description
    ? product.description.slice(0, 155)
    : `${product.name} — купить оптом и в розницу в Москве.`;
  return { title, description };
}

export default async function ProductAtDepth4Page({ params }: Props) {
  const product = await getProductBySlug(params.product);
  if (!product) return notFound();

  const [priceItems, related] = await Promise.all([
    getProductPriceItems(product.id),
    getRelatedProducts(product.category_id, product.id, 6),
  ]);

  return (
    <ProductDetailView
      product={product}
      priceItems={priceItems}
      related={related}
      basePath={`/catalog/${params.category}/${params.subcategory}/${params.slug}`}
    />
  );
}
