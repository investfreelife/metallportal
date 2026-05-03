"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

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

/**
 * Приоритет единиц измерения для top-N rendering. Primary = первый
 * available из списка, secondary = следующий. Все остальные хранятся
 * в БД, но не рендерятся.
 *
 * Семантика: "т" — основная коммерческая единица для металлопроката,
 * "м" — для штанг и протяжных профилей, "шт" — для изделий продаваемых
 * 6м-длинами (нержавейка), "кг" — резерв.
 *
 * Расширено в W2-13 (ADR-0013 + 3-unit case): нержавейка имеет 3
 * price_items (т+м+шт), UI показывает top-2 по этому приоритету.
 */
const UNIT_PRIORITY = ["т", "м", "шт", "кг"];

/**
 * Внутренний helper: выбирает min price_item по конкретной единице.
 */
function pickMinByUnit(
  product: any,
  unit: string,
): { base: number; discount: number | null; unit: string } | null {
  const items = product.price_items.filter(
    (pi: any) => (pi.unit ?? product.unit) === unit,
  );
  if (!items.length) return null;
  let best = items[0];
  for (const pi of items) {
    const price = pi.discount_price ?? pi.base_price;
    const bestPrice = best.discount_price ?? best.base_price;
    if (price < bestPrice) best = pi;
  }
  return {
    base: best.base_price,
    discount: best.discount_price,
    unit: best.unit ?? product.unit ?? unit,
  };
}

/**
 * Primary (продажная) цена товара по UNIT_PRIORITY. Используется для
 * корзины и сортировки.
 *
 * Backwards-compatible: legacy SKU с одним price_item (unit=null) →
 * unit подбирается из product.unit fallback, всё работает как раньше.
 */
function getBestPrice(product: any): { base: number; discount: number | null; unit: string } | null {
  if (!product.price_items?.length) return null;
  // Top-priority unit с available price_item.
  for (const u of UNIT_PRIORITY) {
    const r = pickMinByUnit(product, u);
    if (r) return r;
  }
  // Fallback: первый попавшийся (если unit не в priority list).
  const best = product.price_items[0];
  return {
    base: best.base_price,
    discount: best.discount_price,
    unit: best.unit ?? product.unit ?? "т",
  };
}

/**
 * Secondary цена в другой единице по UNIT_PRIORITY. Используется только
 * для display в каталоге; в корзину не идёт. Возвращает null если у
 * товара только одна единица в price_items.
 */
function getSecondaryPrice(
  product: any,
  primaryUnit: string,
): { base: number; discount: number | null; unit: string } | null {
  if (!product.price_items?.length) return null;
  for (const u of UNIT_PRIORITY) {
    if (u === primaryUnit) continue;
    const r = pickMinByUnit(product, u);
    if (r) return r;
  }
  return null;
}

function hasStock(product: any): boolean {
  return product.price_items?.some((pi: any) => pi.in_stock) ?? false;
}

