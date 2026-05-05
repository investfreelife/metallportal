import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import AdminBar from "@/components/admin/AdminBar";
import CookieBanner from "@/components/CookieBanner";
import { CartProvider } from "@/contexts/CartContext";
import { SITE_URL } from "@/lib/site";
import YandexMetrika from "@/components/analytics/YandexMetrika";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Харланметалл — Металлопрокат и конструкции",
    template: "%s | Харланметалл",
  },
  description:
    "Металлопрокат, трубы, арматура и готовые металлоконструкции. Прямые поставки от производителей. Доставка по России.",
  keywords: ["металлопрокат", "арматура", "трубы", "металл", "Харланметалл", "конструкции", "оптом"],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Харланметалл",
    title: "Харланметалл — Металлопрокат и конструкции",
    description:
      "Металлопрокат, трубы, арматура и готовые металлоконструкции. Прямые поставки от производителей.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@harlanmetall",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground transition-colors duration-200">
        <ThemeProvider>
          <CartProvider>
            <Header />
            {children}
            <Footer />
            <AdminBar />
          </CartProvider>
        </ThemeProvider>
        <YandexMetrika />
        <Script
          src="https://metallportal-crm2.vercel.app/track.js?tid=a1000000-0000-0000-0000-000000000001"
          strategy="afterInteractive"
        />
        <CookieBanner />
        <Script id="ref-tracker" strategy="afterInteractive">{`
          (function(){
            var ref = new URLSearchParams(window.location.search).get('ref');
            if(ref) {
              document.cookie = 'ref_code=' + ref.toUpperCase() + '; max-age=' + 30*24*60*60 + '; path=/; SameSite=Lax';
              fetch('https://metallportal-crm2.vercel.app/api/ref/track?code=' + ref, { mode: 'no-cors' }).catch(function(){});
            }
          })();
        `}</Script>
      </body>
    </html>
  );
}
