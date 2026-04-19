import HomeProductCard from "./HomeProductCard";

export const revalidate = 3600;

async function getPopularProducts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const opts = { headers: h, next: { revalidate: 3600 } };

  // Fetch all active categories
  const catRes = await fetch(`${url}/rest/v1/categories?select=id,name,slug,parent_id&is_active=eq.true`, opts);
  const categories: any[] = await catRes.json();

  const catMap = Object.fromEntries(categories.map((c: any) => [c.id, c]));
  const rootIds = new Set(categories.filter((c: any) => !c.parent_id).map((c: any) => c.id));

  // Level-2 categories (direct children of roots) — these are the main sections
  const level2 = categories.filter((c: any) => c.parent_id && rootIds.has(c.parent_id));

  // For each level-2 category fetch 1 product with price using !inner join
  const rows = await Promise.all(
    level2.map(async (cat: any) => {
      try {
        const res = await fetch(
          `${url}/rest/v1/products?select=id,name,slug,image_url,unit,price_items!inner(base_price,discount_price)&category_id=eq.${cat.id}&order=name&limit=1`,
          opts
        );
        const data: any[] = await res.json();
        if (!Array.isArray(data) || !data.length) return null;
        const p = data[0];
        const pi = Array.isArray(p.price_items) ? p.price_items[0] : null;
        if (!pi) return null;
        const root = catMap[cat.parent_id];
        return {
          id: p.id,
          name: p.name,
          image_url: p.image_url ?? null,
          unit: p.unit ?? "т",
          category: cat.name,
          rootCatSlug: root?.slug ?? cat.slug,
          basePrice: Number(pi.base_price),
          yourPrice: pi.discount_price ? Number(pi.discount_price) : Math.round(Number(pi.base_price) * 0.93),
          href: `/catalog/${root?.slug}/${cat.slug}/${p.slug}`,
        };
      } catch { return null; }
    })
  );

  return rows.filter(Boolean).slice(0, 8) as NonNullable<(typeof rows)[0]>[];
}

export default async function ProductGrid() {
  const products = await getPopularProducts();

  if (!products.length) return null;

  return (
    <section className="bg-background py-8">
      <div className="container-main">
        <h2 className="text-2xl font-bold text-foreground mb-5">
          Популярные позиции сегодня
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product) => (
            <HomeProductCard
              key={product.id}
              productId={product.id}
              name={product.name}
              category={product.category}
              basePrice={product.basePrice}
              yourPrice={product.yourPrice}
              unit={product.unit}
              image={product.image_url ?? undefined}
              imageUrl={product.image_url}
              href={product.href}
              isConstruction={product.rootCatSlug === "gotovye-konstruktsii"}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
