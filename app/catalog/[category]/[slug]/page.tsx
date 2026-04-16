import Link from "next/link";
import { notFound } from "next/navigation";
import { FileUp } from "lucide-react";
import { getProductBySlug, getProductPriceItems } from "@/lib/queries";
import SpecsTable from "@/components/catalog/SpecsTable";
import SupplierPriceTable from "@/components/catalog/SupplierPriceTable";
import ProductCalculator from "@/components/catalog/ProductCalculator";

export const revalidate = 60;

interface Props {
  params: { category: string; slug: string };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const priceItems = await getProductPriceItems(product.id);

  // Best price for calculator
  const bestPrice = priceItems.length
    ? Math.min(
        ...priceItems.map(
          (pi: any) => Number(pi.discount_price) || Number(pi.base_price)
        )
      )
    : 0;

  // Parent category for breadcrumb
  const parentCategory = (product.category as any)?.parent;
  const categoryName = (product.category as any)?.name;

  return (
    <div className="bg-background min-h-screen">
      <div className="container-main py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/catalog" className="hover:text-gold transition-colors">
            Каталог
          </Link>
          <span>/</span>
          <Link
            href={`/catalog/${params.category}`}
            className="hover:text-gold transition-colors"
          >
            {parentCategory?.name || params.category}
          </Link>
          {categoryName && parentCategory && (
            <>
              <span>/</span>
              <span className="text-muted-foreground">{categoryName}</span>
            </>
          )}
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        {/* Product header */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          {/* Left: image + specs */}
          <div className="flex-1 space-y-6">
            {product.image_url && (
              <div className="bg-card border border-border rounded overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-72 object-cover"
                />
              </div>
            )}

            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {product.name}
              </h1>
              {product.description && (
                <p className="text-muted-foreground">{product.description}</p>
              )}
              <div className="flex items-center gap-3 mt-3">
                {product.gost && (
                  <span className="text-xs bg-card border border-border text-muted-foreground px-2 py-1 rounded">
                    {product.gost}
                  </span>
                )}
                {product.steel_grade && (
                  <span className="text-xs bg-gold/10 text-gold px-2 py-1 rounded">
                    {product.steel_grade}
                  </span>
                )}
              </div>
            </div>

            <SpecsTable product={product} />
          </div>

          {/* Right: calculator */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
            <ProductCalculator
              weightPerMeter={product.weight_per_meter ? Number(product.weight_per_meter) : null}
              pricePerTon={bestPrice}
              unit={product.unit}
            />

            {/* Upload smeta */}
            <div className="bg-card border border-border rounded p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">
                Загрузить смету / КП
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Отправьте файл и получите расчёт за 15 минут
              </p>
              <button className="w-full flex items-center justify-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-medium py-3 rounded transition-all">
                <FileUp size={18} />
                <span>Выбрать файл</span>
              </button>
            </div>
          </div>
        </div>

        {/* Supplier price comparison */}
        <SupplierPriceTable priceItems={priceItems} unit={product.unit} />
      </div>
    </div>
  );
}
