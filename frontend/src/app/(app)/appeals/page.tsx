'use client'

import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { useAppeals } from '@/modules/appeals/hooks/useAppeals'
import type { Appeal } from '@/types'

export default function AppealsPage() {
  const { appeals, isLoading } = useAppeals()

  const columns = [
    { key: 'id', label: '申訴編號', render: (row: Appeal) => row.id.slice(0, 8) },
    { key: 'employeeId', label: '員工', sortable: true },
    {
      key: 'status',
      label: '狀態',
      render: (row: Appeal) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      label: '提交時間',
      render: (row: Appeal) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Appeal) =>
        row.status === 'Pending' ? (
          <button className="btn-link">審閱</button>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader title="申訴管理" description="審閱並回應員工的績效申訴。" />

      {!isLoading && appeals.length === 0 ? (
        <EmptyState title="尚無申訴" description="目前尚無員工提交申訴。" />
      ) : (
        <DataTable columns={columns} data={appeals} isLoading={isLoading} />
      )}
    </div>
  )
}
