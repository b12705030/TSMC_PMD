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
| 狀態機單向推進 GoalSetting → InProgress → UnderReview → Completed | ✅ 完成 | `PATCH /api/cycles/:id/advance` |
| 推進前確認 Dialog | ✅ 完成 | 使用 `ConfirmDialog` 元件 |
| 前端 Pipeline Stepper（讓使用者看到目前在哪個階段）| ✅ 完成 | `CycleStepper` 元件，card 式列表顯示 |
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
| 依職等 / 職稱自動套用模板 | ⬜ 待做 | 待績效評核流程實作時串接 |
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
| 主管 / 經理可查看下屬目標 | ✅ 完成 | `GET /api/goals/employee/:id`，RBAC 控管 |
| 主管審核 / 核准目標 | ⬜ 待做 | 目前員工可自行改 status，待加 workflow |
| 目標與績效週期關聯 | ⬜ 待做 | `cycleId` 欄位已預留，待週期選擇 UI |

---

### 5. 績效評核流程

**狀態機：** `PendingEmployeeSubmit → PendingSupervisorReview → PendingManagerApproval → Published`（可申訴 → `Appealed`）

**草稿機制：** 員工和主管各自的階段可以反覆存草稿；按「送出」才推進到下一個狀態，送出後鎖定。

| 項目 | 狀態 | 備註 |
|------|------|------|
| 週期推進 InProgress 時自動建立評核 | ✅ 完成 | `cycles.service.ts` `advanceStatus()` 觸發，依 jobLevel + jobTitle 匹配 Published 模板 |
| 員工填寫績效表單（自評）| ✅ 完成 | `PUT /reviews/:id/answers`（草稿）+ `POST /reviews/:id/submit`（送出鎖定）|
| 主管初評（附文字說明）| ✅ 完成 | `PUT /reviews/:id/supervisor`（草稿）+ `POST /reviews/:id/supervisor/submit`；含等第選擇 |
| 等第制評分（O/S+/S/S-/I/U）| ✅ 完成 | 對應 TSMC 實際制度；O 和 U 各自顯示 soft warning（非硬限制）|
| 員工 / 主管各端表單（前端）| ✅ 完成 | Text / Rating / MultipleChoice 三種題型；主管見員工自評（read-only）後填評核 |
| 團隊評核列表（主管側）| ✅ 完成 | `GET /reviews/team`，前端 `/reviews/team` 頁面 |
| 經理校準排名並發布結果 | ⬜ 待做 | `PUT /reviews/:id/calibrate`、`POST /reviews/cycle/:cycleId/publish` 後端已實作，前端 UI 待建 |
| 主管比較介面（多員工並排）| ⬜ 待做 | 方便主管做相對比較 |

---

### 6. 申訴機制

| 項目 | 狀態 | 備註 |
|------|------|------|
| 員工向經理提出申訴（越過主管）| ⬜ 待做 | 依賴：績效評核 |
| 直屬主管不可見申訴內容 | ⬜ 待做 | Row-level security |
| 經理審核並回覆申訴 | ⬜ 待做 | |

---

### 7. Audit Log

| 項目 | 狀態 | 備註 |
|------|------|------|
| 登入 / 登出事件寫入 | ✅ 完成 | 非同步寫入，目前存 PostgreSQL |
| 所有 CRUD 操作記錄 | ⬜ 待做 | |
| Elasticsearch Append-only 儲存 | ⬜ 待做 | 目前 ES 未串接 |
| 前端 Audit Log 查閱頁 | ⬜ 待做 | 骨架已建，資料未串 |

---

### 8. Dashboard

| 項目 | 狀態 | 備註 |
|------|------|------|
| 各角色對應 Dashboard 內容 | ✅ 完成 | Employee / Supervisor / Manager / HR / Admin 各自顯示待辦事項與數據 |
| 全年週期行程（Gantt 圖）| ✅ 完成 | 固定顯示當年度 1–12 月，目標設定期（藍）/ 評核期（紫）/ 今日標線（琥珀色）|
| 填寫完成率、評分分布圖表 | ⬜ 待做 | |

---

### 9. 團隊管理（Team）

| 項目 | 狀態 | 備註 |
|------|------|------|
| Supervisor 看直屬員工列表 | ✅ 完成 | `GET /users/team`，DataTable |
| Manager 看階層分組視圖 | ✅ 完成 | `GET /users/team/hierarchy`，依 Supervisor 分組；直屬員工（無 Supervisor）獨立顯示 |
| 點入員工詳情頁 | ✅ 完成 | 顯示基本資料、目標列表、評核歷史（目標 / 評核目前回傳空，待串接）|

---

## 實作順序（建議）

```
績效週期 → 表單模板 → 目標管理 → 績效評核 → 申訴 → Dashboard → Audit Log（ES）
```

---

## 已知技術債

- `AppealsService` / `AuditService` 全部為 TODO stub，尚未實作
- 績效評核經理校準頁面（`/cycles/:id/calibrate` 或類似路徑）前端尚未建立；後端 `calibrate` + `publishAll` endpoints 已就緒
- Frontend appeals / audit-log 頁面 hooks 仍回傳假資料，待 backend 對應功能實作後串接
