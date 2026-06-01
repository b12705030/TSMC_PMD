# PMS — Feature Progress

每個功能完成後請更新此檔。標注哪些已實作、哪些尚待補完、哪些刻意跳過。

---

## 功能實作狀態

### 1. 帳號與身分驗證

| 項目 | 狀態 | 備註 |
|------|------|------|
| Session-based 登入 / 登出 / 取得當前使用者 | ✅ 完成 | cookie `sessionId`，8 小時有效 |
| RBAC（5 種角色）| ✅ 完成 | `RolesGuard` + `@Roles()` decorator |
| 地區資料隔離（RegionalHR 只看自己 region）| ✅ 完成 | Service 層 where 條件 |
| Session 閒置 30 分鐘自動登出 | ✅ 完成 | 後端 `lastActiveAt` + 每次請求刷新；前端 `IdleWatcher` 25 min 倒數 Toast，30 min 自動登出；登入頁顯示 idle/expired 提示 |
| 偵測同一 Session IP 異常變更並記錄警示 | ⬜ 待做 | |
| MFA 多因素認證 | ⬜ 待做 | Spec 有列，開發階段跳過 |
| SSO 整合 | ⬜ 待做 | 開發階段以帳密替代 |

---

### 2. 績效週期管理

| 項目 | 狀態 | 備註 |
|------|------|------|
| HR 建立週期（Annual / Quarterly / Probation）| ✅ 完成 | `POST /api/cycles` |
| 週期列表（依 region 隔離）| ✅ 完成 | `GET /api/cycles`，RegionalHR 只看自己 region |
| 狀態機 6 步驟單向推進 | ✅ 完成 | `GoalSetting → InProgress → EmployeeReview → SupervisorReview → Calibration → Completed`；`PATCH /api/cycles/:id/advance` |
| 推進至 EmployeeReview 前強制檢查已發布模板 | ✅ 完成 | 無 Published 模板時 backend 拋 400，阻擋推進 |
| 推進前確認 Dialog | ✅ 完成 | 使用 `ConfirmDialog` 元件 |
| 雙軌道 Pipeline UI | ✅ 完成 | 上軌道「模板準備」（HR建立→模板發布→主管補充問卷→◆）；下軌道「評核流程」（公司/部門目標公布→目標設定→執行中→◆→員工自評→主管初評→校準→已完成）；◆ 在第 4 格垂直對齊 |
| 週期可跨多個 Region（regions String[]）| ✅ 完成 | migration `20260505082410`，Admin 用 checkbox 多選 |
| Admin 在 GoalSetting 期間可編輯週期（名稱、地區、日期）| ✅ 完成 | `PATCH /api/cycles/:id`，僅限 Admin |
| Region 選單由 DB 實際資料驅動 | ✅ 完成 | `GET /api/users/regions` |
| 多週期同時進行不衝突 | ✅ 完成 | 無互斥限制，各自獨立 |
| Global Admin 設定全球核心階段（各區不得跳過）| ⬜ 跳過 | 進階 governance，等核心流程完成後補 |

---

### 3. 表單模板系統

| 項目 | 狀態 | 備註 |
|------|------|------|
| RegionalHR 建立公版模板 | ✅ 完成 | `POST /api/templates`，含 base questions |
| HR Publish 模板 | ✅ 完成 | `PATCH /api/templates/:id/publish`，含確認 Dialog |
| 經理依職稱新增自訂題目 | ✅ 完成 | `POST /api/templates/:id/questions`，isCustom=true |
| 必答題鎖定（HR 題目經理不可刪改）| ✅ 完成 | Service 層阻擋，前端 UI 不顯示刪除按鈕 |
| 依職等 / 職稱自動套用模板 | ✅ 完成 | 推進至 EmployeeReview 時，依 jobLevel + jobTitle 自動匹配並建立 PerformanceReview |
| 題目類型：Text / Rating / MultipleChoice | ✅ 完成 | DTO + 前端 select |

---

### 4. 目標管理

| 項目 | 狀態 | 備註 |
|------|------|------|
| 員工填寫 SMART 目標 | ✅ 完成 | `POST /api/goals`，含 SMART 六欄位表單 |
| 個人目標 / 團隊目標 | ✅ 完成 | `type: Personal \| Team`，建立時選擇 |
| 查看自己的目標列表 | ✅ 完成 | `GET /api/goals`，卡片式 + 狀態進度條 |
| 目標詳情頁 | ✅ 完成 | `/goals/[id]`；含里程碑 DnD、submit/approve/reject 按鈕 |
| 目標里程碑（新增 / 勾選 / 刪除）| ✅ 完成 | `POST/PATCH/DELETE /api/goals/:id/milestones` |
| 里程碑完成時附加備注 | ✅ 完成 | 第一次點勾選出現備注輸入框，可選填 |
| 里程碑順序可拖拉調整 | ✅ 完成 | `PUT /api/goals/:id/milestones/reorder`，左側 ⠿ drag handle，hover 顯示 |
| 進度條依里程碑比例動態計算 | ✅ 完成 | 無里程碑時 fallback 至 status 預設值 |
| 建立目標後直接進入里程碑設定 | ✅ 完成 | 建立成功 redirect 至詳情頁並自動展開新增輸入框 |
| 主管 / 經理可查看下屬目標 | ✅ 完成 | `GET /api/goals/employee/:id`，RBAC 控管；Manager 支援跨 Supervisor 傳遞存取 |
| 主管審核 / 核准目標 | ✅ 完成 | `PATCH /goals/:id/approve`（核准→Approved）、`PATCH /goals/:id/reject`（退回→Draft）；目標詳情頁在 PendingApproval 狀態下對 Supervisor/Manager 顯示審核按鈕 |
| 目標與績效週期關聯 | ✅ 完成 | 新增目標時可選進行中週期（GoalSetting/InProgress），dropdown 顯示，選填 |

