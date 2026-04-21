import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate, getContactStatusLabel, getScoreBgColor, getScoreColor, getSegmentLabel, getActionTypeLabel } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Phone, Mail, MessageCircle } from 'lucide-react'

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (!contact) notFound()

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: deals } = await supabase
    .from('deals')
    .select('id, title, amount, stage, ai_win_probability')
    .eq('contact_id', id)

  const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-300',
    active: 'bg-green-500/20 text-green-300',
    inactive: 'bg-gray-500/20 text-gray-400',
    blocked: 'bg-red-500/20 text-red-300',
  }

  const ACTIVITY_ICONS: Record<string, string> = {
    call: '📞', email: '✉️', message: '💬', note: '📝',
    meeting: '🤝', task: '✅', site_visit: '🌐', ai_action: '🤖',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contacts" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {contact.full_name || contact.company_name || 'Контакт'}
          </h1>
          {contact.company_name && contact.full_name && (
            <p className="text-gray-400 text-sm">{contact.company_name}</p>
          )}
        </div>
        {contact.status && (
          <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[contact.status] ?? ''}`}>
            {getContactStatusLabel(contact.status)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold text-sm">Контактные данные</h2>
            {contact.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{contact.phone}</span>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{contact.email}</span>
              </div>
            )}
            {contact.telegram && (
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{contact.telegram}</span>
              </div>
            )}
            {!contact.phone && !contact.email && !contact.telegram && (
              <p className="text-gray-500 text-sm">Нет данных</p>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-white font-semibold text-sm">ИИ-оценка</h2>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreBgColor(contact.ai_score)}`}
                  style={{ width: `${contact.ai_score}%` }}
                />
              </div>
              <span className={`text-lg font-bold ${getScoreColor(contact.ai_score)}`}>
                {contact.ai_score}
              </span>
            </div>
            {contact.ai_segment && (
              <p className="text-sm">{getSegmentLabel(contact.ai_segment)}</p>
            )}
            {contact.ai_next_action && (
              <div className="pt-2 border-t border-gray-800">
                <p className="text-gray-400 text-xs mb-1">Следующий шаг</p>
                <p className="text-gray-300 text-sm">{contact.ai_next_action}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2.5">
            <h2 className="text-white font-semibold text-sm">Метаданные</h2>
            <div className="space-y-2">
              {[
                ['Источник', contact.source],
                ['Тип', contact.type],
                ['UTM source', contact.utm_source],
                ['UTM campaign', contact.utm_campaign],
                ['Создан', formatDate(contact.created_at)],
                ['Последний контакт', formatDate(contact.last_contact_at)],
              ].map(([label, val]) =>
                val ? (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-gray-500 text-xs">{label}</span>
                    <span className="text-gray-300 text-xs text-right">{val}</span>
                  </div>
                ) : null
              )}
            </div>
            {contact.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {contact.tags.map((tag: string) => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {deals && deals.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-3">Сделки</h2>
              <div className="space-y-2">
                {deals.map((d) => (
                  <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                    <div className="flex-1">
                      <p className="text-white text-sm">{d.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{d.stage}</p>
                    </div>
                    {d.amount && (
                      <span className="text-green-400 text-sm font-medium">
                        {new Intl.NumberFormat('ru-RU').format(d.amount)} ₽
                      </span>
                    )}
                    <span className="text-blue-400 text-xs">{d.ai_win_probability}%</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4">История активностей</h2>
            {!activities || activities.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Активностей пока нет</p>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <span className="text-lg leading-none mt-0.5 flex-shrink-0">
                      {ACTIVITY_ICONS[a.type] ?? '📌'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-300 text-sm font-medium">{a.subject || a.type}</p>
                        {a.is_ai_generated && (
                          <span className="text-xs text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">ИИ</span>
                        )}
                      </div>
                      {a.body && (
                        <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{a.body}</p>
                      )}
                      <p className="text-gray-600 text-xs mt-1">{formatDate(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {contact.notes && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-2">Заметки</h2>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
