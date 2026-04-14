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
    { key: 'id', label: 'Appeal ID', render: (row: Appeal) => row.id.slice(0, 8) },
    { key: 'employeeId', label: 'Employee', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (row: Appeal) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      render: (row: Appeal) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Appeal) =>
        row.status === 'Pending' ? (
          <button className="btn-link">Review</button>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader title="Appeals" description="Review and respond to employee performance appeals." />

      {!isLoading && appeals.length === 0 ? (
        <EmptyState title="No appeals" description="No appeals have been submitted yet." />
      ) : (
        <DataTable columns={columns} data={appeals} isLoading={isLoading} />
      )}
    </div>
  )
}
