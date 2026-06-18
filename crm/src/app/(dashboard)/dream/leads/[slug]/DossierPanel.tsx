'use client'

/**
 * Панель ДОСЬЕ на карточке лида (TASK_015).
 * Все статусы и подписи — только по-русски.
 *
 * Inline-редактирование: клик на значение → input → blur/Enter → PATCH /api/dream/leads/[slug].
 * Пустые поля показываем как «—», НЕ скрываем (видно что дозаполнить).
 */
import { useState } from 'react'

const SALES_STAGE_RU: Record<string, string> = {
  site_ready:   'Сайт готов',
  to_call:      'К обзвону',
  no_answer:    'Недозвон',
  reached:      'Дозвонились',
  qualified:    'Квалифицирован',
  link_sent:    'Ссылка отправлена',
  negotiating:  'Переговоры',
  callback:     'Перезвонить',
  won:          'Куплен',
  lost:         'Отказ',
  disqualified: 'Не целевой',
}
const QUALIFICATION_RU: Record<string, string> = {
  qualified:    'Целевой',
  disqualified: 'Не целевой',
  unknown:      'Не определён',
  callback:     'Перезвонить',
}
const BUILD_STATUS_RU: Record<string, string> = {
  parsed:        'Спарсен',
  enriching:     'Идёт проверка',
  plan_proposed: 'План готов',
  approved:      'Утверждён',
  building:      'Сборка сайта',
  built:         'Сайт собран',
  review_built:  'Проверка сайта',
  for_sale:      'В продаже',
  selling:       'Продаётся',
  sold:          'Продан',
  lost:          'Отказ',
  trash:         'В мусоре',
}
const CHANNEL_RU: Record<string, string> = {
  voice: 'Звонок', sms: 'СМС', email: 'Email',
  telegram: 'Telegram', whatsapp: 'WhatsApp', max: 'MAX', vk: 'ВКонтакте',
}

interface Lead { slug: string; [k: string]: any }

function fmt(v: any, dash = '—'): string {
  if (v == null || v === '') return dash
  return String(v)
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}
function fmtMinutes(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  return m >= 1 ? `${m} мин ${sec % 60} с` : `${sec} с`
}

