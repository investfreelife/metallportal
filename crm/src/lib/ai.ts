/**
 * GPT-4o via OpenRouter — CRM AI core
 * Analyzes new leads and generates personalized suggested actions.
 * Claude (Anthropic) evaluates AI + manager performance and self-improves the prompt.
 */

import { getSetting, setSetting } from './settings'

const REFERER = 'https://metallportal-crm2.vercel.app'
const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

// ─────────────────────────────────────────────
// БАЗОВЫЙ СИСТЕМНЫЙ КОНТЕКСТ КОМПАНИИ
// Редактируется через CRM → Настройки → ИИ
// ─────────────────────────────────────────────
const BASE_COMPANY_CONTEXT = `
Компания: МеталлПортал — B2B/B2C маркетплейс металлопроката
Сайт: metallportal.ru
CRM: metallportal-crm2.vercel.app

ПРОДУКТЫ:
- Арматура (А500С, А240): диаметры 6-40мм, бухты и прутки, от 1т
- Листовой прокат (г/к, х/к): толщина 1-160мм, 1500×6000
- Трубы (ВГП, профильные, бесшовные): диаметры 15-530мм
- Уголок, швеллер, двутавр: длина 6-12м
- Навесы и металлоконструкции: под заказ от 200м²
- Калькуляторы онлайн: подбор по весу, длине

СЕГМЕНТЫ КЛИЕНТОВ:
- Строитель: прораб/застройщик, нужна арматура+листы, срок сжатый, важна цена
- Завод/Производство: регулярные закупки, нужен договор+счёт, решает снабженец
- Перекупщик: нужен прайс оптом, договор поставки, большой объём
- Физлицо: небольшой объём, строит дачу/гараж, чувствителен к цене и сервису
- Неизвестно: нет данных

ТИПИЧНЫЙ ЦИКЛ ПРОДАЖИ:
1. Лид → звонок 15 мин → уточнить объём и сроки
2. КП → 1-2 дня → ждать реакции
3. Переговоры → скидка до 5% при объёме >5т
4. Счёт → предоплата 50% → отгрузка

СКРИПТ ПЕРВОГО ЗВОНКА:
"Добрый день, [имя]! Меня зовут [менеджер], МеталлПортал. 
Вы оставили заявку на [товар/обратный звонок]. 
Подскажите, какой объём вас интересует и в какие сроки нужна доставка?"

ВАЖНО:
- Всегда предлагать звонок, не переписку
- При заказе >100т — сразу предложить встречу
- При невозможности дозвониться — WhatsApp/Telegram
- Конкуренты: МеталлСнаб, ТрубаСталь, Металлург — не упоминать
`.trim()

interface LeadContext {
  name?: string | null
  phone?: string | null
  email?: string | null
  company?: string | null
  form_type: string
  message?: string | null
  items?: unknown[]
  total?: number | null
  utm_source?: string | null
  utm_campaign?: string | null
}

export interface AIAnalysis {
  reasoning: string
  suggested_message: string
  action_type: 'call' | 'send_proposal' | 'send_message' | 'schedule'
  priority: 'high' | 'medium' | 'low'
  score_adjustment: number
  segment: string
  next_action_hint: string
  quote_text?: string
}

async function getSystemPrompt(): Promise<string> {
  const adjustments = await getSetting('AI_PROMPT_ADJUSTMENTS')
  if (adjustments) {
    return BASE_COMPANY_CONTEXT + '\n\nКОРРЕКТИРОВКИ (обновлено Claude):\n' + adjustments
  }
  return BASE_COMPANY_CONTEXT
}

async function openrouterChat(key: string, messages: { role: string; content: string }[], opts: { json?: boolean; maxTokens?: number } = {}) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': REFERER,
      'X-Title': 'MetallPortal CRM AI',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 600,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? null
}

