'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { useAppealUnreadCount } from '@/modules/appeals/hooks/useAppeals'
import { useNotifications } from '@/modules/notifications/hooks/useNotifications'
import { RoleBadge } from '@/components/RoleBadge'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import type { Role, AppNotification } from '@/types'

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
  '/goals/team':  <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zm-1 8h8m-8 4h5" />,
  '/reviews':     <Icon path="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" path2="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zm0 8h6m-6 4h4" />,
  '/reviews/team':<Icon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" path2="M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8 4a4 4 0 0 1 0 7.75M23 21v-2a4 4 0 0 0-3-3.87" />,
  '/team':        <Icon path="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
  '/cycles':      <Icon path="M3 4h18a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" path2="M16 2v4M8 2v4M2 9h20" />,
  '/templates':   <Icon path="M12 2L2 7l10 5 10-5-10-5" path2="M2 17l10 5 10-5M2 12l10 5 10-5" />,
  '/users':       <Icon path="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" path2="M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm10 0v6m3-3h-6" />,
  '/appeals':     <Icon path="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" path2="M4 22v-7" />,
  '/audit-log':   <Icon path="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />,
}

// ─── Nav items (using translation keys) ──────────────────────────────────────

type NavKey = 'dashboard' | 'myGoals' | 'teamGoals' | 'myReviews' | 'myReviewsSub' | 'teamReviews' | 'teamReviewsSub' | 'myTeam' | 'cycles' | 'templates' | 'users' | 'appeals' | 'auditLog'

