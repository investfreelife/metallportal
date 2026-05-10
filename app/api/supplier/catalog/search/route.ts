import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

/**
 * GET /api/supplier/catalog/search?q=...
 * Returns up to 50 products matching query (name ILIKE) — для supplier dashboard
 * "Активировать SKU" flow.
 *
 * Auth: must be a registered supplier.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: supplier } = (await admin
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .single()) as { data: { id: string } | null };
  if (!supplier) return NextResponse.json({ error: "not a supplier" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ products: [] });
  }

  // Простой ILIKE search по name + slug
  const pattern = `%${q.replace(/[%_]/g, (c) => "\\" + c)}%`;
  const { data: products, error } = await admin
    .from("products")
    .select(`id, name, slug, unit, dimensions, category:categories!category_id(id, name, slug)`)
    .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    .eq("is_active", true)
    .limit(50);

  if (error) {
    console.error("[supplier/catalog/search] err:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten category для UI
  const flat = (products ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    unit: p.unit,
    dimensions: p.dimensions,
    category_name: p.category?.name ?? null,
    category_slug: p.category?.slug ?? null,
  }));

  return NextResponse.json({ products: flat });
}
