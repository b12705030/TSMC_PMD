'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CycleStepper } from '@/components/CycleStepper'
import { EmptyState } from '@/components/EmptyState'
import { useCycles, type CreateCyclePayload, type UpdateCyclePayload } from '@/modules/cycles/hooks/useCycles'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { PerformanceCycle, ReviewTemplate } from '@/types'

const NEXT_STATUS_LABEL: Record<string, string> = {
  GoalSetting:      '進入執行中',
  InProgress:       '開始員工自評',
  EmployeeReview:   '開始主管初評',
  SupervisorReview: '開始校準發布',
  Calibration:      '完成週期',
}

const CYCLE_TYPES = ['Annual', 'Quarterly', 'Probation'] as const

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Shared icon helpers ──────────────────────────────────────────────────────

function WarnIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  )
}

function WarnText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
      <WarnIcon />
      {children}
    </p>
  )
}

// ─── Region Checkboxes ────────────────────────────────────────────────────────

function RegionCheckboxes({
  allRegions,
  selected,
  onChange,
}: {
  allRegions: string[]
  selected: string[]
  onChange: (regions: string[]) => void
}) {
  function toggle(r: string) {
    onChange(selected.includes(r) ? selected.filter((x) => x !== r) : [...selected, r])
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {allRegions.map((r) => (
        <label key={r} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(r)}
            onChange={() => toggle(r)}
            className="rounded"
          />
          {r}
        </label>
      ))}
      {allRegions.length === 0 && <p className="text-xs text-gray-400">載入中...</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CyclesPage() {
  const { cycles, isLoading, createCycle, updateCycle, advanceStatus } = useCycles()
  const { user } = useAuth()
  const isAdmin  = user?.role === 'Admin'
  const isHR     = user?.role === 'RegionalHR'
  const isManager = user?.role === 'Manager'
  const canEdit  = isAdmin || isHR   // 只有 Admin / HR 可以建立、推進週期

  const [allRegions, setAllRegions]   = useState<string[]>([])
  const [showModal, setShowModal]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [pendingAdvance, setPendingAdvance] = useState<PerformanceCycle | null>(null)
  const [editingCycle, setEditingCycle]     = useState<PerformanceCycle | null>(null)
  const [managerQStatus, setManagerQStatus] = useState<{ complete: {id:string;name:string}[]; pending: {id:string;name:string}[] } | null>(null)
  // Templates — loaded only for roles that can see/manage them
  const [templates, setTemplates] = useState<ReviewTemplate[]>([])
  const showTemplatTrack = canEdit || isManager

  const [form, setForm] = useState<CreateCyclePayload>({
    name:             '',
    type:             'Annual',
    regions:          [],
    goalSettingStart: '',
    goalSettingEnd:   '',
    reviewStart:      '',
    reviewEnd:        '',
  })

  useEffect(() => {
    if (isAdmin) {
      api.get<string[]>('/users/regions').then(setAllRegions).catch(() => {})
    }
  }, [isAdmin])

  useEffect(() => {
    if (showTemplatTrack) {
      api.get<ReviewTemplate[]>('/templates').then(setTemplates).catch(() => {})
    }
  }, [showTemplatTrack])

  function updateForm<K extends keyof CreateCyclePayload>(field: K, value: CreateCyclePayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setForm({ name: '', type: 'Annual', regions: [], goalSettingStart: '', goalSettingEnd: '', reviewStart: '', reviewEnd: '' })
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (isAdmin && form.regions.length === 0) { setError('請至少選擇一個 Region'); return }
    setError('')
    setSubmitting(true)
    try {
      await createCycle(form)
      setShowModal(false)
      resetForm()
    } catch {
      setError('Failed to create cycle. Please check the dates and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAdvanceClick(cycle: PerformanceCycle) {
    setManagerQStatus(null)
    setPendingAdvance(cycle)
    if (cycle.status === 'InProgress') {
      try {
        const status = await api.get<{ complete: {id:string;name:string}[]; pending: {id:string;name:string}[] }>(
          `/cycles/${cycle.id}/manager-questionnaire-status`
        )
        setManagerQStatus(status)
      } catch {
        // non-critical, proceed without status
      }
    }
  }

  async function handleAdvanceConfirmed() {
    if (!pendingAdvance) return
    try { await advanceStatus(pendingAdvance.id) }
    finally { setPendingAdvance(null); setManagerQStatus(null) }
  }

  return (
    <div>
      <PageHeader
        title="績效週期管理"
        description="管理各地區的績效考核週期。"
        actions={canEdit ? (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + 新增週期
          </button>
        ) : undefined}
      />

      {isLoading ? (
        <p className="text-muted">Loading...</p>
      ) : cycles.length === 0 ? (
        <EmptyState
          title="尚無績效週期"
          description={canEdit ? '建立第一個績效考核週期。' : '目前此地區尚無績效週期，請聯繫 HR 建立。'}
          action={canEdit ? <button className="btn-primary" onClick={() => setShowModal(true)}>+ 新增週期</button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {cycles.map((cycle) => (
            <CycleCard
              key={cycle.id}
              cycle={cycle}
              canEdit={canEdit}
              isAdmin={isAdmin}
              cycleTemplates={showTemplatTrack ? templates.filter((t) => t.cycleId === cycle.id) : null}
              onAdvance={canEdit ? () => handleAdvanceClick(cycle) : undefined}
              onEdit={isAdmin ? () => setEditingCycle(cycle) : undefined}
            />
          ))}
        </div>
      )}

      {/* Advance confirmation */}
      <ConfirmDialog
        open={!!pendingAdvance}
        title="確認推進至下一階段？"
        description={`【${pendingAdvance?.name}】將推進至：${NEXT_STATUS_LABEL[pendingAdvance?.status ?? '']}。此操作無法復原。`}
        confirmLabel="確認推進"
        onConfirm={handleAdvanceConfirmed}
        onCancel={() => { setPendingAdvance(null); setManagerQStatus(null) }}
      >
        {managerQStatus && managerQStatus.pending.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <WarnIcon />
              以下 {managerQStatus.pending.length} 位經理尚未補充自訂問卷：
            </p>
            <ul className="space-y-0.5">
              {managerQStatus.pending.map((m) => (
                <li key={m.id} className="text-xs text-amber-700">· {m.name}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-600">確認推進後，員工將以現有問卷開始自評。</p>
          </div>
        )}
        {managerQStatus && managerQStatus.pending.length === 0 && (
          <p className="text-xs text-green-700">✓ 所有經理均已完成問卷補充。</p>
        )}
      </ConfirmDialog>

      {/* Edit Cycle Modal（Admin only） */}
      {editingCycle && (
        <EditCycleModal
          cycle={editingCycle}
          allRegions={allRegions}
          onClose={() => setEditingCycle(null)}
          onSave={updateCycle}
        />
      )}

      {/* New Cycle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">新增績效週期</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">週期名稱</label>
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="例：2025 年度績效考核"
                />
              </div>

              <div>
                <label className="label">類型</label>
                <select className="input" value={form.type} onChange={(e) => updateForm('type', e.target.value as CreateCyclePayload['type'])}>
                  {CYCLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="label">適用地區</label>
                {isAdmin ? (
                  <RegionCheckboxes
                    allRegions={allRegions}
                    selected={form.regions}
                    onChange={(r) => updateForm('regions', r)}
                  />
                ) : (
                  <div className="mt-1 flex gap-1.5 flex-wrap">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {user?.region}
                    </span>
                    <span className="text-xs text-gray-400">（自動套用你的 Region）</span>
                  </div>
                )}
              </div>

              <div>
                <p className="label">目標設定期間</p>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">開始日期</label>
                    <input type="date" className="input" required value={form.goalSettingStart} onChange={(e) => updateForm('goalSettingStart', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">結束日期</label>
                    <input type="date" className="input" required value={form.goalSettingEnd} onChange={(e) => updateForm('goalSettingEnd', e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <p className="label">評核期間</p>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">開始日期</label>
                    <input type="date" className="input" required value={form.reviewStart} onChange={(e) => updateForm('reviewStart', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">結束日期</label>
                    <input type="date" className="input" required value={form.reviewEnd} onChange={(e) => updateForm('reviewEnd', e.target.value)} />
                  </div>
                </div>
              </div>

              {error && <p className="text-error">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm() }}>取消</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? '建立中...' : '建立週期'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Template Prep Track ─────────────────────────────────────────────────────

// STATUS_ORDER 用來判斷「是否已越過某個階段」
const STATUS_ORDER: Record<string, number> = {
  GoalSetting: 0, InProgress: 1, EmployeeReview: 2,
  SupervisorReview: 3, Calibration: 4, Completed: 5,
}

function TemplatePrepTrack({
  cycleTemplates,
  cycleStatus,
  canEdit,
}: {
  cycleTemplates: ReviewTemplate[]
  cycleStatus: string
  canEdit: boolean
}) {
  const hasTemplate   = cycleTemplates.length > 0
  const anyPublished  = cycleTemplates.some((t) => t.status === 'Published')
  const hasCustomQ    = cycleTemplates.some((t) => t.questions.some((q) => q.isCustom))
  const reviewStarted = STATUS_ORDER[cycleStatus] >= STATUS_ORDER['EmployeeReview']

  const isAboutToStart = cycleStatus === 'InProgress' && canEdit

  // 8 格佈局（對齊主 stepper 的 8 格）
  // 格 0：HR 建立模板
  // 格 1：模板已發布
  // 格 2：主管補充問卷
  // 格 3：◆ 績效評核期開始（匯合點）
  // 格 4-7：空白佔位
  const preNodes = [
    {
      label:       'HR 建立模板',
      description: '確保評核表單內容完整',
      done:        hasTemplate,
      detail:      hasTemplate ? `${cycleTemplates.length} 份` : '',
    },
    {
      label:       '模板已發布',
      description: '員工與主管可存取表單',
      done:        anyPublished,
      detail:      '',
    },
    {
      label:       '經理補充問卷',
      description: '各部門經理新增自訂問題',
      done:        hasCustomQ,
      detail:      '',
    },
  ]

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">模板準備</p>
        {canEdit && !hasTemplate && (
          <Link href="/templates" className="text-xs text-indigo-500 hover:text-indigo-700">
            前往建立 →
          </Link>
        )}
      </div>

      <div className="flex items-start gap-0">
        {/* 格 0-2：HR建立 / 模板發布 / 主管補充問卷 */}
        {preNodes.map((node, i) => (
          <div key={i} className="flex flex-1 items-start">
            <div className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  node.done ? 'bg-green-500 text-white' : 'border-2 border-gray-200 text-gray-300 bg-white',
                ].join(' ')}>
                  {node.done ? '✓' : i + 1}
                </div>
                <div className={['h-0.5 flex-1', node.done ? 'bg-green-200' : 'bg-gray-100'].join(' ')} />
              </div>
              <div className="mt-2 pr-2 w-full">
                <p className={['text-xs font-medium', node.done ? 'text-gray-700' : 'text-gray-400'].join(' ')}>
                  {node.label}
                </p>
                <p className="text-xs text-gray-400 leading-tight">{node.description}</p>
                {node.detail && <p className="text-xs text-gray-400 leading-tight">{node.detail}</p>}
              </div>
            </div>
          </div>
        ))}

        {/* 格 3：◆ 績效評核期開始（匯合點，對齊主 stepper 的 ◆） */}
        <div className="flex flex-1 items-start">
          <div className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className={[
                'flex h-7 w-7 shrink-0 rotate-45 items-center justify-center text-xs font-semibold',
                reviewStarted ? 'bg-indigo-500 text-white' : 'border-2 border-gray-200 text-gray-300 bg-white',
              ].join(' ')}>
                <span className="-rotate-45">{reviewStarted ? '✓' : ''}</span>
              </div>
            </div>
            <div className="mt-2 pr-2 w-full">
              <p className={['text-xs font-medium', reviewStarted ? 'text-indigo-600' : 'text-gray-400'].join(' ')}>
                績效評核期開始
              </p>
            </div>
          </div>
        </div>

        {/* 格 4-7：空白佔位 */}
        {[4, 5, 6, 7].map((i) => (
          <div key={i} className="flex flex-1" />
        ))}
      </div>

      {/* 推進前警告 */}
      {isAboutToStart && !hasTemplate && (
        <WarnText>尚未建立模板，推進前請先至「評核模板」建立並發布</WarnText>
      )}
      {isAboutToStart && hasTemplate && !anyPublished && (
        <WarnText>模板尚未發布，推進前請先發布模板</WarnText>
      )}
      {isAboutToStart && anyPublished && !hasCustomQ && (
        <WarnText>經理尚未補充問卷，請確認各部門經理已新增自訂問題</WarnText>
      )}
    </div>
  )
}

// ─── Cycle Card ───────────────────────────────────────────────────────────────

function CycleCard({
  cycle, canEdit, isAdmin, cycleTemplates, onAdvance, onEdit,
}: {
  cycle: PerformanceCycle
  canEdit: boolean
  isAdmin: boolean
  cycleTemplates: ReviewTemplate[] | null
  onAdvance?: () => void
  onEdit?: () => void
}) {
  const nextLabel  = NEXT_STATUS_LABEL[cycle.status]
  const regionTags = (cycle.regions ?? []).join(' · ')

  return (
    <div className="card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{cycle.name}</h3>
          <p className="text-sm text-gray-500">{cycle.type}{regionTags ? ` · ${regionTags}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && cycle.status === 'GoalSetting' && onEdit && (
            <button className="btn-secondary text-xs" onClick={onEdit}>編輯</button>
          )}
          {canEdit && nextLabel && onAdvance && (
            <button className="btn-secondary text-xs" onClick={onAdvance}>
              {nextLabel} →
            </button>
          )}
        </div>
      </div>

      {cycleTemplates !== null && cycle.status !== 'Completed' ? (
        <>
          <TemplatePrepTrack
            cycleTemplates={cycleTemplates}
            cycleStatus={cycle.status}
            canEdit={canEdit}
          />
          <div className="my-4 border-t border-dashed border-gray-100" />
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">評核流程</p>
          <CycleStepper status={cycle.status} />
        </>
      ) : (
        <CycleStepper status={cycle.status} />
      )}

      <div className="mt-4 flex gap-6 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>目標設定：{fmt(cycle.goalSettingStart)} – {fmt(cycle.goalSettingEnd)}</span>
        <span>評核期間：{fmt(cycle.reviewStart)} – {fmt(cycle.reviewEnd)}</span>
      </div>
    </div>
  )
}

// ─── Edit Cycle Modal（Admin only）────────────────────────────────────────────

function EditCycleModal({
  cycle, allRegions, onClose, onSave,
}: {
  cycle: PerformanceCycle
  allRegions: string[]
  onClose: () => void
  onSave: (id: string, payload: UpdateCyclePayload) => Promise<void>
}) {
  const [form, setForm] = useState({
    name:             cycle.name,
    regions:          cycle.regions ?? [],
    goalSettingStart: cycle.goalSettingStart.slice(0, 10),
    goalSettingEnd:   cycle.goalSettingEnd.slice(0, 10),
    reviewStart:      cycle.reviewStart.slice(0, 10),
    reviewEnd:        cycle.reviewEnd.slice(0, 10),
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (form.regions.length === 0) { setError('請至少選擇一個 Region'); return }
    setError('')
    setSubmitting(true)
    try {
      await onSave(cycle.id, form)
      onClose()
    } catch {
      setError('Failed to save changes.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">編輯週期</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">週期名稱</label>
            <input className="input" required value={form.name} onChange={(e) => updateField('name', e.target.value)} />
          </div>

          <div>
            <label className="label">適用地區</label>
            <RegionCheckboxes
              allRegions={allRegions}
              selected={form.regions}
              onChange={(r) => updateField('regions', r)}
            />
          </div>

          <div>
            <p className="label">目標設定期間</p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">開始日期</label>
                <input type="date" className="input" required value={form.goalSettingStart} onChange={(e) => updateField('goalSettingStart', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">結束日期</label>
                <input type="date" className="input" required value={form.goalSettingEnd} onChange={(e) => updateField('goalSettingEnd', e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <p className="label">評核期間</p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">開始日期</label>
                <input type="date" className="input" required value={form.reviewStart} onChange={(e) => updateField('reviewStart', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">結束日期</label>
                <input type="date" className="input" required value={form.reviewEnd} onChange={(e) => updateField('reviewEnd', e.target.value)} />
              </div>
            </div>
          </div>
          {error && <p className="text-error">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '儲存中...' : '儲存變更'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
