import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import TrustCounters from "@/components/home/TrustCounters";
import ProductGrid from "@/components/home/ProductGrid";
import CategoryRow from "@/components/home/CategoryRow";
import HowItWorks from "@/components/home/HowItWorks";
import CTASection from "@/components/home/CTASection";
import Link from "next/link";
import { CheckCircle, Calculator, ArrowRight } from "lucide-react";
import { AISearch } from "@/components/AISearch";
import { DocumentUpload } from "@/components/DocumentUpload";

export const metadata: Metadata = {
  title: "МеталлПортал — Металлопрокат оптом и в розницу в Москве",
  description:
    "Купите металлопрокат оптом и в розницу: арматура, трубы, листовой металл. 1500+ позиций в наличии. Доставка по Москве и всей России. Цены от производителя.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "МеталлПортал — Металлопрокат оптом и в розницу в Москве",
    description:
      "Купите металлопрокат оптом и в розницу: арматура, трубы, листовой металл. 1500+ позиций в наличии. Доставка по Москве и всей России.",
    url: "/",
    type: "website",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "МеталлПортал",
  alternateName: "МЕТАЛЛПОРТАЛ",
  url: "https://metallportal.vercel.app",
  description:
    "B2B/B2C маркетплейс металлопроката, труб, арматуры и другой металлопродукции. Прямые поставки от производителей по всей России.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Москва",
    addressCountry: "RU",
  },
  areaServed: "RU",
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Металлопрокат",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Product", name: "Арматура А500С" } },
      { "@type": "Offer", itemOffered: { "@type": "Product", name: "Трубы стальные" } },
      { "@type": "Offer", itemOffered: { "@type": "Product", name: "Листовой металл" } },
    ],
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Hero />
      <TrustCounters />

      {/* AI Поиск металлопроката */}
      <section className="py-10 bg-background">
        <div className="container-main">
          <div className="text-center mb-5">
            <h2 className="text-2xl font-bold text-foreground mb-1.5">Найти металлопрокат</h2>
            <p className="text-muted-foreground text-sm">Опишите что нужно — AI подберёт из 12 000+ позиций</p>
          </div>
          <AISearch />
        </div>
      </section>

      <ProductGrid />

      {/* Калькуляторы баннер */}
      <section className="py-6">
        <div className="container-main">
          <Link href="/tools"
            className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-gold/20 via-yellow-500/10 to-gold/20 border border-gold/40 rounded-2xl px-6 py-5 hover:border-gold transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gold rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">🧮</div>
              <div>
                <p className="font-bold text-foreground text-lg leading-tight">Калькуляторы металлопроката</p>
                <p className="text-muted-foreground text-sm">Вес · Арматура для фундамента · Сетка · Смета · Раскрой листа</p>
              </div>
            </div>
            <span className="flex items-center gap-2 bg-gold group-hover:bg-yellow-400 text-black font-bold px-5 py-2.5 rounded-xl transition-all flex-shrink-0">
              Открыть <ArrowRight size={16} />
            </span>
          </Link>
        </div>
      </section>

      <CategoryRow />
      <HowItWorks />

      {/* Загрузить смету */}
      <section className="py-12 bg-muted/30">
        <div className="container-main">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Загрузить смету или проект</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Загрузите PDF, DOCX или Excel — AI расшифрует позиции металлопроката и сформирует коммерческое предложение
            </p>
          </div>
          <DocumentUpload />
        </div>
      </section>

      <CTASection />
      <section className="bg-background py-14">
        <div className="container-main">
          <h2 className="text-3xl font-bold text-foreground mb-5">Металлопрокат и металлоконструкции — МеталлПортал</h2>
          <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
            МеталлПортал — крупный поставщик металлопроката и производитель металлоконструкций для частных лиц, строительных компаний и промышленных предприятий по всей России. Прямые договоры с проверенными заводами-производителями позволяют нам предлагать металл оптом и в розницу по конкурентным ценам без посредников. Вся продукция соответствует требованиям ГОСТ и действующим строительным нормам.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">&#128230;</span>
            <h3 className="text-2xl font-bold text-foreground">Металлопрокат — оптом и в розницу</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
            МеталлПортал предлагает более 1 500 позиций металлопроката промышленного и строительного назначения. В постоянном наличии на складе — наиболее востребованные виды проката:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {[
              "Арматура А500С, А240 — диаметры от 6 до 40 мм",
              "Трубы стальные — круглые, профильные, электросварные, бесшовные",
              "Листовой металл — горячекатаный, холоднокатаный, оцинкованный",
              "Балки и швеллеры — двутавр, швеллер по ГОСТ",
              "Сортовой прокат — уголок, круг, полоса, шестигранник",
              "Метизы — болты, гайки, шпильки, анкеры, нестандартные изделия",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                <CheckCircle size={18} className="text-gold flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>

          <div className="bg-muted/40 rounded-xl p-5 space-y-3">
            <p className="text-muted-foreground leading-relaxed">
              На складе единовременно размещено <strong className="text-foreground">свыше 8 000 тонн проката</strong> — чёрный металл, цветные металлы и металлосплавы. Отгрузка производится в минимальные сроки: подтверждение и комплектация заказа занимают не более нескольких часов.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              При покупке металлопроката оптом действует гибкая система скидок в зависимости от объёма заказа. Работаем как с юридическими лицами (с НДС, полный пакет документов), так и с физическими лицами — от одного листа или прутка.
            </p>
          </div>
        </div>
      </section>

      {/* Дополнительные услуги по обработке металла */}
      <section className="bg-background py-12">
        <div className="container-main">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔧</span>
            <h3 className="text-2xl font-bold text-foreground">Дополнительные услуги по обработке металла</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Помимо продажи проката, МеталлПортал оказывает полный спектр услуг по металлообработке прямо на складе:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {[
              "Резка в размер — плазменная, газовая, механическая",
              "Цинкование — горячее и холодное",
              "Гибка и правка металла",
              "Сверление и нарезка резьбы",
              "Изготовление деталей по чертежам и эскизам заказчика",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                <CheckCircle size={18} className="text-gold flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground leading-relaxed italic max-w-4xl">
            Если вы затрудняетесь с подбором продукции — опытные менеджеры МеталлПортал помогут выбрать оптимальный вариант по наименованиям, размерам и комплектации под ваши конкретные задачи.
          </p>
        </div>
      </section>

      {/* Металлоконструкции — изготовление под заказ */}
      <section className="bg-background py-12">
        <div className="container-main">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏗️</span>
            <h3 className="text-2xl font-bold text-foreground">Металлоконструкции — изготовление под заказ</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
            МеталлПортал не просто продаёт металл — мы изготавливаем готовые металлоконструкции любой сложности по чертежам, эскизам или техническому заданию заказчика. Собственное производственное подразделение позволяет выполнять заказы в сжатые сроки с контролем качества на каждом этапе.
          </p>
          <p className="font-bold text-foreground mb-4">Что мы изготавливаем:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="font-bold text-foreground mb-3">Для строительства и производства:</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {["Металлокаркасы зданий, ангаров и складов","Несущие конструкции и фермы перекрытий","Колонны, ригели, прогоны","Закладные детали и монтажные элементы"].map((t,i)=>(
                  <li key={i} className="flex items-start gap-2"><span className="text-gold mt-0.5">›</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="font-bold text-foreground mb-3">Для благоустройства и частного строительства:</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {["Ворота распашные и откатные","Заборы, ограждения, секции, калитки","Навесы над въездом, парковкой, террасой","Лестницы, перила, поручни","Козырьки и входные группы"].map((t,i)=>(
                  <li key={i} className="flex items-start gap-2"><span className="text-gold mt-0.5">›</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="font-bold text-foreground mb-3">Нестандартные изделия:</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {["Детали и узлы по чертежам заказчика","Сварные конструкции любой конфигурации","Изделия для промышленного оборудования","Опоры, стойки, рамы, кронштейны"].map((t,i)=>(
                  <li key={i} className="flex items-start gap-2"><span className="text-gold mt-0.5">›</span>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Кто наши клиенты */}
      <section className="bg-background py-12">
        <div className="container-main">
          <h3 className="text-2xl font-bold text-foreground mb-4">Кто наши клиенты</h3>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Мы работаем без ограничений по масштабу заказа — одинаково ответственно подходим к небольшому частному заказу и к крупному промышленному проекту:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: "🏠", title: "Частные лица", sub: "дом, дача, гараж, приусадебный участок" },
              { icon: "🏗️", title: "Строительные компании", sub: "комплектация объектов под ключ" },
              { icon: "🏭", title: "Промышленные предприятия", sub: "серийное производство деталей и узлов" },
              { icon: "📐", title: "Проектные бюро и архитекторы", sub: "реализация нестандартных решений" },
            ].map((c, i) => (
              <div key={i} className="flex items-start gap-4 border border-border rounded-xl p-4 bg-card">
                <span className="text-3xl">{c.icon}</span>
                <div>
                  <p className="font-bold text-foreground">{c.title}</p>
                  <p className="text-sm text-muted-foreground">{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Доставка */}
      <section className="bg-background py-12">
        <div className="container-main">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🚚</span>
            <h3 className="text-2xl font-bold text-foreground">Доставка металлопроката и конструкций</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-3 max-w-4xl">
            МеталлПортал осуществляет доставку продукции собственным автотранспортом по Москве и Московской области — прямо с нашего склада до вашего объекта или склада. Стоимость доставки рассчитывается исходя из грузоподъёмности транспортного средства и удалённости точки разгрузки от МКАД.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3 max-w-4xl">
            Доставка в регионы России выполняется через транспортные компании-партнёры — условия согласовываются с менеджером индивидуально.
          </p>
          <p className="text-muted-foreground leading-relaxed max-w-4xl">
            Изготовленные металлоконструкции доставляем в разобранном виде с маркировкой элементов и монтажной схемой, либо силами нашей монтажной бригады — под ключ.
          </p>
        </div>
      </section>

      {/* Почему выбирают МеталлПортал */}
      <section className="py-12" style={{ background: "rgba(245,230,180,0.15)" }}>
        <div className="container-main">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Почему выбирают МеталлПортал</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
            {[
              "Более 1 500 позиций металлопроката в наличии на складе",
              "Свыше 50 проверенных поставщиков и производителей",
              "Изготовление металлоконструкций любой сложности под заказ",
              "Работа с физическими и юридическими лицами — НДС, все документы",
              "Резка, гибка, цинкование — обработка прямо на складе",
              "Доставка по Москве, МО и всей России",
              "Ответ менеджера — в течение 15 минут",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card/60">
                <CheckCircle size={18} className="text-gold flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
