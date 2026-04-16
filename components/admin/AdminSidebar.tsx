"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Home, Tag, Menu, Package, Settings, LogOut } from "lucide-react";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, label: "Дашборд" },
  { href: "/admin/homepage", icon: Home, label: "Главная" },
  { href: "/admin/categories", icon: Tag, label: "Категории" },
  { href: "/admin/menu", icon: Menu, label: "Меню" },
  { href: "/admin/products", icon: Package, label: "Товары" },
  { href: "/admin/settings", icon: Settings, label: "Настройки" },
];

export default function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 bg-[#16213e] border-r border-white/10 flex flex-col min-h-screen">
      <div className="p-5 border-b border-white/10">
        <Link href="/" className="block">
          <div className="text-[#E8B86D] font-bold text-xl">МеталлПортал</div>
          <div className="text-white/40 text-xs mt-0.5">Админ-панель</div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href || (href !== "/admin" && path.startsWith(href));
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? "bg-[#E8B86D]/20 text-[#E8B86D]" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button
          onClick={() => { sessionStorage.removeItem("admin_authed"); window.location.href = "/admin"; }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 w-full transition-all"
        >
          <LogOut size={16} />
          Выйти
        </button>
      </div>
    </aside>
  );
}
