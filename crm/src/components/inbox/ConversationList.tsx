'use client'

import { RefObject, useEffect } from 'react'
import type { ConversationCard } from './InboxApp'
import { CHANNEL_META } from './InboxApp'

interface Props {
  conversations: ConversationCard[]
  selectedId: string | null
  loading: boolean
  error: string | null
  view: string
  viewLabels: Record<string, { icon: string; label: string }>
  channelFilter: string
  search: string
  searchRef: RefObject<HTMLInputElement | null>
  listRef: RefObject<HTMLDivElement | null>
  onSearchChange: (s: string) => void
  onSelect: (id: string) => void
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const sameYear = d.getFullYear() === today.getFullYear()
  if (sameYear) return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const PRIORITY_BADGE: Record<string, { emoji: string; cls: string }> = {
  urgent: { emoji: '🔥', cls: 'text-red-700 font-bold' },
  hot:    { emoji: '🌶',  cls: 'text-orange-700' },
  normal: { emoji: '',   cls: '' },
  low:    { emoji: '💤', cls: 'text-gray-400' },
}

export function ConversationList({
  conversations, selectedId, loading, error, view, viewLabels,
  channelFilter, search, searchRef, listRef, onSearchChange, onSelect,
}: Props) {
  // Scroll selected into view
  useEffect(() => {
    if (!selectedId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-conv-id="${CSS.escape(selectedId)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, listRef])

  const viewLabel = viewLabels[view] || { icon: '📥', label: view }

  return (
    <div className="flex-shrink-0 w-[22rem] bg-white border-r border-gray-200 flex flex-col min-w-0">
      {/* Search + view header */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-baseline justify-between mb-2 gap-2">
          <h2 className="text-[13px] font-semibold text-gray-900 truncate">
            {viewLabel.icon} {viewLabel.label}
            {channelFilter !== 'all' && (
              <span className="ml-1.5 text-[10px] font-normal text-gray-500">
                · {CHANNEL_META[channelFilter]?.icon} {CHANNEL_META[channelFilter]?.label}
              </span>
            )}
          </h2>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{conversations.length}</span>
        </div>
        <div className="relative">
          <input
            ref={searchRef}
            type="search"
            placeholder="Поиск по имени / теме / телефону..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded text-[12px] focus:outline-none focus:border-blue-500"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">🔍</span>
        </div>
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-[11px] text-gray-400">Загружаю...</div>}
        {error && (
          <div className="p-4 text-[11px] text-red-700 bg-red-50">
            Ошибка: {error}
          </div>
        )}
        {!loading && !error && conversations.length === 0 && (
          <div className="p-6 text-center text-[11px] text-gray-400 italic">
            Нет сообщений с фильтром. Сбрось фильтр в sidebar или попробуй другой view.
          </div>
        )}
        {conversations.map((c) => {
          const isSelected = selectedId === c.id
          const channelMeta = CHANNEL_META[c.channel] || CHANNEL_META.form
          const priority = PRIORITY_BADGE[c.priority] || PRIORITY_BADGE.normal
          const isUnread = c.unread_count > 0
          const initials = (c.contact_name || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()
          const avatarColor = c.priority === 'urgent' ? 'bg-red-500'
            : c.priority === 'hot' ? 'bg-orange-500'
            : c.channel === 'email' ? 'bg-blue-500'
            : c.channel === 'phone' ? 'bg-green-500'
            : c.channel === 'telegram' ? 'bg-sky-500'
            : 'bg-gray-500'

          return (
            <button
              key={c.id}
              data-conv-id={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                isSelected ? 'bg-blue-50/60 border-l-2 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Avatar */}
                <div className={`${avatarColor} text-white rounded-full w-8 h-8 flex items-center justify-center text-[10px] font-bold flex-shrink-0 relative`}>
                  {initials || '?'}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center text-[8px]">
                    {channelMeta.icon}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-[12px] truncate ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                      {c.contact_name || 'Аноним'}
                    </span>
                    {c.ai_score !== null && c.ai_score >= 70 && (
                      <span className="text-[9px] text-red-600 font-bold">⚡{c.ai_score}</span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                      {timeAgo(c.last_message_at)}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mt-0.5">
                    {c.subject && (
                      <span className="text-[11px] font-medium text-gray-700 truncate">
                        {c.subject}
                      </span>
                    )}
                    {priority.emoji && (
                      <span className={`text-[10px] ${priority.cls} flex-shrink-0`}>{priority.emoji}</span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-500 truncate leading-snug">
                    {c.last_message_direction === 'outbound' && '↗ '}
                    {c.last_message_preview || <span className="italic">(пусто)</span>}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1">
                    {c.message_count > 1 && (
                      <span className="text-[9px] text-gray-400">{c.message_count} сообщ.</span>
                    )}
                    {isUnread && (
                      <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        {c.unread_count} new
                      </span>
                    )}
                    {c.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[9px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
