"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Wrench, Star, FileText, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import NavesOrderModal from "./NavesOrderModal";
import PhotoEditable from "@/components/admin/PhotoEditable";
import CategoryCallbackCTA from "@/components/catalog/CategoryCallbackCTA";
import { formatDimensions } from "@/lib/formatDimensions";

const FEATURES = [
  { icon: Wrench, title: "Долговечность", desc: "Стальной каркас из профильной трубы по ГОСТ 30245-2003. Антикоррозийная обработка и порошковое окрашивание. Срок службы — свыше 30 лет." },
  { icon: Shield, title: "Гарантия 10 лет", desc: "Выдаём гарантийный паспорт на сварные соединения и антикоррозийное покрытие. Безвозмездное устранение дефектов в гарантийный период." },
  { icon: Star, title: "Каждый заказ уникален", desc: "Изготавливаем по вашим размерам — ширина, длина, высота, тип кровли, цвет RAL. Стандартные и нестандартные формы." },
  { icon: FileText, title: "Договор", desc: "Работаем по договору с юридическими и физическими лицами. Полный пакет закрывающих документов. Оплата после подписания акта." },
];

interface Props {
  product: any;
  related: any[];
  basePath: string;
}

export default function NavesProductDetail({ product, related, basePath }: Props) {
  const price = product.price_items?.length
    ? Math.min(...product.price_items.map((p: any) => Number(p.discount_price ?? p.base_price)))
    : 0;

  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);

  const area = length && width ? Math.round(parseFloat(length) * parseFloat(width) * 100) / 100 : 0;
  const totalPrice = area > 0 && price > 0 ? Math.round(area * price) : 0;

  const supplier = product.price_items?.[0]?.supplier?.company_name || product.supplier?.company_name || "Харланметалл";
  const material = formatDimensions(product.dimensions) || "";

  const visibleRelated = related.slice(carouselIdx, carouselIdx + 4);
  const canPrev = carouselIdx > 0;
  const canNext = carouselIdx + 4 < related.length;

  return (
    <>
      {showModal && (
        <NavesOrderModal
          productName={product.name}
          price={price}
          area={area}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Breadcrumbs */}
      <nav className="text-sm text-muted-foreground mb-5 flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
        <span>/</span>
        <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
        <span>/</span>
        <Link href={basePath} className="hover:text-gold transition-colors">
          {product.category?.name || "Навесы"}
        </Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      {/* Hero: image + right panel */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* Image */}
        <div className="flex-1 min-w-0">
          <PhotoEditable photoId={`product:${product.slug}`} dimensions="800×500" className="rounded-xl overflow-hidden h-72 lg:h-[420px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url || "/placeholder-naves.jpg"}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </PhotoEditable>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground mb-2 capitalize">{product.name}</h1>
            {price > 0 && (
              <p className="text-2xl font-black text-gold">от {price.toLocaleString("ru-RU")} ₽ за м²</p>
            )}
          </div>

          {/* Specs */}
          <div className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-24 flex-shrink-0">Поставщик</span>
              <span className="text-foreground font-medium">{supplier}</span>
            </div>
            {material && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 flex-shrink-0">Материал</span>
                <span className="text-foreground font-medium">{material}</span>
              </div>
            )}
          </div>

          {/* Calculator */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Размеры</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Длина, м</label>
              <div className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2.5 focus-within:border-gold transition-colors">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="—"
                  value={length}
                  onChange={e => setLength(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ширина, м</label>
              <div className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2.5 focus-within:border-gold transition-colors">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="—"
                  value={width}
                  onChange={e => setWidth(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-sm text-muted-foreground">Итого:</span>
              <span className="text-sm font-bold text-foreground">
                {area > 0 ? `${area} кв.м` : "__ кв.м"}
                {totalPrice > 0 && <span className="text-gold ml-2">≈ {totalPrice.toLocaleString("ru-RU")} ₽</span>}
              </span>
            </div>
          </div>

          {/* Order button */}
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold py-3.5 rounded-xl transition-all text-sm"
          >
            Сделать заказ <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {FEATURES.map((f, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <f.icon size={22} className="text-gold mb-3" />
            <p className="font-bold text-foreground mb-1.5 text-sm">{f.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Related carousel */}
      {related.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Похожие проекты</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCarouselIdx(i => Math.max(0, i - 1))}
                disabled={!canPrev}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-border hover:border-gold disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCarouselIdx(i => Math.min(related.length - 4, i + 1))}
                disabled={!canNext}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-border hover:border-gold disabled:opacity-30 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleRelated.map((rel: any) => {
              const rp = rel.price_items?.length
                ? Math.min(...rel.price_items.map((p: any) => Number(p.discount_price ?? p.base_price)))
                : null;
              return (
                <Link
                  key={rel.id}
                  href={`${basePath}/${rel.slug}`}
                  className="bg-card border border-border rounded-xl overflow-hidden hover:border-gold transition-all group"
                >
                  <div className="h-32 bg-muted overflow-hidden">
                    {rel.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={rel.image_url} alt={rel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🏠</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 mb-1 group-hover:text-gold transition-colors">{rel.name}</p>
                    {rel.dimensions && <p className="text-xs text-muted-foreground mb-1">{rel.dimensions}</p>}
                    {rp ? (
                      <p className="text-xs font-bold text-gold">от {rp.toLocaleString("ru-RU")} ₽/м²</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">По запросу</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* SEO */}
      <section className="mt-16 pt-10 border-t border-border">
        <h2 className="text-3xl font-bold text-foreground mb-5">{product.name} — купить в Москве | Харланметалл</h2>
        <p className="text-muted-foreground leading-relaxed mb-8 max-w-4xl">
          Харланметалл изготавливает <strong className="text-foreground">{product.name.toLowerCase()}</strong> на заказ
          по вашим размерам. Собственный завод, металлокаркас из профильной трубы по ГОСТ, кровля из качественных материалов.
          Монтаж «под ключ», гарантия 10 лет, расчёт стоимости за 1 рабочий день.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">✅</span>
          <h3 className="text-2xl font-bold text-foreground">Преимущества</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
          {[
            "Собственный завод — цены без посредников и торговых наценок",
            "Металлопрокат собственного производства по ГОСТ 30245-2003",
            "Любые размеры — стандартные и нестандартные формы",
            "Антикоррозийная обработка и порошковое окрашивание RAL",
            "Монтаж за 1–3 рабочих дня для стандартных конструкций",
            "Гарантия 10 лет на каркас и антикоррозийное покрытие",
            "Бесплатный выезд замерщика в день обращения",
            "Работаем с юрлицами и физлицами, НДС, все документы",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
              <CheckCircle size={18} className="text-gold flex-shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📐</span>
          <h3 className="text-2xl font-bold text-foreground">Как рассчитать стоимость</h3>
        </div>
        <div className="bg-muted/40 rounded-xl p-5 mb-8 max-w-4xl">
          <p className="text-muted-foreground leading-relaxed mb-3">
            Стоимость рассчитывается по площади кровли (длина × ширина). Цена указана за 1 м² готовой конструкции
            с установкой. В неё входят: металлокаркас, кровельное покрытие, антикоррозийная обработка, доставка и монтаж.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Для точного расчёта оставьте заявку — менеджер уточнит параметры и подготовит КП в течение 1 рабочего дня.
            Выезд замерщика бесплатно.
          </p>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">❓</span>
          <h3 className="text-2xl font-bold text-foreground">Часто задаваемые вопросы</h3>
        </div>
        <div className="space-y-4 max-w-4xl">
          {[
            { q: "Сколько стоит монтаж?", a: "Монтаж включён в цену за м². Дополнительно оплачивается только фундамент (если требуется) и доставка за пределы Москвы и МО." },
            { q: "Какой срок изготовления?", a: "Стандартный навес — 5–10 рабочих дней с момента оплаты аванса. Сроки уточняются при расчёте КП." },
            { q: "Нужно ли разрешение на строительство?", a: "Для навесов до 50 м² на частном участке разрешение не требуется. Для коммерческих объектов помогаем с документацией." },
            { q: "Можно заказать нестандартный размер?", a: "Да, изготавливаем по любым размерам — угловые, П-образные, арочные, с изломом кровли. Рассчитаем за 1 день." },
          ].map((item, i) => (
            <div key={i} className="border border-border rounded-lg p-4 bg-card">
              <p className="font-bold text-foreground mb-2 text-sm">{item.q}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <CategoryCallbackCTA />
    </>
  );
}
