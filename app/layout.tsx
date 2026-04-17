import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import AdminBar from "@/components/admin/AdminBar";

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
          <Header />
          {children}
          <Footer />
          <AdminBar />
        </ThemeProvider>
      </body>
    </html>
  );
}
