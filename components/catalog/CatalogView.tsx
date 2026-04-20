"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { LayoutGrid, List, ChevronDown, ChevronUp, Upload, Loader2, Layers } from "lucide-react";
import CatalogProductTable from "./ProductTable";
import CatalogProductCard from "./ProductCard";
import { useSetCatalogFilters } from "@/contexts/CatalogFiltersContext";

async function compressAndUpload(file: File): Promise<string | null> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) { alert("❌ Только JPG, PNG или WebP"); return null; }
  if (file.size > 8 * 1024 * 1024) { alert("❌ Файл больше 8 МБ"); return null; }
  const compressed: File = await new Promise<File>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const maxPx = 1200;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error("canvas failed")); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
      }, "image/webp", 0.85);
    };
    img.onerror = reject; img.src = url;
  }).catch((): File => file);
  const fd = new FormData();
  fd.append("file", compressed); fd.append("folder", "products");
  const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
  const { url } = await res.json();
  return url || null;
}

interface CatalogViewProps {
  category: any;
  subcategories: any[];
  products: any[];
  categorySlug: string;
  activeSubSlug?: string;
  productBasePath?: string; // e.g. "/catalog/metalloprokat/truby-i-profil"
  defaultView?: "table" | "cards";
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
  unit: string;
  roofShape: string;
  roofMaterial: string;
  reinforcement: string;
  purpose: string;
}

const defaultFilters: FilterState = {
  steelGrade: "", gost: "", coating: "", inStock: false,
  supplier: "", region: "", unit: "",
  priceMin: 0, priceMax: 0,
  diameterMin: 0, diameterMax: 0,
  thicknessMin: 0, thicknessMax: 0,
  roofShape: "", roofMaterial: "", reinforcement: "", purpose: "",
};

const SORT_OPTIONS = [
  { label: "По цене ↑", value: "price_asc" },
  { label: "По цене ↓", value: "price_desc" },
  { label: "По наличию", value: "in_stock" },
  { label: "По названию", value: "name_asc" },
];

const PAGE_SIZE = 50;

function getBestPrice(product: any): number | null {
  if (!product.price_items?.length) return null;
  return Math.min(...product.price_items.map((p: any) => Number(p.discount_price ?? p.base_price)));
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  if (!options.length) return null;
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors">
        <option value="">Все</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function RangeFilter({ label, unit, minVal, maxVal, onMinChange, onMaxChange }: {
  label: string; unit?: string; minVal: number; maxVal: number;
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}{unit && <span className="normal-case ml-1">({unit})</span>}
      </label>
      <div className="flex gap-2">
        <input type="number" placeholder="от" value={minVal || ""} onChange={(e) => onMinChange(Number(e.target.value) || 0)}
          className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-gold" />
        <input type="number" placeholder="до" value={maxVal || ""} onChange={(e) => onMaxChange(Number(e.target.value) || 0)}
          className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-gold" />
      </div>
    </div>
  );
}

