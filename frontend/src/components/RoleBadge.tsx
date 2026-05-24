'use client'

import { useTranslations } from 'next-intl'
import type { Role } from '@/types'

const ROLE_CLASS: Record<Role, string> = {
  Admin:      'bg-red-100 text-red-700',
  GlobalHR:   'bg-teal-100 text-teal-700',
  RegionalHR: 'bg-orange-100 text-orange-700',
  Manager:    'bg-purple-100 text-purple-700',
  Supervisor: 'bg-blue-100 text-blue-700',
  Employee:   'bg-gray-100 text-gray-600',
}

interface RoleBadgeProps {
  role: Role
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const t = useTranslations('roles')

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_CLASS[role]}`}>
      {t(role)}
    </span>
  )
}
