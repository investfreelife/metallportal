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

function MobileProductRow({ product, productBasePath }: { product: any; productBasePath: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const price = getBestPrice(product);
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

function TableRow({ product, productBasePath }: { product: any; productBasePath: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const price = getBestPrice(product);
  const inStock = hasStock(product);

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ id: product.id, name: product.name, slug: product.slug, unit: product.unit, price: price ? (price.discount ?? price.base) : null, image_url: product.image_url ?? null });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <tr className="border-b border-border hover:bg-background/50 transition-colors">
      <td className="px-3 py-2.5">
        <Link href={`${productBasePath}/${product.slug}`} className="text-sm font-medium text-foreground hover:text-gold transition-colors line-clamp-2">
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
            {price.discount && <span className="text-xs text-muted-foreground line-through mr-2">{price.base.toLocaleString("ru-RU")}</span>}
            <span className="text-sm font-bold text-gold whitespace-nowrap">
              {(price.discount ?? price.base).toLocaleString("ru-RU")} ₽/{price.unit}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">По запросу</span>
        )}
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell">
        <span className={`inline-block text-xs font-medium px-2 py-1 rounded ${inStock ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
          {inStock ? "В наличии" : "Под заказ"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground hidden lg:table-cell">
        {getSupplierName(product)}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCart}
            title="В корзину"
            className={`w-8 h-8 rounded flex items-center justify-center transition-all flex-shrink-0 ${
              added ? "bg-emerald-500/20 text-emerald-500" : "bg-gold/10 hover:bg-gold text-gold hover:text-black"
            }`}
          >
            {added ? <Check size={14} /> : <ShoppingCart size={14} />}
          </button>
          <Link href={`${productBasePath}/${product.slug}`} className="text-xs border border-gold text-gold hover:bg-gold hover:text-black font-medium px-3 py-1.5 rounded transition-all whitespace-nowrap">
            Подробнее
          </Link>
        </div>
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
            {products.map((product: any) => (
              <TableRow key={product.id} product={product} productBasePath={productBasePath} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
