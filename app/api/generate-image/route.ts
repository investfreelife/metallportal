import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateProductImage } from "@/lib/fal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { prompt, productId, categoryId, productName, category } = await req.json();

    if (!process.env.FAL_API_KEY) {
      return NextResponse.json({ error: "FAL_API_KEY not configured" }, { status: 503 });
    }

    const name = productName || prompt || "metal product";
    const cat = category || "";

    const { imageUrl } = await generateProductImage(name, cat);

    // Download and upload to Supabase storage
    const imgRes = await fetch(imageUrl);
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    const filename = `generated-${Date.now()}.jpg`;
    const bucket = productId ? "product-images" : "hero-images";

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, imgBuf, { contentType: "image/jpeg", upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
    const storedUrl = urlData.publicUrl;

    // Update product or category image_url
    if (productId) {
      await supabase.from("products").update({ image_url: storedUrl }).eq("id", productId);
    } else if (categoryId) {
      await supabase.from("categories").update({ image_url: storedUrl }).eq("id", categoryId);
    }

    return NextResponse.json({ imageUrl: storedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