interface NavItem {
  labelKey: NavKey
  subKey?: NavKey
  href: string
  roles: Role[]
  isTeam?: boolean   // 縮排顯示，代表「查看下屬」類功能
  dividerBefore?: boolean  // 在此項目前加一條分隔線
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'dashboard',   href: '/dashboard',    roles: ['Admin', 'GlobalHR', 'RegionalHR', 'Manager', 'Supervisor', 'Employee'] },
  { labelKey: 'myGoals',     href: '/goals',         roles: ['Employee', 'Supervisor', 'Manager'], dividerBefore: true },
  { labelKey: 'teamGoals',   href: '/goals/team',    roles: ['Supervisor', 'Manager'] },
  { labelKey: 'myReviews',   subKey: 'myReviewsSub', href: '/reviews',       roles: ['Employee', 'Supervisor', 'Manager'], dividerBefore: true },
  { labelKey: 'teamReviews', subKey: 'teamReviewsSub', href: '/reviews/team', roles: ['Supervisor', 'Manager'] },
  { labelKey: 'myTeam',      href: '/team',          roles: ['Supervisor', 'Manager'], dividerBefore: true },
  { labelKey: 'cycles',      href: '/cycles',        roles: ['Admin', 'GlobalHR', 'RegionalHR', 'Manager', 'Supervisor', 'Employee'], dividerBefore: true },
  { labelKey: 'templates',   href: '/templates',     roles: ['Admin', 'GlobalHR', 'RegionalHR', 'Manager'] },
  { labelKey: 'users',       href: '/users',         roles: ['Admin'] },
  { labelKey: 'appeals',     href: '/appeals',       roles: ['Manager', 'Admin', 'GlobalHR', 'RegionalHR'] },
  { labelKey: 'auditLog',    href: '/audit-log',     roles: ['Admin', 'GlobalHR', 'RegionalHR'] },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname      = usePathname()
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const { user, setUser } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const tNav     = useTranslations('nav')
  const tSidebar = useTranslations('sidebar')

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

  // 只有 Employee 才需要查詢未讀申訴數，其他角色傳 enabled=false 避免每分鐘觸發 403
  const appealUnreadCount = useAppealUnreadCount(user?.role === 'Employee')

  // 通知鈴鐺
  const { notifications, unreadCount: notifUnread, markRead, markAllRead } = useNotifications()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // 通知點擊導航對應頁面
  function getNotificationHref(type: string, role: string): string | null {
    switch (type) {
      case 'GoalSubmitted':
        return role === 'Employee' ? '/goals' : '/goals/team'
      case 'GoalRejected':
      case 'GoalApproved':
        return '/goals'
      case 'AppealFiled':
        return '/appeals'
      case 'AppealResolved':
        return '/appeals'
      case 'ReviewSubmitted':
      case 'ReviewApproved':
        return '/reviews/team'
      case 'ReviewPublished':
        return '/reviews'
      case 'CycleAutoAdvanced':
      case 'CyclePostponed':
      case 'CycleAdvanceReminder':
        return '/cycles'
      default:
        return null
    }
  }

  // 點外部關閉通知面板
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!user) return null

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  // ?from=team 參數：從團隊目標/團隊評核點進詳細頁時，正確高亮對應的 sidebar 項目
  // 否則 /goals/:id 會因前綴匹配而錯誤高亮「我的目標」
  // 注意：不能用前綴比對找 teamItem，因為 /goals/{uuid} 不會 startsWith /goals/team/
  // 正確做法：找「href 結尾為 /team」且「去掉 /team 後的基底路徑是當前路徑的前綴」的 item
  const fromParam = searchParams.get('from')
  const activeHref = (() => {
    if (fromParam === 'team') {
      const teamItem = visibleItems.find((item) => {
        if (!item.href.endsWith('/team')) return false
        const baseSection = item.href.slice(0, -'/team'.length) // e.g. /goals/team → /goals
        return pathname === baseSection || pathname.startsWith(baseSection + '/')
      })
      if (teamItem) return teamItem.href
    }

    const matched = visibleItems
      .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
      .sort((a, b) => b.href.length - a.href.length)
    return matched[0]?.href
  })()

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
            const isActive  = item.href === activeHref
            const icon      = ICONS[item.href]
            const label     = tNav(item.labelKey)
            const sub       = item.subKey ? tNav(item.subKey) : undefined
            const showBadge = item.href === '/reviews' && appealUnreadCount > 0
            return (
              <li key={item.href}>
                {/* 分隔線 */}
                {item.dividerBefore && !collapsed && (
                  <div className="my-1 border-t border-gray-100" />
                )}
                {collapsed ? (
                  // Collapsed: icon only + tooltip
                  <div className="group relative">
                    <Link
                      href={item.href}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {icon}
                      {showBadge && (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
                      )}
                    </Link>
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                      {label}
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
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="truncate">{label}</span>
                      {sub && (
                        <span className={`text-xs font-normal truncate ${isActive ? 'text-primary-500' : 'text-gray-400'}`}>
                          {sub}
                        </span>
                      )}
                    </span>
                    {showBadge && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                        {appealUnreadCount}
                      </span>
                    )}
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
        title={collapsed ? tSidebar('expand') : tSidebar('collapse')}
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'} />
        </svg>
      </button>

      {/* Notification Bell */}
      <div ref={notifRef} className="relative border-t border-gray-200 px-4 py-2">
        {collapsed ? (
          <div className="group relative flex justify-center">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifUnread > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
              通知
            </div>
          </div>
        ) : (
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="truncate">通知</span>
            {notifUnread > 0 && (
              <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
                {notifUnread}
              </span>
            )}
          </button>
        )}

        {/* Notification Panel */}
        {notifOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-80 rounded-xl border border-gray-200 bg-white shadow-xl"
               style={{ left: collapsed ? '3.5rem' : '0' }}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">通知</span>
              {notifUnread > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-500 hover:text-blue-700">
                  全部標為已讀
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-gray-400">沒有通知</li>
              ) : (
                notifications.map((n: AppNotification) => (
                  <li
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead(n.id)
                      const href = getNotificationHref(n.type, user.role)
                      if (href) { setNotifOpen(false); router.push(href) }
                    }}
                    className={`cursor-pointer px-4 py-3 hover:bg-gray-50 transition-colors ${n.read ? '' : 'bg-blue-50/50'}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                      <div className={!n.read ? '' : 'ml-4'}>
                        <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500 leading-snug">{n.message}</p>
                        <p className="mt-1 text-xs text-gray-300">
                          {new Date(n.createdAt).toLocaleDateString('zh-TW')}
                        </p>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Language switcher */}
      {!collapsed && (
        <div className="border-t border-gray-200 px-4 py-2">
          <LanguageSwitcher />
        </div>
      )}

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
              title={tSidebar('logout')}
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
          // Expanded: name + role/dept + logout button
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
              {tSidebar('logout')}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
