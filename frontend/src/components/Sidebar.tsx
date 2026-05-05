'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import type { Role } from '@/types'

interface NavItem {
  label: string
  href: string
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { label: '儀表板',     href: '/dashboard',    roles: ['Admin', 'RegionalHR', 'Manager', 'Supervisor', 'Employee'] },
  { label: '我的目標',   href: '/goals',         roles: ['Employee', 'Supervisor'] },
  { label: '我的評核',   href: '/reviews',       roles: ['Employee', 'Supervisor', 'Manager'] },
  { label: '團隊評核',   href: '/reviews/team',  roles: ['Supervisor', 'Manager'] },
  { label: '我的團隊',   href: '/team',          roles: ['Supervisor', 'Manager'] },
  { label: '週期管理',   href: '/cycles',        roles: ['Admin', 'RegionalHR', 'Manager', 'Supervisor', 'Employee'] },
  { label: '評核模板',   href: '/templates',     roles: ['RegionalHR', 'Manager'] },
  { label: '申訴管理',   href: '/appeals',       roles: ['Manager'] },
  { label: '稽核日誌',   href: '/audit-log',     roles: ['Admin', 'RegionalHR'] },
]

interface SidebarProps {
  userRole: Role
  userName: string
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { setUser } = useAuth()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole))

  // Longest prefix match: most-specific nav item wins
  const activeHref = visibleItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  async function handleLogout() {
    await api.post('/auth/logout', {}).catch(() => {})
    setUser(null)
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <span className="text-lg font-bold text-primary-600">PMS</span>
        <span className="ml-2 text-xs text-gray-400">Unleash Innovation</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = item.href === activeHref
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-gray-200 p-4">
        <p className="truncate text-sm font-medium text-gray-900">{userName}</p>
        <p className="mb-3 text-xs text-gray-500">{userRole}</p>
        <button
          onClick={handleLogout}
          className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          登出
        </button>
      </div>
    </aside>
  )
}
