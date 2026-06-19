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

    // TASK_054 (audit SEV-3): magic-byte проверка вместо доверия к
    // file.type / расширению. Раньше юзер мог отправить evil.html с
    // contentType=image/jpeg → лежал бы в bucket'е и Supabase отдавал бы
    // его с заголовком image/jpeg, но реально это HTML. Низкий риск
    // (роут защищён requireRole admin/designer), но best-practice.
    const buffer = Buffer.from(await file.arrayBuffer());
    const m = buffer.subarray(0, 12);
    const detected =
      m.length >= 3 && m[0] === 0xff && m[1] === 0xd8 && m[2] === 0xff ? { ext: "jpg", mime: "image/jpeg" } :
      m.length >= 4 && m[0] === 0x89 && m[1] === 0x50 && m[2] === 0x4e && m[3] === 0x47 ? { ext: "png", mime: "image/png" } :
      m.length >= 12 && m[0] === 0x52 && m[1] === 0x49 && m[2] === 0x46 && m[3] === 0x46 &&
        m[8] === 0x57 && m[9] === 0x45 && m[10] === 0x42 && m[11] === 0x50 ? { ext: "webp", mime: "image/webp" } :
      m.length >= 4 && m[0] === 0x47 && m[1] === 0x49 && m[2] === 0x46 && m[3] === 0x38 ? { ext: "gif", mime: "image/gif" } :
      null;
    if (!detected) {
      return NextResponse.json(
        { error: "Файл не похож на JPG/PNG/WebP/GIF (magic-byte mismatch)" },
        { status: 400 },
      );
    }

    // Path: site-images/user-uploads/<folder>/<timestamp>.<ext>
    // — `user-uploads/` сигнал для imageCdn.ts что rewrite НЕ нужен.
    const fileName = `user-uploads/${folder}/${Date.now()}.${detected.ext}`;

    const { error } = await supabase.storage
      .from("site-images")
      .upload(fileName, buffer, { contentType: detected.mime, upsert: true });

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
