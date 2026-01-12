#!/bin/bash

# SRE AI Agent 啟動腳本

# 檢查環境變數
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ 錯誤: OPENAI_API_KEY 環境變數未設定"
  echo "請執行: export OPENAI_API_KEY=your-key"
  exit 1
fi

# 如果沒有設定 Prometheus endpoint，自動啟用 Mock 模式
if [ -z "$PROMETHEUS_ENDPOINT" ]; then
  export MOCK_PROMETHEUS=true
  echo "ℹ️  未偵測到 Prometheus，自動啟用 Mock 模式"
fi

echo "🚀 啟動 SRE AI Agent..."
echo ""
echo "環境設定:"
echo "  OpenAI Model: ${OPENAI_MODEL:-gpt-4o-mini}"
echo "  Prometheus: ${PROMETHEUS_ENDPOINT:-Mock Mode (模擬數據)}"
echo "  Shared Memory: ${SHARED_MEMORY_PATH:-:memory:}"
echo ""

# 確保所有 packages 都已建置
echo "📦 檢查建置狀態..."
if [ ! -d "packages/mcp-slo-management/dist" ]; then
  echo "⚠️  SLO Server 未建置，正在建置..."
  pnpm --filter @sre-agent/mcp-slo-management build
fi

if [ ! -d "packages/mcp-metrics-analysis/dist" ]; then
  echo "⚠️  Metrics Server 未建置，正在建置..."
  pnpm --filter @sre-agent/mcp-metrics-analysis build
fi

if [ ! -d "packages/mcp-k8s-deployment/dist" ]; then
  echo "⚠️  K8s Deployment Server 未建置，正在建置..."
  pnpm --filter @sre-agent/mcp-k8s-deployment build
fi

if [ ! -d "packages/cli/dist" ]; then
  echo "⚠️  CLI 未建置，正在建置..."
  pnpm --filter @sre-agent/cli build
fi

echo "✅ 建置檢查完成"
echo ""

# 設定 MCP Server 路徑
export SLO_SERVER_PATH="$(pwd)/packages/mcp-slo-management/dist/index.js"
export METRICS_SERVER_PATH="$(pwd)/packages/mcp-metrics-analysis/dist/index.js"
export K8S_SERVER_PATH="$(pwd)/packages/mcp-k8s-deployment/dist/index.js"

echo "🤖 啟動 CLI Agent..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 啟動 CLI
pnpm --filter @sre-agent/cli start
