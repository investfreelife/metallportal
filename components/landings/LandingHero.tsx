import { Phone } from "lucide-react";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/contact";

interface LandingHeroProps {
  slug: string;
  h1: string;
  subtitle: string;
  ctaPrimary: string;
  heroImageSrc: string;
}

/**
 * Hero — server component. h1 + subtitle + 2 CTA кнопки + image.
 *
 * Phone CTA — клик шлёт `phone_click_landing_{slug}` в Метрику. Шлём через
 * inline `onclick` нет — Server Components не поддерживают handlers.
 * Используем `data-metrika-goal` атрибут и client-side Script ловит клик
 * (см. `LandingMetrikaTracker.tsx` в Schemas — TBD m007). Сейчас просто
 * tel-link, без goal-tracking — добавится в m007 когда Metrika активна.
 */
export default function LandingHero({
  slug,
  h1,
  subtitle,
  ctaPrimary,
  heroImageSrc,
}: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-card via-background to-muted border-b border-border py-12 md:py-20">
      <div className="container-main grid lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-6">
          <h1 className="text-3xl md:text-5xl font-black text-foreground leading-tight tracking-tight">
            {h1}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
            {subtitle}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="#cta-form"
              className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-7 py-3.5 rounded-lg transition-all text-base"
            >
              {ctaPrimary}
            </a>
            <a
              href={`tel:${CONTACT_PHONE_TEL}`}
              data-metrika-goal={`phone_click_landing_${slug}`}
              className="inline-flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-semibold px-6 py-3.5 rounded-lg transition-all text-base"
            >
              <Phone size={18} className="text-gold" />
              {CONTACT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
        {/* Hero-image. Placeholder PNG/JPG; Артём положит real visuals в m004+.
            При missing файле Next отдаст 404 → browser покажет broken-icon.
            Стандартный fallback для production deploy: положить generic PNG
            (см. public/images/landings/_placeholder.png). */}
        <div className="relative w-full h-72 md:h-96 rounded-xl overflow-hidden border border-border bg-gradient-to-br from-muted via-card to-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageSrc}
            alt={h1}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
