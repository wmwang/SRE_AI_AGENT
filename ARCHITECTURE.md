# SRE AI Agent 系統架構

本文件描述 SRE AI Agent 的完整系統架構，包含各元件的職責、互動方式及資料流程。

---

## 架構總覽

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           使用者介面層                                   │
├───────────────────────────────────┬─────────────────────────────────────┤
│                                   │                                     │
│   ┌─────────────────────┐         │         ┌─────────────────────┐     │
│   │    Web Frontend     │         │         │    CLI (Ink TUI)    │     │
│   │  (React + Vite)     │         │         │   (Node.js + React) │     │
│   └──────────┬──────────┘         │         └──────────┬──────────┘     │
│              │                    │                    │                │
│              │ HTTP/SSE           │                    │ stdio          │
│              │ (瀏覽器限制)        │                    │ (直接呼叫)      │
│              ▼                    │                    │                │
│   ┌─────────────────────────┐     │                    │                │
│   │   Backend Server        │     │                    │                │
│   │   (Hono + Workflows)    │     │                    │                │
│   └───────────┬─────────────┘     │                    │                │
│               │ stdio             │                    │                │
│               ▼                   │                    ▼                │
├───────────────────────────────────┴─────────────────────────────────────┤
│                           MCP 服務層                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│   │  SLO Server   │  │ Metrics Server│  │  Log Server   │  ...          │
│   └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

> **重點**：
> - **CLI** 直接透過 stdio 呼叫 MCP Servers，**不經過 Backend**
> - **Web** 因為瀏覽器限制（不能 spawn 進程），必須透過 Backend 轉發

---

## Monorepo 結構

```
SRE_AI_AGENT/
├── packages/
│   ├── backend/                  # 後端服務 (HTTP + Workflow)
│   ├── cli/                      # CLI 介面 (Ink TUI)
│   ├── web/                      # Web 前端 (Vite + React)
│   ├── workflows/                # 共用 Workflow 邏輯
│   ├── mcp-slo-management/       # SLO 管理 MCP Server
│   ├── mcp-metrics-analysis/     # 指標分析 MCP Server
│   ├── mcp-log-analysis/         # 日誌分析 MCP Server
│   ├── mcp-k8s-integration/      # K8s 整合 MCP Server
│   └── shared-memory/            # 共享記憶體服務
├── docker/                       # Docker 相關檔案
│   └── log-simulator/            # 模擬日誌產生器
├── config/                       # 外部服務設定
│   └── prometheus.yml            # Prometheus 設定
└── docker-compose.yml            # 本地開發環境
```

---

## 核心元件

### 1. Backend Server (`packages/backend`)

| 項目 | 說明 |
|------|------|
| **框架** | Hono (輕量 HTTP 框架) |
| **職責** | 接收 HTTP 請求、執行 Workflow、呼叫 MCP Servers |
| **埠號** | `3001` |

**主要端點**：

| 端點 | 方法 | 說明 |
|------|------|------|
| `/health` | GET | 健康檢查 |
| `/api/workflow/slo` | POST | SSE 串流執行 SLO Workflow |
| `/api/slo/analyze` | POST | 分析 K8s YAML |
| `/api/metrics/query` | POST | 自然語言轉 PromQL |
| `/api/logs/search` | POST | 搜尋日誌 |

---

### 2. Shared Workflows (`packages/workflows`)

抽象化的 LangGraph 風格 workflow，被 Backend 和 CLI 共用。

**核心介面**：

```typescript
interface MCPToolCaller {
    callTool(server: string, tool: string, args: object): Promise<unknown>;
}

interface LLMClient {
    stream(messages: Message[]): AsyncIterable<{ content: string }>;
}

interface WorkflowEventEmitter {
    emit(event: WorkflowEvent): void;
    requestInput?(prompt: string): Promise<string>;
}
```

