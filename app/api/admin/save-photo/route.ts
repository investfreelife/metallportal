import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { photoId, url } = await req.json();
    if (!photoId) return NextResponse.json({ error: "Missing photoId" }, { status: 400 });

    const [type, identifier] = photoId.split(":");
    const imageUrl = url === "" ? null : url;

    if (type === "category") {
      const { error } = await supabase.from("categories").update({ image_url: imageUrl }).eq("slug", identifier);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else if (type === "product") {
      const { error } = await supabase.from("products").update({ image_url: imageUrl }).eq("slug", identifier);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Unknown type: " + type }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
