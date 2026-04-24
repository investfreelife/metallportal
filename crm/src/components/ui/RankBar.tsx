interface RankBarProps {
  label: string
  value: number
  max: number
  color: string
  suffix?: string
  onClick?: () => void
}
export function RankBar({ label, value, max, color, suffix = '', onClick }: RankBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div
      className={`flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 ${onClick ? 'cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded' : ''}`}
      onClick={onClick}
    >
      <div className="text-[11px] text-gray-600 w-[110px] flex-shrink-0 truncate">{label}</div>
      <div className="flex-1 h-[14px] bg-gray-100 rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[11px] font-medium text-gray-700 w-12 text-right flex-shrink-0">
        {value.toLocaleString('ru-RU')}{suffix}
      </div>
    </div>
  )
}
