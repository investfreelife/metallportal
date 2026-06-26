'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Tenant {
  id: string
  name: string
  industry: string
}

/**
 * Dropdown для superadmin'a — переключает active tenant.
 * Sergey directive 2026-06-17 (вариант B).
 *
 * Подменяет session cookie через POST /api/auth/switch-tenant,
 * затем router.refresh() + redirect на корень нового tenant'a.
 */
export function TenantSwitcher({ activeTenantId, activeTenantName }: {
  activeTenantId: string
  activeTenantName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [switching, setSwitching] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tenants/list')
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants ?? []))
      .catch(() => setTenants([]))
  }, [])

  async function pick(t: Tenant) {
    if (t.id === activeTenantId) {
      setOpen(false)
      return
    }
    setSwitching(t.id)
    const r = await fetch('/api/auth/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: t.id }),
    })
    if (r.ok) {
      const home = t.industry === 'landing_factory' ? '/dream'
                 : t.industry === 'taxi' ? '/dashboard'
                 : '/dashboard'
      window.location.href = home
    } else {
      setSwitching(null)
      alert('Не удалось переключить')
    }
  }

  const icon = (industry: string) =>
    industry === 'taxi' ? '🚖'
    : industry === 'landing_factory' ? '🏠'
    : '⚙️'

  return (
    <div className="relative px-3 py-2 border-b border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/8 transition-colors"
        title="Переключить тенант (superadmin)"
      >
        <span className="flex items-center gap-1.5 truncate">
          <span className="text-xs">⇅</span>
          <span className="truncate">{activeTenantName}</span>
        </span>
        <span className={`text-[10px] text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 left-3 right-3 mt-1 bg-slate-800 border border-white/10 rounded-md shadow-2xl overflow-hidden">
            {tenants.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-gray-500 italic">Загружаю…</div>
            )}
            {tenants.map((t) => {
              const isActive = t.id === activeTenantId
              const isSwitching = switching === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => pick(t)}
                  disabled={isSwitching}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[11px] transition-colors ${
                    isActive ? 'bg-blue-600 text-white'
                             : 'text-gray-300 hover:text-white hover:bg-white/8'
                  } ${isSwitching ? 'opacity-50' : ''}`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{icon(t.industry)}</span>
                    <span className="truncate">{t.name}</span>
                  </span>
                  {isActive && <span className="text-[10px]">✓</span>}
                  {isSwitching && <span className="text-[10px]">⏳</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
