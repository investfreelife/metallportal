import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getMainCategories } from "@/lib/queries";

export const revalidate = 60;

export default async function CatalogPage() {
  const categories = await getMainCategories();

  return (
    <div className="bg-background min-h-screen">
      <div className="container-main py-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Каталог продукции
        </h1>
        <p className="text-muted-foreground mb-8">
          Выберите категорию для просмотра ассортимента
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category: any) => (
            <Link
              key={category.id}
              href={`/catalog/${category.slug}`}
              className="group relative h-64 rounded overflow-hidden shadow-md hover:shadow-xl transition-all"
            >
              {category.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="absolute inset-0 bg-card" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

              <div className="relative h-full p-6 flex flex-col justify-end text-white">
                <div className="text-4xl mb-3">{category.icon}</div>
                <h2 className="text-2xl font-bold mb-1">{category.name}</h2>
                <p className="text-white/70 text-sm mb-3 line-clamp-2">
                  {category.description}
                </p>
                <div className="flex items-center gap-2 text-gold group-hover:gap-3 transition-all text-sm font-medium">
                  <span>Перейти в раздел</span>
                  <ArrowRight size={16} />
                </div>
              </div>

              <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/5 transition-all pointer-events-none" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
