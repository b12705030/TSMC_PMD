// ─── Roles ────────────────────────────────────────────────────────────────────

export type Role = 'Admin' | 'GlobalHR' | 'RegionalHR' | 'Manager' | 'Supervisor' | 'Employee'

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  employeeId: string
  name: string
  email: string
  role: Role
  regionId: string
  region: string
  departmentId: string
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
export type CycleStatus = 'GoalSetting' | 'InProgress' | 'EmployeeReview' | 'SupervisorReview' | 'Calibration' | 'Completed'

export interface PerformanceCycle {
  id: string
  name: string
  type: CycleType
  status: CycleStatus
  regionId: string
  region: { id: string; name: string; code: string }
  goalSettingStart: string
  goalSettingEnd: string
  reviewStart: string
  reviewEnd: string
  advanceConfirmed: boolean
  advanceConfirmedAt: string | null
  createdAt: string
  updatedAt: string
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'CycleAdvanceReminder'
  | 'CycleAutoAdvanced'
  | 'CyclePostponed'
  | 'GoalSubmitted'
  | 'GoalRejected'
  | 'GoalApproved'
  | 'AppealFiled'
  | 'AppealResolved'
  | 'ReviewSubmitted'
  | 'ReviewApproved'
  | 'ReviewPublished'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  cycleId: string | null
  createdAt: string
}

// ─── Goal ─────────────────────────────────────────────────────────────────────

export type GoalType = 'Personal' | 'Team'
export type GoalStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Completed' | 'Rejected'

export interface Goal {
  id: string
  userId: string
  cycleId?: string
  title: string
  description: string    // Specific
  metric: string         // Measurable
  targetValue: string    // Achievable
  relevance: string      // Relevant
  dueDate: string        // Time-bound
  type: GoalType
  status: GoalStatus
  rejectionReason?: string | null
  progressUpdates: ProgressUpdate[]
  milestones: GoalMilestone[]
  createdAt: string
  updatedAt: string
}

export interface ProgressUpdate {
  id: string
  goalId: string
  content: string
  createdAt: string
}

export interface GoalMilestone {
  id: string
  goalId: string
  title: string
  completedAt: string | null
  note: string | null
  url: string | null
  orderIndex: number
  createdAt: string
}

// ─── Review Template ──────────────────────────────────────────────────────────

export type QuestionType = 'Text' | 'Rating' | 'MultipleChoice'
export type TemplateStatus = 'Draft' | 'Published'

export interface TemplateQuestion {
  id: string
  templateId: string
  orderIndex: number
  questionText: string
  questionType: QuestionType
  options: string[]
  required: boolean
  isCustom: boolean           // false = HR base (locked), true = Manager custom
  scopeDepartmentId?: string
  createdAt: string
}

export interface ReviewTemplate {
  id: string
  name: string
  cycleId: string
  region: string
  appliesGrades: string[]     // e.g. ["L2", "L3"]
  applyTitles: string[]       // e.g. ["Process Engineer", "Equipment Engineer"]
  status: TemplateStatus
  questions: TemplateQuestion[]
  createdById: string
  createdAt: string
  updatedAt: string
}

// ─── Performance Review ───────────────────────────────────────────────────────

export type ReviewGrade = 'O' | 'S_Plus' | 'S' | 'S_Minus' | 'I' | 'U'
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
  supervisorId: string | null
  templateId: string
  status: ReviewStatus
  employeeAnswers: ReviewAnswer[]
  supervisorAnswers: ReviewAnswer[]
  supervisorComment: string | null
  grade?: ReviewGrade
  rank?: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface PerformanceReviewDetail extends PerformanceReview {
  cycle: { id: string; name: string; type: CycleType; status: CycleStatus }
  employee: { id: string; name: string; employeeId: string; jobLevel: string; jobTitle: string; managerId: string | null }
  supervisor: { id: string; name: string; employeeId: string } | null
  template: { id: string; name: string; questions: TemplateQuestion[] }
}

// ─── Appeal ───────────────────────────────────────────────────────────────────

export type AppealStatus = 'Pending' | 'Resolved'

export interface Appeal {
  id: string
  reviewId: string
  employeeId: string
  managerId: string
  reason: string
  status: AppealStatus
  managerResponse?: string
  resolvedAt?: string
  employee?: { id: string; name: string; employeeId: string; jobTitle?: string; jobLevel?: string }
  manager?:  { id: string; name: string }
  review?: {
    id: string
    grade?: ReviewGrade
    supervisorComment?: string
    employeeAnswers?:   ReviewAnswer[]
    supervisorAnswers?: ReviewAnswer[]
    cycle:    { id: string; name: string }
    template?: { id: string; name: string; questions: TemplateQuestion[] }
  }
  createdAt: string
  updatedAt: string
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  outcome: 'SUCCESS' | 'FORBIDDEN'
  resource: string
  resourceId?: string
  httpMethod?: string
  httpPath?: string
  httpStatus?: number
  detail?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
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
