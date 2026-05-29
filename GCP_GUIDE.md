# GCP 基礎設施設定指南（隊友交接文件）

本文件說明你需要在 GCP 上完成的三項設定，對應課程要求的高可用性與監控告警。

---

## 前置條件

- GCP 專案已建立，有 Owner 或 Editor 權限
- Frontend / Backend 已部署到 Cloud Run（CI/CD 會自動更新）
- 等待隊友提供 Grafana Cloud 憑證（Remote Write URL、Username、API Token）再做 Step 3

---

## Step 1：Cloud Run 設定 min-instances = 2（HA 容錯）

> **課程要求**：前端、後端各至少 2 個 container 同時運行

分別對 **Frontend** 和 **Backend** 各做一次：

1. GCP Console → **Cloud Run** → 點選服務名稱
2. 右上角 **Edit & Deploy New Revision**
3. 切到 **Autoscaling** 頁籤：
   - Minimum number of instances：**2**
   - Maximum number of instances：**5**
4. 點 **Deploy**

**驗證**：Cloud Run 服務頁面 → Instances 欄位顯示 ≥ 2。

---

## Step 2：GCP Cloud Monitoring Dashboard + Email 告警

### 2a. 建立 Dashboard

GCP Console → **Monitoring** → **Dashboards** → **Create Dashboard**

Dashboard 名稱：`TSMC PMD - Cloud Run HA`

加入以下 4 個 panels（點 Add Widget → Line chart）：

| Panel 名稱 | Metric | 篩選條件 |
|-----------|--------|---------|
| 請求速率 (req/s) | `run.googleapis.com/request_count` | 無 |
| P95 延遲 (ms) | `run.googleapis.com/request_latencies` | Aggregation: p95 |
| 5xx 錯誤數 | `run.googleapis.com/request_count` | `response_code_class = 5xx` |
| 容器實例數 | `run.googleapis.com/container/instance_count` | 無（用來展示 ≥2） |

### 2b. 設定 Email 告警

GCP Console → **Monitoring** → **Alerting** → **Create Policy**

| 欄位 | 填入值 |
|------|--------|
| Metric | `run.googleapis.com/request_count` |
| Filter | `response_code_class = 5xx` |
| Condition | Rolling window 5 分鐘，threshold > 0 |
| Alert name | `TSMC PMD - 5xx Error Alert` |
| Notification channel | 新增 Email → 填入收件地址 |

**測試告警**：打一個會回傳 500 的請求，等約 5 分鐘應收到 Email。

---

## Step 3：Compute Engine VM + Grafana Alloy（自訂 Metrics 監控）

> Grafana Cloud 憑證已由隊友提供如下，直接使用：

| 欄位 | 值 |
|------|-----|
| Remote Write URL | `https://prometheus-prod-49-prod-ap-northeast-0.grafana.net/api/prom/push` |
| Username | `3260466` |
| API Token | 向隊友索取（不放 git，放在此專案的 notion ） |

### 3a. 建立 Compute Engine VM

GCP Console → **Compute Engine** → **Create Instance**

| 欄位 | 設定值 |
|------|--------|
| Machine type | e2-micro（免費層） |
| Region | 與 Cloud Run 相同 |
| OS | Debian 12 |
| Firewall | 允許 HTTP / HTTPS |

### 3b. SSH 進入 VM，安裝 Docker

```bash
sudo apt-get update && sudo apt-get install -y docker.io
sudo usermod -aG docker $USER && newgrp docker
```

### 3c. 建立 Grafana Alloy 設定檔

```bash
cat > config.alloy << 'EOF'
prometheus.scrape "tsmc_backend" {
  targets = [{
    "__address__" = "你的後端CloudRun網址（不含https:// 例如:tsmc-backend-xxxx-uc.a.run.app）",
    "__scheme__"  = "https",
  }]
  metrics_path    = "/metrics"
  scrape_interval = "15s"
  forward_to      = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = "GRAFANA_REMOTE_WRITE_URL"
    basic_auth {
      username = "GRAFANA_USERNAME"
      password = "GRAFANA_API_TOKEN"
    }
  }
}
EOF
```

> 後端 Cloud Run 網址格式範例：`tsmc-backend-xxxx-uc.a.run.app`（不加 `https://`）

### 3d. 啟動 Grafana Alloy

```bash
docker run -d --name grafana-alloy --restart always \
  -v $(pwd)/config.alloy:/etc/alloy/config.alloy \
  grafana/alloy:latest run /etc/alloy/config.alloy
```

### 3e. 確認運作

```bash
docker logs grafana-alloy --tail 20
```

看到 `scrape` 成功、無 `error` 即完成。

---

## LIVE DEMO 驗收清單

| 項目 | 驗證方式 |
|------|---------|
| 前端 ≥ 2 instances | Cloud Run Console → Frontend → Instances ≥ 2 |
| 後端 ≥ 2 instances | Cloud Run Console → Backend → Instances ≥ 2 |
| DB master-slave | Neon Console 截圖：Primary Compute + Read Replica 兩個節點 |
| Log 存關聯式 DB | 前端 Audit Log 頁面有資料，資料在 Neon PostgreSQL |
| 監控 Dashboard | Grafana Cloud Dashboard 有 API 速率、延遲、Heap 面板 |
| Email 告警 | 觸發 5xx → 收到告警 Email 截圖 |

---

## 聯絡事項

- `/metrics` 端點已實作在後端，路徑為 `https://後端網址/metrics`（在 `/api` prefix 外，不需登入）
- Grafana Cloud Dashboard PromQL 查詢由隊友建立，你只需要讓 Alloy 把資料送過去
