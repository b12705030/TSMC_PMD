# PMS 自動化測試計畫

> 版本：2026-05-10
> 範圍：後端 NestJS Service 層 Unit / Integration 測試
> 框架：Jest + @nestjs/testing + Prisma test database

---

## 一、環境設置

### 1.1 需要安裝的套件

```bash
cd backend
npm install --save-dev @nestjs/testing jest ts-jest @types/jest
```

### 1.2 Jest 設定（`backend/jest.config.ts`）

```ts
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/$1' },
}
```

### 1.3 測試資料庫

- 使用獨立的 `DATABASE_URL`（`TEST_DATABASE_URL`），與開發 DB 隔離
- 每個 `describe` 區塊用 `beforeEach` 透過 `prisma.$transaction` + rollback 保持乾淨
- **不 mock Prisma**，直接打 test DB，避免 mock/prod 型別落差

```ts
// 範例：每個測試後 rollback
let tx: Prisma.TransactionClient

beforeEach(async () => {
  tx = await prisma.$begin()   // 或用 $transaction + 手動 rollback
})
afterEach(async () => {
  await tx.$rollback()
})
```

### 1.4 測試 Seed Helper

在 `backend/test/helpers/seed.ts` 建立共用 factory：

```ts
createUser(role, overrides?)        // 建各角色 user
createRegion(name?)                 // 建 region
createCycle(regionNames[], status?) // 建 cycle
createTemplate(cycleId, regionId)   // 建 template
createGoal(userId, status?)         // 建 goal
createReview(employeeId, grade?)    // 建 performance review
```

---

## 二、GoalsService 測試

檔案：`src/modules/goals/goals.service.spec.ts`

### 2.1 createGoal

| # | 情境 | 角色 | 輸入 | 預期 |
|---|------|------|------|------|
| G-C-01 | 正常建立個人目標 | Employee | 有效 SMART 欄位，無 cycleId | 回傳 goal，status=Draft |
| G-C-02 | 綁定有效週期 | Employee | cycleId 屬於同 region，status=GoalSetting | 回傳 goal，cycleId 已設定 |
| G-C-03 | 綁定 Completed 週期 | Employee | cycleId 為 Completed 週期 | 拋 `BadRequestException`（週期不在進行中）|
| G-C-04 | 綁定其他 region 的週期 | Employee (Taiwan) | cycleId 屬於 US region | 拋 `ForbiddenException` |
| G-C-05 | 不存在的 cycleId | Employee | cycleId = `'non-existent'` | 拋 `BadRequestException` |

### 2.2 assertOwner（透過 updateGoal、addMilestone 等間接測試）

| # | 情境 | 角色 | 預期 |
|---|------|------|------|
| G-O-01 | Owner 更新自己的目標 | Employee (goal owner) | 成功 |
| G-O-02 | Admin 更新任何人的目標 | Admin | 成功 |
| G-O-03 | Supervisor 嘗試更新下屬目標 | Supervisor | 拋 `ForbiddenException` |
| G-O-04 | Manager 嘗試更新下屬目標 | Manager | 拋 `ForbiddenException` |
| G-O-05 | 不相關的 Employee 嘗試更新 | 其他 Employee | 拋 `ForbiddenException` |

### 2.3 assertCanRead（透過 getGoal、approveGoal 間接測試）

| # | 情境 | 角色 | 預期 |
|---|------|------|------|
| G-R-01 | Owner 查看自己的目標 | Employee | 成功 |
| G-R-02 | Supervisor 查看直屬下屬目標 | Supervisor | 成功（employee.supervisorId === user.id）|
| G-R-03 | Manager 查看部門目標（via supervisor）| Manager | 成功 |
| G-R-04 | 不相關的 Supervisor 查看 | 其他 Supervisor | 拋 `ForbiddenException` |
| G-R-05 | 不相關的 Employee 查看 | 其他 Employee | 拋 `ForbiddenException` |
| G-R-06 | Admin 查看任何人目標 | Admin | 成功 |

### 2.4 approveGoal / rejectGoal

| # | 情境 | 角色 | 目標狀態 | 預期 |
|---|------|------|----------|------|
| G-A-01 | Supervisor 核准 PendingApproval | Supervisor | PendingApproval | 狀態變 Approved |
| G-A-02 | Manager 核准 PendingApproval | Manager | PendingApproval | 狀態變 Approved |
| G-A-03 | Owner 嘗試核准自己的目標 | Employee | PendingApproval | 拋 `ForbiddenException` |
| G-A-04 | 核准非 PendingApproval 狀態 | Supervisor | Draft | 拋 `BadRequestException` |
| G-A-05 | Supervisor 退回目標 | Supervisor | PendingApproval | 狀態變 Draft |

