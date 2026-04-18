import Link from "next/link";
import { CheckCircle, ArrowRight, Phone, Shield, Clock, Ruler, Wrench, Building2, Home, Trees, Factory, Fence, DoorOpen } from "lucide-react";
import CTASection from "@/components/home/CTASection";

export const metadata = {
  title: "Готовые металлоконструкции — ангары, навесы, склады, каркасы | МеталлПортал",
  description: "Производство и продажа готовых металлоконструкций: ангары, навесы, склады, каркасы зданий. Быстрый монтаж, ГОСТ, гарантия. Расчёт за 1 день.",
};

const CATEGORIES = [
  {
    icon: Building2,
    label: "Ангары",
    href: "/catalog/angary",
    desc: "Быстровозводимые ангары из лёгких стальных конструкций. Пролёт от 6 до 60 м, любая длина.",
    tags: ["Арочные", "Каркасные", "Разборные"],
  },
  {
    icon: Home,
    label: "Навесы и козырьки",
    href: "/catalog/navesy-i-kozyrki",
    desc: "Металлические навесы для автомобилей, веранд, входных групп и промышленных объектов.",
    tags: ["Для авто", "Для веранды", "Промышленные"],
  },
  {
    icon: Factory,
    label: "Склады и цеха",
    href: "/catalog/sklady-i-tseha",
    desc: "Производственные и складские здания на металлическом каркасе. Монтаж за 2–4 недели.",
    tags: ["Склады", "Цеха", "Хранилища"],
  },
  {
    icon: Wrench,
    label: "Каркасы зданий",
    href: "/catalog/karkasy-zdaniy",
    desc: "Металлические каркасы для жилых домов, торговых центров и офисных зданий.",
    tags: ["Жилые", "Коммерческие", "Промышленные"],
  },
  {
    icon: Fence,
    label: "Заборы и ограждения",
    href: "/catalog/gotovye-konstruktsii",
    desc: "Сварные секционные ограждения, рабица, сетчатые заборы для периметра.",
    tags: ["Секционные", "Сетчатые", "Сварные"],
  },
  {
    icon: DoorOpen,
    label: "Ворота и калитки",
    href: "/catalog/gotovye-konstruktsii",
    desc: "Распашные, откатные и подъёмные ворота из профильной трубы с порошковым покрытием.",
    tags: ["Откатные", "Распашные", "Подъёмные"],
  },
];

const ADVANTAGES = [
  { icon: Shield, title: "Гарантия 10 лет", desc: "На все сварные конструкции и антикоррозийное покрытие" },
  { icon: Clock, title: "Монтаж за 14 дней", desc: "Типовые ангары и навесы — от проекта до сдачи объекта" },
  { icon: Ruler, title: "Любые размеры", desc: "Проектирование по вашим чертежам или под ключ" },
  { icon: CheckCircle, title: "ГОСТ и СП", desc: "Расчёт по актуальным строительным нормам и стандартам" },
];

const PROCESS = [
  { n: "01", title: "Заявка", desc: "Оставляете заявку — менеджер перезванивает за 15 минут" },
  { n: "02", title: "Расчёт", desc: "Готовим КП с ценой и сроками за 1 рабочий день" },
  { n: "03", title: "Договор", desc: "Подписываем договор, вы вносите предоплату 30%" },
  { n: "04", title: "Производство", desc: "Изготовление конструкций на собственном заводе" },
  { n: "05", title: "Доставка", desc: "Доставка по России собственным и партнёрским транспортом" },
  { n: "06", title: "Монтаж", desc: "Монтажная бригада собирает конструкцию под ключ" },
];

export default function GotovyeKonstruktsiiPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0d0d1a] py-16 lg:py-24">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 70% 50%, #E8B86D33 0%, transparent 60%)" }} />
        <div className="container-main relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-full px-4 py-1.5 mb-6">
              <span className="text-gold text-xs font-semibold uppercase tracking-wider">🏗️ Готовые металлоконструкции</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
              Металлоконструкции<br />
              <span className="text-gold">под ключ</span>
            </h1>
            <p className="text-white/60 text-lg lg:text-xl mb-8 max-w-2xl leading-relaxed">
              Ангары, навесы, склады, каркасы зданий и ограждения. Проектирование,
              производство и монтаж — всё на одном заводе. Расчёт стоимости за 1 день.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/catalog/gotovye-konstruktsii#categories"
                className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-all">
                Смотреть каталог <ArrowRight size={16} />
              </Link>
              <a href="tel:+78001234567"
                className="inline-flex items-center gap-2 border-2 border-white/20 hover:border-gold text-white px-6 py-3 rounded-lg transition-all font-semibold">
                <Phone size={16} /> Получить расчёт
              </a>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="container-main relative z-10 mt-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { val: "500+", label: "Объектов сдано" },
              { val: "14", label: "Дней до монтажа" },
              { val: "10", label: "Лет гарантии" },
              { val: "1 день", label: "Расчёт КП" },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-3xl font-black text-gold mb-1">{s.val}</div>
                <div className="text-white/50 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="py-16 bg-background">
        <div className="container-main">
          <h2 className="text-3xl font-bold text-foreground mb-2">Каталог конструкций</h2>
          <p className="text-muted-foreground mb-10">Выберите тип нужной вам металлоконструкции</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link key={cat.href + cat.label} href={cat.href}
                  className="group bg-card border border-border hover:border-gold/50 rounded-xl p-6 transition-all hover:shadow-xl hover:shadow-gold/5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-gold/20 transition-colors">
                      <Icon size={22} className="text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground mb-1 group-hover:text-gold transition-colors">{cat.label}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-3">{cat.desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.tags.map(t => (
                          <span key={t} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-gold text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Смотреть <ArrowRight size={14} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-16 bg-muted/30">
        <div className="container-main">
          <h2 className="text-3xl font-bold text-foreground mb-10 text-center">Почему выбирают нас</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ADVANTAGES.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="text-center">
                  <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon size={26} className="text-gold" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{a.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{a.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-16 bg-background">
        <div className="container-main">
          <h2 className="text-3xl font-bold text-foreground mb-2">Как мы работаем</h2>
          <p className="text-muted-foreground mb-10">От заявки до готового объекта</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROCESS.map((p, i) => (
              <div key={i} className="flex gap-4">
                <div className="text-4xl font-black text-gold/20 leading-none w-12 flex-shrink-0">{p.n}</div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{p.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />

      {/* SEO text */}
      <section className="bg-background py-14">
        <div className="container-main">
          <h2 className="text-3xl font-bold text-foreground mb-5">Готовые металлоконструкции — МеталлПортал</h2>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-4xl">
            МеталлПортал производит и поставляет готовые металлоконструкции для строительства промышленных,
            коммерческих и сельскохозяйственных объектов по всей России. Наш завод располагает полным
            производственным циклом — от проектирования до монтажа конструкций «под ключ».
          </p>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏗️</span>
            <h3 className="text-2xl font-bold text-foreground">Ангары и складские здания</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
            Быстровозводимые ангары — одно из самых востребованных решений для хранения техники,
            зерна, удобрений и производственного оборудования. Конструкции изготавливаются из
            горячекатаного профиля и холодногнутых профилей по ГОСТ. Антикоррозийная обработка и
            полимерное покрытие обеспечивают срок службы более 50 лет.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {[
              "Пролёт 6–60 м без внутренних опор",
              "Высота стен от 3 до 12 м",
              "Утеплённые и неутеплённые варианты",
              "Ворота откатные, распашные, секционные",
              "Фундамент: свайный, ленточный, плита",
              "Срок монтажа типового ангара 18×36 — 5 дней",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                <CheckCircle size={18} className="text-gold flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>

          <div className="bg-muted/40 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏠</span>
              <h3 className="text-xl font-bold text-foreground">Навесы, козырьки и ограждения</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Металлические навесы для парковок, беседок и входных групп изготавливаются из
              профильной трубы с порошковым покрытием. Кровля: поликарбонат, профнастил или
              металлочерепица. Ограждения периметра — сварные секционные заборы из прутка
              3–5 мм с горизонтальными перемычками. Высота от 1,5 до 3 м.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Для промышленных объектов выпускаем сетчатые ограждения из оцинкованной
              сетки рабица и сварной сетки. Все конструкции оцинкованы горячим методом или
              покрыты грунт-эмалью по металлу для защиты от коррозии.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
