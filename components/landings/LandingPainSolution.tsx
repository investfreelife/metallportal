import { AlertCircle, CheckCircle2 } from "lucide-react";

interface LandingPainSolutionProps {
  painTitle: string;
  painPoints: string[];
  solutionTitle: string;
  solutionPoints: string[];
}

/**
 * Pain → Solution narrative — emotional hook section после hero.
 * Two columns side-by-side: проблемы клиента → как мы решаем.
 */
export default function LandingPainSolution({
  painTitle,
  painPoints,
  solutionTitle,
  solutionPoints,
}: LandingPainSolutionProps) {
  return (
    <section className="py-12 md:py-16 bg-card/30 border-y border-border">
      <div className="container-main grid lg:grid-cols-2 gap-8 lg:gap-12">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <AlertCircle className="text-red-400 flex-shrink-0" size={28} />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {painTitle}
            </h2>
          </div>
          <ul className="space-y-3">
            {painPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-muted-foreground">
                <span className="text-red-400 flex-shrink-0">✗</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-5">
            <CheckCircle2 className="text-gold flex-shrink-0" size={28} />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              {solutionTitle}
            </h2>
          </div>
          <ul className="space-y-3">
            {solutionPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-foreground">
                <span className="text-gold flex-shrink-0">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
