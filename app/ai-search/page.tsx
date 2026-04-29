import type { Metadata } from "next";
import { SmartSearch } from "@/components/SmartSearch";
import { Sparkles, Zap, Clock, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Поиск с ИИ — Харланметалл",
  description: "Опишите нужный металлопрокат — ИИ подберёт из 12 000+ позиций и сформирует коммерческое предложение за секунды.",
  alternates: { canonical: "/ai-search" },
};

const FEATURES = [
  { icon: Zap, title: "Мгновенно", desc: "Результат за 5 секунд по любому описанию" },
  { icon: Sparkles, title: "12 000+ позиций", desc: "ИИ просматривает весь каталог за вас" },
  { icon: Clock, title: "Ответ за 15 минут", desc: "Менеджер перезвонит с точными ценами" },
  { icon: CheckCircle2, title: "Готовая заявка", desc: "Спецификация с ценами и наличием" },
];

const EXAMPLES = [
  "Арматура А500С d12 — 20 тонн",
  "Труба профильная 60×40×3 — 500 пог.м",
  "Уголок 63×63×5 — 10 тонн, нарезка 6м",
  "Лист горячекатаный 10мм — 50 листов",
  "Балка двутавровая 20Б1 — 200 пог.м",
  "Швеллер 20П — 5 тонн, самовывоз",
];

export default function AISearchPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 pt-14 pb-10">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container-main relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-5">
              <Sparkles size={13} />
              Искусственный интеллект
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
              Умный поиск металлопроката
            </h1>
            <p className="text-blue-200/80 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Опишите что нужно своими словами — ИИ подберёт из&nbsp;12&nbsp;000+ позиций
              и&nbsp;сформирует заявку с&nbsp;ценами
            </p>
          </div>

          {/* Search widget */}
          <div className="bg-white/[0.04] border border-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 max-w-2xl mx-auto shadow-2xl">
            <SmartSearch />
          </div>

          {/* Example queries */}
          <div className="mt-6 text-center">
            <p className="text-blue-300/60 text-xs mb-3">Примеры запросов:</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {EXAMPLES.map((ex) => (
                <span key={ex} className="text-xs bg-white/5 border border-white/10 text-blue-200/70 px-3 py-1.5 rounded-full">
                  {ex}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-background border-b border-border">
        <div className="container-main">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-2 p-4 bg-card border border-border rounded-2xl">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Icon size={20} className="text-blue-500" />
                </div>
                <p className="font-bold text-foreground text-sm">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 bg-background">
        <div className="container-main max-w-3xl">
          <h2 className="text-xl font-bold text-foreground text-center mb-8">Как это работает</h2>
          <div className="space-y-4">
            {[
              { n: "1", title: "Опишите потребность", desc: "Напишите что нужно в свободной форме: материал, размер, количество. Можно голосом или загрузив смету." },
              { n: "2", title: "ИИ подбирает позиции", desc: "За секунды находит совпадения в каталоге, определяет наличие на складе и рассчитывает ориентировочную стоимость." },
              { n: "3", title: "Вы корректируете заявку", desc: "Можно изменить количество, добавить позиции или удалить лишнее. Всё в одном экране." },
              { n: "4", title: "Менеджер перезванивает за 15 мин", desc: "Подтверждает наличие, уточняет условия и отправляет точное коммерческое предложение." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex gap-4 bg-card border border-border rounded-2xl p-5">
                <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                  {n}
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-0.5">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
