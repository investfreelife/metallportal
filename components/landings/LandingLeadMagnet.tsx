import { Download, Mail } from "lucide-react";

interface LandingLeadMagnetProps {
  title: string;
  description: string;
  fileSrc: string;
  formCta: string;
}

/**
 * Lead magnet — PDF guide download form. Capture email для post-launch follow-up.
 */
export default function LandingLeadMagnet({
  title,
  description,
  fileSrc,
  formCta,
}: LandingLeadMagnetProps) {
  return (
    <section className="py-12 md:py-16 bg-gradient-to-br from-gold/10 via-background to-card/40">
      <div className="container-main max-w-3xl">
        <div className="bg-card border-2 border-gold/40 rounded-2xl p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 bg-gold/20 rounded-xl p-3">
              <Download className="text-gold" size={32} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                {title}
              </h2>
              <p className="text-sm md:text-base text-muted-foreground mb-5 leading-relaxed">
                {description}
              </p>
              <form className="flex flex-col sm:flex-row gap-3" data-lead-magnet={fileSrc}>
                <input
                  type="email"
                  required
                  placeholder="Ваш email"
                  className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-all whitespace-nowrap"
                >
                  <Mail size={18} />
                  {formCta}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
