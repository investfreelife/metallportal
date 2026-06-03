import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DialogsClient from './DialogsClient';

export const dynamic = 'force-dynamic';

/**
 * /dialogs — переписки бот↔кандидат, чтобы Сергей видел КАЖДЫЙ диалог.
 * Sergey directive 2026-06-03: «нужны диалоги кандидатов».
 *
 * Данные тянутся клиентом — не SSR, потому что есть автополлинг (10с)
 * и интерактивный выбор чата. На сервере — только session/redirect guard.
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
    />
  );
}
