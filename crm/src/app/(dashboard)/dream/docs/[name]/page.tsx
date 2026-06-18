/**
 * Универсальный вьюер документов проекта Мечта.
 * Читает .md файл из crm/public/dream-docs/[name].md и рендерит как preformatted text.
 *
 * Sergey directive 2026-06-18: все спеки и правила должны быть видны прямо в CRM,
 * чтобы агенты и оператор не лазили в файлы на маке.
 */
import fs from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const DOCS: Record<string, { title: string; emoji: string; descr: string }> = {
  AGENT_QUICK_START:           { title: 'AGENT QUICK START (читать всем агентам)', emoji: '🤖', descr: 'Полная инструкция за 5 минут: куда что писать, почему сайт не появляется в канбане, короткая команда' },
  ARCHITECTURE:                { title: 'Архитектура проекта',         emoji: '📐', descr: 'Главная спека — 3 слоя, 12 состояний воронки, схема БД, API, UI' },
  HANDS_AGENT_PROTOCOL:        { title: 'Протокол агентов-«Рук»',     emoji: '🤖', descr: 'Что должен делать каждый агент: формат отчёта, эскалации, запреты' },
  CRM_DATA_CONTRACT:           { title: 'Data Contract (для парсера)', emoji: '📊', descr: 'Куда парсер пишет в БД: tenant, таблицы, идемпотентность, pre-flight check' },
  LANDING_FACTORY_AGENT_GUIDE: { title: 'Гайд агента-кодера',          emoji: '🎨', descr: 'Откуда брать данные → как генерить лендинг → куда деплоить' },
  APPROVAL_WORKFLOW:           { title: 'Approval-first workflow',     emoji: '✅', descr: 'Цепочка состояний build_status, кто что переводит' },
  SALES_KANBAN_MESSENGER_SPEC: { title: 'Sales-канбан + Звонки',       emoji: '💼', descr: 'TASK_011: продажная воронка, /dream/board, /dream/calls, Messenger' },
  CLOUDFLARE_WORKER_TRACKER:   { title: 'Cloudflare Worker (Tracker)',  emoji: '🌐', descr: 'TASK_012: трекинг визитов, Worker code, beacon-script для лендингов' },
}

export default async function DocViewerPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const meta = DOCS[name]
  if (!meta) return notFound()

  const filePath = path.join(process.cwd(), 'public', 'dream-docs', `${name}.md`)
  let content: string
  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch {
    return notFound()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <Link href="/dream/docs" className="text-[12px] text-blue-600 hover:underline">← Все документы</Link>
      <h1 className="text-[22px] font-semibold mt-2 mb-1">
        {meta.emoji} {meta.title}
      </h1>
      <p className="text-[12px] text-gray-500 mb-6">{meta.descr}</p>

      <article className="bg-white border border-gray-200 rounded-xl p-5">
        <pre className="whitespace-pre-wrap break-words text-[12px] leading-[1.6] text-gray-800 font-mono">
{content}
        </pre>
      </article>

      <p className="text-[10px] text-gray-400 mt-6 text-center">
        Источник: <code>~/Documents/Claude/Projects/Мечта/...</code> (синхронизировано с CRM при деплое)
      </p>
    </div>
  )
}
