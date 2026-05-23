[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ============================================================
#  scripts/test-permissions.ps1
#  RBAC + Audit Log integration test
#
#  Prerequisites:
#    - Backend running:       cd backend && npm run start:dev
#    - Elasticsearch running: docker start elasticsearch
#
#  Usage (from project root):
#    powershell -ExecutionPolicy Bypass -File .\scripts\test-permissions.ps1
# ============================================================

$BASE   = "http://127.0.0.1:4000/api"
$ES_URL = "http://127.0.0.1:9200"

$script:PASS_COUNT = 0
$script:FAIL_COUNT = 0
$script:SESSION    = ""   # holds "sessionId=<uuid>" for current user

# ── Helpers --------------------------------------------------

function Write-Header($title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

function Write-Result($label, $expected, $actual) {
    $trimmed = "$actual".Trim()
    if ($trimmed -eq "$expected") {
        Write-Host "  [PASS]  $label  (HTTP $trimmed)" -ForegroundColor Green
        $script:PASS_COUNT++
    } else {
        Write-Host "  [FAIL]  $label  (expected HTTP $expected, got HTTP $trimmed)" -ForegroundColor Red
        $script:FAIL_COUNT++
    }
}

function Invoke-Login($employeeId) {
    # Write JSON body to a temp file to avoid PowerShell 5.1 double-quote mangling
    # when passing arguments to external executables on Windows
    $bodyFile = "$env:TEMP\pms_body.json"
    [System.IO.File]::WriteAllText($bodyFile, '{"employeeId":"' + $employeeId + '","password":"test1234"}')

    $response = curl.exe -s -i `
        -X POST "$BASE/auth/login" `
        -H "Content-Type: application/json" `
        -d "@$bodyFile"

    Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue

    $cookieLine = ($response -split "`r?`n") |
        Where-Object { $_ -imatch "^set-cookie:" } |
        Select-Object -First 1

    if ($cookieLine -match "sessionId=([^;]+)") {
        $script:SESSION = "sessionId=" + $Matches[1].Trim()
    } else {
        $script:SESSION = ""
        Write-Host "  [WARN]  Login did not return a sessionId cookie ($employeeId)" -ForegroundColor Yellow
    }
}

function Invoke-Logout {
    if ($script:SESSION -ne "") {
        curl.exe -s -X POST "$BASE/auth/logout" `
            -H "Cookie: $($script:SESSION)" | Out-Null
    }
    $script:SESSION = ""
}

function Get-Status($method, $path) {
    $tmp = "$env:TEMP\pms_curl_out.tmp"
    $status = curl.exe -s `
        -o $tmp `
        -w "%{http_code}" `
        -X $method `
        -H "Cookie: $($script:SESSION)" `
        "$BASE$path"
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    return $status.Trim()
}

function Get-Body($path) {
    return curl.exe -s `
        -H "Cookie: $($script:SESSION)" `
        "$BASE$path"
}

function Test-Role($employeeId, $role, $method, $path, $expectedStatus) {
    Invoke-Login $employeeId
    $status = Get-Status $method $path
    Write-Result "$employeeId ($role) -> $method $path" $expectedStatus $status
    Invoke-Logout
}

# ============================================================
#  Pre-flight: verify backend / ES / login all work
# ============================================================

Write-Header "Pre-flight checks"

# 1. Backend
$tmp = "$env:TEMP\pms_curl_out.tmp"
$beCheck = curl.exe -s -o $tmp -w "%{http_code}" "$BASE/auth/me"
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
if ($beCheck.Trim() -eq "401") {
    Write-Host "  [OK]  Backend is running at $BASE" -ForegroundColor Green
} else {
    Write-Host "  [ERR] Backend not responding (got HTTP $($beCheck.Trim()))" -ForegroundColor Red
    Write-Host "        Start: cd backend && npm run start:dev" -ForegroundColor DarkYellow
    exit 1
}

# 2. Elasticsearch
$esCheck = curl.exe -s -o $tmp -w "%{http_code}" "$ES_URL"
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
if ($esCheck.Trim() -eq "200") {
    Write-Host "  [OK]  Elasticsearch is running at $ES_URL" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Elasticsearch not responding (Scenario 2 + 4 will be skipped)" -ForegroundColor Yellow
    Write-Host "         Start: docker start elasticsearch" -ForegroundColor DarkYellow
}

# 3. Login + session round-trip
$bodyFile = "$env:TEMP\pms_body.json"
[System.IO.File]::WriteAllText($bodyFile, '{"employeeId":"admin001","password":"test1234"}')
$loginResp = curl.exe -s -i `
    -X POST "$BASE/auth/login" `
    -H "Content-Type: application/json" `
    -d "@$bodyFile"
Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue

$cookieLine = ($loginResp -split "`r?`n") |
    Where-Object { $_ -imatch "^set-cookie:" } |
    Select-Object -First 1

if ($cookieLine -match "sessionId=([^;]+)") {
    $script:SESSION = "sessionId=" + $Matches[1].Trim()
    $meResp = curl.exe -s -H "Cookie: $($script:SESSION)" "$BASE/auth/me"
    if ($meResp -match "employeeId") {
        Write-Host "  [OK]  Login + session working" -ForegroundColor Green
    } else {
        Write-Host "  [ERR] Cookie sent but /auth/me rejected it: $meResp" -ForegroundColor Red
        exit 1
    }
} else {
    $statusLine = ($loginResp -split "`r?`n") | Select-Object -First 1
    Write-Host "  [ERR] Login did not return a sessionId cookie (status: $statusLine)" -ForegroundColor Red
    exit 1
}
Invoke-Logout

# ============================================================
#  Scenario 1: Audit Log access by role
# ============================================================

Write-Header "Scenario 1: Audit Log access (GET /api/audit)"
Write-Host "  Admin / GlobalHR / RegionalHR -> expect 200" -ForegroundColor DarkGray
Write-Host "  Manager / Supervisor / Employee -> expect 403" -ForegroundColor DarkGray

Test-Role "admin001"  "Admin"      "GET" "/audit" "200"
Test-Role "ghr001"    "GlobalHR"   "GET" "/audit" "200"
Test-Role "tw-hr001"  "RegionalHR" "GET" "/audit" "200"
Test-Role "tw-mgr001" "Manager"    "GET" "/audit" "403"
Test-Role "tw-sup001" "Supervisor" "GET" "/audit" "403"
Test-Role "tw-emp001" "Employee"   "GET" "/audit" "403"

# ============================================================
#  Scenario 2: Trigger 403 and verify ES recorded it
# ============================================================

Write-Header "Scenario 2: Trigger 403 and verify Elasticsearch log"

Write-Host "  Step 1 - trigger 403 with Employee account..." -ForegroundColor DarkGray

Invoke-Login "tw-emp001"
$s1 = Get-Status "GET"   "/audit"
Write-Result "tw-emp001 (Employee) -> GET /audit" "403" $s1
$s2 = Get-Status "PATCH" "/users/non-existent-id"
Write-Result "tw-emp001 (Employee) -> PATCH /users/:id" "403" $s2
Invoke-Logout

Write-Host "  Step 2 - Admin queries ES for FORBIDDEN records..." -ForegroundColor DarkGray

Invoke-Login "admin001"
$auditUrl  = "/audit?outcome=FORBIDDEN" + "&" + "size=100"
$auditJson = Get-Body $auditUrl
Invoke-Logout

try {
    $auditData      = $auditJson | ConvertFrom-Json
    $forbiddenCount = $auditData.total
    if ($forbiddenCount -gt 0) {
        Write-Host "  [PASS]  FORBIDDEN events in ES: $forbiddenCount records" -ForegroundColor Green
        $script:PASS_COUNT++
    } else {
        Write-Host "  [FAIL]  No FORBIDDEN records in ES" -ForegroundColor Red
        $script:FAIL_COUNT++
    }
} catch {
    Write-Host "  [WARN]  Could not parse audit response" -ForegroundColor Yellow
}

# ============================================================
#  Scenario 3: GlobalHR vs RegionalHR cross-region access
# ============================================================

Write-Header "Scenario 3: GlobalHR cross-region comparison"

Write-Host "  3a. GET /api/users/regions access..." -ForegroundColor DarkGray

Test-Role "ghr001"    "GlobalHR"        "GET" "/users/regions" "200"
Test-Role "tw-hr001"  "RegionalHR (TW)" "GET" "/users/regions" "200"
Test-Role "na-hr001"  "RegionalHR (NA)" "GET" "/users/regions" "200"
Test-Role "tw-emp001" "Employee"        "GET" "/users/regions" "403"

# How many regions does each role see?
Invoke-Login "ghr001"
$ghrRegionsRaw = Get-Body "/users/regions"
Invoke-Logout

Invoke-Login "tw-hr001"
$twRegionsRaw = Get-Body "/users/regions"
Invoke-Logout

try {
    $ghrCount = ($ghrRegionsRaw | ConvertFrom-Json).Count
    $twCount  = ($twRegionsRaw  | ConvertFrom-Json).Count
    Write-Host "  [INFO]  GlobalHR sees $ghrCount regions | RegionalHR (TW) sees $twCount regions" -ForegroundColor DarkYellow
} catch {
    Write-Host "  [WARN]  Could not parse regions response" -ForegroundColor Yellow
}

Write-Host "  3b. GET /api/reviews/stats (allowed: Supervisor/Manager/RegionalHR/Admin)..." -ForegroundColor DarkGray

Test-Role "ghr001"    "GlobalHR"        "GET" "/reviews/stats" "403"
Test-Role "tw-hr001"  "RegionalHR (TW)" "GET" "/reviews/stats" "200"
Test-Role "na-hr001"  "RegionalHR (NA)" "GET" "/reviews/stats" "200"
Test-Role "tw-mgr001" "Manager"         "GET" "/reviews/stats" "200"
Test-Role "tw-sup001" "Supervisor"      "GET" "/reviews/stats" "200"
Test-Role "tw-emp001" "Employee"        "GET" "/reviews/stats" "403"

# ============================================================
#  Scenario 4: ES raw records (direct :9200 access)
# ============================================================

Write-Header "Scenario 4: ES raw records (direct :9200 access)"

try {
    $countJson = curl.exe -s "$ES_URL/audit-logs/_count" | ConvertFrom-Json
    Write-Host "  Total records  : $($countJson.count)" -ForegroundColor White
} catch {
    Write-Host "  [WARN]  Cannot connect to Elasticsearch" -ForegroundColor Yellow
}

$esBodyFile = "$env:TEMP\pms_es_body.json"

try {
    [System.IO.File]::WriteAllText($esBodyFile, '{"query":{"term":{"outcome":"FORBIDDEN"}},"size":0}')
    $fJson = curl.exe -s -X POST "$ES_URL/audit-logs/_search" `
        -H "Content-Type: application/json" `
        -d "@$esBodyFile" | ConvertFrom-Json
    Write-Host "  FORBIDDEN      : $($fJson.hits.total.value)" -ForegroundColor White
} catch {}

try {
    [System.IO.File]::WriteAllText($esBodyFile, '{"query":{"term":{"outcome":"SUCCESS"}},"size":0}')
    $sJson = curl.exe -s -X POST "$ES_URL/audit-logs/_search" `
        -H "Content-Type: application/json" `
        -d "@$esBodyFile" | ConvertFrom-Json
    Write-Host "  SUCCESS        : $($sJson.hits.total.value)" -ForegroundColor White
} catch {}

try {
    [System.IO.File]::WriteAllText($esBodyFile, '{"size":5,"sort":[{"createdAt":{"order":"desc"}}],"_source":["createdAt","userName","action","outcome"]}')
    $recentJson = curl.exe -s -X POST "$ES_URL/audit-logs/_search" `
        -H "Content-Type: application/json" `
        -d "@$esBodyFile" | ConvertFrom-Json
    Remove-Item $esBodyFile -Force -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "  Latest 5 records:" -ForegroundColor DarkYellow
    Write-Host "  -------------------------------------------------------" -ForegroundColor DarkGray

    foreach ($hit in $recentJson.hits.hits) {
        $src  = $hit._source
        $time = if ($src.createdAt.Length -ge 19) {
            $src.createdAt.Substring(0, 19).Replace("T", " ")
        } else { $src.createdAt }
        $line = "  [{0}]  {1,-15}  {2,-25}  {3}" -f $time, $src.userName, $src.action, $src.outcome
        if ($src.outcome -eq "SUCCESS") {
            Write-Host $line -ForegroundColor Green
        } else {
            Write-Host $line -ForegroundColor Red
        }
    }

    Write-Host "  -------------------------------------------------------" -ForegroundColor DarkGray
} catch {
    Write-Host "  [WARN]  Could not retrieve recent records" -ForegroundColor Yellow
}

Remove-Item $esBodyFile -Force -ErrorAction SilentlyContinue

# ── Summary --------------------------------------------------

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkGray

if ($script:FAIL_COUNT -eq 0) {
    Write-Host ("  Result: {0} PASS  {1} FAIL  -- All passed" -f $script:PASS_COUNT, $script:FAIL_COUNT) -ForegroundColor Green
} else {
    Write-Host ("  Result: {0} PASS  {1} FAIL" -f $script:PASS_COUNT, $script:FAIL_COUNT) -ForegroundColor Red
    Write-Host "  Check: (1) backend running  (2) ES running  (3) seed executed" -ForegroundColor DarkYellow
}

Write-Host "============================================================" -ForegroundColor DarkGray
