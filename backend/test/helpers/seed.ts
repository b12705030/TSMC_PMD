import {
  CycleStatus,
  CycleType,
  GoalStatus,
  GoalType,
  ReviewGrade,
  ReviewStatus,
  Role,
  TemplateStatus,
  type Department,
  type PerformanceCycle,
  type Region,
  type User,
} from '@prisma/client'
import * as bcrypt from 'bcryptjs'

import type { SessionUser } from '../../src/common/types/request.types'
import { prisma } from './db'

// Precomputed at module load — 4 rounds is enough for test speed
const PASSWORD_HASH = bcrypt.hashSync('test1234', 4)

let seq = 0
const next = () => ++seq

// ─── Region ───────────────────────────────────────────────────────────────────

export async function createRegion(overrides?: { name?: string; code?: string }) {
  const n = next()
  return prisma.region.create({
    data: {
      name: overrides?.name ?? `Region-${n}`,
      code: overrides?.code ?? `R${n}`,
    },
  })
}

// ─── Department ───────────────────────────────────────────────────────────────

export async function createDepartment(region: Region, overrides?: { name?: string }) {
  const n = next()
  return prisma.department.create({
    data: {
      name:     overrides?.name ?? `Dept-${n}`,
      regionId: region.id,
    },
  })
}

// ─── User ─────────────────────────────────────────────────────────────────────

type UserOverrides = {
  name?:         string
  jobLevel?:     string
  jobTitle?:     string
  managerId?:    string
  supervisorId?: string
}

// Always includes region + department so toSessionUser() works directly on the return value.
// regionId and region.name are derived from the same Region object — they can't drift.
export async function createUser(
  role:       Role,
  region:     Region,
  department: Department,
  overrides?: UserOverrides,
) {
  const n = next()
  return prisma.user.create({
    data: {
      employeeId:   `EMP-${n}`,
      passwordHash: PASSWORD_HASH,
      name:         overrides?.name     ?? `User-${n}`,
      email:        `user${n}@test.local`,
      role,
      regionId:     region.id,
      departmentId: department.id,
      jobLevel:     overrides?.jobLevel ?? 'L2',
      jobTitle:     overrides?.jobTitle ?? 'Software Engineer',
      managerId:    overrides?.managerId,
      supervisorId: overrides?.supervisorId,
    },
    include: { region: true, department: true },
  })
}

// Converts the Prisma user (with relations) into the SessionUser shape that services expect.
// The role cast is safe — both enums share the same string values.
export function toSessionUser(
  user: User & { region: Region; department: Department },
): SessionUser {
  return {
    id:           user.id,
    employeeId:   user.employeeId,
    name:         user.name,
    email:        user.email,
    role:         user.role as SessionUser['role'],
    regionId:     user.regionId,
    region:       user.region.name,
    departmentId: user.departmentId,
    department:   user.department.name,
    jobLevel:     user.jobLevel,
    jobTitle:     user.jobTitle,
  }
}

// ─── Performance Cycle ────────────────────────────────────────────────────────

type CycleOverrides = {
  name?:   string
  type?:   CycleType
  status?: CycleStatus
}

export async function createCycle(region: Region, overrides?: CycleOverrides) {
  const n = next()
  return prisma.performanceCycle.create({
    data: {
      name:             overrides?.name   ?? `Cycle-${n}`,
      type:             overrides?.type   ?? CycleType.Annual,
      status:           overrides?.status ?? CycleStatus.GoalSetting,
      regionId:         region.id,
      goalSettingStart: new Date('2026-01-01'),
      goalSettingEnd:   new Date('2026-03-31'),
      reviewStart:      new Date('2026-04-01'),
      reviewEnd:        new Date('2026-06-30'),
    },
  })
}

// ─── Form Template ────────────────────────────────────────────────────────────

type TemplateOverrides = {
  name?:          string
  appliesGrades?: string[]
  applyTitles?:   string[]
  status?:        TemplateStatus
}

export async function createTemplate(
  cycle:     PerformanceCycle,
  region:    Region,
  createdBy: User,
  overrides?: TemplateOverrides,
) {
  const n = next()
  return prisma.formTemplate.create({
    data: {
      name:          overrides?.name          ?? `Template-${n}`,
      cycleId:       cycle.id,
      regionId:      region.id,
      appliesGrades: overrides?.appliesGrades ?? ['L2'],
      applyTitles:   overrides?.applyTitles   ?? ['Software Engineer'],
      status:        overrides?.status        ?? TemplateStatus.Draft,
      createdById:   createdBy.id,
    },
    include: { questions: { orderBy: { orderIndex: 'asc' } } },
  })
}

// ─── Goal ─────────────────────────────────────────────────────────────────────

type GoalOverrides = {
  cycleId?: string
  status?:  GoalStatus
  type?:    GoalType
}

export async function createGoal(owner: User, overrides?: GoalOverrides) {
  const n = next()
  return prisma.goal.create({
    data: {
      userId:      owner.id,
      cycleId:     overrides?.cycleId ?? null,
      title:       `Goal-${n}`,
      description: 'description',
      metric:      'metric',
      targetValue: 'target',
      relevance:   'relevance',
      dueDate:     new Date('2026-12-31'),
      type:        overrides?.type   ?? GoalType.Personal,
      status:      overrides?.status ?? GoalStatus.Draft,
    },
  })
}

// ─── Performance Review ───────────────────────────────────────────────────────

type ReviewOverrides = {
  supervisorId?: string | null
  status?:       ReviewStatus
  grade?:        ReviewGrade
}

export async function createReview(
  employee: User,
  cycle:    PerformanceCycle,
  template: { id: string },
  overrides?: ReviewOverrides,
) {
  return prisma.performanceReview.create({
    data: {
      cycleId:     cycle.id,
      employeeId:  employee.id,
      templateId:  template.id,
      supervisorId: overrides?.supervisorId ?? null,
      status:       overrides?.status       ?? ReviewStatus.PendingEmployeeSubmit,
      ...(overrides?.grade !== undefined && { grade: overrides.grade }),
    },
  })
}
