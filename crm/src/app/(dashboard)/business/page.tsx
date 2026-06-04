import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DialogsClient from '../dialogs/DialogsClient';

export const dynamic = 'force-dynamic';

/**
 * /business — Бизнес-личка (Telegram Business).
 * Chat_id'ы вида `tgb:*` — это люди, пишущие лично Сергею через
 * Telegram Business; бот отвечает им. Этот UI — отдельный от
 * /dialogs (рекрутинг), чтобы не мешать в одной ленте.
 *
 * Переиспользуем DialogsClient с пропом scope='business' (бэкенд
 * фильтрует по префиксу chat_id).
 */
export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  const sp = await searchParams;

  return (
    <DialogsClient
      initialChatId={sp.chat ?? null}
      tenantName={session.tenant_name ?? null}
      scope="business"
      pageTitle="Бизнес-личка"
      pageHint="Telegram Business · личные сообщения, бот отвечает · обновление 10 сек · время МСК"
    />
  );
}
