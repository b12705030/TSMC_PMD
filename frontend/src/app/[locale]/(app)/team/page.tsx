'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { RoleBadge } from '@/components/RoleBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useTeam, useTeamHierarchy } from '@/modules/users/hooks/useTeam'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import type { User } from '@/types'

function SupervisorTeamView() {
  const t = useTranslations('team')
  const { members, isLoading, error } = useTeam()

  if (error) return <ErrorBanner message={error} />

  const columns = [
    { key: 'name',       label: t('table.name'),       sortable: true },
    { key: 'employeeId', label: t('table.employeeId'), sortable: true },
    { key: 'jobTitle',   label: t('table.title'),      sortable: true },
    { key: 'jobLevel',   label: t('table.grade'),      sortable: true },
    {
      key: 'role',
      label: t('table.role'),
      render: (row: User) => <RoleBadge role={row.role} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: User) => (
        <Link href={`/team/${row.id}`} className="btn-link">{t('table.view')}</Link>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={members}
      isLoading={isLoading}
      emptyMessage={t('notFound')}
    />
  )
}

function EmployeeRow({ emp }: { emp: User }) {
  const t = useTranslations('team')
  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
          {emp.name.slice(0, 1)}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{emp.name}</p>
          <p className="text-xs text-gray-400">{emp.jobTitle} · {emp.jobLevel} · {emp.employeeId}</p>
        </div>
      </div>
      <Link href={`/team/${emp.id}`} className="btn-link text-xs">{t('supervisor.view')}</Link>
    </div>
  )
}

function ManagerTeamView() {
  const t = useTranslations('team')
  const tCommon = useTranslations('common')
  const { groups, directReports, isLoading, error } = useTeamHierarchy()

  if (isLoading) return <p className="text-muted">{tCommon('loading')}</p>
  if (error) return <ErrorBanner message={error} />

  if (groups.length === 0 && directReports.length === 0) {
    return <EmptyState title={t('empty.title')} description={t('empty.desc')} />
  }

  return (
    <div className="space-y-6">
      {groups.map(({ supervisor, employees }) => (
        <div key={supervisor.id} className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {supervisor.name.slice(0, 1)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{supervisor.name}</span>
                  <RoleBadge role={supervisor.role} />
                </div>
                <p className="text-xs text-gray-400">
                  {supervisor.jobTitle} · {supervisor.department} · {supervisor.employeeId}
                </p>
              </div>
            </div>
            <Link href={`/team/${supervisor.id}`} className="btn-link text-sm">{t('supervisor.view')}</Link>
          </div>

          {employees.length === 0 ? (
            <p className="text-sm text-gray-400 pl-2">{t('supervisor.noReports')}</p>
          ) : (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {employees.map((emp) => <EmployeeRow key={emp.id} emp={emp} />)}
            </div>
          )}

          <p className="mt-2 text-right text-xs text-gray-400">{t('supervisor.count', { count: employees.length })}</p>
        </div>
      ))}

      {directReports.length > 0 && (
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <span className="font-semibold text-gray-900">{t('directReports.title')}</span>
            <span className="text-xs text-gray-400">{t('directReports.subtitle')}</span>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {directReports.map((emp) => <EmployeeRow key={emp.id} emp={emp} />)}
          </div>
          <p className="mt-2 text-right text-xs text-gray-400">{t('directReports.count', { count: directReports.length })}</p>
        </div>
      )}
    </div>
  )
}

export default function TeamPage() {
  const t = useTranslations('team')
  const { user } = useAuth()
  const isManager = user?.role === 'Manager'

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        description={isManager ? t('pageDescManager') : t('pageDescSupervisor')}
      />
      {isManager ? <ManagerTeamView /> : <SupervisorTeamView />}
    </div>
  )
}
