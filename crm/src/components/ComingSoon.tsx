import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Generic placeholder для разделов которые ещё не реализованы.
 * Sergey directive 2026-06-03 — Столица tenant имеет свой sidebar с разделами,
 * но full schema для drivers/cars/trips/payouts ещё не создана. Каждая страница
 * показывает что планируется и оставляет кнопку «← Назад».
 */
interface Props {
  title: string
  description: string
  icon: string
  planned?: string[]
}

export default function ComingSoon({ title, description, icon, planned = [] }: Props) {
  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Назад
      </Link>

      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="text-5xl mb-4">{icon}</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 leading-relaxed mb-6 max-w-2xl">{description}</p>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full text-xs font-medium text-yellow-700 mb-6">
          <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
          В разработке — Phase 2
        </div>

        {planned.length > 0 && (
          <div className="border-t border-gray-100 pt-6 mt-2">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Что планируется:</h2>
            <ul className="space-y-2">
              {planned.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-gray-400">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-100 text-xs text-gray-500">
          Sergey directive 2026-06-03 — multitenant CRM, Столица — отдельный продукт
          от Металлпортала. Скажи приоритеты Ивану — что делать первым.
        </div>
      </div>
    </div>
  )
}
