import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getRelatedLandings } from "@/lib/landings/queries";

interface Props {
  /** UUID категории. Юzed для DB lookup в junction table. */
  categoryId: string;
}

/**
 * Server component — рендерит секцию «Готовые решения с этим материалом»
 * на catalog/category pages. Если linked landings отсутствуют — возвращает
 * `null` (no UI noise).
 *
 * Cards: hero image (с placeholder fallback) + title + subtitle excerpt +
 * "Готовое решение" badge для primary-link type.
 *
 * Используется в `/catalog/[category]/page.tsx`,
 * `/catalog/[category]/[subcategory]/page.tsx`, etc.
 */
export default async function RelatedLandingsSection({ categoryId }: Props) {
  const related = await getRelatedLandings(categoryId);
  if (related.length === 0) return null;

  return (
    <section className="my-12 py-8 border-t border-gold/20">
      <div className="container-main">
        <div className="mb-6 flex items-start gap-3">
          <span className="text-3xl">🏗</span>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Готовые решения с этим материалом
            </h2>
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              Не хотите рассчитывать сами? Закажите готовое изделие под ключ —
              наша команда сделает с гарантией 10 лет.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {related.map(({ slug, config, displayLabel, linkType }) => (
            <Link
              key={slug}
              href={`/landing/${slug}`}
              className="group block bg-card border border-border rounded-xl overflow-hidden transition-all hover:shadow-lg hover:border-gold/40 hover:-translate-y-0.5"
            >
              <article>
                <div className="relative h-44 bg-gradient-to-br from-gold/15 via-gold/5 to-muted overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={config.hero.heroImageSrc}
                    alt={displayLabel}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {linkType === "primary" && (
                    <span className="absolute top-3 right-3 bg-gold text-black px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-lg">
                      Готовое решение
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="text-base font-bold text-foreground group-hover:text-gold transition-colors leading-snug">
                    {displayLabel}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {config.hero.subtitle}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-gold text-sm font-semibold">
                    Подробнее
                    <ArrowRight
                      size={16}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
