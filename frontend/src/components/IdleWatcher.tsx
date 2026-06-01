'use client'

/**
 * IdleWatcher
 * - 偵測使用者閒置（滑鼠/鍵盤/觸碰）
 * - 閒置 25 分鐘時顯示右下角倒數 Toast（5 分鐘倒數）
 * - 閒置 30 分鐘時呼叫 onIdle() → 觸發登出
 * - 偵測到活動時每 30 秒送 keepalive，同步後端 lastActiveAt
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'

const IDLE_WARN_MS      = 1000 * 60 * 25 // 25 分鐘後顯示警告
const IDLE_LOGOUT_MS    = 1000 * 60 * 30 // 30 分鐘後登出
const WARN_DURATION     = IDLE_LOGOUT_MS - IDLE_WARN_MS // 5 分鐘倒數
const KEEPALIVE_MS      = 1000 * 10      // 最多每 10 秒送一次 keepalive

interface Props {
  onIdle: () => void
}

export function IdleWatcher({ onIdle }: Props) {
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARN_DURATION / 1000))

  const warnTimer         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastKeepalive     = useRef<number>(0)

  const clearTimers = useCallback(() => {
    if (warnTimer.current)   clearTimeout(warnTimer.current)
    if (logoutTimer.current) clearTimeout(logoutTimer.current)
    if (countdownInterval.current) clearInterval(countdownInterval.current)
  }, [])

  const resetTimers = useCallback(() => {
    clearTimers()
    setShowWarning(false)
    setSecondsLeft(Math.floor(WARN_DURATION / 1000))

    warnTimer.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(Math.floor(WARN_DURATION / 1000))
      countdownInterval.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            if (countdownInterval.current) clearInterval(countdownInterval.current)
            return 0
          }
          return s - 1
        })
      }, 1000)
    }, IDLE_WARN_MS)

    logoutTimer.current = setTimeout(() => {
      onIdle()
    }, IDLE_LOGOUT_MS)
  }, [clearTimers, onIdle])

  // 監聽使用者活動
  useEffect(() => {
    const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    const handleActivity = () => {
      resetTimers()
      const now = Date.now()
      if (now - lastKeepalive.current >= KEEPALIVE_MS) {
        lastKeepalive.current = now
        api.get('/auth/me').catch(() => {})
      }
    }

    EVENTS.forEach((e) => globalThis.addEventListener(e, handleActivity, { passive: true }))
    resetTimers()

    return () => {
      clearTimers()
      EVENTS.forEach((e) => globalThis.removeEventListener(e, handleActivity))
    }
  }, [resetTimers, clearTimers])

  if (!showWarning) return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const countdown = `${minutes}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">閒置逾時警告</p>
          <p className="mt-0.5 text-xs text-amber-700">
            系統將在 <span className="font-bold tabular-nums">{countdown}</span> 後自動登出。
          </p>
          <button
            onClick={resetTimers}
            className="mt-2 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
          >
            繼續使用
          </button>
        </div>
      </div>
    </div>
  )
}
