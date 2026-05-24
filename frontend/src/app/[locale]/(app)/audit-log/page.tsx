'use client'

import { useCallback, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useAuditLog } from '@/modules/audit/hooks/useAuditLog'
import type { AuditLog } from '@/types'

const PAGE_SIZE = 50

function OutcomeBadge({ outcome }: { outcome: 'SUCCESS' | 'FORBIDDEN' }) {
  return outcome === 'FORBIDDEN' ? (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
      FORBIDDEN
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
      SUCCESS
    </span>
  )
}

export default function AuditLogPage() {
  const t      = useTranslations('auditLog')
  const locale = useLocale()

  const [q, setQ]               = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [outcome, setOutcome]   = useState('')
  const [page, setPage]         = useState(0)

  // debounce search input
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = useCallback((value: string) => {
    setQ(value)
    if (debounceTimer) clearTimeout(debounceTimer)
    const t = setTimeout(() => { setDebouncedQ(value); setPage(0) }, 300)
    setDebounceTimer(t)
  }, [debounceTimer])

  const { logs, total, isLoading, error } = useAuditLog({
    q: debouncedQ,
    outcome,
    from: page * PAGE_SIZE,
    size: PAGE_SIZE,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = [
    {
      key: 'createdAt',
      label: t('colTime'),
      render: (row: AuditLog) => new Date(row.createdAt).toLocaleString(locale),
      sortable: true,
    },
    { key: 'userName',  label: t('colUser'),     sortable: true },
    { key: 'action',    label: t('colAction'),   sortable: true },
    { key: 'resource',  label: t('colResource'), sortable: true },
    {
      key: 'httpPath',
      label: t('colRequest'),
      render: (row: AuditLog) => row.httpPath ? (
        <span className="font-mono text-xs text-gray-500">
          {row.httpMethod && <span className="mr-1 font-semibold text-gray-700">{row.httpMethod}</span>}
          {row.httpPath.length > 40 ? row.httpPath.slice(0, 40) + '…' : row.httpPath}
        </span>
      ) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'outcome',
      label: t('colOutcome'),
      render: (row: AuditLog) => <OutcomeBadge outcome={row.outcome} />,
    },
    {
      key: 'resourceId',
      label: t('colResourceId'),
      render: (row: AuditLog) => row.resourceId?.slice(0, 8) ?? '—',
    },
    { key: 'ipAddress', label: t('colIpAddress') },
  ]

  return (
    <div>
      <PageHeader title={t('pageTitle')} description={t('pageDesc')} />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={outcome}
          onChange={(e) => { setOutcome(e.target.value); setPage(0) }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">{t('outcomeAll')}</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FORBIDDEN">FORBIDDEN</option>
        </select>
      </div>

      {error ? (
        <ErrorBanner message={error} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={logs}
            isLoading={isLoading}
            emptyMessage={t('empty')}
          />

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>{t('total', { count: total })}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                {t('prev')}
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                {t('next')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
