import type { LandingConfig } from "@/lib/landings";

interface Props {
  steps: LandingConfig["process"];
}

/**
 * Process — server component. Numbered steps в horizontal row на desktop,
 * vertical stack на mobile.
 */
export default function LandingProcess({ steps }: Props) {
  if (!steps.length) return null;

  return (
    <section className="bg-muted/30 border-y border-border py-12 md:py-16">
      <div className="container-main">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
          Как мы работаем
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {steps.map((s) => (
            <li
              key={s.step}
              className="bg-card border border-border rounded-xl p-5 relative"
            >
              <div className="absolute -top-3 -left-3 w-9 h-9 bg-gold text-black font-black rounded-full flex items-center justify-center text-sm">
                {s.step}
              </div>
              <h3 className="text-base font-bold text-foreground mb-2 mt-2">
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
