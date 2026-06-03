// Мини-ап «Публикатор» — своё ядро (изучено по Postiz, код наш; API платформ публичные).
// Единый интерфейс коннектора: одна абстракция, разные платформы (Telegram, VK, …).

export type PublishMedia = {
  type: 'image' | 'video';
  url: string; // публично доступный URL (Supabase Storage)
  alt?: string;
};

export type PublishInput = {
  text: string;
  media?: PublishMedia[];
};

export type PublishResult = {
  ok: boolean;
  postId?: string; // id поста на платформе
  url?: string; // ссылка на опубликованный пост
  error?: string;
};

export type ConnectionCheck = {
  ok: boolean;
  info?: string; // напр. название канала/группы
  error?: string;
};

// Связь = настроенный канал (хранится в CRM таблице connections, токены — секрет).
export type Connection = {
  platform: string; // 'telegram' | 'vk'
  token: string; // bot token (TG) / access_token (VK)
  target_id: string; // chat_id канала/группы (TG) / group_id (VK)
  meta?: Record<string, any>;
};

export interface Connector {
  platform: string;
  maxLength: number;
  // Проверка связи (тест перед сохранением): валиден ли токен/доступ.
  check(conn: Connection): Promise<ConnectionCheck>;
  // Публикация поста (текст + фото).
  publish(conn: Connection, input: PublishInput): Promise<PublishResult>;
}
