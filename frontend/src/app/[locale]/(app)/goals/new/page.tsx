'use client'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { api } from '@/lib/api'
import type { GoalType, PerformanceCycle } from '@/types'

// ─── Monochrome icons ────────────────────────────────────────────────────────

function IconTarget()   { return <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> }
function IconChart()    { return <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-7"/></svg> }
function IconCheck()    { return <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg> }
function IconLightbulb(){ return <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12.74V17H8v-2.26A7 7 0 0 1 12 2z"/></svg> }
function IconCalendar() { return <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> }

// ─── Field definitions ───────────────────────────────────────────────────────

const SMART_FIELDS = [
  { key: 'description',  Icon: IconTarget,    label: '你想達成什麼？',         hint: '具體描述你要完成的事情' },
  { key: 'metric',       Icon: IconChart,     label: '怎麼知道你成功了？',     hint: '例：將製程良率提升到 98%' },
  { key: 'targetValue',  Icon: IconCheck,     label: '目標數字或標準是什麼？', hint: '例：98%、10 件、每週 1 次' },
  { key: 'relevance',    Icon: IconLightbulb, label: '這個目標為什麼重要？',   hint: '和團隊或公司目標的關聯' },
] as const

type FormField = 'description' | 'metric' | 'targetValue' | 'relevance' | 'dueDate'

export default function NewGoalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cycles, setCycles] = useState<PerformanceCycle[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    metric: '',
    targetValue: '',
    relevance: '',
    dueDate: '',
    type: 'Personal' as GoalType,
    cycleId: '',
  })

  useEffect(() => {
    api.get<PerformanceCycle[]>('/cycles')
      .then((data) => setCycles(data.filter((c) => c.status === 'GoalSetting' || c.status === 'InProgress')))
      .catch(() => {})
  }, [])

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const filledFields: FormField[] = ['description', 'metric', 'targetValue', 'relevance', 'dueDate']
  const filledCount = filledFields.filter((f) => form[f].trim() !== '').length + (form.title.trim() ? 1 : 0)
  const totalCount = filledFields.length + 1
  const completionPct = Math.round((filledCount / totalCount) * 100)

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = { ...form, cycleId: form.cycleId || undefined }
      const data = await api.post<{ id: string }>('/goals', payload)
      router.push(`/goals/${data.id}?m=1`)
    } catch {
      setError('儲存失敗，請稍後再試。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/goals" className="hover:text-gray-600">我的目標</Link>
        <span>/</span>
        <span className="text-gray-600">新增目標</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">

          {/* Completion bar */}
          <div className="px-8 pt-6">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>填寫進度</span>
              <span>{filledCount} / {totalCount} 已填寫</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {/* Title */}
          <div className="px-8 pt-5 pb-5 border-b border-gray-100">
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="給這個目標取個名字..."
              required
              className="w-full text-2xl font-semibold text-gray-900 placeholder-gray-300 outline-none bg-transparent"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <IconCalendar />
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => handleChange('dueDate', e.target.value)}
                  required
                  className="border-0 bg-transparent text-sm text-gray-500 outline-none cursor-pointer hover:text-gray-700"
                />
              </div>
              <div className="flex items-center gap-1.5">
                {(['Personal', 'Team'] as GoalType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleChange('type', t)}
                    className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                      form.type === t
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {t === 'Personal' ? '個人目標' : '團隊目標'}
                  </button>
                ))}
              </div>
              {cycles.length > 0 && (
                <select
                  value={form.cycleId}
                  onChange={(e) => handleChange('cycleId', e.target.value)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-0.5 text-xs text-gray-500 outline-none hover:bg-gray-100 focus:border-indigo-300"
                >
                  <option value="">不關聯週期</option>
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* SMART sections */}
          <div className="divide-y divide-gray-50">
            {SMART_FIELDS.map(({ key, Icon, label, hint }) => (
              <div key={key} className="px-8 py-5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-2">
                  <Icon />
                  {label}
                </label>
                <textarea
                  value={form[key as FormField]}
                  onChange={(e) => handleChange(key as keyof typeof form, e.target.value)}
                  placeholder={hint}
                  required
                  rows={2}
                  className="w-full resize-none text-sm text-gray-800 placeholder-gray-300 outline-none bg-transparent leading-relaxed"
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-gray-100">
            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600">
                取消
              </button>
              <button
                type="submit"
                disabled={loading || filledCount < totalCount}
                className="btn-primary disabled:opacity-40"
              >
                {loading ? '儲存中...' : '儲存目標'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
