import { Zap, Factory, Truck, FileText } from "lucide-react";

const counters = [
  { icon: Zap, label: "1500+ позиций в каталоге" },
  { icon: Factory, label: "50+ проверенных поставщиков" },
  { icon: Truck, label: "Доставка за 3 дня" },
  { icon: FileText, label: "Документы: УПД, счёт-фактура" },
];

export default function TrustCounters() {
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
