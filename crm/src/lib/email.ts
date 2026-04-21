/**
 * Email sending via Resend
 * Env: RESEND_API_KEY
 * Fallback: logs to console if key not set
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.CRM_FROM_EMAIL || 'crm@metallportal.ru'
const FROM_NAME = 'МеталлПортал'

export interface EmailPayload {
  to: string
  subject: string
  html: string
  reply_to?: string
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.log('[email] RESEND_API_KEY not set, skipping:', payload.to, payload.subject)
    return { ok: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.reply_to,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { ok: false, error: err }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export function buildProposalEmail(opts: {
  name?: string | null
  company?: string | null
  message?: string | null
}) {
  const greeting = opts.name ? `Добрый день, ${opts.name}!` : 'Добрый день!'
  const companyLine = opts.company ? `<p>Компания: <strong>${opts.company}</strong></p>` : ''

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="border-top:4px solid #1a56db;padding-top:24px">
    <h2 style="color:#1a56db;margin:0 0 16px">${greeting}</h2>
    ${companyLine}
    <p>Спасибо за обращение в <strong>МеталлПортал</strong>.</p>
    <p>Ваша заявка принята. Наш менеджер свяжется с вами в течение <strong>15–30 минут</strong> в рабочее время.</p>
    ${opts.message ? `<blockquote style="border-left:3px solid #1a56db;padding-left:12px;color:#555">${opts.message}</blockquote>` : ''}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="margin:0"><strong>МеталлПортал</strong> — металлопрокат оптом и в розницу</p>
    <p style="color:#666;font-size:14px">
      📞 <a href="tel:+74951234567">+7 (495) 123-45-67</a> &nbsp;|&nbsp;
      🌐 <a href="https://metallportal.ru">metallportal.ru</a>
    </p>
    <p style="color:#888;font-size:12px">Москва, Походный проезд, 16 &nbsp;·&nbsp; Пн–Пт 8:00–20:00, Сб 9:00–17:00</p>
  </div>
</body>
</html>`
}

export function buildOrderConfirmEmail(opts: {
  name?: string | null
  items?: { name: string; qty: number; price: number }[]
  total?: number | null
}) {
  const itemsHtml = Array.isArray(opts.items) && opts.items.length
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead><tr style="background:#f5f5f5">
          <th style="text-align:left;padding:8px;border:1px solid #eee">Товар</th>
          <th style="padding:8px;border:1px solid #eee">Кол-во</th>
          <th style="padding:8px;border:1px solid #eee">Цена</th>
        </tr></thead>
        <tbody>
          ${opts.items.map(i => `<tr>
            <td style="padding:8px;border:1px solid #eee">${i.name}</td>
            <td style="padding:8px;border:1px solid #eee;text-align:center">${i.qty}</td>
            <td style="padding:8px;border:1px solid #eee;text-align:right">${i.price.toLocaleString('ru')} ₽</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : ''

  const totalLine = opts.total
    ? `<p><strong>Итого: ${Number(opts.total).toLocaleString('ru')} ₽</strong></p>`
    : ''

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="border-top:4px solid #10b981;padding-top:24px">
    <h2 style="color:#10b981;margin:0 0 16px">✅ Заказ принят!</h2>
    <p>Добрый день${opts.name ? ', ' + opts.name : ''}!</p>
    <p>Ваш заказ успешно оформлен. Менеджер перезвонит для подтверждения.</p>
    ${itemsHtml}
    ${totalLine}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#666;font-size:14px">
      Вопросы? Звоните: <a href="tel:+74951234567">+7 (495) 123-45-67</a>
    </p>
  </div>
</body>
</html>`
}
