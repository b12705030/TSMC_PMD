'use client'

import { use } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { useEmployee } from '@/modules/users/hooks/useTeam'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import type { ReviewGrade } from '@/types'

const GRADE_DISPLAY: Record<ReviewGrade, string> = {
  O: 'O', S_Plus: 'S+', S: 'S', S_Minus: 'S-', I: 'I', U: 'U',
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params)
  const t = useTranslations('team')
  const tCommon = useTranslations('common')
  const { employee, goals, reviews, isLoading } = useEmployee(employeeId)
  const { user } = useAuth()
  const isSupervisor = user?.role === 'Supervisor'

  if (isLoading) return <p className="text-muted">{tCommon('loading')}</p>
  if (!employee) return <p className="text-error">{t('employee.notFound')}</p>

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={employee.name}
        breadcrumbs={[{ label: t('employee.breadcrumb'), href: '/team' }, { label: employee.name }]}
      />

      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">{employee.name}</p>
            <p className="text-sm text-gray-500">{employee.employeeId} · {employee.email}</p>
          </div>
          <RoleBadge role={employee.role} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="label-caps">{t('employee.department')}</p>
            <p className="font-medium text-gray-700">{employee.department}</p>
          </div>
          <div>
            <p className="label-caps">{t('table.grade')}</p>
            <p className="font-medium text-gray-700">{employee.jobLevel}</p>
          </div>
          <div>
            <p className="label-caps">{t('table.title')}</p>
            <p className="font-medium text-gray-700">{employee.jobTitle}</p>
          </div>
        </div>
      </div>

      <h2 className="section-heading">{t('employee.goals')}</h2>
      {goals.length === 0 ? (
        <p className="text-muted mb-6">{t('employee.noGoals')}</p>
      ) : (
        <div className="mb-6 space-y-2">
          {goals.map((goal) => (
            <Link key={goal.id} href={`/goals/${goal.id}`} className="card-sm flex items-center justify-between hover:shadow-md transition-shadow block">
              <div>
                <p className="text-sm font-medium text-gray-900">{goal.title}</p>
                <p className="text-xs text-gray-400">{t('employee.deadline', { date: new Date(goal.dueDate).toLocaleDateString() })}</p>
              </div>
              <StatusBadge status={goal.status} />
            </Link>
          ))}
        </div>
      )}

      <h2 className="section-heading">{t('employee.reviews')}</h2>
      {reviews.length === 0 ? (
        <p className="text-muted">{t('employee.noReviews')}</p>
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <Link key={review.id} href={`/reviews/${review.id}`} className="card-sm flex items-center justify-between hover:shadow-md transition-shadow block">
              <p className="text-sm text-gray-700">{(review as { cycle?: { name: string } }).cycle?.name ?? review.cycleId}</p>
              <div className="flex items-center gap-3">
                {review.grade && (
                  <span className="text-sm font-bold text-gray-900">{GRADE_DISPLAY[review.grade as ReviewGrade]}</span>
                )}
                <StatusBadge status={isSupervisor && review.status === 'Appealed' ? 'Published' : review.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
