import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Lead form submission endpoint для landing pages.
 *
 * Stage m003 — STUB: validates payload + logs lead с ref/UTM attribution.
 * Реальный CRM lead create — после deploy Pavel'ом #c014
 * (`createCrmLead()` helper); тогда заменяем log на real call.
 *
 * Body shape (см. `LandingCTABlock.tsx`):
 *   { slug: string, name?, phone?, email?, message?, attachment? }
 *
 * Attribution:
 *  - ref_code cookie (m001 30-day window) — реферальная программа
 *  - utm_* cookies (Part E middleware capture при entry с ?utm_*) — рекламный atribut
 */

export const runtime = "nodejs"; // нужен access к cookies()

interface LeadPayload {
  slug?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  message?: unknown;
  attachment?: unknown;
}

export async function POST(req: NextRequest) {
  let body: LeadPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // Minimal validation: slug + хоть один контакт
  const slug = typeof body.slug === "string" ? body.slug : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "slug required" },
      { status: 400 },
    );
  }
  if (!phone && !email) {
    return NextResponse.json(
      { ok: false, error: "phone or email required" },
      { status: 400 },
    );
  }

  const cookieStore = cookies();
  const refCode = cookieStore.get("ref_code")?.value ?? null;
  const utm = {
    source: cookieStore.get("utm_source")?.value ?? null,
    medium: cookieStore.get("utm_medium")?.value ?? null,
    campaign: cookieStore.get("utm_campaign")?.value ?? null,
    term: cookieStore.get("utm_term")?.value ?? null,
    content: cookieStore.get("utm_content")?.value ?? null,
  };

  const lead = {
    source: "landing",
    slug,
    name: typeof body.name === "string" ? body.name.trim() : "",
    phone,
    email,
    message: typeof body.message === "string" ? body.message.trim() : "",
    refCode,
    utm,
    receivedAt: new Date().toISOString(),
  };

  // TODO #c014 — replace with `await createCrmLead(lead)` когда Pavel deploy'ит helper.
  // Пока что log в Vercel function logs — Антон видит в dashboard.
  console.log("[landing-lead]", JSON.stringify(lead));

  return NextResponse.json({ ok: true });
}
