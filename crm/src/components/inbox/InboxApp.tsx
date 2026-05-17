'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InboxSidebar } from './InboxSidebar'
import { ConversationList } from './ConversationList'
import { ThreadView } from './ThreadView'

/**
 * InboxApp — 3-pane omnichannel inbox (Front App / Missive / HubSpot quality bar).
 *
 * URGENT 2026-05-17 OMNICHANNEL_INBOX Phase 1. Sergey directive «отдельная
 * полноценная вкладка с крутыми возможностями, мирового уровня».
 *
 * Layout:
 *   ┌──────────┬──────────────┬──────────────────────────────┐
 *   │ Sidebar  │ Conv List    │ Thread + Composer            │
 *   │ 240px    │ 360px        │ flex-1 (incl. ContactPanel)  │
 *   └──────────┴──────────────┴──────────────────────────────┘
 *
 * Keyboard shortcuts:
 *   ↑/↓  — navigate conversations
 *   Enter — open selected
 *   r    — focus reply composer
 *   e    — archive (close conversation)
 *   s    — snooze
 *   /    — focus search
 *   ?    — show shortcut panel
 *
 * Realtime: subscribes activities/emails/messages INSERTs → reload list.
 */

export interface ConversationCard {
  id: string
  contact_id: string | null
  contact_name: string
  contact_phone: string | null
  contact_email: string | null
  contact_company: string | null
  channel: string
  subject: string | null
  last_message_preview: string
  last_message_at: string
  last_message_direction: 'inbound' | 'outbound'
  unread_count: number
  message_count: number
  priority: 'urgent' | 'hot' | 'normal' | 'low'
  status: 'open' | 'pending' | 'closed' | 'snoozed' | 'spam'
  tags: string[]
  ai_score: number | null
  ai_segment: string | null
}

export interface ChannelCount {
  [channel: string]: number
}

export interface ViewCount {
  open: number
  hot: number
  unread: number
  snoozed: number
  closed: number
  spam: number
}

export const CHANNEL_META: Record<string, { icon: string; label: string; color: string }> = {
  email:    { icon: '📧', label: 'Email',     color: 'bg-blue-100 text-blue-700' },
  phone:    { icon: '📞', label: 'Звонок',    color: 'bg-green-100 text-green-700' },
  sms:      { icon: '💬', label: 'SMS',       color: 'bg-emerald-100 text-emerald-700' },
  form:     { icon: '📝', label: 'Форма',     color: 'bg-purple-100 text-purple-700' },
  telegram: { icon: '✈️', label: 'Telegram',  color: 'bg-sky-100 text-sky-700' },
  vk:       { icon: '🅰️', label: 'VK',        color: 'bg-indigo-100 text-indigo-700' },
  whatsapp: { icon: '🟢', label: 'WhatsApp',  color: 'bg-green-100 text-green-700' },
  note:     { icon: '🗒', label: 'Заметка',   color: 'bg-amber-100 text-amber-700' },
  chat:     { icon: '🤖', label: 'Чат',       color: 'bg-gray-100 text-gray-700' },
}

const VIEW_LABELS: Record<string, { icon: string; label: string }> = {
  open:    { icon: '📥', label: 'Все открытые' },
  hot:     { icon: '🔥', label: 'Горячие' },
  unread:  { icon: '🆕', label: 'Непрочитанные' },
  snoozed: { icon: '⏰', label: 'Отложенные' },
  closed:  { icon: '✅', label: 'Закрытые' },
  spam:    { icon: '🚫', label: 'Спам' },
}

