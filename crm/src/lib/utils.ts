export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number | null, currency = 'RUB'): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'только что'
  if (diffMins < 60) return `${diffMins} мин назад`
  if (diffHours < 24) return `${diffHours} ч назад`
  if (diffDays < 7) return `${diffDays} д назад`
  return formatDate(dateString)
}

export function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

export function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function getSegmentLabel(segment: string | null): string {
  switch (segment) {
    case 'hot': return '🔴 Горячий'
    case 'warm': return '🟡 Тёплый'
    case 'cold': return '🔵 Холодный'
    default: return '—'
  }
}

export function getContactStatusLabel(status: string): string {
  switch (status) {
    case 'new': return 'Новый'
    case 'active': return 'Активный'
    case 'inactive': return 'Неактивный'
    case 'blocked': return 'Заблокирован'
    default: return status
  }
}

export function getDealStageLabel(stage: string): string {
  switch (stage) {
    case 'new':              return 'Новая заявка'
    case 'call':             return 'Контакт'
    case 'qualified':        return 'Квалифицирован'
    case 'supplier_request': return 'Запрос постав.'
    case 'proposal':         return 'КП отправлено'
    case 'negotiation':      return 'Переговоры'
    case 'won':              return 'Оплата'
    case 'delivery':         return 'Доставка'
    case 'completed':        return 'Завершено'
    case 'lost':             return 'Отказ'
    default: return stage
  }
}

export function formatMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}М`
  if (value >= 1_000) return `${Math.round(value / 1_000)}К`
  return value.toLocaleString('ru-RU')
}

export function timeAgo(date: string | null): string {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}ч назад`
  return `${Math.floor(hours / 24)} дн назад`
}

export function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export function getActionTypeLabel(type: string): string {
  switch (type) {
    case 'send_email': return 'Отправить email'
    case 'send_message': return 'Отправить сообщение'
    case 'make_call': return 'Позвонить'
    case 'send_proposal': return 'Отправить КП'
    case 'create_task': return 'Создать задачу'
    case 'update_stage': return 'Обновить стадию'
    case 'send_campaign': return 'Запустить рассылку'
    default: return type
  }
}
