# SLO Management MCP Server

SLO 生命週期管理的 MCP Server，提供 SLO 的動態建立、建議、追蹤、部署和長期優化功能。

## 功能特色

- ✅ **AI 驅動的 SLO 分析**：使用 OpenAI 分析 K8s manifests 並自動建議 SLOs
- ✅ **SLO 狀態追蹤**：即時追蹤 SLO 達成狀態
- ✅ **錯誤預算計算**：計算並追蹤錯誤預算消耗
- ✅ **智能推薦**：基於服務類型推薦合適的 SLOs
- ✅ **狀態管理**：更新和維護 SLO 狀態
- ✅ **報告生成**：生成詳細的 SLO 達成報告

## 安裝

```bash
pnpm install @sre-agent/mcp-slo-management
```

## 配置

### 環境變數

```bash
# OpenAI 配置
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1  # 可選，支援自訂 endpoint
OPENAI_MODEL=gpt-4o-mini  # 可選

# Shared Memory 配置
SHARED_MEMORY_PATH=~/.sre-agent/shared-memory.db

# Prometheus 配置（未來使用）
PROMETHEUS_ENDPOINT=http://localhost:9090
```

## MCP Tools

### 1. analyze_k8s_manifests

分析 K8s manifests 並建議 SLO。

**輸入**：
```json
{
  "manifests": "apiVersion: apps/v1\nkind: Deployment\n...",
  "serviceId": "my-service"  // 可選
}
```

**輸出**：
```json
{
  "success": true,
  "slosCount": 5,
  "slos": [
    {
      "id": "slo-001",
      "name": "API Availability",
      "description": "Availability of API endpoints",
      "description_zh": "API 端點的可用性",
      "target": 99.9,
      "threshold": null,
      "window": "30d",
      "golden_signal": "Errors"
    }
  ]
}
```

### 2. track_slo_status

追蹤 SLO 達成狀態。

**輸入**：
```json
{
  "serviceId": "my-service",  // 可選
  "status": "at-risk"  // 可選: met, at-risk, violated, unknown
}
```

**輸出**：
```json
{
  "success": true,
  "stats": {
    "total": 10,
    "met": 7,
    "atRisk": 2,
    "violated": 1,
    "unknown": 0
  },
  "slos": [...]
}
```

### 3. calculate_error_budget

計算錯誤預算。

**輸入**：
```json
{
  "sloId": "slo-001"
}
```

**輸出**：
```json
{
  "success": true,
  "slo": {
    "id": "slo-001",
    "name": "API Availability",
    "target": 99.9
  },
  "errorBudget": {
    "total": 0.1,
    "remaining": 0.05,
    "consumed": 0.05,
    "consumedPercentage": "50.00",
    "status": "met"
  },
  "recommendation": "注意：錯誤預算已消耗超過 50%，建議密切監控"
}
```

### 4. recommend_slos

基於服務類型推薦 SLO。

**輸入**：
```json
{
  "serviceType": "api",
  "description": "RESTful API service"  // 可選
}
```

### 5. update_slo_status

更新 SLO 狀態。

**輸入**：
```json
{
  "sloId": "slo-001",
  "status": "at-risk",
  "errorBudget": 0.05
}
```

### 6. generate_slo_report

生成 SLO 報告。

**輸入**：
```json
{
  "serviceId": "my-service",  // 可選
  "period": "30d"  // 可選: 7d, 30d, 90d
}
```

## 使用方式

### 作為 MCP Server 運行

```bash
# 設定環境變數
export OPENAI_API_KEY=your-api-key

# 啟動 Server
pnpm --filter @sre-agent/mcp-slo-management start
```

### 在 Claude Desktop 中使用

在 Claude Desktop 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "slo-management": {
      "command": "node",
      "args": ["/path/to/packages/mcp-slo-management/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 架構

```
SLO Management MCP Server
├── config.ts           - 配置管理
├── clients/
│   └── openai.ts       - OpenAI Client
├── tools/
│   ├── schemas.ts      - Zod schemas
│   └── handlers.ts     - Tool 處理邏輯
└── index.ts            - MCP Server 主程式
```

## Golden Signals

本 Server 遵循 Google SRE 的 Golden Signals 原則：

- **Latency**（延遲）：請求回應時間
- **Traffic**（流量）：系統負載
- **Errors**（錯誤）：失敗率
- **Saturation**（飽和度）：資源使用率

## 整合

### 與 Shared Memory 整合

自動將分析結果儲存到 Shared Memory，供其他 MCP Servers 使用。

### 與 OpenAI 整合

使用 OpenAI官方 SDK，支援：
- 完整的 system prompt 自訂
- SSE streaming（未來功能）
- 自訂 base URL（支援內部 LLM）

## 開發

```bash
# 開發模式（watch mode）
pnpm --filter @sre-agent/mcp-slo-management dev

# 建置
pnpm --filter @sre-agent/mcp-slo-management build

# 測試
pnpm --filter @sre-agent/mcp-slo-management test
```

## 授權

MIT
