import { redirect } from 'next/navigation'
import { getSession, getTenantId } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import BrainStatusBanner from '@/components/layout/BrainStatusBanner'
import BrainBox from '@/components/layout/BrainBox'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  const TENANT_ID = session.tenant || (await getTenantId())

  const supabase = await createClient()
  const [
    { count: pendingCount },
    { count: unreadEmails },
    { count: inboxUnread },
    { count: openQuestions },
  ] = await Promise.all([
    supabase.from('ai_queue').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    supabase.from('emails').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('is_read', false).eq('direction', 'inbound'),
    // URGENT 2026-05-17 inbox: unread badge — combined unread emails + unread Telegram messages.
    // Phase 2 — read from conversations.unread_count после backfill.
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('is_read', false),
    // Sergey directive 2026-06-03: badge на «Вопросы» = открытые pending_questions.
    supabase.from('pending_questions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID).eq('status', 'open'),
  ])

  return (
    <div className="flex h-full">
      <Sidebar
        userName={session.name}
        userLogin={session.login}
        pendingCount={pendingCount ?? 0}
        unreadEmails={unreadEmails ?? 0}
        inboxUnread={(unreadEmails ?? 0) + (inboxUnread ?? 0)}
        openQuestions={openQuestions ?? 0}
        industry={session.industry}
        tenantName={session.tenant_name}
        tenantId={TENANT_ID}
        isSuperadmin={session.is_superadmin}
      />
      <main className="flex-1 flex flex-col bg-gray-50 min-w-0">
        <BrainStatusBanner />
        <div className="flex-1 overflow-auto min-h-0">
          {children}
        </div>
        <BrainBox />
      </main>
    </div>
  )
}
