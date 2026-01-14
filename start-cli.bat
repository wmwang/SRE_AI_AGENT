@echo off

set "PROJECT_ROOT=%CD%"

if "%OPENAI_API_KEY%"=="" (
  echo [ERROR] OPENAI_API_KEY not set
  echo Run: set OPENAI_API_KEY=your-key
  exit /b 1
)

if not exist "%USERPROFILE%\.sre-agent" mkdir "%USERPROFILE%\.sre-agent"

if "%PROMETHEUS_ENDPOINT%"=="" (
  set MOCK_PROMETHEUS=true
)

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

if not exist "packages\cli\dist" (
  echo [INFO] Building CLI...
  call pnpm --filter @sre-agent/cli build
)

set "SLO_SERVER_PATH=%CD%\packages\mcp-slo-management\dist\index.js"
set "METRICS_SERVER_PATH=%CD%\packages\mcp-metrics-analysis\dist\index.js"
set "K8S_SERVER_PATH=%CD%\packages\mcp-k8s-deployment\dist\index.js"

call pnpm --filter @sre-agent/cli start
