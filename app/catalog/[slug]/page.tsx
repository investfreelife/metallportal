import ProductCard from "@/components/catalog/ProductCard";

interface CategoryPageProps {
  params: { slug: string };
}

const categoryNames: Record<string, string> = {
  armatura: "Арматура",
  "listovoy-prokat": "Листовой прокат",
  truby: "Трубы",
  "balki-shvellery": "Балки и швеллеры",
  nerzhaveyka: "Нержавеющая сталь",
  "cvetnye-metally": "Цветные металлы",
};

const mockProducts = [
  {
    id: "1",
    name: "Арматура А500С ø12 мм",
    price: 42500,
    unit: "т",
    supplier: "МеталлГрупп",
    inStock: true,
  },
  {
    id: "2",
    name: "Арматура А500С ø16 мм",
    price: 41800,
    unit: "т",
    supplier: "СтальИнвест",
    inStock: true,
  },
  {
    id: "3",
    name: "Арматура А240 ø8 мм",
    price: 44200,
    unit: "т",
    supplier: "ПромМеталл",
    inStock: false,
  },
  {
    id: "4",
    name: "Арматура А500С ø20 мм",
    price: 40900,
    unit: "т",
    supplier: "МеталлГрупп",
    inStock: true,
  },
];

export function generateMetadata({ params }: CategoryPageProps) {
  const name = categoryNames[params.slug] ?? params.slug;
  return {
    title: `${name} — Каталог | МЕТАЛЛПОРТАЛ`,
    description: `Купить ${name.toLowerCase()} оптом и в розницу. Лучшие цены на МЕТАЛЛПОРТАЛ.`,
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const name = categoryNames[params.slug] ?? params.slug;

  return (
    <section className="py-12">
      <div className="container-main">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{name}</h1>
        <p className="text-gray-400 mb-10">
          {mockProducts.length} позиций от проверенных поставщиков
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mockProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
