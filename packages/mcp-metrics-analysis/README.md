# Metrics Analysis MCP Server

Prometheus 指標分析的 MCP Server，提供指標查詢、趨勢分析和異常檢測功能。

## 功能特色

- ✅ **即時指標查詢**：執行 Prometheus 的 instant query
- ✅ **範圍查詢**：查詢時間範圍內的指標資料
- ✅ **指標探索**：自動發現 Prometheus 中的所有可用指標
- ✅ **趨勢分析**：分析指標的增長、下降或穩定趨勢
- ✅ **異常檢測**：基於統計方法檢測指標異常
- ✅ **Top N 查詢**：快速查詢 CPU、Memory、Requests 等 Top 指標

## 安裝

```bash
pnpm install @sre-agent/mcp-metrics-analysis
```

## 配置

### 環境變數

```bash
# Prometheus 配置
PROMETHEUS_ENDPOINT=http://localhost:9090  # 必須
PROMETHEUS_TIMEOUT=30000  # 可選，預設 30 秒

# OpenAI 配置（用於進階分析）
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1  # 可選
OPENAI_MODEL=gpt-4o-mini  # 可選

# Shared Memory 配置
SHARED_MEMORY_PATH=:memory:  # 預設使用記憶體資料庫

# Debug 模式
DEBUG_PROMETHEUS=true  # 顯示 Prometheus 查詢和回應
```

## MCP Tools

### 1. query_metrics

查詢 Prometheus 即時指標。

**輸入**：
```json
{
  "promql": "up",
  "time": 1704067200  // 可選，Unix timestamp
}
```

**輸出**：
```json
{
  "success": true,
  "resultType": "vector",
  "resultCount": 5,
  "results": [...]
}
```

### 2. query_metrics_range

查詢指標範圍。

**輸入**：
```json
{
  "promql": "rate(http_requests_total[5m])",
  "start": 1704067200,
  "end": 1704070800,
  "step": "15s"
}
```

### 3. discover_metrics

探索可用指標。

**輸入**：
```json
{
  "pattern": "^http_.*",  // 可選，正則表達式
  "limit": 100  // 可選，預設 100
}
```

**輸出**：
```json
{
  "success": true,
  "totalCount": 250,
  "returnedCount": 100,
  "metrics": ["http_requests_total", "http_request_duration_seconds", ...]
}
```

### 4. analyze_metric_trend

分析指標趨勢。

**輸入**：
```json
{
  "promql": "node_memory_MemAvailable_bytes",
  "duration": "1h"  // 可選：1h, 6h, 1d, 預設 1h
}
```

**輸出**：
```json
{
  "success": true,
  "duration": "1h",
  "analysis": {
    "trend": "increasing",  // 或 "decreasing", "stable"
    "changePercentage": "15.23",
    "firstValue": "1024000",
    "lastValue": "1180000",
    "dataPoints": 60
  }
}
```

### 5. detect_anomalies

檢測指標異常。

**輸入**：
```json
{
  "promql": "rate(http_requests_total[5m])",
  "duration": "1h",
  "threshold": 3  // 可選，標準差倍數，預設 3
}
```

**輸出**：
```json
{
  "success": true,
  "duration": "1h",
  "threshold": 3,
  "anomaliesDetected": 2,
  "anomalies": [
    {
      "metric": {...},
      "timestamp": "2024-01-10T10:30:00Z",
      "value": "150.50",
      "mean": "50.00",
      "deviation": "4.5"
    }
  ]
}
```

### 6. get_top_metrics

取得 Top N 指標。

**輸入**：
```json
{
  "metricType": "cpu",  // cpu, memory, requests, errors, latency
  "limit": 10  // 可選，預設 10
}
```

## 使用方式

### 作為 MCP Server 運行

```bash
# 設定環境變數
export PROMETHEUS_ENDPOINT=http://localhost:9090

# 啟動 Server
pnpm --filter @sre-agent/mcp-metrics-analysis start
```

### 在 Claude Desktop 中使用

在 Claude Desktop 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "metrics-analysis": {
      "command": "node",
      "args": ["/path/to/packages/mcp-metrics-analysis/dist/index.js"],
      "env": {
        "PROMETHEUS_ENDPOINT": "http://localhost:9090"
      }
    }
  }
}
```

## 架構

```
Metrics Analysis MCP Server
├── config.ts              - 配置管理
├── clients/
│   └── prometheus.ts      - Prometheus API Client
├── tools/
│   ├── schemas.ts         - Zod schemas
│   └── handlers.ts        - Tool 業務邏輯
└── index.ts               - MCP Server 主程式
```

## DEBUG 模式

設定 `DEBUG_PROMETHEUS=true` 可以查看所有送給 Prometheus 的查詢：

```bash
DEBUG_PROMETHEUS=true pnpm --filter @sre-agent/mcp-metrics-analysis start
```

輸出範例：
```
========== PROMETHEUS QUERY DEBUG ==========
Endpoint: http://localhost:9090
PromQL: up
Time: now
===========================================

========== PROMETHEUS RESPONSE DEBUG ==========
Status: success
Result Count: 5
=============================================
```

## 異常檢測原理

使用統計方法檢測異常：
1. 計算指標的平均值（mean）
2. 計算標準差（standard deviation）  
3. 檢測偏離平均值超過 N 倍標準差的資料點
4. 預設閾值為 3（即 3-sigma 原則）

## 整合

### 與 Shared Memory 整合

自動將發現的指標儲存到 Shared Memory，供其他 MCP Servers 使用。

### 與 Prometheus 整合

透過 Prometheus HTTP API 查詢指標：
- `/api/v1/query` - 即時查詢
- `/api/v1/query_range` - 範圍查詢
- `/api/v1/label/__name__/values` - 指標發現

## 開發

```bash
# 開發模式（watch mode）
pnpm --filter @sre-agent/mcp-metrics-analysis dev

# 建置
pnpm --filter @sre-agent/mcp-metrics-analysis build

# 測試
pnpm --filter @sre-agent/mcp-metrics-analysis test
```

## 授權

MIT
