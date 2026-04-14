'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { RoleBadge } from '@/components/RoleBadge'
import { useTeam } from '@/modules/users/hooks/useTeam'
import type { User } from '@/types'

export default function TeamPage() {
  const { members, isLoading } = useTeam()

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'employeeId', label: 'Employee ID', sortable: true },
    { key: 'jobTitle', label: 'Job Title', sortable: true },
    { key: 'jobLevel', label: 'Level', sortable: true },
    {
      key: 'role',
      label: 'Role',
      render: (row: User) => <RoleBadge role={row.role} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: User) => (
        <Link
          href={`/team/${row.id}`}
          className="btn-link"
        >
          View
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Team" description="Manage your team members and their performance." />
      <DataTable columns={columns} data={members} isLoading={isLoading} emptyMessage="No team members found." />
    </div>
  )
}
