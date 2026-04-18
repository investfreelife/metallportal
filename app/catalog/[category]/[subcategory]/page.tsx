import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckCircle } from "lucide-react";
import CategoryCallbackCTA from "@/components/catalog/CategoryCallbackCTA";
import {
  getCategoryBySlug, getSubcategories, getCategoryWithChildren,
  getProductBySlug, getProductPriceItems, getRelatedProducts, getProductCounts, sumCounts,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import CatalogView from "@/components/catalog/CatalogView";
import CatalogCategoryCard from "@/components/catalog/CatalogCategoryCard";
import ProductDetailView from "@/components/catalog/ProductDetailView";

export const revalidate = 60;

interface Props {
  params: { category: string; subcategory: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = await getCategoryBySlug(params.subcategory);
  if (cat) return { title: `${cat.name} — купить в Москве | МеталлПортал` };
  const product = await getProductBySlug(params.subcategory);
  if (!product) return { title: "Не найдено | МеталлПортал" };
  return { title: `${product.name} цена купить в Москве | МеталлПортал` };
}

const DEDICATED_PAGES: Record<string, string> = {
  navesy: "/catalog/navesy",
  kozyrki: "/catalog/kozyrki",
};

export default async function SubcategoryPage({ params }: Props) {
  if (DEDICATED_PAGES[params.subcategory]) {
    redirect(DEDICATED_PAGES[params.subcategory]);
  }

  // Look up parent category for breadcrumbs
  const parentCategory = await getCategoryBySlug(params.category);

  // 1. Check if subcategory is a category slug
  const category = await getCategoryBySlug(params.subcategory);

  if (category) {
    const subcategories = await getSubcategories(category.id);

    // Has children → show cards
    if (subcategories.length > 0) {
      const [counts, { data: allCats }] = await Promise.all([
        getProductCounts(),
        supabase.from("categories").select("id, parent_id").eq("is_active", true),
      ]);
      const catList = allCats ?? [];
      const enriched = subcategories
        .map((sub: any) => ({
          ...sub,
          totalProducts: sumCounts(sub.id, catList, counts),
          subcategories: [],
        }));

      return (
        <div>
          <nav className="text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
            <span className="mx-2">/</span>
            <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
            <span className="mx-2">/</span>
            <Link href={`/catalog/${params.category}`} className="hover:text-gold transition-colors">
              {parentCategory?.name || params.category}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{category.name}</span>
          </nav>

          <h1 className="text-3xl font-bold text-foreground mb-2">{category.name}</h1>
          {category.description && (
            <p className="text-muted-foreground mb-8">{category.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {enriched.map((sub: any) => (
              <CatalogCategoryCard
                key={sub.id}
                name={sub.name}
                slug={sub.slug}
                icon={sub.icon}
                imageUrl={sub.image_url}
                totalProducts={sub.totalProducts}
                subcategories={sub.subcategories}
                basePath={`/catalog/${params.category}/${params.subcategory}`}
              />
            ))}
          </div>
        </div>
      );
    }

    // Leaf category → show product list
    const result = await getCategoryWithChildren(params.subcategory);
    if (result) {
      const isHozblok = params.subcategory === "navesy-s-hozblokom";
      const isAvto = params.subcategory === "navesy-dlya-avtomobilya";
      const isParkovka = params.subcategory === "navesy-dlya-parkovok";
      const isBesedka = params.subcategory === "navesy-besedki";
      return (
        <div>
          <CatalogView
            category={result.category}
            subcategories={result.subcategories}
            products={result.products}
            categorySlug={params.subcategory}
            productBasePath={`/catalog/${params.category}/${params.subcategory}`}
            defaultView={isHozblok || isAvto || isParkovka || isBesedka ? "cards" : "table"}
          />

          {isHozblok && (
            <>
              <section className="mt-16 pt-10 border-t border-border">
                <h2 className="text-3xl font-bold text-foreground mb-5">Навесы с хозблоком — МеталлПортал</h2>
                <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
                  Навес с хозблоком — это комбинированная конструкция: крытая стоянка для автомобиля и закрытое
                  подсобное помещение под одной кровлей. Одно решение заменяет отдельный гараж и хозяйственный блок.
                  Собственный завод МеталлПортал выполняет полный цикл — от проектирования до монтажа.
                </p>

                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🚗</span>
                  <h3 className="text-2xl font-bold text-foreground">Виды навесов с хозблоком</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
                  {[
                    "Арочный навес с хозблоком — плавная кровля, максимальная снеговая нагрузка",
                    "Двускатный навес с хозблоком — классический вид, высокая эстетика",
                    "Односкатный навес с хозблоком — бюджетный вариант, простой монтаж",
                    "Четырёхскатный навес с хозблоком — премиальное решение для коттеджей",
                    "Полуарочный навес с хозблоком — оригинальная форма кровли",
                    "Плоский навес с хозблоком — современный минималистичный стиль",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                      <CheckCircle size={18} className="text-gold flex-shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🔩</span>
                  <h3 className="text-2xl font-bold text-foreground">Виды кровли для навесов с хозблоком</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {[
                    { title: "Поликарбонат сотовый", desc: "От 6 500 ₽/м². Пропускает свет, лёгкий, срок службы 15–20 лет. Популярный выбор." },
                    { title: "Профнастил", desc: "От 7 200 ₽/м². Долговечный, не требует ухода 25–40 лет. Покрытие RAL любого цвета." },
                    { title: "Металлочерепица", desc: "От 7 500 ₽/м². Эстетика под черепицу. Идеально для коттеджей и частных домов." },
                    { title: "Четырёхскатная кровля", desc: "От 9 300 ₽/м². Премиальный вид, надёжная защита от осадков со всех сторон." },
                    { title: "Плоская кровля", desc: "От 11 500 ₽/м². Современный дизайн. Монолитный поликарбонат или профнастил." },
                    { title: "Арочная кровля", desc: "Из поликарбоната. Обтекаемая форма — снег не задерживается. Максимальная прочность." },
                  ].map((m, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <p className="font-bold text-foreground mb-1 text-sm">{m.title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="bg-muted/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <h3 className="text-xl font-bold text-foreground">Что входит в стоимость</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Разработка проекта и рабочего чертежа",
                      "Металлокаркас из профильной трубы по ГОСТ",
                      "Кровельное покрытие на выбор",
                      "Стены хозблока (профнастил, сэндвич-панели)",
                      "Антикоррозийная обработка и порошковое окрашивание",
                      "Доставка на объект по всей России",
                      "Монтаж «под ключ» сертифицированной бригадой",
                      "Гарантийный паспорт на 10 лет",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-1">
                        <CheckCircle size={15} className="text-gold flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Расчёт за <strong className="text-foreground">1 рабочий день</strong>.
                    Работаем с юрлицами и физлицами. Полный пакет документов, НДС.
                  </p>
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">📋</span>
                  <h3 className="text-2xl font-bold text-foreground">Как заказать навес с хозблоком</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { n: "01", title: "Заявка", desc: "Менеджер перезвонит за 15 минут, уточнит размеры, кровлю, планировку хозблока." },
                    { n: "02", title: "Проект за 1 день", desc: "КП с ценой, эскизом и 3D-визуализацией. Бесплатный выезд замерщика." },
                    { n: "03", title: "Производство", desc: "Изготовление каркаса, кровли и стен хозблока на заводе. Контроль качества." },
                    { n: "04", title: "Монтаж", desc: "Доставка и установка «под ключ». Акт выполненных работ и гарантийный паспорт." },
                  ].map((p, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <div className="text-3xl font-black text-gold/30 mb-2">{p.n}</div>
                      <p className="font-bold text-foreground mb-1">{p.title}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="bg-muted/40 rounded-xl p-5 space-y-3">
                  <h3 className="text-xl font-bold text-foreground">Почему выбирают МеталлПортал</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Собственный завод — цены без посредников",
                      "Металлопрокат собственного производства по ГОСТ",
                      "Монтаж комплекса навес + хозблок за 3–5 дней",
                      "Гарантия 10 лет на каркас и антикоррозийное покрытие",
                      "Бесплатный выезд замерщика в день обращения",
                      "Работа с юрлицами и физлицами, НДС, все документы",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card/60">
                        <CheckCircle size={18} className="text-gold flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {isAvto && (
            <>
              <section className="mt-16 pt-10 border-t border-border">
                <h2 className="text-3xl font-bold text-foreground mb-5">Навесы для автомобиля — МеталлПортал</h2>
                <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
                  МеталлПортал производит металлические навесы для автомобиля с 2012 года. Карпорты изготавливаем по
                  вашим размерам — одиночные и двухместные, на 1 или 2 автомобиля. Собственный завод,
                  монтаж «под ключ», гарантия 10 лет.
                </p>

                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🚗</span>
                  <h3 className="text-2xl font-bold text-foreground">Виды навесов для автомобиля</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
                  {[
                    "Арочный навес — плавная кровля, снег сам сскальзывает — максимальная защита",
                    "Двускатный навес — классический вид, высокая эстетика для дома",
                    "Односкатный навес — бюджетный вариант, простой быстрый монтаж",
                    "Четырёхскатный навес — премиальная защита со всех сторон",
                    "Полуарочный навес — оригинальный дизайн, гладкие линии",
                    "Плоский навес — современный минималистичный стиль",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                      <CheckCircle size={18} className="text-gold flex-shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🔩</span>
                  <h3 className="text-2xl font-bold text-foreground">Виды кровли</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {[
                    { title: "Поликарбонат сотовый", desc: "От 6 500 ₽/м². Пропускает свет, лёгкий. Снег скатывается сам. 15–20 лет." },
                    { title: "Профнастил", desc: "От 7 200 ₽/м². Надёжно защищает автомобиль, не требует ухода 25–40 лет. RAL." },
                    { title: "Металлочерепица", desc: "От 7 500 ₽/м². Эстетика под черепицу, идеально для частных домов и коттеджей." },
                    { title: "Четырёхскатная кровля", desc: "От 9 300 ₽/м². Защита автомобиля со всех сторон. Премиальный вид." },
                    { title: "Плоская кровля", desc: "От 11 500 ₽/м². Современный стиль. Монолитный поликарбонат или профнастил." },
                    { title: "Арочная кровля", desc: "Из поликарбоната. Обтекаемая форма — снег не задерживается. Максимальная прочность." },
                  ].map((m, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <p className="font-bold text-foreground mb-1 text-sm">{m.title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="bg-muted/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <h3 className="text-xl font-bold text-foreground">Что входит в стоимость</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Разработка проекта и рабочего чертежа",
                      "Металлокаркас из профильной трубы по ГОСТ",
                      "Кровельное покрытие на выбор (поликарбонат/профнастил/металлочерепица)",
                      "Антикоррозийная обработка и порошковое окрашивание",
                      "Доставка на объект по всей России",
                      "Монтаж «под ключ» сертифицированной бригадой",
                      "Гарантийный паспорт на 10 лет",
                      "Бесплатный выезд замерщика",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-1">
                        <CheckCircle size={15} className="text-gold flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Расчёт за <strong className="text-foreground">1 рабочий день</strong>. Работаем с юрлицами и физлицами. Полный пакет документов, НДС.
                  </p>
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">📋</span>
                  <h3 className="text-2xl font-bold text-foreground">Как заказать навес для автомобиля</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { n: "01", title: "Заявка", desc: "Менеджер перезвонит за 15 минут, уточнит размеры, кровлю и количество автомобилей." },
                    { n: "02", title: "Проект за 1 день", desc: "КП с ценой, эскизом и 3D-визуализацией. Бесплатный выезд замерщика." },
                    { n: "03", title: "Производство", desc: "Изготовление каркаса и кровли на заводе. Контроль качества." },
                    { n: "04", title: "Монтаж", desc: "Доставка и установка «под ключ». Акт выполненных работ и гарантийный паспорт." },
                  ].map((p, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <div className="text-3xl font-black text-gold/30 mb-2">{p.n}</div>
                      <p className="font-bold text-foreground mb-1">{p.title}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="bg-muted/40 rounded-xl p-5 space-y-3">
                  <h3 className="text-xl font-bold text-foreground">Почему выбирают МеталлПортал</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Собственный завод — цены без посредников",
                      "Металлопрокат собственного производства по ГОСТ",
                      "Монтаж навеса для автомобиля за 3–5 дней",
                      "Гарантия 10 лет на каркас и антикоррозийное покрытие",
                      "Бесплатный выезд замерщика в день обращения",
                      "Работа с юрлицами и физлицами, НДС, все документы",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card/60">
                        <CheckCircle size={18} className="text-gold flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {isBesedka && (
            <>
              <section className="mt-16 pt-10 border-t border-border">
                <h2 className="text-3xl font-bold text-foreground mb-5">Навес-беседка — МеталлПортал</h2>
                <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
                  МеталлПортал производит навесы-беседки на металлическом каркасе с декоративными элементами.
                  Подходят для дачных участков, частных домов, коттеджей, кафе и зон отдыха. Собственный завод,
                  монтаж «под ключ», гарантия 10 лет.
                </p>

                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🌿</span>
                  <h3 className="text-2xl font-bold text-foreground">Виды навесов-беседок</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
                  {[
                    "Арочный навес — плавная кровля, снег сам сскальзывает, максимальная защита",
                    "Двускатный навес — классический вид беседки, высокая эстетика",
                    "Односкатный навес — бюджетный вариант, быстрый монтаж",
                    "Четырёхскатный навес — премиум, защита со всех сторон",
                    "Полуарочный навес — оригинальный дизайн, гладкие линии",
                    "Плоский навес — современный минималистичный стиль",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                      <CheckCircle size={18} className="text-gold flex-shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🔩</span>
                  <h3 className="text-2xl font-bold text-foreground">Виды кровли</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {[
                    { title: "Поликарбонат сотовый", desc: "От 6 500 ₽/м². Пропускает свет, лёгкий, снег скатывается сам. 15–20 лет." },
                    { title: "Профнастил", desc: "От 7 200 ₽/м². Надёжный, не требует ухода. 25–40 лет. Любой цвет RAL." },
                    { title: "Металлочерепица", desc: "От 7 500 ₽/м². Эстетика под черепицу, идеально для коттеджей и дач." },
                    { title: "Четырёхскатная", desc: "От 9 300 ₽/м². Премиальный вид. Самая эффектная защита от осадков." },
                    { title: "Плоская кровля", desc: "От 11 500 ₽/м². Современный стиль. Монолитный поликарбонат." },
                    { title: "Декоративная ковка", desc: "Цветное порошковое окрашивание RAL. Металлические декоративные элементы." },
                  ].map((m, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <p className="font-bold text-foreground mb-1 text-sm">{m.title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="bg-muted/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <h3 className="text-xl font-bold text-foreground">Что входит в стоимость</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Разработка проекта и рабочего чертежа",
                      "Металлокаркас с декоративными элементами по ГОСТ",
                      "Кровельное покрытие на выбор (поликарбонат/профнастил/металлочерепица)",
                      "Антикоррозийная обработка и порошковое окрашивание",
                      "Доставка на объект по всей России",
                      "Монтаж «под ключ» сертифицированной бригадой",
                      "Гарантийный паспорт на 10 лет",
                      "Бесплатный выезд замерщика",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-1">
                        <CheckCircle size={15} className="text-gold flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Расчёт за <strong className="text-foreground">1 рабочий день</strong>. Работаем с юрлицами и физлицами. Полный пакет документов, НДС.
                  </p>
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">📋</span>
                  <h3 className="text-2xl font-bold text-foreground">Как заказать навес-беседку</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { n: "01", title: "Заявка", desc: "Менеджер перезвонит за 15 минут, уточнит размеры, вид кровли и декор." },
                    { n: "02", title: "Проект за 1 день", desc: "КП с ценой, эскизом и 3D-визуализацией. Бесплатный выезд замерщика." },
                    { n: "03", title: "Производство", desc: "Изготовление каркаса и кровли на заводе. Контроль качества." },
                    { n: "04", title: "Монтаж", desc: "Доставка и установка «под ключ». Акт и гарантийный паспорт." },
                  ].map((p, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <div className="text-3xl font-black text-gold/30 mb-2">{p.n}</div>
                      <p className="font-bold text-foreground mb-1">{p.title}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="bg-muted/40 rounded-xl p-5 space-y-3">
                  <h3 className="text-xl font-bold text-foreground">Почему выбирают МеталлПортал</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Собственный завод — цены без посредников",
                      "Металлопрокат собственного производства по ГОСТ",
                      "Декоративные элементы из металла по вашему эскизу",
                      "Гарантия 10 лет на каркас и покрытие",
                      "Бесплатный выезд замерщика в день обращения",
                      "Работа с юрлицами и физлицами, НДС, все документы",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card/60">
                        <CheckCircle size={18} className="text-gold flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {isParkovka && (
            <>
              <section className="mt-16 pt-10 border-t border-border">
                <h2 className="text-3xl font-bold text-foreground mb-5">Навесы для парковок — МеталлПортал</h2>
                <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
                  МеталлПортал проектирует и производит навесы для открытых парковок любой вместимости — от 5 до 500
                  машино-мест. Металлический каркас по ГОСТ, кровля из поликарбоната, профнастила или металлочерепицы.
                  Монтаж «под ключ», гарантия 10 лет, проектная документация.
                </p>

                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🅿️</span>
                  <h3 className="text-2xl font-bold text-foreground">Виды навесов для парковок</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
                  {[
                    "Односкатный навес — бюджетный вариант для небольших парковок",
                    "Двускатный навес — классика, отличный водоотвод с обеих сторон",
                    "Арочный навес — снег сам сскальзывает, максимальная защита кузова",
                    "Консольный навес — без опор внутри, удобный въезд и разворот",
                    "Четырёхскатный навес — защита со всех сторон, премиум-сегмент",
                    "Плоский навес — современный стиль для бизнес-центров и ТЦ",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                      <CheckCircle size={18} className="text-gold flex-shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🔩</span>
                  <h3 className="text-2xl font-bold text-foreground">Виды кровли</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {[
                    { title: "Поликарбонат сотовый", desc: "От 6 500 ₽/м². Пропускает свет. Снег скатывается сам. Срок службы 15–20 лет." },
                    { title: "Профнастил", desc: "От 7 200 ₽/м². Надёжный, лёгкий уход. 25–40 лет. Любой цвет RAL." },
                    { title: "Металлочерепица", desc: "От 7 500 ₽/м². Эстетичный вид для коммерческих объектов и жилых комплексов." },
                    { title: "Консольная система", desc: "От 10 000 ₽/м². Без промежуточных опор — удобный въезд и манёвр." },
                    { title: "Четырёхскатная", desc: "От 9 300 ₽/м². Защита со всех сторон. Подходит для VIP-парковок." },
                    { title: "Плоская кровля", desc: "От 11 500 ₽/м². Современный стиль. Монолитный поликарбонат или профнастил." },
                  ].map((m, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <p className="font-bold text-foreground mb-1 text-sm">{m.title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="bg-muted/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <h3 className="text-xl font-bold text-foreground">Что входит в стоимость</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Разработка проекта и рабочей документации",
                      "Металлокаркас из профильной трубы по ГОСТ",
                      "Кровельное покрытие на выбор",
                      "Антикоррозийная обработка и порошковое окрашивание",
                      "Доставка на объект по всей России",
                      "Монтаж «под ключ» сертифицированной бригадой",
                      "Гарантийный паспорт на 10 лет",
                      "Бесплатный выезд на объект и замер",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-1">
                        <CheckCircle size={15} className="text-gold flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Расчёт за <strong className="text-foreground">1 рабочий день</strong>. Проектная документация. Работаем с юрлицами, НДС, все документы.
                  </p>
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">📋</span>
                  <h3 className="text-2xl font-bold text-foreground">Как заказать навес для парковки</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { n: "01", title: "Заявка", desc: "Менеджер перезвонит за 15 минут и уточнит число машино-мест, кровлю и сроки." },
                    { n: "02", title: "Проект за 1 день", desc: "КП с ценой, схемой расстановки и проектной документацией." },
                    { n: "03", title: "Производство", desc: "Изготовление каркаса и кровли на заводе. Контроль качества." },
                    { n: "04", title: "Монтаж", desc: "Доставка и установка «под ключ». Акт и гарантийный паспорт на 10 лет." },
                  ].map((p, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <div className="text-3xl font-black text-gold/30 mb-2">{p.n}</div>
                      <p className="font-bold text-foreground mb-1">{p.title}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <div className="bg-muted/40 rounded-xl p-5 space-y-3">
                  <h3 className="text-xl font-bold text-foreground">Почему выбирают МеталлПортал</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      "Собственный завод — цены без посредников",
                      "Опыт строительства парковочных навесов с 2012 года",
                      "Консольные системы без опор внутри парковки",
                      "Гарантия 10 лет на каркас и антикоррозийное покрытие",
                      "Проектная документация и согласование",
                      "Работа с юрлицами, НДС, полный пакет документов",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card/60">
                        <CheckCircle size={18} className="text-gold flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          <CategoryCallbackCTA />
        </div>
      );
    }
  }

  // 2. Check if subcategory is a product slug
  const product = await getProductBySlug(params.subcategory);
  if (product) {
    const [priceItems, related] = await Promise.all([
      getProductPriceItems(product.id),
      getRelatedProducts(product.category_id, product.id, 6),
    ]);
    return (
      <ProductDetailView
        product={product}
        priceItems={priceItems}
        related={related}
        basePath={`/catalog/${params.category}`}
      />
    );
  }

  return notFound();
}