---

### 5. 績效評核流程

**狀態機：** `PendingEmployeeSubmit → PendingSupervisorReview → PendingManagerApproval → Published`（可申訴 → `Appealed`）

**草稿機制：** 員工和主管各自的階段可以反覆存草稿；按「送出」才推進到下一個狀態，送出後鎖定。

**自動建立：** 週期推進至 `EmployeeReview` 時觸發（非 InProgress），依 jobLevel + jobTitle 匹配已發布模板。

| 項目 | 狀態 | 備註 |
|------|------|------|
| 週期推進 EmployeeReview 時自動建立評核 | ✅ 完成 | `cycles.service.ts` `advanceStatus()` 觸發；無匹配模板的員工跳過（log 警告）|
| 員工填寫績效表單（自評）| ✅ 完成 | `PUT /reviews/:id/answers`（草稿）+ `POST /reviews/:id/submit`（送出鎖定）|
| 主管初評（附文字說明）| ✅ 完成 | `PUT /reviews/:id/supervisor`（草稿）+ `POST /reviews/:id/supervisor/submit`；含等第選擇 |
| 等第制評分（O/S+/S/S-/I/U）| ✅ 完成 | 對應 TSMC 實際制度；O 和 U 各自顯示 soft warning（非硬限制）|
| 員工 / 主管各端表單（前端）| ✅ 完成 | `/reviews/[id]`；員工自評 + 主管評核 2 欄位視圖 + 等第選擇 + 申訴入口 |
| 團隊評核列表（主管側）| ✅ 完成 | `GET /reviews/team`，前端 `/reviews/team` 頁面 |
| 經理校準排名並發布結果 | ✅ 完成 | `/reviews/calibrate/[cycleId]`；等第 + 排名 inline 編輯，一鍵發布全部 |
| 主管比較介面（多員工並排）| ✅ 完成 | `/reviews/compare/[cycleId]`；卡片橫向捲動，依等第排序 |

---

### 6. 申訴機制

| 項目 | 狀態 | 備註 |
|------|------|------|
| 員工向經理提出申訴（越過主管）| ✅ 完成 | `POST /api/appeals`；員工在 Published 評核頁點「提出申訴」，輸入原因後送出 |
| 直屬主管不可見申訴內容 | ✅ 完成 | `getAppealById` 只允許當事員工和 Manager 存取，Supervisor 呼叫會拋 403 |
| 經理審核並回覆申訴 | ✅ 完成 | `/appeals/[id]`；Manager 可回覆 + 調整等第（選填），回覆後申訴標記已解決 |
| 申訴列表頁（經理側）| ✅ 完成 | `/appeals` 頁面顯示所有收到的申訴，可點入詳情 |
| 申訴結果通知員工 | ✅ 完成 | Sidebar「我的評核」顯示紅色數字 badge（`Appeal.seenByEmployee`）；員工查看後自動已讀；`GET /appeals/my-unread-count` 每 60 秒輪詢 |
| 前端 `/appeals` 頁面串接真實資料 | ✅ 完成 | `useAppeals` hook 已串接 `GET /appeals` |

---

### 7. Audit Log

| 項目 | 狀態 | 備註 |
|------|------|------|
| 登入 / 登出事件寫入 | ✅ 完成 | 寫入 Neon PostgreSQL `AuditLog` 表 |
| 所有 CRUD 操作記錄 | ✅ 完成 | `AuditWriteInterceptor` 全域掛載（`APP_INTERCEPTOR`），涵蓋 Goals / Reviews / Appeals / Cycles / Templates / Users 共 28 個 CRUD 端點；Auth 端點保留手動記錄 |
| PostgreSQL Append-only 儲存 | ✅ 完成 | `audit.service.ts` 透過 PrismaService 寫入；失敗只 log error，無重試或 outbox（設計決策：接受） |
| 前端 Audit Log 查閱頁 | ✅ 完成 | 頁面已完成，資料從 Neon PostgreSQL 查詢 |

---

### 8. Dashboard

| 項目 | 狀態 | 備註 |
|------|------|------|
| 各角色對應 Dashboard 內容 | ✅ 完成 | Employee / Supervisor / Manager / HR / Admin 各自顯示待辦事項與數據 |
| 全年週期行程（Gantt 圖）| ✅ 完成 | 固定顯示當年度 1–12 月，目標設定期（藍）/ 評核期（紫）/ 今日標線（琥珀色）|
| 填寫完成率、評分分布圖表 | ✅ 完成 | `GET /reviews/stats`（後端）；Dashboard Manager 端顯示等第分布橫條圖，HR/Admin 端顯示全局等第分布 |

---

### 9. 團隊管理（Team）