function FiltersContent({ filters, filterOptions, update, reset, hasActiveFilters, onApply, isNavesy }: {
  filters: FilterState;
  filterOptions: { steelGrades: string[]; gosts: string[]; coatings: string[]; suppliers: string[]; regions: string[]; units: string[]; roofShapes: string[]; roofMaterials: string[]; reinforcements: string[]; purposes: string[] };
  update: (p: Partial<FilterState>) => void;
  reset: () => void;
  hasActiveFilters: boolean;
  onApply?: () => void;
  isNavesy?: boolean;
}) {
  return (
    <div className="space-y-4">
      {isNavesy ? (
        <>
          <SelectFilter label="Форма кровли" value={filters.roofShape} options={filterOptions.roofShapes} onChange={(v) => update({ roofShape: v })} />
          <SelectFilter label="Материал кровли" value={filters.roofMaterial} options={filterOptions.roofMaterials} onChange={(v) => update({ roofMaterial: v })} />
          <SelectFilter label="Усиление" value={filters.reinforcement} options={filterOptions.reinforcements} onChange={(v) => update({ reinforcement: v })} />
          <SelectFilter label="Назначение" value={filters.purpose} options={filterOptions.purposes} onChange={(v) => update({ purpose: v })} />
        </>
      ) : (
        <>
          <SelectFilter label="Марка стали" value={filters.steelGrade} options={filterOptions.steelGrades} onChange={(v) => update({ steelGrade: v })} />
          <SelectFilter label="ГОСТ" value={filters.gost} options={filterOptions.gosts} onChange={(v) => update({ gost: v })} />
          <SelectFilter label="Покрытие" value={filters.coating} options={filterOptions.coatings} onChange={(v) => update({ coating: v })} />
          <SelectFilter label="Единица" value={filters.unit} options={filterOptions.units} onChange={(v) => update({ unit: v })} />
          <SelectFilter label="Поставщик" value={filters.supplier} options={filterOptions.suppliers} onChange={(v) => update({ supplier: v })} />
          <SelectFilter label="Регион" value={filters.region} options={filterOptions.regions} onChange={(v) => update({ region: v })} />
          <RangeFilter label="Цена" unit="₽/т" minVal={filters.priceMin} maxVal={filters.priceMax}
            onMinChange={(v) => update({ priceMin: v })} onMaxChange={(v) => update({ priceMax: v })} />
          <RangeFilter label="Диаметр" unit="мм" minVal={filters.diameterMin} maxVal={filters.diameterMax}
            onMinChange={(v) => update({ diameterMin: v })} onMaxChange={(v) => update({ diameterMax: v })} />
          <RangeFilter label="Толщина" unit="мм" minVal={filters.thicknessMin} maxVal={filters.thicknessMax}
            onMinChange={(v) => update({ thicknessMin: v })} onMaxChange={(v) => update({ thicknessMax: v })} />
        </>
      )}
      <label className="flex items-center gap-3 cursor-pointer">
        <div className="relative flex-shrink-0">
          <input type="checkbox" checked={filters.inStock} onChange={(e) => update({ inStock: e.target.checked })} className="sr-only peer" />
          <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-gold transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
        </div>
        <span className="text-sm">В наличии</span>
      </label>
      {hasActiveFilters && (
        <button onClick={reset} className="w-full text-xs text-muted-foreground hover:text-gold border border-border rounded py-1.5 transition-colors">
          Сбросить все фильтры
        </button>
      )}
      {onApply && (
        <button onClick={onApply} className="w-full bg-gold hover:bg-yellow-400 text-black font-semibold py-2 rounded-lg text-sm transition-all">
          Применить
        </button>
      )}
    </div>
  );
}

