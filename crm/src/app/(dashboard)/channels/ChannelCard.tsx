'use client'
import { useState } from 'react'
import { AVAILABLE_CHANNELS } from './ChannelsClient'

const STATUS_STYLES: Record<string, { border: string; badge: string; label: string }> = {
  active:   { border: 'border-l-[3px] border-l-green-500',  badge: 'bg-green-50 text-green-700',  label: 'Активен' },
  error:    { border: 'border-l-[3px] border-l-red-500',    badge: 'bg-red-50 text-red-700',       label: 'Ошибка' },
  paused:   { border: 'border-l-[3px] border-l-amber-500',  badge: 'bg-amber-50 text-amber-700',   label: 'Пауза' },
  inactive: { border: 'border-l-[3px] border-l-gray-300',   badge: 'bg-gray-100 text-gray-500',    label: 'Не настроен' },
}

interface Props {
  channel: any
  onEdit: () => void
  onDelete: () => void
  onUpdate: (ch: any) => void
}

export function ChannelCard({ channel, onEdit, onDelete, onUpdate }: Props) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const meta = AVAILABLE_CHANNELS.find(c => c.type === channel.type)
  const style = STATUS_STYLES[channel.status] ?? STATUS_STYLES.inactive
  const stats = channel.stats || {}

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/channels/${channel.id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult({ ok: data.success, msg: data.message })
      onUpdate({ ...channel, status: data.success ? 'active' : 'error', error_message: data.success ? null : data.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${style.border}`}>
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: meta?.color || '#F1EFE8', color: meta?.textColor || '#5F5E5A' }}
        >
          {meta?.icon || channel.type.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-gray-900 truncate">{channel.name}</div>
          <div className="text-[9px] text-gray-500">{meta?.desc || channel.type}</div>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${style.badge}`}>
          {style.label}
        </span>
      </div>

      <div className="px-3 py-2.5">
        {channel.error_message && (
          <div className="bg-red-50 rounded-md p-2 mb-2">
            <div className="text-[10px] text-red-600 leading-relaxed">{channel.error_message}</div>
          </div>
        )}

        {Object.keys(stats).length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {stats.budget != null && (
              <div className="bg-gray-50 rounded p-1.5">
                <div className="text-[9px] text-gray-500">Бюджет</div>
                <div className="text-[12px] font-medium">{(stats.budget / 1000).toFixed(0)}К ₽</div>
              </div>
            )}
            {stats.leads != null && (
              <div className="bg-gray-50 rounded p-1.5">
                <div className="text-[9px] text-gray-500">Лидов</div>
                <div className="text-[12px] font-medium">{stats.leads}</div>
              </div>
            )}
            {stats.roi != null && (
              <div className="bg-gray-50 rounded p-1.5">
                <div className="text-[9px] text-gray-500">ROI</div>
                <div className="text-[12px] font-medium text-green-600">+{stats.roi}%</div>
              </div>
            )}
            {stats.subscribers != null && (
              <div className="bg-gray-50 rounded p-1.5">
                <div className="text-[9px] text-gray-500">Подписчиков</div>
                <div className="text-[12px] font-medium">{stats.subscribers.toLocaleString('ru-RU')}</div>
              </div>
            )}
          </div>
        )}

        {testResult && (
          <div className={`rounded-md p-2 mb-2 ${testResult.ok ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-[10px] leading-relaxed ${testResult.ok ? 'text-green-700' : 'text-red-700'}`}>
              {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
            </div>
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          <button onClick={onEdit}
            className="text-[10px] bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700">
            Настройки
          </button>
          <button onClick={test} disabled={testing}
            className="text-[10px] border border-gray-300 text-gray-600 px-2.5 py-1 rounded hover:bg-gray-50 disabled:opacity-50">
            {testing ? '...' : 'Тест'}
          </button>
          <button onClick={onDelete}
            className="text-[10px] text-red-500 px-2 py-1 rounded hover:bg-red-50 ml-auto">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
