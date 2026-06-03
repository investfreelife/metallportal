// Мини-ап «Публикатор» — реестр коннекторов + единая точка публикации.
// Изучено по Postiz (архитектура провайдеров), реализация наша (API платформ публичные).
// Добавить платформу = один файл-коннектор + строка в реестре.
import type { Connector, Connection, PublishInput, PublishResult } from './types';
import { telegramConnector } from './telegram';
import { vkConnector } from './vk';

export * from './types';

const REGISTRY: Record<string, Connector> = {
  telegram: telegramConnector,
  vk: vkConnector,
};

export function getConnector(platform: string): Connector | null {
  return REGISTRY[platform] || null;
}

export function listPlatforms(): { platform: string; maxLength: number }[] {
  return Object.values(REGISTRY).map((c) => ({ platform: c.platform, maxLength: c.maxLength }));
}

export async function checkConnection(conn: Connection) {
  const c = getConnector(conn.platform);
  if (!c) return { ok: false, error: `Нет коннектора для ${conn.platform}` };
  return c.check(conn);
}

export async function publish(conn: Connection, input: PublishInput): Promise<PublishResult> {
  const c = getConnector(conn.platform);
  if (!c) return { ok: false, error: `Нет коннектора для ${conn.platform}` };
  if (!input.text?.trim()) return { ok: false, error: 'Пустой текст' };
  return c.publish(conn, input);
}
