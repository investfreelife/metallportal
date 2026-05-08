"use client";

import Image from "next/image";
import { useState } from "react";
import { Hammer, ShieldCheck, Heart, FileText } from "lucide-react";
import { roofShapeLabel, roofMaterialLabel, reinforcementLabel } from "./labels";
import NavesCalculator from "./NavesCalculator";
import NavesOrderForm from "./NavesOrderForm";
import PhotoEditable from "@/components/admin/PhotoEditable";

/**
 * NavesProductDetail — product detail page для navesy.
 * Per LAW navesy-ui-separate-from-metalloprokat: НЕ <ProductDetailView>.
 *
 * Reference: naves-777.ru.
 *
 * Sections:
 *   1. Hero gallery + meta (title / subtitle / price)
 *   2. Spec badges (тип кровли · материал · усиление)
 *   3. Калькулятор (Длина × Ширина → м² → итог)
 *   4. Lead form
 *   5. Trust block (4 cards)
 */

interface NavesProductDetailProps {
  product: {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    image_urls: string[] | null;
    price_per_m2: number | null;
    min_area_m2: number | null;
    roof_shape: string | null;
    roof_material: string | null;
    reinforcement_type: string | null;
  };
  /** Breadcrumb back-link к L3 category. */
  categoryHref: string;
  categoryName: string;
}

export default function NavesProductDetail({ product, categoryHref, categoryName }: NavesProductDetailProps) {
  const images = (product.image_urls && product.image_urls.length > 0)
    ? product.image_urls
    : product.image_url
      ? [product.image_url]
      : [];
  const [activeImage, setActiveImage] = useState(0);
  const heroImage = images[activeImage] ?? null;

  const pricePerM2 = product.price_per_m2 ? Number(product.price_per_m2) : 0;
  const minArea = product.min_area_m2 ? Number(product.min_area_m2) : 24;

  const reinforcementText = reinforcementLabel(product.reinforcement_type);

  function scrollToOrder() {
    document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <article className="space-y-12">
      {/* 1. Hero + meta */}
      <section className="grid lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-3">
          <PhotoEditable
            photoId={`product:${product.slug}`}
            dimensions="800×384"
            className="w-full h-80 md:h-96 bg-muted rounded-xl overflow-hidden border border-border"
          >
            {heroImage ? (
              <Image
                src={heroImage}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                quality={85}
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl opacity-30">
                🏗️
              </div>
            )}
          </PhotoEditable>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === activeImage ? "border-gold" : "border-border"
                  }`}
                >
                  <Image src={src} alt={`${product.name} ${i + 1}`} fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
            {product.name}
          </h1>
          {reinforcementText && (
            <p className="text-base text-muted-foreground">С усилением: {reinforcementText}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {product.roof_shape && (
              <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-muted text-foreground">
                Кровля: <strong>{roofShapeLabel(product.roof_shape)}</strong>
              </span>
            )}
            {product.roof_material && (
              <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-muted text-foreground">
                Материал: <strong>{roofMaterialLabel(product.roof_material)}</strong>
              </span>
            )}
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">Цена</p>
            <p className="text-3xl font-bold text-gold">
              {pricePerM2 ? `от ${pricePerM2.toLocaleString("ru-RU")} ₽ за м²` : "По запросу"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Точная цена — после связи с менеджером (бесплатный замер и КП).
            </p>
          </div>
        </div>
      </section>

      {/* 2. Калькулятор */}
      {pricePerM2 > 0 && (
        <NavesCalculator pricePerM2={pricePerM2} minAreaM2={minArea} onCtaClick={scrollToOrder} />
      )}

      {/* 3. Lead form */}
      <NavesOrderForm productId={product.id} productName={product.name} />

      {/* 4. Trust block */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Hammer, title: "Долговечность", desc: "Грунт-эмаль и оцинковка горячим методом — срок службы 20+ лет." },
          { icon: ShieldCheck, title: "Гарантия 10 лет", desc: "На сварные швы и антикоррозийное покрытие." },
          { icon: Heart, title: "Каждый заказ уникален", desc: "Индивидуальный замер, проектирование и подгонка под объект." },
          { icon: FileText, title: "Договор", desc: "Полный пакет документов с НДС. Работаем с юр. и физ. лицами." },
        ].map(({ icon: Icon, title, desc }, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <Icon size={28} className="text-gold" />
            <h4 className="text-base font-bold text-foreground">{title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* 5. Назад к категории */}
      <div className="pt-6 border-t border-border">
        <a
          href={categoryHref}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-gold transition-colors"
        >
          ← Все навесы: {categoryName}
        </a>
      </div>
    </article>
  );
}
