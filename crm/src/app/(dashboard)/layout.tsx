import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: crmUser } = await supabase
    .from('crm_users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { count: pendingCount } = await supabase
    .from('ai_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <div className="flex h-full bg-gray-950">
      <Sidebar
        userEmail={user.email}
        userName={crmUser?.full_name ?? undefined}
        pendingCount={pendingCount ?? 0}
      />
      <main className="flex-1 overflow-auto bg-gray-950">
        {children}
      </main>
    </div>
  )
}
