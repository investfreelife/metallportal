'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, ArrowRight } from 'lucide-react'

export default function PartnerJoinPage() {
  const [form, setForm] = useState({ full_name: '', company_name: '', phone: '', email: '', ref_code: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.phone && !form.email) { setError('Укажите телефон или email'); return }
    setLoading(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'partner_join', message: 'Заявка партнёра' }),
      })
      setDone(true)
    } catch {
      setError('Ошибка отправки, попробуйте ещё раз')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Заявка принята!</h1>
        <p className="text-muted-foreground mb-6">Менеджер свяжется с вами в течение 30 минут и настроит вашу реферальную ссылку.</p>
        <Link href="/" className="bg-gold text-black px-6 py-3 rounded-xl font-semibold hover:bg-yellow-400 transition-all">
          На главную
        </Link>
      </div>
    </div>
  )

  return (
    <div className="container-main py-12 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Левая колонка — описание */}
        <div>
          <div className="inline-block bg-gold/10 text-gold text-xs font-bold px-3 py-1 rounded-full mb-4">
            Реферальная программа
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">Зарабатывайте с Harlan Steel</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Рекомендуйте нас — получайте процент с каждого заказа приглашённых клиентов.
            Никаких вложений, только ваша сеть знакомств.
          </p>

          <div className="space-y-5 mb-8">
            {[
              { icon: '🥉', level: 'Бронза', pct: '2%', cond: 'от 1 реферала' },
              { icon: '🥈', level: 'Серебро', pct: '3.5%', cond: 'от 5 рефералов' },
              { icon: '🥇', level: 'Золото', pct: '5%', cond: 'от 20 рефералов' },
            ].map((l) => (
              <div key={l.level} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
                <span className="text-3xl">{l.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-foreground">{l.level} — {l.pct} с каждого заказа</div>
                  <div className="text-xs text-muted-foreground">{l.cond}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {[
              'Ваша уникальная ссылка — готова за 30 минут',
              'Выплаты раз в месяц на карту',
              'Личный кабинет для отслеживания рефералов',
              'Поддержка менеджера',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle size={14} className="text-gold flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Правая колонка — форма */}
        <div>
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-bold text-foreground text-lg mb-5">Оставить заявку</h2>
            <form onSubmit={submit} className="space-y-3">
              <input
                value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))}
                placeholder="Имя и фамилия"
                className="w-full border border-border bg-input rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
              />
              <input
                value={form.company_name} onChange={e => setForm(p => ({...p, company_name: e.target.value}))}
                placeholder="Компания (необязательно)"
                className="w-full border border-border bg-input rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
              />
              <input
                value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                placeholder="Телефон" type="tel"
                className="w-full border border-border bg-input rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
              />
              <input
                value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                placeholder="Email" type="email"
                className="w-full border border-border bg-input rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
              />

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                {loading ? 'Отправляю...' : <><span>Стать партнёром</span><ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Уже есть аккаунт?{' '}
              <Link href="/account/login" className="text-gold hover:underline">Войти в кабинет</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
