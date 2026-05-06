import type { LandingConfig } from "@/lib/landings";

interface Props {
  items: LandingConfig["cases"];
}

/**
 * Cases — server component. Grid 3-6 кейсов с фото + dimensions/price/duration + клиентский quote.
 * Реальные изображения положит Артём (catalog-images) в `public/images/landings/{slug}-case-{N}.jpg`.
 */
export default function LandingCases({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="container-main py-12 md:py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
        Наши работы
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((c, i) => (
          <article
            key={i}
            className="bg-card border border-border rounded-xl overflow-hidden hover:border-gold/50 transition-colors"
          >
            <div className="aspect-[4/3] bg-gradient-to-br from-muted via-card to-muted overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image}
                alt={c.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 space-y-2">
              <h3 className="text-base font-bold text-foreground">{c.title}</h3>
              {c.dimensions && (
                <p className="text-sm text-muted-foreground">{c.dimensions}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                {c.price && (
                  <span className="font-bold text-gold">{c.price}</span>
                )}
                {c.duration && (
                  <span className="text-muted-foreground">{c.duration}</span>
                )}
              </div>
              {c.quote && (
                <blockquote className="text-sm text-foreground/80 italic border-l-2 border-gold/40 pl-3 mt-3">
                  «{c.quote}»
                </blockquote>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
