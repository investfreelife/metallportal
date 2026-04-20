"use client";
import { useState, useMemo } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { ARMATURA_DIAMETERS } from "@/lib/metalCalc";
import { calcTotalRub, type ProductHit } from "@/hooks/useProductPrice";
import { useCart } from "@/contexts/CartContext";
import ToolSearchBox from "./ToolSearchBox";

const Step = ({ n, title, hint }: { n: number; title: string; hint: string }) => (
  <div className="flex items-center gap-3 mb-3">
    <span className="w-7 h-7 rounded-full bg-gold text-black text-xs font-black flex items-center justify-center flex-shrink-0">{n}</span>
    <div><p className="font-semibold text-sm text-foreground">{title}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
  </div>
);

const ARMATURA_WPM: Record<number, number> = {
  6:0.222, 8:0.395, 10:0.617, 12:0.888, 14:1.208, 16:1.578,
  18:1.998, 20:2.466, 22:2.984, 25:3.853, 28:4.834, 32:6.313,
};
const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors";
const lbl = "block text-xs text-muted-foreground mb-1";

export default function MeshCalc() {
  const [areaL, setAreaL] = useState("10");
  const [areaW, setAreaW] = useState("8");
  const [stepX, setStepX] = useState("200");
  const [stepY, setStepY] = useState("200");
  const [diam, setDiam] = useState("12");
  const [layers, setLayers] = useState("1");
  const [reserve, setReserve] = useState("10");

  const [product, setProduct] = useState<ProductHit | null>(null);
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const result = useMemo(() => {
    const L = parseFloat(areaL) || 0;
    const W = parseFloat(areaW) || 0;
    const sx = parseFloat(stepX) / 1000 || 0.2;
    const sy = parseFloat(stepY) / 1000 || 0.2;
    const d = parseInt(diam) || 12;
    const n = parseInt(layers) || 1;
    const res = 1 + (parseFloat(reserve) || 10) / 100;
    const wpm = ARMATURA_WPM[d] || 0;

    const rowsAlongX = Math.ceil(L / sx) + 1;
    const rowsAlongY = Math.ceil(W / sy) + 1;
    const meters = (rowsAlongX * W + rowsAlongY * L) * n * res;
    const kg = meters * wpm;
    const tons = kg / 1000;
    return { meters, kg, tons, d };
  }, [areaL, areaW, stepX, stepY, diam, layers, reserve]);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div>
            <Step n={1} title="Введите размеры площадки" hint="Длина и ширина участка, на который будет уложена сетка" />
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Длина (м)</label><input type="number" value={areaL} onChange={e => setAreaL(e.target.value)} className={inp} min={0} /></div>
              <div><label className={lbl}>Ширина (м)</label><input type="number" value={areaW} onChange={e => setAreaW(e.target.value)} className={inp} min={0} /></div>
            </div>
          </div>

          <div>
            <Step n={2} title="Настройте параметры сетки" hint="Шаг, диаметр арматуры, количество слоёв и запас" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Шаг по длине (мм)</label>
                  <select value={stepX} onChange={e => setStepX(e.target.value)} className={inp}>
                    {[100,150,200,250,300].map(v=><option key={v} value={v}>{v} мм</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Шаг по ширине (мм)</label>
                  <select value={stepY} onChange={e => setStepY(e.target.value)} className={inp}>
                    {[100,150,200,250,300].map(v=><option key={v} value={v}>{v} мм</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Диаметр арматуры</label>
                  <select value={diam} onChange={e => { setDiam(e.target.value); setProduct(null); }} className={inp}>
                    {ARMATURA_DIAMETERS.filter(d => d <= 20).map(d => <option key={d} value={d}>⌀{d} мм</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Слоёв сетки</label>
                  <select value={layers} onChange={e => setLayers(e.target.value)} className={inp}>
                    <option value="1">1 слой</option>
                    <option value="2">2 слоя</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Запас на нахлёст (%)</label>
                <select value={reserve} onChange={e => setReserve(e.target.value)} className={inp}>
                  {[5,10,15,20].map(v=><option key={v} value={v}>{v}%</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Step n={3} title="Найдите арматуру в каталоге" hint="Выберите позицию — сразу увидите цену за тонну" />
            <ToolSearchBox
              placeholder={`Например: арматура ${diam} А500С`}
              initialQuery={`арматура ${diam}`}
              selected={product}
              onSelect={p => setProduct(p)}
              onClear={() => setProduct(null)}
            />
          </div>

          <div className="bg-background border border-gold/30 rounded-xl p-4 space-y-3">
            <Step n={4} title="Результат расчёта" hint="Сколько арматуры нужно для армирования сетки" />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Площадь</span>
                <span className="font-medium">{((parseFloat(areaL)||0)*(parseFloat(areaW)||0)).toFixed(1)} м²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Погонных метров</span>
                <span className="font-medium">{result.meters.toFixed(1)} м.п.</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">⌀{result.d} мм · {ARMATURA_WPM[result.d]} кг/м</span>
                <span className="font-medium">{result.kg.toFixed(1)} кг</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground text-sm">Итого (с запасом {reserve}%)</span>
                <span className="text-2xl font-bold text-gold">{result.tons.toFixed(3)} т</span>
              </div>
              {product?.price && (
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground text-sm">К оплате</span>
                  <span className="text-xl font-black text-emerald-500">{Math.round(calcTotalRub(product, result.tons, result.meters)).toLocaleString("ru-RU")} ₽</span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (!product?.id) return;
                addItem({ id: product.id, name: product.name, slug: product.slug, unit: product.unit, price: product.price, image_url: product.image_url, tons: parseFloat(result.tons.toFixed(4)), meters: result.meters });
                setAdded(true); setTimeout(() => setAdded(false), 2000);
              }}
              disabled={!product?.id}
              className={`flex items-center justify-center gap-2 w-full font-bold py-3 rounded-lg transition-all disabled:opacity-40 ${
                added ? "bg-emerald-500 text-white" : "bg-gold hover:bg-yellow-400 text-black"
              }`}
            >
              {added ? <Check size={16} /> : <ShoppingCart size={16} />}
              {added ? "Добавлено!" : product?.id ? `В корзину (${result.tons.toFixed(3)} т)` : "Сначала найдите товар"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
