"use client";

import { useState } from "react";

interface ProductCalculatorProps {
  weightPerMeter: number | null;
  pricePerTon: number;
  unit: string;
}

export default function ProductCalculator({
  weightPerMeter,
  pricePerTon,
  unit,
}: ProductCalculatorProps) {
  const [mode, setMode] = useState<"tons" | "meters">("tons");
  const [value, setValue] = useState<number>(1);

  const tons = mode === "tons" ? value : weightPerMeter ? (value * weightPerMeter) / 1000 : 0;
  const meters = mode === "meters" ? value : weightPerMeter ? (value * 1000) / weightPerMeter : 0;
  const total = tons * pricePerTon;

  return (
    <div className="bg-card border border-border rounded p-6">
      <h3 className="text-lg font-bold text-foreground mb-4">Калькулятор</h3>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-muted rounded p-1 mb-4">
        <button
          onClick={() => setMode("tons")}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-all ${
            mode === "tons"
              ? "bg-gold text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Тонны
        </button>
        <button
          onClick={() => setMode("meters")}
          disabled={!weightPerMeter}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-all ${
            mode === "meters"
              ? "bg-gold text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          } ${!weightPerMeter ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          Метры
        </button>
      </div>

      {/* Input */}
      <div className="mb-4">
        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
          Количество ({mode === "tons" ? "т" : "м.п."})
        </label>
        <input
          type="number"
          min={0}
          step={mode === "tons" ? 0.1 : 1}
          value={value}
          onChange={(e) => setValue(Math.max(0, Number(e.target.value)))}
          className="w-full bg-input-background border border-border rounded px-4 py-3 text-foreground text-lg font-medium outline-none focus:border-gold transition-colors"
        />
      </div>

      {/* Conversion info */}
      {weightPerMeter && (
        <div className="flex justify-between text-sm text-muted-foreground mb-4 px-1">
          <span>{tons.toFixed(3)} т</span>
          <span>≈</span>
          <span>{meters.toFixed(1)} м.п.</span>
        </div>
      )}

      {/* Total */}
      <div className="bg-background border border-gold/30 rounded p-4 text-center">
        <div className="text-xs text-muted-foreground mb-1">Итого</div>
        <div className="text-3xl font-bold text-gold">
          {total.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {pricePerTon.toLocaleString("ru-RU")} ₽/{unit} × {tons.toFixed(3)} т
        </div>
      </div>

      {/* CTA */}
      <button className="w-full mt-4 bg-gold hover:bg-gold-dark text-primary-foreground font-semibold py-3 rounded transition-all">
        Запросить счёт
      </button>
    </div>
  );
}
