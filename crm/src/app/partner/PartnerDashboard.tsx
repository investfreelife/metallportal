'use client'
import { useState, useEffect } from 'react'

const LEVEL_META = {
  bronze: { icon: '🥉', name: 'Бронза', color: '#CD7F32', bg: '#FDF3E7', nextLevel: 'silver', nextCount: 5 },
  silver: { icon: '🥈', name: 'Серебро', color: '#A0A0A0', bg: '#F5F5F5', nextLevel: 'gold', nextCount: 20 },
  gold:   { icon: '🥇', name: 'Золото',  color: '#FFD700', bg: '#FFFDE7', nextLevel: null, nextCount: null },
}

function formatMoney(v: number | string) {
  return Number(v).toLocaleString('ru-RU') + ' ₽'
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Сегодня'
  if (days === 1) return 'Вчера'
  return `${days} дней назад`
}

export function PartnerDashboard({ code }: { code?: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [inputCode, setInputCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutDone, setPayoutDone] = useState(false)

  useEffect(() => {
    if (code) loadData(code)
    else setLoading(false)
  }, [code])

  const loadData = async (c: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ref/partner?code=${c}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        setError('Партнёр не найден. Проверьте код.')
      }
    } catch {
      setError('Ошибка соединения')
    }
    setLoading(false)
  }

  const copyLink = () => {
    if (!data) return
    navigator.clipboard.writeText(`https://metallportal-crm2.vercel.app/api/ref/track?code=${data.partner.ref_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const requestPayout = async () => {
    setPayoutLoading(true)
    const res = await fetch('/api/ref/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: data.partner.id }),
    })
    if (res.ok) {
      setPayoutDone(true)
      loadData(data.partner.ref_code)
    }
    setPayoutLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-sm">Загрузка...</div>
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-2xl font-medium text-gray-900 mb-1">Harlan Steel</div>
          <div className="text-sm text-gray-500">Реферальная программа</div>
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-1">Ваш реферальный код</label>
          <input value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && loadData(inputCode)}
            placeholder="IVAN26AB"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 font-mono tracking-widest"
          />
        </div>
        {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
        <button onClick={() => loadData(inputCode)} disabled={!inputCode}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          Войти в кабинет
        </button>
        <div className="text-center mt-4">
          <a href="/partner/join" className="text-sm text-blue-600 hover:underline">Стать партнёром →</a>
        </div>
      </div>
    </div>
  )

  const { partner, referrals, transactions } = data
  const level = LEVEL_META[partner.level as keyof typeof LEVEL_META] || LEVEL_META.bronze
  const progressPct = level.nextCount
    ? Math.min((partner.active_referrals / level.nextCount) * 100, 100)
    : 100
  const remaining = level.nextCount ? Math.max(level.nextCount - partner.active_referrals, 0) : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

      {/* Шапка */}
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1a3a6b] rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-medium">{partner.full_name}</div>
            <div className="text-xs text-white/50 mt-0.5">Партнёр · код {partner.ref_code}</div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5">
            <span className="text-base">{level.icon}</span>
            <span className="text-sm font-medium">{level.name}</span>
            <span className="text-xs text-white/60">{partner.commission_rate}%</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Заработано', value: formatMoney(partner.total_earned) },
            { label: 'Рефералов', value: partner.total_referrals },
            { label: 'Ваш %', value: `${partner.commission_rate}%` },
            { label: 'К выплате', value: formatMoney(partner.pending_amount) },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3">
              <div className="text-base font-medium">{s.value}</div>
              <div className="text-[10px] text-white/50 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Реферальная ссылка */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="text-sm font-medium text-gray-900 mb-3">Реферальная ссылка</div>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-3">
          <span className="flex-1 text-sm text-gray-600 font-mono truncate">
            metallportal-crm2.vercel.app/api/ref/track?code={partner.ref_code}
          </span>
          <button onClick={copyLink}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg transition-all ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {copied ? '✓ Скопировано' : 'Скопировать'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => window.open(`https://t.me/share/url?url=https://metallportal-crm2.vercel.app/api/ref/track?code=${partner.ref_code}&text=Металлопрокат выгодно!`)}
            className="border border-gray-200 rounded-xl py-2.5 text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5">
            📱 Telegram
          </button>
          <button onClick={() => window.open(`https://wa.me/?text=metallportal-crm2.vercel.app/api/ref/track?code=${partner.ref_code}`)}
            className="border border-gray-200 rounded-xl py-2.5 text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5">
            💬 WhatsApp
          </button>
          <button onClick={copyLink}
            className="border border-gray-200 rounded-xl py-2.5 text-xs text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5">
            ✉️ Email
          </button>
        </div>
      </div>

      {/* Прогресс */}
      {level.nextCount && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-900">До следующего уровня</div>
            <div className="text-xs text-gray-500">{partner.active_referrals} / {level.nextCount}</div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }} />
          </div>
          <div className="text-xs text-gray-500">
            Ещё {remaining} рефералов → {level.nextLevel === 'silver' ? 'Серебро 3.5%' : 'Золото 5%'}
          </div>
        </div>
      )}

      {/* К выплате */}
      {Number(partner.pending_amount) >= 500 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-green-600 mb-0.5">Доступно к выплате</div>
            <div className="text-2xl font-medium text-green-800">{formatMoney(partner.pending_amount)}</div>
            {payoutDone && <div className="text-xs text-green-600 mt-1">✓ Запрос отправлен</div>}
          </div>
          <button onClick={requestPayout} disabled={payoutLoading || payoutDone}
            className="bg-green-700 text-white text-sm px-4 py-2.5 rounded-xl hover:bg-green-800 disabled:opacity-60">
            {payoutLoading ? 'Обработка...' : 'Вывести сейчас'}
          </button>
        </div>
      )}

      {/* Рефералы */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-medium text-gray-900">Мои рефералы ({referrals?.length || 0})</div>
        </div>
        {!referrals?.length ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Пока нет рефералов. Поделитесь ссылкой!</div>
        ) : referrals.map((ref: any) => (
          <div key={ref.id} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
              {(ref.ref_company || ref.ref_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{ref.ref_company || ref.ref_name || 'Без имени'}</div>
              <div className="text-xs text-gray-500">{timeAgo(ref.registered_at)} · {ref.total_orders} сделок</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${ref.status === 'active' ? 'bg-green-50 text-green-700' : ref.status === 'new' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {ref.status === 'active' ? 'Активен' : ref.status === 'new' ? 'Новый' : 'Неактивен'}
              </span>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {Number(ref.total_commission) > 0 ? `+${formatMoney(ref.total_commission)}` : '—'}
                </div>
                {Number(ref.total_amount) > 0 && (
                  <div className="text-[10px] text-gray-400">{partner.commission_rate}% от {formatMoney(ref.total_amount)}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* История начислений */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-medium text-gray-900">История начислений</div>
        </div>
        {!transactions?.length ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Начисления появятся после первых сделок рефералов</div>
        ) : transactions.map((tx: any) => (
          <div key={tx.id} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-800">{tx.description}</div>
              <div className="text-xs text-gray-400 mt-0.5">{timeAgo(tx.created_at)}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${tx.type === 'payout' ? 'text-gray-500' : 'text-green-600'}`}>
                {tx.type === 'payout' ? '-' : '+'}{formatMoney(tx.amount)}
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${tx.status === 'paid' ? 'bg-green-50 text-green-700' : tx.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                {tx.status === 'paid' ? 'Выплачено' : tx.status === 'pending' ? 'Ожидает' : tx.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
