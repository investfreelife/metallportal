import Hero from "@/components/home/Hero";
import TrustCounters from "@/components/home/TrustCounters";
import ProductGrid from "@/components/home/ProductGrid";
import CategoryRow from "@/components/home/CategoryRow";
import HowItWorks from "@/components/home/HowItWorks";
import CTASection from "@/components/home/CTASection";
import { CheckCircle } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustCounters />
      <ProductGrid />
      <CategoryRow />
      <HowItWorks />
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
    </>
  );
}