export default function CatalogView({ category, subcategories, products, categorySlug, activeSubSlug, productBasePath, defaultView = "table" }: CatalogViewProps) {
  const resolvedProductBasePath = productBasePath ?? `/catalog/${categorySlug}`;
  const isNavesy = categorySlug.startsWith("navesy");
  const [viewMode, setViewMode] = useState<"table" | "cards">(defaultView);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [activeSub, setActiveSub] = useState<string>(activeSubSlug || "");
  const [sortBy, setSortBy] = useState("price_asc");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const setFiltersSlot = useSetCatalogFilters();
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupUploading, setGroupUploading] = useState(false);
  const groupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const on = (e as CustomEvent<boolean>).detail;
      setEditMode(on);
      if (!on) setSelected(new Set());
    };
    window.addEventListener("photoEditMode", handler);
    return () => window.removeEventListener("photoEditMode", handler);
  }, []);

  const toggleSelect = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleGroupUpload = async (file: File) => {
    if (selected.size === 0) return;
    setGroupUploading(true);
    const url = await compressAndUpload(file);
    if (url) {
      await Promise.all(Array.from(selected).map(id =>
        fetch("/api/admin/save-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId: `product:${products.find((p: any) => p.id === id)?.slug}`, url }),
        })
      ));
      setSelected(new Set());
      window.location.reload();
    }
    setGroupUploading(false);
  };

  const update = useCallback((partial: Partial<FilterState>) => { setFilters(f => ({ ...f, ...partial })); setPage(1); }, []);
  const reset = useCallback(() => { setFilters(defaultFilters); setActiveSub(""); setPage(1); }, []);

  const filterOptions = useMemo(() => {
    const steelGrades = new Set<string>();
    const gosts = new Set<string>();
    const coatings = new Set<string>();
    const suppliers = new Set<string>();
    const regions = new Set<string>();
    const units = new Set<string>();
    const roofShapes = new Set<string>();
    const roofMaterials = new Set<string>();
    const reinforcements = new Set<string>();
    const purposes = new Set<string>();
    products.forEach((p: any) => {
      if (p.steel_grade) steelGrades.add(p.steel_grade);
      if (p.gost) gosts.add(p.gost);
      if (p.coating) coatings.add(p.coating);
      if (p.unit) units.add(p.unit);
      // Supplier from direct join OR from price_items
      const supplierName = p.supplier?.company_name
        ?? p.price_items?.find((pi: any) => pi.supplier?.company_name)?.supplier?.company_name;
      if (supplierName) suppliers.add(supplierName);
      const region = p.supplier?.region
        ?? p.price_items?.find((pi: any) => pi.supplier?.region)?.supplier?.region;
      if (region) regions.add(region);
      // Navesy-specific: extract from product name and category slug
      if (isNavesy) {
        const n = p.name ?? "";
        if (/односкат/i.test(n)) roofShapes.add("Односкатный");
        if (/двускат/i.test(n)) roofShapes.add("Двускатный");
        if (/арочн/i.test(n)) roofShapes.add("Арочный");
        if (/полуарочн/i.test(n)) roofShapes.add("Полуарочный");
        if (/четырёхскат|четырехскат/i.test(n)) roofShapes.add("Четырёхскатный");
        if (/поликарбонат/i.test(n)) roofMaterials.add("Поликарбонат");
        if (/профнастил/i.test(n)) roofMaterials.add("Профнастил");
        if (/металлочерепиц/i.test(n)) roofMaterials.add("Металлочерепица");
        if (/сверхусиленн/i.test(n)) reinforcements.add("Сверхусиленный");
        else if (/усиленн/i.test(n)) reinforcements.add("Усиленный");
        const slug = p.category?.slug ?? "";
        if (/avtomobil/i.test(slug)) purposes.add("Для автомобиля");
        if (/parkovk/i.test(slug)) purposes.add("Для парковки");
        if (/besedka/i.test(slug)) purposes.add("Беседка");
        if (/dachi/i.test(slug)) purposes.add("Для дачи");
        if (/hozblokom/i.test(slug)) purposes.add("С хозблоком");
      }
    });
    return {
      steelGrades: Array.from(steelGrades).sort(),
      gosts: Array.from(gosts).sort(),
      coatings: Array.from(coatings).sort(),
      suppliers: Array.from(suppliers).sort(),
      regions: Array.from(regions).sort(),
      units: Array.from(units).sort(),
      roofShapes: Array.from(roofShapes).sort(),
      roofMaterials: Array.from(roofMaterials).sort(),
      reinforcements: Array.from(reinforcements).sort(),
      purposes: Array.from(purposes).sort(),
    };
  }, [products, isNavesy]);

  // Filter by subcategory chip
  const subFilteredProducts = useMemo(() => {
    if (!activeSub) return products;
    return products.filter((p: any) => p.category?.slug === activeSub);
  }, [products, activeSub]);

  // Apply all filters
  const filteredProducts = useMemo(() => {
    return subFilteredProducts.filter((p: any) => {
      if (filters.steelGrade && p.steel_grade !== filters.steelGrade) return false;
      if (filters.gost && p.gost !== filters.gost) return false;
      if (filters.coating && p.coating !== filters.coating) return false;
      if (filters.unit && p.unit !== filters.unit) return false;
      if (filters.supplier) {
        const name = p.supplier?.company_name
          ?? p.price_items?.find((pi: any) => pi.supplier?.company_name)?.supplier?.company_name;
        if (name !== filters.supplier) return false;
      }
      if (filters.region) {
        const reg = p.supplier?.region
          ?? p.price_items?.find((pi: any) => pi.supplier?.region)?.supplier?.region;
        if (reg !== filters.region) return false;
      }
      if (filters.inStock && !p.price_items?.some((pi: any) => pi.in_stock)) return false;
      if (filters.priceMin > 0 || filters.priceMax > 0) {
        const best = getBestPrice(p);
        if (best === null) return false;
        if (filters.priceMin > 0 && best < filters.priceMin) return false;
        if (filters.priceMax > 0 && best > filters.priceMax) return false;
      }
      if (filters.diameterMin > 0 && (p.diameter ?? 0) < filters.diameterMin) return false;
      if (filters.diameterMax > 0 && (p.diameter ?? 999) > filters.diameterMax) return false;
      if (filters.thicknessMin > 0 && (p.thickness ?? 0) < filters.thicknessMin) return false;
      if (filters.thicknessMax > 0 && (p.thickness ?? 999) > filters.thicknessMax) return false;
      // Navesy filters
      const nm = p.name ?? "";
      if (filters.roofShape) {
        const shapeMap: Record<string, RegExp> = {
          "Односкатный": /односкат/i, "Двускатный": /двускат/i,
          "Арочный": /арочн/i, "Полуарочный": /полуарочн/i,
          "Четырёхскатный": /четырёхскат|четырехскат/i,
        };
        if (!shapeMap[filters.roofShape]?.test(nm)) return false;
      }
      if (filters.roofMaterial) {
        const matMap: Record<string, RegExp> = {
          "Поликарбонат": /поликарбонат/i,
          "Профнастил": /профнастил/i,
          "Металлочерепица": /металлочерепиц/i,
        };
        if (!matMap[filters.roofMaterial]?.test(nm)) return false;
      }
      if (filters.reinforcement) {
        if (filters.reinforcement === "Сверхусиленный" && !/сверхусиленн/i.test(nm)) return false;
        if (filters.reinforcement === "Усиленный" && !/усиленн/i.test(nm)) return false;
      }
      if (filters.purpose) {
        const slug = p.category?.slug ?? "";
        const purposeMap: Record<string, RegExp> = {
          "Для автомобиля": /avtomobil/i, "Для парковки": /parkovk/i,
          "Беседка": /besedka/i, "Для дачи": /dachi/i, "С хозблоком": /hozblokom/i,
        };
        if (!purposeMap[filters.purpose]?.test(slug)) return false;
      }
      return true;
    });
  }, [subFilteredProducts, filters]);

  // Sort
  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    switch (sortBy) {
      case "price_asc": return arr.sort((a, b) => (getBestPrice(a) ?? 999999) - (getBestPrice(b) ?? 999999));
      case "price_desc": return arr.sort((a, b) => (getBestPrice(b) ?? 0) - (getBestPrice(a) ?? 0));
      case "in_stock": return arr.sort((a, b) => {
        const as = a.price_items?.some((p: any) => p.in_stock) ? 0 : 1;
        const bs = b.price_items?.some((p: any) => p.in_stock) ? 0 : 1;
        return as - bs;
      });
      case "name_asc": return arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      default: return arr;
    }
  }, [filteredProducts, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedProducts.length / PAGE_SIZE);
  const paginatedProducts = sortedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasActiveFilters = Object.entries(filters).some(([k, v]) => k === "inStock" ? v : v !== 0 && v !== "");

  useEffect(() => {
    setFiltersSlot(
      <FiltersContent
        filters={filters}
        filterOptions={filterOptions}
        update={update}
        reset={reset}
        hasActiveFilters={hasActiveFilters}
        isNavesy={isNavesy}
      />
    );
    return () => setFiltersSlot(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, filterOptions, hasActiveFilters, isNavesy]);

  return (
    <div>
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
          <span className="mx-2">/</span>
          <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{category.name}</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground mb-5">{category.name}</h1>

        {/* Subcategory chips */}
        {subcategories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              onClick={() => { setActiveSub(""); setPage(1); }}
              className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                !activeSub ? "bg-gold text-black" : "bg-card border border-border hover:border-gold text-muted-foreground hover:text-foreground"
              }`}
            >
              Все ({products.length})
            </button>
            {subcategories.map((sub: any) => {
              const count = products.filter((p: any) => p.category?.slug === sub.slug).length;
              return (
                <button
                  key={sub.id}
                  onClick={() => { setActiveSub(activeSub === sub.slug ? "" : sub.slug); setPage(1); }}
                  className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                    activeSub === sub.slug
                      ? "bg-gold text-black"
                      : "bg-card border border-border hover:border-gold text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sub.icon && <span className="mr-1.5">{sub.icon}</span>}
                  {sub.name}
                  {count > 0 && <span className="ml-1.5 opacity-60">({count})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Sort + View toggle */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden flex items-center gap-2 px-3 py-1.5 border border-border rounded text-sm hover:border-gold transition-colors"
            >
              <ChevronDown size={14} /> Фильтры{hasActiveFilters ? <span className="ml-1 w-2 h-2 rounded-full bg-gold inline-block" /> : null}
            </button>
            <span className="text-sm text-muted-foreground">
              Найдено: <strong className="text-foreground">{filteredProducts.length}</strong> позиций
            </span>
            {hasActiveFilters && (
              <button onClick={reset} className="text-xs text-gold hover:underline">
                Сбросить фильтры
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="bg-card border border-border rounded px-3 py-1.5 text-sm text-foreground outline-none focus:border-gold">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex items-center gap-1 bg-card border border-border rounded p-1">
              <button onClick={() => setViewMode("table")}
                className={`p-2 rounded transition-all ${viewMode === "table" ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground"}`}
                title="Таблица"><List size={16} /></button>
              <button onClick={() => setViewMode("cards")}
                className={`p-2 rounded transition-all ${viewMode === "cards" ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground"}`}
                title="Карточки"><LayoutGrid size={16} /></button>
            </div>
          </div>
        </div>

        {/* Main: products only (filters are in left sidebar via context) */}
        <div>
          <main className="min-w-0">
            {paginatedProducts.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg mb-2">Нет товаров по выбранным фильтрам</p>
                <p className="text-sm mb-4">Попробуйте изменить параметры поиска</p>
                <button onClick={reset} className="text-gold hover:underline text-sm">Сбросить фильтры</button>
              </div>
            ) : viewMode === "table" ? (
              <CatalogProductTable products={paginatedProducts} productBasePath={resolvedProductBasePath} />
            ) : (
              <>
                {/* Group upload bar */}
                {editMode && selected.size > 0 && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-gold/10 border border-gold/30 rounded-xl">
                    <Layers size={15} className="text-gold flex-shrink-0" />
                    <span className="text-gold text-sm font-medium flex-1">Выбрано: {selected.size} товаров</span>
                    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm cursor-pointer ${
                      groupUploading ? "bg-muted text-muted-foreground" : "bg-gold text-black hover:bg-yellow-400"
                    }`}>
                      {groupUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {groupUploading ? "Загружаю..." : "Одно фото для всех"}
                      <input ref={groupInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                        className="hidden" disabled={groupUploading}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleGroupUpload(f); }} />
                    </label>
                    <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground text-sm px-2">
                      Сбросить
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedProducts.map((product: any, index: number) => (
                    <CatalogProductCard
                      key={product.id}
                      product={product}
                      productBasePath={resolvedProductBasePath}
                      isSelected={selected.has(product.id)}
                      onToggle={editMode ? toggleSelect : undefined}
                      priority={index < 6}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 bg-card border border-border rounded text-sm hover:border-gold disabled:opacity-40 transition-all">
                  ←
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = i + Math.max(1, page - 3);
                  if (p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded text-sm transition-all ${p === page ? "bg-gold text-black font-bold" : "bg-card border border-border hover:border-gold"}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-2 bg-card border border-border rounded text-sm hover:border-gold disabled:opacity-40 transition-all">
                  →
                </button>
              </div>
            )}
          </main>
        </div>
    </div>
  );
}
