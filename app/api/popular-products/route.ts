import { NextResponse } from "next/server";

export const revalidate = 1800; // 30 min cache

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const h = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    // Fetch categories
    const catRes = await fetch(
      `${url}/rest/v1/categories?select=id,name,slug,parent_id&is_active=eq.true&limit=200`,
      { headers: h }
    );
    const categories: any[] = await catRes.json();
    if (!Array.isArray(categories)) throw new Error("categories fetch failed");

    const catMap = Object.fromEntries(categories.map((c: any) => [c.id, c]));

    // Find root ancestor for any category
    const getRootAncestor = (catId: string): any => {
      let cat = catMap[catId];
      while (cat?.parent_id && catMap[cat.parent_id]) {
        cat = catMap[cat.parent_id];
      }
      return cat;
    };

    // Fetch products — limit 500, no special ordering so we get diverse results
    const prodRes = await fetch(
      `${url}/rest/v1/products?select=id,name,slug,image_url,unit,category_id,price_items(base_price,discount_price)&limit=500&order=id.asc`,
      { headers: h }
    );
    const products: any[] = await prodRes.json();
    if (!Array.isArray(products)) throw new Error("products fetch failed");

    // Group by category_id — pick first with image, fallback to any
    const byCat: Record<string, any[]> = {};
    for (const p of products) {
      if (!p.category_id) continue;
      if (!byCat[p.category_id]) byCat[p.category_id] = [];
      byCat[p.category_id].push(p);
    }

    const pool: any[] = [];
    for (const [catId, prods] of Object.entries(byCat)) {
      const cat = catMap[catId];
      if (!cat) continue;

      // Build full path slugs
      let pathSlugs: string[] = [];
      let cur = cat;
      const visited = new Set<string>();
      while (cur && !visited.has(cur.id)) {
        visited.add(cur.id);
        pathSlugs.unshift(cur.slug);
        cur = cur.parent_id ? catMap[cur.parent_id] : null;
      }
      // URL: /catalog/[...slugs]/[product.slug]
      const root = getRootAncestor(catId);

      // Prefer product with image
      const pick = prods.find(p => p.image_url) ?? prods[0];
      const pi = Array.isArray(pick.price_items) && pick.price_items.length ? pick.price_items[0] : null;

      pool.push({
        id: pick.id,
        name: pick.name,
        slug: pick.slug,
        image_url: pick.image_url ?? null,
        unit: pick.unit ?? "т",
        categoryId: catId,
        categoryName: cat.name,
        rootCatSlug: root?.slug ?? cat.slug,
        basePrice: pi ? Number(pi.base_price) : null,
        yourPrice: pi
          ? (pi.discount_price ? Number(pi.discount_price) : Math.round(Number(pi.base_price) * 0.93))
          : null,
        href: `/catalog/${pathSlugs.join("/")}/${pick.slug}`,
        // for personalization scoring
        searchText: `${pick.name} ${cat.name} ${root?.name ?? ""}`.toLowerCase(),
      });
    }

    return NextResponse.json(pool);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
