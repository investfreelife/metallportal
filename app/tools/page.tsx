"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Calculator, Building2, Grid2x2, FileSpreadsheet,
  Scissors, ArrowRight, Phone, Truck, Shield, Zap,
  CheckCircle2, Scale, ChevronRight,
} from "lucide-react";

const WeightCalc    = dynamic(() => import("@/components/tools/WeightCalc"),    { ssr: false });
const FoundationCalc = dynamic(() => import("@/components/tools/FoundationCalc"), { ssr: false });
const MeshCalc      = dynamic(() => import("@/components/tools/MeshCalc"),      { ssr: false });
const EstimateCalc  = dynamic(() => import("@/components/tools/EstimateCalc"),  { ssr: false });
const SheetCalc     = dynamic(() => import("@/components/tools/SheetCalc"),     { ssr: false });

const TABS = [
  { id: "weight",      label: "Вес металла",        short: "Вес",         icon: Scale,         desc: "Любой прокат: кг/м, всего кг и т" },
  { id: "conversion",  label: "Метры ↔ Тонны",      short: "М↔Т",        icon: Calculator,    desc: "Быстрый перевод для арматуры, трубы, круга" },
  { id: "foundation",  label: "Арматура фундамента", short: "Фундамент",  icon: Building2,     desc: "Ленточный, плита, столбчатый" },
  { id: "mesh",        label: "Арматурная сетка",    short: "Сетка",      icon: Grid2x2,       desc: "Перекрытия, стяжка, отмостка" },
  { id: "estimate",    label: "Смета конструкции",   short: "Смета",      icon: FileSpreadsheet, desc: "Добавляй позиции — считай итог" },
  { id: "sheet",       label: "Расчёт листа",        short: "Лист",       icon: Scissors,      desc: "Деталей с листа, % использования" },
];

const OFFERS = [
  {
    tag: "ХИТЫ ПРОДАЖ",
    title: "Арматура А500С",
    items: ["⌀8–⌀40 мм", "ГОСТ 5781-82", "Порезка в размер"],
    price: "от 62 000 ₽/т",
    href: "/search?q=арматура",
    color: "from-amber-500/10 to-yellow-500/5",
    border: "border-amber-500/30",
  },
  {
    tag: "ПОПУЛЯРНОЕ",
    title: "Профильная труба",
    items: ["20×20 — 200×200 мм", "Стенка 1.5–10 мм", "Все размеры в наличии"],
    price: "от 49 000 ₽/т",
    href: "/search?q=труба профильная",
    color: "from-blue-500/10 to-sky-500/5",
    border: "border-blue-500/30",
  },
  {
    tag: "ВЫГОДНО",
    title: "Листовой металл",
    items: ["г/к, х/к, оцинк.", "Толщина 0.5–60 мм", "Нарезка по чертежу"],
    price: "от 58 000 ₽/т",
    href: "/search?q=лист",
    color: "from-emerald-500/10 to-green-500/5",
    border: "border-emerald-500/30",
  },
  {
    tag: "ОПТ",
    title: "Балки и швеллеры",
    items: ["ГОСТ 8239-89 / 8240-97", "№10 — №60", "Скидки от 5 тонн"],
    price: "от 71 000 ₽/т",
    href: "/search?q=балка",
    color: "from-purple-500/10 to-violet-500/5",
    border: "border-purple-500/30",
  },
];

const ADVANTAGES = [
  { icon: Truck, title: "Доставка за 1 день", text: "По городу и области. Собственный автопарк — никаких посредников." },
  { icon: Shield, title: "Гарантия по ГОСТ", text: "Сертификаты качества на весь металлопрокат. Работаем с НДС." },
  { icon: Zap, title: "Порезка в размер", text: "Нарежем по вашему чертежу. Отходы — минимальные." },
  { icon: Phone, title: "Менеджер за 5 минут", text: "Звоним сразу после заявки. Счёт — в течение 30 минут." },
];

