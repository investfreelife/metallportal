import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex h-full bg-gray-950">
      <Sidebar
        userName={session.name}
        userLogin={session.login}
        pendingCount={0}
      />
      <main className="flex-1 overflow-auto bg-gray-950">
        {children}
      </main>
    </div>
  )
}
