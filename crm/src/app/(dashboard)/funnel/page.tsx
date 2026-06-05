import { redirect } from 'next/navigation';

/**
 * /funnel — устаревший канбан по dialog_messages.
 *
 * Task 059: убран из меню, теперь всегда редиректит на /funnel-stages
 * (полная модель стадий + красная панель + «Добавить кандидата»).
 * Старый FunnelClient.tsx и AddCandidateModal.tsx оставлены — UI остался
 * как переиспользуемый компонент (AddCandidateModal импортируется
 * /funnel-stages).
 */
export default function FunnelDeprecatedPage() {
  redirect('/funnel-stages');
}
