"use client";

import { useState } from "react";
import { ShoppingCart, PhoneCall, FileUp, Calculator, Check } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

interface PriceBlockProps {
  priceItems: Array<{
    base_price: number;
    discount_price?: number | null;
    in_stock?: boolean;
    unit?: string;
  }>;
  unit?: string;
  weightPerMeter?: number | null;
  productName: string;
  productId?: string;
  productSlug?: string;
  productImageUrl?: string | null;
}

export default function PriceBlock({ priceItems, unit, weightPerMeter, productName, productId, productSlug, productImageUrl }: PriceBlockProps) {
  const [calcMode, setCalcMode] = useState<"meters" | "tons">("meters");
  const [qty, setQty] = useState<string>("100");
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  // Best price
  const bestItem = priceItems.length
    ? priceItems.reduce((a, b) => {
        const pa = Number(a.discount_price ?? a.base_price);
        const pb = Number(b.discount_price ?? b.base_price);
        return pa <= pb ? a : b;
      })
    : null;

  const pricePerUnit = bestItem ? Number(bestItem.discount_price ?? bestItem.base_price) : null;
  const inStock = priceItems.some((p) => p.in_stock);

  const isPiece = unit === "шт" || unit === "штука";

  // Calculator
  const qtyNum = parseFloat(qty) || 0;
  let totalRub = 0;
  let meters = 0;
  let tons = 0;

  if (pricePerUnit && qtyNum > 0) {
    if (isPiece) {
      totalRub = qtyNum * pricePerUnit;
    } else {
      const isTon = unit === "т" || unit === "тонна";
      const pricePerTon = isTon ? pricePerUnit : null;
      const pricePerMeter = !isTon ? pricePerUnit : null;

      if (calcMode === "meters") {
        meters = qtyNum;
        tons = weightPerMeter ? (qtyNum * weightPerMeter) / 1000 : 0;
        totalRub = pricePerMeter ? qtyNum * pricePerMeter : pricePerTon && tons ? tons * pricePerTon : 0;
      } else {
        tons = qtyNum;
        meters = weightPerMeter && weightPerMeter > 0 ? (qtyNum * 1000) / weightPerMeter : 0;
        totalRub = pricePerTon ? qtyNum * pricePerTon : pricePerMeter && meters ? meters * pricePerMeter : 0;
      }
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4 sticky top-[160px]">
      {/* Price */}
      {pricePerUnit ? (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Лучшая цена
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gold">
              {pricePerUnit.toLocaleString("ru-RU")}
            </span>
            <span className="text-muted-foreground">₽/{unit || "т"}</span>
          </div>
          {bestItem?.discount_price && (
            <p className="text-xs text-muted-foreground line-through mt-0.5">
              {Number(bestItem.base_price).toLocaleString("ru-RU")} ₽/{unit || "т"}
            </p>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xl font-bold text-foreground">По запросу</p>
          <p className="text-xs text-muted-foreground mt-1">Укажите количество для расчёта цены</p>
        </div>
      )}

      {/* Stock badge */}
      <div className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded ${
        inStock ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
      }`}>
        <span className={`w-2 h-2 rounded-full ${inStock ? "bg-emerald-500" : "bg-amber-500"}`} />
        {inStock ? "В наличии" : "Под заказ"}
      </div>

      {/* Calculator */}
      {pricePerUnit && (
        <div className="bg-background border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Calculator size={14} />
            <span>Калькулятор</span>
          </div>

          {/* Toggle mode — only for non-piece units */}
          {!isPiece && (
            <div className="flex bg-muted rounded p-0.5">
              <button
                onClick={() => setCalcMode("meters")}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                  calcMode === "meters" ? "bg-gold text-black" : "text-muted-foreground"
                }`}
              >
                Метры
              </button>
              <button
                onClick={() => setCalcMode("tons")}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                  calcMode === "tons" ? "bg-gold text-black" : "text-muted-foreground"
                }`}
              >
                Тонны
              </button>
            </div>
          )}

          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={isPiece ? "шт" : calcMode === "meters" ? "м.п." : "тонн"}
              className="w-full bg-card border border-border rounded px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {isPiece ? "шт" : calcMode === "meters" ? "м.п." : "тонн"}
            </span>
          </div>

          {totalRub > 0 && (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма:</span>
                <span className="font-bold text-gold">{Math.round(totalRub).toLocaleString("ru-RU")} ₽</span>
              </div>
              {!isPiece && meters > 0 && calcMode === "tons" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Длина:</span>
                  <span>{Math.round(meters)} м.п.</span>
                </div>
              )}
              {!isPiece && tons > 0 && calcMode === "meters" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Вес:</span>
                  <span>{tons.toFixed(3)} т</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          onClick={() => {
            if (!productId || !productSlug) return;
            addItem({
              id: productId,
              name: productName,
              slug: productSlug,
              unit: unit ?? null,
              price: pricePerUnit,
              image_url: productImageUrl ?? null,
              meters: !isPiece && calcMode === "meters" && meters > 0 ? Math.round(meters) : undefined,
              tons: !isPiece && tons > 0 ? parseFloat(tons.toFixed(4)) : undefined,
            });
            setAdded(true);
            setTimeout(() => setAdded(false), 2000);
          }}
          className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-lg transition-all ${
            added ? "bg-emerald-500 text-white" : "bg-gold hover:bg-yellow-400 text-black"
          }`}>
          {added ? <Check size={18} /> : <ShoppingCart size={18} />}
          {added
            ? "Добавлено!"
            : !isPiece && calcMode === "meters" && meters > 0
              ? `В корзину (${Math.round(meters)} м.п.)`
              : !isPiece && calcMode === "tons" && tons > 0
                ? `В корзину (${tons.toFixed(3)} т)`
                : "В корзину"}
        </button>
        <button className="w-full flex items-center justify-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-semibold py-2.5 rounded-lg transition-all">
          <PhoneCall size={16} />
          Получить цену
        </button>
        <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border py-2 rounded-lg transition-all">
          <FileUp size={14} />
          Загрузить смету
        </button>
      </div>
    </div>
  );
}
