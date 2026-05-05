import type { Metadata } from 'next'
import { MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react'
import CTASection from '@/components/home/CTASection'
import Breadcrumbs from '@/components/seo/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Контакты — Harlan Steel | Металлопрокат',
  description: 'Свяжитесь с нами: телефон, email, адрес склада. Работаем по всей России.',
  alternates: { canonical: '/contacts' },
}

export default function ContactsPage() {
  return (
    <>
      <div className="container-main py-10">
        <Breadcrumbs items={[{ name: 'Контакты' }]} />
        <h1 className="text-3xl font-bold text-foreground mb-2">Контакты</h1>
        <p className="text-muted-foreground mb-10">Мы всегда готовы ответить на ваши вопросы</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Телефон */}
          <div className="bg-card border border-border rounded-xl p-6 flex gap-4">
            <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Phone className="text-gold" size={22} />
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Телефон</div>
              <a href="tel:+74957001234" className="text-xl font-bold text-foreground hover:text-gold transition-colors">
                +7 (495) 700-12-34
              </a>
              <p className="text-sm text-muted-foreground mt-1">Пн–Пт 9:00–18:00 МСК</p>
            </div>
          </div>

          {/* Email */}
          <div className="bg-card border border-border rounded-xl p-6 flex gap-4">
            <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Mail className="text-gold" size={22} />
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Email</div>
              <a href="mailto:info@harlansteel.ru" className="text-lg font-medium text-foreground hover:text-gold transition-colors">
                info@harlansteel.ru
              </a>
              <p className="text-sm text-muted-foreground mt-1">Ответим в течение часа</p>
            </div>
          </div>

          {/* Telegram */}
          <div className="bg-card border border-border rounded-xl p-6 flex gap-4">
            <div className="w-12 h-12 bg-[#229ED9]/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageCircle className="text-[#229ED9]" size={22} />
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Telegram</div>
              <a href="https://t.me/harlansteel" target="_blank" className="text-lg font-medium text-[#229ED9] hover:underline">
                @harlansteel
              </a>
              <p className="text-sm text-muted-foreground mt-1">Быстрый ответ в мессенджере</p>
            </div>
          </div>

          {/* Адрес */}
          <div className="bg-card border border-border rounded-xl p-6 flex gap-4">
            <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="text-gold" size={22} />
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Склад и офис</div>
              <p className="text-foreground font-medium">Москва, ул. Промышленная, 15</p>
              <p className="text-sm text-muted-foreground mt-1">Самовывоз по предварительному согласованию</p>
            </div>
          </div>
        </div>

        {/* Режим работы */}
        <div className="bg-card border border-border rounded-xl p-6 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="text-gold" size={20} />
            <h2 className="font-bold text-foreground text-lg">Режим работы</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { day: 'Понедельник–Пятница', time: '9:00–18:00' },
              { day: 'Суббота', time: '10:00–15:00' },
              { day: 'Воскресенье', time: 'Выходной' },
            ].map((item) => (
              <div key={item.day} className="bg-muted/40 rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">{item.day}</div>
                <div className="font-semibold text-foreground">{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <CTASection />
    </>
  )
}
