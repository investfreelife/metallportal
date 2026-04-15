import Button from "@/components/ui/Button";

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  supplier: string;
  inStock: boolean;
}

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const formattedPrice = new Intl.NumberFormat("ru-RU").format(product.price);

  return (
    <div className="bg-surface border border-surface-border rounded-xl p-5 flex flex-col gap-3 hover:border-gold/50 transition-colors">
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            product.inStock
              ? "bg-green-900/30 text-green-400"
              : "bg-red-900/30 text-red-400"
          }`}
        >
          {product.inStock ? "В наличии" : "Под заказ"}
        </span>
        <span className="text-xs text-gray-500">{product.supplier}</span>
      </div>

      <h3 className="text-base font-semibold leading-tight">{product.name}</h3>

      <div className="mt-auto pt-3 flex items-end justify-between">
        <div>
          <span className="text-xl font-bold text-gold">{formattedPrice} ₽</span>
          <span className="text-sm text-gray-400 ml-1">/ {product.unit}</span>
        </div>
        <Button variant="outline" size="sm">
          В корзину
        </Button>
      </div>
    </div>
  );
}
