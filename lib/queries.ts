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
      *,
      category:categories(id, name, slug),
      supplier:suppliers!left(id, company_name, region, city, rating),
      price_items(*, supplier:suppliers!left(id, company_name, region, city, rating, is_verified))
    `
    )
    .in("category_id", categoryIds)
    .eq("is_active", true);

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

export async function getCatalogPageData(): Promise<{
  categories: any[];
  productCounts: Record<string, number>;
}> {
  // Fetch all active categories with parent info
  const { data: allCategories, error: catErr } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (catErr) {
    console.error("getCatalogPageData categories error:", catErr);
    return { categories: [], productCounts: {} };
  }

  // Fetch product counts per category
  const { data: countRows, error: countErr } = await supabase
    .from("products")
    .select("category_id")
    .eq("is_active", true) as { data: { category_id: string }[] | null; error: any };

  const productCounts: Record<string, number> = {};
  if (!countErr && countRows) {
    for (const row of countRows) {
      productCounts[row.category_id] = (productCounts[row.category_id] || 0) + 1;
    }
  }

  const cats = allCategories ?? [];
  const mainCategories = cats.filter((c: any) => !c.parent_id);
  const enriched = mainCategories.map((cat: any) => {
    const subs = cats.filter((c: any) => c.parent_id === cat.id);
    // Sum subcategory counts + direct products for total
    const subTotal = subs.reduce((acc: number, s: any) => acc + (productCounts[s.id] || 0), 0);
    const directCount = productCounts[cat.id] || 0;
    return {
      ...cat,
      subcategories: subs.map((s: any) => ({
        ...s,
        productCount: productCounts[s.id] || 0,
      })),
      totalProducts: directCount + subTotal,
    };
  });

  return { categories: enriched, productCounts };
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
