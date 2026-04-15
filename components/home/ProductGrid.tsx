import HomeProductCard from "./HomeProductCard";

const products = [
  {
    name: "Арматура А500С ⌀12мм",
    category: "Арматура",
    basePrice: 52000,
    yourPrice: 48500,
    unit: "т",
    stock: "В НАЛИЧИИ",
    image:
      "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=400&q=80",
  },
  {
    name: "Труба профильная 40×40×2",
    category: "Трубы",
    basePrice: 68000,
    yourPrice: 62000,
    unit: "т",
    stock: "В НАЛИЧИИ",
    image:
      "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&q=80",
  },
  {
    name: "Лист г/к 3мм 1500×6000",
    category: "Листы",
    basePrice: 58000,
    yourPrice: 54000,
    unit: "т",
    stock: "В НАЛИЧИИ",
    image:
      "https://images.unsplash.com/photo-1564424224827-cd24c93f95fd?w=400&q=80",
  },
  {
    name: "Швеллер 10П ГОСТ",
    category: "Балки",
    basePrice: 64000,
    yourPrice: 59500,
    unit: "т",
    stock: "В НАЛИЧИИ",
    image:
      "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&q=80",
  },
  {
    name: "Уголок равнополочный 50×50×5",
    category: "Уголок",
    basePrice: 56000,
    yourPrice: 52000,
    unit: "т",
    stock: "В НАЛИЧИИ",
    image:
      "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=400&q=80",
  },
];

export default function ProductGrid() {
  return (
    <section className="bg-background py-8">
      <div className="container-main">
        <h2 className="text-2xl font-bold text-foreground mb-5">
          Популярные позиции сегодня
        </h2>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {products.map((product, index) => (
            <HomeProductCard key={index} {...product} />
          ))}
        </div>
      </div>
    </section>
  );
}
