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
  Phone,
  Send,
  Megaphone,
  FileText,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  badgeKey?: 'pending' | 'emails' | 'calls'
}

type NavSection = {
  section: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    section: 'Главное',
    items: [
      { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
      { href: '/queue', label: 'Очередь ИИ', icon: Sparkles, badgeKey: 'pending' },
    ],
  },
  {
    section: 'Продажи',
    items: [
      { href: '/contacts', label: 'Контакты', icon: Users },
      { href: '/deals', label: 'Сделки', icon: Briefcase },
      { href: '/calls', label: 'Звонки', icon: Phone, badgeKey: 'calls' },
    ],
  },
  {
    section: 'Коммуникации',
    items: [
      { href: '/emails', label: 'Почта', icon: Mail, badgeKey: 'emails' },
      { href: '/telegram', label: 'Telegram', icon: Send },
      { href: '/campaigns', label: 'Рассылки', icon: Megaphone },
    ],
  },
  {
    section: 'Аналитика',
    items: [
      { href: '/analytics', label: 'Аналитика', icon: BarChart2 },
      { href: '/reports', label: 'Отчёты', icon: FileText },
    ],
  },
]

interface SidebarProps {
  userName?: string
  userLogin?: string
  pendingCount?: number
  unreadEmails?: number
  missedCalls?: number
}

export default function Sidebar({
  userName,
  userLogin,
  pendingCount = 0,
  unreadEmails = 0,
  missedCalls = 0,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const badges: Record<string, number> = {
    pending: pendingCount,
    emails: unreadEmails,
    calls: missedCalls,
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="flex flex-col w-[200px] min-h-screen flex-shrink-0"
      style={{ backgroundColor: '#0f172a' }}
    >
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/10">
        <div className="flex flex-shrink-0">
          <div className="w-6 h-6 flex items-center justify-center bg-amber-400 rounded-sm">
            <span className="text-black font-black text-sm leading-none" style={{ fontFamily: 'serif', letterSpacing: '-0.05em' }}>М</span>
          </div>
          <div className="w-6 h-6 flex items-center justify-center bg-gray-800 rounded-sm -ml-px border border-white/10">
            <span className="text-white font-black text-sm leading-none" style={{ fontFamily: 'serif', letterSpacing: '-0.05em' }}>П</span>
          </div>
        </div>
        <div className="leading-tight">
          <p className="text-white font-bold text-xs tracking-wide">AI CRM</p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {navSections.map(({ section, items }) => (
          <div key={section} className="mb-3">
            <div className="px-2 mb-1 text-[10px] font-medium text-gray-600 uppercase tracking-wider">
              {section}
            </div>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, badgeKey }) => {
                const isActive = href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(href)
                const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {badgeCount > 0 && (
                      <span className="flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-white/10">
        <Link
          href="/settings"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium mb-2 transition-colors ${
            pathname.startsWith('/settings')
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/8'
          }`}
        >
          <Settings className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Настройки</span>
        </Link>

        <div className="flex items-center gap-2 px-2 py-1.5 mb-0.5">
          <div className="flex items-center justify-center w-6 h-6 bg-gray-700 rounded-full flex-shrink-0">
            <span className="text-[10px] text-gray-300 font-medium">
              {(userName || userLogin || '?')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[11px] font-medium truncate">
              {userName || userLogin || 'Пользователь'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-md text-xs transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  )
}
