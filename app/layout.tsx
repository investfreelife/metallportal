import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import AdminBar from "@/components/admin/AdminBar";
import { CartProvider } from "@/contexts/CartContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://metallportal.vercel.app"),
  title: {
    default: "МЕТАЛЛПОРТАЛ — Металлопрокат оптом и в розницу",
    template: "%s | МеталлПортал",
  },
  description:
    "B2B/B2C маркетплейс металлопроката, труб, арматуры и другой металлопродукции. Прямые поставки от производителей. Доставка по России.",
  keywords: ["металлопрокат", "арматура", "трубы", "металл", "маркетплейс", "B2B", "оптом"],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "МеталлПортал",
    title: "МЕТАЛЛПОРТАЛ — Металлопрокат оптом и в розницу",
    description:
      "B2B/B2C маркетплейс металлопроката, труб, арматуры и другой металлопродукции. Прямые поставки от производителей.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@metallportal",
  },
  robots: {
    index: true,
    follow: true,
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
        <Script
          src="https://metallportal-crm2.vercel.app/track.js?tid=a1000000-0000-0000-0000-000000000001"
          strategy="afterInteractive"
        />
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
