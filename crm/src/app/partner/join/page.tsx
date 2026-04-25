'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinPage() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', company: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const submit = async () => {
    if (!form.full_name || !form.email) { setError('Имя и email обязательны'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ref/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      router.push(`/partner?code=${data.ref_code}`)
    } catch {
      setError('Ошибка. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-2xl font-medium text-gray-900 mb-1">Стать партнёром</div>
          <div className="text-sm text-gray-500">Зарабатывайте % с продаж металла навсегда</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { pct: '2%', level: 'Бронза', req: 'старт' },
              { pct: '3.5%', level: 'Серебро', req: '5+ клиентов' },
              { pct: '5%', level: 'Золото', req: '20+ клиентов' },
            ].map(l => (
              <div key={l.level}>
                <div className="text-xl font-medium text-blue-700">{l.pct}</div>
                <div className="text-xs text-blue-600 font-medium">{l.level}</div>
                <div className="text-[10px] text-blue-400">{l.req}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {[
            { key: 'full_name', label: 'Имя и фамилия *', placeholder: 'Иван Петров', type: 'text' },
            { key: 'email', label: 'Email *', placeholder: 'ivan@example.com', type: 'email' },
            { key: 'phone', label: 'Телефон', placeholder: '+7 (999) 123-45-67', type: 'tel' },
            { key: 'company', label: 'Компания', placeholder: 'ООО Строймонтаж', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-700 block mb-1">{f.label}</label>
              <input
                type={f.type}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          ))}
        </div>

        {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

        <button onClick={submit} disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Регистрирую...' : 'Зарегистрироваться'}
        </button>

        <div className="text-center mt-4">
          <a href="/partner" className="text-sm text-gray-500 hover:underline">Уже партнёр? Войти →</a>
        </div>
      </div>
    </div>
  )
}
