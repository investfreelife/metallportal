import { supabase } from "./supabase";
import {
  MARKETPLACE_CUTOVER_ENABLED,
  sellerOfferToPriceItem,
} from "./marketplaceCutover";

export async function getMainCategories(): Promise<any[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("getMainCategories error:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Resolve aggregated category slugs к карточкам с полным href + recursive product count.
 * Используется для virtual aggregator pages (категории с aggregated_category_slugs).
 *
 * Per Sergey 2026-05-09: «потяни в них сразу разделы которые уже существуют у нас в базе
 * не создавай новые». Source-of-truth категории остаются в их parents — этот хелпер
 * только resolved их paths для отображения карточками.
 */
export async function getAggregatedCategoryCards(slugs: string[]): Promise<any[]> {
  if (!slugs || slugs.length === 0) return [];
  const { data: targets } = await supabase
    .from("categories")
    .select("id, slug, name, image_url, icon, description, parent_id, is_active")
    .in("slug", slugs)
    .eq("is_active", true);
  if (!targets || targets.length === 0) return [];

  // Walk parents для каждой category — build full path
  const { data: allCats } = await supabase
    .from("categories")
    .select("id, slug, parent_id");
  const byId = new Map((allCats ?? []).map((c: any) => [c.id, c]));

  const counts = await getProductCounts();
  const catList = (allCats ?? []).map((c: any) => ({ id: c.id, parent_id: c.parent_id }));

  const result = targets.map((cat: any) => {
    // Walk parents
    const path: string[] = [cat.slug];
    let cur = cat;
    while (cur.parent_id) {
      const p: any = byId.get(cur.parent_id);
      if (!p) break;
      path.unshift(p.slug);
      cur = p;
    }
    const fullHref = `/catalog/${path.join("/")}`;
    return {
      ...cat,
      fullHref,
      totalProducts: sumCounts(cat.id, catList, counts),
    };
  });

  // Sort по order слугов в input array
  const order = new Map(slugs.map((s, i) => [s, i]));
  result.sort((a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999));
  return result;
}

/**
 * Fetch seller_offers для product с привязкой к suppliers (seller info).
 * Layer 3 frontend aggregation per LAW-marketplace-architecture.
 *
 * Returns active+in_stock offers sorted: buy_box first, then by final_price ASC.
 * Includes seller info (company_name, rating, verified) для отображения.
 */
export async function getProductSellerOffers(productId: string): Promise<any[]> {
  if (!productId) return [];
  const { data, error } = await (supabase as any)
    .from("seller_offers")
    .select(`
      id, product_id, seller_id, base_price, final_price, currency, unit,
      in_stock, stock_quantity, min_quantity, min_order_qty,
      lead_time_days, regions_served, is_active, is_buy_box, valid_until,
      seller:suppliers!seller_id(id, company_name, is_verified, rating, region, city)
    `)
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("is_buy_box", { ascending: false })
    .order("final_price", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getProductSellerOffers error:", error);
    return [];
  }
  return data ?? [];
}

export async function getCategoryBySlug(slug: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("getCategoryBySlug error:", error);
    return null;
  }
  return data;
}

export async function getSubcategories(parentId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("getSubcategories error:", error);
    return [];
  }
  return data ?? [];
}

