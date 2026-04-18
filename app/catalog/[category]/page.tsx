import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getSubcategories, getCategoryWithChildren, getProductCounts, sumCounts } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import CatalogView from "@/components/catalog/CatalogView";
import CatalogCategoryCard from "@/components/catalog/CatalogCategoryCard";
import { CheckCircle } from "lucide-react";

export const revalidate = 60;

interface Props {
  params: { category: string };
}

export default async function CategoryPage({ params }: Props) {
  const category = await getCategoryBySlug(params.category);
  if (!category) return notFound();

  const subcategories = await getSubcategories(category.id);

  // If category has subcategories → show cards
  if (subcategories.length > 0) {
    const [counts, { data: allCats }] = await Promise.all([
      getProductCounts(),
      supabase.from("categories").select("id, parent_id").eq("is_active", true),
    ]);
    const catList = allCats ?? [];

    // For each subcategory, get its children (Level 3) with recursive counts
    const enriched = await Promise.all(
      subcategories.map(async (sub: any) => {
        const children = await getSubcategories(sub.id);
        return {
          ...sub,
          totalProducts: sumCounts(sub.id, catList, counts),
          subcategories: children.map((c: any) => ({
            ...c,
            totalProducts: sumCounts(c.id, catList, counts),
            productCount: counts[c.id] || 0,
          })),
        };
      })
    );

    return (
      <div>
        <nav className="text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
          <span className="mx-2">/</span>
          <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
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
              basePath={`/catalog/${params.category}`}
            />
          ))}
        </div>

        {params.category === "gotovye-konstruktsii" && (
          <>
            <section className="mt-16 pt-10 border-t border-border">
              <h2 className="text-3xl font-bold text-foreground mb-5">Готовые металлоконструкции — МеталлПортал</h2>
              <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
                МеталлПортал производит и поставляет готовые металлоконструкции для строительства промышленных,
                коммерческих и сельскохозяйственных объектов по всей России. Полный цикл — от проектирования до монтажа под ключ.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🏗️</span>
                <h3 className="text-2xl font-bold text-foreground">Что мы производим</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
                {[
                  "Ангары арочные и каркасные — пролёт 6–60 м",
                  "Навесы для автомобилей, веранд и входных групп",
                  "Склады и производственные цеха под ключ",
                  "Каркасы зданий — жилые и коммерческие",
                  "Сетчатые и сварные ограждения периметра",
                  "Ворота откатные, распашные, секционные",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                    <CheckCircle size={18} className="text-gold flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="bg-muted/40 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <h3 className="text-xl font-bold text-foreground">Сроки и гарантии</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Типовой ангар 18×36 м монтируется за <strong className="text-foreground">5 рабочих дней</strong>.
                  Все конструкции покрыты грунт-эмалью или оцинкованы горячим методом.
                  Гарантия на сварные швы и антикоррозийное покрытие — <strong className="text-foreground">10 лет</strong>.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Расчёт стоимости и КП — в течение 1 рабочего дня. Доставка по России собственным транспортом.
                  Работаем с юридическими и физическими лицами, полный пакет документов.
                </p>
              </div>
            </section>
          </>
        )}

        {params.category === "navesy" && (
          <>
            <section className="mt-16 pt-10 border-t border-border">
              <h2 className="text-3xl font-bold text-foreground mb-5">Металлические навесы на заказ — МеталлПортал</h2>
              <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
                МеталлПортал изготавливает и устанавливает металлические навесы любой сложности. Собственное производство,
                стальной каркас из профильной трубы, кровля из поликарбоната, профнастила или металлочерепицы.
                Гарантия качества. Монтаж под ключ.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🏠</span>
                <h3 className="text-2xl font-bold text-foreground">Виды навесов по материалу кровли</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
                {[
                  "Поликарбонат — прочный, лёгкий, пропускает свет",
                  "Профнастил — долговечный, защита от влаги и снега",
                  "Металлочерепица — красота и прочность в одном решении",
                  "Монолитный поликарбонат — максимум защиты от УФ и осадков",
                  "Мягкая кровля — комфорт и надёжная защита от осадков",
                  "Сэндвич-панели — тепло- и шумоизоляция для закрытых зон",
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
                <span className="text-2xl">🚗</span>
                <h3 className="text-2xl font-bold text-foreground">Готовые решения</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                {[
                  "Навесы для парковки автомобилей — защита от осадков и солнца",
                  "Навесы для бассейна — уютная зона у воды в любую погоду",
                  "Навесы для веранды — дополнительное жилое пространство",
                  "Навесы для игровых площадок — безопасный отдых детей",
                  "Архитектурные навесы — вписываются в стиль дома или офиса",
                  "Промышленные навесы — для складов, цехов и погрузочных зон",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                    <CheckCircle size={18} className="text-gold flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
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
                <p className="text-muted-foreground leading-relaxed">
                  В стоимость навеса входит: <strong className="text-foreground">стальной каркас</strong> из профильной
                  трубы на сварных стойках, высококачественное покрытие кровли (поликарбонат 3–5 мм или профнастил),
                  антикоррозийная обработка и порошковое окрашивание в цвет RAL по выбору.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Экспертный монтаж от специалистов. Расчёт КП за 1 рабочий день. Доставка и установка по всей России.
                  Работаем с юридическими и физическими лицами, полный пакет документов.
                </p>
              </div>
            </section>
          </>
        )}

        {params.category === "metalloprokat" && (
          <>
            <section className="mt-16 pt-10 border-t border-border">
              <h2 className="text-3xl font-bold text-foreground mb-5">Металлопрокат оптом и в розницу — МеталлПортал</h2>
              <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
                МеталлПортал — крупный поставщик металлопроката для частных лиц, строительных компаний и промышленных
                предприятий по всей России. Прямые договоры с заводами-производителями позволяют предлагать металл
                оптом и в розницу по конкурентным ценам без посредников. Вся продукция соответствует ГОСТ.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">📦</span>
                <h3 className="text-2xl font-bold text-foreground">Что входит в ассортимент</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
                В постоянном наличии на складе — наиболее востребованные виды проката:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
                {[
                  "Арматура А500С, А240 — диаметры от 6 до 40 мм",
                  "Трубы стальные — круглые, профильные, электросварные, бесшовные",
                  "Листовой металл — горячекатаный, холоднокатаный, оцинкованный",
                  "Балки и швеллеры — двутавр, швеллер по ГОСТ",
                  "Сортовой прокат — уголок, круг, полоса, шестигранник",
                  "Метизы — болты, гайки, шпильки, анкеры",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                    <CheckCircle size={18} className="text-gold flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="bg-muted/40 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏭</span>
                  <h3 className="text-xl font-bold text-foreground">Склад и отгрузка</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  На складе единовременно хранится <strong className="text-foreground">свыше 8 000 тонн проката</strong> —
                  чёрный металл, цветные металлы и металлосплавы. Подтверждение и комплектация заказа — не более нескольких часов.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  При покупке оптом действует гибкая система скидок. Работаем с юридическими лицами (с НДС) и
                  физическими лицами — от одного листа или прутка. Резка в размер, доставка по России.
                </p>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚙️</span>
                <h3 className="text-2xl font-bold text-foreground">Услуги по обработке металла</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "Резка в размер — гильотина, плазма, газокислород",
                  "Гибка листа и профиля на вальцах",
                  "Сварка конструкций — MIG/MAG, аргон",
                  "Дробеструйная и антикоррозийная обработка",
                  "Порошковое окрашивание — любой цвет RAL",
                  "Оцинкование горячим методом и холодным цинком",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                    <CheckCircle size={18} className="text-gold flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  // Leaf category — show product list
  const result = await getCategoryWithChildren(params.category);
  if (!result) return notFound();

  return (
    <CatalogView
      category={result.category}
      subcategories={result.subcategories}
      products={result.products}
      categorySlug={params.category}
      productBasePath={`/catalog/${params.category}`}
    />
  );
}
