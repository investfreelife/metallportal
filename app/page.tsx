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
      <TrustCounters />
      <ProductGrid />
      <CategoryRow />
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