### 2.5 里程碑操作（全部需要 assertOwner）

| # | 方法 | 情境 | 角色 | 預期 |
|---|------|------|------|------|
| G-M-01 | addMilestone | 正常新增 | Owner | 回傳 milestone，orderIndex=0 |
| G-M-02 | addMilestone | 非 owner 新增 | Supervisor | 拋 `ForbiddenException` |
| G-M-03 | toggleMilestone | 標記完成 | Owner | completedAt 設為現在 |
| G-M-04 | toggleMilestone | 取消完成 | Owner | completedAt 設為 null |
| G-M-05 | toggleMilestone | 非 owner 操作 | Supervisor | 拋 `ForbiddenException` |
| G-M-06 | deleteMilestone | 正常刪除 | Owner | milestone 從 DB 消失 |
| G-M-07 | deleteMilestone | 非 owner 刪除 | Manager | 拋 `ForbiddenException` |
| G-M-08 | reorderMilestones | 正常重排 | Owner | orderIndex 依傳入 ids 順序更新 |
| G-M-09 | updateMilestoneNote | 正常更新 | Owner | note 更新 |
| G-M-10 | updateMilestoneNote | 非 owner | Supervisor | 拋 `ForbiddenException` |

---

## 三、TemplatesService 測試

檔案：`src/modules/templates/templates.service.spec.ts`

### 3.1 createTemplate — Region 驗證

| # | 情境 | 角色 | dto.regionId | cycle.regions | 預期 |
|---|------|------|-------------|---------------|------|
| T-C-01 | RegionalHR 正常建立 | RegionalHR (Taiwan) | 未傳 | ['Taiwan'] | 成功，regionId = user.regionId |
| T-C-02 | RegionalHR 傳入 dto.regionId 仍被忽略 | RegionalHR (Taiwan) | US region id | ['Taiwan', 'US'] | 成功，regionId = user.regionId（US 被忽略）|
| T-C-03 | RegionalHR 建立不屬於自己 region 的週期 | RegionalHR (Taiwan) | — | ['US'] | 拋 `ForbiddenException` |
| T-C-04 | Admin + 單 region cycle，不傳 regionId | Admin | 未傳 | ['Taiwan'] | 成功，自動繼承 Taiwan regionId |
| T-C-05 | Admin + 多 region cycle，不傳 regionId | Admin | 未傳 | ['Taiwan', 'US'] | 拋 `BadRequestException`（必須指定 regionId）|
| T-C-06 | Admin + 多 region cycle，傳有效 regionId | Admin | Taiwan region id | ['Taiwan', 'US'] | 成功，regionId = dto.regionId |
| T-C-07 | Admin 傳不存在的 regionId | Admin | `'fake-id'` | ['Taiwan', 'US'] | 拋 `BadRequestException`（Region 不存在）|
| T-C-08 | Admin 傳不屬於 cycle 的 regionId | Admin | Japan region id | ['Taiwan', 'US'] | 拋 `BadRequestException`（Region 不屬於此週期）|
| T-C-09 | cycle.regions 為空 | Admin | — | [] | 拋 `BadRequestException`（週期未設定 Region）|

### 3.2 publishTemplate — 重複覆蓋檢查

| # | 情境 | 預期 |
|---|------|------|
| T-P-01 | 正常發布（無衝突）| 狀態變 Published |
| T-P-02 | 同 cycle + region + 有重疊 appliesGrades | 拋 `BadRequestException`，訊息包含衝突模板名稱 |
| T-P-03 | 同 cycle + region + 有重疊 applyTitles | 拋 `BadRequestException` |
| T-P-04 | 同 cycle 但不同 region，職等重疊 | 成功（不同 region 不衝突）|
| T-P-05 | 重複發布已發布的模板 | 拋 `BadRequestException`（已發布）|

### 3.3 addCustomQuestion / deleteCustomQuestion

| # | 情境 | 角色 | 預期 |
|---|------|------|------|
| T-Q-01 | Manager 新增自訂題目 | Manager | 成功，isCustom=true，scopeDepartmentId=user.departmentId |
| T-Q-02 | Manager 刪除自己部門的自訂題目 | Manager | 成功 |
| T-Q-03 | Manager 嘗試刪除其他部門題目 | 其他 Manager | 拋 `ForbiddenException` |
| T-Q-04 | Manager 嘗試刪除 HR 基礎題目 | Manager | 拋 `ForbiddenException`（不可刪 HR 題）|
| T-Q-05 | 不同 region 的 Manager 存取模板 | Manager (US) | 拋 `ForbiddenException`（region 不符）|

---

