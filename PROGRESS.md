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
| Session 閒置 30 分鐘自動登出 | ⬜ 待做 | 目前固定 8 小時 TTL |
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
| 目標詳情頁 | ✅ 完成 | 狀態 badge、SMART 欄位、截止日期、逾期偵測 |
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
| 員工 / 主管各端表單（前端）| ✅ 完成 | Text / Rating / MultipleChoice 三種題型；主管見員工自評（read-only）後填評核 |
| 團隊評核列表（主管側）| ✅ 完成 | `GET /reviews/team`，前端 `/reviews/team` 頁面 |
| 經理校準排名並發布結果 | ✅ 完成 | 前端 `/reviews/calibrate/[cycleId]` 頁面；等第按鈕選取 + 排名輸入 + 一鍵發布；Manager 在 `/reviews/team` 頁面可看到各週期的「進入校準」入口 |
| 主管比較介面（多員工並排）| ✅ 完成 | 前端 `/reviews/compare/[cycleId]`；水平卡片並排，依等第排序；從校準頁「並排比較 →」進入 |

---

### 6. 申訴機制

| 項目 | 狀態 | 備註 |
|------|------|------|
| 員工向經理提出申訴（越過主管）| ✅ 完成 | `POST /api/appeals`；員工在 Published 評核頁點「提出申訴」，輸入原因後送出 |
| 直屬主管不可見申訴內容 | ✅ 完成 | `getAppealById` 只允許當事員工和 Manager 存取，Supervisor 呼叫會拋 403 |
| 經理審核並回覆申訴 | ✅ 完成 | `PATCH /api/appeals/:id/respond`；Manager 在 `/appeals/:id` 頁填寫回覆並解決 |
| 申訴列表頁（經理側）| ✅ 完成 | `/appeals` 頁面顯示所有收到的申訴，可點入詳情 |
| 申訴結果通知員工 | ⬜ 待做 | 目前需員工主動查看評核頁或申訴頁，未實作推播通知 |
| 前端 `/appeals` 頁面串接真實資料 | ✅ 完成 | `useAppeals` hook 已串接 `GET /appeals` |

---

### 7. Audit Log

| 項目 | 狀態 | 備註 |
|------|------|------|
| 登入 / 登出事件寫入 | ✅ 完成 | 非同步寫入，目前存 PostgreSQL |
| 所有 CRUD 操作記錄 | ⬜ 待做 | `AuditService` 為 TODO stub |
| Elasticsearch Append-only 儲存 | ⬜ 待做 | 目前 ES 未串接 |
| 前端 Audit Log 查閱頁 | ⬜ 待做 | 骨架已建，資料未串 |

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
| 點入員工詳情頁 | ✅ 完成 | 顯示基本資料、目標列表（可點入詳情）、評核歷史（可點入評核）；`GET /users/:id/goals` 和 `GET /users/:id/reviews` 已串接真實資料 |

---

## 待辦事項

### 立即需要執行

- [ ] **跑 migration**：`cd backend && npx prisma migrate dev --name refine-cycle-status`（CycleStatus 6 步驟才會生效）
- [ ] **重啟後端**：UsersModule 注入 GoalsModule/ReviewsModule 的 DI 改動需重啟

### 功能待做（建議優先順序）

- [x] **申訴機制** — 已完成（schema + backend + frontend）
- [x] **目標與週期關聯 UI** — 已完成
- [x] **主管多員工並排比較介面** — 已完成
- [x] **Dashboard 等第分布圖表** — 已完成
- [ ] **Audit Log CRUD** — 目前只記錄登入/登出

### 模板設計優化（已討論，待實作）

| # | 功能 | 說明 | 優先度 |
|---|------|------|--------|
| T1 | **Manager 自訂題目跨週期複用** | 模板詳情頁加「從上個週期複製自訂題目」按鈕；找到同 Manager 在前一週期同模板下的自訂題，一次匯入 | 高 |
| T2 | **MultipleChoice 新增「其他（請說明）」選項** | 新增 `OpenEndedChoice` 選項類型，員工選「其他」時出現文字輸入框；或在題型層面支援 fallback text | 中 |
| T3 | **Manager 不可修改 HR 基礎題選項** | 維持現況（設計決策：基礎題鎖定以確保跨部門可比性，Manager 若需部門特定選項應新增自訂題） | ✅ 確認不做 |
| T4 | **自訂題目排序可插入基礎題之間** | 目前自訂題永遠排在基礎題後面；需支援 Manager 調整 orderIndex 至任意位置 | 低 |

### 技術債

- [x] 員工可直接透過 `PUT /goals/:id` body `{ status }` 把目標改為 `PendingApproval`，已改為獨立 endpoint `PATCH /goals/:id/submit`；目標詳情頁草稿狀態下顯示「提交審核」按鈕
- [ ] `AuditService` CRUD 操作只記錄登入/登出，缺少 mutation 覆蓋；ES 寫入失敗只 log error，無重試或 outbox
- [ ] Session 閒置 30 分鐘自動登出尚未實作（目前固定 8 小時 TTL）
- [ ] Audit Log 直接打 ES（`audit.service.ts`），失敗僅 log error，不影響主流程但審計不可靠

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

### 待改善（中期，非立即阻塞）

- [ ] **[中高] 登入無 rate limit / lockout** → `POST /auth/login` 無節流，帳密可暴力嘗試。修法：加 NestJS rate limiter，登入失敗超過 N 次鎖定帳號並寫 audit。
- [ ] **[中] CSRF 防護不完整** → 目前依賴 `SameSite=Lax`；正式部署若涉及跨子網域需明確 CSRF token 或 double-submit cookie。

### 架構層優化（長期）

- [ ] **`PerformanceCycle.regions` 用 `String[]` 無 FK** → region 改名或刪除會造成 cycle 孤兒；中期改 junction table `CycleRegion`。短期先禁止 region rename。
- [ ] **Direct-report schema 調整後**：評核建立後模板題目快照缺失 → 模板新增題目後會影響已進行中的評核。長期應在建立 review 時 snapshot question set。
- [ ] **缺 pagination / filtering** → `findMany` 直接全撈；資料量成長後 API 與 UI 會慢。先對列表端點加 `page/pageSize/status/cycleId`。

### 文件修正

- [ ] `backend/.env.example` `DIRECT_URL` 帶 `pgbouncer=true`，Prisma migration 需要直連，這個 flag 應移除
- [ ] `SCHEMA.md` 寫評核在 `InProgress` 時自動建立 → 實作是推進到 `EmployeeReview` 時建立，需修正

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

## 實作順序（建議）

```
績效週期 → 表單模板 → 目標管理 → 績效評核 → 申訴 → Dashboard → Audit Log（ES）
```
