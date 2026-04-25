'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const STAGE_META: Record<string, { label: string; color: string }> = {
  new:         { label: 'Новая',        color: '#378ADD' },
  qualified:   { label: 'Квалификация', color: '#27A882' },
  proposal:    { label: 'КП',           color: '#EF9F27' },
  negotiation: { label: 'Переговоры',   color: '#E87444' },
  won:         { label: 'Выиграна',     color: '#639922' },
  lost:        { label: 'Проиграна',    color: '#E24B4A' },
}

const EVENT_LABELS: Record<string, string> = {
  page_view:    '👁 Просмотр страницы',
  product_view: '📦 Просмотр товара',
  add_to_cart:  '🛒 В корзину',
  form_submit:  '📝 Форма отправлена',
  phone_click:  '📞 Клик по телефону',
  exit_intent:  '🚪 Намерение уйти',
  time_spent:   '⏱ Время на сайте',
  referral_click: '🔗 Реферальный клик',
}

const ACTIVITY_META: Record<string, { icon: string; bg: string }> = {
  call:      { icon: '📞', bg: '#E1F5EE' },
  email:     { icon: '✉️', bg: '#E6F1FB' },
  message:   { icon: '💬', bg: '#EEEDFE' },
  note:      { icon: '📝', bg: '#FAEEDA' },
  ai_action: { icon: '★',  bg: '#EEEDFE' },
  meeting:   { icon: '📅', bg: '#FAEEDA' },
}

