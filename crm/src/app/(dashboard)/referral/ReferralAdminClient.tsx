'use client'
import { useState } from 'react'

function fmt(v: number) { return (v || 0).toLocaleString('ru-RU') + ' ₽' }

export function ReferralAdminClient({ users, transactions, stats }: {
  users: any[], transactions: any[], stats: any
}) {
  const [tab, setTab] = useState('partners')
  const [search, setSearch] = useState('')

  const filtered = users.filter((u: any) =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.ref_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-[15px] font-medium text-gray-900">Реферальная программа</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">Управление партнёрами и выплатами</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Партнёров', value: stats.totalPartners },
          { label: 'Активных', value: stats.activePartners },
          { label: 'Привели клиентов', value: stats.totalReferrals },
          { label: 'К выплате', value: fmt(stats.pendingPayout), color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="text-[10px] text-gray-500 mb-1">{s.label}</div>
            <div className={`text-[20px] font-medium ${s.color || 'text-gray-900'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-200 mb-4">
        {[{ k: 'partners', l: 'Партнёры' }, { k: 'transactions', l: 'Начисления' }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-[11px] border-b-2 ${tab === t.k ? 'text-blue-600 border-blue-600 font-medium' : 'text-gray-500 border-transparent'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'partners' && (
        <>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, компании, коду..."
            className="w-full text-[12px] border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-blue-400" />
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Партнёр', 'Код', 'Уровень', 'Рефералов', 'Заказов', 'Сумма'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any) => {
                  const refCount = users.filter((r: any) => r.referred_by === u.id).length
                  const level = refCount >= 20 ? '🥇 Золото' : refCount >= 5 ? '🥈 Серебро' : '🥉 Бронза'
                  return (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-[12px] font-medium text-gray-900">{u.full_name || '—'}</div>
                        <div className="text-[10px] text-gray-500">{u.company_name || u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-mono text-blue-600">{u.ref_code}</td>
                      <td className="px-4 py-3 text-[11px]">{level}</td>
                      <td className="px-4 py-3 text-[11px] text-gray-700">{refCount}</td>
                      <td className="px-4 py-3 text-[11px] text-gray-700">{u.total_orders}</td>
                      <td className="px-4 py-3 text-[11px] font-medium text-gray-900">{fmt(u.total_amount)}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-gray-400">Нет партнёров</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'transactions' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-gray-400">Нет транзакций</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Описание', 'Сумма', 'Статус', 'Дата'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t: any) => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-[11px] text-gray-700">{t.description || '—'}</td>
                    <td className="px-4 py-3 text-[11px] font-medium text-green-600">+{fmt(t.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        t.status === 'paid' ? 'bg-green-50 text-green-700' :
                        t.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {t.status === 'paid' ? 'Выплачено' : t.status === 'pending' ? 'Ожидает' : t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">
                      {new Date(t.created_at).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
