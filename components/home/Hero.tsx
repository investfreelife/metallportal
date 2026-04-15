import { ArrowRight } from "lucide-react";

const categories = [
  {
    title: "Металлопрокат",
    subtitle: "Трубы · Арматура · Лист · Балки · Уголок",
    link: "1200+ позиций →",
    image:
      "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=800&q=80",
  },
  {
    title: "Готовые конструкции",
    subtitle: "Ангары · Склады · Навесы · Каркасы зданий",
    link: "Подобрать конструкцию →",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80",
  },
  {
    title: "Заборы и ограждения",
    subtitle: "Профнастил · Сетка · Ворота · Калитки · Рабица",
    link: "Смотреть каталог →",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  },
  {
    title: "Быстровозводимые здания",
    subtitle: "Модульные здания · Склады · Ангары · Павильоны",
    link: "Рассчитать стоимость →",
    image:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80",
  },
];

export default function Hero() {
  return (
    <section className="bg-background py-5">
      <div className="container-main">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {categories.map((category, index) => (
            <div
              key={index}
              className="relative h-80 rounded overflow-hidden group cursor-pointer shadow-md hover:shadow-xl transition-all"
            >
              {/* Background image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.image}
                alt={category.title}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

              {/* Content */}
              <div className="relative h-full p-8 flex flex-col justify-end text-white">
                <h2 className="text-3xl font-bold mb-2">{category.title}</h2>
                <p className="text-white/90 mb-4 text-base leading-relaxed">
                  {category.subtitle}
                </p>
                <div className="flex items-center gap-2 text-gold group-hover:gap-3 transition-all">
                  <span className="text-sm font-medium">{category.link}</span>
                  <ArrowRight size={16} />
                </div>
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/10 transition-all pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
