'use client'

import { useTranslations, useLocale } from 'next-intl'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useAuditLog } from '@/modules/audit/hooks/useAuditLog'
import type { AuditLog } from '@/types'

export default function AuditLogPage() {
  const t      = useTranslations('auditLog')
  const locale = useLocale()
  const { logs, isLoading, error } = useAuditLog()

  const columns = [
    {
      key: 'createdAt',
      label: t('colTime'),
      render: (row: AuditLog) => new Date(row.createdAt).toLocaleString(locale),
      sortable: true,
    },
    { key: 'userName',   label: t('colUser'),       sortable: true },
    { key: 'action',     label: t('colAction'),     sortable: true },
    { key: 'resource',   label: t('colResource'),   sortable: true },
    { key: 'resourceId', label: t('colResourceId'), render: (row: AuditLog) => row.resourceId.slice(0, 8) },
    { key: 'ipAddress',  label: t('colIpAddress') },
  ]

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDesc')}
      />
      {error ? (
        <ErrorBanner message={error} />
      ) : (
        <DataTable
          columns={columns}
          data={logs}
          isLoading={isLoading}
          emptyMessage={t('empty')}
        />
      )}
    </div>
  )
}