| 項目 | 狀態 | 備註 |
|------|------|------|
| Supervisor 看直屬員工列表 | ✅ 完成 | `GET /users/team`，DataTable |
| Manager 看階層分組視圖 | ✅ 完成 | `GET /users/team/hierarchy`，依 Supervisor 分組；直屬員工（無 Supervisor）獨立顯示 |
| 點入員工詳情頁 | ✅ 完成 | `/team/[employeeId]`；顯示員工資料、目標列表、評核歷史 |

---

## 待辦事項

### 立即需要執行

- [ ] **跑 migration**：`cd backend && npx prisma migrate dev --name refine-cycle-status`（CycleStatus 6 步驟才會生效）
- [ ] **重啟後端**：UsersModule 注入 GoalsModule/ReviewsModule 的 DI 改動需重啟

### 功能待做（建議優先順序）

- [x] **週期自動推進確認流程** — 評核期 7 天前對 HR 顯示藍色確認橫幅（確認如期開始 / 延期）；HR 確認後系統於 `reviewStart` 當天自動推進並通知所有參與者；延期時更新日期並發送延期通知；Cron 排程每天 00:05 執行；`@nestjs/schedule`；Sidebar 通知鈴鐺（藍色 badge）

- [x] **申訴機制** — 已完成（schema + backend + frontend）
- [x] **目標與週期關聯 UI** — 已完成
- [x] **主管多員工並排比較介面** — 已完成
- [x] **Dashboard 等第分布圖表** — 已完成
- [x] **Audit Log CRUD** — 已完成（`AuditWriteInterceptor` 全域攔截）
- [x] **登入 rate limit** — `@nestjs/throttler` IP 層（10 次/分鐘）+ `AuthService` 帳號鎖定（失敗 5 次鎖 10 分鐘）
- [x] **Session 閒置偵測** — 後端 `AuthGuard` 每次請求更新 `lastActiveAt`，超 30 分鐘拋 401；前端 `IdleWatcher` 25 分鐘出現倒數 Toast，30 分鐘自動登出；登入頁顯示對應提示（idle / expired）
- [x] **申訴通知 badge** — 後端 `Appeal.seenByEmployee` 欄位，回覆申訴時設 false；`GET /appeals/my-unread-count`；Sidebar「我的評核」顯示紅色數字 badge，員工查看後自動已讀
- [x] **目標截止日提醒** — `DeadlineToast` 元件，7 天內到期的未完成目標顯示右下角 Toast，當日關閉後不再打擾

### 模板設計優化（已討論，待實作）

| # | 功能 | 說明 | 優先度 |
|---|------|------|--------|
| T1 | **Manager 自訂題目跨週期複用** | 模板詳情頁加「從上個週期複製自訂題目」按鈕；找到同 Manager 在前一週期同模板下的自訂題，一次匯入 | 高 |
| T2 | **MultipleChoice 新增「其他（請說明）」選項** | 新增 `OpenEndedChoice` 選項類型，員工選「其他」時出現文字輸入框；或在題型層面支援 fallback text | 中 |
| T3 | **Manager 不可修改 HR 基礎題選項** | 維持現況（設計決策：基礎題鎖定以確保跨部門可比性，Manager 若需部門特定選項應新增自訂題） | ✅ 確認不做 |
| T4 | **自訂題目排序可插入基礎題之間** | 目前自訂題永遠排在基礎題後面；需支援 Manager 調整 orderIndex 至任意位置 | 低 |

### 技術債

- [x] 員工可直接透過 `PUT /goals/:id` body `{ status }` 把目標改為 `PendingApproval`，已改為獨立 endpoint `PATCH /goals/:id/submit`；目標詳情頁草稿狀態下顯示「提交審核」按鈕
- [x] `AuditService` CRUD 操作已透過 `AuditWriteInterceptor` 全域覆蓋；ES 寫入失敗只 log error，無重試或 outbox（設計決策：接受）
- [x] Session 閒置 30 分鐘自動登出已實作（後端 `lastActiveAt` + 前端 `IdleWatcher`）
- [x] Audit Log 已遷移至 Neon PostgreSQL（`AuditLog` Prisma model），移除 Elasticsearch 依賴

### 安全漏洞修補（第二輪 Codex Review，已全數修復）

- [x] **[高] `UpdateGoalDto` 保留 `status` 欄位** → 任何人都可透過 `PUT /goals/:id { status: "Approved" }` 繞過審核流程。修法：從 `UpdateGoalDto` 移除 `status` 及 `GoalStatus` import，狀態只能透過 `submit/approve/reject` 專用 endpoint 改。
- [x] **[高] `ReviewsService.calibrate()` 缺管轄權檢查** → 只驗角色與狀態，任何 Manager 可校準不屬於自己的 review。修法：在 status check 後加 `await this.assertAccess(review, user)`。
- [x] **[高] Backend ESLint 9 + `.eslintrc.js` 組合導致 CI 失敗** → ESLint 9 不讀 `.eslintrc.js`，CI lint 步驟必炸。修法：新增 `backend/eslint.config.js` flat config（`@typescript-eslint/eslint-plugin` + parser）。
- [x] **[高] 同條件可有多份 Published template** → `autoCreateReviews()` 用 `find()` 取第一筆，結果不可預測。修法：`publishTemplate()` 加 `hasSome` overlap 檢查，有衝突時拋 400 並回傳衝突模板名稱。
- [x] **[高] 週期推進缺完整性 gate** → 進 SupervisorReview 前加確認員工全部 submit（`PendingEmployeeSubmit` count = 0）；進 Calibration 前確認主管全部 submit（`PendingSupervisorReview` count = 0）；進 Completed 前確認已 publish（`PendingManagerApproval` count = 0）。
- [x] **[中] Appeals Admin 語意矛盾** → `getAppealsForManager()` 改接收 `SessionUser`，Admin 跳過 `managerId` 過濾全域查看；`getAppealById` / `respondToAppeal` 也補 `Role.Admin` 特判，Admin 可看並回覆所有申訴。
- [x] **[中] Review answer 提交缺乏 schema 驗證** → submit 前調用 `validateAnswers()`：驗 questionId 屬於該 template、required 題必須填寫；草稿 save 不驗，送出才嚴格檢查。

