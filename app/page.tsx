import Link from "next/link";

const categories = [
  { name: "Арматура", slug: "armatura", icon: "🔩" },
  { name: "Листовой прокат", slug: "listovoy-prokat", icon: "📄" },
  { name: "Трубы", slug: "truby", icon: "🔧" },
  { name: "Балки и швеллеры", slug: "balki-shvellery", icon: "🏗️" },
  { name: "Нержавеющая сталь", slug: "nerzhaveyka", icon: "✨" },
  { name: "Цветные металлы", slug: "cvetnye-metally", icon: "🥇" },
];

const stats = [
  { value: "1 200+", label: "Поставщиков" },
  { value: "50 000+", label: "Наименований" },
  { value: "87", label: "Регионов доставки" },
  { value: "24/7", label: "Поддержка" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 lg:py-32">
        <div className="container-main text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
            <span className="text-gold">МЕТАЛЛ</span>ПОРТАЛ
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Крупнейший B2B/B2C маркетплейс металлопродукции в России. Прямые
            поставки от производителей по лучшим ценам.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/catalog" className="btn-gold text-center">
              Перейти в каталог
            </Link>
            <Link href="/supplier" className="btn-outline text-center">
              Стать поставщиком
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-surface-border">
        <div className="container-main grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-gold">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="container-main">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Категории продукции
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/catalog/${cat.slug}`}
                className="card-surface flex items-center gap-4 hover:border-gold transition-colors duration-200"
              >
                <span className="text-3xl">{cat.icon}</span>
                <span className="text-lg font-semibold">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-surface">
        <div className="container-main text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Начните торговать на{" "}
            <span className="text-gold">МЕТАЛЛПОРТАЛ</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-8">
            Зарегистрируйтесь как поставщик и получите доступ к тысячам
            покупателей по всей России.
          </p>
          <Link href="/supplier" className="btn-gold">
            Зарегистрироваться
          </Link>
        </div>
      </section>
    </>
  );
}
