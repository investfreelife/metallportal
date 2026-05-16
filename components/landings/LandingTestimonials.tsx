import { Star } from "lucide-react";

interface Testimonial {
  author: string;
  company?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  quote: string;
  source?: "yandex_maps" | "2gis" | "avito" | "direct";
  date?: string;
}

interface LandingTestimonialsProps {
  testimonials: Testimonial[];
  aggregateRating?: { score: number; reviewsCount: number };
}

const SOURCE_LABELS: Record<NonNullable<Testimonial["source"]>, string> = {
  yandex_maps: "Яндекс.Карты",
  "2gis": "2GIS",
  avito: "Avito",
  direct: "Личный отзыв",
};

/**
 * Отзывы клиентов — social proof grid 3 col на desktop.
 * Aggregate rating сверху если задан.
 */
export default function LandingTestimonials({
  testimonials,
  aggregateRating,
}: LandingTestimonialsProps) {
  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container-main">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Отзывы клиентов
          </h2>
          {aggregateRating && (
            <div className="flex items-center justify-center gap-2 text-lg">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={20}
                    className={
                      i <= Math.round(aggregateRating.score)
                        ? "text-gold fill-gold"
                        : "text-muted"
                    }
                  />
                ))}
              </div>
              <span className="font-bold text-foreground">{aggregateRating.score}</span>
              <span className="text-muted-foreground">/ 5 на основе {aggregateRating.reviewsCount} отзывов</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <article key={i} className="bg-card border border-border rounded-xl p-5">
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    className={s <= t.rating ? "text-gold fill-gold" : "text-muted"}
                  />
                ))}
              </div>
              <blockquote className="text-sm text-foreground/90 mb-4 leading-relaxed">
                «{t.quote}»
              </blockquote>
              <footer className="text-xs">
                <div className="font-semibold text-foreground">{t.author}</div>
                {t.company && <div className="text-muted-foreground mt-0.5">{t.company}</div>}
                {t.source && (
                  <div className="mt-2 text-muted-foreground/70 italic">
                    {SOURCE_LABELS[t.source]} {t.date && `· ${t.date}`}
                  </div>
                )}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
