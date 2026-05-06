import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";

const BASE_URL = SITE_URL;

/**
 * Supabase REST API имеет hard cap 1000 строк per query (PostgREST default).
 * Чтобы вытащить полный каталог (5400+ SKU и растёт) — paginate'им через
 * `.range()`. SAFETY_CAP — защита от infinite loop при schema-баге.
 *
 * Sitemap protocol limit — 50000 URL per file. Если каталог превысит — нужен
 * sharding на `sitemap-products-{N}.xml` + index sitemap. На текущих ~5500
 * SKU + ~250 categories + 9 static — мы далеко до этого порога.
 */
const PAGE_SIZE = 1000;
const SAFETY_CAP = 100_000;

async function fetchAll<T>(
  query: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < SAFETY_CAP; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/catalog`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${BASE_URL}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/contacts`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/ai-search`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/supplier`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/oferta`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const cats = await fetchAll<{ id: string; slug: string; parent_id: string | null }>(
    (from, to) =>
      supabase
        .from("categories")
        .select("id, slug, parent_id")
        .eq("is_active", true)
        .range(from, to) as any,
  );
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const categoryUrls: MetadataRoute.Sitemap = cats.map((cat) => {
    const parent = cat.parent_id ? catMap.get(cat.parent_id) : null;
    const grandParent = parent?.parent_id ? catMap.get(parent.parent_id) : null;

    let url: string;
    if (!parent) {
      url = `${BASE_URL}/catalog/${cat.slug}`;
    } else if (!grandParent) {
      url = `${BASE_URL}/catalog/${parent.slug}/${cat.slug}`;
    } else {
      url = `${BASE_URL}/catalog/${grandParent.slug}/${parent.slug}/${cat.slug}`;
    }

    return {
      url,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: !parent ? 0.9 : !grandParent ? 0.7 : 0.6,
    };
  });

  type ProductRow = {
    slug: string;
    category: {
      slug: string;
      parent_id: string | null;
      parent: { slug: string } | null;
    } | null;
  };
  const products = await fetchAll<ProductRow>((from, to) =>
    supabase
      .from("products")
      .select(`
        slug,
        category:categories!inner(
          slug,
          parent_id,
          parent:categories(slug)
        )
      `)
      .eq("is_active", true)
      .range(from, to) as any,
  );

  const productUrls: MetadataRoute.Sitemap = products.map((product) => {
    const cat = product.category;
    const parent = cat?.parent;
    const url = parent?.slug
      ? `${BASE_URL}/catalog/${parent.slug}/${cat?.slug}/${product.slug}`
      : `${BASE_URL}/catalog/${cat?.slug}/${product.slug}`;

    return {
      url,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    };
  });

  return [...staticUrls, ...categoryUrls, ...productUrls];
}
