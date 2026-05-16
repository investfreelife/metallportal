import { ArrowRight } from "lucide-react";

interface LandingMidCTAProps {
  title: string;
  subtitle?: string;
  ctaText: string;
  variant?: "compact" | "wide";
}

/**
 * Mid-page CTA блок — strategic placement точки захвата (after_benefits / after_calculator / after_cases / after_faq).
 */
export default function LandingMidCTA({
  title,
  subtitle,
  ctaText,
  variant = "compact",
}: LandingMidCTAProps) {
  return (
    <section className={`py-8 ${variant === "wide" ? "md:py-12" : "md:py-10"} bg-gold/5 border-y border-gold/20`}>
      <div className="container-main max-w-4xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5 text-center md:text-left">
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-1">{title}</h3>
            {subtitle && (
              <p className="text-sm md:text-base text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <a
            href="#cta-form"
            className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-7 py-3 rounded-lg transition-all whitespace-nowrap"
          >
            {ctaText}
            <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
