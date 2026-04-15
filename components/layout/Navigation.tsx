import Link from "next/link";

const navItems = [
  { label: "Каталог", href: "/catalog" },
  { label: "Поставщикам", href: "/supplier" },
];

export default function Navigation() {
  return (
    <nav className="hidden md:flex items-center gap-6">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-sm text-gray-400 hover:text-foreground transition-colors"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
