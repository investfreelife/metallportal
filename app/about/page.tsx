import type { Metadata } from 'next'
import { CheckCircle } from 'lucide-react'
import CTASection from '@/components/home/CTASection'
import Breadcrumbs from '@/components/seo/Breadcrumbs'

export const metadata: Metadata = {
  title: 'О компании — Harlan Steel | Металлопрокат',
  description: 'Harlan Steel — маркетплейс металлопроката России. Работаем с 2019 года. 50+ поставщиков, 12 000+ позиций.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <>
      <div className="container-main py-10">
        <Breadcrumbs items={[{ name: 'О компании' }]} />
        <h1 className="text-3xl font-bold text-foreground mb-2">О компании</h1>
        <p className="text-muted-foreground mb-10">Harlan Steel — маркетплейс металлопроката России</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {[
            { num: '12 000+', label: 'позиций в каталоге', icon: '📦' },
            { num: '50+', label: 'проверенных поставщиков', icon: '🏭' },
            { num: '8 000 т', label: 'металла на складах', icon: '⚖️' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-6 text-center">
              <div className="text-4xl mb-3">{s.icon}</div>
              <div className="text-3xl font-black text-gold mb-1">{s.num}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="prose prose-sm max-w-4xl mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-4">Наша миссия</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Мы строим Amazon металлопроката в России — площадку где строители, производства и частные покупатели находят нужный металл
            по лучшей цене, получают его быстро и с полным документальным сопровождением.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Harlan Steel работает напрямую с заводами-производителями, исключая лишних посредников.
            Это позволяет предлагать конкурентные цены и гарантировать качество продукции по ГОСТ.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 mb-10">
          <h2 className="text-xl font-bold text-foreground mb-5">Почему выбирают нас</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Прямые договоры с заводами — цены без наценки посредников',
              'Полный пакет документов: счёт, накладная, сертификаты качества',
              'Доставка по Москве, МО и всей России',
              'AI-поиск: описывайте что нужно — система подберёт сама',
              'Загрузите смету — получите КП за 2 минуты',
              'Работаем с физлицами и юрлицами, с НДС и без',
              'Ответ менеджера в течение 15 минут в рабочее время',
              'Реферальная программа — зарабатывайте с каждой покупки друга',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle size={16} className="text-gold flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <CTASection />
    </>
  )
}
