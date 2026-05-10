import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

/**
 * POST /api/supplier/offers — create new offer для current seller's product
 * Body: { product_id, final_price, unit?, in_stock?, stock_quantity?, min_quantity?, lead_time_days? }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Resolve seller_id для current user
  const { data: supplier } = (await admin
    .from("suppliers")
    .select("id, is_active")
    .eq("user_id", user.id)
    .single()) as { data: { id: string; is_active: boolean } | null };
  if (!supplier) return NextResponse.json({ error: "not a registered supplier" }, { status: 403 });
  if (supplier.is_active === false) return NextResponse.json({ error: "supplier deactivated" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { product_id, final_price, unit, in_stock, stock_quantity, min_quantity, lead_time_days } = body;

  if (!product_id || typeof final_price !== "number" || final_price <= 0) {
    return NextResponse.json({ error: "product_id + final_price (> 0) required" }, { status: 400 });
  }

  // Verify product exists
  const { data: product } = (await admin
    .from("products")
    .select("id, name, unit")
    .eq("id", product_id)
    .single()) as { data: { id: string; name: string; unit: string | null } | null };
  if (!product) return NextResponse.json({ error: "product not found" }, { status: 404 });

  // Prevent duplicate active offer для same (seller, product)
  const { data: existing } = await (admin as any)
    .from("seller_offers")
    .select("id")
    .eq("seller_id", supplier.id)
    .eq("product_id", product_id)
    .eq("is_active", true)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "active offer already exists для этого продукта" }, { status: 409 });
  }

  // Insert
  const { data: inserted, error } = await (admin as any)
    .from("seller_offers")
    .insert({
      seller_id: supplier.id,
      product_id,
      base_price: final_price,
      supplier_price: final_price,
      final_price,
      markup_pct: 0,
      currency: "RUB",
      unit: unit || product.unit || "т",
      in_stock: in_stock !== false,
      stock_quantity: stock_quantity ?? null,
      min_quantity: min_quantity ?? 1,
      lead_time_days: lead_time_days ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[supplier/offers POST] insert err:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ offer: inserted }, { status: 201 });
}