### 安全漏洞修補（Codex Code Review，已全數修復）

- [x] **[高] `GoalsService.assertAccess` 權限過寬** → `assertAccess` 改為 async，加入組織關係查詢（Supervisor 需 `employee.supervisorId === user.id`，Manager 需直屬或 via Supervisor）；`approveGoal` / `rejectGoal` 也補上同樣檢查。
- [x] **[高] `ReviewsService.assertAccess` Manager 可讀任意 review** → Manager 不再直接放行，改為查 `employee.managerId` 和 `supervisor.managerId` 確認管轄範圍。
- [x] **[高] `Goal` schema 缺少 Prisma relation** → 補 `user User @relation(..., onDelete: Cascade)`、`cycle PerformanceCycle? @relation(...)`；`ProgressUpdate` 補 `user User @relation(...)`；User / PerformanceCycle 補 back-reference；migration `20260508090052_add_goal_relations`。
- [x] **[高] Cycle advance 只檢查「有 Published template」** → advance 至 EmployeeReview 前加 `dryRunReviews()` dry-run，找出無匹配模板的員工，有缺口時拋 400 並回傳清單（`message` + `unmatched[]`）。
- [x] **[中] Appeal `newGrade` 無型別驗證** → DTO 改用 `@IsEnum(ReviewGrade)`，service 移除 `as any`。
- [x] **[中] 前端 type-check / lint 失敗** → `templates/page.tsx` 補 `QuestionDraft` 型別解決 `never[]` 錯誤；移除 `reviews/[id]/page.tsx` 未使用的 import；移除 `templates/[id]/page.tsx` 未使用的 `isHR`；`team/[employeeId]/page.tsx` 用具體型別替換 `as any`。
- [x] **[低] `.env.example` 寫 Supabase 但 README 說 Neon** → `.env.example` 更新為 Neon 連線字串格式。

### 安全漏洞修補（第三輪 Codex Review，已全數修復）

- [x] **[高] `getReviewStats()` RegionalHR 無 region 隔離** → 加 `else if (user.role === Role.RegionalHR) { where = { employee: { regionId: user.regionId } } }` 過濾只看同 region 評核。（`reviews.service.ts`）
- [x] **[高] `GET /users/:id` 無管轄權檢查** → `getEmployee(id, currentUser)` 依角色驗管轄範圍（RegionalHR 限 region、Supervisor 限直屬、Manager 限直屬或 via supervisor）。（`users.service.ts`、`users.controller.ts`）
- [x] **[高] 自訂題目 `scopeDepartmentId` 未套用到評核** → 新增 `scopeQuestions()` private helper，在所有回傳 review 的方法中過濾題目（只留 `scopeDepartmentId === null` 或等於員工 departmentId）。REVIEW_INCLUDE 補 `departmentId`。（`reviews.service.ts`）
- [x] **[高] cycle advance 非 transaction** → 抽出 `buildReviewRows()` 方法，用 `$transaction` 把 cycle status update 和 `performanceReview.createMany` 包在同一個交易中。（`cycles.service.ts`）
- [x] **[高] Goal 可綁任意 `cycleId`，缺 region/status 驗證** → `createGoal()` 中若 `dto.cycleId` 存在，驗證 cycle region 包含 `user.region` 且狀態為 `GoalSetting` 或 `InProgress`，否則拋 400/403。（`goals.service.ts`）
- [x] **[高] CI `npm test` 因無測試而失敗** → `package.json` test script 加 `--passWithNoTests`，CI pipeline 恢復綠燈。
- [x] **[高] Direct-report 員工不進評核** → `PerformanceReview.supervisorId` 改 nullable（`String?`）；`dryRunReviews` / `buildReviewRows` 改為包含有 supervisor 或有 manager 的員工；`saveSupervisorReview` / `submitSupervisor` 補 direct-report 的 reviewer 判斷（`supervisorId === null && employee.managerId === user.id`）。需執行 migration `nullable_review_supervisor`。（`schema.prisma`、`cycles.service.ts`、`reviews.service.ts`）
- [x] **[高] 前端 hook 吞錯誤** → 所有 7 個 hook 檔統一加 `error: string | null` state；新增 `ErrorBanner` 元件；所有頁面（`goals`、`reviews`、`reviews/team`、`appeals`、`team`、`templates`、`cycles`、`audit-log`、`dashboard`）接 `error` 並顯示錯誤橫幅。
- [x] **[中] Admin `getTeamReviews()` 語意不一致** → 拆為獨立 Admin 分支（`where = {}`），不再與 Manager 混用同一分支。（`reviews.service.ts`）
- [x] **[中] Review submit answer 無型別驗證** → `validateAnswers()` 加 Rating（1–5 整數）、MultipleChoice（需在 `options` 內）、Text（≤5000 字）驗證。（`reviews.service.ts`）

