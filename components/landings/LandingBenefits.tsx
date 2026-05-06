import type { LandingConfig } from "@/lib/landings";

interface Props {
  items: LandingConfig["benefits"];
}

/**
 * Benefits — server component, grid 3-5 cards.
 * Icon — emoji или текст (Lucide name как просто текст; реальные icons —
 * m004+ candidate чтобы избегать heavy bundle).
 */
export default function LandingBenefits({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="container-main py-12 md:py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
        Почему выбирают нас
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((b, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-xl p-6 hover:border-gold/50 transition-colors"
          >
            {b.icon && <div className="text-3xl mb-3">{b.icon}</div>}
            <h3 className="text-lg font-bold text-foreground mb-2">{b.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {b.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
