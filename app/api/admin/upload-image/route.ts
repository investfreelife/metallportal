import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ycPutObject } from "@/lib/yc-storage";

export const runtime = 'nodejs';

/**
 * Upload image от designer / admin.
 *
 * Sergey fix 2026-05-17: после YC migration upload писал в Supabase site-images
 * bucket, но frontend с `NEXT_PUBLIC_USE_YANDEX_CDN=1` rewrite'ил URL на YC bucket
 * (`harlansteel-images`) — файла там не было → 404. Designer не мог выкладывать
 * фото через UI.
 *
 * Fix: upload идёт напрямую в YC bucket `harlansteel-images/site-images/<folder>/<file>`.
 * URL path matches existing CDN mirror — imageCdn rewriter не нужен (уже YC).
 */

const YC_IMAGES_BUCKET = "harlansteel-images";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["admin", "designer"]);
  if (!auth.ok) return auth.error;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "categories";

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const ext = file.name.split(".").pop() || "jpg";
    // Path: site-images/<folder>/<timestamp>.<ext> — preserves bucket scheme
    // legacy mirrored на Day 3 #047 (697 product photos + 94 site-images).
    const key = `site-images/${folder}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const url = await ycPutObject(
      YC_IMAGES_BUCKET,
      key,
      buffer,
      file.type || "application/octet-stream",
    );

    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
