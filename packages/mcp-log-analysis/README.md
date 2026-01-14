# Log Analysis MCP Server

AI-Powered 日誌分析 MCP Server，整合 Elasticsearch 與 OpenAI，提供智能化的日誌搜尋、模式分析和根因診斷。

## 🎯 功能特色

- ✅ **智能搜尋**：自然語言轉 Elasticsearch Query DSL
- ✅ **錯誤模式分析**：AI 識別重複錯誤模式並提供改善建議
- ✅ **日誌摘要**：自動總結大量日誌，提取關鍵發現
- ✅ **靈活認證**：支援 Header-based API Key（Bearer 或自訂 header）
- ✅ **Mock 模式**：無需 Elasticsearch 也能體驗功能

## 🛠️ MCP Tools

### 1. `search_logs` - 搜尋日誌
```typescript
{
  query: "database timeout",           // 可選
  timeRange: {
    start: "now-1h",  // 或 Unix timestamp
    end: "now"
  },
  filters: {
    level: "ERROR",                    // 或 ["ERROR", "WARN"]
    service: "payment-service",
    namespace: "production"
  },
  size: 100
}
```

### 2. `nl_to_es_query` - 自然語言轉 ES Query
```typescript
{
  naturalQuery: "過去 1 小時 payment-service 的錯誤日誌"
}
// 返回：ES Query DSL + 說明 + 信心度
```

### 3. `analyze_error_patterns` - 分析錯誤模式
```typescript
{
  timeRange: { start: "now-24h", end: "now" },
  service: "payment-service",          // 可選
  minOccurrences: 3                    // 最小重複次數
}
// AI 分析：模式、嚴重度、潛在原因、建議
```

### 4. `summarize_logs` - 日誌摘要
```typescript
{
  timeRange: { start: "now-1h", end: "now" },
  service: "payment-service",
  maxLogs: 500
}
// AI 摘要：整體總結、關鍵發現、Top 錯誤
```

## ⚙️ 設定

### 環境變數

**Elasticsearch (Header-based API Key)**
```bash
# 基本設定
export ELASTICSEARCH_ENDPOINT="https://your-es-server.com"
export ELASTICSEARCH_API_KEY="your-api-key"

# 方式 1: Authorization Bearer (預設)
# Header: Authorization: Bearer your-api-key

# 方式 2: 自訂 Header (例如 X-API-Key)
export ELASTICSEARCH_API_KEY_HEADER="X-API-Key"
export ELASTICSEARCH_USE_BEARER="false"
# Header: X-API-Key: your-api-key

# Mock 模式（無 ES 時）
export MOCK_ELASTICSEARCH="true"

# Index Pattern
export LOG_INDEX_PATTERN="logs-*"
```

**OpenAI (AI 功能)**
```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4o-mini"  # 可選
```

## 🚀 使用方式

### 獨立運行
```bash
cd packages/mcp-log-analysis
pnpm build
pnpm start
```

### 整合到 CLI
在 `start-cli.sh` 中已自動包含，無需額外設定。

## 📊 範例

### 搜尋錯誤日誌
```json
{
  "tool": "search_logs",
  "input": {
    "filters": { "level": "ERROR" },
    "timeRange": { "start": "now-1h", "end": "now" },
    "size": 50
  }
}
```

### AI 分析錯誤模式
```json
{
  "tool": "analyze_error_patterns",
  "input": {
    "timeRange": { "start": "now-24h", "end": "now" },
    "service": "payment-service"
  }
}
```

## 🔧 開發

### 編譯
```bash
pnpm build
```

### 測試
```bash
pnpm test
```

### Watch 模式
```bash
pnpm dev
```

## 📝 架構

```
mcp-log-analysis/
├── src/
│   ├── index.ts              # MCP Server 入口
│   ├── config.ts             # 配置管理
│   ├── clients/
│   │   ├── elasticsearch.ts  # ES 客戶端（含 Mock）
│   │   └── openai.ts        # OpenAI 客戶端
│   ├── tools/
│   │   ├── schemas.ts       # Zod schemas
│   │   └── handlers.ts      # Tool handlers
│   └── utils/
│       └── llm-logger.ts    # LLM 日誌記錄
```

## 🎨 整合

### 與其他 MCP Server 協同
- **Metrics MCP**: 關聯錯誤日誌與指標異常
- **SLO MCP**: 分析 SLO 違規時的相關日誌
- **K8s MCP**: 查詢 Pod/Deployment 的日誌

### CLI/Web UI
透過 MCP 協議統一調度，提供一致的使用體驗。

## 🐛 Debug

### 啟用 LLM 日誌
```bash
export DEBUG_LLM=true
# 日誌位置: ~/.sre-agent/llm-debug.log
```

### Mock 模式測試
```bash
export MOCK_ELASTICSEARCH=true
# 使用模擬數據，無需真實 ES
```

## 📄 License

MIT
