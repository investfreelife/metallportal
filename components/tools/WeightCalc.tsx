"use client";
import { useState, useMemo } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { weightPerMeter, searchQuery, ARMATURA_DIAMETERS, BALKA_SIZES, SHVELLER_SIZES, type MetalType, type MetalDims } from "@/lib/metalCalc";
import { calcTotalRub, type ProductHit } from "@/hooks/useProductPrice";
import { useCart } from "@/contexts/CartContext";
import ToolSearchBox from "./ToolSearchBox";

const Step = ({ n, title, hint }: { n: number; title: string; hint: string }) => (
  <div className="flex items-center gap-3 mb-3">
    <span className="w-7 h-7 rounded-full bg-gold text-black text-xs font-black flex items-center justify-center flex-shrink-0">{n}</span>
    <div><p className="font-semibold text-sm text-foreground">{title}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
  </div>
);

const TYPES: { value: MetalType; label: string }[] = [
  { value: "armatura", label: "Арматура" },
  { value: "krug", label: "Круг стальной" },
  { value: "kvadrat", label: "Квадрат стальной" },
  { value: "shestigr", label: "Шестигранник" },
  { value: "truba_round", label: "Труба круглая" },
  { value: "truba_profile", label: "Труба профильная" },
  { value: "balka", label: "Балка двутавровая" },
  { value: "shveller", label: "Швеллер" },
  { value: "ugolok", label: "Уголок равнополочный" },
  { value: "polosa", label: "Полоса стальная" },
  { value: "list", label: "Лист стальной" },
];

const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors";
const lbl = "block text-xs text-muted-foreground mb-1";

