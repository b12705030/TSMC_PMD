'use client'

/**
 * DeadlineToast
 * 當使用者有目標在 7 天內到期（且尚未完成）時，右下角顯示提醒 Toast。
 * 只對 Employee 和 Supervisor 顯示（有目標的角色）。
 */

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { Goal } from '@/types'

const DAYS_THRESHOLD = 7
const DISMISSED_KEY  = 'deadline-toast-dismissed' // localStorage key（每日重置）

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function DeadlineToast() {
  const { user } = useAuth()
  const [urgentGoals, setUrgentGoals] = useState<Goal[]>([])
  const [dismissed, setDismissed] = useState(true) // 預設隱藏，待資料載入後決定

  useEffect(() => {
    if (!user || (user.role !== 'Employee' && user.role !== 'Supervisor')) return

    // 若今天已關閉，不再顯示
    const saved = localStorage.getItem(DISMISSED_KEY)
    if (saved === todayKey()) return

    api.get<Goal[]>('/goals')
      .then((goals) => {
        const now    = Date.now()
        const cutoff = now + DAYS_THRESHOLD * 24 * 60 * 60 * 1000
        const urgent = goals.filter((g) => {
          if (g.status === 'Completed') return false
          const due = new Date(g.dueDate).getTime()
          return due >= now && due <= cutoff
        })
        if (urgent.length > 0) {
          setUrgentGoals(urgent)
          setDismissed(false)
        }
      })
      .catch(() => {}) // 非關鍵功能，靜默失敗
  }, [user])

  if (dismissed || urgentGoals.length === 0) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, todayKey())
    setDismissed(true)
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-80 rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-lg">📅</span>
          <div>
            <p className="text-sm font-semibold text-orange-800">
              目標即將到期（{urgentGoals.length} 項）
            </p>
            <ul className="mt-1.5 space-y-1">
              {urgentGoals.slice(0, 3).map((g) => {
                const daysLeft = Math.ceil(
                  (new Date(g.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <li key={g.id} className="text-xs text-orange-700">
                    <Link href={`/goals/${g.id}`} className="font-medium hover:underline">
                      {g.title}
                    </Link>
                    <span className="ml-1 text-orange-500">
                      （剩 {daysLeft} 天）
                    </span>
                  </li>
                )
              })}
              {urgentGoals.length > 3 && (
                <li className="text-xs text-orange-500">還有 {urgentGoals.length - 3} 項…</li>
              )}
            </ul>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-orange-400 hover:text-orange-600"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
