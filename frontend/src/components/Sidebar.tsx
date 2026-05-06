'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { RoleBadge } from '@/components/RoleBadge'
import type { Role } from '@/types'

// ─── Icons ────────────────────────────────────────────────────────────────────

function Icon({ path, path2 }: { path: string; path2?: string }) {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={path} />
      {path2 && <path d={path2} />}
    </svg>
  )
}

const ICONS: Record<string, React.ReactNode> = {
  '/dashboard':   <Icon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" path2="M9 22V12h6v10" />,
  '/goals':       <Icon path="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" />,
  '/reviews':     <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" path2="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zm0 8h6m-6 4h4" />,
  '/reviews/team':<Icon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" path2="M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8 4a4 4 0 0 1 0 7.75M23 21v-2a4 4 0 0 0-3-3.87" />,
  '/team':        <Icon path="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
  '/cycles':      <Icon path="M3 4h18a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" path2="M16 2v4M8 2v4M2 9h20" />,
  '/templates':   <Icon path="M12 2L2 7l10 5 10-5-10-5" path2="M2 17l10 5 10-5M2 12l10 5 10-5" />,
  '/appeals':     <Icon path="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" path2="M4 22v-7" />,
  '/audit-log':   <Icon path="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />,
}

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  sub?: string
  href: string
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { label: '儀表板',   href: '/dashboard',    roles: ['Admin', 'RegionalHR', 'Manager', 'Supervisor', 'Employee'] },
  { label: '我的目標', href: '/goals',         roles: ['Employee', 'Supervisor'] },
  { label: '我的評核', sub: '自己的績效表單',  href: '/reviews',       roles: ['Employee', 'Supervisor', 'Manager'] },
  { label: '團隊評核', sub: '下屬的評核狀況',  href: '/reviews/team',  roles: ['Supervisor', 'Manager'] },
  { label: '我的團隊', href: '/team',          roles: ['Supervisor', 'Manager'] },
  { label: '週期管理', href: '/cycles',        roles: ['Admin', 'RegionalHR', 'Manager', 'Supervisor', 'Employee'] },
  { label: '評核模板', href: '/templates',     roles: ['RegionalHR', 'Manager'] },
  { label: '申訴管理', href: '/appeals',       roles: ['Manager'] },
  { label: '稽核日誌', href: '/audit-log',     roles: ['Admin', 'RegionalHR'] },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, setUser } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleCollapse() {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  async function handleLogout() {
    await api.post('/auth/logout', {}).catch(() => {})
    setUser(null)
    router.push('/login')
  }

  if (!user) return null

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role))
  const activeHref   = visibleItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  const initials = (user.name ?? '?')[0]

  return (
    <aside
      className={`relative flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-4">
        <span className="text-lg font-bold text-primary-600 shrink-0">PMS</span>
        {!collapsed && (
          <span className="ml-2 truncate text-xs text-gray-400">Unleash Innovation</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = item.href === activeHref
            const icon     = ICONS[item.href]
            return (
              <li key={item.href}>
                {collapsed ? (
                  // Collapsed: icon only + tooltip
                  <div className="group relative">
                    <Link
                      href={item.href}
                      className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {icon}
                    </Link>
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                      {item.label}
                    </div>
                  </div>
                ) : (
                  // Expanded: icon + label + subtitle
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span className={isActive ? 'text-primary-600' : 'text-gray-400'}>
                      {icon}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.sub && (
                        <span className={`text-xs font-normal truncate ${isActive ? 'text-primary-500' : 'text-gray-400'}`}>
                          {item.sub}
                        </span>
                      )}
                    </span>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm hover:bg-gray-50 hover:text-gray-700 transition-colors"
        title={collapsed ? '展開側欄' : '收合側欄'}
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} />
        </svg>
      </button>

      {/* User info + logout */}
      <div className="border-t border-gray-200 p-4">
        {collapsed ? (
          // Collapsed: avatar circle + tooltip
          <div className="group relative flex flex-col items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
              {initials}
            </div>
            <button
              onClick={handleLogout}
              title="登出"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:border-red-300 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <div className="pointer-events-none absolute bottom-full left-full z-50 mb-1 ml-1 rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
              {user.name}
            </div>
          </div>
        ) : (
          // Expanded: name + role/dept + logout button (original style)
          <>
            <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
            <div className="mb-3 flex items-center gap-1.5 flex-wrap">
              <RoleBadge role={user.role} />
              {(user.department || user.region) && (
                <span className="text-xs text-gray-500">{user.department || user.region}</span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              登出
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
