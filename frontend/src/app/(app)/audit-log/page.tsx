'use client'

import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { useAuditLog } from '@/modules/audit/hooks/useAuditLog'
import type { AuditLog } from '@/types'

export default function AuditLogPage() {
  const { logs, isLoading } = useAuditLog()

  const columns = [
    {
      key: 'createdAt',
      label: 'Time',
      render: (row: AuditLog) => new Date(row.createdAt).toLocaleString(),
      sortable: true,
    },
    { key: 'userName', label: 'User', sortable: true },
    { key: 'action', label: 'Action', sortable: true },
    { key: 'resource', label: 'Resource', sortable: true },
    { key: 'resourceId', label: 'Resource ID', render: (row: AuditLog) => row.resourceId.slice(0, 8) },
    { key: 'ipAddress', label: 'IP Address' },
  ]

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable record of all system operations and data access."
      />
      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyMessage="No audit records found."
      />
    </div>
  )
}
