import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Package, Tag, Users, FileText, Home, Menu, Settings } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getStats() {
  const [products, categories, suppliers] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("id", { count: "exact", head: true }),
    supabase.from("suppliers").select("id", { count: "exact", head: true }),
  ]);
  return {
    products: products.count ?? 0,
    categories: categories.count ?? 0,
    suppliers: suppliers.count ?? 0,
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const STAT_CARDS = [
    { label: "Товаров", value: stats.products, icon: Package, color: "text-blue-400" },
    { label: "Категорий", value: stats.categories, icon: Tag, color: "text-green-400" },
    { label: "Поставщиков", value: stats.suppliers, icon: Users, color: "text-purple-400" },
    { label: "Запросов сегодня", value: 0, icon: FileText, color: "text-[#E8B86D]" },
  ];

  const QUICK_LINKS = [
    { href: "/admin/homepage", icon: Home, label: "Редактор главной", desc: "Hero, карточки, счётчики" },
    { href: "/admin/categories", icon: Tag, label: "Категории", desc: "Управление разделами" },
    { href: "/admin/menu", icon: Menu, label: "Меню", desc: "Навигация сайта" },
    { href: "/admin/products", icon: Package, label: "Товары", desc: "Список и редактирование" },
    { href: "/admin/settings", icon: Settings, label: "Настройки", desc: "Сайт, SEO, контакты" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Дашборд</h1>
      <p className="text-white/40 text-sm mb-8">Добро пожаловать в панель управления МеталлПортал</p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#16213e] rounded-xl p-5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/50 text-sm">{label}</span>
              <Icon size={18} className={color} />
            </div>
            <div className="text-3xl font-bold text-white">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <h2 className="text-lg font-semibold text-white mb-4">Быстрый доступ</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}
            className="bg-[#16213e] rounded-xl p-5 border border-white/10 hover:border-[#E8B86D]/40 hover:bg-[#16213e]/80 transition-all group">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#E8B86D]/10 group-hover:bg-[#E8B86D]/20 transition-all">
                <Icon size={18} className="text-[#E8B86D]" />
              </div>
              <span className="font-semibold text-white">{label}</span>
            </div>
            <p className="text-white/40 text-sm">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
