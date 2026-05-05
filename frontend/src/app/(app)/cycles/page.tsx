'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CycleStepper } from '@/components/CycleStepper'
import { EmptyState } from '@/components/EmptyState'
import { useCycles, type CreateCyclePayload, type UpdateCyclePayload } from '@/modules/cycles/hooks/useCycles'
import { useAuth } from '@/modules/auth/hooks/useAuth'
import { api } from '@/lib/api'
import type { PerformanceCycle } from '@/types'

const NEXT_STATUS_LABEL: Record<string, string> = {
  GoalSetting: '進入執行中',
  InProgress:  '開始評核',
  UnderReview: '完成週期',
}

const CYCLE_TYPES = ['Annual', 'Quarterly', 'Probation'] as const

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
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
  const canEdit  = isAdmin || isHR   // 只有 Admin / HR 可以建立、推進週期

  const [allRegions, setAllRegions] = useState<string[]>([])
  const [showModal, setShowModal]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [pendingAdvance, setPendingAdvance] = useState<PerformanceCycle | null>(null)
  const [editingCycle, setEditingCycle]     = useState<PerformanceCycle | null>(null)

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

  async function handleAdvanceConfirmed() {
    if (!pendingAdvance) return
    try { await advanceStatus(pendingAdvance.id) }
    finally { setPendingAdvance(null) }
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
              onAdvance={canEdit ? () => setPendingAdvance(cycle) : undefined}
              onEdit={isAdmin ? () => setEditingCycle(cycle) : undefined}
            />
          ))}
        </div>
      )}

      {/* Advance confirmation */}
      <ConfirmDialog
        open={!!pendingAdvance}
        title="確認推進至下一階段？"
        description={`"${pendingAdvance?.name}" 將推進至：${NEXT_STATUS_LABEL[pendingAdvance?.status ?? '']}。此操作無法復原。`}
        confirmLabel="確認推進"
        onConfirm={handleAdvanceConfirmed}
        onCancel={() => setPendingAdvance(null)}
      />

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

// ─── Cycle Card ───────────────────────────────────────────────────────────────

function CycleCard({
  cycle, canEdit, isAdmin, onAdvance, onEdit,
}: {
  cycle: PerformanceCycle
  canEdit: boolean
  isAdmin: boolean
  onAdvance?: () => void
  onEdit?: () => void
}) {
  const nextLabel = NEXT_STATUS_LABEL[cycle.status]
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

      <CycleStepper status={cycle.status} />

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
