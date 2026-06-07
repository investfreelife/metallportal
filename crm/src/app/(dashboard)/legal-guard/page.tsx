import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import LegalGuardClient from './LegalGuardClient';

export const dynamic = 'force-dynamic';

/**
 * /legal-guard — ТЗ-075: вкладка «🛡 Юр-щит». Read-only.
 * Демон-мозг (`automation/parser/legal_guard.py`) пишет вердикты —
 * мы только показываем blocklist/флаги/причины/статьи + дисклеймер.
 * taxi-only (металловый use-case не нужен).
 */
export default async function LegalGuardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry !== 'taxi') redirect('/dashboard');
  return <LegalGuardClient />;
}
