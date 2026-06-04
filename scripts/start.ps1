#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path $PSScriptRoot -Parent

# --- Paths ---

$WORLD_EXE  = "$ROOT\world-service\build\world-service.exe"
$PIXI_LOCK  = "$ROOT\ml-service\pixi.lock"
$ML_DIR     = "$ROOT\ml-service"
$ORC_DIR    = "$ROOT\orchestrator"
$FE_DIR     = "$ROOT\frontend"

# --- Output helpers ---

function Write-Step  { param($msg) Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  OK $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  !! $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  ERR $msg" -ForegroundColor Red }
function Write-Title { param($msg) Write-Host "`n--- $msg ---" -ForegroundColor White }

# --- Process tracking ---

$script:TrackedPids = New-Object System.Collections.Generic.List[int]

function Register-Proc {
    param($proc)
    if ($null -ne $proc -and -not $proc.HasExited) {
        $script:TrackedPids.Add($proc.Id)
    }
}

function Stop-AllServices {
    Write-Title "Остановка сервисов"
    foreach ($p in $script:TrackedPids) {
        taskkill /F /T /PID $p 2>&1 | Out-Null
    }
    Write-Ok "Все сервисы остановлены."
}

# --- MSSQL check ---

function Test-Mssql {
    try {
        Add-Type -AssemblyName System.Data -ErrorAction SilentlyContinue
        $cs = 'Server=localhost;Database=VoiceConverter;Integrated Security=true;Connect Timeout=3;TrustServerCertificate=true;'
        $conn = New-Object System.Data.SqlClient.SqlConnection($cs)
        $conn.Open()
        $conn.Close()
        return $true
    } catch {
        return $false
    }
}

# --- Wait for HTTP service ---

function Wait-Http {
    param($url, $name, $timeoutSec = 60)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
            Write-Ok "$name готов"
            return $true
        } catch {
            Start-Sleep -Milliseconds 1500
        }
    }
    Write-Warn "$name не ответил за ${timeoutSec}с"
    return $false
}

# --- Start service in new window ---

function Start-Svc {
    param($label, $exe, $argList, $workDir)
    Write-Step "Запуск: $label"
    $p = Start-Process -FilePath $exe -ArgumentList $argList -WorkingDirectory $workDir -PassThru
    Register-Proc $p
}

# ===========================================================================

Write-Host ""
Write-Host "  Voice Converter" -ForegroundColor White
Write-Host "  -----------------------------------" -ForegroundColor White
Write-Host ""

# 1. Pre-flight checks

Write-Title "Проверки"

if (-not (Test-Path $WORLD_EXE)) {
    Write-Fail "world-service.exe не найден: $WORLD_EXE"
    Write-Fail "Запустите cmake_build.bat в world-service/"
    exit 1
}

if (-not (Test-Path $PIXI_LOCK)) {
    Write-Fail "Pixi environment не установлен."
    Write-Fail "Выполните: cd ml-service && pixi install"
    exit 1
}

Write-Step "Проверка MSSQL..."
if (-not (Test-Mssql)) {
    Write-Fail "MSSQL недоступен. SQL Server должен быть запущен."
    exit 1
}
Write-Ok "MSSQL: доступна"

# 2. Start services

Write-Title "Запуск сервисов"

try {
    Start-Svc "WORLD (:8002)" $WORLD_EXE "" "$ROOT\world-service\build"

    Start-Svc "ML    (:8001)" "pixi" "run serve" $ML_DIR

    Start-Svc "Orch  (:5000)" "dotnet" "run --project orchestrator.csproj --urls http://0.0.0.0:5000" $ORC_DIR

    Start-Svc "UI    (:5173)" "cmd" "/c npm run dev" $FE_DIR

    # 3. Wait for readiness

    Write-Title "Ожидание"

    Wait-Http "http://localhost:8002/health" "WORLD"      60
    Wait-Http "http://localhost:8001/health" "ML"         60
    Wait-Http "http://localhost:5000/health" "Orchestrator" 90
    Wait-Http "http://localhost:5173"        "Frontend"   60

    # 4. Open browser

    Start-Process "http://localhost:5173"

    Write-Host ""
    Write-Host "  Все сервисы запущены. Ctrl+C для остановки." -ForegroundColor Green
    Write-Host ""

    while ($true) {
        Start-Sleep -Seconds 5
    }

} finally {
    Stop-AllServices
}
