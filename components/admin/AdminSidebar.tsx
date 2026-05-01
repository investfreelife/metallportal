"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Home, Tag, Menu, Package, Settings, LogOut, Users, Image } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface CurrentSession {
  email: string;
  full_name: string | null;
  role: string | null;
}

const NAV_ADMIN = [
  { href: "/admin", icon: LayoutDashboard, label: "Дашборд" },
  { href: "/admin/homepage", icon: Home, label: "Главная" },
  { href: "/admin/categories", icon: Tag, label: "Категории" },
  { href: "/admin/photos", icon: Image, label: "Фото разделов" },
  { href: "/admin/menu", icon: Menu, label: "Меню" },
  { href: "/admin/products", icon: Package, label: "Товары" },
  { href: "/admin/users", icon: Users, label: "Пользователи" },
  { href: "/admin/settings", icon: Settings, label: "Настройки" },
];

const NAV_DESIGNER = [
  { href: "/admin/photos", icon: Image, label: "Фото разделов" },
  { href: "/admin/products", icon: Package, label: "Товары" },
];

export default function AdminSidebar() {
  const path = usePathname();
  const [session, setSession] = useState<CurrentSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const res = await fetch("/api/admin/check-role", { cache: "no-store" });
      const { role } = res.ok ? await res.json() : { role: null };
      if (cancelled) return;
      setSession({
        email: user.email ?? "",
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
        role,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  };

  const nav = session?.role === "designer" ? NAV_DESIGNER : NAV_ADMIN;
  const displayName = session?.full_name || session?.email || "";

  return (
    <aside className="w-56 bg-[#16213e] border-r border-white/10 flex flex-col min-h-screen">
      <div className="p-5 border-b border-white/10">
        <Link href="/" className="block">
          <div className="text-[#E8B86D] font-bold text-xl">Харланметалл</div>
          <div className="text-white/40 text-xs mt-0.5">Админ-панель</div>
        </Link>
        {session && (
          <div className="mt-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#E8B86D]/20 flex items-center justify-center text-[#E8B86D] text-xs font-bold">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-white text-xs font-medium truncate max-w-[140px]">{displayName}</div>
              <div className="text-white/30 text-xs">
                {session.role === "admin" ? "Администратор" : session.role === "designer" ? "Дизайнер" : "Менеджер"}
              </div>
            </div>
          </div>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => {
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
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 w-full transition-all"
        >
          <LogOut size={16} />
          Выйти
        </button>
      </div>
    </aside>
  );
}
