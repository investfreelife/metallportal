import Link from "next/link";

interface ProductTableProps {
  products: any[];
  categorySlug: string;
}

function getBestPrice(product: any): { base: number; discount: number | null; unit: string } | null {
  if (!product.price_items?.length) return null;
  let best = product.price_items[0];
  for (const pi of product.price_items) {
    const price = pi.discount_price ?? pi.base_price;
    const bestPrice = best.discount_price ?? best.base_price;
    if (price < bestPrice) best = pi;
  }
  return { base: best.base_price, discount: best.discount_price, unit: product.unit };
}

function hasStock(product: any): boolean {
  return product.price_items?.some((pi: any) => pi.in_stock) ?? false;
}

export default function CatalogProductTable({ products, categorySlug }: ProductTableProps) {
  return (
    <div className="overflow-x-auto bg-card border border-border rounded">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 font-medium">Название</th>
            <th className="px-4 py-3 font-medium">Размер</th>
            <th className="px-4 py-3 font-medium">ГОСТ</th>
            <th className="px-4 py-3 font-medium">Цена/ед</th>
            <th className="px-4 py-3 font-medium">Наличие</th>
            <th className="px-4 py-3 font-medium">Поставщик</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((product: any) => {
            const price = getBestPrice(product);
            const inStock = hasStock(product);
            return (
              <tr
                key={product.id}
                className="border-b border-border hover:bg-background/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/catalog/${categorySlug}/${product.slug}`}
                    className="text-sm font-medium text-foreground hover:text-gold transition-colors"
                  >
                    {product.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {product.dimensions || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {product.gost || "—"}
                </td>
                <td className="px-4 py-3">
                  {price ? (
                    <div>
                      {price.discount && (
                        <span className="text-xs text-muted-foreground line-through mr-2">
                          {price.base.toLocaleString("ru-RU")}
                        </span>
                      )}
                      <span className="text-sm font-bold text-gold">
                        {(price.discount ?? price.base).toLocaleString("ru-RU")} ₽/{price.unit}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">По запросу</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-xs font-medium px-2 py-1 rounded ${
                      inStock
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {inStock ? "В наличии" : "Под заказ"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {product.supplier?.company_name || "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/catalog/${categorySlug}/${product.slug}`}
                    className="text-xs border border-gold text-gold hover:bg-gold hover:text-primary-foreground font-medium px-3 py-1.5 rounded transition-all"
                  >
                    Подробнее
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