export async function getCategoryWithChildren(slug: string) {
  const category = await getCategoryBySlug(slug);
  if (!category) return null;

  const subcategories = await getSubcategories(category.id);

  // Direct category IDs (own + immediate children)
  const directIds = [category.id, ...subcategories.map((s) => s.id)];

  // ТЗ #048: Dynamic aggregator pattern.
  // Если у категории есть aggregated_category_slugs — собрать также products
  // из тех categories для unified view (Металлсервис style).
  // Pattern: товары физически живут в их home category, но "virtually" видны
  // в aggregator при чтении. Никакого дублирования records.
  let aggregatedIds: string[] = [];
  const aggSlugs = (category as any).aggregated_category_slugs as string[] | null | undefined;
  if (aggSlugs && Array.isArray(aggSlugs) && aggSlugs.length > 0) {
    const { data: aggCats } = await supabase
      .from("categories")
      .select("id, slug")
      .in("slug", aggSlugs)
      .eq("is_active", true);
    aggregatedIds = (aggCats ?? []).map((c: any) => c.id);
    // Также подтянуть children of aggregated categories (если у source category
    // есть subcategories, например shveller-goryachekatanyy → его собственные L4)
    if (aggregatedIds.length > 0) {
      const { data: aggChildren } = await supabase
        .from("categories")
        .select("id")
        .in("parent_id", aggregatedIds)
        .eq("is_active", true);
      aggregatedIds = aggregatedIds.concat((aggChildren ?? []).map((c: any) => c.id));
    }
  }

  // Merge ids — direct first, aggregated after. Dedupe (just in case).
  const categoryIds = Array.from(new Set([...directIds, ...aggregatedIds]));

  // ТЗ #042: cutover-aware select.
  // flag OFF (default) → JOIN price_items напрямую (legacy behavior, sub-select)
  // flag ON → select products БЕЗ price_items, потом hydrateProductsWithSellerOffers
  const productSelect = MARKETPLACE_CUTOVER_ENABLED
    ? `
      id, name, slug, image_url, image_urls, unit, dimensions, gost, steel_grade,
      diameter, thickness, coating, material, length, length_options,
      price_per_m2, roof_shape, roof_material, min_area_m2, reinforcement_type,
      category_id,
      category:categories!category_id(id, name, slug)
    `
    : `
      id, name, slug, image_url, image_urls, unit, dimensions, gost, steel_grade,
      diameter, thickness, coating, material, length, length_options,
      price_per_m2, roof_shape, roof_material, min_area_m2, reinforcement_type,
      category_id,
      category:categories!category_id(id, name, slug),
      price_items(base_price, discount_price, in_stock, unit,
        supplier:suppliers!left(id, company_name, region, city))
    `;

  const { data: products, error } = await supabase
    .from("products")
    .select(productSelect)
    .in("category_id", categoryIds)
    .eq("is_active", true)
    .limit(1500); // ТЗ #051: 5000→1500 для perf (большие aggregators типа /krug)

  if (error) {
    console.error("getCategoryWithChildren products error:", error);
  }

  // Dedupe by product.id (если бы товар случайно был в 2 categoryIds — paranoia)
  const seen = new Set<string>();
  const uniqueProducts = ((products ?? []) as any[]).filter((p: any) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Hydrate с seller_offers если cutover ON (no-op otherwise)
  const hydrated = await hydrateProductsWithSellerOffers(uniqueProducts);

  return {
    category,
    subcategories,
    products: hydrated,
  };
}

export async function getProductBySlug(slug: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories!category_id(id, name, slug, parent_id,
        parent:categories(id, name, slug)
      ),
      supplier:suppliers!left(id, company_name, region, city, rating)
    `
    )
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("getProductBySlug error:", error);
    return null;
  }
  return data;
}

export async function getRelatedProducts(categoryId: string, excludeId: string, limit = 6): Promise<any[]> {
  // ТЗ #042: cutover-aware — flag ON skips price_items JOIN, потом hydrate batch
  const select = MARKETPLACE_CUTOVER_ENABLED
    ? "id, name, slug, unit, gost, steel_grade"
    : "id, name, slug, unit, gost, steel_grade, price_items(*)";

  const { data, error } = await supabase
    .from("products")
    .select(select)
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .eq("is_active", true)
    .limit(limit);
  if (error) { console.error("getRelatedProducts error:", error); return []; }

  return await hydrateProductsWithSellerOffers((data ?? []) as any[]);
}

export async function getProductCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("get_product_counts");

  const counts: Record<string, number> = {};
  if (!error && data) {
    for (const row of data as { category_id: string; count: number }[]) {
      counts[row.category_id] = Number(row.count);
    }
  }
  return counts;
}

/**
 * Возвращает количество товаров для категории (включая всех потомков).
 *
 * **ВАЖНО:** RPC `get_product_counts()` уже считает рекурсивно через CTE
 * (см. supabase/migrations/20260526120000_get_product_counts_rpc.sql).
 * Поэтому здесь НЕ нужно сумировать children — это даст double/triple-count.
 *
 * Параметр `_allCats` оставлен для backward-compat с call sites, но не используется.
 *
 * Bug fix: до 2026-05-06 эта функция делала `direct + sum(children)` поверх
 * recursive RPC counts → counts на /catalog отображались в 2-3× больше реальных
 * (Sergey screenshot: Сортовой 6201 vs реально 2067; Денис #a009 audit подтвердил).
 */
export function sumCounts(catId: string, _allCats: any[], counts: Record<string, number>): number {
  return counts[catId] || 0;
}

/**
 * Полный tree категорий, опционально отфильтрованный по section.
 *
 * Sections (Иван #026): root-level categories помечены `display_section`
 * (`metallоprokat` или `constructions`). Если `section` передан — root
 * filter'ятся: остаются только roots с matching display_section, потом
 * рекурсивно строится их subtree.
 *
 * `section=undefined` — backward-compat (full tree, как было до n006).
 */
export async function getFullCategoryTree(section?: string): Promise<any[]> {
  const [{ data: allCategories, error }, counts] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    getProductCounts(),
  ]);

  if (error) {
    console.error("getFullCategoryTree error:", error);
    return [];
  }

  const cats = allCategories ?? [];

  // Set roots по section. Если section задан — только matching roots,
  // их descendants всегда in (children inherit parent's section visually).
  const allowedRootIds = section
    ? new Set(
        cats
          .filter((c: any) => !c.parent_id && c.display_section === section)
          .map((c: any) => c.id),
      )
    : null;

  const buildLevel = (parentId: string | null): any[] =>
    cats
      .filter((c: any) => {
        if (parentId) return c.parent_id === parentId;
        // Root level — apply section filter if requested
        if (!c.parent_id) {
          return allowedRootIds === null || allowedRootIds.has(c.id);
        }
        return false;
      })
      .map((c: any) => {
        const children = buildLevel(c.id);
        const totalProducts = sumCounts(c.id, cats, counts);
        return {
          ...c,
          productCount: counts[c.id] || 0,
          totalProducts,
          subcategories: children,
        };
      });

  return buildLevel(null);
}

export async function getCatalogPageData(): Promise<{
  categories: any[];
  productCounts: Record<string, number>;
}> {
  const categories = await getFullCategoryTree();
  const counts = await getProductCounts();
  return { categories, productCounts: counts };
}

export async function getProductPriceItems(productId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("price_items")
    .select(
      `
      *,
      supplier:suppliers(id, company_name, region, city, rating, is_verified)
    `
    )
    .eq("product_id", productId)
    .order("base_price", { ascending: true });

  if (error) {
    console.error("getProductPriceItems error:", error);
    return [];
  }
  return data ?? [];
}

/**
 * ТЗ #041 — Cutover-aware price fetcher для product detail page.
 *
 * Когда `NEXT_PUBLIC_MARKETPLACE_CUTOVER=1` — читаем `seller_offers` (Layer 2)
 * и адаптируем в price_items shape для drop-in замены в PriceBlock / ProductTabs.
 * Иначе fallback к legacy `getProductPriceItems` (price_items напрямую).
 *
 * SellerOffersSection (#040) продолжает читать seller_offers напрямую через
 * getProductSellerOffers — так visual-вид списка офферов не зависит от flag.
 *
 * Returns price_items-shaped array (sorted by base_price ASC), готовый для:
 *   - PriceBlock (best-price computation + calculator)
 *   - ProductTabs (price tab)
 *   - JSON-LD schema offers
 *   - SupplierPriceTable
 */
export async function getProductPriceItemsCutoverAware(
  productId: string,
): Promise<any[]> {
  if (!MARKETPLACE_CUTOVER_ENABLED) {
    return getProductPriceItems(productId);
  }

  // Cutover ON: читаем seller_offers, адаптируем в price_items shape
  const { data, error } = await (supabase as any)
    .from("seller_offers")
    .select(`
      id, product_id, seller_id, base_price, final_price, currency, unit,
      in_stock, stock_quantity, min_quantity, lead_time_days, is_active,
      is_buy_box,
      seller:suppliers!seller_id(id, company_name, region, city, rating, is_verified)
    `)
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("base_price", { ascending: true });

  if (error) {
    console.error("getProductPriceItemsCutoverAware (seller_offers) error:", error);
    // Graceful degradation — если seller_offers недоступен, fallback к price_items
    return getProductPriceItems(productId);
  }

  return (data ?? []).map(sellerOfferToPriceItem);
}

/**
 * ТЗ #042 — Batch hydration: attach seller_offers (adapted в price_items shape)
 * к array продуктов в одном round-trip.
 *
 * Используется catalog list views (CatalogView, ProductCard, ProductTable),
 * которые читают `product.price_items` from JOIN. После hydration components
 * остаются untouched — same shape, just data из seller_offers вместо price_items.
 *
 * Flag-gated: когда `MARKETPLACE_CUTOVER_ENABLED=false` — no-op (preserves
 * existing price_items field из getCategoryWithChildren legacy JOIN).
 *
 * Performance: single `IN(productIds)` query вместо N+1.
 *
 * Mutates products in place AND returns the array (для chain-friendly usage).
 */
export async function hydrateProductsWithSellerOffers<T extends { id: string }>(
  products: T[],
): Promise<T[]> {
  if (!MARKETPLACE_CUTOVER_ENABLED || products.length === 0) {
    return products;
  }

  const productIds = products.map((p) => p.id);

  // ТЗ #051 perf fix: для больших aggregator pages (1000+ products) IN clause
  // становится медленным. Chunkим по 250 и Promise.all для parallel fetch.
  const CHUNK = 250;
  const chunks: string[][] = [];
  for (let i = 0; i < productIds.length; i += CHUNK) {
    chunks.push(productIds.slice(i, i + CHUNK));
  }

  const results = await Promise.all(
    chunks.map((idChunk) =>
      (supabase as any)
        .from("seller_offers")
        .select(`
          id, product_id, seller_id, base_price, final_price, currency, unit,
          in_stock, stock_quantity, min_quantity, lead_time_days, is_active,
          is_buy_box,
          seller:suppliers!seller_id(id, company_name, region, city, rating, is_verified)
        `)
        .in("product_id", idChunk)
        .eq("is_active", true),
    ),
  );

  // Aggregate offers across chunks
  const offersByProduct = new Map<string, any[]>();
  let hadError = false;
  for (const { data, error } of results) {
    if (error) {
      console.error("hydrateProductsWithSellerOffers chunk error:", error);
      hadError = true;
      continue;
    }
    for (const offer of data ?? []) {
      const list = offersByProduct.get(offer.product_id) ?? [];
      list.push(sellerOfferToPriceItem(offer));
      offersByProduct.set(offer.product_id, list);
    }
  }

  if (hadError && offersByProduct.size === 0) {
    // Graceful degradation: ни одного успешного chunk → оставляем как было
    return products;
  }

  // Attach к each product as `price_items` (legacy field name preserved)
  for (const product of products) {
    const offers = offersByProduct.get(product.id) ?? [];
    // Sort by base_price ASC (matches getProductPriceItems ORDER BY)
    offers.sort((a, b) => Number(a.base_price ?? Infinity) - Number(b.base_price ?? Infinity));
    (product as any).price_items = offers;
  }

  return products;
}
