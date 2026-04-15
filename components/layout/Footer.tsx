import Link from "next/link";

const footerLinks = {
  Каталог: [
    { label: "Арматура", href: "/catalog/armatura" },
    { label: "Трубы", href: "/catalog/truby" },
    { label: "Листовой прокат", href: "/catalog/listovoy-prokat" },
    { label: "Нержавеющая сталь", href: "/catalog/nerzhaveyka" },
  ],
  Компания: [
    { label: "О нас", href: "#" },
    { label: "Контакты", href: "#" },
    { label: "Вакансии", href: "#" },
    { label: "Партнёрам", href: "#" },
  ],
  Поддержка: [
    { label: "Помощь", href: "#" },
    { label: "Условия", href: "#" },
    { label: "Политика конфиденциальности", href: "#" },
    { label: "Возврат", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-surface-border bg-surface py-12">
      <div className="container-main">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-gold">МЕТАЛЛ</span>ПОРТАЛ
            </span>
            <p className="mt-3 text-sm text-gray-400">
              Крупнейший маркетплейс металлопродукции в России
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-gold mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-surface-border text-center text-sm text-gray-500">
          © {new Date().getFullYear()} МЕТАЛЛПОРТАЛ. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
