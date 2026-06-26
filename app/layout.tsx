import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";

/**
 * TASK_053 (audit 2026-06-18 SEV-2): Inter через next/font/google вместо
 * CSS @import. Раньше в globals.css был `@import url(...fonts.googleapis...)`,
 * который render-blocking + 2 RTT (CSS → font request → font download).
 * next/font:
 *   - self-host fonts (без блокировок на fonts.googleapis.com)
 *   - preload + display=swap по дефолту
 *   - убирает CLS от font-fallback
 * Передаём CSS var `--font-inter` — Tailwind подцепит через fontFamily.sans
 * (см. tailwind.config.ts: ["var(--font-inter)", "Inter", "sans-serif"]).
 */
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import AdminBar from "@/components/admin/AdminBar";
import CookieBanner from "@/components/CookieBanner";
import { CartProvider } from "@/contexts/CartContext";
import { SITE_URL } from "@/lib/site";
import YandexMetrika from "@/components/analytics/YandexMetrika";
import SiteSchemas from "@/components/seo/SiteSchemas";

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
    <html lang="ru" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background text-foreground transition-colors duration-200 font-sans">
        {/* TASK_054 (audit SEV-3): skip-link для клавиатурной навигации.
            Видим только при :focus (Tab из URL-бара) — пользователи мыши
            ничего не видят, screen-reader/keyboard юзеры могут пропустить
            длинный header. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-gold focus:text-black focus:font-bold focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-2xl"
        >
          Перейти к содержимому
        </a>
        <SiteSchemas />
        <ThemeProvider>
          <CartProvider>
            <Header />
            <div id="main">{children}</div>
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
