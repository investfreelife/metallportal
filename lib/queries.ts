import { supabase } from "./supabase";

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

  // Get products for this category and all its subcategories
  const categoryIds = [category.id, ...subcategories.map((s) => s.id)];

  const { data: products, error } = await supabase
    .from("products")
    .select(
      `
      id, name, slug, image_url, unit, dimensions, gost, steel_grade,
      diameter, thickness, coating, material,
      category:categories(id, name, slug),
      price_items(base_price, discount_price, in_stock,
        supplier:suppliers!left(id, company_name, region, city))
    `
    )
    .in("category_id", categoryIds)
    .eq("is_active", true)
    .limit(5000);

  if (error) {
    console.error("getCategoryWithChildren products error:", error);
  }

  return {
    category,
    subcategories,
    products: products ?? [],
  };
}

export async function getProductBySlug(slug: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories(id, name, slug, parent_id,
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
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, unit, gost, steel_grade, price_items(*)")
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .eq("is_active", true)
    .limit(limit);
  if (error) { console.error("getRelatedProducts error:", error); return []; }
  return data ?? [];
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

export function sumCounts(catId: string, allCats: any[], counts: Record<string, number>): number {
  const direct = counts[catId] || 0;
  const children = allCats.filter((c: any) => c.parent_id === catId);
  const childSum = children.reduce((acc: number, c: any) => acc + sumCounts(c.id, allCats, counts), 0);
  return direct + childSum;
}

export async function getFullCategoryTree(): Promise<any[]> {
  const [{ data: allCategories, error }, counts] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    getProductCounts(),
  ]);

  if (error) {
    console.error("getFullCategoryTree error:", error);
    return [];
  }

  const cats = allCategories ?? [];

  const buildLevel = (parentId: string | null): any[] =>
    cats
      .filter((c: any) => (parentId ? c.parent_id === parentId : !c.parent_id))
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
