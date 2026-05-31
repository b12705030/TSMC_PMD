// key 格式："METHOD:express-route-pattern"（含 :id 佔位符，對應 request.route.path）
// Auth 端點保留手動記錄（login 需記錄 employeeId 等額外資訊），此表不重複處理

export const ROUTE_ACTION_MAP: Record<string, { action: string; resource: string }> = {
  // Goals
  'POST:/goals':                                     { action: 'GOAL_CREATE',              resource: 'goal' },
  'PUT:/goals/:id':                                  { action: 'GOAL_UPDATE',              resource: 'goal' },
  'POST:/goals/:id/progress':                        { action: 'GOAL_PROGRESS_ADD',        resource: 'goal' },
  'POST:/goals/:id/milestones':                      { action: 'GOAL_MILESTONE_CREATE',    resource: 'goal_milestone' },
  'PATCH:/goals/:id/milestones/:milestoneId':        { action: 'GOAL_MILESTONE_UPDATE',    resource: 'goal_milestone' },
  'PATCH:/goals/:id/milestones/:milestoneId/note':   { action: 'GOAL_MILESTONE_NOTE',      resource: 'goal_milestone' },
  'PATCH:/goals/:id/milestones/:milestoneId/url':    { action: 'GOAL_MILESTONE_URL',       resource: 'goal_milestone' },
  'PUT:/goals/:id/milestones/reorder':               { action: 'GOAL_MILESTONE_REORDER',   resource: 'goal_milestone' },
  'DELETE:/goals/:id/milestones/:milestoneId':       { action: 'GOAL_MILESTONE_DELETE',    resource: 'goal_milestone' },
  'PATCH:/goals/:id/approve':                        { action: 'GOAL_APPROVE',             resource: 'goal' },
  'PATCH:/goals/:id/reject':                         { action: 'GOAL_REJECT',              resource: 'goal' },
  'PATCH:/goals/:id/submit':                         { action: 'GOAL_SUBMIT',              resource: 'goal' },
  // Reviews
  'PUT:/reviews/:id/answers':                        { action: 'REVIEW_ANSWERS_SAVE',      resource: 'review' },
  'POST:/reviews/:id/submit':                        { action: 'REVIEW_SUBMIT',            resource: 'review' },
  'PUT:/reviews/:id/supervisor':                     { action: 'REVIEW_SUPERVISOR_SAVE',   resource: 'review' },
  'POST:/reviews/:id/supervisor/submit':             { action: 'REVIEW_SUPERVISOR_SUBMIT', resource: 'review' },
  'PUT:/reviews/:id/calibrate':                      { action: 'REVIEW_CALIBRATE',         resource: 'review' },
  'POST:/reviews/cycle/:cycleId/publish':            { action: 'REVIEW_PUBLISH_ALL',       resource: 'review' },
  // Appeals
  'POST:/appeals':                                   { action: 'APPEAL_CREATE',            resource: 'appeal' },
  'PATCH:/appeals/:id/respond':                      { action: 'APPEAL_RESPOND',           resource: 'appeal' },
  // Cycles
  'POST:/cycles':                                    { action: 'CYCLE_CREATE',             resource: 'cycle' },
  'PATCH:/cycles/:id':                               { action: 'CYCLE_UPDATE',             resource: 'cycle' },
  'PATCH:/cycles/:id/advance':                       { action: 'CYCLE_ADVANCE',            resource: 'cycle' },
  'PATCH:/cycles/:id/confirm-advance':               { action: 'CYCLE_CONFIRM_ADVANCE',    resource: 'cycle' },
  'PATCH:/cycles/:id/postpone':                      { action: 'CYCLE_POSTPONE',           resource: 'cycle' },
  // Users
  'POST:/users':                                     { action: 'USER_CREATE',              resource: 'user' },
  'PATCH:/users/:id':                                { action: 'USER_UPDATE',              resource: 'user' },
  // Templates
  'POST:/templates':                                 { action: 'TEMPLATE_CREATE',          resource: 'template' },
  'POST:/templates/:id/questions':                   { action: 'TEMPLATE_QUESTION_CREATE', resource: 'template' },
  'DELETE:/templates/:id/questions/:questionId':     { action: 'TEMPLATE_QUESTION_DELETE', resource: 'template' },
  'PATCH:/templates/:id/publish':                    { action: 'TEMPLATE_PUBLISH',         resource: 'template' },
  'PATCH:/templates/:id/questions/:questionId/lock': { action: 'TEMPLATE_QUESTION_LOCK',   resource: 'template' },
}

export function extractResourceId(routePattern: string, actualPath: string): string | undefined {
  const pp = routePattern.split('/')
  const ap = actualPath.split('/')
  for (let i = 0; i < pp.length; i++) {
    if (pp[i] === ':id') return ap[i]
  }
  return undefined
}
