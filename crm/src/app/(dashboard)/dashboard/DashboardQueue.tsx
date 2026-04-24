'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { timeAgo, getActionTypeLabel } from '@/lib/utils'

type QueueItem = {
  id: string
  action_type: string
  priority: string
  ai_reasoning: string | null
  content: string | null
  created_at: string
  contact: { full_name: string | null; company_name: string | null } | null
}

const PRIORITY = {
  urgent: { label: 'срочно', cls: 'bg-red-50 text-red-700' },
  high:   { label: 'важно',  cls: 'bg-amber-50 text-amber-700' },
  normal: { label: 'обычный', cls: 'bg-blue-50 text-blue-700' },
  low:    { label: 'низкий', cls: 'bg-gray-100 text-gray-600' },
}

export default function DashboardQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter()
  const [local, setLocal] = useState(items)
  const [busy, setBusy] = useState<string | null>(null)

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id)
    await fetch(`/api/ai/queue/${id}/${action}`, { method: 'PATCH' })
    setLocal(prev => prev.filter(i => i.id !== id))
    setBusy(null)
    router.refresh()
  }

  if (!local.length) return (
    <div className="px-4 py-8 text-center text-gray-400 text-xs">Нет ожидающих задач</div>
  )

  return (
    <div className="divide-y divide-gray-100">
      {local.map(item => {
        const p = PRIORITY[item.priority as keyof typeof PRIORITY] ?? PRIORITY.normal
        const contact = item.contact
        return (
          <div key={item.id} className="p-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${p.cls}`}>{p.label}</span>
              <span className="text-[11px] text-gray-500">{getActionTypeLabel(item.action_type)}</span>
              <span className="ml-auto text-[10px] text-gray-400">{timeAgo(item.created_at)}</span>
            </div>
            {(contact?.company_name || contact?.full_name) && (
              <div className="text-xs font-medium text-gray-900 mb-0.5">
                {[contact.company_name, contact.full_name].filter(Boolean).join(' · ')}
              </div>
            )}
            {item.ai_reasoning && (
              <div className="text-[11px] text-gray-500 mb-2 leading-relaxed line-clamp-2">{item.ai_reasoning}</div>
            )}
            <div className="flex gap-1.5">
              <button
                disabled={busy === item.id}
                onClick={() => act(item.id, 'approve')}
                className="px-2.5 py-1 text-[11px] font-medium bg-green-600 hover:bg-green-500 text-white rounded-md transition-colors disabled:opacity-50"
              >
                ✓ Одобрить
              </button>
              <button
                disabled={busy === item.id}
                onClick={() => act(item.id, 'reject')}
                className="px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Отклонить
              </button>
            </div>
          </div>
        )
      })}
      <div className="px-3 py-2">
        <Link href="/queue" className="text-[11px] text-blue-600 hover:text-blue-700">Все задачи →</Link>
      </div>
    </div>
  )
}
