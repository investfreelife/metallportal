import { Award, FileText, Shield, Building } from "lucide-react";

interface LandingTrustProps {
  legal?: { inn?: string; ogrn?: string; sroLicense?: string };
  guarantee?: { years: number; description: string };
  standards?: string[];
  objectsCompleted?: number;
}

/**
 * Trust badges — ИНН/ОГРН/СРО/гарантия/ГОСТы. Compact strip с iconами.
 */
export default function LandingTrust({
  legal,
  guarantee,
  standards,
  objectsCompleted,
}: LandingTrustProps) {
  return (
    <section className="py-10 md:py-14 bg-card/40 border-y border-border">
      <div className="container-main">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
          Почему нам доверяют
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {objectsCompleted && (
            <div className="text-center bg-background rounded-xl p-5 border border-border">
              <Building className="mx-auto text-gold mb-2" size={32} />
              <div className="text-3xl font-black text-gold mb-1">{objectsCompleted}+</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Готовых объектов в Москве и МО
              </div>
            </div>
          )}
          {guarantee && (
            <div className="text-center bg-background rounded-xl p-5 border border-border">
              <Shield className="mx-auto text-gold mb-2" size={32} />
              <div className="text-3xl font-black text-gold mb-1">{guarantee.years} лет</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Гарантия
              </div>
              <div className="text-xs text-foreground/70 mt-2 leading-relaxed">
                {guarantee.description}
              </div>
            </div>
          )}
          {legal && (legal.inn || legal.ogrn || legal.sroLicense) && (
            <div className="text-center bg-background rounded-xl p-5 border border-border">
              <FileText className="mx-auto text-gold mb-2" size={32} />
              <div className="text-sm font-semibold text-foreground mb-2">
                Юридические данные
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5 leading-relaxed">
                {legal.inn && <div>ИНН: {legal.inn}</div>}
                {legal.ogrn && <div>ОГРН: {legal.ogrn}</div>}
                {legal.sroLicense && <div>СРО: {legal.sroLicense}</div>}
              </div>
            </div>
          )}
          {standards && standards.length > 0 && (
            <div className="text-center bg-background rounded-xl p-5 border border-border">
              <Award className="mx-auto text-gold mb-2" size={32} />
              <div className="text-sm font-semibold text-foreground mb-2">
                ГОСТы и стандарты
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5 leading-relaxed">
                {standards.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
