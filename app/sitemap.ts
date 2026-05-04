import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";

const BASE_URL = SITE_URL;

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

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, parent_id")
    .eq("is_active", true);

  const cats = categories ?? [];
  const catMap = new Map<string, { id: string; slug: string; parent_id: string | null }>(
    cats.map((c: any) => [c.id, { id: c.id, slug: c.slug, parent_id: c.parent_id }])
  );

  const categoryUrls: MetadataRoute.Sitemap = cats.map((cat: any) => {
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

  const { data: products } = await supabase
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
    .limit(5000);

  const productUrls: MetadataRoute.Sitemap = (products ?? []).map((product: any) => {
    const cat = product.category;
    const parent = cat?.parent as any;
    const url = parent?.slug
      ? `${BASE_URL}/catalog/${parent.slug}/${cat.slug}/${product.slug}`
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
