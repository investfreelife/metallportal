'use client'

function formatMoney(v: number) {
  if (!v) return null
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М ₽`
  if (v >= 1_000) return `${Math.round(v / 1_000)}К ₽`
  return `${v} ₽`
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Сегодня'
  if (days === 1) return 'Вчера'
  if (days < 7) return `${days} дн назад`
  return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

interface DealCardProps {
  deal: any
  stageColor: string
  isDragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onClick: () => void
}

export function DealCard({ deal, stageColor, isDragging, onDragStart, onClick }: DealCardProps) {
  const isOverdue = deal.expected_close_date && new Date(deal.expected_close_date) < new Date()
  const contactName = deal.contacts?.company_name || deal.contacts?.full_name

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none ${isDragging ? 'opacity-40 scale-95' : ''}`}
      style={{ borderLeft: `3px solid ${stageColor}` }}
    >
      <div className="text-[12px] font-medium text-gray-900 mb-1.5 line-clamp-2 leading-tight">
        {deal.title}
      </div>

      {contactName && (
        <div className="flex items-center gap-1 mb-2">
          <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px] text-gray-500 flex-shrink-0">
            {contactName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-gray-500 truncate">{contactName}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {deal.amount ? (
          <span className="text-[12px] font-medium text-gray-900">{formatMoney(deal.amount)}</span>
        ) : (
          <span className="text-[10px] text-gray-400">Сумма не указана</span>
        )}
        <span className={`text-[10px] ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {deal.expected_close_date
            ? (isOverdue ? '⚠ ' : '') + new Date(deal.expected_close_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
            : timeAgo(deal.created_at)
          }
        </span>
      </div>

      {deal.ai_win_probability > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full"
              style={{
                width: `${deal.ai_win_probability}%`,
                background: deal.ai_win_probability >= 70 ? '#639922' : deal.ai_win_probability >= 40 ? '#EF9F27' : '#E24B4A',
              }} />
          </div>
          <span className="text-[9px] text-gray-400">{deal.ai_win_probability}%</span>
        </div>
      )}
    </div>
  )
}