export function InboxApp() {
  const [view, setView] = useState<string>('open')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [conversations, setConversations] = useState<ConversationCard[]>([])
  const [channelCounts, setChannelCounts] = useState<ChannelCount>({})
  const [viewCounts, setViewCounts] = useState<ViewCount>({ open: 0, hot: 0, unread: 0, snoozed: 0, closed: 0, spam: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const searchRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ view, channel: channelFilter, limit: '100' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/inbox/conversations?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConversations(data.conversations || [])
      setChannelCounts(data.channel_counts || {})
      setViewCounts(data.view_counts || { open: 0, hot: 0, unread: 0, snoozed: 0, closed: 0, spam: 0 })
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'load failed')
    } finally {
      setLoading(false)
    }
  }, [view, channelFilter, debouncedSearch])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('inbox_realtime')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'activities' }, fetchConversations)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'emails' }, fetchConversations)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'messages' }, fetchConversations)
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setConnected(true)
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchConversations])

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  )

  // Auto-select first conversation when list loads
  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations, selectedId])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement
      const isInputFocused = target.matches('input, textarea, [contenteditable="true"]')

      if (e.key === '?' && !isInputFocused) {
        e.preventDefault()
        setShowShortcuts((s) => !s)
        return
      }
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false)
        ;(document.activeElement as HTMLElement)?.blur()
        return
      }
      if (isInputFocused) return

      const currentIdx = conversations.findIndex((c) => c.id === selectedId)

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = conversations[Math.min(currentIdx + 1, conversations.length - 1)]
        if (next) setSelectedId(next.id)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = conversations[Math.max(currentIdx - 1, 0)]
        if (prev) setSelectedId(prev.id)
        return
      }
      if (e.key === 'r' && selected) {
        e.preventDefault()
        composerRef.current?.focus()
        return
      }
      if (e.key === 'e' && selected) {
        e.preventDefault()
        // Phase 1: just visual mark-archived — server-side в Phase 2
        alert('Архивация — Phase 2 (требует conversations table backfill)')
        return
      }
      if (e.key === 's' && selected) {
        e.preventDefault()
        alert('Snooze — Phase 2')
        return
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [conversations, selectedId, selected])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* LEFT — Sidebar with smart inboxes + channels */}
      <InboxSidebar
        view={view}
        channelFilter={channelFilter}
        viewCounts={viewCounts}
        channelCounts={channelCounts}
        connected={connected}
        onViewChange={(v) => {
          setView(v)
          setSelectedId(null)
        }}
        onChannelChange={(c) => {
          setChannelFilter(c)
          setSelectedId(null)
        }}
      />

      {/* MIDDLE — Conversation list */}
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        loading={loading}
        error={error}
        view={view}
        viewLabels={VIEW_LABELS}
        channelFilter={channelFilter}
        search={search}
        searchRef={searchRef}
        listRef={listRef}
        onSearchChange={setSearch}
        onSelect={(id) => setSelectedId(id)}
      />

      {/* RIGHT — Thread + Composer + ContactPanel */}
      <div className="flex-1 min-w-0 flex flex-col bg-white">
        {selected ? (
          <ThreadView
            key={selected.id}
            conversation={selected}
            composerRef={composerRef}
            onSent={() => fetchConversations()}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
            <div className="text-5xl mb-3">💬</div>
            <div className="text-sm">Выбери сообщение слева</div>
            <div className="text-[11px] mt-2 text-gray-500">
              Подсказка: жми <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border text-[10px]">?</kbd> чтобы увидеть hotkeys
            </div>
          </div>
        )}
      </div>

      {/* Shortcut overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowShortcuts(false)}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Клавиатурные сокращения</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-gray-700 text-xs">
                Esc / ✕
              </button>
            </div>
            <table className="w-full text-[12px]">
              <tbody className="divide-y divide-gray-50">
                {[
                  ['↑ / ↓', 'Навигация по списку'],
                  ['Enter', 'Открыть выбранное'],
                  ['r', 'Ответить (фокус composer)'],
                  ['e', 'Архивировать (Phase 2)'],
                  ['s', 'Отложить snooze (Phase 2)'],
                  ['/', 'Фокус на поиск'],
                  ['?', 'Эта подсказка'],
                  ['Cmd/Ctrl + Enter', 'Отправить сообщение'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-1.5 pr-3 align-top">
                      <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono">
                        {k}
                      </kbd>
                    </td>
                    <td className="py-1.5 text-gray-700">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
