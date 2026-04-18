import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { getSubcategories, getCategoryBySlug, getProductCounts, sumCounts } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import CatalogCategoryCard from "@/components/catalog/CatalogCategoryCard";
import PhotoEditable from "@/components/admin/PhotoEditable";

export const revalidate = 60;

export const metadata = {
  title: "Навесы металлические на заказ — изготовление и монтаж | МеталлПортал",
  description:
    "Металлические навесы на заказ: для автомобиля, веранды, парковки, бассейна. Каркас из профтрубы, кровля из поликарбоната или профнастила. Монтаж под ключ, гарантия 10 лет. Расчёт за 1 день.",
};

export default async function NavesyPage() {
  const category = await getCategoryBySlug("navesy");
  const subcategories = category ? await getSubcategories(category.id) : [];

  const [counts, { data: allCats }] = await Promise.all([
    getProductCounts(),
    supabase.from("categories").select("id, parent_id").eq("is_active", true),
  ]);
  const catList = allCats ?? [];
  const enriched = subcategories.map((sub: any) => ({
    ...sub,
    totalProducts: sumCounts(sub.id, catList, counts),
    subcategories: [],
  }));

  return (
    <div>
      {/* Breadcrumbs */}
      <nav className="text-sm text-muted-foreground mb-4">
        <Link href="/" className="hover:text-gold transition-colors">Главная</Link>
        <span className="mx-2">/</span>
        <Link href="/catalog" className="hover:text-gold transition-colors">Каталог</Link>
        <span className="mx-2">/</span>
        <Link href="/catalog/gotovye-konstruktsii" className="hover:text-gold transition-colors">Готовые конструкции</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Навесы</span>
      </nav>

      <h1 className="text-3xl font-bold text-foreground mb-2">Металлические навесы на заказ</h1>
      <p className="text-muted-foreground mb-8 max-w-3xl">
        Изготовление и монтаж металлических навесов любой сложности. Каркас из профильной трубы,
        кровля — поликарбонат, профнастил или металлочерепица. Собственное производство, гарантия 10 лет.
      </p>

      {/* Catalog grid — screenshot style */}
      {enriched.length > 0 && (
        <div className="mb-16">
          <h2 className="text-5xl lg:text-6xl font-black text-foreground leading-none mb-8">
            каталог<br />навесов
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {enriched.map((sub: any) => (
              <Link
                key={sub.id}
                href={`/catalog/navesy/${sub.slug}`}
                className="group block"
              >
                <PhotoEditable
                  photoId={`category:${sub.slug}`}
                  dimensions="400×280"
                  className="w-full aspect-[4/3] bg-muted rounded overflow-hidden mb-2 flex items-center justify-center"
                >
                  {sub.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="text-4xl opacity-20">🏠</span>
                  )}
                </PhotoEditable>
                <p className="text-sm font-medium text-foreground group-hover:text-gold transition-colors">{sub.name}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* SEO 1 — Overview */}
      <section className="border-t border-border pt-10 mb-10">
        <h2 className="text-3xl font-bold text-foreground mb-5">Металлические навесы на заказ — МеталлПортал</h2>
        <p className="text-muted-foreground leading-relaxed mb-10 max-w-4xl">
          МеталлПортал производит металлические навесы с 2012 года. Собственный завод, собственный металлопрокат
          и монтажная бригада позволяют контролировать качество на каждом этапе и держать цены ниже рыночных.
          За 12 лет реализовано более 500 проектов — от навесов для одного автомобиля до крупных промышленных
          навесных конструкций площадью до 5 000 м².
        </p>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🏠</span>
          <h3 className="text-2xl font-bold text-foreground">Навесы для любых задач</h3>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
          Металлический навес — универсальная конструкция из стального каркаса с кровельным покрытием,
          которая защищает автомобили, людей и оборудование от дождя, снега, града и солнца.
          Монтируется за 1–3 дня, не требует капитального фундамента и разрешения на строительство
          в большинстве регионов России:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
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

        <div className="bg-muted/40 rounded-xl p-5 space-y-3">
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Навесы из поликарбоната</strong> — самый популярный вид.
            Сотовый поликарбонат толщиной 6–10 мм пропускает до 80% света, выдерживает снеговую нагрузку
            до 150 кг/м² и не желтеет 15–20 лет благодаря УФ-защитному слою.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Навесы из профнастила</strong> служат 25–40 лет без ухода.
            Профилированный лист с полимерным покрытием доступен в более 30 цветах RAL —
            навес идеально вписывается в архитектуру любого здания.
          </p>
        </div>
      </section>

      {/* SEO 2 — Roofing */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔩</span>
          <h3 className="text-2xl font-bold text-foreground">Виды кровли для навесов</h3>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
          Правильный выбор кровельного материала определяет долговечность, внешний вид и функциональность.
          Подберём оптимальный вариант под бюджет и задачи:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { title: "Поликарбонат сотовый", desc: "Лёгкий, пропускает до 80% света. Толщина 4–10 мм. Для частных навесов и веранд. Срок службы 15–20 лет." },
            { title: "Монолитный поликарбонат", desc: "Максимальная защита от УФ и осадков. Прочнее сотового в 2 раза. Для архитектурных и коммерческих объектов." },
            { title: "Профнастил С-20, НС-35", desc: "Долговечный, бюджетный. Оцинкованный или с полимерным покрытием RAL. Срок службы 25–40 лет." },
            { title: "Металлочерепица", desc: "Имитирует натуральную черепицу. Высокая эстетика. Идеально для навесов у частных домов и коттеджей." },
            { title: "Мягкая кровля", desc: "Гибкая черепица или рубероид. Бесшумная при дожде. Хорошая шумоизоляция. Требует сплошной обрешётки." },
            { title: "Сэндвич-панели", desc: "Тепло- и шумоизоляция одновременно. Для закрытых промышленных навесов в холодных регионах." },
          ].map((m, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-bold text-foreground mb-1 text-sm">{m.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEO 3 — Frame */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚙️</span>
          <h3 className="text-2xl font-bold text-foreground">Из чего делают каркас навеса</h3>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
          Несущий каркас — основа долговечного навеса. Мы используем стальной прокат собственного
          производства: профильную трубу, уголок, листовой металл по ГОСТ. Это снижает стоимость
          и гарантирует качество каждой детали.
        </p>
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
          Все конструкции проходят дробеструйную очистку и покрываются грунт-эмалью или оцинковываются
          горячим методом. Финишное порошковое окрашивание в любой цвет RAL — по желанию.
          Срок службы каркаса — <strong className="text-foreground">свыше 30 лет</strong>.
        </p>
      </section>

      {/* SEO 4 — What's included */}
      <section className="mb-10">
        <div className="bg-muted/40 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <h3 className="text-xl font-bold text-foreground">Что входит в стоимость навеса</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Цена зависит от габаритов, кровельного материала, наличия ворот и отделки.
            Работаем прозрачно — в стоимость включено всё необходимое:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "Разработка эскиза и рабочего чертежа",
              "Металлокаркас из профильной трубы по ГОСТ",
              "Кровельное покрытие на выбор (поликарбонат / профнастил)",
              "Антикоррозийная обработка всех металлических элементов",
              "Доставка на объект по всей России",
              "Монтаж «под ключ» аттестованной бригадой",
              "Фундаментные работы (при необходимости)",
              "Гарантийный паспорт на 10 лет",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <CheckCircle size={16} className="text-gold flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Расчёт точной стоимости — за <strong className="text-foreground">1 рабочий день</strong>.
            Работаем с юридическими и физическими лицами. Полный пакет закрывающих документов, НДС.
          </p>
        </div>
      </section>

      {/* SEO 5 — Clients */}
      <section className="mb-10">
        <h3 className="text-2xl font-bold text-foreground mb-4">Кто заказывает навесы</h3>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Работаем без ограничений по масштабу — одинаково ответственно подходим к небольшому частному
          заказу и к крупному корпоративному проекту:
        </p>
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

      {/* SEO 6 — Process */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📋</span>
          <h3 className="text-2xl font-bold text-foreground">Как мы работаем</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { n: "01", title: "Заявка", desc: "Позвоните или напишите. Менеджер перезвонит за 15 минут и уточнит размеры, тип кровли и бюджет." },
            { n: "02", title: "КП за 1 день", desc: "Коммерческое предложение с ценой, сроками и эскизом. Бесплатный выезд замерщика на объект." },
            { n: "03", title: "Производство", desc: "Изготовление каркаса и кровельного покрытия на заводе. Контроль качества на каждом этапе." },
            { n: "04", title: "Монтаж", desc: "Доставка и установка «под ключ». Акт выполненных работ и гарантийный паспорт на 10 лет." },
          ].map((p, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <div className="text-3xl font-black text-gold/30 mb-2">{p.n}</div>
              <h3 className="font-bold text-foreground mb-1">{p.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEO 7 — Delivery */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">�</span>
          <h3 className="text-2xl font-bold text-foreground">Доставка и монтаж навесов по России</h3>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-3 max-w-4xl">
          МеталлПортал доставляет навесы собственным транспортом по Москве и Московской области —
          прямо с завода до вашего объекта. Стоимость доставки зависит от объёма конструкции
          и удалённости от МКАД.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-3 max-w-4xl">
          Доставка в регионы России — через транспортные компании-партнёры. Конструкции поставляются
          в разобранном виде с маркировкой элементов и монтажной схемой, либо силами нашей
          монтажной бригады — под ключ.
        </p>
        <p className="text-muted-foreground leading-relaxed max-w-4xl">
          Работаем по всей России: Москва, Санкт-Петербург, Екатеринбург, Новосибирск, Краснодар,
          Казань, Ростов-на-Дону и другие регионы. Оплата наличными, банковским переводом, в рассрочку.
        </p>
      </section>

      {/* SEO 8 — Why us */}
      <section className="mb-10" style={{ background: "rgba(245,230,180,0.1)", borderRadius: "1rem", padding: "1.5rem" }}>
        <h3 className="text-2xl font-bold text-foreground text-center mb-6">Почему выбирают МеталлПортал</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
          {[
            "Собственный завод — цены без посредников",
            "Металлопрокат собственного производства — ГОСТ",
            "Монтаж за 1–3 дня для стандартных конструкций",
            "Гарантия 10 лет на каркас и антикоррозийное покрытие",
            "Бесплатный выезд замерщика в день обращения",
            "Работа с юридическими и физическими лицами, НДС",
            "Ответ менеджера — в течение 15 минут",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card/60">
              <CheckCircle size={18} className="text-gold flex-shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">❓</span>
          <h3 className="text-2xl font-bold text-foreground">Часто задаваемые вопросы</h3>
        </div>
        <div className="space-y-4 max-w-4xl">
          {[
            {
              q: "Нужно ли разрешение на строительство навеса?",
              a: "Для навесов площадью до 50 м² на частном участке разрешение не требуется. Для промышленных и коммерческих объектов помогаем с оформлением документации.",
            },
            {
              q: "Сколько времени занимает монтаж?",
              a: "Навес для 1 автомобиля (3×6 м) монтируется за 1 рабочий день. Навес для парковки на 10+ машин — за 3–5 дней. Крупные промышленные конструкции — по графику.",
            },
            {
              q: "Какая гарантия на навес?",
              a: "10 лет на сварные соединения каркаса и антикоррозийное покрытие. На кровельные материалы — по гарантии производителя (5–20 лет).",
            },
            {
              q: "Можно ли сделать навес по нестандартным размерам?",
              a: "Да, изготавливаем по любым размерам и конфигурациям — прямоугольные, П-образные, угловые, арочные. Пришлите эскиз или опишите задачу — рассчитаем за 1 день.",
            },
            {
              q: "Из какого металла делается каркас?",
              a: "Профильная труба стальная по ГОСТ 30245-2003, сталь Ст3пс/сп. Стойки 60×60 или 80×80 мм, балки 40×60 мм. Все материалы с сертификатами качества.",
            },
            {
              q: "Нужен ли фундамент для навеса?",
              a: "Для небольших навесов достаточно точечного фундамента (бетонирование стоек). Для крупных конструкций выполняем ленточный или свайный фундамент — в зависимости от грунта.",
            },
          ].map((item, i) => (
            <div key={i} className="border border-border rounded-lg p-4 bg-card">
              <h3 className="font-bold text-foreground mb-2 text-sm">{item.q}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
