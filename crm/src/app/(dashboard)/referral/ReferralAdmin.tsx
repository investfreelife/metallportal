'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const LEVEL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  bronze: { bg: 'bg-amber-50', text: 'text-amber-700', label: '🥉 Бронза' },
  silver: { bg: 'bg-gray-100', text: 'text-gray-600', label: '🥈 Серебро' },
  gold:   { bg: 'bg-yellow-50', text: 'text-yellow-700', label: '🥇 Золото' },
}

function formatMoney(v: number | string) {
  return Number(v).toLocaleString('ru-RU') + ' ₽'
}

interface Props {
  partners: any[]
  pendingTx: any[]
  stats: { totalPartners: number; activePartners: number; totalPending: number; totalPaid: number }
}

export function ReferralAdmin({ partners, pendingTx, stats }: Props) {
  const router = useRouter()
  const [payingOut, setPayingOut] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', company: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const payout = async (partnerId: string) => {
    setPayingOut(partnerId)
    await fetch('/api/ref/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: partnerId }),
    })
    setPayingOut(null)
    router.refresh()
  }

  const addPartner = async () => {
    if (!form.full_name || !form.email) { setAddError('Имя и email обязательны'); return }
    setAddLoading(true)
    setAddError('')
    const res = await fetch('/api/ref/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) { setAddError(data.error); setAddLoading(false); return }
    setShowAddModal(false)
    setForm({ full_name: '', email: '', phone: '', company: '' })
    setAddLoading(false)
    router.refresh()
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-medium text-gray-900">Партнёры</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Управление реферальной программой</p>
        </div>
        <div className="flex gap-2">
          <a href="/partner/join" target="_blank"
            className="text-[11px] border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            Ссылка регистрации ↗
          </a>
          <button onClick={() => setShowAddModal(true)}
            className="text-[11px] bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">
            + Добавить партнёра
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Партнёров', value: stats.totalPartners },
          { label: 'Активных', value: stats.activePartners },
          { label: 'К выплате', value: formatMoney(stats.totalPending) },
          { label: 'Выплачено всего', value: formatMoney(stats.totalPaid) },
        ].map(m => (
          <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="text-[10px] text-gray-500 mb-1">{m.label}</div>
            <div className="text-[20px] font-medium text-gray-900">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Таблица партнёров */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[12px] font-medium text-gray-900">Партнёры ({partners.length})</span>
        </div>
        {partners.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12px] text-gray-400">
            Пока нет партнёров.<br />
            <a href="/partner/join" target="_blank" className="text-blue-600 hover:underline mt-1 block">Открыть страницу регистрации →</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Партнёр', 'Код', 'Уровень', 'Рефералов', 'Заработано', 'К выплате', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map(p => {
                  const lv = LEVEL_COLORS[p.level] || LEVEL_COLORS.bronze
                  const pending = Number(p.pending_amount)
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="text-[12px] font-medium text-gray-900">{p.full_name}</div>
                        <div className="text-[10px] text-gray-500">{p.email}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-[11px] bg-gray-100 px-2 py-0.5 rounded">{p.ref_code}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${lv.bg} ${lv.text}`}>{lv.label}</span>
                        <div className="text-[9px] text-gray-400 mt-0.5">{p.commission_rate}%</div>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-gray-700">{p.active_referrals}</td>
                      <td className="px-4 py-2.5 text-[12px] text-gray-700">{formatMoney(p.total_earned)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[12px] font-medium ${pending > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                          {formatMoney(pending)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {pending >= 500 && (
                          <button onClick={() => payout(p.id)} disabled={payingOut === p.id}
                            className="text-[10px] bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700 disabled:opacity-50">
                            {payingOut === p.id ? '...' : 'Выплатить'}
                          </button>
                        )}
                        <a href={`/partner?code=${p.ref_code}`} target="_blank"
                          className="text-[10px] text-blue-500 hover:underline ml-1">
                          Кабинет ↗
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ожидающие транзакции */}
      {pendingTx.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-900">Ожидают выплаты ({pendingTx.length})</span>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingTx.map(tx => (
              <div key={tx.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[12px] text-gray-900">{tx.description}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString('ru-RU')} · {tx.commission_rate}% комиссия
                  </div>
                </div>
                <div className="text-[13px] font-medium text-green-700">+{formatMoney(tx.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модалка добавления */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-[14px] font-medium text-gray-900 mb-4">Добавить партнёра</h2>
            <div className="space-y-3 mb-4">
              {[
                { key: 'full_name', label: 'Имя *', placeholder: 'Иван Петров' },
                { key: 'email', label: 'Email *', placeholder: 'ivan@example.com' },
                { key: 'phone', label: 'Телефон', placeholder: '+7 999 123-45-67' },
                { key: 'company', label: 'Компания', placeholder: 'ООО Строймонтаж' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[11px] font-medium text-gray-700 block mb-1">{f.label}</label>
                  <input value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full text-[12px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                  />
                </div>
              ))}
            </div>
            {addError && <div className="text-red-500 text-[11px] mb-3">{addError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 text-[12px] border border-gray-300 text-gray-600 py-2 rounded-lg">Отмена</button>
              <button onClick={addPartner} disabled={addLoading}
                className="flex-1 text-[12px] bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {addLoading ? 'Добавляю...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
