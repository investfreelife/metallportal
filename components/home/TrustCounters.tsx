import { Zap, Factory, Truck, FileText } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";

const ICONS = [Zap, Factory, Truck, FileText];

export default async function TrustCounters() {
  const settings = await getSiteSettings();

  const counters = [1, 2, 3, 4].map((i) => ({
    icon: ICONS[i - 1],
    label: settings[`trust_bar_${i}`] || ["1500+ позиций", "50+ поставщиков", "Доставка за 3 дня", "Документы"][i - 1],
  }));

  return (
    <section className="bg-card border-y border-border">
      <div className="container-main py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {counters.map((counter, index) => {
            const Icon = counter.icon;
            return (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gold/10 rounded flex items-center justify-center">
                  <Icon className="text-gold" size={20} />
                </div>
                <div className="text-sm text-foreground/80">{counter.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
