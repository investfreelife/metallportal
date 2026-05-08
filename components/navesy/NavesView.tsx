import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { roofShapeLabel, roofMaterialLabel } from "./labels";
import PhotoEditable from "@/components/admin/PhotoEditable";

/**
 * NavesView — list page для navesy L3 categories (5 immutable slugs).
 * Cards-only layout с hero photo + spec badges + цена ₽/м² + CTA.
 *
 * НЕ рендерит: table view / region selector / ГОСТ filter / steel grade /
 *               length filter / weight column / per-ton pricing.
 *
 * Per LAW navesy-ui-separate-from-metalloprokat: НИКОГДА не использовать
 * <CatalogView> для navesy products.
 */

interface NavesProduct {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  price_per_m2: number | null;
  roof_shape: string | null;
  roof_material: string | null;
  reinforcement_type: string | null;
}

interface NavesViewProps {
  category: { name: string; description: string | null };
  products: NavesProduct[];
  /** Parent category slug ('navesy' or 'gotovye-konstruktsii/navesy' depending on route). */
  basePath: string;
  /** Current L3 slug (e.g. 'navesy-dlya-avtomobilya'). */
  categorySlug: string;
}

export default function NavesView({ category, products, basePath, categorySlug }: NavesViewProps) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-black text-foreground">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground max-w-3xl leading-relaxed">{category.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Найдено: <span className="font-bold text-foreground">{products.length}</span>{" "}
          {products.length === 1 ? "позиция" : products.length < 5 ? "позиции" : "позиций"}
        </p>
      </header>

      {products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          В этой категории пока нет навесов. Свяжитесь с нами для индивидуального заказа.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`${basePath}/${categorySlug}/${p.slug}`}
              className="group bg-card border border-border rounded-lg overflow-hidden hover:border-gold/40 hover:shadow-lg transition-all"
            >
              <PhotoEditable
                photoId={`product:${p.slug}`}
                dimensions="640×208"
                className="w-full h-52 bg-muted overflow-hidden"
              >
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    quality={80}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">
                    🏗️
                  </div>
                )}
              </PhotoEditable>
              <div className="p-4 space-y-3">
                <h3 className="text-base font-bold text-foreground leading-snug group-hover:text-gold transition-colors">
                  {p.name}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {p.roof_shape && (
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {roofShapeLabel(p.roof_shape)}
                    </span>
                  )}
                  {p.roof_material && (
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {roofMaterialLabel(p.roof_material)}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between pt-2 border-t border-border">
                  <span className="text-lg font-bold text-gold">
                    {p.price_per_m2 ? `от ${Number(p.price_per_m2).toLocaleString("ru-RU")} ₽/м²` : "Цена по запросу"}
                  </span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1 group-hover:text-gold transition-colors">
                    Подробнее
                    <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
