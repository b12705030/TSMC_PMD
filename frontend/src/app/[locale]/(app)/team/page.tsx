'use client'

import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { RoleBadge } from '@/components/RoleBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useTeam, useTeamHierarchy } from '@/modules/users/hooks/useTeam'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import type { User } from '@/types'

// ─── Supervisor flat view ────────────────────────────────────────────────────

function SupervisorTeamView() {
  const { members, isLoading, error } = useTeam()

  if (error) return <ErrorBanner message={error} />

  const columns = [
    { key: 'name',       label: '姓名',   sortable: true },
    { key: 'employeeId', label: '員工編號', sortable: true },
    { key: 'jobTitle',   label: '職稱',   sortable: true },
    { key: 'jobLevel',   label: '職等',   sortable: true },
    {
      key: 'role',
      label: '角色',
      render: (row: User) => <RoleBadge role={row.role} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: User) => (
        <Link href={`/team/${row.id}`} className="btn-link">查看</Link>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={members}
      isLoading={isLoading}
      emptyMessage="找不到任何團隊成員。"
    />
  )
}

// ─── Manager hierarchy view ──────────────────────────────────────────────────

function EmployeeRow({ emp }: { emp: User }) {
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
      <Link href={`/team/${emp.id}`} className="btn-link text-xs">查看</Link>
    </div>
  )
}

function ManagerTeamView() {
  const { groups, directReports, isLoading, error } = useTeamHierarchy()

  if (isLoading) return <p className="text-muted">載入中...</p>
  if (error) return <ErrorBanner message={error} />

  if (groups.length === 0 && directReports.length === 0) {
    return <EmptyState title="尚無團隊成員" description="目前沒有任何人被指派到你的部門。" />
  }

  return (
    <div className="space-y-6">
      {/* Supervisor groups */}
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
            <Link href={`/team/${supervisor.id}`} className="btn-link text-sm">查看 →</Link>
          </div>

          {employees.length === 0 ? (
            <p className="text-sm text-gray-400 pl-2">此主管目前沒有直屬員工。</p>
          ) : (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {employees.map((emp) => <EmployeeRow key={emp.id} emp={emp} />)}
            </div>
          )}

          <p className="mt-2 text-right text-xs text-gray-400">共 {employees.length} 位員工</p>
        </div>
      ))}

      {/* Direct reports (no supervisor) */}
      {directReports.length > 0 && (
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <span className="font-semibold text-gray-900">直屬員工</span>
            <span className="text-xs text-gray-400">（直接匯報給你，無直屬主管）</span>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {directReports.map((emp) => <EmployeeRow key={emp.id} emp={emp} />)}
          </div>
          <p className="mt-2 text-right text-xs text-gray-400">共 {directReports.length} 位員工</p>
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'Manager'

  return (
    <div>
      <PageHeader
        title="我的團隊"
        description={isManager ? '依直屬主管分組，檢視各組員工績效狀況。' : '管理你的直屬員工。'}
      />
      {isManager ? <ManagerTeamView /> : <SupervisorTeamView />}
    </div>
  )
}
