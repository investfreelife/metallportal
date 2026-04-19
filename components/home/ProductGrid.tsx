import HomeProductCard from "./HomeProductCard";

export const revalidate = 3600;

async function getPopularProducts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Fetch products that have prices, with category info
  const res = await fetch(
    `${url}/rest/v1/products?select=id,name,slug,image_url,unit,category_id&order=name&limit=500`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } }
  );
  const products: any[] = await res.json();

  // Fetch all price_items
  const piRes = await fetch(
    `${url}/rest/v1/price_items?select=product_id,base_price,discount_price&order=base_price.asc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } }
  );
  const priceItems: any[] = await piRes.json();

  // Fetch categories
  const catRes = await fetch(
    `${url}/rest/v1/categories?select=id,name,slug,parent_id&is_active=eq.true`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } }
  );
  const categories: any[] = await catRes.json();

  // Build category map
  const catMap = Object.fromEntries(categories.map((c: any) => [c.id, c]));

  // Build price map: product_id → first price_item
  const priceMap: Record<string, any> = {};
  for (const pi of priceItems) {
    if (!priceMap[pi.product_id]) priceMap[pi.product_id] = pi;
  }

  // Build enriched products
  const enriched = products
    .filter((p: any) => priceMap[p.id]) // must have price
    .map((p: any) => {
      const cat = catMap[p.category_id];
      const rootCat = cat?.parent_id ? catMap[cat.parent_id] : cat;
      const pi = priceMap[p.id];
      // Build URL: /catalog/[root-slug]/[cat-slug]/[product-slug] or /catalog/[cat-slug]/[product-slug]
      const href = cat?.parent_id
        ? `/catalog/${rootCat?.slug}/${cat.slug}/${p.slug}`
        : `/catalog/${cat?.slug}/${p.slug}`;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        image_url: p.image_url ?? null,
        unit: p.unit ?? "т",
        category: rootCat?.name ?? cat?.name ?? "",
        rootCatId: rootCat?.id ?? cat?.id ?? "",
        rootCatSlug: rootCat?.slug ?? cat?.slug ?? "",
        basePrice: pi.base_price,
        yourPrice: pi.discount_price ?? Math.round(pi.base_price * 0.93),
        href,
      };
    });

  // Pick one product per root category, prefer those with images
  const seen = new Set<string>();
  const result: typeof enriched = [];
  // First pass: with images
  for (const p of enriched) {
    if (p.image_url && !seen.has(p.rootCatId)) {
      seen.add(p.rootCatId);
      result.push(p);
    }
  }
  // Second pass: without images (fill up to 8)
  for (const p of enriched) {
    if (!seen.has(p.rootCatId)) {
      seen.add(p.rootCatId);
      result.push(p);
    }
  }

  return result.slice(0, 8);
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
