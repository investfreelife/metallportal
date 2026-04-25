import { Suspense } from 'react'
import { PartnerDashboard } from './PartnerDashboard'

export default async function PartnerPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-500 text-sm">Загрузка...</div>}>
        <PartnerDashboard code={code} />
      </Suspense>
    </div>
  )
}
