import Link from "next/link";

const MC_SUPPLIER_ID = "a2000000-0000-0000-0000-000000000001";

interface ProductTableProps {
  products: any[];
  productBasePath: string;
}

function extractSize(name: string): string {
  // Try ⌀ or Ø diameter notation: ⌀57×3.5 or Ø12
  const diam = name.match(/[⌀Ø∅](\d[\d.,×xх\s]*\d|\d+)/);
  if (diam) return diam[0];
  // Try WxHxT: 40×40×2 or 40x40x2
  const wxh = name.match(/\d+[×xх]\d+(?:[×xх]\d+)?/);
  if (wxh) return wxh[0];
  // Try ДУ size: ДУ 25
  const du = name.match(/ДУ\s*\d+/i);
  if (du) return du[0].replace(/\s+/, " ");
  // Try single dimension like "12мм" or "3,5мм"
  const dim = name.match(/\d+(?:[.,]\d+)?\s*мм/);
  if (dim) return dim[0];
  return "";
}

function getSupplierName(product: any): string {
  if (product.supplier?.company_name) return product.supplier.company_name;
  const fromPriceItem = product.price_items?.find((pi: any) => pi.supplier?.company_name);
  if (fromPriceItem) return fromPriceItem.supplier.company_name;
  // Check if linked to mc.ru supplier
  if (product.supplier_id === MC_SUPPLIER_ID) return "mc.ru";
  const mcPriceItem = product.price_items?.find((pi: any) => pi.supplier_id === MC_SUPPLIER_ID);
  if (mcPriceItem) return "mc.ru";
  return "—";
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

export default function CatalogProductTable({ products, productBasePath }: ProductTableProps) {
  return (
    <div className="overflow-x-auto bg-card border border-border rounded">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Название</th>
            <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Размер</th>
            <th className="px-3 py-2.5 font-medium hidden md:table-cell">ГОСТ</th>
            <th className="px-3 py-2.5 font-medium">Цена/ед</th>
            <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Наличие</th>
            <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Поставщик</th>
            <th className="px-3 py-2.5 font-medium"></th>
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
                <td className="px-3 py-2.5">
                  <Link
                    href={`${productBasePath}/${product.slug}`}
                    className="text-sm font-medium text-foreground hover:text-gold transition-colors line-clamp-2"
                  >
                    {product.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground hidden sm:table-cell">
                  {product.dimensions || extractSize(product.name) || "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground hidden md:table-cell">
                  {product.gost || "—"}
                </td>
                <td className="px-3 py-2.5">
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
                <td className="px-3 py-2.5 hidden sm:table-cell">
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
                <td className="px-3 py-2.5 text-sm text-muted-foreground hidden lg:table-cell">
                  {getSupplierName(product)}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`${productBasePath}/${product.slug}`}
                    className="text-xs border border-gold text-gold hover:bg-gold hover:text-primary-foreground font-medium px-3 py-1.5 rounded transition-all whitespace-nowrap"
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