export async function analyzeNewLead(ctx: LeadContext): Promise<AIAnalysis | null> {
  const OPENROUTER_KEY = await getSetting('OPENROUTER_API_KEY')
  if (!OPENROUTER_KEY) return null

  const systemPrompt = await getSystemPrompt()

  // Format items nicely for AI
  let itemsBlock = ''
  if (ctx.items && Array.isArray(ctx.items) && ctx.items.length) {
    const rows = (ctx.items as Array<{ name?: string; qty?: number; unit?: string; price?: number; total?: number }>)
      .map((it, i) => {
        const qty = it.qty ?? 1
        const unit = it.unit ?? 'шт'
        const price = it.price ? `${it.price.toLocaleString('ru')} ₽/${unit}` : 'цена по запросу'
        const sum = it.total ? `${it.total.toLocaleString('ru')} ₽` : ''
        return `  ${i + 1}. ${it.name ?? '—'} — ${qty} ${unit} × ${price}${sum ? ' = ' + sum : ''}`
      }).join('\n')
    itemsBlock = `\nТОВАРЫ ИЗ КОРЗИНЫ:\n${rows}`
  }

  const contactInfo = [
    ctx.name && `Имя: ${ctx.name}`,
    ctx.company && `Компания: ${ctx.company}`,
    ctx.phone && `Телефон: ${ctx.phone}`,
    ctx.email && `Email: ${ctx.email}`,
    ctx.message && `Комментарий клиента: ${ctx.message}`,
    ctx.total && `Сумма заказа: ${ctx.total.toLocaleString('ru')} ₽`,
    ctx.utm_source && `Источник трафика: ${ctx.utm_source}`,
    ctx.utm_campaign && `Рекламная кампания: ${ctx.utm_campaign}`,
  ].filter(Boolean).join('\n')

  const hasItems = ctx.items && Array.isArray(ctx.items) && ctx.items.length > 0

  const userMsg = `Новое обращение (тип: ${ctx.form_type}):
${contactInfo}${itemsBlock}

Ответь строго JSON (без markdown):
{
  "reasoning": "1-2 предложения ПОЧЕМУ ты предлагаешь это действие, какой сегмент клиента и что именно заказал",
  "suggested_message": "Готовый текст для первого контакта менеджера. Обращение по имени, упомяни КОНКРЕТНЫЕ товары и количество из заказа, уточни сроки доставки. 2-4 предложения.",
  "action_type": "call|send_proposal|send_message|schedule",
  "priority": "high|medium|low",
  "score_adjustment": число от -10 до +25,
  "segment": "Строитель|Завод|Перекупщик|Физлицо|Неизвестно",
  "next_action_hint": "Одна конкретная подсказка менеджеру что делать после первого контакта"${hasItems ? `,
  "quote_text": "Текст коммерческого предложения/счёта. Формат:\\nКП МеталлПортал | Дата\\nКлиент: [имя]\\n\\n№  Наименование  Кол-во  Цена  Сумма\\n[строки товаров]\\n\\nИТОГО: ... ₽\\n\\nДля оформления счёта уточните реквизиты."` : ''}
}`

  try {
    const text = await openrouterChat(OPENROUTER_KEY, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ], { json: true, maxTokens: 700 })
    if (!text) return null
    return JSON.parse(text) as AIAnalysis
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// АНАЛИЗ ВХОДЯЩЕГО ПИСЬМА
// ─────────────────────────────────────────────
export interface EmailAnalysis {
  reasoning: string
  suggested_reply: string
  action_type: 'send_email' | 'make_call' | 'send_proposal' | 'create_task' | 'schedule'
  priority: 'high' | 'medium' | 'low'
  segment: string
  intent: string
  subject_reply: string
}

export async function analyzeEmail(ctx: {
  from_email: string
  from_name?: string | null
  subject: string
  body_text?: string | null
}): Promise<EmailAnalysis | null> {
  const OPENROUTER_KEY = await getSetting('OPENROUTER_API_KEY')
  if (!OPENROUTER_KEY) return null

  const systemPrompt = await getSystemPrompt()

  const userMsg = `Ты — ИИ-ассистент менеджера B2B-маркетплейса металлопроката МеталлПортал.
Мы ПОКУПАЕМ металл у поставщиков и ПРОДАЁМ клиентам (стройки, заводы, перекупщики).

Входящее письмо:
От: ${ctx.from_name ? `${ctx.from_name} <${ctx.from_email}>` : ctx.from_email}
Тема: ${ctx.subject}
Текст: ${(ctx.body_text ?? '(текст не загружен)').slice(0, 2500)}

ТИПЫ ПИСЕМ в нашей работе:
1. ЗАПРОС КЛИЕНТА — клиент просит цену/наличие/доставку
2. ЗАЯВКА НА ПОКУПКУ — клиент готов купить, нужно оформить
3. ОТВЕТ НА НАШ ЗАПРОС ЦЕНЫ — агрегатор или поставщик присылает ценовые предложения в ответ на наш запрос (напр. platformus.ru, sbs.ru, металлтрейд и т.п.) — содержит таблицу поставщиков с ценами
4. КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ ОТ ПОСТАВЩИКА — поставщик предлагает свои условия
5. ПАРТНЁРСКОЕ ПРЕДЛОЖЕНИЕ — предложение о сотрудничестве/интеграции
6. ЖАЛОБА/ПРЕТЕНЗИЯ — клиент недоволен
7. СЛУЖЕБНОЕ/УВЕДОМЛЕНИЕ — системное письмо, регистрация, безопасность
8. СПАМ/РЕКЛАМА — нерелевантная рассылка

Для типа 3 (ОТВЕТ НА ЗАПРОС ЦЕНЫ): выдели лучшее предложение из таблицы (минимальная цена / оптимальное сочетание цена+срок), объясни какого поставщика выбрать и почему.

Ответь строго JSON (без markdown):
{
  "reasoning": "2-4 предложения: тип письма, ключевые данные (цены/поставщики/суммы если есть), что конкретно делать менеджеру",
  "suggested_reply": "Готовый текст ответного письма на русском. Если это ответ на запрос цены или служебное — пустая строка. Если спам — пустая строка.",
  "action_type": "send_email|make_call|send_proposal|create_task|schedule",
  "priority": "high|medium|low",
  "segment": "Клиент-Строитель|Клиент-Завод|Клиент-Перекупщик|Клиент-Физлицо|Поставщик|Агрегатор-Цен|Партнёр|Спам|Служебное",
  "intent": "Одно предложение — суть письма",
  "subject_reply": "Тема ответного письма или пустая строка"
}`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': REFERER,
        'X-Title': 'MetallPortal CRM AI',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 900,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? null
    if (!text) return null
    return JSON.parse(text) as EmailAnalysis
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// ОЦЕНКА CLAUDE: работа ИИ + менеджера
// Вызывается после того как менеджер одобрил/отклонил задачу
// ─────────────────────────────────────────────
export interface EvalResult {
  ai_score: number        // 0-10 насколько правильно ИИ предложил действие
  manager_score: number   // 0-10 насколько быстро/правильно менеджер отреагировал
  ai_feedback: string     // что ИИ сделал хорошо/плохо
  manager_feedback: string
  prompt_fix: string      // конкретное улучшение промпта (1-2 предложения)
}

export async function evaluateAndImprove(ctx: {
  lead_segment: string
  ai_reasoning: string
  ai_suggested_message: string
  ai_action_type: string
  ai_priority: string
  manager_decision: 'approved' | 'rejected'
  manager_response_minutes: number
  actual_result?: string | null
}): Promise<EvalResult | null> {
  const OPENROUTER_KEY = await getSetting('OPENROUTER_API_KEY')
  if (!OPENROUTER_KEY) return null

  const prompt = `Ты — тренер отдела продаж МеталлПортал. Оцени работу ИИ-ассистента и менеджера.

КОНТЕКСТ СДЕЛКИ:
- Сегмент клиента: ${ctx.lead_segment}
- ИИ предложил: ${ctx.ai_action_type} (приоритет: ${ctx.ai_priority})
- ИИ рассуждение: ${ctx.ai_reasoning}
- ИИ предложенное сообщение: "${ctx.ai_suggested_message}"
- Решение менеджера: ${ctx.manager_decision === 'approved' ? 'ОДОБРИЛ и выполнил' : 'ОТКЛОНИЛ'}
- Время реакции менеджера: ${ctx.manager_response_minutes} минут
${ctx.actual_result ? `- Результат: ${ctx.actual_result}` : ''}

Отвечай строго JSON без markdown:
{
  "ai_score": число 0-10,
  "manager_score": число 0-10,
  "ai_feedback": "что ИИ сделал правильно или где ошибся (1 предложение)",
  "manager_feedback": "оценка скорости и качества реакции менеджера (1 предложение)",
  "prompt_fix": "конкретное улучшение для системного промпта ИИ (1-2 предложения, начни с глагола)"
}`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': REFERER,
        'X-Title': 'MetallPortal CRM AI',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (!text) return null
    const result = JSON.parse(text) as EvalResult

    // Сохраняем корректировку промпта в DB для самообучения
    const existing = await getSetting('AI_PROMPT_ADJUSTMENTS') ?? ''
    const timestamp = new Date().toLocaleDateString('ru')
    const newAdjustment = `[${timestamp}] ${result.prompt_fix}`
    // Храним последние 10 корректировок
    const lines = existing.split('\n').filter(Boolean)
    lines.push(newAdjustment)
    const kept = lines.slice(-10).join('\n')
    await setSetting('AI_PROMPT_ADJUSTMENTS', kept)

    return result
  } catch {
    return null
  }
}

export async function generateWeeklyInsight(stats: {
  total_contacts: number
  new_this_week: number
  calls_made: number
  conversion_rate: number
  top_sources: string[]
}): Promise<string> {
  const OPENROUTER_KEY = await getSetting('OPENROUTER_API_KEY')
  if (!OPENROUTER_KEY) return ''

  const systemPrompt = await getSystemPrompt()

  const prompt = `Данные за неделю:
- Новых контактов: ${stats.new_this_week}
- Всего в базе: ${stats.total_contacts}
- Звонков: ${stats.calls_made}
- Конверсия в сделку: ${stats.conversion_rate}%
- Топ источники: ${stats.top_sources.join(', ')}

Напиши краткий аналитический комментарий (3-4 предложения) с 1-2 конкретными рекомендациями для менеджеров. Только текст, без JSON.`

  try {
    const text = await openrouterChat(OPENROUTER_KEY, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ], { maxTokens: 350 })
    return text ?? ''
  } catch {
    return ''
  }
}
