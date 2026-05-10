'use client'

import { Link } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { PageHeader } from '@/components/PageHeader'
import { ErrorBanner } from '@/components/ErrorBanner'
import { StatusBadge } from '@/components/StatusBadge'
import { CycleStepper } from '@/components/CycleStepper'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { useCycles } from '@/modules/cycles/hooks/useCycles'
import { useGoals } from '@/modules/goals/hooks/useGoals'
import { useReviews, useTeamReviews, useReviewStats } from '@/modules/reviews/hooks/useReviews'
import { useTemplates } from '@/modules/templates/hooks/useTemplates'
import type { PerformanceCycle, Role } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ─── Timeline (Gantt) ─────────────────────────────────────────────────────────

const BAR_COLORS = {
  goalSetting: { bg: 'bg-blue-300',   label: 'text-blue-900' },
  review:      { bg: 'bg-violet-300', label: 'text-violet-900' },
  publish:     { bg: 'bg-emerald-400', label: 'text-emerald-900' },
}

function CycleTimeline({ cycles }: { cycles: PerformanceCycle[] }) {
  const t      = useTranslations('dashboard')
  const locale = useLocale()

  if (cycles.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="section-heading">{t('timeline.emptyTitle')}</h2>
        <div className="card py-6 text-center">
          <p className="text-sm text-gray-500">{t('timeline.emptyDesc')}</p>
          <p className="mt-1 text-xs text-gray-400">{t('timeline.emptyDescSub')}</p>
        </div>
      </section>
    )
  }

  const currentYear = new Date().getFullYear()
  const tlStart = new Date(currentYear, 0, 1)
  const tlEnd   = new Date(currentYear, 11, 31)
  const totalMs = tlEnd.getTime() - tlStart.getTime()

  function pctLeft(date: string) {
    return `${Math.max(0, Math.min(100, ((new Date(date).getTime() - tlStart.getTime()) / totalMs) * 100)).toFixed(2)}%`
  }
  function pctWidth(start: string, end: string) {
    const s = Math.max(new Date(start).getTime(), tlStart.getTime())
    const e = Math.min(new Date(end).getTime(), tlEnd.getTime())
    return `${Math.max(0, ((e - s) / totalMs) * 100).toFixed(2)}%`
  }
  function dayBefore(date: string): string {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    return d.toISOString()
  }
  function dayAfter(date: string): string {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    return d.toISOString()
  }

  const ticks: { label: string; pct: number }[] = []
  const cur = new Date(tlStart)
  while (cur <= tlEnd) {
    ticks.push({
      label: cur.toLocaleDateString(locale, { month: 'short' }),
      pct: ((cur.getTime() - tlStart.getTime()) / totalMs) * 100,
    })
    cur.setMonth(cur.getMonth() + 1)
  }

  const todayPct = ((Date.now() - tlStart.getTime()) / totalMs) * 100
  const showToday = todayPct >= 0 && todayPct <= 100

  const cycleTypeLabel: Record<string, string> = {
    Annual:    t('cycleTypes.Annual'),
    Quarterly: t('cycleTypes.Quarterly'),
    Probation: t('cycleTypes.Probation'),
  }

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="section-heading mb-0">{t('timeline.yearTitle', { year: currentYear })}</h2>
        <span className="text-xs text-gray-400">{t('timeline.subtitle')}</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 560 }}>
            {/* Month ruler */}
            <div className="relative h-7 border-b border-gray-100 mb-1">
              {ticks.map((tick, i) => (
                <span
                  key={i}
                  className="absolute bottom-1 whitespace-nowrap text-[10px] text-gray-400"
                  style={{
                    left: `${tick.pct.toFixed(2)}%`,
                    transform: i === 0 ? 'translateX(0)' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  {tick.label}
                </span>
              ))}
              {ticks.map((tick, i) => (
                <div key={`g${i}`} className="absolute top-0 bottom-0 border-l border-gray-100" style={{ left: `${tick.pct.toFixed(2)}%` }} />
              ))}
            </div>

            {/* Cycle rows */}
            <div className="space-y-3 py-2">
              {cycles.map((cycle) => (
                <div key={cycle.id}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800">{cycle.name}</span>
                    <span className="text-xs text-gray-400">{cycleTypeLabel[cycle.type] ?? cycle.type}</span>
                    <StatusBadge status={cycle.status} />
                  </div>
                  <div className="relative h-8 rounded bg-gray-50">
                    {/* Goal setting + execution bar (goalSettingStart → dayBefore(reviewStart)) */}
                    <div
                      className={`absolute top-1 bottom-1 rounded ${BAR_COLORS.goalSetting.bg} flex items-center overflow-hidden`}
                      style={{ left: pctLeft(cycle.goalSettingStart), width: pctWidth(cycle.goalSettingStart, dayBefore(cycle.reviewStart)) }}
                      title={t('timeline.goalRange', { start: fmtDate(cycle.goalSettingStart, locale), end: fmtDate(dayBefore(cycle.reviewStart), locale) })}
                    >
                      <span className={`px-1.5 text-[10px] font-medium whitespace-nowrap ${BAR_COLORS.goalSetting.label}`}>
                        {t('timeline.goalSettingBar')}
                      </span>
                    </div>
                    <div
                      className={`absolute top-1 bottom-1 rounded ${BAR_COLORS.review.bg} flex items-center overflow-hidden`}
                      style={{ left: pctLeft(cycle.reviewStart), width: pctWidth(cycle.reviewStart, cycle.reviewEnd) }}
                      title={t('timeline.reviewRange', { start: fmtDate(cycle.reviewStart, locale), end: fmtDate(cycle.reviewEnd, locale) })}
                    >
                      <span className={`px-1.5 text-[10px] font-medium whitespace-nowrap ${BAR_COLORS.review.label}`}>
                        {t('timeline.reviewBar')}
                      </span>
                    </div>
                    {/* Publish bar (reviewEnd + 1 day) */}
                    <div
                      className={`absolute top-1 bottom-1 rounded ${BAR_COLORS.publish.bg} flex items-center overflow-hidden`}
                      style={{ left: pctLeft(dayAfter(cycle.reviewEnd)), width: pctWidth(dayAfter(cycle.reviewEnd), dayAfter(dayAfter(cycle.reviewEnd))), minWidth: '6px' }}
                      title={t('timeline.publishRange', { date: fmtDate(dayAfter(cycle.reviewEnd), locale) })}
                    >
                      <span className={`px-1.5 text-[10px] font-medium whitespace-nowrap ${BAR_COLORS.publish.label}`}>
                        {t('timeline.legendPublish')}
                      </span>
                    </div>
                    {showToday && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                        style={{ left: `${todayPct.toFixed(2)}%` }}
                        title={t('timeline.todayMarker')}
                      />
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400">
                    {t('timeline.goalRange', { start: fmtDate(cycle.goalSettingStart, locale), end: fmtDate(dayBefore(cycle.reviewStart), locale) })}
                    &nbsp;·&nbsp;
                    {t('timeline.reviewRange', { start: fmtDate(cycle.reviewStart, locale), end: fmtDate(cycle.reviewEnd, locale) })}
                    &nbsp;·&nbsp;
                    {t('timeline.publishRange', { date: fmtDate(dayAfter(cycle.reviewEnd), locale) })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-blue-300" />{t('timeline.legendGoal')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-violet-300" />{t('timeline.legendReview')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-emerald-400" />{t('timeline.legendPublish')}
              </span>
              {showToday && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-0.5 rounded bg-amber-400" />{t('timeline.todayMarker')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Active Cycles Detail ─────────────────────────────────────────────────────

function ActiveCycles({ cycles }: { cycles: PerformanceCycle[] }) {
  const t = useTranslations('dashboard')
  const active = cycles.filter((c) => c.status !== 'Completed')
  if (active.length === 0) return null

  const cycleTypeLabel: Record<string, string> = {
    Annual:    t('cycleTypes.Annual'),
    Quarterly: t('cycleTypes.Quarterly'),
    Probation: t('cycleTypes.Probation'),
  }
  const cycleStatusDesc: Record<string, string> = {
    GoalSetting:      t('cycleStatusDesc.GoalSetting'),
    InProgress:       t('cycleStatusDesc.InProgress'),
    EmployeeReview:   t('cycleStatusDesc.EmployeeReview'),
    SupervisorReview: t('cycleStatusDesc.SupervisorReview'),
    Calibration:      t('cycleStatusDesc.Calibration'),
    Completed:        t('cycleStatusDesc.Completed'),
  }

  return (
    <section className="mb-8">
      <h2 className="section-heading">{t('activeCycles.title')}</h2>
      <div className="space-y-4">
        {active.map((cycle) => (
          <div key={cycle.id} className="card">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900">{cycle.name}</h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {cycleTypeLabel[cycle.type] ?? cycle.type} · {cycle.regions.join(', ')}
                </p>
              </div>
              <StatusBadge status={cycle.status} />
            </div>
            <CycleStepper status={cycle.status} />
            <p className="mt-3 text-xs text-gray-500">{cycleStatusDesc[cycle.status] ?? ''}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Employee Section ─────────────────────────────────────────────────────────

function EmployeeSection() {
  const t = useTranslations('dashboard')
  const { reviews, isLoading: rl, error: rlErr } = useReviews()
  const { goals,   isLoading: gl, error: glErr } = useGoals()

  const pendingReviews = reviews.filter((r) => r.status === 'PendingEmployeeSubmit')
  const goalStats = {
    total:           goals.length,
    draft:           goals.filter((g) => g.status === 'Draft').length,
    pendingApproval: goals.filter((g) => g.status === 'PendingApproval').length,
    approved:        goals.filter((g) => g.status === 'Approved').length,
    completed:       goals.filter((g) => g.status === 'Completed').length,
  }

  return (
    <>
      {!rl && pendingReviews.length > 0 && (
        <section className="mb-6">
          <h2 className="section-heading">{t('actionsRequired')}</h2>
          <div className="space-y-2">
            {pendingReviews.map((r) => (
              <Link
                key={r.id}
                href={`/reviews/${r.id}`}
                className="flex items-center justify-between rounded-lg border-l-4 border-l-blue-500 bg-blue-50 p-4 hover:bg-blue-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{t('myReviews.pendingTitle')}</p>
                  <p className="text-sm text-gray-600">{r.cycle.name} · {r.template.name}</p>
                </div>
                <span className="text-sm font-medium text-blue-600">{t('fillNow')}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Goals stats */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-heading mb-0">{t('goals.title')}</h2>
            <Link href="/goals" className="btn-link text-sm">{t('viewAll')}</Link>
          </div>
          {gl ? (
            <p className="text-muted">{t('loading')}</p>
          ) : glErr ? (
            <ErrorBanner message={glErr} />
          ) : goalStats.total === 0 ? (
            <div className="card py-6 text-center">
              <p className="text-sm text-gray-500">{t('goals.empty')}</p>
              <Link href="/goals" className="btn-primary mt-3 inline-block text-sm">{t('goals.setGoal')}</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t('goals.draft'),           count: goalStats.draft,            color: 'bg-gray-100 text-gray-700' },
                { label: t('goals.pendingApproval'), count: goalStats.pendingApproval,  color: 'bg-yellow-100 text-yellow-700' },
                { label: t('goals.approved'),        count: goalStats.approved,         color: 'bg-green-100 text-green-700' },
                { label: t('goals.completed'),       count: goalStats.completed,        color: 'bg-indigo-100 text-indigo-700' },
              ].map(({ label, count, color }) => (
                <Link key={label} href="/goals" className={`rounded-lg p-3 text-center ${color} block hover:opacity-80`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="mt-0.5 text-xs font-medium">{label}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-heading mb-0">{t('myReviews.title')}</h2>
            <Link href="/reviews" className="btn-link text-sm">{t('viewAll')}</Link>
          </div>
          {rl ? (
            <p className="text-muted">{t('loading')}</p>
          ) : rlErr ? (
            <ErrorBanner message={rlErr} />
          ) : reviews.length === 0 ? (
            <p className="text-muted">{t('myReviews.empty')}</p>
          ) : (
            <div className="space-y-2">
              {reviews.slice(0, 4).map((r) => (
                <Link key={r.id} href={`/reviews/${r.id}`} className="card-sm flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.cycle.name}</p>
                    <p className="text-xs text-gray-400">{r.template.name}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

// ─── Supervisor / Manager Section ─────────────────────────────────────────────

function TeamReviewSection({ role }: { role: Role }) {
  const t = useTranslations('dashboard')
  const { reviews, isLoading, error } = useTeamReviews()

  const pendingSup = reviews.filter((r) => r.status === 'PendingSupervisorReview')
  const pendingMgr = reviews.filter((r) => r.status === 'PendingManagerApproval')
  const actionItems = role === 'Manager' ? pendingMgr : pendingSup
  const actionLabel = role === 'Manager' ? t('teamReviews.actionLabelManager') : t('teamReviews.actionLabelOther')

  return (
    <>
      {!isLoading && actionItems.length > 0 && (
        <section className="mb-6">
          <h2 className="section-heading">{t('actionsRequired')}</h2>
          <Link
            href="/reviews/team"
            className="flex items-center justify-between rounded-lg border-l-4 border-l-amber-500 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
          >
            <div>
              <p className="font-medium text-gray-900">{t('teamReviews.actionCount', { count: actionItems.length, action: actionLabel })}</p>
              <p className="text-sm text-gray-600">{t('teamReviews.actionDesc')}</p>
            </div>
            <span className="text-sm font-medium text-amber-600">{t('goTo')}</span>
          </Link>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-heading mb-0">{t('teamReviews.title')}</h2>
          <Link href="/reviews/team" className="btn-link text-sm">{t('viewAll')}</Link>
        </div>
        {isLoading ? (
          <p className="text-muted">{t('loading')}</p>
        ) : error ? (
          <ErrorBanner message={error} />
        ) : reviews.length === 0 ? (
          <div className="card py-5 text-center">
            <p className="text-sm text-gray-500">{t('teamReviews.empty')}</p>
            <p className="mt-1 text-xs text-gray-400">{t('teamReviews.emptyDesc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('teamReviews.pendingEmployee'),   count: reviews.filter((r) => r.status === 'PendingEmployeeSubmit').length,   color: 'bg-blue-100 text-blue-700' },
              { label: t('teamReviews.pendingSupervisor'), count: reviews.filter((r) => r.status === 'PendingSupervisorReview').length,  color: 'bg-yellow-100 text-yellow-700' },
              { label: t('teamReviews.pendingCalibration'),count: reviews.filter((r) => r.status === 'PendingManagerApproval').length,   color: 'bg-purple-100 text-purple-700' },
            ].map(({ label, count, color }) => (
              <Link key={label} href="/reviews/team" className={`rounded-lg p-3 text-center ${color} block hover:opacity-80`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="mt-0.5 text-xs font-medium">{label}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {role === 'Manager' && (
        <section className="mb-8">
          <h2 className="section-heading">{t('gradeChart.titleTeam')}</h2>
          <div className="card">
            <GradeDistributionChart />
          </div>
        </section>
      )}
    </>
  )
}

// ─── Grade Distribution Chart ─────────────────────────────────────────────────

const GRADE_ORDER     = ['O', 'S_Plus', 'S', 'S_Minus', 'I', 'U'] as const
const GRADE_LABEL     = { O: 'O', S_Plus: 'S+', S: 'S', S_Minus: 'S-', I: 'I', U: 'U' } as const
const GRADE_BAR_COLOR = {
  O: 'bg-green-400', S_Plus: 'bg-indigo-400', S: 'bg-indigo-300',
  S_Minus: 'bg-indigo-200', I: 'bg-amber-400', U: 'bg-red-400',
} as const

function GradeDistributionChart() {
  const t = useTranslations('dashboard')
  const { stats, isLoading, error } = useReviewStats()

  if (isLoading) return <p className="text-muted text-sm">{t('loading')}</p>
  if (error) return <p className="text-sm text-red-600">載入失敗：{error}</p>
  if (!stats || stats.total === 0) return <p className="text-muted text-sm">{t('gradeChart.empty')}</p>

  const graded      = GRADE_ORDER.map((g) => ({ grade: g, count: stats.gradeDistribution[g] ?? 0 }))
  const gradedTotal = graded.reduce((s, g) => s + g.count, 0)
  const pending     = stats.total - gradedTotal

  return (
    <div className="space-y-2">
      {graded.map(({ grade, count }) => {
        const pct = gradedTotal > 0 ? (count / gradedTotal) * 100 : 0
        return (
          <div key={grade} className="flex items-center gap-3">
            <span className="w-6 text-xs font-semibold text-gray-600">{GRADE_LABEL[grade]}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-2 rounded-full transition-all ${GRADE_BAR_COLOR[grade]}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 text-right text-xs text-gray-500">{count}</span>
          </div>
        )
      })}
      <p className="pt-1 text-xs text-gray-400">
        {t('gradeChart.summary', { total: stats.total, graded: gradedTotal })}
        {pending > 0 && t('gradeChart.summaryPending', { pending })}
      </p>
    </div>
  )
}

// ─── HR Section ────────────────────────────────────────────────────────────────

function HRSection() {
  const t = useTranslations('dashboard')
  const { templates, isLoading, error: tmplErr } = useTemplates()

  const draftCount     = templates.filter((t) => t.status === 'Draft').length
  const publishedCount = templates.filter((t) => t.status === 'Published').length

  return (
    <>
      {!isLoading && draftCount > 0 && (
        <section className="mb-6">
          <h2 className="section-heading">{t('actionsRequired')}</h2>
          <Link
            href="/templates"
            className="flex items-center justify-between rounded-lg border-l-4 border-l-orange-500 bg-orange-50 p-4 hover:bg-orange-100 transition-colors"
          >
            <div>
              <p className="font-medium text-gray-900">{t('templates.draftWarning', { count: draftCount })}</p>
              <p className="text-sm text-gray-600">{t('templates.draftWarningDesc')}</p>
            </div>
            <span className="text-sm font-medium text-orange-600">{t('goTo')}</span>
          </Link>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-heading mb-0">{t('templates.title')}</h2>
          <Link href="/templates" className="btn-link text-sm">{t('manageTemplates')}</Link>
        </div>
        {isLoading ? (
          <p className="text-muted">{t('loading')}</p>
        ) : tmplErr ? (
          <ErrorBanner message={tmplErr} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Link href="/templates" className="block rounded-lg bg-orange-50 p-4 text-center hover:opacity-80">
              <p className="text-2xl font-bold text-orange-700">{draftCount}</p>
              <p className="mt-0.5 text-xs font-medium text-orange-600">{t('templates.draft')}</p>
            </Link>
            <Link href="/templates" className="block rounded-lg bg-green-50 p-4 text-center hover:opacity-80">
              <p className="text-2xl font-bold text-green-700">{publishedCount}</p>
              <p className="mt-0.5 text-xs font-medium text-green-600">{t('templates.published')}</p>
            </Link>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="section-heading">{t('gradeChart.title')}</h2>
        <div className="card">
          <GradeDistributionChart />
        </div>
      </section>
    </>
  )
}

// ─── Flow Guide ────────────────────────────────────────────────────────────────

const FLOW_STEP_KEY: Record<Role, string> = {
  Employee:   'flowGuide.stepsEmployee',
  Supervisor: 'flowGuide.stepsSupervisor',
  Manager:    'flowGuide.stepsManager',
  RegionalHR: 'flowGuide.stepsRegionalHR',
  Admin:      'flowGuide.stepsAdmin',
}

function FlowGuide({ role }: { role: Role }) {
  const t = useTranslations('dashboard')
  const steps = t.raw(FLOW_STEP_KEY[role] as Parameters<typeof t.raw>[0]) as string[]

  return (
    <section className="mb-6">
      <details className="rounded-xl border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900">
          {t('flowGuide.toggle')}
        </summary>
        <ol className="space-y-2 px-5 pb-4 pt-1">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-600">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const { user } = useAuth()
  const { cycles, isLoading: cyclesLoading, error: cyclesError } = useCycles()

  if (!user) return null

  const isEmployee        = user.role === 'Employee'
  const isSupervisorOrMgr = user.role === 'Supervisor' || user.role === 'Manager'
  const isHROrAdmin       = user.role === 'RegionalHR' || user.role === 'Admin'

  return (
    <div>
      <PageHeader title={t('pageTitle')} />

      <FlowGuide role={user.role} />

      {isEmployee        && <EmployeeSection />}
      {isSupervisorOrMgr && <TeamReviewSection role={user.role} />}
      {isHROrAdmin       && <HRSection />}

      {cyclesLoading ? (
        <p className="text-muted">{t('loadingCycles')}</p>
      ) : cyclesError ? (
        <ErrorBanner message={cyclesError} />
      ) : (
        <>
          <CycleTimeline cycles={cycles} />
          <ActiveCycles  cycles={cycles} />
        </>
      )}
    </div>
  )
}
