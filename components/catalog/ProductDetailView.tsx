import Link from "next/link";
import PhotoEditable from "@/components/admin/PhotoEditable";
import ProductTabs from "@/components/catalog/ProductTabs";
import PriceBlock from "@/components/catalog/PriceBlock";

function buildSpecs(product: any): Record<string, string | null> {
  return {
    "Марка стали": product.steel_grade || null,
    "ГОСТ": product.gost || null,
    "Размер": product.dimensions || null,
    "Длина": product.length ? `${product.length} м` : null,
    "Диаметр": product.diameter ? `${product.diameter} мм` : null,
    "Толщина": product.thickness ? `${product.thickness} мм` : null,
    "Вес 1 м": product.weight_per_meter ? `${product.weight_per_meter} кг/м` : null,
    "Покрытие": product.coating || null,
    "Единица": product.unit || null,
  };
}

const CATEGORY_IMAGES: Record<string, string> = {
  truba: "steel,pipe,tube,industrial",
  armatura: "rebar,steel,construction,concrete",
  list: "steel,sheet,plate,metal",
  ugolok: "steel,angle,metal,industry",
  balka: "steel,beam,girder,construction",
  shveller: "steel,channel,beam,metal",
  profnast: "corrugated,metal,sheet,roof",
  setka: "metal,mesh,wire,steel",
  polosa: "steel,strip,metal,flat",
};

function getCategoryImage(slug: string): string {
  const key = Object.keys(CATEGORY_IMAGES).find((k) => slug.includes(k));
  return `https://loremflickr.com/800/600/${key ? CATEGORY_IMAGES[key] : "steel,metal,industrial,warehouse"}`;
}

interface ProductDetailViewProps {
  product: any;
  priceItems: any[];
  related: any[];
  basePath: string; // e.g. "/catalog/metalloprokat/truby-i-profil"
}

export default function ProductDetailView({ product, priceItems, related, basePath }: ProductDetailViewProps) {
  const categorySlug = (product.category as any)?.slug || "";
  const fallbackImage = getCategoryImage(categorySlug);
  const specs = buildSpecs(product);

  const bestPrice = priceItems.length
    ? Math.min(...priceItems.map((pi: any) => Number(pi.discount_price ?? pi.base_price)))
    : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    sku: product.id,
    brand: { "@type": "Brand", name: "МеталлПортал" },
    ...(product.gost && {
      additionalProperty: [{ "@type": "PropertyValue", name: "ГОСТ", value: product.gost }],
    }),
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
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="text-sm text-muted-foreground mb-5 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
        <span>/</span>
        <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
        <span>/</span>
        <Link href={basePath} className="hover:text-gold transition-colors">
          {(product.category as any)?.name || "Категория"}
        </Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">{product.name}</h1>
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

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          <PhotoEditable photoId={`product:${product.slug}`} dimensions="800×320" className="rounded-lg overflow-hidden h-64 lg:h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url || fallbackImage}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </PhotoEditable>
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
        <div className="w-full lg:w-[380px] flex-shrink-0">
          <PriceBlock
            priceItems={priceItems}
            unit={product.unit}
            weightPerMeter={product.weight_per_meter ? Number(product.weight_per_meter) : null}
            productName={product.name}
            productId={product.id}
            productSlug={product.slug}
            productImageUrl={product.image_url}
          />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-foreground mb-4">С этим покупают</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {related.map((rel: any) => {
              const rp = rel.price_items?.length
                ? Math.min(...rel.price_items.map((p: any) => Number(p.discount_price ?? p.base_price)))
                : null;
              return (
                <Link
                  key={rel.id}
                  href={`${basePath}/${rel.slug}`}
                  className="bg-card border border-border rounded-lg p-3 hover:border-gold transition-all group"
                >
                  <p className="text-xs font-medium text-foreground line-clamp-2 mb-2 group-hover:text-gold transition-colors">
                    {rel.name}
                  </p>
                  {rel.gost && <p className="text-xs text-muted-foreground mb-1">{rel.gost}</p>}
                  {rp ? (
                    <p className="text-sm font-bold text-gold">{rp.toLocaleString("ru-RU")} ₽</p>
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
  );
}
