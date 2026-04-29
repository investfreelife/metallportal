import Link from "next/link";
import PhotoEditable from "@/components/admin/PhotoEditable";
import ProductTabs from "@/components/catalog/ProductTabs";
import PriceBlock from "@/components/catalog/PriceBlock";
import NavesProductDetail from "@/components/catalog/NavesProductDetail";
import { CheckCircle } from "lucide-react";
import CategoryCallbackCTA from "@/components/catalog/CategoryCallbackCTA";

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
  if (product.unit === "м²") {
    return <NavesProductDetail product={{ ...product, price_items: priceItems }} related={related} basePath={basePath} />;
  }

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
    brand: { "@type": "Brand", name: "Харланметалл" },
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
        seller: { "@type": "Organization", name: "Харланметалл" },
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

      {!basePath.includes("metalloprokat") && (
        <>
          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-3xl font-bold text-foreground mb-5">{product.name} — купить в Москве | Харланметалл</h2>
            <p className="text-muted-foreground leading-relaxed mb-8 max-w-4xl">
              Харланметалл производит и поставляет <strong className="text-foreground">{product.name.toLowerCase()}</strong> по всей России.
              Собственное производство, контроль качества на каждом этапе, конкурентные цены без посредников.
              Полный пакет документов, работаем с юридическими и физическими лицами.
            </p>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">✅</span>
              <h3 className="text-2xl font-bold text-foreground">Почему выбирают Харланметалл</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
              {[
                "Собственный завод — цены без посредников и торговых наценок",
                "Металлопрокат собственного производства по ГОСТ",
                "Изготовление по любым размерам и чертежам заказчика",
                "Антикоррозийная обработка и порошковое окрашивание RAL",
                "Монтаж «под ключ» аттестованными бригадами",
                "Гарантия 10 лет на сварные соединения и покрытие",
                "Бесплатный выезд замерщика в день обращения",
                "Работаем с юрлицами и физлицами, НДС, все документы",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                  <CheckCircle size={18} className="text-gold flex-shrink-0" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                { n: "01", title: "Заявка", desc: "Менеджер перезвонит за 15 минут и уточнит параметры заказа." },
                { n: "02", title: "КП за 1 день", desc: "Коммерческое предложение с ценой, сроками и условиями." },
                { n: "03", title: "Производство", desc: "Изготовление на заводе с контролем качества." },
                { n: "04", title: "Доставка", desc: "Доставка по Москве, МО и всей России. Монтаж под ключ." },
              ].map((p, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-4">
                  <div className="text-3xl font-black text-gold/30 mb-2">{p.n}</div>
                  <p className="font-bold text-foreground mb-1">{p.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">❓</span>
              <h3 className="text-2xl font-bold text-foreground">Часто задаваемые вопросы</h3>
            </div>
            <div className="space-y-4 max-w-4xl">
              {[
                { q: "Как сделать заказ?", a: "Оставьте заявку на сайте или позвоните. Менеджер уточнит параметры и подготовит КП в течение 1 рабочего дня." },
                { q: "Есть ли доставка по России?", a: "Да, доставляем собственным транспортом по Москве и МО, в регионы — через транспортные компании-партнёры." },
                { q: "Можно заказать по индивидуальным размерам?", a: "Да, изготавливаем по чертежам и техническому заданию заказчика. Расчёт за 1 рабочий день." },
                { q: "Какие документы предоставляете?", a: "Договор, счёт, товарная накладная, акт выполненных работ, сертификаты на материалы. Работаем с НДС." },
              ].map((item, i) => (
                <div key={i} className="border border-border rounded-lg p-4 bg-card">
                  <p className="font-bold text-foreground mb-2 text-sm">{item.q}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <CategoryCallbackCTA />
        </>
      )}
    </div>
  );
}
