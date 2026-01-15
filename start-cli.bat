@echo off

set "PROJECT_ROOT=%CD%"



if not exist "%USERPROFILE%\.sre-agent" mkdir "%USERPROFILE%\.sre-agent"


if "%ELASTICSEARCH_ENDPOINT%"=="" (
  set MOCK_ELASTICSEARCH=true
)

echo [INFO] Starting SRE AI Agent...
echo.
echo Environment:
echo   OpenAI: %OPENAI_MODEL%
echo   Prometheus: %PROMETHEUS_ENDPOINT%
if "%DEBUG_LLM%"=="true" (
  echo   LLM Debug: Enabled
)
echo.


if not exist "packages\mcp-slo-management\dist" (
  echo [INFO] Building SLO Server...
  call pnpm --filter @sre-agent/mcp-slo-management build
)

if not exist "packages\mcp-metrics-analysis\dist" (
  echo [INFO] Building Metrics Server...
  call pnpm --filter @sre-agent/mcp-metrics-analysis build
)

if not exist "packages\mcp-k8s-deployment\dist" (
  echo [INFO] Building K8s Deployment Server...
  call pnpm --filter @sre-agent/mcp-k8s-deployment build
)

if not exist "packages\mcp-log-analysis\dist" (
  echo [INFO] Building Log Analysis Server...
  call pnpm --filter @sre-agent/mcp-log-analysis build
)

if not exist "packages\cli\dist" (
  echo [INFO] Building CLI...
  call pnpm --filter @sre-agent/cli build
)

set "SLO_SERVER_PATH=%CD%\packages\mcp-slo-management\dist\index.js"
set "METRICS_SERVER_PATH=%CD%\packages\mcp-metrics-analysis\dist\index.js"
set "K8S_SERVER_PATH=%CD%\packages\mcp-k8s-deployment\dist\index.js"
set "LOG_SERVER_PATH=%CD%\packages\mcp-log-analysis\dist\index.js"

call pnpm --filter @sre-agent/cli start
