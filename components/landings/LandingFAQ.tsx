import type { LandingConfig } from "@/lib/landings";

interface Props {
  items: LandingConfig["faq"];
}

/**
 * FAQ — server component, no-JS accordion через native `<details>`.
 * JSON-LD FAQPage рендерится separately в `LandingSchemas.tsx`.
 */
export default function LandingFAQ({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="container-main py-12 md:py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
        Частые вопросы
      </h2>
      <div className="max-w-3xl space-y-3">
        {items.map((f, i) => (
          <details
            key={i}
            className="bg-card border border-border rounded-xl px-5 py-4 group"
          >
            <summary className="cursor-pointer font-semibold text-foreground list-none flex items-start justify-between gap-3">
              <span>{f.question}</span>
              <span className="text-gold transition-transform group-open:rotate-45 text-xl leading-none flex-shrink-0">
                +
              </span>
            </summary>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              {f.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