## 四、ReviewsService 測試

檔案：`src/modules/reviews/reviews.service.spec.ts`

### 4.1 submitSupervisor — grade 必填

| # | 情境 | review.grade | 預期 |
|---|------|-------------|------|
| R-S-01 | grade 已設定，所有題目已填 | 'S' | 狀態推進至 PendingManagerApproval |
| R-S-02 | grade 為 null | null | 拋 `BadRequestException`（請先選擇等第）|
| R-S-03 | grade 已設定，但有 required 題未填 | 'S' | 拋 `BadRequestException`（必填題未填）|
| R-S-04 | 非 Supervisor/direct-report-Manager 嘗試送出 | 'S' | 拋 `ForbiddenException` |

### 4.2 publishAll — 批次 grade 檢查

| # | 情境 | 預期 |
|---|------|------|
| R-P-01 | 所有 pending review 都有 grade | 全部狀態變 Published，員工可查看 |
| R-P-02 | 有任一 review grade = null | 拋 `BadRequestException`（X 份評核尚未設定等第）|
| R-P-03 | 無 pending review（pendingCount = 0）| 回傳空陣列（不報錯）|

### 4.3 validateAnswers

| # | 情境 | 預期 |
|---|------|------|
| R-V-01 | Rating 傳 3 | 通過 |
| R-V-02 | Rating 傳 0 | 拋 `BadRequestException` |
| R-V-03 | Rating 傳 6 | 拋 `BadRequestException` |
| R-V-04 | Rating 傳非整數（1.5）| 拋 `BadRequestException` |
| R-V-05 | MultipleChoice 傳合法選項 | 通過 |
| R-V-06 | MultipleChoice 傳不在 options 的值 | 拋 `BadRequestException` |
| R-V-07 | Text 傳 5000 字（上限）| 通過 |
| R-V-08 | Text 傳 5001 字 | 拋 `BadRequestException` |
| R-V-09 | required 題無答案 | 拋 `BadRequestException` |
| R-V-10 | optional 題無答案 | 通過 |

### 4.4 calibrate — 權限

| # | 情境 | 角色 | 預期 |
|---|------|------|------|
| R-CAL-01 | Manager 設定等第 | Manager | 成功，grade 更新 |
| R-CAL-02 | Manager 設定排名 | Manager | 成功，rank 更新 |
| R-CAL-03 | Supervisor 嘗試校準 | Supervisor | 拋 `ForbiddenException` |
| R-CAL-04 | Employee 嘗試校準 | Employee | 拋 `ForbiddenException` |

### 4.5 Direct-report Manager 可執行 supervisor 動作

| # | 情境 | 角色 | review.supervisorId | 預期 |
|---|------|------|--------------------|----|
| R-DR-01 | direct-report manager 送出評核 | Manager (employee.managerId) | null | 成功（視為 supervisor）|
| R-DR-02 | 非 manager 對 direct-report 送出 | 其他 Manager | null | 拋 `ForbiddenException` |
| R-DR-03 | 一般有 supervisor 的員工 | Supervisor | supervisorId = user.id | 成功 |

### 4.6 getTeamReviews — Region / 層級隔離

| # | 情境 | 角色 | 預期 |
|---|------|------|------|
| R-GT-01 | Admin 取得所有評核 | Admin | 回傳全部評核（不限 region）|
| R-GT-02 | RegionalHR 取得評核 | RegionalHR (Taiwan) | 只回傳 Taiwan region 員工的評核 |
| R-GT-03 | Manager 取得評核 | Manager | 只回傳自己部門的評核 |
| R-GT-04 | Supervisor 取得評核 | Supervisor | 只回傳直屬下屬評核 |

---

## 五、CyclesService 測試

檔案：`src/modules/cycles/cycles.service.spec.ts`

### 5.1 advanceStatus — 權限與 gate 檢查

| # | 情境 | 角色 | cycle.regions | 預期 |
|---|------|------|--------------|------|
| CY-A-01 | RegionalHR 推進單 region cycle | RegionalHR | ['Taiwan'] | 成功 |
| CY-A-02 | RegionalHR 嘗試推進跨 region cycle | RegionalHR | ['Taiwan', 'US'] | 拋 `ForbiddenException` |
| CY-A-03 | Admin 推進跨 region cycle | Admin | ['Taiwan', 'US'] | 成功 |
| CY-A-04 | 推進至 EmployeeReview，無 Published 模板 | Admin/HR | — | 拋 `BadRequestException`（未發布模板）|
| CY-A-05 | 推進至 EmployeeReview，有 Published 模板 | Admin/HR | — | 成功，自動建立 PerformanceReview |
| CY-A-06 | 週期已是 Completed，再次推進 | Admin | — | 拋 `BadRequestException`（週期已完成）|

