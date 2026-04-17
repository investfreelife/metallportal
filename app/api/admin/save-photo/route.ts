import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { photoId, url } = await req.json();
    if (!photoId || !url) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const [type, identifier] = photoId.split(":");

    if (type === "category") {
      const { error } = await supabase
        .from("categories")
        .update({ image_url: url })
        .eq("slug", identifier);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Unknown type: " + type }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
