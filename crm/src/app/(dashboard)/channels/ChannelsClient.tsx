'use client'
import { useState } from 'react'
import { ChannelCard } from './ChannelCard'
import { ChannelSettingsModal } from './ChannelSettingsModal'

export const AVAILABLE_CHANNELS = [
  { type: 'yandex_direct',   name: 'Яндекс.Директ',    icon: 'Я',   color: '#FFDB4D', textColor: '#996600', desc: 'Поисковая реклама' },
  { type: 'yandex_rsy',      name: 'Яндекс РСЯ',        icon: 'РСЯ', color: '#FAEEDA', textColor: '#633806', desc: 'Медийная сеть' },
  { type: 'vk_ads',          name: 'VK Реклама',         icon: 'VK',  color: '#E6F1FB', textColor: '#0C447C', desc: 'Таргет B2B' },
  { type: 'vk_community',    name: 'VK Сообщество',      icon: 'VK',  color: '#E6F1FB', textColor: '#0C447C', desc: 'Контент' },
  { type: 'telegram_channel',name: 'Telegram канал',     icon: 'TG',  color: '#E1F5EE', textColor: '#085041', desc: 'Подписчики' },
  { type: 'telegram_ads',    name: 'Telegram Ads',       icon: 'TG',  color: '#E1F5EE', textColor: '#085041', desc: 'Реклама в каналах' },
  { type: 'google_ads',      name: 'Google Ads',         icon: 'G',   color: '#FCEBEB', textColor: '#791F1F', desc: 'Поиск + КМС' },
  { type: 'email',           name: 'Email рассылки',     icon: '@',   color: '#EEEDFE', textColor: '#3C3489', desc: 'Resend / SMTP' },
  { type: 'whatsapp',        name: 'WhatsApp',           icon: 'W',   color: '#EAF3DE', textColor: '#27500A', desc: 'WABA массовые' },
  { type: 'tracking',        name: 'Трекинг сайта',      icon: 'JS',  color: '#EAF3DE', textColor: '#27500A', desc: 'Аналитика' },
  { type: 'youtube',         name: 'YouTube',            icon: 'YT',  color: '#FCEBEB', textColor: '#791F1F', desc: 'Видео контент' },
  { type: 'dzen',            name: 'Яндекс Дзен',        icon: 'Д',   color: '#FAEEDA', textColor: '#633806', desc: 'Статьи · SEO' },
  { type: 'tenders',         name: 'Тендеры',            icon: 'T',   color: '#F1EFE8', textColor: '#444441', desc: '44-ФЗ · 223-ФЗ' },
  { type: 'referral',        name: 'Реферальная',        icon: 'R',   color: '#EAF3DE', textColor: '#27500A', desc: 'Партнёры · %' },
  { type: 'sms',             name: 'SMS',                icon: 'SMS', color: '#EEEDFE', textColor: '#3C3489', desc: 'Уведомления' },
]

const TABS = ['Все', 'Реклама', 'Контент', 'Мессенджеры', 'Трекинг']
const TAB_FILTERS: Record<string, string[]> = {
  'Реклама':      ['yandex_direct', 'yandex_rsy', 'vk_ads', 'google_ads', 'telegram_ads'],
  'Контент':      ['vk_community', 'telegram_channel', 'youtube', 'dzen'],
  'Мессенджеры':  ['telegram_channel', 'whatsapp', 'sms', 'email'],
  'Трекинг':      ['tracking', 'referral', 'tenders'],
}

export function ChannelsClient({ initialChannels }: { initialChannels: any[] }) {
  const [channels, setChannels] = useState(initialChannels)
  const [activeTab, setActiveTab] = useState('Все')
  const [editChannel, setEditChannel] = useState<any>(null)
  const [adding, setAdding] = useState<string | null>(null)

  const connected = channels.filter(c => c.status !== 'inactive')
  const notConnected = channels.filter(c => c.status === 'inactive')
  const connectedTypes = channels.map((c: any) => c.type)
  const availableToAdd = AVAILABLE_CHANNELS.filter(c => !connectedTypes.includes(c.type))

  const filtered = activeTab === 'Все'
    ? channels
    : channels.filter((c: any) => TAB_FILTERS[activeTab]?.includes(c.type))

  const handleUpdate = (updated: any) => {
    setChannels(prev => prev.map((c: any) => c.id === updated.id ? updated : c))
    setEditChannel(null)
  }

  const handleAdd = async (type: string, name: string) => {
    setAdding(type)
    try {
      const res = await fetch('/api/channels/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name }),
      })
      const { channel } = await res.json()
      if (channel) {
        setChannels(prev => [...prev, channel])
        setEditChannel(channel)
      }
    } finally {
      setAdding(null)
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/channels/${id}`, { method: 'DELETE' })
    setChannels(prev => prev.filter((c: any) => c.id !== id))
  }

  const filteredConnected = filtered.filter((c: any) => c.status !== 'inactive')
  const filteredNotConnected = filtered.filter((c: any) => c.status === 'inactive')
  const availableFiltered = activeTab === 'Все'
    ? availableToAdd
    : availableToAdd.filter(c => TAB_FILTERS[activeTab]?.includes(c.type))

  return (
    <div className="p-4 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-medium text-gray-900">Каналы</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {connected.length} подключено · {availableToAdd.length} доступно
          </p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-0 border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[11px] border-b-2 transition-all flex-shrink-0 ${
              activeTab === tab
                ? 'text-blue-600 border-blue-600 font-medium'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Подключённые */}
      {filteredConnected.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Подключённые</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredConnected.map((ch: any) => (
              <ChannelCard key={ch.id} channel={ch}
                onEdit={() => setEditChannel(ch)}
                onDelete={() => handleDelete(ch.id)}
                onUpdate={handleUpdate} />
            ))}
          </div>
        </div>
      )}

      {/* Не настроены */}
      {filteredNotConnected.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Не настроены</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredNotConnected.map((ch: any) => (
              <ChannelCard key={ch.id} channel={ch}
                onEdit={() => setEditChannel(ch)}
                onDelete={() => handleDelete(ch.id)}
                onUpdate={handleUpdate} />
            ))}
          </div>
        </div>
      )}

      {/* Доступны для добавления */}
      {availableFiltered.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Доступны для подключения</div>
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {availableFiltered.map(ch => (
                <button key={ch.type}
                  disabled={adding === ch.type}
                  onClick={() => handleAdd(ch.type, ch.name)}
                  className="border border-gray-200 rounded-lg p-3 text-center hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold mx-auto mb-1.5"
                    style={{ background: ch.color, color: ch.textColor }}
                  >
                    {adding === ch.type ? '...' : ch.icon}
                  </div>
                  <div className="text-[10px] font-medium text-gray-800 leading-tight">{ch.name}</div>
                  <div className="text-[9px] text-gray-500 mt-0.5">{ch.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {channels.length === 0 && availableFiltered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-[32px] mb-3">◈</div>
          <div className="text-[13px] font-medium">Нет каналов</div>
          <div className="text-[11px] mt-1">Выполните SQL миграцию в Supabase</div>
        </div>
      )}

      {editChannel && (
        <ChannelSettingsModal
          channel={editChannel}
          onClose={() => setEditChannel(null)}
          onSave={handleUpdate}
        />
      )}
    </div>
  )
}
