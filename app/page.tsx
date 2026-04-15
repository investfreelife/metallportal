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
    </>
  );
}
