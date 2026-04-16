import { notFound } from "next/navigation";
import { getCategoryWithChildren } from "@/lib/queries";
import CatalogView from "@/components/catalog/CatalogView";

export const revalidate = 60;

interface Props {
  params: { category: string };
}

export default async function CategoryPage({ params }: Props) {
  const result = await getCategoryWithChildren(params.category);

  if (!result) {
    return notFound();
  }

  return (
    <CatalogView
      category={result.category}
      subcategories={result.subcategories}
      products={result.products}
      categorySlug={params.category}
    />
  );
}
