"use client";

import Link from "next/link";
import { Search, Mic, ChevronDown, FileUp } from "lucide-react";
import { useState } from "react";

export default function Header() {
  const [mode, setMode] = useState<"b2c" | "b2b">("b2c");

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Row 1 — Top Bar */}
      <div
        className="text-sm"
        style={{ backgroundColor: "var(--topbar-bg)", color: "var(--topbar-text)" }}
      >
        <div className="container-main h-9 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* B2C / B2B switcher */}
            <div className="flex items-center gap-1 bg-white/10 rounded p-0.5">
              <button
                onClick={() => setMode("b2c")}
                className={`px-3 py-1 rounded transition-all text-sm ${
                  mode === "b2c"
                    ? "bg-gold text-foreground font-medium"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Для себя
              </button>
              <button
                onClick={() => setMode("b2b")}
                className={`px-3 py-1 rounded transition-all text-sm ${
                  mode === "b2b"
                    ? "bg-gold text-foreground font-medium"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Для бизнеса
              </button>
            </div>
            <span className="text-white/40">|</span>
            <span>1500+ позиций</span>
            <span className="text-white/40">|</span>
            <span>50+ поставщиков</span>
            <span className="text-white/40">|</span>
            <span>Доставка по всей России</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hover:text-gold transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/supplier"
              className="text-gold hover:text-gold-dark transition-colors"
            >
              Стать поставщиком
            </Link>
          </div>
        </div>
      </div>

      {/* Row 2 — Main Header with Search */}
      <div className="bg-background border-b border-border">
        <div className="container-main h-20 flex items-center justify-between gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 bg-gold" />
            <span className="text-2xl font-bold text-foreground">
              МЕТАЛЛПОРТАЛ
            </span>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-3xl">
            <div className="relative flex items-center bg-card border-2 border-gold rounded h-12 hover:shadow-lg transition-shadow">
              <Search
                className="absolute left-4 text-muted-foreground"
                size={20}
              />
              <input
                type="text"
                placeholder="Найдите металл: арматура 12мм, труба 40х40, лист 3мм..."
                className="w-full h-full bg-transparent pl-12 pr-14 text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button className="absolute right-2 w-9 h-9 flex items-center justify-center bg-gold hover:bg-gold-dark rounded transition-colors">
                <Mic
                  className="text-primary-foreground"
                  size={18}
                />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button className="flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 px-6 h-12 font-semibold rounded transition-all">
              <FileUp size={18} />
              <span>Загрузить смету / КП</span>
            </button>
            <button className="bg-gold hover:bg-gold-dark text-foreground px-8 h-12 font-semibold rounded transition-all">
              Получить цену
            </button>
          </div>
        </div>
      </div>

      {/* Row 3 — Navigation */}
      <div
        style={{ backgroundColor: "var(--nav-bg)", color: "var(--nav-text)" }}
      >
        <div className="container-main h-11 flex items-center gap-8">
          <button className="flex items-center gap-2 hover:text-gold transition-colors text-sm">
            <span>🔩</span>
            <span>Металлопрокат</span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center gap-2 hover:text-gold transition-colors text-sm">
            <span>🏗️</span>
            <span>Готовые конструкции</span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center gap-2 hover:text-gold transition-colors text-sm">
            <span>🚧</span>
            <span>Заборы и ограждения</span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center gap-2 hover:text-gold transition-colors text-sm">
            <span>🧱</span>
            <span>Быстровозводимые здания</span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center gap-2 hover:text-gold transition-colors text-sm">
            <span>📦</span>
            <span>Изделия на заказ</span>
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
