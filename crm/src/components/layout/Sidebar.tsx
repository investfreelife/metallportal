'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Sparkles,
  Settings,
  LogOut,
  BarChart2,
  Mail,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/contacts', label: 'Контакты', icon: Users },
  { href: '/deals', label: 'Сделки', icon: Briefcase },
  { href: '/emails', label: 'Почта', icon: Mail },
  { href: '/queue', label: 'Очередь ИИ', icon: Sparkles, badge: true },
  { href: '/analytics', label: 'Аналитика', icon: BarChart2 },
  { href: '/settings', label: 'Настройки', icon: Settings },
]

interface SidebarProps {
  userName?: string
  userLogin?: string
  pendingCount?: number
}

export default function Sidebar({ userName, userLogin, pendingCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="flex flex-col w-64 min-h-screen"
      style={{ backgroundColor: 'var(--sidebar-bg)' }}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        {/* МП logomark */}
        <div className="flex flex-shrink-0">
          <div className="w-7 h-7 flex items-center justify-center bg-amber-400 rounded-sm">
            <span className="text-black font-black text-base leading-none" style={{ fontFamily: 'serif', letterSpacing: '-0.05em' }}>М</span>
          </div>
          <div className="w-7 h-7 flex items-center justify-center bg-gray-800 rounded-sm -ml-px border border-white/10">
            <span className="text-white font-black text-base leading-none" style={{ fontFamily: 'serif', letterSpacing: '-0.05em' }}>П</span>
          </div>
        </div>
        <div className="leading-tight">
          <p className="text-white font-bold text-sm tracking-wide">МЕТАЛЛ</p>
          <p className="text-amber-400 font-semibold text-xs tracking-widest">ПОРТАЛ</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              style={isActive ? { backgroundColor: 'var(--sidebar-active)' } : {}}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && pendingCount > 0 && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="flex items-center justify-center w-7 h-7 bg-gray-700 rounded-full flex-shrink-0">
            <span className="text-xs text-gray-300 font-medium">
              {(userName || userLogin || '?')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">
              {userName || userLogin || 'Пользователь'}
            </p>
            {userLogin && userName && (
              <p className="text-gray-500 text-xs truncate">{userLogin}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  )
}
