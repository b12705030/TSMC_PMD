'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { ErrorBanner } from '@/components/ErrorBanner'
import { RoleBadge } from '@/components/RoleBadge'
import { useUsers, type CreateUserPayload, type UpdateUserPayload } from '@/hooks/useUsers'
import { api, ApiError } from '@/lib/api'
import type { Role, User } from '@/types'

const ROLES: Role[] = ['Admin', 'GlobalHR', 'RegionalHR', 'Manager', 'Supervisor', 'Employee']
const PAGE_SIZE = 50

// ─── Shared form field types ───────────────────────────────────────────────────

interface Region { id: string; name: string; code: string }
interface Department { id: string; name: string; regionId: string }

// ─── Edit Modal ────────────────────────────────────────────────────────────────

function EditUserModal({
  user,
  regions,
  onClose,
  onSave,
}: {
  user: User
  regions: Region[]
  onClose: () => void
  onSave: (id: string, payload: UpdateUserPayload) => Promise<User>
}) {
  const t = useTranslations('users')
  const [form, setForm] = useState<UpdateUserPayload>({
    role:         user.role,
    regionId:     user.regionId,
    departmentId: user.departmentId,
    jobLevel:     user.jobLevel,
    jobTitle:     user.jobTitle,
  })
  const [departments, setDepartments] = useState<Department[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    if (form.regionId) {
      api
        .get<Department[]>(`/users/departments?regionId=${form.regionId}`)
        .then(setDepartments)
        .catch(() => setDepartments([]))
    }
  }, [form.regionId])

  function handleRegionChange(regionId: string) {
    setForm((p) => ({ ...p, regionId, departmentId: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onSave(user.id, form)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('saveError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('editTitle')}</h2>
        <p className="mb-4 text-sm text-gray-500">{user.name} ({user.employeeId})</p>
        {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldRole')}</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldRegion')}</label>
            <select
              value={form.regionId}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t('selectRegion')}</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldDepartment')}</label>
            <select
              value={form.departmentId}
              onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              disabled={!form.regionId}
            >
              <option value="">{t('selectDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldJobLevel')}</label>
            <input
              value={form.jobLevel}
              onChange={(e) => setForm((p) => ({ ...p, jobLevel: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              placeholder="e.g. L3"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldJobTitle')}</label>
            <input
              value={form.jobTitle}
              onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              placeholder="e.g. Software Engineer"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Create User Modal ─────────────────────────────────────────────────────────

function CreateUserModal({
  regions,
  onClose,
  onCreate,
}: {
  regions: Region[]
  onClose: () => void
  onCreate: (payload: CreateUserPayload) => Promise<User>
}) {
  const t = useTranslations('users')
  const [form, setForm] = useState<CreateUserPayload>({
    employeeId: '', name: '', email: '',
    role: 'Employee', regionId: '', departmentId: '', jobLevel: '', jobTitle: '',
  })
  const [departments, setDepartments] = useState<Department[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    if (form.regionId) {
      api
        .get<Department[]>(`/users/departments?regionId=${form.regionId}`)
        .then(setDepartments)
        .catch(() => setDepartments([]))
    }
  }, [form.regionId])

  function handleRegionChange(regionId: string) {
    setForm((p) => ({ ...p, regionId, departmentId: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employeeId || !form.name || !form.email || !form.regionId || !form.departmentId) {
      setError(t('requiredFields'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onCreate(form)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('createError'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('createTitle')}</h2>
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t('defaultPasswordNote')}
        </p>
        {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldEmployeeId')} *</label>
            <input value={form.employeeId} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldName')} *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldEmail')} *</label>
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldRole')}</label>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))} className={inputClass}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldRegion')} *</label>
            <select value={form.regionId} onChange={(e) => handleRegionChange(e.target.value)} className={inputClass}>
              <option value="">{t('selectRegion')}</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldDepartment')} *</label>
            <select value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))} className={inputClass} disabled={!form.regionId}>
              <option value="">{t('selectDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldJobLevel')}</label>
            <input value={form.jobLevel} onChange={(e) => setForm((p) => ({ ...p, jobLevel: e.target.value }))} className={inputClass} placeholder="e.g. L3" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t('fieldJobTitle')}</label>
            <input value={form.jobTitle} onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))} className={inputClass} placeholder="e.g. Software Engineer" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50">
              {t('cancel')}
            </button>
            <button type="submit" disabled={submitting} className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {submitting ? t('creating') : t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const t = useTranslations('users')

  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter]   = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [page, setPage]               = useState(0)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const [regions, setRegions]         = useState<Region[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showCreate, setShowCreate]   = useState(false)

  const { users, total, isLoading, error, updateUser, createUser } = useUsers({
    search:   debouncedSearch,
    role:     roleFilter,
    regionId: regionFilter,
    from:     page * PAGE_SIZE,
    size:     PAGE_SIZE,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    api.get<Region[]>('/users/regions').then(setRegions).catch(() => {})
  }, [])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => { setDebouncedSearch(value); setPage(0) }, 300)
    setDebounceTimer(timer)
  }, [debounceTimer])

  const columns = [
    { key: 'employeeId', label: t('colEmployeeId'), sortable: true },
    { key: 'name',       label: t('colName'),       sortable: true },
    { key: 'email',      label: t('colEmail') },
    {
      key: 'role',
      label: t('colRole'),
      render: (row: User) => <RoleBadge role={row.role} />,
    },
    { key: 'region',     label: t('colRegion'),     sortable: true },
    { key: 'department', label: t('colDepartment'), sortable: true },
    { key: 'jobLevel',   label: t('colJobLevel'),   sortable: true },
    { key: 'jobTitle',   label: t('colJobTitle'),   sortable: true },
    {
      key: 'actions',
      label: '',
      render: (row: User) => (
        <button
          onClick={() => setEditingUser(row)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
        >
          {t('edit')}
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDesc')}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            {t('newUser')}
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm"
        >
          <option value="">{t('allRoles')}</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={regionFilter}
          onChange={(e) => { setRegionFilter(e.target.value); setPage(0) }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm"
        >
          <option value="">{t('allRegions')}</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {error ? (
        <ErrorBanner message={error} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={users}
            isLoading={isLoading}
            emptyMessage={t('empty')}
          />
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>{t('total', { count: total })}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                {t('prev')}
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                {t('next')}
              </button>
            </div>
          </div>
        </>
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          regions={regions}
          onClose={() => setEditingUser(null)}
          onSave={updateUser}
        />
      )}

      {showCreate && (
        <CreateUserModal
          regions={regions}
          onClose={() => setShowCreate(false)}
          onCreate={createUser}
        />
      )}
    </div>
  )
}
