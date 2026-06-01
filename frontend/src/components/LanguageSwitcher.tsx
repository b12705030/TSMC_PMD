'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { routing } from '@/i18n/routing'

type Locale = (typeof routing.locales)[number]

export function LanguageSwitcher() {
  const locale   = useLocale()
  const pathname = usePathname()
  const t        = useTranslations('language')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function switchLocale(next: Locale) {
    setOpen(false)
    if (next === locale) return
    // Replace the locale segment — hard navigation ensures server re-renders
    // [locale]/layout.tsx with the correct messages for the new locale.
    const segments = pathname.split('/')
    if (routing.locales.includes(segments[1] as Locale)) {
      segments[1] = next
    } else {
      segments.splice(1, 0, next)
    }
    globalThis.location.assign(segments.join('/') || `/${next}`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        {/* Globe icon */}
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="truncate">{t(locale)}</span>
        <svg className={`h-3 w-3 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg z-50">
          {routing.locales.map((l) => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                l === locale
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(l)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
