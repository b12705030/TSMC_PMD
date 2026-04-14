// ─── Roles ────────────────────────────────────────────────────────────────────

export type Role = 'Admin' | 'RegionalHR' | 'Manager' | 'Supervisor' | 'Employee'

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  employeeId: string
  name: string
  email: string
  role: Role
  region: string
  department: string
  jobLevel: string   // 職等 e.g. L1, L2, L3
  jobTitle: string   // 職稱 e.g. Software Engineer, Operator
  managerId?: string
  supervisorId?: string
  createdAt: string
  updatedAt: string
}

// ─── Performance Cycle ────────────────────────────────────────────────────────

export type CycleType = 'Annual' | 'Quarterly' | 'Probation'
export type CycleStatus = 'GoalSetting' | 'InProgress' | 'UnderReview' | 'Completed'

export interface PerformanceCycle {
  id: string
  name: string
  type: CycleType
  status: CycleStatus
  region: string
  goalSettingStart: string
  goalSettingEnd: string
  reviewStart: string
  reviewEnd: string
  createdAt: string
  updatedAt: string
}

// ─── Goal ─────────────────────────────────────────────────────────────────────

export type GoalType = 'Personal' | 'Team'
export type GoalStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Completed'

export interface Goal {
  id: string
  userId: string
  cycleId: string
  title: string
  description: string    // Specific
  metric: string         // Measurable
  targetValue: string    // Achievable
  relevance: string      // Relevant
  dueDate: string        // Time-bound
  type: GoalType
  status: GoalStatus
  progressUpdates: ProgressUpdate[]
  createdAt: string
  updatedAt: string
}

export interface ProgressUpdate {
  id: string
  goalId: string
  content: string
  createdAt: string
}

// ─── Review Template ──────────────────────────────────────────────────────────

export type QuestionType = 'Text' | 'Rating' | 'MultipleChoice'

export interface TemplateQuestion {
  id: string
  order: number
  questionText: string
  questionType: QuestionType
  options?: string[]    // for MultipleChoice
  required: boolean
}

export interface ReviewTemplate {
  id: string
  name: string
  cycleType: CycleType
  jobLevel: string
  jobTitle: string
  region: string
  questions: TemplateQuestion[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ─── Performance Review ───────────────────────────────────────────────────────

export type ReviewGrade = 'A' | 'B' | 'C' | 'D'
export type ReviewStatus =
  | 'PendingEmployeeSubmit'
  | 'PendingSupervisorReview'
  | 'PendingManagerApproval'
  | 'Published'
  | 'Appealed'

export interface ReviewAnswer {
  questionId: string
  answer: string
}

export interface PerformanceReview {
  id: string
  cycleId: string
  employeeId: string
  supervisorId: string
  templateId: string
  status: ReviewStatus
  employeeAnswers: ReviewAnswer[]
  supervisorAnswers: ReviewAnswer[]
  supervisorComment: string
  grade?: ReviewGrade
  rank?: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

// ─── Appeal ───────────────────────────────────────────────────────────────────

export type AppealStatus = 'Pending' | 'UnderReview' | 'Resolved'

export interface Appeal {
  id: string
  reviewId: string
  employeeId: string
  managerId: string
  reason: string
  status: AppealStatus
  managerResponse?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  resource: string
  resourceId: string
  detail: Record<string, unknown>
  ipAddress: string
  createdAt: string
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
