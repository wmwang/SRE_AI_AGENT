@echo off
setlocal EnableDelayedExpansion

REM SRE AI Agent Windows Startup Script

REM 設定專案根目錄
set "PROJECT_ROOT=%CD%"

REM 1. 檢查環境變數
if "%OPENAI_API_KEY%"=="" (
  echo [ERROR] OPENAI_API_KEY environment variable is not set.
  echo Please run: set OPENAI_API_KEY=your-key
  exit /b 1
)

REM 如果沒有設定 Prometheus endpoint，自動啟用 Mock 模式
if "%PROMETHEUS_ENDPOINT%"=="" (
  set MOCK_PROMETHEUS=true
  echo [INFO] No Prometheus detected, enabling Mock Mode
)

echo [INFO] Starting SRE AI Agent...
echo.
echo Environment Settings:
if "%OPENAI_MODEL%"=="" (
  echo   OpenAI Model: gpt-4o-mini (Default)
) else (
  echo   OpenAI Model: %OPENAI_MODEL%
)
if "%MOCK_PROMETHEUS%"=="true" (
  echo   Prometheus: Mock Mode (Simulated Data)
) else if "%PROMETHEUS_ENDPOINT%"=="" (
  echo   Prometheus: http://localhost:9090 (Default)
) else (
  echo   Prometheus: %PROMETHEUS_ENDPOINT%
)
if "%SHARED_MEMORY_PATH%"=="" (
  echo   Shared Memory: :memory: (Default)
) else (
  echo   Shared Memory: %SHARED_MEMORY_PATH%
)
if "%DEBUG_LLM%"=="true" (
  echo   LLM Debug: Enabled (logs/llm-debug.log)
) else (
  echo   LLM Debug: Disabled (set DEBUG_LLM=true to enable)
)
echo.

REM 2. 確保所有 packages 都已建置
echo [INFO] Checking build status...

if not exist "packages\mcp-slo-management\dist" (
  echo [WARN] SLO Server not built, building now...
  call pnpm --filter @sre-agent/mcp-slo-management build
)

if not exist "packages\mcp-metrics-analysis\dist" (
  echo [WARN] Metrics Server not built, building now...
  call pnpm --filter @sre-agent/mcp-metrics-analysis build
)

if not exist "packages\mcp-k8s-deployment\dist" (
  echo [WARN] K8s Deployment Server not built, building now...
  call pnpm --filter @sre-agent/mcp-k8s-deployment build
)

if not exist "packages\cli\dist" (
  echo [WARN] CLI not built, building now...
  call pnpm --filter @sre-agent/cli build
)

echo [INFO] Build check complete.
echo.

REM 3. 設定 MCP Server 路徑 (Windows path format)
set "SLO_SERVER_PATH=%CD%\packages\mcp-slo-management\dist\index.js"
set "METRICS_SERVER_PATH=%CD%\packages\mcp-metrics-analysis\dist\index.js"
set "K8S_SERVER_PATH=%CD%\packages\mcp-k8s-deployment\dist\index.js"

echo [INFO] Starting CLI Agent...
echo ========================================
echo.

REM 4. 啟動 CLI
call pnpm --filter @sre-agent/cli start

endlocal
