/**
 * TASK_054 (audit 2026-06-18 SEV-2): кастомная 404 страница.
 * Без файла Next отдаёт дефолтный белый экран — теряем брендинг и SEO
 * (нет ссылки на каталог → bounce).
 */

import Link from "next/link";
import { Search, ArrowLeft, Phone } from "lucide-react";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/contact";

export const metadata = {
  title: "Страница не найдена — Харланметалл",
  description:
    "Запрошенная страница не найдена. Перейдите в каталог металлопроката или свяжитесь с менеджером.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-lg text-center space-y-5">
        <div className="text-7xl font-black text-gold/30 select-none">404</div>
        <h1 className="text-2xl font-bold text-foreground">Страница не найдена</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Возможно, ссылка устарела или вы попали сюда по&nbsp;опечатке.
          Воспользуйтесь поиском или загляните в&nbsp;каталог — у&nbsp;нас
          12&nbsp;000+&nbsp;позиций металлопроката.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-semibold px-5 py-2.5 rounded-lg transition-all"
          >
            <Search size={16} /> В каталог
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-border hover:border-gold text-foreground px-5 py-2.5 rounded-lg transition-all"
          >
            <ArrowLeft size={16} /> На главную
          </Link>
          <a
            href={`tel:${CONTACT_PHONE_TEL}`}
            className="inline-flex items-center gap-2 border border-border hover:border-gold text-foreground px-5 py-2.5 rounded-lg transition-all"
          >
            <Phone size={16} /> {CONTACT_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    </div>
  );
}