### 5.2 buildReviewRows — 包含 direct-report 員工

| # | 情境 | 預期 |
|---|------|------|
| CY-B-01 | 有 supervisor 的員工 | reviewRow.supervisorId = employee.supervisorId |
| CY-B-02 | 無 supervisor（direct-report）的員工 | reviewRow.supervisorId = null，不跳過該員工 |
| CY-B-03 | 無 supervisor 且無 manager 的員工 | 不建立評核（無法派主管）|

### 5.3 skipDuplicates 防止重複

| # | 情境 | 預期 |
|---|------|------|
| CY-D-01 | 同一週期重複推進至 EmployeeReview | 不重複建立 PerformanceReview（skipDuplicates=true）|

---

## 六、UsersService 測試

檔案：`src/modules/users/users.service.spec.ts`

### 6.1 getEmployee — 存取控制

| # | 情境 | 角色 | 目標員工 | 預期 |
|---|------|------|----------|------|
| U-G-01 | Admin 查看任何員工 | Admin | 任意 | 成功 |
| U-G-02 | RegionalHR 查看同 region 員工 | RegionalHR (Taiwan) | Taiwan employee | 成功 |
| U-G-03 | RegionalHR 查看其他 region 員工 | RegionalHR (Taiwan) | US employee | 拋 `ForbiddenException` |
| U-G-04 | Supervisor 查看直屬下屬 | Supervisor | employee.supervisorId = user.id | 成功 |
| U-G-05 | Supervisor 查看非直屬員工 | Supervisor | 其他員工 | 拋 `ForbiddenException` |
| U-G-06 | Manager 查看部門員工（via supervisor）| Manager | 部門內員工 | 成功 |
| U-G-07 | Manager 查看其他部門員工 | Manager | 其他部門員工 | 拋 `ForbiddenException` |

---

## 七、AppealService 測試

檔案：`src/modules/appeals/appeals.service.spec.ts`

| # | 情境 | 角色 | 預期 |
|---|------|------|------|
| AP-01 | Employee 對已發布評核提出申訴 | Employee | 成功，status=Appealed |
| AP-02 | Employee 對未發布評核提出申訴 | Employee | 拋 `BadRequestException` |
| AP-03 | Employee 對已申訴評核再次申訴 | Employee | 拋 `BadRequestException`（已有申訴）|
| AP-04 | Supervisor 查看申訴 | Supervisor | 拋 `ForbiddenException`（只有 Manager 可查）|
| AP-05 | Manager 回覆申訴（不調整等第）| Manager | 申訴狀態=Resolved，等第不變 |
| AP-06 | Manager 回覆申訴（調整等第）| Manager | 申訴狀態=Resolved，review.grade 更新 |
| AP-07 | Manager 查看其他部門的申訴 | 其他 Manager | 拋 `ForbiddenException` |

---

## 八、AuthService / Guard 測試

### 8.1 登入

| # | 情境 | 預期 |
|---|------|------|
| AUTH-01 | 正確帳密 | 回傳 user 物件，session 建立 |
| AUTH-02 | 錯誤密碼 | 拋 `UnauthorizedException` |
| AUTH-03 | 不存在的帳號 | 拋 `UnauthorizedException` |

### 8.2 RolesGuard

| # | 情境 | 預期 |
|---|------|------|
| RG-01 | 無 session 呼叫受保護 endpoint | 回傳 401 |
| RG-02 | Employee 呼叫需要 Admin 的 endpoint | 回傳 403 |
| RG-03 | 有效角色呼叫對應 endpoint | 通過 |

---

## 九、執行方式

```bash
cd backend

# 跑所有測試
npm test

# 只跑某個 service
npm test -- goals.service

# 產生覆蓋率報告
npm run test:cov
```

---

## 十、優先順序

高安全風險、修過最多次的先寫：

| 優先 | Service | 原因 |
|------|---------|------|
| 🔴 P0 | TemplatesService | region 驗證是第六輪才修正，邏輯最複雜 |
| 🔴 P0 | GoalsService | assertOwner/assertCanRead 是第五輪核心修改 |
| 🔴 P0 | ReviewsService | grade enforcement + direct-report 邏輯新增 |
| 🟡 P1 | CyclesService | advanceStatus 跨 region 保護 + buildReviewRows |
| 🟡 P1 | UsersService | region/hierarchy 隔離 |
| 🟢 P2 | AppealService | 邏輯較單純，但 403 場景要覆蓋 |
| 🟢 P2 | AuthService + RolesGuard | 有 session 機制，需整合測試 |

---

*最後更新：2026-05-10*
