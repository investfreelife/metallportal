import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import PostHistoryClient from './PostHistoryClient';

export const dynamic = 'force-dynamic';

/**
 * /post-history — История постинга (посевов).
 * Sergey directive 2026-06-06: «где конкретно история постинга, какую кнопку нажать».
 * Источник: channels где config.kind='source_codes' (единый реестр публикаций).
 */
export default async function PostHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.industry !== 'taxi') redirect('/dashboard');
  return <PostHistoryClient />;
}
