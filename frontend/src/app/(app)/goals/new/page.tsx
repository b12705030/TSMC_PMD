'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { api } from '@/lib/api'
import type { GoalType } from '@/types'

export default function NewGoalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    description: '',   // Specific
    metric: '',        // Measurable
    targetValue: '',   // Achievable
    relevance: '',     // Relevant
    dueDate: '',       // Time-bound
    type: 'Personal' as GoalType,
  })

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/goals', form)
      router.push('/goals')
    } catch {
      setError('Failed to create goal. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New Goal"
        description="Define a SMART goal for this performance cycle."
        breadcrumbs={[{ label: 'Goals', href: '/goals' }, { label: 'New' }]}
      />

      <form onSubmit={handleSubmit} className="card space-y-5">
        <Field label="Title" required>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Brief goal title"
            required
            className="input"
          />
        </Field>

        <Field label="Specific — What exactly will you accomplish?" required>
          <textarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            required
            className="input resize-none"
          />
        </Field>

        <Field label="Measurable — How will you measure success?" required>
          <input
            type="text"
            value={form.metric}
            onChange={(e) => handleChange('metric', e.target.value)}
            placeholder="e.g. Increase unit test coverage to 80%"
            required
            className="input"
          />
        </Field>

        <Field label="Achievable — What is your target?" required>
          <input
            type="text"
            value={form.targetValue}
            onChange={(e) => handleChange('targetValue', e.target.value)}
            placeholder="e.g. 80%"
            required
            className="input"
          />
        </Field>

        <Field label="Relevant — Why is this goal important?" required>
          <textarea
            value={form.relevance}
            onChange={(e) => handleChange('relevance', e.target.value)}
            rows={2}
            required
            className="input resize-none"
          />
        </Field>

        <Field label="Time-bound — Due date" required>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => handleChange('dueDate', e.target.value)}
            required
            className="input"
          />
        </Field>

        <Field label="Goal Type">
          <select
            value={form.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="input"
          >
            <option value="Personal">Personal</option>
            <option value="Team">Team</option>
          </select>
        </Field>

        {error && <p className="text-error">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save Goal'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
