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
                МеталлПортал производит металлические навесы с 2012 года. Собственный завод, собственный металлопрокат
                и монтажная бригада позволяют контролировать качество на каждом этапе и держать цены ниже рыночных.
                За 12 лет реализовано более 500 проектов — от навесов для одного автомобиля до промышленных
                навесных конструкций площадью до 5 000 м².
              </p>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🏠</span>
                <h3 className="text-2xl font-bold text-foreground">Навесы для любых задач</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
                Металлический навес защищает автомобили, людей и оборудование от дождя, снега, града и солнца.
                Монтируется за 1–3 дня, не требует капитального фундамента и разрешения на строительство
                в большинстве регионов России:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
                {[
                  "Навесы для автомобилей и мотоциклов — защита от осадков, снега и ультрафиолета",
                  "Навесы для веранды и террасы — расширение жилого пространства дома или дачи",
                  "Навесы для парковки — одно- и многоместные, для частных и корпоративных паркингов",
                  "Навесы для бассейна — защита от листьев, солнца, дождя и ветра",
                  "Навесы к дому у входной группы — эстетика и защита крыльца",
                  "Промышленные навесы — погрузочные доки, складские зоны, открытые цеха",
                  "Навесы для детских площадок — безопасная игровая зона в любую погоду",
                  "Навесы-беседки — крытые зоны отдыха на даче и в коттеджном посёлке",
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
                <span className="text-2xl">�</span>
                <h3 className="text-2xl font-bold text-foreground">Виды кровли для навесов</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {[
                  { title: "Поликарбонат сотовый", desc: "Лёгкий, пропускает до 80% света. Толщина 4–10 мм. Срок службы 15–20 лет." },
                  { title: "Монолитный поликарбонат", desc: "Прочнее сотового в 2 раза. Максимальная защита от УФ и осадков." },
                  { title: "Профнастил С-20, НС-35", desc: "Долговечный, бюджетный. Покрытие RAL, срок службы 25–40 лет." },
                  { title: "Металлочерепица", desc: "Имитирует натуральную черепицу. Идеально для частных домов и коттеджей." },
                  { title: "Мягкая кровля", desc: "Бесшумная при дожде. Хорошая шумоизоляция. Требует сплошной обрешётки." },
                  { title: "Сэндвич-панели", desc: "Тепло- и шумоизоляция. Для закрытых промышленных навесов." },
                ].map((m, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-4">
                    <p className="font-bold text-foreground mb-1 text-sm">{m.title}</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">{m.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚙️</span>
                <h3 className="text-2xl font-bold text-foreground">Из чего делают каркас навеса</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {[
                  "Профильная труба 40×40, 60×60, 80×80 мм — стойки и несущие балки",
                  "Профильная труба 20×40, 40×60 мм — обрешётка и прогоны кровли",
                  "Уголок стальной 50×50, 63×63 мм — усиление узлов и стыков",
                  "Листовой металл 3–6 мм — опорные пластины, фланцы, косынки",
                  "Анкерные болты М12–М20 — крепление стоек к бетонному основанию",
                  "Сварные швы МИГ/МАГ — все узлы варятся, не болтаются",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
                    <CheckCircle size={18} className="text-gold flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground leading-relaxed max-w-4xl">
                Все конструкции проходят дробеструйную очистку и покрываются грунт-эмалью или оцинковываются горячим методом.
                Финишное порошковое окрашивание в любой цвет RAL. Срок службы каркаса — <strong className="text-foreground">свыше 30 лет</strong>.
              </p>
            </section>

            <section className="mt-8">
              <div className="bg-muted/40 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💰</span>
                  <h3 className="text-xl font-bold text-foreground">Что входит в стоимость навеса</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    "Разработка эскиза и рабочего чертежа",
                    "Металлокаркас из профильной трубы по ГОСТ",
                    "Кровельное покрытие на выбор (поликарбонат / профнастил)",
                    "Антикоррозийная обработка всех элементов",
                    "Доставка на объект по всей России",
                    "Монтаж «под ключ» аттестованной бригадой",
                    "Фундаментные работы (при необходимости)",
                    "Гарантийный паспорт на 10 лет",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-1">
                      <CheckCircle size={15} className="text-gold flex-shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Расчёт точной стоимости — за <strong className="text-foreground">1 рабочий день</strong>.
                  Работаем с юридическими и физическими лицами. Полный пакет закрывающих документов, НДС.
                  Доставка по Москве, МО и всей России.
                </p>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="text-2xl font-bold text-foreground mb-4">Кто заказывает навесы</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: "🏠", title: "Частные лица", sub: "навес у дома, на даче, над гаражом или бассейном" },
                  { icon: "🏗️", title: "Строительные компании", sub: "навесы в составе комплексной застройки объектов" },
                  { icon: "🏭", title: "Промышленные предприятия", sub: "навесы над погрузочными зонами, складами, цехами" },
                  { icon: "🅿️", title: "Управляющие компании и ТСЖ", sub: "навесы для парковок жилых комплексов" },
                ].map((c, i) => (
                  <div key={i} className="flex items-start gap-4 border border-border rounded-xl p-4 bg-card">
                    <span className="text-3xl">{c.icon}</span>
                    <div>
                      <p className="font-bold text-foreground">{c.title}</p>
                      <p className="text-sm text-muted-foreground">{c.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">📋</span>
                <h3 className="text-2xl font-bold text-foreground">Как мы работаем</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { n: "01", title: "Заявка", desc: "Менеджер перезвонит за 15 минут и уточнит размеры, тип кровли и бюджет." },
                  { n: "02", title: "КП за 1 день", desc: "Коммерческое предложение с ценой, сроками и эскизом. Бесплатный выезд замерщика." },
                  { n: "03", title: "Производство", desc: "Изготовление каркаса и кровли на заводе с контролем качества." },
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
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🚚</span>
                <h3 className="text-2xl font-bold text-foreground">Доставка и монтаж по России</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-3 max-w-4xl">
                МеталлПортал доставляет навесы собственным транспортом по Москве и Московской области.
                Доставка в регионы — через транспортные компании-партнёры. Конструкции поставляются
                в разобранном виде с маркировкой элементов и монтажной схемой, либо монтируются под ключ.
              </p>
              <p className="text-muted-foreground leading-relaxed max-w-4xl">
                Работаем по всей России: Москва, Санкт-Петербург, Екатеринбург, Новосибирск, Краснодар, Казань, Ростов-на-Дону.
                Оплата наличными, банковским переводом, в рассрочку.
              </p>
            </section>

            <section className="mt-8">
              <div className="bg-muted/40 rounded-xl p-5 space-y-3">
                <h3 className="text-xl font-bold text-foreground">Почему выбирают МеталлПортал</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    "Собственный завод — цены без посредников",
                    "Металлопрокат собственного производства по ГОСТ",
                    "Монтаж за 1–3 дня для стандартных конструкций",
                    "Гарантия 10 лет на каркас и покрытие",
                    "Бесплатный выезд замерщика в день обращения",
                    "Работа с юрлицами и физлицами, НДС, все документы",
                    "Ответ менеджера — в течение 15 минут",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card/60">
                      <CheckCircle size={18} className="text-gold flex-shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">❓</span>
                <h3 className="text-2xl font-bold text-foreground">Часто задаваемые вопросы</h3>
              </div>
              <div className="space-y-4 max-w-4xl">
                {[
                  { q: "Нужно ли разрешение на строительство навеса?", a: "Для навесов до 50 м² на частном участке разрешение не требуется. Для коммерческих объектов помогаем с оформлением." },
                  { q: "Сколько времени занимает монтаж?", a: "Навес для 1 автомобиля (3×6 м) — 1 рабочий день. Парковка на 10+ мест — 3–5 дней. Крупные конструкции — по графику." },
                  { q: "Какая гарантия на навес?", a: "10 лет на сварные соединения каркаса и антикоррозийное покрытие. На кровельные материалы — по гарантии производителя (5–20 лет)." },
                  { q: "Можно ли сделать навес по нестандартным размерам?", a: "Да, изготавливаем по любым размерам — прямоугольные, П-образные, угловые, арочные. Рассчитаем за 1 день." },
                  { q: "Из какого металла делается каркас?", a: "Профильная труба по ГОСТ 30245-2003, сталь Ст3пс/сп. Стойки 60×60 или 80×80 мм. Все материалы с сертификатами." },
                  { q: "Нужен ли фундамент для навеса?", a: "Для небольших навесов достаточно точечного фундамента (бетонирование стоек). Для крупных — ленточный или свайный." },
                ].map((item, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 bg-card">
                    <p className="font-bold text-foreground mb-2 text-sm">{item.q}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
                  </div>
                ))}
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
