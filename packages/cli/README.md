# SRE AI Agent CLI

智能 SRE 助手 - 透過自然語言查詢管理您的 SRE 任務

## 功能特色

- 🤖 **自然語言介面**：使用自然語言查詢，無需記憶複雜命令
- 🔧 **整合 MCP Servers**：連接 SLO Management 和 Metrics Analysis servers
- 🧠 **智能工作流程**：自動分析意圖、選擇工具並執行
- 🎨 **美觀的 UI**：使用 Ink 建立的互動式 terminal UI
- ✨ **AI 驅動**：使用 OpenAI 理解查詢並生成友善的回應

## 安裝

```bash
pnpm install @sre-agent/cli
```

## 配置

### 環境變數

```bash
# OpenAI 配置（必須）
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4o-mini  # 可選
OPENAI_BASE_URL=https://api.openai.com/v1  # 可選

# MCP Servers 路徑
SLO_SERVER_PATH=./packages/mcp-slo-management/dist/index.js
METRICS_SERVER_PATH=./packages/mcp-metrics-analysis/dist/index.js

# Shared Memory
SHARED_MEMORY_PATH=:memory:
```

## 使用方式

### 基本使用

```bash
# 啟動 CLI
pnpm --filter @sre-agent/cli start

# 或使用開發模式
cd packages/cli
npm run dev
```

### 查詢範例

```
> 分析 guestbook.yaml 並建議 SLO

> 查詢 guestbook 服務的 SLO 狀態

> 檢測最近 1 小時的異常指標

> 查詢 CPU 使用率 top 10

> 計算 slo-001 的錯誤預算
```

## 工作原理

### 智能工作流程

```mermaid
graph LR
    A[用戶查詢] --> B[分析意圖]
    B --> C[規劃工具]
    C --> D[執行]
    D --> E[整合結果]
    E --> F[友善回應]
```

1. **分析（Analyze）**：理解用戶查詢的意圖
2. **規劃（Plan）**：選擇適當的 MCP tools 並準備參數
3. **執行（Execute）**：調用 MCP tools 並收集結果
4. **整合（Synthesize）**：生成友善、易讀的回應

### 可用工具

CLI Agent 整合了 **12 個 MCP Tools**：

**SLO Management (6 tools)**
- `analyze_k8s_manifests` - 分析 K8s manifests
- `track_slo_status` - 追蹤 SLO 狀態
- `calculate_error_budget` - 計算錯誤預算
- `recommend_slos` - 推薦 SLO
- `update_slo_status` - 更新 SLO 狀態
- `generate_slo_report` - 生成報告

**Metrics Analysis (6 tools)**
- `query_metrics` - 即時查詢
- `query_metrics_range` - 範圍查詢
- `discover_metrics` - 探索指標
- `analyze_metric_trend` - 趨勢分析
- `detect_anomalies` - 異常檢測
- `get_top_metrics` - Top N 查詢

## 架構

```
CLI Agent
├── src/
│   ├── mcp/
│   │   ├── manager.ts        - MCP Client Manager
│   │   └── index.ts          - 初始化
│   ├── workflow/
│   │   └── graph.ts          - 智能工作流程
│   ├── ui/
│   │   └── App.tsx           - Ink UI 組件
│   ├── config.ts             - 配置管理
│   └── index.tsx             - 主程式
```

## 開發

```bash
# 開發模式
pnpm --filter @sre-agent/cli dev

# 建置
pnpm --filter @sre-agent/cli build

# 測試
pnpm --filter @sre-agent/cli test
```

## 限制與未來改進

### 目前限制
- 工作流程為順序執行（未來可並行化）
- UI 狀態更新機制較簡單
- 尚未支援多輪對話記憶

### 未來改進
- 加入對話歷史記錄
- 支援更複雜的工具編排
- 加入進度條和更豐富的視覺反饋
- 支援配置檔案

## 授權

MIT
