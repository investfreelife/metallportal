import Hero from "@/components/home/Hero";
import TrustCounters from "@/components/home/TrustCounters";
import ProductGrid from "@/components/home/ProductGrid";
import CategoryRow from "@/components/home/CategoryRow";
import HowItWorks from "@/components/home/HowItWorks";
import CTASection from "@/components/home/CTASection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <section className="bg-background py-5">
        <div className="container-main">
          <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
            МеталлПортал — крупная металлоторговая компания с собственным производством. Поставляем трубы, арматуру, листы, балки и профиль со склада. Изготавливаем металлоконструкции любой сложности под заказ — быстро, точно, с документами.
          </p>
        </div>
      </section>
      <TrustCounters />
      <ProductGrid />
      <CategoryRow />
      <section className="bg-background py-10">
        <div className="container-main">
          <h2 className="text-2xl font-bold text-foreground mb-4">Металлопрокат и изготовление конструкций — для частных лиц и бизнеса</h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
            МеталлПортал — это полный цикл: от подбора нужной позиции до изготовления готового изделия и доставки на объект. Работаем с частными мастерами, строительными бригадами, производственными предприятиями и крупными застройщиками.
          </p>
        </div>
      </section>
      <HowItWorks />
      <CTASection />
      <section className="bg-card py-10">
        <div className="container-main">
          <p className="text-muted-foreground text-sm leading-relaxed max-w-4xl">
            МеталлПортал — ведущий поставщик металлопроката в России. Продаём арматуру, трубы, листовой металл, балки, швеллеры и уголки оптом и в розницу. Изготавливаем металлоконструкции под заказ для частных лиц, строительных компаний и промышленных предприятий. Работаем с НДС, предоставляем полный пакет документов. Доставка по всей России.
          </p>
        </div>
      </section>
    </>
  );
}
