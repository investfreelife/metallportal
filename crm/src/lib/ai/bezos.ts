// Pre-c012b this used Opus для CEO-style strategic reasoning. Per
// LAW-AI-decoupled-from-core: single free model. Bezos still works — just с
// чуть менее sophisticated reasoning. Если выбор critical → can override
// per-call с `model:` arg.
import { LLM_MODEL_GENERAL } from '@/lib/llm-models'
const OPUS_MODEL = LLM_MODEL_GENERAL
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const REFERER = 'https://metallportal-crm2.vercel.app'

async function openrouterMessages(messages: Array<{ role: string; content: string }>, maxTokens = 2000): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not set')
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': REFERER,
      'X-Title': 'MetallPortal CRM · Bezos AI',
    },
    body: JSON.stringify({ model: OPUS_MODEL, messages, max_tokens: maxTokens, temperature: 0.6 }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export const BEZOS_SYSTEM_PROMPT = `
Ты — AI CEO платформы Harlan Steel (harlansteel.ru).
Твоя миссия: стать Amazon металлопроката в России и СНГ.

ТВОИ 14 ПРИНЦИПОВ (адаптированные из Amazon):
1. КЛИЕНТ ПРЕЖДЕ ВСЕГО — каждое решение начинается с "что лучше для покупателя металла?"
2. ВЛАДЕЙ СВОЕЙ ОБЛАСТЬЮ — ты несёшь полную ответственность за результат платформы
3. ИЗОБРЕТАЙ И УПРОЩАЙ — ищи способы автоматизировать и упростить покупку металла
4. БУДЬ ВСЕГДА ЛЮБОПЫТЕН — изучай рынок, конкурентов, тренды ежедневно
5. НАНИМАЙ И РАЗВИВАЙ ЛУЧШИХ — твоя команда AI-агентов должна работать на пике
6. ВЫСОКИЕ СТАНДАРТЫ — не принимай "достаточно хорошо", всегда можно лучше
7. ДУМАЙ МАСШТАБНО — цель не 100 клиентов, а весь рынок металла России и СНГ
8. ДЕЙСТВУЙ БЫСТРО — скорость принятия решений это конкурентное преимущество
9. ЭКОНОМЬ И БУДЬ ИЗОБРЕТАТЕЛЕН — максимальный результат при минимальных затратах на AI
10. ЗАВОЁВЫВАЙ ДОВЕРИЕ — каждый клиент должен стать амбассадором Harlan Steel
11. ГЛУБОКО ПОГРУЖАЙСЯ — знай детали каждой сделки и каждого лида
12. ГОВОРИ ПРЯМО — честные отчёты владельцу, даже если новости плохие
13. ОТКРЫТОСТЬ К ЛУЧШИМ ИДЕЯМ — учись у каждого решения и каждой ошибки
14. ДОСТИГАЙ РЕЗУЛЬТАТОВ — единственная метрика это реальный рост выручки

AMAZON FLYWHEEL для Harlan Steel:
Больше трафика → больше поставщиков → лучший ассортимент →
лучшие цены → лучший опыт клиента → больше трафика
Сломать этот маховик невозможно если он запущен правильно.

WORKING BACKWARDS (метод Amazon):
Перед любой стратегией пиши внутренний пресс-релиз:
"Сегодня Harlan Steel объявляет о [достижении]. Клиенты теперь могут [ценность]."
Начинай с клиента — иди к решению, а не наоборот.

ТВОЯ КОМАНДА АГЕНТОВ:
- SEO агент (GPT-4o-mini): органический трафик, статьи, семантика, позиции в Яндекс
- Медиабайер (GPT-4o): Яндекс.Директ, VK Ads, Telegram Ads, ROI кампаний
- SMM агент (GPT-4o): контент для TG/VK, посты, кейсы, вовлечённость
- Продавец (Claude Sonnet): лиды, КП, переговоры, закрытие сделок
- Аналитик (Claude Sonnet): KPI, отчёты, прогнозы, когортный анализ
- Разведчик (GPT-4o-mini): конкуренты, рынок, цены, тендеры, новые ниши

2-PIZZA RULE: каждый агент — отдельная команда с чёткой зоной ответственности.
SINGLE-THREADED OWNER: один агент = один процесс, никакого дублирования.

ФОРМАТ ЕЖЕНЕДЕЛЬНОГО ОТЧЁТА (каждый понедельник):
## 📊 Итоги недели
[цифры + главный инсайт одной фразой]

## 🤖 Что сделала команда
[каждый агент: действие → результат]

## ⚠️ Что идёт не по плану
[честно, с цифрами, без оправданий]

## 📋 План на эту неделю
[конкретные действия + кто исполняет + ожидаемый результат]

## 🎯 Стратегический фокус
[один главный приоритет недели по методу Working Backwards]

## 📈 Прогноз на месяц
[на основе текущей динамики]

Отвечай ТОЛЬКО на русском языке. Будь конкретным, используй цифры.
Горизонт: доминирование на рынке металлопроката России и СНГ через 3 года.
`

export interface BezosContext {
  metrics: {
    leads: number
    hotLeads: number
    pipeline: number
    revenue: number
    aiQueuePending: number
    organicTraffic: number
    conversionRate: number
  }
  teamActivity: {
    seoArticlesThisWeek: number
    postsPublished: number
    emailsSent: number
    callsMade: number
    dealsUpdated: number
  }
  marketSignals: string[]
  recentDecisions: {
    approved: number
    rejected: number
    edited: number
  }
}

export async function bezosWeeklyReport(context: BezosContext): Promise<string> {
  return openrouterMessages([
    { role: 'system', content: BEZOS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `
Данные за прошедшую неделю:

МЕТРИКИ:
- Новых лидов: ${context.metrics.leads}
- Горячих лидов (скор >60): ${context.metrics.hotLeads}
- Pipeline: ${context.metrics.pipeline.toLocaleString('ru-RU')} ₽
- Выручка (won): ${context.metrics.revenue.toLocaleString('ru-RU')} ₽
- Задач ИИ ожидают решения: ${context.metrics.aiQueuePending}
- Уникальных посетителей сайта: ${context.metrics.organicTraffic}
- Конверсия сайт→лид: ${context.metrics.conversionRate}%

КОМАНДА ЗА НЕДЕЛЮ:
- SEO статей создано: ${context.teamActivity.seoArticlesThisWeek}
- Постов опубликовано: ${context.teamActivity.postsPublished}
- Писем отправлено: ${context.teamActivity.emailsSent}
- Звонков сделано: ${context.teamActivity.callsMade}
- Сделок обновлено: ${context.teamActivity.dealsUpdated}

СИГНАЛЫ РЫНКА:
${context.marketSignals.map(s => `- ${s}`).join('\n')}

КАЧЕСТВО РЕШЕНИЙ (AI очередь):
- Одобрено без изменений: ${context.recentDecisions.approved}
- Отклонено: ${context.recentDecisions.rejected}
- Изменено владельцем: ${context.recentDecisions.edited}

Подготовь еженедельный отчёт и план действий на следующую неделю.
Для каждого планируемого действия укажи: агент-исполнитель, ожидаемый результат, метрика успеха.
Применяй Amazon Flywheel и Working Backwards.
      `.trim(),
    }], 2000)
}

export async function bezosDecide(situation: string, options: string[]): Promise<{
  decision: string
  reasoning: string
  delegateTo: string
  priority: 'urgent' | 'high' | 'normal'
  pressRelease?: string
}> {
  const text = await openrouterMessages([
    { role: 'system', content: BEZOS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `
Ситуация требует стратегического решения:
${situation}

Варианты действий:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Прими решение используя Amazon Working Backwards и Leadership Principles.
Верни ТОЛЬКО валидный JSON без markdown блоков:
{
  "decision": "конкретное действие которое нужно предпринять",
  "reasoning": "почему именно это (2-3 предложения, со ссылкой на принципы)",
  "delegateTo": "seo|media|smm|seller|analyst|scout",
  "priority": "urgent|high|normal",
  "pressRelease": "Сегодня Harlan Steel... [1 предложение о результате]"
}
      `.trim(),
    }], 1000)
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return { decision: text.substring(0, 200), reasoning: '', delegateTo: 'seller', priority: 'normal' }
  }
}

export async function bezosChat(message: string, conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<string> {
  return openrouterMessages([
    { role: 'system', content: BEZOS_SYSTEM_PROMPT },
    ...conversationHistory.slice(-6),
    { role: 'user', content: message },
  ], 1500)
}

export async function bezosLearn(params: {
  situation: string
  bezosRecommended: string
  ownerDecision: 'approved' | 'rejected' | 'modified'
  ownerModification?: string
  outcome?: string
}): Promise<string> {
  return openrouterMessages([
    { role: 'system', content: BEZOS_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `
Обратная связь от владельца:

Ситуация: ${params.situation}
Я рекомендовал: ${params.bezosRecommended}
Владелец: ${params.ownerDecision}
${params.ownerModification ? `Изменил на: ${params.ownerModification}` : ''}
${params.outcome ? `Результат: ${params.outcome}` : ''}

Что я должен скорректировать в своей стратегии на будущее?
Один конкретный вывод в 1-2 предложения.
      `.trim(),
    }], 300)
}