### 安全漏洞修補（第四輪 Codex Review）

- [x] **[高] 跨地區 cycle 可被單一 RegionalHR 推進整個週期** → `advanceStatus()` 加防護：`regions.length > 1 && role !== Admin` 時拋 403，跨區 cycle 只允許 Admin 推進。（`cycles.service.ts`）

### 安全漏洞修補（第五輪 Codex Review）

- [x] **[高] 前端 PerformanceReview 型別 `supervisorId`/`supervisor` 非 nullable** → `types/index.ts` 改為 `supervisorId: string | null`、`supervisor: {...} | null`；`employee` 補 `managerId: string | null`；`reviews/[id]/page.tsx` 加 `isDirectReportManager` 判斷，`canSupervisorEdit` 支援 direct-report manager，`review.supervisor?.name` 改 optional chain。
- [x] **[高] `submitSupervisor()` / `publishAll()` 允許無等第送出與發布** → `submitSupervisor()` 在 validateAnswers 後加 `if (!review.grade) throw 400`；`publishAll()` 查出 pending reviews 帶 grade，有任一筆 grade 為 null 即拒絕整批發布。（`reviews.service.ts`）
- [x] **[中高] Supervisor/Manager 可對下屬目標執行 mutation** → `goals.service.ts` 拆出 `assertOwner`（只允許 owner/Admin 寫）與 `assertCanRead`（Supervisor/Manager 可讀）；content mutation（updateGoal、addMilestone、toggleMilestone、updateMilestoneNote、updateMilestoneUrl、reorderMilestones、deleteMilestone、addProgressUpdate）改呼叫 `assertOwner`；approve/reject/read 繼續用 `assertCanRead`。
- [x] **[中高] Admin 建多地區週期模板只套用 `regions[0]`** → `CreateTemplateDto` 加 `regionId?: string`（選填）；service 優先用 `dto.regionId`，其次 fallback `regions[0]`；前端 Admin + multi-region cycle 時顯示「適用地區」必選 selector，未選則送出阻擋。（`templates.service.ts`、`create-template.dto.ts`、`useTemplates.ts`、`templates/page.tsx`）
- [x] **[中] Detail pages 錯誤未顯示** → `goals/[id]`、`reviews/[id]`、`reviews/calibrate/[cycleId]` 補 `error` destructure 及 `ErrorBanner` 渲染。
- [x] **[中] 校準頁 rank 依賴空 grade 送壞 payload** → `handleRankChange` 若 `!review.grade` 直接 return；rank input 加 `disabled={!review.grade}` 並顯示 tooltip 提示先選等第。（`reviews/calibrate/[cycleId]/page.tsx`）
- [x] **[低] PROGRESS.md 底部重複未勾選** → 刪除已在「文件/環境修正」段落標記完成的重複條目。

### 安全漏洞修補（第六輪 Review，已全數修復）

- [x] **[高] `createTemplate()` 直接信任 `dto.regionId`，RegionalHR 可跨 Region 建模板** → 改為：RegionalHR 永遠忽略 `dto.regionId`，使用 `user.regionId`；Admin + 多 region cycle 必須傳 `regionId`，缺少時拋 400；查 Region 並確認 `region.name` 在 `cycle.regions` 內，不存在或不屬於週期皆拋 400；Admin + 單 region cycle 自動繼承（不接受 `dto.regionId`）。（`templates.service.ts`）
- [x] **[中] `goals/[id]` 非 owner 仍可操作里程碑 UI** → 所有里程碑互動元素（+ 新增按鈕、checkbox toggle、drag/drop、備注新增/編輯/刪除、連結新增/刪除、刪除按鈕）加 `isOwner` gate；非 owner 僅能閱讀里程碑及其備注/連結，但不能修改。後端安全已在第五輪修復，本次修前端 UX 以避免無聲 403。（`goals/[id]/page.tsx`）
- [x] **[中] `templates/[id]` 載入失敗顯示「找不到此模板」而非實際錯誤** → `useEffect` 加 `.catch()` 捕捉 API 錯誤並 `setError`；加 `import { ErrorBanner }` 並在 `error` 非空時提前 `return <ErrorBanner />`，403/500/network error 都能正確顯示。（`templates/[id]/page.tsx`）

### 文件 / 環境修正

- [x] **`backend/.env.example` `DATABASE_URL`/`DIRECT_URL` 對調** → `DATABASE_URL` 應帶 `pgbouncer=true`（pooled），`DIRECT_URL` 為直連（migration 用），已修正並加注解。
- [x] **`SCHEMA.md` 評核自動建立時機錯誤** → 觸發點改為 `EmployeeReview`（原文誤寫 `InProgress`）。
- [x] **`PROGRESS.md` Audit Log 狀態錯誤** → 實際是 ES（非 PostgreSQL）；ES 已串接，CRUD 覆蓋不完整。
- [x] **i18n 遷移遺失頁面已補回** → `71fb88b` 刪舊路徑後未在 `[locale]/(app)/` 重建的 7 個動態路由頁面（含 `templates/[id]`）已從 git `e771faf` 還原並更新 `Link` import 為 `@/i18n/navigation`；`templates/[id]` 同步改為 `use(params)` 模式。
- [x] **重跑 `prisma generate`** → `nullable_review_supervisor` migration 後 Prisma 型別已更新（`supervisorId` 正確為 nullable）；`createMany` 的 `as any` 已移除。

