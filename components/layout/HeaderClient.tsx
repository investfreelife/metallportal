"use client";

import Link from "next/link";
import { Search, ChevronDown, FileUp, Menu, X, ShoppingCart } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { useCart } from "@/contexts/CartContext";
import SearchBar from "@/components/layout/SearchBar";

/**
 * Public-facing nav-item shape, отдаваемый сервером.
 *
 * Дерево произвольной глубины (children рекурсивно). UI отрисовывает
 * top-level + 1 уровень детей (mega/non-mega dropdown). Внуки выводятся
 * под детьми списком (если есть).
 */
export type ClientNavItem = {
  label: string;
  href: string;
  icon?: string;
  highlight?: boolean;
  children?: ClientNavItem[];
};

type HeaderClientProps = {
  navItems: ClientNavItem[];
};

function NavDropdown({
  item,
  mega,
  open,
  onOpen,
  onClose,
}: {
  item: ClientNavItem;
  mega?: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const hasChildren = item.children && item.children.length > 0;

  return (
    <div ref={ref} className="relative" onMouseLeave={onClose}>
      <div
        onMouseEnter={onOpen}
        className="flex items-center text-sm py-2 whitespace-nowrap"
      >
        <Link
          href={item.href}
          onClick={onClose}
          className="flex items-center gap-1.5 transition-colors pr-1 hover:text-gold"
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
        </Link>
        {hasChildren && (
          <button
            onClick={() => (open ? onClose() : onOpen())}
            className="hover:text-gold transition-colors px-1"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {open && hasChildren && (
        <div
          className={`absolute top-full left-0 z-50 bg-background border border-border rounded-lg shadow-2xl p-5 ${
            mega ? "min-w-[520px]" : "min-w-[260px]"
          }`}
        >
          <div className={mega ? "grid grid-cols-2 gap-x-6 gap-y-3" : "space-y-3"}>
            {item.children!.map((child) => (
              <div key={child.href}>
                <Link
                  href={child.href}
                  onClick={onClose}
                  className="block text-sm font-medium text-foreground hover:text-gold transition-colors mb-1"
                >
                  {child.label}
                </Link>
                {child.children && child.children.length > 0 && (
                  <div className="ml-3 space-y-1">
                    {child.children.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onClose}
                        className="block text-xs text-muted-foreground hover:text-gold transition-colors py-0.5"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HeaderClient({ navItems }: HeaderClientProps) {
  const [mode, setMode] = useState<"b2c" | "b2b">("b2c");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openNav, setOpenNav] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top bar */}
      <div
        className="text-sm"
        style={{ backgroundColor: "var(--topbar-bg)", color: "var(--topbar-text)" }}
      >
        <div className="container-main h-9 flex items-center justify-between">
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white/10 rounded p-0.5">
              {(["b2c", "b2b"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded transition-all text-xs ${
                    mode === m
                      ? "bg-gold text-black font-medium"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  {m === "b2c" ? "Для себя" : "Для бизнеса"}
                </button>
              ))}
            </div>
            <span className="text-white/40">|</span>
            <span className="text-xs">1500+ позиций</span>
            <span className="text-white/40">|</span>
            <span className="text-xs">50+ поставщиков</span>
            <span className="text-white/40">|</span>
            <span className="text-xs">Доставка по России</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/cart"
              className="relative flex items-center gap-1.5 text-xs hover:text-gold transition-colors group"
            >
              <ShoppingCart size={14} className="group-hover:text-gold" />
              <CartCount />
              <span>Корзина</span>
            </Link>
            <Link
              href="/account"
              className="text-xs hover:text-gold transition-colors"
            >
              👤 Кабинет
            </Link>
            <Link
              href="/supplier"
              className="text-xs text-gold hover:text-yellow-300 transition-colors"
            >
              Стать поставщиком
            </Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="bg-background border-b border-border">
        <div className="container-main h-16 lg:h-20 flex items-center gap-4 lg:gap-8">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex flex-shrink-0">
              <div className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center bg-gold">
                <span
                  className="text-black font-black text-lg lg:text-xl leading-none"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  Х
                </span>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center bg-foreground">
                <span
                  className="text-background font-black text-lg lg:text-xl leading-none"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  М
                </span>
              </div>
            </div>
            <div className="leading-tight">
              <p className="text-foreground font-bold text-sm lg:text-base tracking-wide leading-none">
                Харланметалл
              </p>
              <p className="text-gold font-semibold text-[10px] lg:text-xs tracking-widest leading-none mt-0.5">
                МЕТАЛЛОПРОКАТ · КОНСТРУКЦИИ
              </p>
            </div>
          </Link>

          <SearchBar />

          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <Link
              href="/cart"
              className="relative p-2 hover:text-gold transition-colors"
            >
              <ShoppingCart size={20} />
              <CartCount />
            </Link>
            <ThemeToggle />
            <button className="flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 px-4 h-11 font-semibold rounded transition-all text-sm">
              <FileUp size={16} />
              <span>Загрузить смету</span>
            </button>
            <button className="bg-gold hover:bg-yellow-400 text-black px-6 h-11 font-semibold rounded transition-all text-sm">
              Получить цену
            </button>
          </div>

          <div className="ml-auto lg:hidden flex items-center gap-1">
            <button
              className="p-2 hover:text-gold transition-colors"
              onClick={() => {
                setMobileSearchOpen(true);
                setMobileOpen(false);
              }}
            >
              <Search size={20} />
            </button>
            <ThemeToggle />
            <button className="p-2" onClick={() => setMobileOpen((o) => !o)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop nav */}
      <div
        style={{ backgroundColor: "var(--topbar-bg)", color: "var(--topbar-text)" }}
      >
        <div className="container-main hidden lg:flex items-center gap-4 xl:gap-6 h-11">
          {navItems.map((item, i) => (
            <NavDropdown
              key={item.href}
              item={item}
              mega={i === 0}
              open={openNav === item.href}
              onOpen={() => setOpenNav(item.href)}
              onClose={() => setOpenNav(null)}
            />
          ))}
          <Link
            href="/tools"
            className="flex items-center gap-1.5 text-xs font-bold text-black bg-gold hover:bg-yellow-400 px-3 py-1.5 rounded-full transition-all"
          >
            🧮 Калькуляторы
          </Link>

          {/* AI Search button with tooltip */}
          <div className="relative group">
            <Link
              href="/ai-search"
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 px-4 py-1.5 rounded-full transition-all shadow-lg shadow-blue-600/40 ring-1 ring-white/20"
            >
              <span className="text-[13px] leading-none">✦</span>
              Поиск с ИИ
            </Link>
            <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-background border border-border rounded-2xl shadow-2xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-background border-l border-t border-border rotate-45" />
              <p className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <span className="text-blue-500">✦</span> Умный поиск с ИИ
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Опишите нужный металлопрокат своими словами — ИИ подберёт из
                12&nbsp;000+ позиций и сформирует заявку с ценами за секунды
              </p>
              <p className="text-xs font-semibold text-blue-500 mt-2">
                Нажмите чтобы открыть →
              </p>
            </div>
          </div>

          <Link
            href="/catalog"
            className="ml-auto text-xs hover:text-gold transition-colors opacity-60"
          >
            Весь каталог →
          </Link>
        </div>
      </div>

      {/* Mobile search bar */}
      {mobileSearchOpen && (
        <div className="lg:hidden bg-background border-b border-border px-3 py-2">
          <SearchBar
            className="relative w-full"
            autoFocus
            onClose={() => setMobileSearchOpen(false)}
          />
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-background border-b border-border shadow-xl">
          <div className="container-main py-4 space-y-1 max-h-[70vh] overflow-y-auto">
            <Link
              href="/ai-search"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 py-3 px-3 bg-gradient-to-r from-blue-500/15 to-violet-500/15 border border-blue-400/30 rounded-xl text-sm font-bold text-blue-400 mb-2"
            >
              ✦ Поиск с ИИ — подбор из 12 000+ позиций
            </Link>
            <Link
              href="/tools"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 py-3 px-3 bg-gold/10 border border-gold/30 rounded-xl text-sm font-bold text-gold mb-2"
            >
              🧮 Калькуляторы металлопроката
            </Link>
            {navItems.map((item) => (
              <div key={item.href} className="pb-2">
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2 text-sm font-semibold hover:text-gold transition-colors"
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
                {item.children && item.children.length > 0 && (
                  <div className="ml-6 grid grid-cols-2 gap-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className="text-xs text-muted-foreground hover:text-gold py-1 transition-colors"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function CartCount() {
  const { count } = useCart();
  if (count === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gold text-black text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none pointer-events-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}
