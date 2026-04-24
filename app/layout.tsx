import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import AdminBar from "@/components/admin/AdminBar";
import { CartProvider } from "@/contexts/CartContext";

export const metadata: Metadata = {
  title: "МЕТАЛЛПОРТАЛ — Маркетплейс металлопродукции",
  description:
    "B2B/B2C маркетплейс металлопроката, труб, арматуры и другой металлопродукции. Прямые поставки от производителей.",
  keywords: ["металлопрокат", "арматура", "трубы", "металл", "маркетплейс", "B2B", "оптом"],
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
      </body>
    </html>
  );
}