export default function ToolsPage() {
  const [tab, setTab] = useState("weight");

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-card via-background to-muted border-b border-border py-14 md:py-20">
        <div className="container-main text-center space-y-5">
          <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">
            <Calculator size={12} /> Профессиональные инструменты
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-foreground leading-tight">
            Калькуляторы<br />
            <span className="text-gold">металлопроката</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Рассчитайте вес, переведите метры в тонны, посчитайте арматуру для фундамента — и сразу купите нужный металл по оптовым ценам.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/catalog" className="flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-all">
              Перейти в каталог <ArrowRight size={16} />
            </Link>
            <Link href="/cart" className="flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-semibold px-6 py-3 rounded-lg transition-all">
              Корзина
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 pt-4 text-sm text-muted-foreground">
            {["3 800+ позиций в наличии", "Доставка за 1 день", "Порезка в размер", "Работаем с НДС"].map(t => (
              <span key={t} className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" />{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Calculators */}
      <section className="container-main py-12" id="calculators">
        <h2 className="text-2xl font-bold text-foreground mb-6">Онлайн-калькуляторы</h2>

        {/* Tab nav — horizontal scroll on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6 scrollbar-none">
          <div className="flex gap-2 min-w-max">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                    tab === t.id
                      ? "bg-gold text-black border-gold shadow-md"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-gold/50"
                  }`}>
                  <Icon size={15} />
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active tab description */}
        <p className="text-sm text-muted-foreground mb-4">
          {TABS.find(t => t.id === tab)?.desc}
        </p>

        {/* Calculator panels */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6">
          {tab === "weight"      && <WeightCalc />}
          {tab === "conversion"  && <WeightCalc />}
          {tab === "foundation"  && <FoundationCalc />}
          {tab === "mesh"        && <MeshCalc />}
          {tab === "estimate"    && <EstimateCalc />}
          {tab === "sheet"       && <SheetCalc />}
        </div>
      </section>

      {/* Offers */}
      <section className="bg-muted/30 border-y border-border py-12">
        <div className="container-main">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">Выгодные предложения</h2>
            <Link href="/catalog" className="flex items-center gap-1 text-gold hover:underline text-sm font-medium">
              Весь каталог <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {OFFERS.map(o => (
              <Link key={o.title} href={o.href}
                className={`bg-gradient-to-br ${o.color} border ${o.border} rounded-2xl p-5 hover:shadow-lg transition-all group`}>
                <span className="text-[10px] font-bold tracking-widest text-gold uppercase">{o.tag}</span>
                <h3 className="text-lg font-bold text-foreground mt-1 mb-3 group-hover:text-gold transition-colors">{o.title}</h3>
                <ul className="space-y-1 mb-4">
                  {o.items.map(item => (
                    <li key={item} className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />{item}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between">
                  <span className="text-gold font-bold text-lg">{o.price}</span>
                  <ArrowRight size={16} className="text-gold group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="container-main py-12">
        <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Почему выбирают нас</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ADVANTAGES.map(a => {
            const Icon = a.icon;
            return (
              <div key={a.title} className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                  <Icon size={20} className="text-gold" />
                </div>
                <h3 className="font-bold text-foreground">{a.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-r from-gold/20 via-yellow-500/10 to-gold/20 border-y border-gold/30 py-12">
        <div className="container-main text-center space-y-5">
          <h2 className="text-2xl md:text-3xl font-black text-foreground">
            Рассчитали? Пора заказывать!
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Оставьте заявку — перезвоним за 5 минут, выставим счёт с НДС, доставим в срок.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/catalog"
              className="flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-black text-lg px-8 py-4 rounded-xl transition-all shadow-lg shadow-gold/20">
              Купить металл <ArrowRight size={20} />
            </Link>
            <Link href="/cart"
              className="flex items-center gap-2 border-2 border-foreground/20 hover:border-gold text-foreground font-bold px-8 py-4 rounded-xl transition-all">
              Посмотреть корзину
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