export default function WeightCalc() {
  const [type, setType] = useState<MetalType>("armatura");
  const [d, setD] = useState("12");
  const [D, setDD] = useState("108");
  const [t, setT] = useState("4");
  const [a, setA] = useState("60");
  const [b, setB] = useState("40");
  const [size, setSize] = useState("20");
  const [length, setLength] = useState("6");
  const [product, setProduct] = useState<ProductHit | null>(null);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  const dims: MetalDims = useMemo(() => ({
    d: parseFloat(d) || 0, D: parseFloat(D) || 0, t: parseFloat(t) || 0,
    a: parseFloat(a) || 0, b: parseFloat(b) || 0, size: parseFloat(size) || 0,
  }), [d, D, t, a, b, size]);

  const wpm = weightPerMeter(type, dims);
  const L = parseFloat(length) || 0;
  const totalKg = wpm * L;
  const totalTons = totalKg / 1000;
  const q = searchQuery(type, dims);
  const isSheet = type === "list";

  const totalRub = calcTotalRub(product ?? null, totalTons, L);

  const handleCart = () => {
    if (!product?.id) return;
    addItem({
      id: product.id, name: product.name, slug: product.slug,
      unit: product.unit, price: product.price, image_url: product.image_url,
      tons: totalTons > 0 ? parseFloat(totalTons.toFixed(4)) : undefined,
      meters: !isSheet && L > 0 ? L : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const renderDims = () => {
    switch (type) {
      case "armatura":
        return (
          <div>
            <label className={lbl}>Диаметр (мм)</label>
            <select value={d} onChange={e => setD(e.target.value)} className={inp}>
              {ARMATURA_DIAMETERS.map(v => <option key={v} value={v}>⌀{v}</option>)}
            </select>
          </div>
        );
      case "krug":
      case "kvadrat":
      case "shestigr":
        return (
          <div>
            <label className={lbl}>{type === "shestigr" ? "Размер под ключ" : "Диаметр/сторона"} (мм)</label>
            <input type="number" value={d} onChange={e => setD(e.target.value)} className={inp} min={1} />
          </div>
        );
      case "truba_round":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Нар. диаметр D (мм)</label><input type="number" value={D} onChange={e => setDD(e.target.value)} className={inp} min={1} /></div>
            <div><label className={lbl}>Стенка t (мм)</label><input type="number" value={t} onChange={e => setT(e.target.value)} className={inp} min={0.5} step={0.5} /></div>
          </div>
        );
      case "truba_profile":
        return (
          <div className="grid grid-cols-3 gap-2">
            <div><label className={lbl}>A (мм)</label><input type="number" value={a} onChange={e => setA(e.target.value)} className={inp} min={1} /></div>
            <div><label className={lbl}>B (мм)</label><input type="number" value={b} onChange={e => setB(e.target.value)} className={inp} min={1} /></div>
            <div><label className={lbl}>t (мм)</label><input type="number" value={t} onChange={e => setT(e.target.value)} className={inp} min={0.5} step={0.5} /></div>
          </div>
        );
      case "balka":
        return (
          <div>
            <label className={lbl}>Номер балки</label>
            <select value={size} onChange={e => setSize(e.target.value)} className={inp}>
              {BALKA_SIZES.map(v => <option key={v} value={v}>№{v}</option>)}
            </select>
          </div>
        );
      case "shveller":
        return (
          <div>
            <label className={lbl}>Номер швеллера</label>
            <select value={size} onChange={e => setSize(e.target.value)} className={inp}>
              {SHVELLER_SIZES.map(v => <option key={v} value={v}>№{v}</option>)}
            </select>
          </div>
        );
      case "ugolok":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Полка A (мм)</label><input type="number" value={a} onChange={e => setA(e.target.value)} className={inp} min={1} /></div>
            <div><label className={lbl}>Толщина t (мм)</label><input type="number" value={t} onChange={e => setT(e.target.value)} className={inp} min={1} /></div>
          </div>
        );
      case "polosa":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Ширина (мм)</label><input type="number" value={a} onChange={e => setA(e.target.value)} className={inp} min={1} /></div>
            <div><label className={lbl}>Толщина (мм)</label><input type="number" value={b} onChange={e => setB(e.target.value)} className={inp} min={1} /></div>
          </div>
        );
      case "list":
        return (
          <div>
            <label className={lbl}>Толщина листа (мм)</label>
            <input type="number" value={t} onChange={e => setT(e.target.value)} className={inp} min={0.5} step={0.5} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div>
            <Step n={1} title="Выберите тип металлопроката" hint="Арматура, трубы, балки, листы и другой прокат" />
            <div className="space-y-3">
              <div>
                <label className={lbl}>Вид металлопроката</label>
                <select value={type} onChange={e => { setType(e.target.value as MetalType); setProduct(null); }} className={inp}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {renderDims()}
            </div>
          </div>

          <div>
            <Step n={2} title={isSheet ? "Укажите площадь листа" : "Укажите длину"} hint={isSheet ? "Введите нужную площадь в м²" : "Сколько погонных метров нужно купить"} />
            <input type="number" value={length} onChange={e => setLength(e.target.value)} className={inp} min={0} step={0.5} placeholder={isSheet ? "м²" : "м.п."} />
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Step n={3} title="Найдите товар в каталоге" hint="Введите запрос — выберите нужную позицию и сразу увидите цену" />
            <ToolSearchBox
              placeholder={`Например: ${q || "арматура 12"}`}
              initialQuery={q}
              selected={product}
              onSelect={p => setProduct(p)}
              onClear={() => setProduct(null)}
            />
          </div>

          <div className="bg-background border border-gold/30 rounded-xl p-4 space-y-3">
            <Step n={4} title="Результат расчёта" hint="Вес и стоимость вашего заказа" />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Вес 1 {isSheet ? "м²" : "м.п."}</span>
                <span className="font-medium">{wpm > 0 ? `${wpm} кг` : "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Итого кг</span>
                <span className="font-medium">{totalKg > 0 ? `${totalKg.toFixed(2)} кг` : "—"}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground text-sm">Итого тонн</span>
                <span className="text-4xl font-black text-gold">{totalTons > 0 ? `${totalTons.toFixed(4)} т` : "—"}</span>
              </div>
              {product?.price && totalRub > 0 && (
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground text-sm">К оплате</span>
                  <span className="text-3xl font-black text-emerald-500">{Math.round(totalRub).toLocaleString("ru-RU")} ₽</span>
                </div>
              )}
            </div>
            <button
              onClick={handleCart}
              disabled={!product?.id || totalTons <= 0}
              className={`flex items-center justify-center gap-2 w-full font-semibold text-sm py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                added ? "bg-emerald-500 text-white" : "bg-gold hover:bg-yellow-400 text-black"
              }`}
            >
              {added ? <Check size={16} /> : <ShoppingCart size={16} />}
              {added ? "Добавлено!" : totalTons > 0 ? `В корзину (${totalTons.toFixed(3)} т)` : "Сначала найдите товар"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
