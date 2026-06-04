import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DialogsClient from './DialogsClient';

export const dynamic = 'force-dynamic';

/**
 * /dialogs — переписки бот↔кандидат (рекрутинг).
 * Бизнес-личка (tgb:*) живёт на отдельной странице /business.
 *
 * Sergey directive 2026-06-04: разделить scope'ы, чтобы не мешать
 * личные сообщения от Сергея и переписки кандидатов в одном списке.
 */
export default async function DialogsPage({
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
      scope="recruit"
    />
  );
}
