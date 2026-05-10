import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

/**
 * ТЗ #044 — Admin approve/reject seller applications.
 *
 * PATCH /api/admin/sellers/applications/[id]
 *
 * Body:
 *   { action: "approve" | "reject", rejection_reason?: string }
 *
 * On approve:
 *   1. Verify application status === 'pending'
 *   2. INSERT new row в `suppliers` с данными из application
 *   3. UPDATE application: status='approved', reviewed_by, reviewed_at, seller_id
 *
 * On reject:
 *   1. Verify status === 'pending'
 *   2. UPDATE application: status='rejected', rejection_reason, reviewed_by, reviewed_at
 *
 * Email notifications — manual для MVP (admin может скопировать contact_email из queue).
 * Auto Resend wiring — follow-up task.
 */

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.error;
  const adminUserId = auth.userId;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "missing application id" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch application
  const { data: app, error: fetchErr } = await (admin as any)
    .from("seller_applications")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !app) {
    return NextResponse.json({ error: "application not found" }, { status: 404 });
  }
  if (app.status !== "pending") {
    return NextResponse.json(
      { error: `application already ${app.status}` },
      { status: 409 },
    );
  }

  if (action === "approve") {
    // Step 1: Insert supplier row
    const { data: supplier, error: supErr } = await (admin as any)
      .from("suppliers")
      .insert({
        user_id: app.user_id,
        company_name: app.company_name,
        inn: app.inn,
        contact_email: app.contact_email,
        contact_phone: app.contact_phone,
        region: app.regions_served?.[0] ?? null, // primary region
        is_verified: true,
        is_active: true,
      })
      .select("id")
      .single();

    if (supErr || !supplier) {
      console.error("[approve] supplier insert err:", supErr);
      return NextResponse.json(
        { error: `Не удалось создать supplier: ${supErr?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    // Step 2: Update application
    const { error: updErr } = await (admin as any)
      .from("seller_applications")
      .update({
        status: "approved",
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
        seller_id: supplier.id,
      })
      .eq("id", id);

    if (updErr) {
      console.error("[approve] application update err:", updErr);
      return NextResponse.json(
        { error: `Supplier создан, но обновление заявки failed: ${updErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      action: "approved",
      seller_id: supplier.id,
      message: `Одобрено. Supplier ${supplier.id} создан. Уведомите ${app.contact_email} вручную.`,
    });
  }

  // action === "reject"
  const reason = String(body.rejection_reason ?? "").trim();
  if (!reason) {
    return NextResponse.json(
      { error: "rejection_reason required для отклонения" },
      { status: 400 },
    );
  }

  const { error: updErr } = await (admin as any)
    .from("seller_applications")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updErr) {
    console.error("[reject] update err:", updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action: "rejected",
    message: `Отклонено. Уведомите ${app.contact_email} вручную с причиной.`,
  });
}
