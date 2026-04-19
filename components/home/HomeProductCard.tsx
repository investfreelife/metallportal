import Link from "next/link";
import Image from "next/image";

interface HomeProductCardProps {
  name: string;
  category: string;
  basePrice: number;
  yourPrice: number;
  unit: string;
  stock: string;
  image?: string;
  href?: string;
}

export default function HomeProductCard({
  name,
  category,
  basePrice,
  yourPrice,
  unit,
  stock,
  image,
  href,
}: HomeProductCardProps) {
  const isInStock = stock === "В НАЛИЧИИ";

  const Wrapper = href ? Link : "div";
  return (
    <Wrapper href={href as string} className="bg-card border border-border rounded p-4 hover:shadow-lg transition-all flex-shrink-0 w-64 block">
      {/* Product image */}
      {image && (
        <div className="mb-3 -mx-4 -mt-4 relative h-40">
          <Image src={image} alt={name} fill className="object-cover rounded-t" sizes="256px" />
        </div>
      )}

      {/* Category badge */}
      <div className="mb-3">
        <span className="inline-block bg-gold text-foreground px-2 py-1 text-xs font-medium rounded">
          {category}
        </span>
      </div>

      {/* Product name */}
      <h3 className="text-base font-semibold text-foreground mb-2 line-clamp-2 h-12">
        {name}
      </h3>

      {/* Stock status */}
      <div className="mb-3">
        <span
          className={`inline-block text-xs font-medium px-2 py-1 rounded ${
            isInStock
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {stock}
        </span>
      </div>

      {/* Pricing */}
      <div className="mb-4">
        <div className="text-sm text-muted-foreground line-through mb-1">
          {basePrice.toLocaleString("ru-RU")} ₽/{unit}
        </div>
        <div className="text-xl font-bold text-gold">
          {yourPrice.toLocaleString("ru-RU")} ₽/{unit}
        </div>
      </div>

      {/* CTA Button */}
      <div className="w-full border-2 border-gold text-foreground hover:bg-gold hover:text-foreground font-medium py-2 rounded transition-all text-center text-sm">
        Получить цену
      </div>
    </Wrapper>
  );
}
