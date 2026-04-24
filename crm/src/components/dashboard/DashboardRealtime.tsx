'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function DashboardRealtime({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const supabase = createClient()
  useEffect(() => {
    const ch = supabase.channel('dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_queue', filter: `tenant_id=eq.${tenantId}` }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tenantId, router, supabase])
  return null
}
