'use client'

import { useEffect, useState } from 'react'
import type { ChannelCount, ViewCount } from './InboxApp'
import { CHANNEL_META } from './InboxApp'

interface View {
  id: number
  name: string
  filters: Record<string, any>
  icon: string | null
  sort_order: number
  is_shared: boolean
}

const SMART_INBOXES = [
  { key: 'open',    icon: '📥', label: 'Все открытые',  countKey: 'open' as const },
  { key: 'hot',     icon: '🔥', label: 'Горячие',       countKey: 'hot' as const },
  { key: 'unread',  icon: '🆕', label: 'Непрочитанные', countKey: 'unread' as const },
  { key: 'snoozed', icon: '⏰', label: 'Отложенные',    countKey: 'snoozed' as const },
  { key: 'closed',  icon: '✅', label: 'Закрытые',      countKey: 'closed' as const },
  { key: 'spam',    icon: '🚫', label: 'Спам',          countKey: 'spam' as const },
]

interface Props {
  view: string
  channelFilter: string
  viewCounts: ViewCount
  channelCounts: ChannelCount
  connected: boolean
  onViewChange: (v: string) => void
  onChannelChange: (c: string) => void
}

export function InboxSidebar({
  view, channelFilter, viewCounts, channelCounts, connected,
  onViewChange, onChannelChange,
}: Props) {
  const [savedViews, setSavedViews] = useState<View[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/inbox/views', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSavedViews(d.views || []))
      .catch(() => {})
  }, [])

  const channelEntries = Object.entries(CHANNEL_META)

  return (
    <aside
      className={`flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all ${
        collapsed ? 'w-12' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-100 flex items-center gap-2">
        {!collapsed && (
          <>
            <h1 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              💬 Все сообщения
            </h1>
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
              title={connected ? 'Realtime подключён' : 'Realtime отключён'}
            />
          </>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto text-gray-400 hover:text-gray-600 text-xs"
          title={collapsed ? 'Развернуть' : 'Свернуть'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Smart inboxes */}
        <div className="mb-3">
          {!collapsed && (
            <div className="px-3 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Папки
            </div>
          )}
          {SMART_INBOXES.map((inbox) => {
            const active = view === inbox.key
            const count = viewCounts[inbox.countKey] ?? 0
            return (
              <button
                key={inbox.key}
                onClick={() => onViewChange(inbox.key)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-l-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={inbox.label}
              >
                <span className="text-[14px] flex-shrink-0">{inbox.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{inbox.label}</span>
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {count}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>

        {/* Channels */}
        {!collapsed && (
          <div className="mb-3">
            <div className="px-3 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Каналы
            </div>
            <button
              onClick={() => onChannelChange('all')}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors ${
                channelFilter === 'all'
                  ? 'bg-gray-100 text-gray-900 font-semibold border-l-2 border-l-gray-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-[14px]">📡</span>
              <span className="flex-1 text-left">Все каналы</span>
            </button>
            {channelEntries.map(([key, meta]) => {
              const count = channelCounts[key] ?? 0
              if (count === 0 && channelFilter !== key) return null
              const active = channelFilter === key
              return (
                <button
                  key={key}
                  onClick={() => onChannelChange(key)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors ${
                    active
                      ? 'bg-gray-100 text-gray-900 font-semibold border-l-2 border-l-gray-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-[14px]">{meta.icon}</span>
                  <span className="flex-1 text-left">{meta.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] text-gray-400">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Saved views (Phase 2 customizable) */}
        {!collapsed && savedViews.length > 0 && (
          <div className="mb-3">
            <div className="px-3 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Сохранённые виды</span>
              <span className="text-gray-400 normal-case font-normal text-[9px]">{savedViews.length}</span>
            </div>
            {savedViews.slice(0, 8).map((sv) => (
              <button
                key={sv.id}
                onClick={() => {
                  // Phase 2 — apply saved filters object
                  // Phase 1 — just trigger view if status filter present
                  const status = sv.filters?.status
                  if (typeof status === 'string') onViewChange(status)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-gray-600 hover:bg-gray-50"
                title={JSON.stringify(sv.filters)}
              >
                <span className="text-[14px]">{sv.icon || '⭐'}</span>
                <span className="flex-1 text-left truncate">{sv.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer hints */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-[9px] font-mono">?</kbd>{' '}
          подсказки ·{' '}
          <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-[9px] font-mono">/</kbd>{' '}
          поиск
        </div>
      )}
    </aside>
  )
}
