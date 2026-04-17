import Image from "next/image";
import { ArrowRight } from "lucide-react";

const categories = [
  {
    title: "Металлопрокат",
    image: "/images/home/metalloprokat.png",
  },
  {
    title: "Готовые конструкции",
    image: "/images/home/konstrukcii.png",
  },
];

export default function CategoryRow() {
  return (
    <section className="bg-background py-5">
      <div className="container-main">
        <div className="grid grid-cols-2 gap-4">
          {categories.map((category, index) => (
            <div
              key={index}
              className="relative h-48 rounded overflow-hidden group cursor-pointer shadow-md hover:shadow-lg transition-all"
            >
              {/* Background image */}
              <Image
                src={category.image}
                alt={category.title}
                fill
                className="object-cover"
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