function formatMoney(v: number) {
  if (!v) return '0 ₽'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}М ₽`
  if (v >= 1_000) return `${Math.round(v / 1_000)}К ₽`
  return `${v} ₽`
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}ч назад`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} дн назад`
  return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function ContactDetail({ contact, deals, activities, siteEvents }: {
  contact: any; deals: any[]; activities: any[]; siteEvents: any[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'activity' | 'deals' | 'behavior'>('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    full_name: contact.full_name || '',
    company_name: contact.company_name || '',
    phone: contact.phone || '',
    email: contact.email || '',
    telegram: contact.telegram || '',
    notes: contact.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [addingNote, setAddingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [localActivities, setLocalActivities] = useState(activities)

  const score = contact.ai_score || 0
  const scoreColor = score >= 70 ? '#E24B4A' : score >= 40 ? '#EF9F27' : '#378ADD'
  const segmentLabel = score >= 70 ? '🔴 Горячий' : score >= 40 ? '🟡 Тёплый' : '🔵 Холодный'

  const totalDealAmount = deals.reduce((s, d) => s + (d.amount || 0), 0)
  const wonAmount = deals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.amount || 0), 0)

  const saveContact = async () => {
    setSaving(true)
    await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, type: 'note', body: noteText, subject: 'Заметка' }),
    })
    const { activity } = await res.json()
    if (activity) setLocalActivities(prev => [activity, ...prev])
    setNoteText('')
    setAddingNote(false)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Шапка */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/contacts')}
            className="text-gray-400 hover:text-gray-600 text-sm">← Назад</button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-medium flex-shrink-0"
            style={{
              background: score >= 70 ? '#FCEBEB' : score >= 40 ? '#FAEEDA' : '#E6F1FB',
              color: score >= 70 ? '#A32D2D' : score >= 40 ? '#633806' : '#0C447C',
            }}>
            {(contact.company_name || contact.full_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-medium text-gray-900">{contact.full_name || 'Без имени'}</div>
            <div className="text-[11px] text-gray-500">{contact.company_name || '—'}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px]">{segmentLabel}</span>
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreColor }} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: scoreColor }}>{score}</span>
            </div>
          </div>
          <button onClick={() => setEditing(!editing)}
            className="text-[11px] border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            {editing ? 'Отмена' : 'Редактировать'}
          </button>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2 flex gap-2 flex-wrap">
        {contact.phone && (
          <a href={`tel:${contact.phone}`}
            className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100">
            📞 Позвонить
          </a>
        )}
        {contact.telegram && (
          <a href={`https://t.me/${contact.telegram.replace('@', '')}`} target="_blank"
            className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100">
            💬 Telegram
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`}
            className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100">
            ✉️ Email
          </a>
        )}
        <button onClick={() => { setAddingNote(true); setTab('activity') }}
          className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg hover:bg-yellow-100">
          📝 Заметка
        </button>
        <Link href="/deals"
          className="text-[10px] bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100">
          + Сделка
        </Link>
      </div>

      {/* Основной контент */}
      <div className="flex-1 overflow-hidden flex">
        {/* Левая колонка */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Контакт</div>
              {editing ? (
                <div className="space-y-2">
                  {[
                    { key: 'full_name',    label: 'Имя',      placeholder: 'Иван Петров' },
                    { key: 'company_name', label: 'Компания', placeholder: 'ООО ...' },
                    { key: 'phone',        label: 'Телефон',  placeholder: '+7...' },
                    { key: 'email',        label: 'Email',    placeholder: 'email@...' },
                    { key: 'telegram',     label: 'Telegram', placeholder: '@username' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] text-gray-500 block mb-0.5">{f.label}</label>
                      <input value={(form as any)[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full text-[11px] border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Заметки</label>
                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                      rows={3} placeholder="Заметки о клиенте..."
                      className="w-full text-[11px] border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400 resize-none"
                    />
                  </div>
                  <button onClick={saveContact} disabled={saving}
                    className="w-full text-[11px] bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Сохраняю...' : 'Сохранить'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: 'Телефон',  value: contact.phone },
                    { label: 'Email',    value: contact.email },
                    { label: 'Telegram', value: contact.telegram },
                    { label: 'Источник', value: contact.source },
                    { label: 'UTM',      value: contact.utm_source },
                  ].map(f => f.value && (
                    <div key={f.label} className="flex justify-between gap-2">
                      <span className="text-[10px] text-gray-400">{f.label}</span>
                      <span className="text-[11px] text-gray-700 text-right">{f.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Скоринг */}
            <div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">AI Скоринг</div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-gray-600">Балл</span>
                  <span className="text-[18px] font-medium" style={{ color: scoreColor }}>{score}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreColor }} />
                </div>
                <div className="text-[10px] text-gray-500">{segmentLabel}</div>
                {contact.ai_next_action && (
                  <div className="mt-2 bg-purple-50 rounded-lg p-2">
                    <div className="text-[9px] font-medium text-purple-700 mb-0.5">★ ИИ рекомендует</div>
                    <div className="text-[10px] text-purple-600">{contact.ai_next_action}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Статистика сделок */}
            <div>
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Сделки</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-[16px] font-medium text-gray-900">{deals.length}</div>
                  <div className="text-[9px] text-gray-500">Всего</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-[13px] font-medium text-green-700">{formatMoney(wonAmount)}</div>
                  <div className="text-[9px] text-green-600">Выиграно</div>
                </div>
              </div>
            </div>

            {contact.notes && !editing && (
              <div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Заметки</div>
                <div className="text-[11px] text-gray-600 bg-yellow-50 rounded-lg p-2 leading-relaxed whitespace-pre-wrap">
                  {contact.notes}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 flex">
            {[
              { key: 'overview',  label: 'Обзор' },
              { key: 'activity',  label: `Активность (${localActivities.length})` },
              { key: 'deals',     label: `Сделки (${deals.length})` },
              { key: 'behavior',  label: `Поведение (${siteEvents.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                className={`px-4 py-2.5 text-[11px] border-b-2 transition-all ${tab === t.key ? 'text-blue-600 border-blue-600 font-medium' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* ОБЗОР */}
            {tab === 'overview' && (
              <div className="space-y-4">
                {deals.filter(d => !['won', 'lost'].includes(d.stage)).length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 text-[12px] font-medium text-gray-900">Активные сделки</div>
                    {deals.filter(d => !['won', 'lost'].includes(d.stage)).slice(0, 3).map(deal => {
                      const sm = STAGE_META[deal.stage] || { label: deal.stage, color: '#888' }
                      return (
                        <div key={deal.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                          <div className="flex-1">
                            <div className="text-[12px] font-medium text-gray-800">{deal.title}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{timeAgo(deal.created_at)}</div>
                          </div>
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: sm.color + '22', color: sm.color }}>{sm.label}</span>
                          {deal.amount && <span className="text-[11px] font-medium text-gray-700">{formatMoney(deal.amount)}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
                {localActivities.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 text-[12px] font-medium text-gray-900">Последние действия</div>
                    {localActivities.slice(0, 3).map(act => {
                      const meta = ACTIVITY_META[act.type] || { icon: '•', bg: '#F1EFE8' }
                      return (
                        <div key={act.id} className="flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] flex-shrink-0"
                            style={{ background: meta.bg }}>{meta.icon}</div>
                          <div className="flex-1">
                            <div className="text-[11px] text-gray-800">{act.subject || act.body?.substring(0, 60)}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{timeAgo(act.created_at)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {deals.length === 0 && localActivities.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-[12px]">
                    Нет данных. Создайте первую сделку или добавьте заметку.
                  </div>
                )}
              </div>
            )}

            {/* АКТИВНОСТЬ */}
            {tab === 'activity' && (
              <div className="space-y-3">
                {addingNote && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                      placeholder="Введите заметку..." rows={3}
                      className="w-full text-[12px] bg-transparent border-none outline-none resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={addNote} className="text-[11px] bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700">
                        Сохранить
                      </button>
                      <button onClick={() => setAddingNote(false)} className="text-[11px] text-gray-500 px-3 py-1.5">Отмена</button>
                    </div>
                  </div>
                )}
                {localActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-[12px]">Нет активностей</div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {localActivities.map(act => {
                      const meta = ACTIVITY_META[act.type] || { icon: '•', bg: '#F1EFE8' }
                      return (
                        <div key={act.id} className="flex gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] flex-shrink-0"
                            style={{ background: meta.bg }}>{meta.icon}</div>
                          <div className="flex-1">
                            <div className="text-[12px] font-medium text-gray-800">{act.subject || act.type}</div>
                            {act.body && <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{act.body}</div>}
                            <div className="text-[10px] text-gray-400 mt-1">{timeAgo(act.created_at)}</div>
                          </div>
                          {act.is_ai_generated && (
                            <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded h-fit">ИИ</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* СДЕЛКИ */}
            {tab === 'deals' && (
              <div className="space-y-2">
                {deals.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-[12px]">Нет сделок</div>
                ) : deals.map(deal => {
                  const sm = STAGE_META[deal.stage] || { label: deal.stage, color: '#888' }
                  return (
                    <div key={deal.id} className="bg-white border border-gray-200 rounded-xl p-3"
                      style={{ borderLeft: `3px solid ${sm.color}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-[12px] font-medium text-gray-900">{deal.title}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{timeAgo(deal.created_at)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[12px] font-medium text-gray-900">{formatMoney(deal.amount)}</div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: sm.color + '22', color: sm.color }}>{sm.label}</span>
                        </div>
                      </div>
                      {deal.ai_win_probability > 0 && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${deal.ai_win_probability}%`, background: sm.color }} />
                          </div>
                          <span className="text-[9px] text-gray-400">{deal.ai_win_probability}% победы</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ПОВЕДЕНИЕ */}
            {tab === 'behavior' && (
              <div>
                {siteEvents.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-[12px]">
                    Нет данных о поведении.<br />
                    <span className="text-[11px]">Появятся после подключения трекинга.</span>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {siteEvents.map((event, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                        <span className="text-[12px] w-5 text-center flex-shrink-0">
                          {(EVENT_LABELS[event.event_type] || '•').split(' ')[0]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-gray-700">
                            {EVENT_LABELS[event.event_type]?.substring(2) || event.event_type}
                          </div>
                          {event.url && <div className="text-[10px] text-gray-400 truncate">{event.url}</div>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] text-gray-400">{timeAgo(event.created_at)}</div>
                          {event.device && <div className="text-[9px] text-gray-300">{event.device}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
