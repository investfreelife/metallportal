import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Upload image от designer / admin.
 *
 * Sergey 2026-05-17: после YC migration upload через YC bucket падал
 * (DNS resolution для virtual-host stuck на 8.47.69.0 → timeout; path-style
 * не помог — другая layer issue).
 *
 * Решение: вернуть upload в Supabase Storage (proven working path) под
 * новой folder `user-uploads/`. imageCdn rewriter detects это subfolder
 * и НЕ rewrite'ит → URL остаётся Supabase. Photos accessible через
 * Supabase Storage public URL (без YC bucket mirror requirement).
 *
 * Legacy 94 site-images на YC bucket — продолжают работать (rewrite
 * applies к ним т.к. они НЕ под user-uploads/ prefix).
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const auth = await requireRole(["admin", "designer"]);
  if (!auth.ok) return auth.error;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "categories";

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const ext = file.name.split(".").pop() || "jpg";
    // Path: site-images/user-uploads/<folder>/<timestamp>.<ext>
    // — `user-uploads/` сигнал для imageCdn.ts что rewrite НЕ нужен.
    const fileName = `user-uploads/${folder}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("site-images")
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (error) {
      console.error("[upload-image] supabase upload failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("site-images").getPublicUrl(fileName);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e: any) {
    console.error("[upload-image] exception:", e?.message, e?.stack);
    return NextResponse.json(
      { error: e?.message || "Unknown upload error" },
      { status: 500 },
    );
  }
}