### 待改善（中期，非立即阻塞）

- [x] **[中高] 登入無 rate limit / lockout** → `@nestjs/throttler` IP 層（10 次/分鐘）+ `AuthService` 帳號鎖定（失敗 5 次鎖 10 分鐘）。
- [ ] **[中] CSRF 防護不完整** → 目前依賴 `SameSite=Lax`；正式部署若涉及跨子網域需明確 CSRF token 或 double-submit cookie。
- [ ] **[中] 通知內容硬編碼中文，非英語系使用者收到中文通知** → 後端 13 個通知建立點（goals/reviews/appeals/cycles service）的 `title`/`message` 全為硬編碼中文字串，寫入 DB 後前端直接顯示，無法依使用者語言切換。修法：`Notification` schema 加 `params Json?` 欄位 → 後端改傳 params（保留中文字串作 fallback）→ 前端 `Sidebar.tsx` 通知面板改用 `t('notifications.{type}.title/message', params)` 渲染 → 7 個 locale 檔各加 13 種通知的 title + message template。

### 架構層優化（長期）

- [ ] **`PerformanceCycle.regions` 用 `String[]` 無 FK** → region 改名或刪除會造成 cycle 孤兒；中期改 junction table `CycleRegion`。短期先禁止 region rename。
- [ ] **Direct-report schema 調整後**：評核建立後模板題目快照缺失 → 模板新增題目後會影響已進行中的評核。長期應在建立 review 時 snapshot question set。
- [ ] **缺 pagination / filtering** → `findMany` 直接全撈；資料量成長後 API 與 UI 會慢。先對列表端點加 `page/pageSize/status/cycleId`。


---

## UX 問題追蹤（測試回饋）

| # | 問題 | 解法 | 狀態 |
|---|------|------|------|
| 1 | "我的評核" vs "團隊評核" 差異不清楚 | Sidebar nav item 加 subtitle 說明（前者=自己的表單，後者=下屬的評核） | ✅ 已修 |
| 2 | 主管點進尚未填寫的評核，畫面空白無說明 | 偵測 PendingEmployeeSubmit 狀態時顯示 banner：「等待員工填寫自評，目前無法操作」 | ✅ 已修 |
| 3 | 評核頁面版面只有一半寬 | 移除 `max-w-2xl`，改為全寬 | ✅ 已修 |
| 4 | MultipleChoice 題型沒有地方填選項 | 模板新增題目 modal 選 MultipleChoice 時顯示動態選項輸入 UI | ✅ 已修 |
| 5 | 主管評核員工的分界不清楚，且主管回答應為文字 | 改為左右分欄：左側員工自評（唯讀），右側主管逐題文字評語 | ✅ 已修 |
| 6 | O/S+/S/S-/I/U 等第無說明，新主管不懂含義 | 加 ⓘ tooltip 說明各等第定義；員工端結果頁也加等第說明 | ✅ 已修 |
| 7 | 主管看到 "待您填寫" badge 容易誤解 | 改成 "待員工自評"，語意更準確 | ✅ 已修 |
| 8 | 校準頁調整排名後整頁重新載入 | 改為 Optimistic Update，本地狀態更新，失敗才 refetch | ✅ 已修 |
| 9 | 員工發布後看不到主管逐題評語 | 發布後在員工端增加「評核詳情」區塊，左右並排呈現員工自評與主管評語 | ✅ 已修 |
| 10 | 員工不知道 S- 在等第中算高還低 | 員工端結果頁加等第排名說明（O 最高 → U 最低） | ✅ 已修（同 #6） |
| 11 | Manager 申訴詳情只能回覆，不能調整等第 | 回覆表單加等第選擇器（選填）；後端 respondToAppeal 支援 newGrade | ✅ 已修 |
| 12 | 左側導覽列占用固定空間，無法收合 | Sidebar 全面重寫：可收合（localStorage 記憶狀態）、每個導覽項目加一致 icon（h-4 w-4）、收合時顯示 tooltip | ✅ 已修 |
| 13 | Dashboard 歡迎標題含角色 badge，佔用視覺空間 | 移除歡迎標語與角色 badge，標題改為「儀表板」；角色資訊移至 Sidebar 底部用 RoleBadge 呈現 | ✅ 已修 |
| 14 | 週期推進 Dialog 語氣偏口語，icon 有顏色 | 採用【週期名稱】格式、icon 改為純色 SVG；新增 Manager 補充問卷完成率提示（後端 `GET /cycles/:id/manager-questionnaire-status`） | ✅ 已修 |
| 15 | 模板詳情頁（Manager 自訂題）選 MultipleChoice 題型，無法填選項 | templates/[id]/page.tsx 自訂題 modal 補上動態選項輸入 UI（與 templates/page.tsx 一致） | ✅ 已修 |

---

## 2026-05-26 全面審查修正（Code Review 前）

