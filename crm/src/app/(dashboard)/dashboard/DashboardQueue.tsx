'use client'

import { getActionTypeLabel } from '@/lib/utils'

type QueueItem = {
  id: string
  action_type: string
  priority: string
  ai_reasoning: string | null
  content: string
  created_at: string
  contact: {
    full_name: string | null
    company_name: string | null
  } | null
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-blue-400',
  low: 'bg-gray-300',
}

export default function DashboardQueue({ items }: { items: QueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-gray-400">
        Нет задач в очереди
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 px-4 py-3">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[item.priority] ?? 'bg-gray-300'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-medium text-gray-800">
                {getActionTypeLabel(item.action_type)}
              </span>
              {item.contact && (
                <span className="text-[11px] text-gray-400">
                  · {item.contact.full_name || item.contact.company_name || '—'}
                </span>
              )}
            </div>
            {item.ai_reasoning && (
              <div className="text-[11px] text-gray-500 truncate">{item.ai_reasoning}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
