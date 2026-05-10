import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

/**
 * PATCH /api/supplier/offers/[id] — edit own offer (price/stock/active)
 * Body: { final_price?, in_stock?, stock_quantity?, lead_time_days?, is_active?, min_quantity? }
 *
 * RLS-equivalent guard в коде: проверяем что offer.seller_id == user's supplier.id
 * (using admin client to bypass RLS, но manually enforcing scope).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Lookup supplier для user
  const { data: supplier } = (await admin
    .from("suppliers")
    .select("id, is_active")
    .eq("user_id", user.id)
    .single()) as { data: { id: string; is_active: boolean } | null };
  if (!supplier) return NextResponse.json({ error: "not a registered supplier" }, { status: 403 });
  if (supplier.is_active === false) return NextResponse.json({ error: "supplier deactivated" }, { status: 403 });

  // Lookup offer + verify ownership
  const { data: existing } = (await (admin as any)
    .from("seller_offers")
    .select("id, seller_id, product_id")
    .eq("id", params.id)
    .single()) as { data: { id: string; seller_id: string; product_id: string } | null };
  if (!existing) return NextResponse.json({ error: "offer not found" }, { status: 404 });
  if (existing.seller_id !== supplier.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const allowed: Record<string, any> = {};
  for (const k of ["final_price", "in_stock", "stock_quantity", "lead_time_days", "is_active", "min_quantity", "min_order_qty"] as const) {
    if (k in body) allowed[k] = body[k];
  }

  if (allowed.final_price !== undefined) {
    if (typeof allowed.final_price !== "number" || allowed.final_price <= 0) {
      return NextResponse.json({ error: "final_price должен быть > 0" }, { status: 400 });
    }
    // Sync supplier_price = final_price (simple model — markup_pct=0 по default)
    allowed.supplier_price = allowed.final_price;
    allowed.base_price = allowed.final_price;
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "no updatable fields" }, { status: 400 });
  }

  const { data: updated, error } = await (admin as any)
    .from("seller_offers")
    .update(allowed)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("[supplier/offers PATCH] update err:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recompute buy_box для этого product (lowest active+in_stock final_price)
  if (
    "final_price" in allowed ||
    "in_stock" in allowed ||
    "is_active" in allowed
  ) {
    await recomputeBuyBox(admin, existing.product_id);
  }

  return NextResponse.json({ offer: updated });
}

/** Recompute is_buy_box per product — simplest: lowest final_price wins. */
async function recomputeBuyBox(admin: any, productId: string) {
  // Fetch active+in_stock offers, sorted by price
  const { data: offers } = await admin
    .from("seller_offers")
    .select("id, final_price, created_at")
    .eq("product_id", productId)
    .eq("is_active", true)
    .eq("in_stock", true)
    .order("final_price", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  // Reset all для product, then mark winner
  await admin
    .from("seller_offers")
    .update({ is_buy_box: false })
    .eq("product_id", productId)
    .eq("is_buy_box", true);

  if (offers && offers.length > 0) {
    await admin
      .from("seller_offers")
      .update({ is_buy_box: true })
      .eq("id", offers[0].id);
  }
}

/**
 * DELETE /api/supplier/offers/[id] — soft delete (set is_active=false).
 * For real delete используй PATCH с is_active=false (preserve history).
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: supplier } = (await admin
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .single()) as { data: { id: string } | null };
  if (!supplier) return NextResponse.json({ error: "not a supplier" }, { status: 403 });

  const { data: existing } = (await (admin as any)
    .from("seller_offers")
    .select("id, seller_id, product_id")
    .eq("id", params.id)
    .single()) as { data: { id: string; seller_id: string; product_id: string } | null };
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.seller_id !== supplier.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { error } = await (admin as any)
    .from("seller_offers")
    .update({ is_active: false, in_stock: false, is_buy_box: false })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recomputeBuyBox(admin, existing.product_id);

  return NextResponse.json({ ok: true });
}
