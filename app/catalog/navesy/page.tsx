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

      {/* SEO Section 1 */}
      <section className="border-t border-border pt-10 mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🏠</span>
          <h2 className="text-2xl font-bold text-foreground">Навесы металлические — виды и назначение</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
          Металлический навес — универсальная конструкция из стального каркаса с кровельным покрытием,
          которая защищает людей, автомобили, оборудование и зоны отдыха от дождя, снега и солнца.
          В отличие от капитальных построек, навес монтируется за 1–3 дня и не требует разрешения на строительство
          в большинстве регионов России.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {[
            "Навесы для автомобилей — защита от осадков, снега и ультрафиолета",
            "Навесы для веранды — расширение жилого пространства дома или дачи",
            "Навесы для парковки — одно- и многоместные, для частных и корпоративных паркингов",
            "Навесы для бассейна — защита от листьев, солнца, дождя",
            "Навесы для крыльца и входной группы — эстетика и защита входа",
            "Промышленные навесы — для погрузочных доков, складских зон, цехов",
            "Навесы для детских площадок — безопасная игровая зона в любую погоду",
            "Архитектурные навесы — дизайнерские решения для офисов и торговых центров",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
              <CheckCircle size={18} className="text-gold flex-shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SEO Section 2 — Roofing materials */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔩</span>
          <h2 className="text-2xl font-bold text-foreground">Виды кровли для навесов</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
          Правильный выбор кровельного материала определяет долговечность, внешний вид и функциональность навеса.
          Мы работаем со всеми основными материалами и поможем подобрать оптимальный вариант под ваш бюджет и задачи.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            {
              title: "Поликарбонат сотовый",
              desc: "Лёгкий, пропускает свет. Толщина 4–10 мм. Идеален для частных навесов и веранд. Срок службы 15–20 лет.",
            },
            {
              title: "Монолитный поликарбонат",
              desc: "Максимальная защита от УФ и осадков. Прочнее сотового в 2 раза. Для архитектурных и коммерческих объектов.",
            },
            {
              title: "Профнастил",
              desc: "Долговечный, бюджетный. Оцинкованный или с полимерным покрытием. Цвет по RAL. Не пропускает свет.",
            },
            {
              title: "Металлочерепица",
              desc: "Имитирует черепицу, придаёт эстетику. Подходит для навесов при частных домах и коттеджах.",
            },
            {
              title: "Мягкая кровля",
              desc: "Гибкая черепица или рубероид. Бесшумная, хорошая шумоизоляция. Требует обрешётки.",
            },
            {
              title: "Сэндвич-панели",
              desc: "Тепло- и шумоизоляция. Для закрытых промышленных навесов и стоянок в холодных регионах.",
            },
          ].map((m, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-bold text-foreground mb-1 text-sm">{m.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEO Section 3 — Construction */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚙️</span>
          <h2 className="text-2xl font-bold text-foreground">Из чего делают каркас навеса</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6 max-w-4xl">
          Несущий каркас — основа долговечного навеса. Мы используем только стальной прокат собственного
          производства, что позволяет снизить стоимость и гарантировать качество металла.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {[
            "Профильная труба 40×40, 60×60, 80×80 мм — для стоек и балок",
            "Профильная труба 20×40, 40×60 мм — для обрешётки и прогонов",
            "Уголок стальной 50×50, 63×63 мм — для усиления узлов",
            "Листовой металл 3–6 мм — для опорных пластин и фланцев",
            "Анкерные болты М12–М20 — для крепления стоек к фундаменту",
            "Сварные швы МИГ/МАГ — все узлы свариваются, а не болтаются",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
              <CheckCircle size={18} className="text-gold flex-shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground leading-relaxed max-w-4xl">
          Все металлоконструкции проходят дробеструйную очистку и покрываются грунт-эмалью или оцинковываются
          горячим методом. По желанию — финишное порошковое окрашивание в любой цвет RAL. Это обеспечивает
          срок службы каркаса <strong className="text-foreground">свыше 30 лет</strong> даже в условиях агрессивной среды.
        </p>
      </section>

      {/* SEO Section 4 — Price & What's included */}
      <section className="mb-10">
        <div className="bg-muted/40 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <h2 className="text-xl font-bold text-foreground">Что входит в стоимость навеса</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Цена навеса зависит от габаритов, типа кровли, наличия ворот и отделки. Мы работаем прозрачно —
            в стоимость включено всё необходимое для готового объекта:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "Разработка эскиза и рабочего чертежа",
              "Металлокаркас из профильной трубы",
              "Кровельное покрытие (поликарбонат / профнастил)",
              "Антикоррозийная обработка всех элементов",
              "Доставка на объект по Москве и МО",
              "Монтаж «под ключ» сертифицированной бригадой",
              "Фундаментные работы (при необходимости)",
              "Гарантийный документ на 10 лет",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <CheckCircle size={16} className="text-gold flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Расчёт точной стоимости — за <strong className="text-foreground">1 рабочий день</strong> после
            предоставления размеров и пожеланий. Работаем с юридическими и физическими лицами,
            полный пакет закрывающих документов.
          </p>
        </div>
      </section>

      {/* SEO Section 5 — How we work */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📋</span>
          <h2 className="text-2xl font-bold text-foreground">Как заказать навес</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { n: "01", title: "Заявка", desc: "Позвоните или оставьте заявку на сайте. Менеджер перезвонит за 15 минут и уточнит детали." },
            { n: "02", title: "КП за 1 день", desc: "Подготовим коммерческое предложение с ценой, сроками и эскизом навеса." },
            { n: "03", title: "Изготовление", desc: "Производство каркаса и кровли на нашем заводе. Контроль качества на каждом этапе." },
            { n: "04", title: "Монтаж", desc: "Доставка и установка навеса «под ключ». Сдача объекта с подписанием акта и гарантийного паспорта." },
          ].map((p, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <div className="text-3xl font-black text-gold/30 mb-2">{p.n}</div>
              <h3 className="font-bold text-foreground mb-1">{p.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEO Section 6 — Long text */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📌</span>
          <h2 className="text-2xl font-bold text-foreground">Металлические навесы — МеталлПортал</h2>
        </div>
        <div className="space-y-4 max-w-4xl">
          <p className="text-muted-foreground leading-relaxed">
            МеталлПортал изготавливает металлические навесы с 2012 года. За это время мы реализовали
            более 500 проектов — от простых автомобильных козырьков до крупных промышленных навесных сооружений
            площадью до 5 000 м². Собственный завод, собственный прокат и монтажная бригада позволяют
            контролировать качество на каждом этапе и держать цены ниже рыночных.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Навесы из поликарбоната</strong> — самый популярный вид.
            Сотовый поликарбонат толщиной 6–10 мм пропускает до 80% света, выдерживает снеговую нагрузку
            и не желтеет в течение 15–20 лет благодаря защитному слою от ультрафиолета. Мы используем
            только сертифицированный поликарбонат российского и европейского производства.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Навесы из профнастила</strong> выбирают за долговечность и
            низкую цену. Профилированный лист с полимерным покрытием служит 25–40 лет без ухода,
            не требует окраски и выдерживает любые климатические условия. Доступен в более 30 цветах RAL,
            что позволяет вписать навес в архитектуру любого здания.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Навесы для автомобилей</strong> — один из самых востребованных
            продуктов нашего каталога. Стандартный навес на 1 автомобиль (3×6 м) устанавливается за 1 день
            без фундаментных работ. Двускатная или односкатная кровля, открытые стойки или с боковыми экранами —
            конфигурация под ваши требования.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Работаем по всей России: Москва, Санкт-Петербург, Екатеринбург, Новосибирск и другие регионы.
            Доставка собственным транспортом. Полный пакет документов для юридических лиц.
            Оплата наличными, банковским переводом, в рассрочку.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">❓</span>
          <h2 className="text-2xl font-bold text-foreground">Часто задаваемые вопросы</h2>
        </div>
        <div className="space-y-4 max-w-4xl">
          {[
            {
              q: "Нужно ли разрешение на строительство навеса?",
              a: "Для большинства навесов площадью до 50 м² на частном участке разрешение не требуется. Для промышленных и коммерческих объектов мы помогаем с оформлением документации.",
            },
            {
              q: "Сколько времени занимает монтаж?",
              a: "Стандартный навес для одного автомобиля (3×6 м) монтируется за 1 рабочий день. Большой навес для парковки на 10+ машин — за 3–5 дней.",
            },
            {
              q: "Какая гарантия на навес?",
              a: "Мы даём гарантию 10 лет на сварные соединения каркаса и антикоррозийное покрытие. На кровельные материалы — по гарантии производителя (5–15 лет).",
            },
            {
              q: "Можно ли сделать навес по нестандартным размерам?",
              a: "Да, мы изготавливаем навесы по любым размерам и конфигурациям — прямоугольные, П-образные, угловые, арочные. Пришлите эскиз или опишите задачу — рассчитаем за 1 день.",
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
