import { notFound } from "next/navigation";
import { getProductBySlug, getProductPriceItems, getRelatedProducts } from "@/lib/queries";
import ProductDetailView from "@/components/catalog/ProductDetailView";

export const revalidate = 60;

interface Props {
  params: { category: string; subcategory: string; product: string };
}

export default async function SubcategoryProductPage({ params }: Props) {
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
      basePath={`/catalog/${params.category}/${params.subcategory}`}
    />
  );
}
