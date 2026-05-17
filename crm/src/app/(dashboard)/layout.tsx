import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

const TENANT_ID = 'a1000000-0000-0000-0000-000000000001'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()
  const [
    { count: pendingCount },
    { count: unreadEmails },
    { count: inboxUnread },
  ] = await Promise.all([
    supabase.from('ai_queue').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    supabase.from('emails').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('is_read', false).eq('direction', 'inbound'),
    // URGENT 2026-05-17 inbox: unread badge — combined unread emails + unread Telegram messages.
    // Phase 2 — read from conversations.unread_count после backfill.
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ])

  return (
    <div className="flex h-full">
      <Sidebar
        userName={session.name}
        userLogin={session.login}
        pendingCount={pendingCount ?? 0}
        unreadEmails={unreadEmails ?? 0}
        inboxUnread={(unreadEmails ?? 0) + (inboxUnread ?? 0)}
      />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
