"use client";

import type { FilterState } from "./CatalogView";
import { RotateCcw } from "lucide-react";

interface FiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  options: {
    steelGrades: string[];
    gosts: string[];
    coatings: string[];
    suppliers: string[];
    regions: string[];
  };
  onReset: () => void;
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-input-background border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors"
      >
        <option value="">Все</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function RangeFilter({
  label,
  minVal,
  maxVal,
  onMinChange,
  onMaxChange,
  unit,
}: {
  label: string;
  minVal: number;
  maxVal: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
        {label} {unit && <span className="normal-case">({unit})</span>}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="от"
          value={minVal || ""}
          onChange={(e) => onMinChange(Number(e.target.value) || 0)}
          className="w-full bg-input-background border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors"
        />
        <input
          type="number"
          placeholder="до"
          value={maxVal || ""}
          onChange={(e) => onMaxChange(Number(e.target.value) || 0)}
          className="w-full bg-input-background border border-border rounded px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors"
        />
      </div>
    </div>
  );
}

export default function CatalogFilters({
  filters,
  onChange,
  options,
  onReset,
}: FiltersProps) {
  const update = (partial: Partial<FilterState>) =>
    onChange({ ...filters, ...partial });

  return (
    <div className="bg-card border border-border rounded p-5 space-y-5 sticky top-[140px]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Фильтры
        </h3>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold transition-colors"
        >
          <RotateCcw size={12} />
          Сбросить
        </button>
      </div>

      <SelectFilter
        label="Марка стали"
        value={filters.steelGrade}
        options={options.steelGrades}
        onChange={(v) => update({ steelGrade: v })}
      />

      <RangeFilter
        label="Диаметр"
        unit="мм"
        minVal={filters.diameterMin}
        maxVal={filters.diameterMax}
        onMinChange={(v) => update({ diameterMin: v })}
        onMaxChange={(v) => update({ diameterMax: v })}
      />

      <RangeFilter
        label="Толщина"
        unit="мм"
        minVal={filters.thicknessMin}
        maxVal={filters.thicknessMax}
        onMinChange={(v) => update({ thicknessMin: v })}
        onMaxChange={(v) => update({ thicknessMax: v })}
      />

      <SelectFilter
        label="ГОСТ"
        value={filters.gost}
        options={options.gosts}
        onChange={(v) => update({ gost: v })}
      />

      <SelectFilter
        label="Покрытие"
        value={filters.coating}
        options={options.coatings}
        onChange={(v) => update({ coating: v })}
      />

      {/* In stock toggle */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={filters.inStock}
              onChange={(e) => update({ inStock: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-muted rounded-full peer-checked:bg-gold transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm text-foreground group-hover:text-gold transition-colors">
            В наличии
          </span>
        </label>
      </div>

      <SelectFilter
        label="Поставщик"
        value={filters.supplier}
        options={options.suppliers}
        onChange={(v) => update({ supplier: v })}
      />

      <SelectFilter
        label="Регион"
        value={filters.region}
        options={options.regions}
        onChange={(v) => update({ region: v })}
      />

      <RangeFilter
        label="Цена"
        unit="₽/т"
        minVal={filters.priceMin}
        maxVal={filters.priceMax}
        onMinChange={(v) => update({ priceMin: v })}
        onMaxChange={(v) => update({ priceMax: v })}
      />
    </div>
  );
}
