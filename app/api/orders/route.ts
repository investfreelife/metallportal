import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { name, phone, email, items, comment } = await req.json();
    if (!name || !phone || !items?.length) {
      return NextResponse.json({ error: "Заполните имя, телефон и добавьте товары" }, { status: 400 });
    }

    const { data, error } = await supabase.from("orders").insert({
      customer_name: name,
      customer_phone: phone,
      customer_email: email || null,
      comment: comment || null,
      items: JSON.stringify(items),
      status: "new",
      created_at: new Date().toISOString(),
    }).select("id").single();

    if (error) {
      console.error("Order insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify CRM — fire and forget (don't block order response)
    const total = Array.isArray(items)
      ? items.reduce((sum: number, i: { price?: number; qty?: number }) => sum + (i.price || 0) * (i.qty || 1), 0)
      : 0

    fetch('https://metallportal-crm2.vercel.app/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order',
        tenant_id: 'a1000000-0000-0000-0000-000000000001',
        name,
        phone,
        email: email || null,
        message: comment || null,
        items,
        total,
      }),
    }).catch(() => {})

    return NextResponse.json({ ok: true, orderId: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
