'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime, getActionTypeLabel } from '@/lib/utils'
import { CheckCircle, XCircle, Clock, Edit3, Sparkles, MessageSquarePlus } from 'lucide-react'

type QueueItem = {
  id: string
  action_type: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  subject: string | null
  content: string
  ai_reasoning: string | null
  auto_execute_at: string | null
  created_at: string
  contact: {
    id: string
    full_name: string | null
    company_name: string | null
    phone: string | null
    email: string | null
  } | null
}

const PRIORITY_CONFIG = {
  urgent: { label: '🔴 Срочно', color: 'border-red-500/50 bg-red-500/5' },
  high: { label: '🟠 Высокий', color: 'border-orange-500/50 bg-orange-500/5' },
  normal: { label: '🔵 Обычный', color: 'border-blue-500/50 bg-blue-500/5' },
  low: { label: '⚪ Низкий', color: 'border-gray-700 bg-gray-800/30' },
}

export default function QueueClient({ items }: { items: QueueItem[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState(items)
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({})  // itemId → feedback text
  const [feedbackOpen, setFeedbackOpen] = useState<Record<string, boolean>>({})

  async function approve(item: QueueItem) {
    setProcessing(item.id)
    const finalContent = editingId === item.id ? editedContent : item.content
    const managerFeedback = feedbacks[item.id] ?? ''

    // If action is email/proposal and contact has email → auto-send
    const emailActions = ['send_email', 'send_proposal', 'send_message']
    if (emailActions.includes(item.action_type) && item.contact?.email) {
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: item.contact.email,
          subject: item.subject || 'Предложение от МеталлПортал',
          html: `<p>${finalContent.replace(/\n/g, '<br>')}</p>`,
          contact_id: item.contact.id,
          queue_item_id: item.id,
        }),
      })
    } else {
      await fetch(`/api/ai/queue/${item.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_feedback: managerFeedback }),
      })
    }

    setLocalItems((prev) => prev.filter((i) => i.id !== item.id))
    setEditingId(null)
    setProcessing(null)
    router.refresh()
  }

  async function reject(item: QueueItem) {
    setProcessing(item.id)
    const managerFeedback = feedbacks[item.id] ?? ''
    await fetch(`/api/ai/queue/${item.id}/reject`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_feedback: managerFeedback }),
    })
    setLocalItems((prev) => prev.filter((i) => i.id !== item.id))
    setRejectingId(null)
    setRejectReason('')
    setProcessing(null)
    router.refresh()
  }

  async function snooze(itemId: string, hours: number) {
    const action = hours === 1 ? 'snooze1' : hours === 3 ? 'snooze3' : 'snooze24'
    await fetch(`/api/ai/queue/${itemId}/${action}`, { method: 'PATCH' })
    setLocalItems((prev) => prev.filter((i) => i.id !== itemId))
    router.refresh()
  }

  function startEdit(item: QueueItem) {
    setEditingId(item.id)
    setEditedContent(item.content)
  }

  if (localItems.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            Очередь ИИ
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Ожидающие подтверждения действия</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl py-20 text-center">
          <Sparkles className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Очередь пуста</p>
          <p className="text-gray-600 text-sm mt-1">ИИ пока не предложил никаких действий</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-400" />
          Очередь ИИ
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {localItems.length} {localItems.length === 1 ? 'действие ждёт' : 'действий ждут'} подтверждения
        </p>
      </div>

      <div className="space-y-4">
        {localItems.map((item) => {
          const priorityCfg = PRIORITY_CONFIG[item.priority]
          const isEditing = editingId === item.id
          const isRejecting = rejectingId === item.id
          const isProcessing = processing === item.id

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-5 space-y-4 ${priorityCfg.color}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{priorityCfg.label}</span>
                    <span className="text-gray-500 text-xs">{formatRelativeTime(item.created_at)}</span>
                  </div>
                  {item.contact && (
                    <p className="text-white font-semibold mt-1">
                      {item.contact.full_name || item.contact.company_name || 'Неизвестный контакт'}
                      {item.contact.company_name && item.contact.full_name && (
                        <span className="text-gray-400 font-normal text-sm ml-1.5">· {item.contact.company_name}</span>
                      )}
                    </p>
                  )}
                </div>
                <span className="px-2.5 py-1 bg-gray-800 text-gray-300 text-xs rounded-lg whitespace-nowrap">
                  {getActionTypeLabel(item.action_type)}
                </span>
              </div>

              {item.ai_reasoning && (
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg px-3.5 py-3">
                  <p className="text-purple-300 text-xs font-medium mb-1">Обоснование ИИ</p>
                  <p className="text-gray-300 text-sm">{item.ai_reasoning}</p>
                </div>
              )}

              <div>
                {item.subject && (
                  <p className="text-gray-400 text-xs mb-1.5">Тема: <span className="text-gray-300">{item.subject}</span></p>
                )}
                <div className="bg-gray-900 border border-gray-700 rounded-lg">
                  {isEditing ? (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={6}
                      className="w-full p-3.5 bg-transparent text-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                    />
                  ) : (
                    <p className="p-3.5 text-gray-300 text-sm whitespace-pre-wrap">{item.content}</p>
                  )}
                </div>
              </div>

              {/* Обратная связь менеджера → уходит в Claude для улучшения промпта */}
              <div className="border-t border-gray-700/50 pt-3">
                <button
                  onClick={() => setFeedbackOpen(f => ({ ...f, [item.id]: !f[item.id] }))}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-400 transition-colors"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  {feedbackOpen[item.id] ? 'Скрыть комментарий' : 'Добавить комментарий для обучения ИИ'}
                </button>
                {feedbackOpen[item.id] && (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      autoFocus
                      rows={2}
                      value={feedbacks[item.id] ?? ''}
                      onChange={e => setFeedbacks(f => ({ ...f, [item.id]: e.target.value }))}
                      placeholder="Напишите что не так с ответом ИИ или что нужно улучшить... Claude скорректирует промпт"
                      className="w-full px-3 py-2 bg-purple-950/30 border border-purple-500/30 rounded-lg text-gray-300 text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                    />
                    <p className="text-gray-600 text-xs">Комментарий отправится вместе с одобрением/отклонением</p>
                  </div>
                )}
              </div>

              {isRejecting && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Причина отклонения (необязательно)"
                    className="w-full px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(item)}
                      disabled={isProcessing}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Подтвердить отклонение
                    </button>
                    <button
                      onClick={() => setRejectingId(null)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {!isRejecting && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => approve(item)}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isEditing ? 'Сохранить и отправить' : 'Отправить'}
                  </button>

                  {!isEditing ? (
                    <button
                      onClick={() => startEdit(item)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Изменить
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                    >
                      Отмена
                    </button>
                  )}

                  <button
                    onClick={() => setRejectingId(item.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-red-400 text-sm font-medium rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Отклонить
                  </button>

                  <div className="relative group">
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-lg transition-colors">
                      <Clock className="w-4 h-4" />
                      Напомнить
                    </button>
                    <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-10">
                      {[1, 3, 24].map((h) => (
                        <button
                          key={h}
                          onClick={() => snooze(item.id, h)}
                          className="px-3 py-2 hover:bg-gray-700 text-gray-300 text-xs whitespace-nowrap transition-colors"
                        >
                          {h === 24 ? '1 день' : `${h}ч`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
