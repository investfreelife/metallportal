import Link from "next/link";
import PhotoEditable from "@/components/admin/PhotoEditable";

interface ProductCardProps {
  product: any;
  productBasePath: string;
}

function getBestPrice(product: any): { base: number; discount: number | null } | null {
  if (!product.price_items?.length) return null;
  let best = product.price_items[0];
  for (const pi of product.price_items) {
    const price = pi.discount_price ?? pi.base_price;
    const bestPrice = best.discount_price ?? best.base_price;
    if (price < bestPrice) best = pi;
  }
  return { base: best.base_price, discount: best.discount_price };
}

export default function CatalogProductCard({ product, productBasePath }: ProductCardProps) {
  const price = getBestPrice(product);
  const inStock = product.price_items?.some((pi: any) => pi.in_stock) ?? false;

  return (
    <Link
      href={`${productBasePath}/${product.slug}`}
      className="bg-card border border-border rounded p-4 hover:border-gold hover:shadow-lg transition-all flex flex-col"
    >
      <PhotoEditable
        photoId={`product:${product.slug}`}
        dimensions="320×160"
        className="-mx-4 -mt-4 mb-3 h-40 overflow-hidden rounded-t"
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-4xl opacity-20">📦</div>
        )}
      </PhotoEditable>

      <div className="mb-2">
        <span className="inline-block bg-gold/10 text-gold px-2 py-0.5 text-xs font-medium rounded">
          {product.category?.name || "Металл"}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-2">
        {product.name}
      </h3>

      <p className="text-xs text-muted-foreground mb-3">
        {product.dimensions || product.gost || ""}
      </p>

      <div className="mt-auto">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              inStock
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {inStock ? "В наличии" : "Под заказ"}
          </span>
        </div>

        {price ? (
          <div>
            {price.discount && (
              <span className="text-xs text-muted-foreground line-through mr-2">
                {price.base.toLocaleString("ru-RU")} ₽
              </span>
            )}
            <span className="text-lg font-bold text-gold">
              {(price.discount ?? price.base).toLocaleString("ru-RU")} ₽/{product.unit}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">По запросу</span>
        )}

        <p className="text-xs text-muted-foreground mt-1">
          {product.supplier?.company_name}
        </p>
      </div>
    </Link>
  );
}
