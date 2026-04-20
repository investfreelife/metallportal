"use client";
import { useState, useEffect } from "react";

export interface ProductHit {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  unit: string;
  image_url: string | null;
  href: string;
}

export function useProductPrice(query: string): { product: ProductHit | null; loading: boolean } {
  const [product, setProduct] = useState<ProductHit | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 2) { setProduct(null); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=5`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: ProductHit[]) => {
        const hits = Array.isArray(data) ? data : [];
        const withPrice = hits.find(h => h.price !== null) ?? hits[0] ?? null;
        setProduct(withPrice);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  return { product, loading };
}

export function calcTotalRub(product: ProductHit | null, tons: number, meters: number): number {
  if (!product?.price || !tons) return 0;
  const u = (product.unit ?? "т").toLowerCase();
  if (u === "т" || u === "тонна" || u === "тонн") return product.price * tons;
  if (u === "м" || u === "м.п." || u === "пм") return product.price * meters;
  if (u === "кг") return product.price * tons * 1000;
  return product.price * tons;
}
