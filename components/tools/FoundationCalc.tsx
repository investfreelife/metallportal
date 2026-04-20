"use client";
import { useState, useMemo } from "react";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { ARMATURA_DIAMETERS } from "@/lib/metalCalc";
import { useProductPrice, calcTotalRub } from "@/hooks/useProductPrice";
import { useCart } from "@/contexts/CartContext";

const ARMATURA_WPM: Record<number, number> = {
  6:0.222, 8:0.395, 10:0.617, 12:0.888, 14:1.208, 16:1.578,
  18:1.998, 20:2.466, 22:2.984, 25:3.853, 28:4.834, 32:6.313,
  36:7.990, 40:9.865,
};

const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors";
const lbl = "block text-xs text-muted-foreground mb-1";

type FoundationType = "lenta" | "plita" | "stolb";

export default function FoundationCalc() {
  const [fType, setFType] = useState<FoundationType>("lenta");

  // Ленточный
  const [perimeter, setPerimeter] = useState("40");
  const [depth, setDepth] = useState("1.5");
  const [width, setWidth] = useState("0.4");
  const [hRows, setHRows] = useState("2");
  const [vStep, setVStep] = useState("0.5");
  const [diam, setDiam] = useState("12");
  const [overlapPct, setOverlapPct] = useState("10");

  // Плита
  const [plateL, setPlateL] = useState("10");
  const [plateW, setPlateW] = useState("8");
  const [plateStep, setPlateStep] = useState("0.2");
  const [plateDiam, setPlateDiam] = useState("12");

  // Столбчатый
  const [pillarCount, setPillarCount] = useState("9");
  const [pillarH, setPillarH] = useState("1.2");
  const [pillarBars, setPillarBars] = useState("4");
  const [pillarDiam, setPillarDiam] = useState("12");
  const [pillarHoopStep, setPillarHoopStep] = useState("0.3");
  const [pillarSize, setPillarSize] = useState("0.3");

  const activeDiam = fType === "plita" ? plateDiam : fType === "stolb" ? pillarDiam : diam;
  const priceQuery = `арматура ${activeDiam}`;
  const { product, loading: priceLoading } = useProductPrice(priceQuery);
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const result = useMemo(() => {
    if (fType === "lenta") {
      const P = parseFloat(perimeter) || 0;
      const H = parseFloat(depth) || 0;
      const W = parseFloat(width) || 0;
      const rows = parseInt(hRows) || 2;
      const step = parseFloat(vStep) || 0.5;
      const d = parseInt(diam) || 12;
      const overlap = 1 + (parseFloat(overlapPct) || 10) / 100;
      const wpm = ARMATURA_WPM[d] || 0;

      const longMeters = rows * 2 * P * overlap;
      const clipCount = Math.ceil(P / step);
      const clipLen = 2 * (H - 0.1) + 2 * (W - 0.1);
      const clipMeters = clipCount * clipLen;
      const total = longMeters + clipMeters;
      return { total, tons: total * wpm / 1000, d, label: `арматура ${d}` };
    }
    if (fType === "plita") {
      const L = parseFloat(plateL) || 0;
      const W = parseFloat(plateW) || 0;
      const step = parseFloat(plateStep) || 0.2;
      const d = parseInt(plateDiam) || 12;
      const wpm = ARMATURA_WPM[d] || 0;
      const rowsX = Math.ceil(L / step) + 1;
      const rowsY = Math.ceil(W / step) + 1;
      const total = (rowsX * W + rowsY * L) * 2 * 1.1;
      return { total, tons: total * wpm / 1000, d, label: `арматура ${d}` };
    }
    if (fType === "stolb") {
      const n = parseInt(pillarCount) || 0;
      const H = parseFloat(pillarH) || 0;
      const bars = parseInt(pillarBars) || 4;
      const hoopStep = parseFloat(pillarHoopStep) || 0.3;
      const size = parseFloat(pillarSize) || 0.3;
      const d = parseInt(pillarDiam) || 12;
      const wpm = ARMATURA_WPM[d] || 0;
      const vertMeters = n * bars * (H + 0.5);
      const hoopCount = n * Math.ceil(H / hoopStep);
      const hoopLen = 4 * (size - 0.1);
      const total = vertMeters + hoopCount * hoopLen;
      return { total, tons: total * wpm / 1000, d, label: `арматура ${d}` };
    }
    return null;
  }, [fType, perimeter, depth, width, hRows, vStep, diam, overlapPct,
      plateL, plateW, plateStep, plateDiam,
      pillarCount, pillarH, pillarBars, pillarDiam, pillarHoopStep, pillarSize]);

  const tabs: { v: FoundationType; l: string }[] = [
    { v: "lenta", l: "Ленточный" },
    { v: "plita", l: "Плита" },
    { v: "stolb", l: "Столбчатый" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.v} onClick={() => setFType(tab.v)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${fType === tab.v ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground"}`}>
            {tab.l}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {fType === "lenta" && <>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Периметр стен (м)</label><input type="number" value={perimeter} onChange={e => setPerimeter(e.target.value)} className={inp} min={0} /></div>
              <div><label className={lbl}>Глубина ленты (м)</label><input type="number" value={depth} onChange={e => setDepth(e.target.value)} className={inp} min={0} step={0.1} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Ширина ленты (м)</label><input type="number" value={width} onChange={e => setWidth(e.target.value)} className={inp} min={0} step={0.05} /></div>
              <div><label className={lbl}>Рядов гор. арматуры</label>
                <select value={hRows} onChange={e => setHRows(e.target.value)} className={inp}>
                  {[2,3,4].map(v=><option key={v} value={v}>{v} ряда</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Шаг хомутов (м)</label><input type="number" value={vStep} onChange={e => setVStep(e.target.value)} className={inp} min={0.1} step={0.05} /></div>
              <div><label className={lbl}>Нахлёст (%)</label><input type="number" value={overlapPct} onChange={e => setOverlapPct(e.target.value)} className={inp} min={0} /></div>
            </div>
            <div><label className={lbl}>Диаметр арматуры</label>
              <select value={diam} onChange={e => setDiam(e.target.value)} className={inp}>
                {ARMATURA_DIAMETERS.filter(d => d >= 8).map(d => <option key={d} value={d}>⌀{d} мм</option>)}
              </select>
            </div>
          </>}

          {fType === "plita" && <>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Длина плиты (м)</label><input type="number" value={plateL} onChange={e => setPlateL(e.target.value)} className={inp} min={0} /></div>
              <div><label className={lbl}>Ширина плиты (м)</label><input type="number" value={plateW} onChange={e => setPlateW(e.target.value)} className={inp} min={0} /></div>
            </div>
            <div><label className={lbl}>Шаг сетки (м)</label>
              <select value={plateStep} onChange={e => setPlateStep(e.target.value)} className={inp}>
                {[0.1,0.15,0.2,0.25,0.3].map(v=><option key={v} value={v}>{v*100} мм</option>)}
              </select>
            </div>
            <div><label className={lbl}>Диаметр арматуры</label>
              <select value={plateDiam} onChange={e => setPlateDiam(e.target.value)} className={inp}>
                {ARMATURA_DIAMETERS.filter(d => d >= 8).map(d => <option key={d} value={d}>⌀{d} мм</option>)}
              </select>
            </div>
          </>}

          {fType === "stolb" && <>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Кол-во столбов</label><input type="number" value={pillarCount} onChange={e => setPillarCount(e.target.value)} className={inp} min={1} /></div>
              <div><label className={lbl}>Глубина (м)</label><input type="number" value={pillarH} onChange={e => setPillarH(e.target.value)} className={inp} min={0} step={0.1} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Прутков на столб</label>
                <select value={pillarBars} onChange={e => setPillarBars(e.target.value)} className={inp}>
                  {[4,6,8].map(v=><option key={v} value={v}>{v} шт</option>)}
                </select>
              </div>
              <div><label className={lbl}>Сторона сечения (м)</label><input type="number" value={pillarSize} onChange={e => setPillarSize(e.target.value)} className={inp} min={0.1} step={0.05} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Шаг хомутов (м)</label><input type="number" value={pillarHoopStep} onChange={e => setPillarHoopStep(e.target.value)} className={inp} min={0.1} step={0.05} /></div>
              <div><label className={lbl}>Диаметр арматуры</label>
                <select value={pillarDiam} onChange={e => setPillarDiam(e.target.value)} className={inp}>
                  {ARMATURA_DIAMETERS.filter(d => d >= 8).map(d => <option key={d} value={d}>⌀{d} мм</option>)}
                </select>
              </div>
            </div>
          </>}
        </div>

        <div className="bg-background border border-gold/30 rounded-xl p-5 flex flex-col justify-between gap-4">
          {result ? (
            <>
              <div className="space-y-3">
                <div className="flex justify-between text-sm border-b border-border pb-2">
                  <span className="text-muted-foreground">Погонных метров</span>
                  <span className="font-bold">{result.total.toFixed(1)} м.п.</span>
                </div>
                <div className="flex justify-between text-sm border-b border-border pb-2">
                  <span className="text-muted-foreground">Итого (с запасом 10%)</span>
                  <span className="text-2xl font-bold text-gold">{(result.tons * 1.1).toFixed(3)} т</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Цена за тонну</span>
                  <span className="font-medium">
                    {priceLoading ? <Loader2 size={14} className="animate-spin inline" /> : product?.price ? `${product.price.toLocaleString("ru-RU")} ₽/т` : "По запросу"}
                  </span>
                </div>
                {product?.price && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">К оплате</span>
                    <span className="text-xl font-black text-emerald-500">
                      {Math.round(calcTotalRub(product, result.tons * 1.1, result.total * 1.1)).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Арматура ⌀{result.d} мм · {ARMATURA_WPM[result.d]} кг/м</p>
              </div>
              <button
                onClick={() => {
                  if (!product?.id) return;
                  const tons = parseFloat((result.tons * 1.1).toFixed(4));
                  addItem({ id: product.id, name: product.name, slug: product.slug, unit: product.unit, price: product.price, image_url: product.image_url, tons });
                  setAdded(true); setTimeout(() => setAdded(false), 2000);
                }}
                disabled={!product?.id}
                className={`flex items-center justify-center gap-2 w-full font-bold py-3 rounded-lg transition-all disabled:opacity-40 ${
                  added ? "bg-emerald-500 text-white" : "bg-gold hover:bg-yellow-400 text-black"
                }`}
              >
                {added ? <Check size={16} /> : <ShoppingCart size={16} />}
                {added ? "Добавлено!" : `В корзину (${(result.tons * 1.1).toFixed(3)} т)`}
              </button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Заполните параметры</p>
          )}
        </div>
      </div>
    </div>
  );
}
