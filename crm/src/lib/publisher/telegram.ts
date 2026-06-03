// Коннектор Telegram (наш чистый код, по официальному Bot API).
// token = bot token; target_id = chat_id канала/группы (бот должен быть админом).
// Текст+фото → sendPhoto (caption); только текст → sendMessage. Лимит 4096.
import type { Connector, Connection, PublishInput, PublishResult, ConnectionCheck } from './types';

const API = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

// Telegram принимает ограниченный HTML; приводим к нему и режем лишние теги.
function toTelegramHtml(text: string): string {
  return (text || '')
    .replace(/<\/?(?:strong|b)>/gi, (m) => (m[1] === '/' ? '</b>' : '<b>'))
    .replace(/<p>(.*?)<\/p>/gis, '$1\n')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<(?!\/?(?:b|i|u|s|a|code|pre)\b)[^>]*>/gi, ''); // оставляем только разрешённые теги
}

async function tg(token: string, method: string, payload: Record<string, any>) {
  const res = await fetch(API(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export const telegramConnector: Connector = {
  platform: 'telegram',
  maxLength: 4096,

  async check(conn: Connection): Promise<ConnectionCheck> {
    try {
      const me = await tg(conn.token, 'getMe', {});
      if (!me?.ok) return { ok: false, error: 'Неверный bot token' };
      const chat = await tg(conn.token, 'getChat', { chat_id: conn.target_id });
      if (!chat?.ok) return { ok: false, error: `Нет доступа к чату ${conn.target_id} (бот добавлен админом?)` };
      const title = chat.result?.title || chat.result?.username || conn.target_id;
      return { ok: true, info: `@${me.result.username} → «${title}»` };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  },

  async publish(conn: Connection, input: PublishInput): Promise<PublishResult> {
    try {
      const text = toTelegramHtml(input.text).slice(0, this.maxLength);
      const photo = (input.media || []).find((m) => m.type === 'image');
      let result: any;
      if (photo) {
        result = await tg(conn.token, 'sendPhoto', {
          chat_id: conn.target_id,
          photo: photo.url,
          caption: text.slice(0, 1024), // лимит подписи к фото
          parse_mode: 'HTML',
        });
        // если подпись длиннее 1024 — добавим остаток отдельным сообщением
        if (result?.ok && text.length > 1024) {
          await tg(conn.token, 'sendMessage', { chat_id: conn.target_id, text: text.slice(1024), parse_mode: 'HTML' });
        }
      } else {
        result = await tg(conn.token, 'sendMessage', { chat_id: conn.target_id, text, parse_mode: 'HTML' });
      }
      if (!result?.ok) return { ok: false, error: result?.description || 'Telegram error' };
      const mid = result.result.message_id;
      const uname = String(conn.target_id).startsWith('@') ? String(conn.target_id).slice(1) : null;
      const url = uname ? `https://t.me/${uname}/${mid}` : undefined;
      return { ok: true, postId: String(mid), url };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  },
};
