import { ArrowRight } from "lucide-react";

const categories = [
  {
    title: "Трубы и профиль",
    image: "https://loremflickr.com/600/400/steel,pipe,tube,industrial",
  },
  {
    title: "Арматура и сетка",
    image: "https://loremflickr.com/600/400/rebar,steel,mesh,construction",
  },
  {
    title: "Ворота и калитки",
    image: "https://loremflickr.com/600/400/gate,fence,metal,steel",
  },
  {
    title: "Навесы и козырьки",
    image: "https://loremflickr.com/600/400/canopy,metal,awning,roof",
  },
];

export default function CategoryRow() {
  return (
    <section className="bg-background py-5">
      <div className="container-main">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category, index) => (
            <div
              key={index}
              className="relative h-48 rounded overflow-hidden group cursor-pointer shadow-md hover:shadow-lg transition-all"
            >
              {/* Background image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.image}
                alt={category.title}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

              {/* Content */}
              <div className="relative h-full p-6 flex flex-col justify-end text-white">
                <h3 className="text-xl font-bold mb-2">{category.title}</h3>
                <div className="flex items-center gap-2 text-gold text-sm group-hover:gap-3 transition-all">
                  <span>Смотреть</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Hover effect */}
              <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/10 transition-all pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
