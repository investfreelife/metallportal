"use client";

import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";
import type { LandingConfig } from "@/lib/landings";

interface Props {
  config: LandingConfig["calculator"];
  slug: string;
}

/**
 * Client-side calculator. Принимает config из landing, рендерит form fields,
 * пересчитывает estimated price на каждое изменение.
 *
 * Compute logic per `config.type` — switch внутри `compute()`. Все формулы —
 * placeholders B2B-realistic; реальные prices Антон уточнит для каждой landing.
 *
 * При желании заказать — кнопка scroll'ит к `#cta-form` (LandingCTABlock).
 * Calculator state передавать в lead form пока не будем — m004+ candidate
 * (нужен shared state / context).
 */
export default function LandingCalculator({ config, slug }: Props) {
  // Initial values из defaultValue (или 1-st option / 0)
  const [values, setValues] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    for (const f of config.fields) {
      if (f.defaultValue !== undefined) init[f.name] = f.defaultValue;
      else if (f.type === "select") init[f.name] = f.options?.[0] ?? "";
      else init[f.name] = f.min ?? 0;
    }
    return init;
  });

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const result = useMemo(() => compute(config, values), [config, values]);

  return (
    <section className="container-main py-12 md:py-16">
      <div className="bg-card border border-border rounded-2xl p-6 md:p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Calculator className="text-gold" size={22} />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            Калькулятор стоимости
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {config.fields.map((f) => (
            <label key={f.name} className="block text-sm">
              <span className="block text-muted-foreground mb-1.5">
                {f.label}
                {f.unit && <span className="text-xs ml-1">({f.unit})</span>}
              </span>
              {f.type === "number" ? (
                <input
                  type="number"
                  value={values[f.name] ?? ""}
                  min={f.min}
                  max={f.max}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground focus:border-gold focus:outline-none transition-colors"
                />
              ) : (
                <select
                  value={values[f.name] ?? ""}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground focus:border-gold focus:outline-none transition-colors"
                >
                  {f.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-border flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Ориентировочная стоимость
            </div>
            <div className="text-3xl md:text-4xl font-black text-gold">
              {result.toLocaleString("ru-RU")} ₽
            </div>
            {config.resultNote && (
              <p className="text-xs text-muted-foreground mt-2 max-w-md">
                {config.resultNote}
              </p>
            )}
          </div>
          <a
            href="#cta-form"
            data-metrika-goal={`calculator_submit_${slug}`}
            className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-all whitespace-nowrap"
          >
            Заказать с этим расчётом →
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * Compute logic per calculator type. Все formulas — B2B-realistic
 * placeholders, без access к product DB (consciously — landing должен
 * считать БЕЗ network call). Антон уточнит реальные prices в content
 * batch m004+ через `pricePerSqm` / `pricePerMeter` дополнения в config
 * (TBD — пока hardcoded inside).
 */
function compute(
  config: LandingConfig["calculator"],
  values: Record<string, string | number>,
): number {
  const num = (key: string): number => Number(values[key]) || 0;
  const str = (key: string): string => String(values[key] ?? "");

  switch (config.type) {
    case "fence": {
      const length = num("length"); // м.п.
      const height = parseFloat(str("height")) || 1.8;
      const sectionType = str("type");
      const gate = str("gate");

      // Цены за квадратный метр секции (включая столбы и работу)
      const pricePerSqm: Record<string, number> = {
        "Профильная труба 40×20": 1450,
        "Профильная труба 60×40 (усиленная)": 1850,
        "Кованая решётка": 4200,
        Евроштакетник: 1650,
      };
      const sqmPrice = pricePerSqm[sectionType] ?? 1450;

      const gateAddon: Record<string, number> = {
        "Без ворот": 0,
        Калитка: 18000,
        "Ворота распашные": 45000,
        "Ворота откатные": 95000,
      };
      const addon = gateAddon[gate] ?? 0;

      return Math.round(length * height * sqmPrice + addon);
    }

    case "sandwich": {
      // Гараж/здание: width × length × height — из значений + типа панели
      const w = num("width") || 4;
      const l = num("length") || 6;
      const h = num("height") || 2.5;
      const wallArea = 2 * (w + l) * h;
      const roofArea = w * l;
      // ~3500 ₽/м² панели + работа + ворота
      return Math.round((wallArea + roofArea) * 3500 + 35000);
    }

    case "metal-construction": {
      const tons = num("tons") || 1;
      // ~120 000 ₽/т включая монтаж
      return Math.round(tons * 120000);
    }

    case "mesh": {
      const length = num("length") || 10;
      const height = parseFloat(str("height")) || 2;
      // ~850 ₽/м² базовой сетки + монтаж
      return Math.round(length * height * 850 + 5000);
    }

    case "custom":
    default:
      return 0;
  }
}
