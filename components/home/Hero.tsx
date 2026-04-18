import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import PhotoEditable from "@/components/admin/PhotoEditable";

const CARD_HREFS = [
  "/catalog/metalloprokat",
  "/catalog/gotovye-konstruktsii",
];

const CARD_DEFAULTS = [
  { title: "Металлопрокат", sub: "Трубы · Арматура · Лист · Балки · Уголок", link: "1200+ позиций →",
    image: "/images/home/metalloprokat.png" },
  { title: "Готовые конструкции", sub: "Ангары · Склады · Навесы · Каркасы зданий", link: "Подобрать конструкцию →",
    image: "/images/home/konstrukcii.png" },
];

async function getCategoryImages() {
  const slugs = ["metalloprokat", "konstruktsii"];
  const { data } = await supabase.from("categories").select("slug, image_url").in("slug", slugs);
  if (!data) return {} as Record<string, string>;
  return Object.fromEntries(
    (data as Array<{ slug: string; image_url: string | null }>)
      .filter(c => c.image_url)
      .map(c => [c.slug, c.image_url as string])
  );
}

export default async function Hero() {
  const [settings, catImages] = await Promise.all([getSiteSettings(), getCategoryImages()]);

  const cards = CARD_DEFAULTS.map((def, i) => ({
    title: settings[`hero_card_${i + 1}_title`] || def.title,
    sub: settings[`hero_card_${i + 1}_sub`] || def.sub,
    link: def.link,
    image: settings[`hero_card_${i + 1}_image`] || catImages[["metalloprokat","konstruktsii"][i]] || def.image,
    href: CARD_HREFS[i],
  }));

  return (
    <section className="bg-background py-5">
      <div className="container-main">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cards.map((card, index) => (
            <Link key={index} href={card.href}
              className="relative h-80 rounded overflow-hidden group cursor-pointer shadow-md hover:shadow-xl transition-all">
              <PhotoEditable
                photoId={`category:${["metalloprokat","konstruktsii"][index]}`}
                dimensions="1400×320"
                className="absolute inset-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
              </PhotoEditable>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />
              <div className="relative h-full p-8 flex flex-col justify-end text-white">
                <h2 className="text-3xl font-bold mb-2">{card.title}</h2>
                <p className="text-white/90 mb-4 text-base leading-relaxed">{card.sub}</p>
                <div className="flex items-center gap-2 text-gold group-hover:gap-3 transition-all">
                  <span className="text-sm font-medium">{card.link}</span>
                  <ArrowRight size={16} />
                </div>
              </div>
              <div className="absolute inset-0 bg-gold/0 group-hover:bg-gold/10 transition-all pointer-events-none" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
