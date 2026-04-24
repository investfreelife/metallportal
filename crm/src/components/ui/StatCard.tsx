interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaType?: 'up' | 'down' | 'neutral'
}
export function StatCard({ label, value, delta, deltaType }: StatCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className="text-[22px] font-medium text-gray-900">{value}</div>
      {delta && (
        <div className={`text-[10px] mt-1 ${deltaType === 'up' ? 'text-green-600' : deltaType === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
          {delta}
        </div>
      )}
    </div>
  )
}
