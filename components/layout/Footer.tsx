import Link from "next/link";
import { fetchCategoriesTree, categoryHref } from "@/lib/categories";

// Сколько root-категорий показывает блок "Продукция" в Footer'е. Меньше
// чем в Header (5) — оставшиеся уезжают на /catalog. Если в БД < 5
// активных root'ов — покажем сколько есть, без падения.
const FOOTER_PRODUCTS_LIMIT = 5;

export default async function Footer() {
  const tree = await fetchCategoriesTree();
  const topCategories = tree.slice(0, FOOTER_PRODUCTS_LIMIT);

  return (
    <footer className="bg-card border-t border-gold/20">
      <div className="max-w-[1440px] mx-auto px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex flex-shrink-0">
                <div className="w-10 h-10 flex items-center justify-center bg-gold">
                  <span className="text-black font-black text-xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>Х</span>
                </div>
                <div className="w-10 h-10 flex items-center justify-center bg-foreground">
                  <span className="text-background font-black text-xl leading-none" style={{ fontFamily: 'Georgia, serif' }}>М</span>
                </div>
              </div>
              <div className="leading-tight">
                <p className="text-foreground font-bold text-xl tracking-wide leading-none">Харланметалл</p>
                <p className="text-gold font-semibold text-sm tracking-widest leading-none mt-0.5">МЕТАЛЛОПРОКАТ · КОНСТРУКЦИИ</p>
              </div>
            </div>
            <p className="text-foreground/60 text-sm leading-relaxed">
              Премиальный B2B портал металлопродукции, соединяющий проверенных
              поставщиков с серьёзными покупателями.
            </p>
          </div>

          {/* Products — data-driven из таблицы categories (W2-1) */}
          <div>
            <h4 className="text-foreground uppercase tracking-widest mb-4 text-sm">
              Продукция
            </h4>
            <ul className="space-y-2">
              {topCategories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={categoryHref(cat)}
                    className="text-sm text-foreground/60 hover:text-gold transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/catalog"
                  className="text-sm text-gold/80 hover:text-gold transition-colors"
                >
                  Весь каталог →
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-foreground uppercase tracking-widest mb-4 text-sm">
              Компания
            </h4>
            <ul className="space-y-2">
              <li><Link href="#" className="text-sm text-foreground/60 hover:text-gold transition-colors">О нас</Link></li>
              <li><Link href="#" className="text-sm text-foreground/60 hover:text-gold transition-colors">Наши поставщики</Link></li>
              <li><Link href="#" className="text-sm text-foreground/60 hover:text-gold transition-colors">Вакансии</Link></li>
              <li><Link href="#" className="text-sm text-foreground/60 hover:text-gold transition-colors">Контакты</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-foreground uppercase tracking-widest mb-4 text-sm">
              Правовая информация
            </h4>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-foreground/60 hover:text-gold transition-colors">Политика конфиденциальности</Link></li>
              <li><Link href="/oferta" className="text-sm text-foreground/60 hover:text-gold transition-colors">Публичная оферта</Link></li>
              <li><Link href="/privacy#7" className="text-sm text-foreground/60 hover:text-gold transition-colors">Политика cookies</Link></li>
              <li><Link href="/privacy" className="text-sm text-foreground/60 hover:text-gold transition-colors">152-ФЗ</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-gold/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-foreground/40 text-sm">
            © {new Date().getFullYear()} Харланметалл. Все права защищены.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-foreground/40 hover:text-gold transition-colors text-sm uppercase tracking-wider">VK</a>
            <a href="#" className="text-foreground/40 hover:text-gold transition-colors text-sm uppercase tracking-wider">Telegram</a>
            <a href="#" className="text-foreground/40 hover:text-gold transition-colors text-sm uppercase tracking-wider">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
