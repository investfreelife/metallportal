"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

/**
 * NavesCalculator — client component с интерактивным расчётом площади × цена/м².
 * Per ТЗ #031 reference naves-777.ru: два input'а (длина / ширина) → live result.
 * Минимум 24 м² (per default, override через min_area_m2 column).
 */

interface NavesCalculatorProps {
  pricePerM2: number;
  minAreaM2: number;
  /** Когда «Заказать навес» нажат — scroll к OrderForm. */
  onCtaClick?: () => void;
}

export default function NavesCalculator({ pricePerM2, minAreaM2, onCtaClick }: NavesCalculatorProps) {
  const [length, setLength] = useState(10);
  const [width, setWidth] = useState(20);
  const area = +(length * width).toFixed(1);
  const total = Math.round(area * pricePerM2);
  const isBelowMin = area < minAreaM2;

  return (
    <section className="bg-card border border-border rounded-lg p-6 space-y-5">
      <div className="space-y-1">
        <h3 className="text-2xl font-bold text-foreground">Размеры</h3>
        <p className="text-sm text-muted-foreground">Введите свои размеры — мы рассчитаем площадь и цену</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Длина, м</span>
          <input
            type="number"
            min={3}
            max={30}
            step={0.5}
            value={length}
            onChange={(e) => setLength(Math.max(3, Math.min(30, +e.target.value || 0)))}
            className="bg-background border border-border rounded-lg px-3 py-2 text-base focus:border-gold/60 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Ширина, м</span>
          <input
            type="number"
            min={3}
            max={30}
            step={0.5}
            value={width}
            onChange={(e) => setWidth(Math.max(3, Math.min(30, +e.target.value || 0)))}
            className="bg-background border border-border rounded-lg px-3 py-2 text-base focus:border-gold/60 focus:outline-none"
          />
        </label>
      </div>

      <div className="bg-muted/40 rounded-lg p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Итого:</span>
          <strong className="text-lg text-foreground">{area} кв.м</strong>
        </div>
        <p className="text-xs text-muted-foreground">
          * Минимальная площадь навеса для заказа — от {minAreaM2} кв.м
        </p>
        {isBelowMin && (
          <p className="text-xs text-amber-500 font-medium">
            Увеличьте размеры — минимум {minAreaM2} м²
          </p>
        )}
        <div className="flex items-baseline justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Ориентировочная цена:</span>
          <strong className="text-2xl font-bold text-gold">
            ≈ {total.toLocaleString("ru-RU")} ₽
          </strong>
        </div>
      </div>

      <button
        type="button"
        onClick={onCtaClick}
        disabled={isBelowMin}
        className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-black font-bold px-6 py-3.5 rounded-lg transition-all text-base"
      >
        Заказать навес
        <ArrowRight size={18} />
      </button>
    </section>
  );
}
