"use client";

import { useState, useRef, useEffect } from "react";
import { Star, ChevronRight } from "lucide-react";

interface PriceItem {
  id: string;
  base_price: number;
  discount_price?: number | null;
  unit?: string;
  in_stock?: boolean;
  quantity?: number;
  supplier?: { company_name?: string; region?: string; city?: string; rating?: number; is_verified?: boolean };
}

interface ProductTabsProps {
  description?: string | null;
  gost?: string | null;
  steel_grade?: string | null;
  material?: string | null;
  specs: Record<string, string | null>;
  priceItems: PriceItem[];
  unit?: string;
}

const TABS = ["Описание", "Характеристики", "Доставка", "Наличие и цены", "Отзывы"] as const;
type Tab = (typeof TABS)[number];

export default function ProductTabs({ description, gost, steel_grade, material, specs, priceItems, unit }: ProductTabsProps) {
  const [active, setActive] = useState<Tab>("Описание");
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const check = () => setShowScrollHint(el.scrollWidth > el.clientWidth && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => { el.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, []);

  return (
    <div>
      {/* Tab nav */}
      <div className="relative">
      <div ref={tabsRef} className="flex border-b border-border overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              active === tab
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            {tab === "Наличие и цены" && priceItems.length > 0 && (
              <span className="ml-1.5 text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                {priceItems.length}
              </span>
            )}
          </button>
        ))}
      </div>
      {showScrollHint && (
        <div className="absolute right-0 top-0 h-full flex items-center pr-1 bg-gradient-to-l from-card via-card/80 to-transparent pointer-events-none w-10">
          <ChevronRight size={16} className="text-muted-foreground ml-auto" />
        </div>
      )}
      </div>

      {/* Tab content */}
      <div className="py-5">
        {active === "Описание" && (
          <div className="prose prose-sm max-w-none text-foreground">
            {description ? (
              <>
                <p className="text-muted-foreground leading-relaxed mb-4">{description}</p>
                {material && (
                  <>
                    <h2 className="text-base font-semibold text-foreground mt-4 mb-2">Применение</h2>
                    <p className="text-muted-foreground leading-relaxed">{material}</p>
                  </>
                )}
                {gost && (
                  <>
                    <h2 className="text-base font-semibold text-foreground mt-4 mb-2">Стандарты и нормативы</h2>
                    <p className="text-muted-foreground">Продукция изготавливается по <strong>{gost}</strong>. Все изделия сопровождаются сертификатами качества.</p>
                  </>
                )}
                <h2 className="text-base font-semibold text-foreground mt-4 mb-2">Как выбрать</h2>
                <p className="text-muted-foreground leading-relaxed">При выборе металлопродукции обращайте внимание на марку стали, ГОСТ и геометрические характеристики. Для несущих конструкций рекомендуем{steel_grade ? ` марку ${steel_grade}` : " высокопрочные марки стали"}.</p>
              </>
            ) : (
              <p className="text-muted-foreground">Описание будет добавлено.</p>
            )}
          </div>
        )}

        {active === "Характеристики" && (
          <div>
            {Object.keys(specs).filter(k => specs[k]).length === 0 ? (
              <p className="text-muted-foreground text-sm">Характеристики уточняются.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(specs).filter(([, v]) => v).map(([k, v]) => (
                    <tr key={k} className="border-b border-border/50 odd:bg-muted/20">
                      <td className="py-2 px-3 text-muted-foreground w-1/2">{k}</td>
                      <td className="py-2 px-3 font-medium text-foreground">
                        {/* Defensive type-guard: после Pavel'овой migration
                            #c006 dimensions JSONB иногда попадает сюда как
                            object → React Error #31. Stringify-fallback для
                            любых non-primitive значений. */}
                        {typeof v === "string" || typeof v === "number"
                          ? v
                          : JSON.stringify(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {active === "Доставка" && (
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="text-2xl">🚚</span>
              <div>
                <p className="font-medium text-foreground mb-1">Москва и МО — в день заказа</p>
                <p>Доставка в день заказа при оформлении до 14:00. Собственный автопарк 20+ машин.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <p className="font-medium text-foreground mb-1">Регионы России — 3–7 дней</p>
                <p>Отправка ТК СДЭК, ПЭК, Деловые линии. Расчёт стоимости автоматически по адресу.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">🏭</span>
              <div>
                <p className="font-medium text-foreground mb-1">Самовывоз</p>
                <p>Склад: Москва, Промышленная зона. Пн–Пт 8:00–20:00, Сб 9:00–16:00.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-medium text-foreground mb-1">Документы</p>
                <p>Сертификаты качества, товарная накладная, счёт-фактура, УПД.</p>
              </div>
            </div>
          </div>
        )}

        {active === "Наличие и цены" && (
          <div>
            {priceItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет данных о ценах. Запросите КП.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium">Поставщик</th>
                      <th className="text-left px-3 py-2 font-medium">Цена/{unit || "т"}</th>
                      <th className="text-left px-3 py-2 font-medium">Склад</th>
                      <th className="text-left px-3 py-2 font-medium">Наличие</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {priceItems.map((pi) => (
                      <tr key={pi.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3">
                          <div className="font-medium text-foreground">{pi.supplier?.company_name || "—"}</div>
                          {pi.supplier?.is_verified && <span className="text-xs text-gold">✓ Верифицирован</span>}
                        </td>
                        <td className="px-3 py-3">
                          {pi.discount_price && (
                            <span className="text-xs text-muted-foreground line-through mr-1">
                              {Number(pi.base_price).toLocaleString("ru-RU")}
                            </span>
                          )}
                          <span className="font-bold text-gold">
                            {Number(pi.discount_price || pi.base_price).toLocaleString("ru-RU")} ₽
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {pi.supplier?.city || pi.supplier?.region || "Москва"}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            pi.in_stock ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                          }`}>
                            {pi.in_stock ? "В наличии" : "Под заказ"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <button className="text-xs border border-gold text-gold hover:bg-gold hover:text-black px-3 py-1.5 rounded transition-all">
                            Заказать
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {active === "Отзывы" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="text-5xl font-bold text-gold">4.8</div>
              <div>
                <div className="flex gap-0.5 mb-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={16} className={i <= 4 ? "fill-gold text-gold" : "fill-muted text-muted"} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">12 отзывов</p>
              </div>
            </div>
            <div className="bg-muted/30 rounded p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-sm font-bold text-gold">А</div>
                <div>
                  <p className="text-sm font-medium">Андрей П.</p>
                  <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} size={10} className="fill-gold text-gold" />)}</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Отличное качество, доставили в срок. Рекомендую.</p>
            </div>
            <button className="w-full py-2 border border-border rounded text-sm text-muted-foreground hover:border-gold hover:text-foreground transition-all">
              Написать отзыв
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
