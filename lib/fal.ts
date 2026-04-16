import { fal } from "@fal-ai/client";

if (process.env.FAL_API_KEY) {
  fal.config({ credentials: process.env.FAL_API_KEY });
}

const CATEGORY_PROMPTS: Record<string, string> = {
  trub: "Professional industrial photo, steel pipes warehouse Russia, photorealistic, high quality",
  armatura: "Professional photo steel rebar construction material warehouse Russia, photorealistic",
  list: "Professional photo steel metal sheets plates industrial warehouse Russia, photorealistic",
  ugolok: "Professional photo steel angle iron profiles warehouse Russia, photorealistic",
  shveller: "Professional photo steel channel profiles warehouse Russia, photorealistic",
  balka: "Professional photo steel I-beam profiles warehouse Russia, photorealistic",
  profnastil: "Professional photo corrugated metal roofing sheets colorful Russia, photorealistic",
  nerzhaveika: "Professional photo stainless steel sheets polished industrial Russia, photorealistic",
  cvetnoj: "Professional photo aluminum copper metal bars warehouse Russia, photorealistic",
  krepezh: "Professional photo metal bolts nuts fasteners industrial Russia, photorealistic",
  setka: "Professional photo metal wire mesh welded galvanized Russia, photorealistic",
  polosa: "Professional photo steel flat bar strips industrial warehouse Russia, photorealistic",
};

function buildPrompt(name: string, category: string): string {
  const combined = (category + " " + name).toLowerCase();
  for (const [key, prompt] of Object.entries(CATEGORY_PROMPTS)) {
    if (combined.includes(key)) return prompt;
  }
  return `Professional industrial photo ${name} metal product warehouse Russia, photorealistic`;
}

export interface FalImageResult {
  imageUrl: string;
  prompt: string;
}

export async function generateProductImage(
  productName: string,
  category: string
): Promise<FalImageResult> {
  if (!process.env.FAL_API_KEY) {
    throw new Error("FAL_API_KEY not configured");
  }

  const prompt = buildPrompt(productName, category);

  const result = await fal.subscribe("fal-ai/flux/schnell", {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_inference_steps: 4,
      num_images: 1,
    },
  });

  const imageUrl = (result.data as any).images?.[0]?.url;
  if (!imageUrl) throw new Error("fal.ai returned no images");

  return { imageUrl, prompt };
}
