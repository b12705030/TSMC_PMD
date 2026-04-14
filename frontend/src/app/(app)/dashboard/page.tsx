'use client'

import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { useAuth } from '@/modules/auth/hooks/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name}`}
        description="Here's what's happening in your performance cycle."
      />

      {/* Role tag */}
      <div className="mb-6 flex items-center gap-2">
        <RoleBadge role={user.role} />
        <span className="text-sm text-gray-500">{user.department} · {user.region}</span>
      </div>

    </div>
  )
}
