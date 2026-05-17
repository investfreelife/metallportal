import { InboxApp } from '@/components/inbox/InboxApp'

/**
 * /inbox — World-class omnichannel inbox standalone page.
 *
 * URGENT 2026-05-17 Sergey directive «вкладка сообщения отдельная полноценная,
 * мирового уровня лучших» (Front App / Missive / HubSpot reference).
 *
 * Server component shell — client InboxApp handles 3-pane layout / state /
 * keyboard shortcuts / realtime / composer.
 */

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Все сообщения · CRM' }

export default function InboxPage() {
  return <InboxApp />
}
