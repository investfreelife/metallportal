import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function dbUpdate(table: string, col: string, matchCol: string, matchVal: string, value: string | null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchCol}=eq.${encodeURIComponent(matchVal)}`, {
    method: "PATCH",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ [col]: value }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DB update failed (${res.status}): ${text}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { photoId, url } = await req.json();
    if (!photoId) return NextResponse.json({ error: "Missing photoId" }, { status: 400 });

    const [type, identifier] = photoId.split(":");
    const imageUrl = url === "" ? null : url;

    if (type === "category") {
      await dbUpdate("categories", "image_url", "slug", identifier, imageUrl);
      revalidatePath("/catalog", "layout");
    } else if (type === "product") {
      await dbUpdate("products", "image_url", "slug", identifier, imageUrl);
      revalidatePath("/catalog", "layout");
    } else {
      return NextResponse.json({ error: "Unknown type: " + type }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
