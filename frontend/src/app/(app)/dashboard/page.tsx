'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { CycleStepper } from '@/components/CycleStepper'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { useCycles } from '@/modules/cycles/hooks/useCycles'
import { useGoals } from '@/modules/goals/hooks/useGoals'
import { useReviews, useTeamReviews } from '@/modules/reviews/hooks/useReviews'
import { useTemplates } from '@/modules/templates/hooks/useTemplates'
import type { PerformanceCycle, Role } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CYCLE_TYPE_LABEL: Record<string, string> = {
  Annual: '年度考核',
  Quarterly: '季度考核',
  Probation: '試用期考核',
}

const CYCLE_STATUS_DESC: Record<string, string> = {
  GoalSetting: '目標設定中 — 員工填寫 SMART 目標，主管核准',
  InProgress:  '執行中 — 目標追蹤進行中，績效評核表單已開放填寫',
  UnderReview: '評核中 — 主管正在進行初評，經理進行校準',
  Completed:   '已完成 — 結果已發布',
}

const FLOW_STEPS: Record<Role, string[]> = {
  Employee: [
    '【GoalSetting】HR 建立週期後，你填寫個人 SMART 目標並提交',
    '【InProgress】HR 推進週期，系統自動產生你的績效評核表單，你填寫自評',
    '填完後按「送出」，轉由直屬主管進行初評',
    '【UnderReview → Published】主管初評 → 經理校準後發布，你可查看最終等第',
    '若對結果有異議，可提出申訴（Appealed）',
  ],
  Supervisor: [
    '【GoalSetting】員工填寫目標後，你負責核准下屬的目標',
    '【InProgress】員工填好自評送出後，輪到你進行初評（PendingSupervisorReview）',
    '初評：閱讀員工自評、填寫評語、選擇等第（O/S+/S/S-/I/U）',
    '你送出後，進入經理校準階段，結果由經理決定是否調整並發布',
  ],
  Manager: [
    '【建立前】可在已發布的模板中為部門新增自訂問題',
    '【InProgress】等員工自評、主管初評完成後，進入你的校準階段',
    '校準：比較所有員工等第、必要時調整排名（前往「團隊評核」頁）',
    '全部確認後，按「發布」，所有結果一次公開給員工',
  ],
  RegionalHR: [
    '建立績效週期，設定地區、類型（Annual/Quarterly/Probation）與日期範圍',
    '建立表單模板：設定適用職等與職稱，Managers 可再補充自訂題目',
    '確認所有模板就緒後，Publish 模板（Published 後才能在推進時自動套用）',
    '將週期推進至 InProgress → 系統自動比對模板為所有員工建立評核',
    '等評核流程完成後，依序推進至 UnderReview → Completed',
  ],
  Admin: [
    '管理所有地區的績效週期（可在 GoalSetting 階段編輯週期資訊）',
    '監控各地區評核進度，確認模板發布與週期推進時間',
    '查閱稽核日誌（Audit Log）確認系統操作記錄',
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ─── Timeline (Gantt) ─────────────────────────────────────────────────────────

const BAR_COLORS = {
  goalSetting: { bg: 'bg-blue-300',   label: 'text-blue-900' },
  review:      { bg: 'bg-violet-300', label: 'text-violet-900' },
}

function CycleTimeline({ cycles }: { cycles: PerformanceCycle[] }) {
  if (cycles.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="section-heading">全年週期行程</h2>
        <div className="card py-6 text-center">
          <p className="text-sm text-gray-500">尚無績效週期資料。</p>
          <p className="mt-1 text-xs text-gray-400">週期由 HR / Admin 建立後將顯示於此。</p>
        </div>
      </section>
    )
  }

  // Always show the current calendar year: Jan 1 → Dec 31
  const currentYear = new Date().getFullYear()
  const tlStart = new Date(currentYear, 0, 1)
  const tlEnd   = new Date(currentYear, 11, 31)
  const totalMs = tlEnd.getTime() - tlStart.getTime()

  function left(date: string): string {
    const pct = ((new Date(date).getTime() - tlStart.getTime()) / totalMs) * 100
    return `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`
  }
  function barWidth(start: string, end: string): string {
    const s = Math.max(new Date(start).getTime(), tlStart.getTime())
    const e = Math.min(new Date(end).getTime(),   tlEnd.getTime())
    const pct = ((e - s) / totalMs) * 100
    return `${Math.max(0, pct).toFixed(2)}%`
  }

  // Month tick labels — 12 months, Jan shows "1月", others show "2月"..."12月"
  const ticks: { label: string; pct: number }[] = []
  const cur = new Date(tlStart)
  while (cur <= tlEnd) {
    const pct = ((cur.getTime() - tlStart.getTime()) / totalMs) * 100
    ticks.push({ label: `${cur.getMonth() + 1}月`, pct })
    cur.setMonth(cur.getMonth() + 1)
  }

  // Today marker
  const todayPct = ((Date.now() - tlStart.getTime()) / totalMs) * 100
  const showToday = todayPct >= 0 && todayPct <= 100

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="section-heading mb-0">{currentYear} 年週期行程</h2>
        <span className="text-xs text-gray-400">時程由 HR / Admin 建立週期時設定</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 560 }}>

            {/* Month ruler */}
            <div className="relative h-7 border-b border-gray-100 mb-1">
              {ticks.map((t, i) => (
                <span
                  key={i}
                  className="absolute bottom-1 whitespace-nowrap text-[10px] text-gray-400"
                  style={{
                    left: `${t.pct.toFixed(2)}%`,
                    transform: i === 0 ? 'translateX(0)' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  {t.label}
                </span>
              ))}
              {/* gridlines */}
              {ticks.map((t, i) => (
                <div
                  key={`g${i}`}
                  className="absolute top-0 bottom-0 border-l border-gray-100"
                  style={{ left: `${t.pct.toFixed(2)}%` }}
                />
              ))}
            </div>

            {/* Cycle rows */}
            <div className="space-y-3 py-2">
              {cycles.map((cycle) => (
                <div key={cycle.id}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800">{cycle.name}</span>
                    <span className="text-xs text-gray-400">{CYCLE_TYPE_LABEL[cycle.type] ?? cycle.type}</span>
                    <StatusBadge status={cycle.status} />
                  </div>
                  <div className="relative h-8 rounded bg-gray-50">
                    {/* Goal setting bar */}
                    <div
                      className={`absolute top-1 bottom-1 rounded ${BAR_COLORS.goalSetting.bg} flex items-center overflow-hidden`}
                      style={{ left: left(cycle.goalSettingStart), width: barWidth(cycle.goalSettingStart, cycle.goalSettingEnd) }}
                      title={`目標設定：${fmtDate(cycle.goalSettingStart)} – ${fmtDate(cycle.goalSettingEnd)}`}
                    >
                      <span className={`px-1.5 text-[10px] font-medium whitespace-nowrap ${BAR_COLORS.goalSetting.label}`}>
                        目標設定
                      </span>
                    </div>
                    {/* Review bar */}
                    <div
                      className={`absolute top-1 bottom-1 rounded ${BAR_COLORS.review.bg} flex items-center overflow-hidden`}
                      style={{ left: left(cycle.reviewStart), width: barWidth(cycle.reviewStart, cycle.reviewEnd) }}
                      title={`評核期：${fmtDate(cycle.reviewStart)} – ${fmtDate(cycle.reviewEnd)}`}
                    >
                      <span className={`px-1.5 text-[10px] font-medium whitespace-nowrap ${BAR_COLORS.review.label}`}>
                        評核期
                      </span>
                    </div>
                    {/* Today marker */}
                    {showToday && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                        style={{ left: `${todayPct.toFixed(2)}%` }}
                        title="今天"
                      />
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400">
                    目標設定：{fmtDate(cycle.goalSettingStart)} – {fmtDate(cycle.goalSettingEnd)}
                    &nbsp;·&nbsp;
                    評核期：{fmtDate(cycle.reviewStart)} – {fmtDate(cycle.reviewEnd)}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-blue-300" />目標設定期
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-violet-300" />評核期
              </span>
              {showToday && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-0.5 rounded bg-amber-400" />今天
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
  const active = cycles.filter((c) => c.status !== 'Completed')
  if (active.length === 0) return null  // 已有 CycleTimeline 的空狀態，這裡不重複顯示

  return (
    <section className="mb-8">
      <h2 className="section-heading">進行中的週期</h2>
      <div className="space-y-4">
        {active.map((cycle) => (
          <div key={cycle.id} className="card">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900">{cycle.name}</h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {CYCLE_TYPE_LABEL[cycle.type] ?? cycle.type} · {cycle.regions.join(', ')}
                </p>
              </div>
              <StatusBadge status={cycle.status} />
            </div>
            <CycleStepper status={cycle.status} />
            <p className="mt-3 text-xs text-gray-500">{CYCLE_STATUS_DESC[cycle.status]}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Employee Section ─────────────────────────────────────────────────────────

function EmployeeSection() {
  const { reviews, isLoading: rl } = useReviews()
  const { goals,   isLoading: gl } = useGoals()

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
          <h2 className="section-heading">需要您的操作</h2>
          <div className="space-y-2">
            {pendingReviews.map((r) => (
              <Link
                key={r.id}
                href={`/reviews/${r.id}`}
                className="flex items-center justify-between rounded-lg border-l-4 border-l-blue-500 bg-blue-50 p-4 hover:bg-blue-100 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">績效評核待填寫</p>
                  <p className="text-sm text-gray-600">{r.cycle.name} · {r.template.name}</p>
                </div>
                <span className="text-sm font-medium text-blue-600">立即填寫 →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Goals stats */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-heading mb-0">我的目標</h2>
            <Link href="/goals" className="btn-link text-sm">查看全部 →</Link>
          </div>
          {gl ? (
            <p className="text-muted">載入中...</p>
          ) : goalStats.total === 0 ? (
            <div className="card py-6 text-center">
              <p className="text-sm text-gray-500">尚未設定任何目標</p>
              <Link href="/goals" className="btn-primary mt-3 inline-block text-sm">設定目標</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '草稿',   count: goalStats.draft,            color: 'bg-gray-100 text-gray-700' },
                { label: '待審核', count: goalStats.pendingApproval,  color: 'bg-yellow-100 text-yellow-700' },
                { label: '已核准', count: goalStats.approved,         color: 'bg-green-100 text-green-700' },
                { label: '已完成', count: goalStats.completed,        color: 'bg-indigo-100 text-indigo-700' },
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
            <h2 className="section-heading mb-0">我的評核</h2>
            <Link href="/reviews" className="btn-link text-sm">查看全部 →</Link>
          </div>
          {rl ? (
            <p className="text-muted">載入中...</p>
          ) : reviews.length === 0 ? (
            <p className="text-muted">目前沒有評核記錄。</p>
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
  const { reviews, isLoading } = useTeamReviews()

  const pendingSup = reviews.filter((r) => r.status === 'PendingSupervisorReview')
  const pendingMgr = reviews.filter((r) => r.status === 'PendingManagerApproval')
  const actionItems  = role === 'Manager' ? pendingMgr : pendingSup
  const actionLabel  = role === 'Manager' ? '待校準 / 發布' : '待初評'

  return (
    <>
      {!isLoading && actionItems.length > 0 && (
        <section className="mb-6">
          <h2 className="section-heading">需要您的操作</h2>
          <Link
            href="/reviews/team"
            className="flex items-center justify-between rounded-lg border-l-4 border-l-amber-500 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
          >
            <div>
              <p className="font-medium text-gray-900">{actionItems.length} 份員工評核{actionLabel}</p>
              <p className="text-sm text-gray-600">前往團隊評核頁面處理</p>
            </div>
            <span className="text-sm font-medium text-amber-600">前往 →</span>
          </Link>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-heading mb-0">團隊評核總覽</h2>
          <Link href="/reviews/team" className="btn-link text-sm">查看全部 →</Link>
        </div>
        {isLoading ? (
          <p className="text-muted">載入中...</p>
        ) : reviews.length === 0 ? (
          <div className="card py-5 text-center">
            <p className="text-sm text-gray-500">目前沒有團隊評核記錄。</p>
            <p className="mt-1 text-xs text-gray-400">HR 將週期推進至「執行中」後，系統會自動為員工建立評核表單。</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '待員工填寫',  count: reviews.filter((r) => r.status === 'PendingEmployeeSubmit').length,   color: 'bg-blue-100 text-blue-700' },
              { label: '待主管初評',  count: reviews.filter((r) => r.status === 'PendingSupervisorReview').length, color: 'bg-yellow-100 text-yellow-700' },
              { label: '待校準/發布', count: reviews.filter((r) => r.status === 'PendingManagerApproval').length,  color: 'bg-purple-100 text-purple-700' },
            ].map(({ label, count, color }) => (
              <Link key={label} href="/reviews/team" className={`rounded-lg p-3 text-center ${color} block hover:opacity-80`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="mt-0.5 text-xs font-medium">{label}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

// ─── HR Section ────────────────────────────────────────────────────────────────

function HRSection() {
  const { templates, isLoading } = useTemplates()

  const draftCount     = templates.filter((t) => t.status === 'Draft').length
  const publishedCount = templates.filter((t) => t.status === 'Published').length

  return (
    <>
      {!isLoading && draftCount > 0 && (
        <section className="mb-6">
          <h2 className="section-heading">需要您的操作</h2>
          <Link
            href="/templates"
            className="flex items-center justify-between rounded-lg border-l-4 border-l-orange-500 bg-orange-50 p-4 hover:bg-orange-100 transition-colors"
          >
            <div>
              <p className="font-medium text-gray-900">{draftCount} 份模板草稿尚未發布</p>
              <p className="text-sm text-gray-600">模板需要先 Publish 才能在週期推進時自動套用至員工</p>
            </div>
            <span className="text-sm font-medium text-orange-600">前往 →</span>
          </Link>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-heading mb-0">表單模板</h2>
          <Link href="/templates" className="btn-link text-sm">管理模板 →</Link>
        </div>
        {isLoading ? (
          <p className="text-muted">載入中...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Link href="/templates" className="block rounded-lg bg-orange-50 p-4 text-center hover:opacity-80">
              <p className="text-2xl font-bold text-orange-700">{draftCount}</p>
              <p className="mt-0.5 text-xs font-medium text-orange-600">草稿</p>
            </Link>
            <Link href="/templates" className="block rounded-lg bg-green-50 p-4 text-center hover:opacity-80">
              <p className="text-2xl font-bold text-green-700">{publishedCount}</p>
              <p className="mt-0.5 text-xs font-medium text-green-600">已發布</p>
            </Link>
          </div>
        )}
      </section>
    </>
  )
}

// ─── Flow Guide ────────────────────────────────────────────────────────────────

function FlowGuide({ role }: { role: Role }) {
  return (
    <section className="mb-6">
      <details className="rounded-xl border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900">
          年度績效流程說明（點擊展開）
        </summary>
        <ol className="space-y-2 px-5 pb-4 pt-1">
          {FLOW_STEPS[role].map((step, i) => (
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
  const { user } = useAuth()
  const { cycles, isLoading: cyclesLoading } = useCycles()

  if (!user) return null

  const isEmployee        = user.role === 'Employee'
  const isSupervisorOrMgr = user.role === 'Supervisor' || user.role === 'Manager'
  const isHROrAdmin       = user.role === 'RegionalHR' || user.role === 'Admin'

  return (
    <div>
      <PageHeader
        title={`歡迎，${user.name}`}
        description="以下是你目前的績效週期概況與待處理事項。"
      />

      <div className="mb-6 flex items-center gap-2">
        <RoleBadge role={user.role} />
        <span className="text-sm text-gray-500">{user.department} · {user.region}</span>
      </div>

      <FlowGuide role={user.role} />

      {isEmployee        && <EmployeeSection />}
      {isSupervisorOrMgr && <TeamReviewSection role={user.role} />}
      {isHROrAdmin       && <HRSection />}

      {cyclesLoading ? (
        <p className="text-muted">載入週期資料中...</p>
      ) : (
        <>
          <CycleTimeline cycles={cycles} />
          <ActiveCycles cycles={cycles} />
        </>
      )}
    </div>
  )
}
