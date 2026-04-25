'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high:   'bg-orange-50 text-orange-700 border-orange-200',
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  low:    'bg-gray-50 text-gray-600 border-gray-200',
}

const ACTION_LABELS: Record<string, string> = {
  send_proposal: '📄 Отправить КП',
  make_call:     '📞 Позвонить',
  send_email:    '✉️ Написать письмо',
  send_message:  '💬 Отправить сообщение',
  create_task:   '✅ Создать задачу',
  send_campaign: '📣 Запустить рассылку',
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

export function QueueClient({ items, stats }: { items: any[], stats: any }) {
  const [filter, setFilter] = useState<'all'|'pending'|'approved'>('pending')
  const [loading, setLoading] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const router = useRouter()

  const filtered = filter === 'all' ? items : items.filter((i: any) => i.status === filter)

  const act = async (id: string, status: string, content?: string) => {
    setLoading(id)
    await fetch('/api/queue/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, content }),
    })
    setLoading(null)
    setEditing(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[15px] font-medium text-gray-900">Очередь ИИ</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {stats.pending} ждут одобрения · {stats.approved} одобрено
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {[
            { k: 'pending', l: `Ожидают (${stats.pending})` },
            { k: 'approved', l: 'Одобренные' },
            { k: 'all', l: 'Все' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k as any)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${
                filter === f.k ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-[13px] font-medium text-gray-600">Очередь пуста</div>
            <div className="text-[11px] mt-1">Запустите агентов — они создадут задачи</div>
          </div>
        ) : filtered.map((item: any) => (
          <div key={item.id} className={`bg-white border rounded-xl overflow-hidden ${
            item.priority === 'urgent' ? 'border-red-200' :
            item.priority === 'high' ? 'border-orange-200' : 'border-gray-200'
          }`}>
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] px-2 py-0.5 rounded border font-medium ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.normal}`}>
                      {item.priority === 'urgent' ? '🔴 Срочно' : item.priority === 'high' ? '🟡 Важно' : '🔵 Обычное'}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {ACTION_LABELS[item.action_type] || item.action_type}
                    </span>
                    <span className="text-[10px] text-gray-400">{timeAgo(item.created_at)}</span>
                  </div>
                  <div className="text-[13px] font-medium text-gray-900">{item.subject}</div>
                  {item.contacts && (
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {item.contacts.company_name || item.contacts.full_name}
                      {item.contacts.phone && ` · ${item.contacts.phone}`}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 py-3">
              {item.ai_reasoning && (
                <div className="text-[10px] text-purple-600 bg-purple-50 rounded-lg px-3 py-2 mb-3">
                  <span className="font-medium">★ ИИ объясняет: </span>{item.ai_reasoning}
                </div>
              )}

              {editing === item.id ? (
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={4}
                  className="w-full text-[12px] border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-blue-400 resize-none"
                />
              ) : (
                <div className="text-[12px] text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {item.content}
                </div>
              )}

              {item.status === 'pending' ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => act(item.id, 'approved', item.content)}
                    disabled={loading === item.id}
                    className="flex-1 bg-green-600 text-white text-[12px] py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                    {loading === item.id ? '...' : '✓ Одобрить'}
                  </button>
                  {editing === item.id ? (
                    <button
                      onClick={() => act(item.id, 'approved', editText)}
                      disabled={loading === item.id}
                      className="flex-1 bg-blue-600 text-white text-[12px] py-2 rounded-lg hover:bg-blue-700">
                      ✓ Сохранить и одобрить
                    </button>
                  ) : (
                    <button
                      onClick={() => { setEditing(item.id); setEditText(item.content) }}
                      className="px-3 py-2 border border-gray-300 text-gray-600 text-[12px] rounded-lg hover:bg-gray-50">
                      ✎ Изменить
                    </button>
                  )}
                  <button
                    onClick={() => act(item.id, 'rejected')}
                    disabled={loading === item.id}
                    className="px-3 py-2 bg-red-50 text-red-600 text-[12px] rounded-lg hover:bg-red-100">
                    ✗
                  </button>
                </div>
              ) : (
                <div className={`text-[11px] px-3 py-1.5 rounded-lg text-center ${
                  item.status === 'approved' ? 'bg-green-50 text-green-700' :
                  item.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
                }`}>
                  {item.status === 'approved' ? '✓ Одобрено' : item.status === 'rejected' ? '✗ Отклонено' : item.status}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
