"use client";
import { useEffect, useState } from "react";
import HomeProductCard from "./HomeProductCard";

const SHOWN = 4;

function pickProducts(pool: any[], searches: string[]): any[] {
  if (!pool.length) return [];

  // Score each product: +10 per search keyword match, small random jitter
  const scored = pool.map(p => {
    let score = Math.random() * 5; // base random
    for (const term of searches) {
      if (term && p.searchText?.includes(term.toLowerCase())) score += 10;
    }
    return { ...p, _score: score };
  });

  // Sort descending by score, then deduplicate by categoryId (one per category)
  scored.sort((a, b) => b._score - a._score);
  const seenCat = new Set<string>();
  const picked: any[] = [];
  for (const p of scored) {
    if (!seenCat.has(p.categoryId)) {
      seenCat.add(p.categoryId);
      picked.push(p);
      if (picked.length >= SHOWN) break;
    }
  }
  // Fill remaining if not enough diversity
  if (picked.length < SHOWN) {
    for (const p of scored) {
      if (!picked.find(x => x.id === p.id)) {
        picked.push(p);
        if (picked.length >= SHOWN) break;
      }
    }
  }
  return picked;
}

export default function ProductGrid() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let searches: string[] = [];
    try {
      const raw = localStorage.getItem("search_recent");
      if (raw) searches = JSON.parse(raw);
    } catch {}

    fetch("/api/popular-products")
      .then(r => r.json())
      .then(pool => {
        if (Array.isArray(pool)) setProducts(pickProducts(pool, searches));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="bg-background py-8">
        <div className="container-main">
          <h2 className="text-2xl font-bold text-foreground mb-5">Популярные позиции сегодня</h2>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0 scrollbar-none">
            <div className="flex gap-3 sm:grid sm:grid-flow-col sm:auto-cols-fr">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-[170px] flex-shrink-0 sm:w-auto bg-card border border-border rounded h-72 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!products.length) return null;

  return (
    <section className="bg-background py-8">
      <div className="container-main">
        <h2 className="text-2xl font-bold text-foreground mb-5">
          Популярные позиции сегодня
        </h2>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0 scrollbar-none">
          <div className="flex gap-3 sm:grid sm:grid-flow-col sm:auto-cols-fr">
            {products.map((product) => (
              <div key={product.id} className="w-[170px] flex-shrink-0 sm:w-auto">
                <HomeProductCard
                  productId={product.id}
                  name={product.name}
                  category={product.categoryName}
                  basePrice={product.basePrice}
                  yourPrice={product.yourPrice}
                  unit={product.unit}
                  image={product.image_url ?? undefined}
                  imageUrl={product.image_url}
                  href={product.href}
                  isConstruction={product.rootCatSlug === "gotovye-konstruktsii"}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
