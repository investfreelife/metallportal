import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getProductPriceItems, getRelatedProducts } from "@/lib/queries";
import ProductTabs from "@/components/catalog/ProductTabs";
import PriceBlock from "@/components/catalog/PriceBlock";

export const revalidate = 60;

interface Props {
  params: { category: string; slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) return { title: "Товар не найден | МеталлПортал" };

  const title = `${product.name} цена купить в Москве | МеталлПортал`;
  const description = product.description
    ? product.description.slice(0, 155)
    : `${product.name} — купить оптом и в розницу в Москве. Доставка по всей России. Лучшие цены.`;
  const keywords = [
    product.name,
    "купить",
    "цена",
    "Москва",
    product.gost,
    product.steel_grade,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      images: product.image_url ? [product.image_url] : [],
    },
  };
}

function buildSpecs(product: any): Record<string, string | null> {
  return {
    "Марка стали":   product.steel_grade || null,
    "ГОСТ":          product.gost || null,
    "Размер":        product.dimensions || null,
    "Длина":         product.length ? `${product.length} м` : null,
    "Диаметр":       product.diameter ? `${product.diameter} мм` : null,
    "Толщина":       product.thickness ? `${product.thickness} мм` : null,
    "Вес 1 м":       product.weight_per_meter ? `${product.weight_per_meter} кг/м` : null,
    "Покрытие":      product.coating || null,
    "Единица":       product.unit || null,
  };
}

// Category image placeholders
const CATEGORY_GRADIENTS: Record<string, string> = {
  "truba": "from-slate-700 to-slate-900",
  "armatura": "from-orange-900 to-slate-900",
  "list": "from-blue-900 to-slate-900",
  "ugolok": "from-zinc-700 to-zinc-900",
  "balka": "from-stone-700 to-stone-900",
  "shveller": "from-neutral-700 to-neutral-900",
};

function getCategoryGradient(slug: string): string {
  const key = Object.keys(CATEGORY_GRADIENTS).find((k) => slug.includes(k));
  return key ? CATEGORY_GRADIENTS[key] : "from-slate-700 to-slate-900";
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug(params.slug);
  if (!product) return notFound();

  const [priceItems, related] = await Promise.all([
    getProductPriceItems(product.id),
    getRelatedProducts(product.category_id, product.id, 6),
  ]);

  const bestPrice = priceItems.length
    ? Math.min(...priceItems.map((pi: any) => Number(pi.discount_price ?? pi.base_price)))
    : 0;

  const parentCategory = (product.category as any)?.parent;
  const categoryName = (product.category as any)?.name;
  const categorySlug = (product.category as any)?.slug || params.category;
  const gradient = getCategoryGradient(categorySlug);

  const specs = buildSpecs(product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    sku: product.id,
    brand: { "@type": "Brand", name: "МеталлПортал" },
    ...(product.gost && { additionalProperty: [{ "@type": "PropertyValue", name: "ГОСТ", value: product.gost }] }),
    ...(bestPrice > 0 && {
      offers: {
        "@type": "Offer",
        price: bestPrice,
        priceCurrency: "RUB",
        availability: priceItems.some((p: any) => p.in_stock)
          ? "https://schema.org/InStock"
          : "https://schema.org/PreOrder",
        seller: { "@type": "Organization", name: "МеталлПортал" },
      },
    }),
  };

  return (
    <div className="bg-background min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container-main py-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-5 flex items-center gap-1.5 flex-wrap">
          <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
          <span>/</span>
          <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
          {parentCategory && (
            <>
              <span>/</span>
              <Link href={`/catalog/${parentCategory.slug}`} className="hover:text-gold transition-colors">
                {parentCategory.name}
              </Link>
            </>
          )}
          {categoryName && (
            <>
              <span>/</span>
              <Link href={`/catalog/${categorySlug}`} className="hover:text-gold transition-colors">
                {categoryName}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              {product.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              {product.gost && (
                <span className="text-xs bg-card border border-border text-muted-foreground px-2 py-1 rounded">
                  {product.gost}
                </span>
              )}
              {product.steel_grade && (
                <span className="text-xs bg-gold/10 border border-gold/30 text-gold px-2 py-1 rounded">
                  {product.steel_grade}
                </span>
              )}
              {product.dimensions && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                  {product.dimensions}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT — 58% */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Product image */}
            <div className={`rounded-lg overflow-hidden bg-gradient-to-br ${gradient} h-64 lg:h-80 flex items-center justify-center`}>
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-white/60 space-y-2 p-8">
                  <div className="text-5xl">🏗️</div>
                  <p className="text-sm font-medium text-white/80">{product.name}</p>
                  {product.gost && <p className="text-xs text-white/50">{product.gost}</p>}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <ProductTabs
                description={product.description}
                gost={product.gost}
                steel_grade={product.steel_grade}
                material={product.material}
                specs={specs}
                priceItems={priceItems}
                unit={product.unit}
              />
            </div>
          </div>

          {/* RIGHT — 42% */}
          <div className="w-full lg:w-[380px] flex-shrink-0">
            <PriceBlock
              priceItems={priceItems}
              unit={product.unit}
              weightPerMeter={product.weight_per_meter ? Number(product.weight_per_meter) : null}
              productName={product.name}
            />
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-foreground mb-4">С этим покупают</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {related.map((rel: any) => {
                const relBestPrice = rel.price_items?.length
                  ? Math.min(...rel.price_items.map((p: any) => Number(p.discount_price ?? p.base_price)))
                  : null;
                return (
                  <Link
                    key={rel.id}
                    href={`/catalog/${categorySlug}/${rel.slug}`}
                    className="bg-card border border-border rounded-lg p-3 hover:border-gold transition-all group"
                  >
                    <p className="text-xs font-medium text-foreground line-clamp-2 mb-2 group-hover:text-gold transition-colors">
                      {rel.name}
                    </p>
                    {rel.gost && (
                      <p className="text-xs text-muted-foreground mb-1">{rel.gost}</p>
                    )}
                    {relBestPrice ? (
                      <p className="text-sm font-bold text-gold">
                        {relBestPrice.toLocaleString("ru-RU")} ₽
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">По запросу</p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