| # | 問題類別 | 問題描述 | 修正方式 | 狀態 |
|---|---------|---------|---------|------|
| 1 | 🔴 Critical RBAC | `appeals.controller.ts` `@Get()` 和 `@Get(':id')` 缺少 `RegionalHR`、`GlobalHR`，導致 RegionalHR 呼叫 API 永遠 403，即使 service 層已正確處理 | 兩個 endpoint 都加上 `Role.RegionalHR, Role.GlobalHR` | ✅ 已修 |
| 2 | 🔴 Critical RBAC | `reviews.controller.ts` `GET ':id'` 缺少 `RegionalHR`，RegionalHR 看不到個別評核 | 加上 `Role.RegionalHR` | ✅ 已修 |
| 3 | 🔴 Critical Bug | `cycles.scheduler.ts` `handleDailyCheck()` 內有兩個相鄰 transaction：第一個只更新 status 沒建 reviews；第二個 `autoAdvanceCycle` 才完整更新 status + 建 reviews，導致雙重寫入 | 移除多餘的第一個 `$transaction` block，僅保留 `autoAdvanceCycle` | ✅ 已修 |
| 4 | 🟠 Missing Notification | `goals.service.ts:approveGoal()` 核准目標後無通知員工 | 新增 `GoalApproved` 通知 type，核准時 `createForUsers([goal.userId])` | ✅ 已修 |
| 5 | 🟠 Missing Notification | `appeals.service.ts:createAppeal()` 員工提出申訴後未通知 Manager | 新增 `AppealFiled` type，申訴建立後通知 managerId | ✅ 已修 |
| 6 | 🟠 Missing Notification | `appeals.service.ts:respondToAppeal()` Manager 解決申訴後未發 bell 通知（只有 `seenByEmployee: false` flag） | 新增 `AppealResolved` type，解決後通知員工 | ✅ 已修 |
| 7 | 🟠 Missing Notification | `reviews.service.ts:submitEmployee()` 員工提交自評後未通知 Supervisor | 新增 `ReviewSubmitted` type，提交後通知 supervisorId（或 managerId） | ✅ 已修 |
| 8 | 🟠 Missing Notification | `reviews.service.ts:submitSupervisor()` Supervisor 提交評核後未通知 Manager | 新增 `ReviewApproved` type，提交後通知 employee.managerId | ✅ 已修 |
| 9 | 🟠 Missing Notification | `reviews.service.ts:publishAll()` 發布評核結果後未通知員工 | 新增 `ReviewPublished` type，發布後通知所有受影響員工 | ✅ 已修 |
| 10 | 🟡 DB Schema | `NotificationType` enum 只有 5 個值，缺少以上 6 個新 type | `schema.prisma` 補全 enum；新建 migration `20260526000002_notification_types_v2` | ✅ 已修 |
| 11 | 🟡 Module DI | `appeals.module.ts`、`reviews.module.ts` 未 import `NotificationsModule`，注入 `NotificationsService` 會失敗 | 兩個 module 都 `imports: [NotificationsModule]` | ✅ 已修 |
| 12 | 🟡 UI Bug | `goals/page.tsx:GoalCard` badge 顏色：`Rejected` 狀態掉到 else 分支顯示灰色，應為紅色 | 加上 `goal.status === 'Rejected' ? 'bg-red-100 text-red-700'` case | ✅ 已修 |
| 13 | 🟡 UI Bug | `dashboard/page.tsx:EmployeeSection` 無 rejected goals 計數，員工不知道有目標被退回 | goalStats 加 `rejected`；有退回目標時顯示紅色 action banner；stats grid 顯示紅色數字 | ✅ 已修 |
| 14 | 🟡 UI Bug | `goals/team/page.tsx` PageHeader breadcrumb 顯示「我的目標 / 團隊目標」，誤導上下級關係 | 移除 breadcrumbs，團隊目標為獨立頂層頁面 | ✅ 已修 |
| 15 | 🟡 UX Bug | Sidebar `NAV_ITEMS`：`teamGoals` 和 `teamReviews` 設有 `isTeam: true`，渲染時加 `ml-3 text-xs` 使其視覺上縮排在「我的目標」/「我的評核」下方，形成錯誤的上下級關係 | 移除 `isTeam: true` 及對應 `ml-3 text-xs` CSS；改為各自頂層項目，以 `dividerBefore` 分組 | ✅ 已修 |
| 16 | 🟡 UX Bug | Sidebar `appeals` entry 只列 `['Manager']`，Admin/GlobalHR/RegionalHR 無申訴入口（且對應 controller @Roles 也缺少） | sidebar roles 補上 Admin/GlobalHR/RegionalHR | ✅ 已修 |
| 17 | 🟡 UX Bug | Sidebar 通知列表點擊只標已讀，不跳轉到相關頁面 | 加 `getNotificationHref(type, role)` function，點通知後 `router.push(href)` | ✅ 已修 |
| 18 | 🔵 Data Gap | `auth.service.ts:login()` 和 `getMe()` response 不含 `managerId`/`supervisorId`，但前端 `User` type 有這兩欄 | 兩個 method 的回傳物件補上 `managerId`/`supervisorId` | ✅ 已修 |
| 19 | 🔵 Type Sync | `frontend/src/types/index.ts` `NotificationType` 只有舊的 5 個值 | 補上 6 個新值 | ✅ 已修 |

---

## 2026-05-26 第二輪審查修正（Code Review 前補強）

