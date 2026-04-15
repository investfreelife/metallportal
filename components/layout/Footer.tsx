import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-card border-t border-gold/20">
      <div className="max-w-[1440px] mx-auto px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gold flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-background" />
              </div>
              <span className="text-[24px] font-bold text-foreground tracking-wide">
                МЕТАЛЛПОРТАЛ
              </span>
            </div>
            <p className="text-foreground/60 text-sm leading-relaxed">
              Премиальный B2B портал металлопродукции, соединяющий проверенных
              поставщиков с серьёзными покупателями.
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-foreground uppercase tracking-widest mb-4 text-sm">
              Продукция
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/catalog/armatura" className="text-sm text-foreground/60 hover:text-gold transition-colors">Арматура</Link>
              </li>
              <li>
                <Link href="/catalog/truby" className="text-sm text-foreground/60 hover:text-gold transition-colors">Трубы</Link>
              </li>
              <li>
                <Link href="/catalog/listovoy-prokat" className="text-sm text-foreground/60 hover:text-gold transition-colors">Листовой металл</Link>
              </li>
              <li>
                <Link href="/catalog/balki-shvellery" className="text-sm text-foreground/60 hover:text-gold transition-colors">Балки и швеллера</Link>
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
              <li><Link href="#" className="text-sm text-foreground/60 hover:text-gold transition-colors">Политика конфиденциальности</Link></li>
              <li><Link href="#" className="text-sm text-foreground/60 hover:text-gold transition-colors">Условия использования</Link></li>
              <li><Link href="#" className="text-sm text-foreground/60 hover:text-gold transition-colors">Политика cookies</Link></li>
              <li><Link href="#" className="text-sm text-foreground/60 hover:text-gold transition-colors">Соответствие</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-gold/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-foreground/40 text-sm">
            © {new Date().getFullYear()} МеталлПортал. Все права защищены.
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