**SLO Workflow 流程**：

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│  Input  │ → │ Analyze │ → │ Review  │ → │ Refine  │ → │ Generate │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └──────────┘
     │              │              │              │              │
     │         呼叫 MCP       等待用戶       呼叫 LLM       呼叫 MCP
     │         K8s/SLO        確認/反饋       調整 SLO       生成配置
```

---

### 3. CLI (`packages/cli`)

| 項目 | 說明 |
|------|------|
| **框架** | Ink (React for CLI) |
| **職責** | 終端機互動介面、直接呼叫 Workflow |
| **啟動** | `./start-cli.sh` |

CLI 透過 Adapter Pattern 將 `@sre-agent/workflows` 的事件映射到 Ink UI callback。

---

### 4. Web Frontend (`packages/web`)

| 項目 | 說明 |
|------|------|
| **框架** | Vite + React + Tailwind CSS |
| **職責** | 瀏覽器 UI、呼叫 Backend API |
| **埠號** | `5173` |

**Agent Mode**：

Web 支援「Agent Mode」，開啟後會透過 SSE 串流執行完整 Workflow，並即時顯示進度。

---

### 5. MCP Servers

MCP (Model Context Protocol) Servers 提供工具能力，透過 stdio 與 Backend/CLI 通訊。

| Server | 說明 | 主要工具 |
|--------|------|----------|
| `mcp-slo-management` | SLO 管理 | `recommend_slos`, `generate_prometheus_rules` |
| `mcp-metrics-analysis` | 指標分析 | `translate_nl_to_promql`, `analyze_metrics_health` |
| `mcp-log-analysis` | 日誌分析 | `search_logs`, `summarize_logs` |
| `mcp-k8s-integration` | K8s 整合 | `analyze_deployment` |

---

## 資料流程

### A. Web Agent Mode 執行流程

```
1. 用戶上傳 K8s YAML → Web Frontend
2. Web 發送 POST /api/workflow/slo → Backend
3. Backend 建立 SLOGeneratorWorkflow
4. Workflow 執行:
   - inputNode: 驗證輸入
   - analyzeNode: 呼叫 MCP K8s/SLO Server
   - reviewNode: 自動確認 (Web 模式)
   - generateNode: 呼叫 MCP SLO Server
5. 每一步透過 SSE 發送進度事件
6. Web 接收事件並更新 UI
7. 最終結果返回給用戶
```

### B. CLI 互動式流程

```
1. 用戶輸入 YAML 路徑 → CLI TUI
2. CLI 建立 SLOGeneratorWorkflow (with Ink callbacks)
3. Workflow 執行:
   - reviewNode: 顯示 SLO 並等待用戶輸入
   - refineNode: 根據反饋呼叫 LLM 調整
4. 用戶可多次調整直到滿意
5. 生成最終配置
```

---

## 本地開發環境

### Docker Compose 服務

| 服務 | 說明 | 埠號 |
|------|------|------|
| `elasticsearch` | 日誌儲存 | `9200` |
| `kibana` | 日誌視覺化 | `5601` |
| `prometheus` | 指標收集 | `9090` |
| `log-simulator` | 模擬日誌/指標產生器 | `8080` |

### 啟動指令

```bash
# 啟動 Docker 環境
docker compose up -d --build

# 啟動 Backend
cd packages/backend && pnpm dev

# 啟動 Web
cd packages/web && pnpm dev

# 或啟動 CLI
./start-cli.sh
```

---

## 技術棧

| 類別 | 技術 |
|------|------|
| **語言** | TypeScript |
| **AI/LLM** | OpenAI SDK, LangChain |
| **Workflow** | LangGraph-style State Machine |
| **MCP** | Model Context Protocol SDK |
| **Backend** | Hono, Node.js |
| **CLI** | Ink (React for CLI) |
| **Web** | Vite, React 19, Tailwind CSS v4 |
| **圖表** | Recharts |
| **容器** | Docker, Docker Compose |
