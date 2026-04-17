"use client";

import Link from "next/link";
import { Search, Mic, ChevronDown, FileUp, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_ITEMS = [
  {
    label: "Металлопрокат",
    icon: "🔩",
    href: "/catalog",
    children: [
      { label: "Трубы и профиль", href: "/catalog/truby-i-profil", children: [
        { label: "Трубы ВГП", href: "/catalog/truba-vgp" },
        { label: "Трубы профильные", href: "/catalog/truba-profilnaya" },
        { label: "Трубы электросварные", href: "/catalog/truba-svarnaya" },
        { label: "Трубы бесшовные", href: "/catalog/truba-besshovnaya" },
      ]},
      { label: "Арматура и сетка", href: "/catalog/armatura-i-setka", children: [
        { label: "Арматура стальная", href: "/catalog/armatura-stalnaya" },
        { label: "Сетка сварная", href: "/catalog/setka-svarnaya" },
        { label: "Сетка кладочная", href: "/catalog/setka-kladochnaya" },
      ]},
      { label: "Балки и швеллеры", href: "/catalog/balki-i-shvellery", children: [
        { label: "Двутавровые балки", href: "/catalog/balka-dvutavr" },
        { label: "Швеллер", href: "/catalog/shveller" },
      ]},
      { label: "Листы и плиты", href: "/catalog/listy-i-plity", children: [
        { label: "Лист горячекатаный", href: "/catalog/list-goryachekatany" },
        { label: "Лист холоднокатаный", href: "/catalog/list-holodnokatany" },
        { label: "Лист оцинкованный", href: "/catalog/list-otsinkovanny" },
        { label: "Лист рифлёный", href: "/catalog/list-riflyony" },
      ]},
      { label: "Уголки и полосы", href: "/catalog/ugolki-i-polosy", children: [
        { label: "Уголок равнополочный", href: "/catalog/ugolok-ravnopolochny" },
        { label: "Уголок неравнополочный", href: "/catalog/ugolok-neravnopolochny" },
        { label: "Полоса стальная", href: "/catalog/polosa-stalnaya" },
      ]},
    ],
  },
  {
    label: "Готовые конструкции",
    icon: "🏗️",
    href: "/catalog/konstruktsii",
    children: [
      { label: "Ангары", href: "/catalog/konstruktsii/angary" },
      { label: "Навесы и козырьки", href: "/catalog/konstruktsii/navesy" },
      { label: "Склады и цеха", href: "/catalog/konstruktsii/sklady" },
      { label: "Каркасы зданий", href: "/catalog/konstruktsii/karkasy" },
    ],
  },
] as const;

type NavItem = typeof NAV_ITEMS[number];

function NavDropdown({
  item,
  mega,
  open,
  onOpen,
  onClose,
}: {
  item: NavItem;
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

  return (
    <div ref={ref} className="relative">
      <div
        onMouseEnter={onOpen}
        onMouseLeave={() => {}}
        className="flex items-center text-sm py-2 whitespace-nowrap"
      >
        <Link
          href={item.href}
          onClick={onClose}
          className="flex items-center gap-1.5 hover:text-gold transition-colors pr-1"
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
        <button
          onClick={() => open ? onClose() : onOpen()}
          className="hover:text-gold transition-colors px-1"
        >
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div
          onMouseLeave={onClose}
          className={`absolute top-full left-0 z-50 bg-background border border-border rounded-lg shadow-2xl p-5 ${
            mega ? "min-w-[520px]" : "min-w-[260px]"
          }`}
        >
          <Link
            href={item.href}
            onClick={onClose}
            className="block text-sm font-semibold text-foreground hover:text-gold mb-3 pb-2 border-b border-border transition-colors"
          >
            Все — {item.label} →
          </Link>
          <div className={mega ? "grid grid-cols-2 gap-x-6 gap-y-3" : "space-y-3"}>
            {item.children.map((child: any) => (
              <div key={child.href}>
                <Link
                  href={child.href}
                  onClick={onClose}
                  className="block text-sm font-medium text-foreground hover:text-gold transition-colors mb-1"
                >
                  {child.label}
                </Link>
                {child.children && (
                  <div className="ml-3 space-y-1">
                    {child.children.map((sub: any) => (
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

export default function Header() {
  const [mode, setMode] = useState<"b2c" | "b2b">("b2c");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openNav, setOpenNav] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top bar */}
      <div className="text-sm" style={{ backgroundColor: "var(--topbar-bg)", color: "var(--topbar-text)" }}>
        <div className="container-main h-9 flex items-center justify-between">
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white/10 rounded p-0.5">
              {(["b2c", "b2b"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded transition-all text-xs ${mode === m ? "bg-gold text-black font-medium" : "text-white/80 hover:text-white"}`}
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
            <Link href="/dashboard" className="text-xs hover:text-gold transition-colors">Войти</Link>
            <Link href="/supplier" className="text-xs text-gold hover:text-yellow-300 transition-colors">Стать поставщиком</Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="bg-background border-b border-border">
        <div className="container-main h-16 lg:h-20 flex items-center gap-4 lg:gap-8">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gold rounded" />
            <span className="text-lg lg:text-2xl font-bold text-foreground">МЕТАЛЛПОРТАЛ</span>
          </Link>

          <div className="flex-1 max-w-3xl hidden sm:block">
            <div className="relative flex items-center bg-card border-2 border-gold rounded h-11 lg:h-12">
              <Search className="absolute left-3 text-muted-foreground" size={18} />
              <input
                type="text"
                placeholder="Найдите металл: арматура 12мм, труба 40х40, лист 3мм..."
                className="w-full h-full bg-transparent pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button className="absolute right-1 w-9 h-9 flex items-center justify-center bg-gold hover:bg-yellow-400 rounded transition-colors">
                <Mic className="text-black" size={16} />
              </button>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <ThemeToggle />
            <button className="flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 px-4 h-11 font-semibold rounded transition-all text-sm">
              <FileUp size={16} />
              <span>Загрузить смету</span>
            </button>
            <button className="bg-gold hover:bg-yellow-400 text-black px-6 h-11 font-semibold rounded transition-all text-sm">
              Получить цену
            </button>
          </div>

          <button className="ml-auto lg:hidden p-2" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Desktop nav */}
      <div style={{ backgroundColor: "var(--nav-bg)", color: "var(--nav-text)" }}>
        <div className="container-main hidden lg:flex items-center gap-4 xl:gap-6 h-11">
          {NAV_ITEMS.map((item, i) => (
            <NavDropdown
              key={item.href}
              item={item}
              mega={i === 0}
              open={openNav === item.href}
              onOpen={() => setOpenNav(item.href)}
              onClose={() => setOpenNav(null)}
            />
          ))}
          <Link href="/catalog" className="ml-auto text-xs hover:text-gold transition-colors opacity-60">
            Весь каталог →
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-background border-b border-border shadow-xl">
          <div className="container-main py-4 space-y-1 max-h-[70vh] overflow-y-auto">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Поиск..."
                className="w-full bg-card border border-border rounded h-10 pl-9 pr-3 text-sm outline-none focus:border-gold" />
            </div>
            {NAV_ITEMS.map((item) => (
              <div key={item.href} className="pb-2">
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2 text-sm font-semibold hover:text-gold transition-colors"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
                <div className="ml-6 grid grid-cols-2 gap-1">
                  {item.children.map((child: any) => (
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
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
