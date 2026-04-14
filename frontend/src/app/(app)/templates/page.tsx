'use client'

import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { useTemplates } from '@/modules/templates/hooks/useTemplates'
import type { ReviewTemplate } from '@/types'

export default function TemplatesPage() {
  const { templates, isLoading } = useTemplates()

  const columns = [
    { key: 'name', label: 'Template Name', sortable: true },
    { key: 'cycleType', label: 'Cycle Type', sortable: true },
    { key: 'jobLevel', label: 'Job Level', sortable: true },
    { key: 'jobTitle', label: 'Job Title', sortable: true },
    {
      key: 'questions',
      label: 'Questions',
      render: (row: ReviewTemplate) => `${row.questions.length} questions`,
    },
    {
      key: 'actions',
      label: '',
      render: (row: ReviewTemplate) => (
        <button className="btn-link">
          Edit
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Review Templates"
        description="Manage performance evaluation form templates by job level and title."
        actions={
          <button className="btn-primary">+ New Template</button>
        }
      />

      {!isLoading && templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create a template to standardize performance evaluations."
        />
      ) : (
        <DataTable columns={columns} data={templates} isLoading={isLoading} />
      )}
    </div>
  )
}
