import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const h = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    // Fetch categories to build path map
    const catRes = await fetch(
      `${url}/rest/v1/categories?select=id,name,slug,parent_id&is_active=eq.true&limit=300`,
      { headers: h }
    );
    const categories: any[] = await catRes.json();
    const catMap: Record<string, any> = Object.fromEntries(categories.map((c) => [c.id, c]));

    // Build full slug path for a category (root → leaf)
    const buildPath = (catId: string): string[] => {
      const slugs: string[] = [];
      let cat = catMap[catId];
      const visited = new Set<string>();
      while (cat && !visited.has(cat.id)) {
        visited.add(cat.id);
        slugs.unshift(cat.slug);
        cat = cat.parent_id ? catMap[cat.parent_id] : null;
      }
      return slugs;
    };

    // Search products
    const encoded = encodeURIComponent(`%${q}%`);
    const prodRes = await fetch(
      `${url}/rest/v1/products?select=id,name,slug,image_url,unit,category_id,price_items(base_price,discount_price)&name=ilike.${encoded}&limit=10&order=name.asc`,
      { headers: h }
    );
    const products: any[] = await prodRes.json();
    if (!Array.isArray(products)) return NextResponse.json([]);

    const results = products.map((p) => {
      const pathSlugs = buildPath(p.category_id);
      const pi = Array.isArray(p.price_items) && p.price_items.length ? p.price_items[0] : null;
      const cat = catMap[p.category_id];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        image_url: p.image_url ?? null,
        unit: p.unit ?? "т",
        categoryName: cat?.name ?? "",
        price: pi ? Math.round(Number(pi.discount_price ?? pi.base_price)) : null,
        href: `/catalog/${[...pathSlugs, p.slug].join("/")}`,
      };
    });

    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
