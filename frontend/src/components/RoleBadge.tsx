import type { Role } from '@/types'

const ROLE_CONFIG: Record<Role, { label: string; className: string }> = {
  Admin: { label: 'Admin', className: 'bg-red-100 text-red-700' },
  RegionalHR: { label: 'Regional HR', className: 'bg-orange-100 text-orange-700' },
  Manager: { label: 'Manager', className: 'bg-purple-100 text-purple-700' },
  Supervisor: { label: 'Supervisor', className: 'bg-blue-100 text-blue-700' },
  Employee: { label: 'Employee', className: 'bg-gray-100 text-gray-600' },
}

interface RoleBadgeProps {
  role: Role
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role]

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