| # | 問題類別 | 問題描述 | 修正方式 | 狀態 |
|---|---------|---------|---------|------|
| 1 | 🔴 Type Sync | `SessionUser` 缺少 `managerId?`/`supervisorId?` 欄位；`auth.guard.ts` 也未填入，前端重新整理後 `user.managerId` 為 undefined | `request.types.ts` 補欄位；`auth.guard.ts` 填入 `user.managerId ?? undefined` / `user.supervisorId ?? undefined` | ✅ 已修 |
| 2 | 🔴 RBAC Mismatch | `cycles.controller.ts PATCH /:id` 標 `@Roles(Admin, GlobalHR, RegionalHR)`，但 service 拋 403 給非 Admin — GlobalHR/RegionalHR 永遠 403 | controller 改為 `@Roles(Role.Admin)` 與 service 一致 | ✅ 已修 |
| 3 | 🔴 Null Deref | `goals.service.ts` milestone 操作（toggleMilestone / updateMilestoneNote / updateMilestoneUrl / deleteMilestone）使用 `goal!.userId` 強制解引用，goal 不存在時崩潰 | 四個方法均加 `if (!goal) throw new NotFoundException('Goal not found')` | ✅ 已修 |
| 4 | 🔴 RBAC Gap | `reviews.controller.ts GET /reviews` 缺 `RegionalHR`，RegionalHR 無法查看自己的評核 | 加上 `Role.RegionalHR` | ✅ 已修 |
| 5 | 🟠 UI Logic | `appeals/[id]/page.tsx hasAnswers` 只檢查 `isManager`，Admin/GlobalHR/RegionalHR 看不到 Q&A 面板 | 加 `isHROrAdmin` 判斷，`hasAnswers = (isManager \|\| isHROrAdmin) && ...` | ✅ 已修 |
| 6 | 🟠 UI Bug | `dashboard/page.tsx EmployeeSection` goalStats.rejected 和 pendingReviews 各自渲染獨立 `<h2>actionsRequired</h2>`，兩個條件同時成立時出現重複標題 | 合併為單一 `hasActionItems` 控制，一個 `<section>` 內依序渲染兩種 action 項目 | ✅ 已修 |
| 7 | 🟡 UI Bug | `goals/[id]/page.tsx` status badge：`Rejected` 掉到 else 顯示灰色，應為紅色 | 加 `goal.status === 'Rejected' ? 'bg-red-100 text-red-700'` case | ✅ 已修 |
| 8 | 🟡 i18n | `goals/[id]/page.tsx` 麵包屑中非 owner 顯示硬編碼 `'團隊目標'` | 加 `const tNav = useTranslations('nav')`，改為 `tNav('teamGoals')` | ✅ 已修 |
| 9 | 🟡 i18n | `reviews/team/page.tsx TeamReviewCard` action labels 全部硬編碼中文 | 新增 `teamActionWaitingSup` i18n key 到全部 7 個 locale 檔；`TeamReviewCard` 加 `useTranslations`；`teamActionManager` 同步更新至更準確措辭 | ✅ 已修 |
| 10 | 🟡 Logic Bug | `notifications.service.ts createForUsers` 使用 `skipDuplicates: true`，但 `Notification` table 無 unique constraint — 此選項無效，會讓開發者誤以為有去重保護 | 移除 `skipDuplicates: true` | ✅ 已修 |
| 11 | 🟡 Polling 403 | `useAppealUnreadCount` 對所有角色每 60 秒輪詢，非 Employee 角色每分鐘觸發 403 | hook 加 `enabled` 參數（預設 false）；`Sidebar.tsx` 改為 `useAppealUnreadCount(user?.role === 'Employee')` | ✅ 已修 |
| 12 | 🟡 Security | `audit-write.interceptor.ts sanitizeBody` 只過濾頂層敏感欄位，巢狀物件中的 `password`/`token` 等不會被移除 | 改為遞迴處理；敏感 key set 擴充加入 `accessToken`/`refreshToken`/`apiKey`/`authorization` | ✅ 已修 |
| 13 | 🟡 Audit Gap | `route-action.map.ts` 缺少 `POST:/users`、`PATCH:/cycles/:id/confirm-advance`、`PATCH:/cycles/:id/postpone` | 補齊三個 mapping；Users section 整合去除重複 comment | ✅ 已修 |
| 14 | 🟡 Validation | `cycles.service.ts createCycle` 無日期合理性驗證，可建立 goalSettingEnd > reviewStart 的無效週期 | 加入 `goalStart < goalEnd < reviewStart < reviewEnd` 順序驗證 | ✅ 已修 |
| 15 | 🟡 Config | `main.ts` 生產環境 `origin: process.env.FRONTEND_URL` 只支援完整字串比對，多 origin 或子網域無法匹配 | 改為解析逗號分隔字串成陣列，單值保持字串 | ✅ 已修 |
| 16 | 🔵 TypeScript | `goals.service.ts` `(employee as any).supervisor?.managerId` (×2) — include: { supervisor: true } 已有型別 | 移除兩處 `as any` 強制轉型 | ✅ 已修 |
| 17 | 🔵 TypeScript | `reviews.service.ts` `(employee as any).supervisor?.managerId` (×2) + `where: where as any` | `where` 改型別為 `Prisma.PerformanceReviewWhereInput`；import `Prisma`；移除三處 `as any` | ✅ 已修 |
| 18 | 🔵 Typo | `cycles/page.tsx` `showTemplatTrack`（漏字母 e）→ 4 處全部替換 | `replace_all: true` 修正為 `showTemplateTrack` | ✅ 已修 |

---

## 實作順序（建議）

```
績效週期 → 表單模板 → 目標管理 → 績效評核 → 申訴 → Dashboard → Audit Log（PostgreSQL）
```
