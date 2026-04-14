'use client'

import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { StatusBadge } from '@/components/StatusBadge'
import { useCycles } from '@/modules/cycles/hooks/useCycles'
import type { PerformanceCycle } from '@/types'

export default function CyclesPage() {
  const { cycles, isLoading } = useCycles()

  const columns = [
    { key: 'name', label: 'Cycle Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'region', label: 'Region', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (row: PerformanceCycle) => <StatusBadge status={row.status} />,
    },
    {
      key: 'goalSettingStart',
      label: 'Goal Setting Start',
      render: (row: PerformanceCycle) => new Date(row.goalSettingStart).toLocaleDateString(),
    },
    {
      key: 'reviewEnd',
      label: 'Review End',
      render: (row: PerformanceCycle) => new Date(row.reviewEnd).toLocaleDateString(),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Performance Cycles"
        description="Manage performance cycles for your region."
        actions={
          <button className="btn-primary">+ New Cycle</button>
        }
      />
      <DataTable columns={columns} data={cycles} isLoading={isLoading} emptyMessage="No cycles found." />
    </div>
  )
}