export function DossierPanel({ lead: initialLead }: { lead: Lead }) {
  const [lead, setLead] = useState<Lead>(initialLead)
  const [saving, setSaving] = useState<string | null>(null)

  async function save(field: string, value: any) {
    setSaving(field)
    const r = await fetch(`/api/dream/leads/${lead.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    setSaving(null)
    if (r.ok) setLead((l) => ({ ...l, [field]: value }))
    else alert('Не удалось сохранить')
  }

  return (
    <aside className="bg-white border border-gray-200 rounded-xl p-4 sticky top-0">
      {/* СЛЕДУЮЩЕЕ ДЕЙСТВИЕ — заметным верхом */}
      <div className={`rounded-lg p-3 mb-4 ${
        lead.next_action_at
          ? 'bg-amber-50 border-2 border-amber-300'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <div className="text-[10px] uppercase font-bold text-amber-700 mb-1">⏰ Следующее действие</div>
        {lead.next_action_at ? (
          <>
            <div className="text-[14px] font-semibold text-gray-900">{fmtDateTime(lead.next_action_at)}</div>
            <div className="text-[12px] text-gray-700 mt-0.5">{fmt(lead.next_action_goal, 'цель не задана')}</div>
            <div className="text-[10px] text-gray-500 mt-1">
              {lead.next_action_by === 'robot' ? '🤖 поставил робот' : `👤 ${lead.next_action_by ?? 'кто-то'}`}
            </div>
          </>
        ) : (
          <div className="text-[12px] text-gray-500 italic">Не задано</div>
        )}
      </div>

      {/* КОНТАКТ */}
      <Section title="📇 Контакт">
        <Field label="Имя"           value={lead.contact_name}      onSave={(v) => save('contact_name', v)}     saving={saving === 'contact_name'} />
        <Field label="Должность"     value={lead.contact_position}  onSave={(v) => save('contact_position', v)} saving={saving === 'contact_position'} />
        <Field label="Email"         value={lead.contact_email}     onSave={(v) => save('contact_email', v)}    saving={saving === 'contact_email'} />
        <Field label="Телефон"       value={lead.phone}             readonly />
      </Section>

      {/* ЛПР */}
      <Section title="👔 Ответственное лицо (ЛПР)">
        <Field label="Имя"     value={lead.decision_maker_name}  onSave={(v) => save('decision_maker_name', v)}  saving={saving === 'decision_maker_name'} />
        <Field label="Телефон" value={lead.decision_maker_phone} onSave={(v) => save('decision_maker_phone', v)} saving={saving === 'decision_maker_phone'} />
      </Section>

      {/* КОМПАНИЯ */}
      <Section title="🏢 Компания">
        <Field label="Название" value={lead.name}    readonly />
        <Field label="Ниша"     value={lead.niche}   readonly />
        <Field label="Адрес"    value={lead.address} readonly />
        <Field label="Метро"    value={lead.metro_nearest} readonly />
        <Field label="Рейтинг"  value={lead.rating ? `${lead.rating} ★ (${lead.reviews_count ?? 0} отз.)` : null} readonly />
        <Field label="Сайт"     value={lead.website_url}  onSave={(v) => save('website_url', v)} saving={saving === 'website_url'} />
        <Field label="Часы"     value={lead.hours_json?.is_24_7 ? '24/7' : (lead.hours_json?.current_status ?? null)} readonly />
      </Section>

      {/* ИНТЕРЕС */}
      <Section title="🎯 Интерес/потребность">
        <Field label="Что хочет" value={lead.interest} onSave={(v) => save('interest', v)} saving={saving === 'interest'} multiline />
        <Field label="Канал"     value={lead.preferred_channel ? CHANNEL_RU[lead.preferred_channel] ?? lead.preferred_channel : null}
               onSave={(v) => save('preferred_channel', v)} saving={saving === 'preferred_channel'} />
      </Section>

      {/* ВОРОНКА */}
      <Section title="🔻 Воронка">
        <SelectField label="Стадия продаж" value={lead.sales_stage} options={SALES_STAGE_RU}
                     onSave={(v) => save('sales_stage', v)} saving={saving === 'sales_stage'} />
        <SelectField label="Квалификация"  value={lead.qualification} options={QUALIFICATION_RU}
                     onSave={(v) => save('qualification', v)} saving={saving === 'qualification'} />
        <Field label="Производство" value={BUILD_STATUS_RU[lead.build_status] ?? lead.build_status} readonly />
        <Field label="Попыток звонков" value={lead.call_attempts ? String(lead.call_attempts) : null} readonly />
      </Section>

      {/* ПОВЕДЕНИЕ */}
      <Section title="👁 Поведение на сайте">
        <Field label="Посещений"     value={lead.visits_count ? String(lead.visits_count) : '0'} readonly />
        <Field label="Последний визит" value={lead.last_visit_at ? fmtDateTime(lead.last_visit_at) : null} readonly />
        <Field label="Время на сайте" value={fmtMinutes(lead.total_time_on_site_sec)} readonly />
        <Field label="Прокрутил до"   value={lead.max_scroll_pct ? `${lead.max_scroll_pct} %` : null} readonly />
      </Section>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  )
}

function Field({ label, value, onSave, saving, readonly, multiline }: {
  label: string; value: any; onSave?: (v: string) => void;
  saving?: boolean; readonly?: boolean; multiline?: boolean;
}) {
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState<string>(value ?? '')

  function commit() {
    setEdit(false)
    if (draft !== (value ?? '') && onSave) onSave(draft)
  }
  function cancel() { setEdit(false); setDraft(value ?? '') }

  if (edit && !readonly && onSave) {
    if (multiline) {
      return (
        <div className="grid grid-cols-[100px_1fr] gap-2 items-start text-[12px]">
          <dt className="text-gray-500 pt-1.5">{label}</dt>
          <dd>
            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Escape') cancel(); if (e.ctrlKey && e.key === 'Enter') commit() }}
              rows={3}
              className="w-full border border-blue-300 rounded px-1.5 py-1 text-[12px] focus:outline-none focus:border-blue-500 resize-none"/>
          </dd>
        </div>
      )
    }
    return (
      <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline text-[12px]">
        <dt className="text-gray-500">{label}</dt>
        <dd>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-[12px] focus:outline-none focus:border-blue-500"/>
        </dd>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline text-[12px] group">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`${readonly ? 'text-gray-700' : 'text-gray-900 cursor-pointer hover:bg-blue-50 rounded px-1'}`}
          onClick={() => { if (!readonly && onSave) { setDraft(value ?? ''); setEdit(true) } }}>
        {value == null || value === '' ? <span className="text-gray-300">—</span> : <span>{String(value)}</span>}
        {!readonly && onSave && (
          <span className="text-[9px] text-blue-400 opacity-0 group-hover:opacity-100 ml-1">✎</span>
        )}
        {saving && <span className="text-[9px] text-amber-500 ml-1">сохраняю…</span>}
      </dd>
    </div>
  )
}

function SelectField({ label, value, options, onSave, saving }: {
  label: string; value: string; options: Record<string, string>;
  onSave: (v: string) => void; saving?: boolean;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 items-baseline text-[12px]">
      <dt className="text-gray-500">{label}</dt>
      <dd>
        <select value={value ?? ''} onChange={(e) => onSave(e.target.value)}
          className="border border-gray-200 rounded px-1.5 py-0.5 text-[12px] bg-white focus:outline-none focus:border-blue-400">
          {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {saving && <span className="text-[9px] text-amber-500 ml-1">сохраняю…</span>}
      </dd>
    </div>
  )
}
