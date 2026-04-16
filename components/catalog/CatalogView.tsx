"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LayoutGrid, List, ArrowRight } from "lucide-react";
import CatalogFilters from "./Filters";
import CatalogProductTable from "./ProductTable";
import CatalogProductCard from "./ProductCard";

interface CatalogViewProps {
  category: any;
  subcategories: any[];
  products: any[];
  categorySlug: string;
}

export interface FilterState {
  steelGrade: string;
  gost: string;
  coating: string;
  inStock: boolean;
  supplier: string;
  region: string;
  priceMin: number;
  priceMax: number;
  diameterMin: number;
  diameterMax: number;
  thicknessMin: number;
  thicknessMax: number;
}

const defaultFilters: FilterState = {
  steelGrade: "",
  gost: "",
  coating: "",
  inStock: false,
  supplier: "",
  region: "",
  priceMin: 0,
  priceMax: 0,
  diameterMin: 0,
  diameterMax: 0,
  thicknessMin: 0,
  thicknessMax: 0,
};

function getBestPrice(product: any): number | null {
  if (!product.price_items?.length) return null;
  const prices = product.price_items.map(
    (p: any) => p.discount_price ?? p.base_price
  );
  return Math.min(...prices);
}

export default function CatalogView({
  category,
  subcategories,
  products,
  categorySlug,
}: CatalogViewProps) {
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  // Extract unique filter options from products
  const filterOptions = useMemo(() => {
    const steelGrades = new Set<string>();
    const gosts = new Set<string>();
    const coatings = new Set<string>();
    const suppliers = new Set<string>();
    const regions = new Set<string>();

    products.forEach((p: any) => {
      if (p.steel_grade) steelGrades.add(p.steel_grade);
      if (p.gost) gosts.add(p.gost);
      if (p.coating) coatings.add(p.coating);
      if (p.supplier?.company_name) suppliers.add(p.supplier.company_name);
      if (p.supplier?.region) regions.add(p.supplier.region);
    });

    return {
      steelGrades: Array.from(steelGrades),
      gosts: Array.from(gosts),
      coatings: Array.from(coatings),
      suppliers: Array.from(suppliers),
      regions: Array.from(regions),
    };
  }, [products]);

  // Apply filters
  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      if (filters.steelGrade && p.steel_grade !== filters.steelGrade)
        return false;
      if (filters.gost && p.gost !== filters.gost) return false;
      if (filters.coating && p.coating !== filters.coating) return false;
      if (
        filters.supplier &&
        p.supplier?.company_name !== filters.supplier
      )
        return false;
      if (filters.region && p.supplier?.region !== filters.region)
        return false;
      if (filters.inStock) {
        const hasStock = p.price_items?.some((pi: any) => pi.in_stock);
        if (!hasStock) return false;
      }
      if (filters.priceMin > 0 || filters.priceMax > 0) {
        const best = getBestPrice(p);
        if (best === null) return false;
        if (filters.priceMin > 0 && best < filters.priceMin) return false;
        if (filters.priceMax > 0 && best > filters.priceMax) return false;
      }
      if (filters.diameterMin > 0 && (p.diameter ?? 0) < filters.diameterMin)
        return false;
      if (filters.diameterMax > 0 && (p.diameter ?? 999) > filters.diameterMax)
        return false;
      if (
        filters.thicknessMin > 0 &&
        (p.thickness ?? 0) < filters.thicknessMin
      )
        return false;
      if (
        filters.thicknessMax > 0 &&
        (p.thickness ?? 999) > filters.thicknessMax
      )
        return false;
      return true;
    });
  }, [products, filters]);

  return (
    <div className="bg-background min-h-screen">
      <div className="container-main py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6">
          <Link href="/catalog" className="hover:text-gold transition-colors">
            Каталог
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{category.name}</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground mb-6">
          {category.name}
        </h1>

        {/* Subcategories */}
        {subcategories.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-8">
            {subcategories.map((sub: any) => (
              <Link
                key={sub.id}
                href={`/catalog/${categorySlug}?sub=${sub.slug}`}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded hover:border-gold hover:text-gold transition-all text-sm"
              >
                <span>{sub.icon}</span>
                <span>{sub.name}</span>
                <ArrowRight size={14} className="opacity-50" />
              </Link>
            ))}
          </div>
        )}

        {/* View toggle + results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Найдено: {filteredProducts.length} позиций
          </p>
          <div className="flex items-center gap-1 bg-card border border-border rounded p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded transition-all ${
                viewMode === "table"
                  ? "bg-gold text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Таблица"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded transition-all ${
                viewMode === "cards"
                  ? "bg-gold text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Карточки"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {/* Main content: filters + products */}
        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className="w-72 flex-shrink-0">
            <CatalogFilters
              filters={filters}
              onChange={setFilters}
              options={filterOptions}
              onReset={() => setFilters(defaultFilters)}
            />
          </aside>

          {/* Products */}
          <main className="flex-1 min-w-0">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg mb-2">Нет товаров по выбранным фильтрам</p>
                <p className="text-sm">Попробуйте изменить параметры поиска</p>
              </div>
            ) : viewMode === "table" ? (
              <CatalogProductTable
                products={filteredProducts}
                categorySlug={categorySlug}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((product: any) => (
                  <CatalogProductCard
                    key={product.id}
                    product={product}
                    categorySlug={categorySlug}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
