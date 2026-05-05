import type { Metadata } from 'next'
import Breadcrumbs from '@/components/seo/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Публичная оферта — Харланметалл',
  description: 'Договор публичной оферты купли-продажи металлопроката. Харланметалл.',
  alternates: { canonical: '/oferta' },
  robots: { index: false },
}

const COMPANY = 'ООО «Харланметалл»'
const EMAIL = 'info@harlansteel.ru'
const PHONE = '+7 (495) 700-12-34'
const SITE = 'harlansteel.ru'
const DATE = '27 апреля 2026 г.'

export default function OfertaPage() {
  return (
    <div className="container-main py-10 max-w-4xl">
      <Breadcrumbs items={[{ name: 'Публичная оферта' }]} />
      <h1 className="text-3xl font-bold text-foreground mb-2">
        Публичная оферта
      </h1>
      <p className="text-muted-foreground mb-8">
        Договор купли-продажи металлопроката · Редакция от {DATE}
      </p>

      <div className="prose prose-sm max-w-none space-y-8 text-foreground/80 leading-relaxed">

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">1. Общие положения</h2>
          <p>
            <strong>1.1.</strong> {COMPANY} (далее — <strong>Продавец</strong>) в соответствии
            со ст. 435 и ст. 437 Гражданского кодекса РФ публикует настоящий документ, являющийся
            публичной офертой — предложением заключить договор купли-продажи металлопроката
            (далее — <strong>Договор</strong>) на нижеследующих условиях.
          </p>
          <p className="mt-3">
            <strong>1.2.</strong> Акцептом настоящей оферты является оформление заказа через Сайт{' '}
            <strong>{SITE}</strong> (кнопка «Отправить заявку» / «Оформить заказ»). С момента
            акцепта Договор считается заключённым (ст. 438 ГК РФ).
          </p>
          <p className="mt-3">
            <strong>1.3.</strong> Физическое или юридическое лицо, совершившее акцепт, именуется
            далее <strong>Покупателем</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">2. Предмет договора</h2>
          <p>
            <strong>2.1.</strong> Продавец обязуется передать в собственность Покупателя
            металлопрокат (арматура, трубы, листовой прокат, балки, швеллера, уголок и иные
            позиции каталога), а Покупатель обязуется принять и оплатить товар в соответствии
            с согласованным коммерческим предложением (далее — КП).
          </p>
          <p className="mt-3">
            <strong>2.2.</strong> Наименование, количество, технические характеристики и цена
            товара определяются КП, направляемым Покупателю менеджером Продавца после оформления
            заявки.
          </p>
          <p className="mt-3">
            <strong>2.3.</strong> Все цены на Сайте являются <strong>ориентировочными</strong> и
            действительны на момент публикации. Окончательная цена фиксируется в КП.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">3. Оформление заказа</h2>
          <p>
            <strong>3.1.</strong> Покупатель оформляет заявку через форму на Сайте, указывая
            наименование, количество товара и контактные данные.
          </p>
          <p className="mt-3">
            <strong>3.2.</strong> В течение 15 минут (в рабочее время: пн–пт 9:00–18:00 МСК)
            менеджер Продавца связывается с Покупателем для уточнения деталей и направления КП.
          </p>
          <p className="mt-3">
            <strong>3.3.</strong> Договор считается заключённым с момента письменного или устного
            подтверждения Покупателем КП.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">4. Цена и оплата</h2>
          <p>
            <strong>4.1.</strong> Цена товара указывается в КП в рублях РФ.
          </p>
          <p className="mt-3">
            <strong>4.2.</strong> Оплата производится на основании выставленного счёта
            безналичным переводом на расчётный счёт Продавца, либо наличными в офисе по
            соглашению сторон.
          </p>
          <p className="mt-3">
            <strong>4.3.</strong> Право собственности на товар переходит к Покупателю после
            полной оплаты и подписания товарной накладной.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">5. Доставка и самовывоз</h2>
          <p>
            <strong>5.1.</strong> Доставка осуществляется автотранспортом Продавца или
            транспортной компанией по выбору Покупателя. Стоимость и сроки доставки
            согласовываются индивидуально.
          </p>
          <p className="mt-3">
            <strong>5.2.</strong> Самовывоз возможен с разрешения Продавца по адресу:
            Москва, ул. Промышленная, 15.
          </p>
          <p className="mt-3">
            <strong>5.3.</strong> Риск случайной гибели или повреждения товара переходит
            к Покупателю с момента передачи товара перевозчику или Покупателю.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">6. Качество товара</h2>
          <p>
            <strong>6.1.</strong> Металлопрокат поставляется по ГОСТ, техническим условиям
            или иным нормативным документам, указанным в КП.
          </p>
          <p className="mt-3">
            <strong>6.2.</strong> К каждой партии прилагается пакет документов: счёт-фактура,
            товарная накладная (ТОРГ-12 или УПД), сертификат качества завода-изготовителя.
          </p>
          <p className="mt-3">
            <strong>6.3.</strong> Покупатель обязан проверить товар при приёмке. Претензии
            по количеству и видимым дефектам принимаются в момент приёмки. Претензии по
            скрытым дефектам — в течение 30 дней.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">7. Ответственность сторон</h2>
          <p>
            <strong>7.1.</strong> За нарушение сроков оплаты Покупатель уплачивает неустойку
            в размере 0,1% от суммы долга за каждый день просрочки.
          </p>
          <p className="mt-3">
            <strong>7.2.</strong> Стороны освобождаются от ответственности при наступлении
            форс-мажорных обстоятельств (стихийные бедствия, решения органов власти, иные
            обстоятельства непреодолимой силы).
          </p>
          <p className="mt-3">
            <strong>7.3.</strong> Совокупная ответственность Продавца по настоящему Договору
            ограничена стоимостью оплаченного товара.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">8. Персональные данные</h2>
          <p>
            <strong>8.1.</strong> Оформляя заявку, Покупатель даёт согласие на обработку
            персональных данных в соответствии с{' '}
            <a href="/privacy" className="text-gold hover:underline">
              Политикой конфиденциальности
            </a>{' '}
            в целях исполнения настоящего Договора (ст. 6 п. 5 152-ФЗ).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">9. Разрешение споров</h2>
          <p>
            Споры разрешаются путём переговоров, а при недостижении соглашения — в Арбитражном
            суде г. Москвы (для юридических лиц) или в суде общей юрисдикции по месту нахождения
            Продавца (для физических лиц). Применяется право Российской Федерации.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">10. Реквизиты продавца</h2>
          <div className="bg-card border border-border rounded-xl p-5 space-y-2 text-sm">
            <p><strong>Наименование:</strong> {COMPANY}</p>
            <p><strong>ИНН / КПП:</strong> <span className="text-muted-foreground">[заполнить]</span></p>
            <p><strong>ОГРН:</strong> <span className="text-muted-foreground">[заполнить]</span></p>
            <p><strong>Юр. адрес:</strong> Москва, ул. Промышленная, 15</p>
            <p><strong>Р/с:</strong> <span className="text-muted-foreground">[заполнить]</span></p>
            <p><strong>Банк:</strong> <span className="text-muted-foreground">[заполнить]</span></p>
            <p>
              <strong>Email:</strong>{' '}
              <a href={`mailto:${EMAIL}`} className="text-gold hover:underline">{EMAIL}</a>
            </p>
            <p>
              <strong>Телефон:</strong>{' '}
              <a href="tel:+74957001234" className="text-gold hover:underline">{PHONE}</a>
            </p>
            <p className="text-muted-foreground text-xs mt-3">
              * Поля в скобках [заполнить] необходимо указать перед публикацией.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
