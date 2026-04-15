const steps = [
  { icon: "🎤", title: "Опишите что нужно голосом или текстом" },
  { icon: "💬", title: "Менеджер подберёт лучшую цену за 15 минут" },
  { icon: "🚛", title: "Получите металл с документами и доставкой" },
];

export default function HowItWorks() {
  return (
    <section className="bg-card py-12">
      <div className="container-main">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className="flex-shrink-0 text-4xl">{step.icon}</div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Шаг {index + 1}
                </div>
                <p className="text-base text-foreground">{step.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
