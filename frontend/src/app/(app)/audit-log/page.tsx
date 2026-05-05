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
      label: '時間',
      render: (row: AuditLog) => new Date(row.createdAt).toLocaleString(),
      sortable: true,
    },
    { key: 'userName', label: '使用者', sortable: true },
    { key: 'action', label: '操作', sortable: true },
    { key: 'resource', label: '資源', sortable: true },
    { key: 'resourceId', label: '資源編號', render: (row: AuditLog) => row.resourceId.slice(0, 8) },
    { key: 'ipAddress', label: 'IP 位址' },
  ]

  return (
    <div>
      <PageHeader
        title="稽核日誌"
        description="所有系統操作與資料存取的不可竄改紀錄。"
      />
      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyMessage="找不到稽核紀錄。"
      />
    </div>
  )
}
