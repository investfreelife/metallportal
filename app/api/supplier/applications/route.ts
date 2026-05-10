import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase";

/**
 * ТЗ #044 — POST /api/supplier/applications
 *
 * Create new supplier registration application для current logged-in user.
 *
 * Body shape (validated):
 *   {
 *     company_name: string (required),
 *     legal_form: 'OOO' | 'IP' | 'AO' | 'PAO' | 'other',
 *     inn: string (required, 10 or 12 digits),
 *     ogrn?: string (13 or 15 digits),
 *     legal_address: string (required),
 *     bank_name?: string,
 *     bank_account?: string (20 digits),
 *     bik?: string (9 digits),
 *     contact_name: string (required),
 *     contact_phone: string (required),
 *     contact_email: string (required),
 *     regions_served: string[] (>=1),
 *     product_categories_planned: string[] (>=1),
 *     documents_url?: string,
 *   }
 *
 * Returns 201 + { application: { id, status, created_at } }
 */

const VALID_LEGAL_FORMS = new Set(["OOO", "IP", "AO", "PAO", "other"]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Reject if уже есть supplier row
  const { data: existingSupplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingSupplier) {
    return NextResponse.json(
      { error: "Вы уже зарегистрированы как поставщик. Перейдите в /supplier/dashboard." },
      { status: 409 },
    );
  }

  // Reject if уже есть pending application
  const { data: pending } = await (admin as any)
    .from("seller_applications")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return NextResponse.json(
      { error: "У вас уже есть заявка на рассмотрении. Дождитесь решения модератора." },
      { status: 409 },
    );
  }

  // Validation
  const required = (v: any) => typeof v === "string" && v.trim().length > 0;
  if (!required(body.company_name)) return badField("company_name");
  if (!VALID_LEGAL_FORMS.has(body.legal_form)) return badField("legal_form");
  if (!required(body.inn) || !/^\d{10}$|^\d{12}$/.test(body.inn))
    return NextResponse.json({ error: "ИНН должен быть 10 или 12 цифр" }, { status: 400 });
  if (body.ogrn && !/^\d{13}$|^\d{15}$/.test(body.ogrn))
    return NextResponse.json({ error: "ОГРН должен быть 13 или 15 цифр" }, { status: 400 });
  if (!required(body.legal_address)) return badField("legal_address");
  if (body.bank_account && !/^\d{20}$/.test(body.bank_account))
    return NextResponse.json({ error: "Расчётный счёт должен быть 20 цифр" }, { status: 400 });
  if (body.bik && !/^\d{9}$/.test(body.bik))
    return NextResponse.json({ error: "БИК должен быть 9 цифр" }, { status: 400 });
  if (!required(body.contact_name)) return badField("contact_name");
  if (!required(body.contact_phone)) return badField("contact_phone");
  if (!required(body.contact_email) || !body.contact_email.includes("@"))
    return badField("contact_email");
  if (!Array.isArray(body.regions_served) || body.regions_served.length === 0)
    return NextResponse.json({ error: "Выберите хотя бы один регион поставок" }, { status: 400 });
  if (!Array.isArray(body.product_categories_planned) || body.product_categories_planned.length === 0)
    return NextResponse.json({ error: "Выберите хотя бы одну категорию товаров" }, { status: 400 });

  // Insert
  const { data: inserted, error } = await (admin as any)
    .from("seller_applications")
    .insert({
      user_id: user.id,
      company_name: String(body.company_name).trim(),
      legal_form: body.legal_form,
      inn: String(body.inn).trim(),
      ogrn: body.ogrn ? String(body.ogrn).trim() : null,
      legal_address: String(body.legal_address).trim(),
      bank_name: body.bank_name ? String(body.bank_name).trim() : null,
      bank_account: body.bank_account ? String(body.bank_account).trim() : null,
      bik: body.bik ? String(body.bik).trim() : null,
      contact_name: String(body.contact_name).trim(),
      contact_phone: String(body.contact_phone).trim(),
      contact_email: String(body.contact_email).trim(),
      regions_served: body.regions_served.map((r: any) => String(r)),
      product_categories_planned: body.product_categories_planned.map((c: any) => String(c)),
      documents_url: body.documents_url ? String(body.documents_url).trim() : null,
      status: "pending",
    })
    .select("id, status, created_at")
    .single();

  if (error) {
    console.error("[supplier/applications POST] insert err:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application: inserted }, { status: 201 });
}

function badField(field: string) {
  return NextResponse.json({ error: `Поле обязательно: ${field}` }, { status: 400 });
}