function MobileProductRow({ product, productBasePath }: { product: any; productBasePath: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const price = getBestPrice(product);
  const secondary = price ? getSecondaryPrice(product, price.unit) : null;
  const inStock = hasStock(product);

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ id: product.id, name: product.name, slug: product.slug, unit: product.unit, price: price ? (price.discount ?? price.base) : null, image_url: product.image_url ?? null });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="bg-card border border-border rounded px-3 py-3 flex items-start gap-3 hover:border-gold/40 transition-colors">
      <div className="flex-1 min-w-0">
        <Link href={`${productBasePath}/${product.slug}`} className="text-sm font-medium text-foreground hover:text-gold transition-colors line-clamp-2 block mb-1.5">
          {product.name}
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {price ? (
            <span className="text-sm font-bold text-gold whitespace-nowrap">
              {(price.discount ?? price.base).toLocaleString("ru-RU")} ₽/{price.unit}
              {secondary && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({(secondary.discount ?? secondary.base).toLocaleString("ru-RU")} ₽/{secondary.unit})
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">По запросу</span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded ${inStock ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
            {inStock ? "В наличии" : "Под заказ"}
          </span>
        </div>
      </div>
      <button
        onClick={handleCart}
        title="В корзину"
        className={`flex-shrink-0 w-9 h-9 rounded flex items-center justify-center transition-all ${
          added ? "bg-emerald-500/20 text-emerald-500" : "bg-gold/10 hover:bg-gold text-gold hover:text-black"
        }`}
      >
        {added ? <Check size={16} /> : <ShoppingCart size={16} />}
      </button>
    </div>
  );
}

function getLength(product: any): string {
  if (product.length_options?.length) return product.length_options[0];
  if (product.length) return String(product.length);
  return "—";
}

function getRegion(product: any): string {
  if (product.supplier?.city) return product.supplier.city;
  if (product.supplier?.region) return product.supplier.region;
  const pi = product.price_items?.find((p: any) => p.supplier?.city || p.supplier?.region);
  if (pi) return pi.supplier?.city || pi.supplier?.region;
  return "Москва";
}

function TableRow({ product, productBasePath }: { product: any; productBasePath: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const price = getBestPrice(product);
  const secondary = price ? getSecondaryPrice(product, price.unit) : null;

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ id: product.id, name: product.name, slug: product.slug, unit: product.unit, price: price ? (price.discount ?? price.base) : null, image_url: product.image_url ?? null });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const diameter = product.diameter ? String(product.diameter).replace(".", ",") : (product.dimensions || extractSize(product.name) || "—");

  return (
    <tr className="border-b border-border hover:bg-background/50 transition-colors">
      <td className="px-3 py-2.5">
        <Link href={`${productBasePath}/${product.slug}`} className="text-sm font-medium text-foreground hover:text-gold transition-colors line-clamp-2">
          {product.name}
        </Link>
      </td>
      <td className="px-3 py-2.5 text-sm text-center text-muted-foreground">
        {diameter}
      </td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground hidden md:table-cell">
        {product.steel_grade || "—"}
      </td>
      <td className="px-3 py-2.5 text-sm text-center text-muted-foreground hidden md:table-cell">
        {getLength(product)}
      </td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground hidden lg:table-cell">
        {getRegion(product)}
      </td>
      <td className="px-3 py-2.5 text-right">
        {price ? (
          <div className="whitespace-nowrap">
            <span className="text-sm font-bold text-gold">
              {price.base.toLocaleString("ru-RU")}
            </span>
            {/* Multi-unit (W2-8): secondary цена в другой единице
                (например руб/м, когда primary — руб/т). Renders как
                мелкий subtext под основной ценой. */}
            {secondary && (
              <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {(secondary.discount ?? secondary.base).toLocaleString("ru-RU")} ₽/{secondary.unit}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        {price?.discount ? (
          <span className="text-sm font-bold text-gold whitespace-nowrap">
            {price.discount.toLocaleString("ru-RU")}
          </span>
        ) : price ? (
          <span className="text-sm font-bold text-gold whitespace-nowrap">
            {price.base.toLocaleString("ru-RU")}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <button
          onClick={handleCart}
          title="В корзину"
          className={`w-8 h-8 rounded flex items-center justify-center transition-all flex-shrink-0 ${
            added ? "bg-emerald-500/20 text-emerald-500" : "bg-gold/10 hover:bg-gold text-gold hover:text-black"
          }`}
        >
          {added ? <Check size={14} /> : <ShoppingCart size={14} />}
        </button>
      </td>
    </tr>
  );
}

export default function CatalogProductTable({ products, productBasePath }: ProductTableProps) {
  return (
    <>
      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {products.map((product: any) => (
          <MobileProductRow key={product.id} product={product} productBasePath={productBasePath} />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto bg-card border border-border rounded">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Продукция</th>
              <th className="px-3 py-2.5 font-medium text-center">Размер</th>
              <th className="px-3 py-2.5 font-medium hidden md:table-cell">Марка</th>
              <th className="px-3 py-2.5 font-medium text-center hidden md:table-cell">Длина</th>
              <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Регион</th>
              <th className="px-3 py-2.5 font-medium text-right">Цена, руб<br/><span className="normal-case font-normal">от 1 до 5т</span></th>
              <th className="px-3 py-2.5 font-medium text-right">Цена, руб<br/><span className="normal-case font-normal">от 5 до 10т</span></th>
              <th className="px-3 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product: any) => (
              <TableRow key={product.id} product={product} productBasePath={productBasePath} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
