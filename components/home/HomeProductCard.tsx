"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ShoppingCart, Check, PhoneCall } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

interface HomeProductCardProps {
  productId: string;
  name: string;
  category: string;
  basePrice: number | null;
  yourPrice: number | null;
  unit: string;
  image?: string;
  href?: string;
  isConstruction?: boolean;
  imageUrl?: string | null;
}

export default function HomeProductCard({
  productId,
  name,
  category,
  basePrice,
  yourPrice,
  unit,
  image,
  href,
  isConstruction,
  imageUrl,
}: HomeProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ id: productId, name, slug: href?.split("/").pop() ?? productId, unit, price: yourPrice, image_url: imageUrl ?? null });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const Wrapper = href ? Link : "div";
  return (
    <Wrapper href={href as string} className="bg-card border border-border rounded p-4 hover:shadow-lg hover:border-gold transition-all flex flex-col block">
      {/* Product image */}
      {image ? (
        <div className="mb-3 -mx-4 -mt-4 relative h-40">
          <Image src={image} alt={name} fill className="object-cover rounded-t" sizes="(max-width:768px) 50vw, 25vw" />
        </div>
      ) : (
        <div className="mb-3 -mx-4 -mt-4 h-40 bg-muted flex items-center justify-center text-4xl opacity-20 rounded-t">📦</div>
      )}

      {/* Category badge */}
      <div className="mb-2">
        <span className="inline-block bg-gold/10 text-gold px-2 py-0.5 text-xs font-medium rounded">
          {category}
        </span>
      </div>

      {/* Product name */}
      <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2 flex-1">
        {name}
      </h3>

      {/* Stock status */}
      <div className="mb-2">
        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-success/10 text-success">
          В наличии
        </span>
      </div>

      {/* Pricing */}
      <div className="mb-3">
        {yourPrice ? (
          <>
            {basePrice && basePrice !== yourPrice && (
              <div className="text-xs text-muted-foreground line-through">
                {basePrice.toLocaleString("ru-RU")} ₽/{unit}
              </div>
            )}
            <div className="text-xl font-bold text-gold">
              {yourPrice.toLocaleString("ru-RU")} ₽/{unit}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">По запросу</div>
        )}
      </div>

      {/* CTA Button */}
      {isConstruction ? (
        <div className="w-full border-2 border-gold text-foreground hover:bg-gold/10 font-medium py-2 rounded transition-all text-center text-sm flex items-center justify-center gap-1.5">
          <PhoneCall size={14} />
          Получить цену
        </div>
      ) : (
        <button
          onClick={handleAddToCart}
          className={`w-full flex items-center justify-center gap-1.5 font-semibold py-2 rounded transition-all text-sm ${
            added ? "bg-emerald-500/20 text-emerald-500" : "bg-gold/10 hover:bg-gold text-gold hover:text-black"
          }`}
        >
          {added ? <Check size={14} /> : <ShoppingCart size={14} />}
          {added ? "Добавлено" : "В корзину"}
        </button>
      )}
    </Wrapper>
  );
}
