/**
 * Короткая команда для агента:
 *   curl -s https://metallportal-crm2.vercel.app/api/dream/agent-help
 *
 * Отдаёт plain-text AGENT_QUICK_START.md — агент сразу видит как
 * правильно работать с CRM (куда писать сайты, как регистрировать,
 * какие воронки, какие правила).
 *
 * Без auth — публичная инструкция (никаких секретов внутри, только пути API).
 */
import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'dream-docs', 'AGENT_QUICK_START.md')
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return new NextResponse(content, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (e: any) {
    return new NextResponse(`# Error loading agent help: ${e.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
